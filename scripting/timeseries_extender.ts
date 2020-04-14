import * as fs from 'fs';
import * as moment from 'moment';
import ParserUtility, {Aggregation, Metric, TimeseriesEntry} from './ParserUtility';

const config = require('./extraction_config.json');

const REPORT_EXTENSION_DATE = config.date; // first: '03-18-2020'
const TIME_SERIES_KEY_FORMAT = config.timeseries.key_date_format;

const SKIP_US_RECOVERIES = config.timeseries.skip_us_recoveries;

// infected, recovered, dead
const metrics = [Metric.Infected, Metric.Recovered, Metric.Dead];

const LEGACY = config.timeseries.legacy_series_input;
const BEAUTIFY = config.timeseries.beautify_output;

(async () => {
	console.log('Date:', REPORT_EXTENSION_DATE);
	const firstMoment = moment('2020-01-22');
	const reportExtensionMoment = moment(REPORT_EXTENSION_DATE);
	const lastReportMoment = moment(REPORT_EXTENSION_DATE).subtract(1, 'day');

	const timeseriesDateKey = reportExtensionMoment.format(TIME_SERIES_KEY_FORMAT);
	const timeseriesPreviousDateKey = lastReportMoment.format(TIME_SERIES_KEY_FORMAT);
	const jsonInputDateKey = lastReportMoment.format('YYYY-MM-DD');
	const jsonOutputDateKey = reportExtensionMoment.format('YYYY-MM-DD');

	const inJson = `${__dirname}/output/covid_timeseries_${jsonInputDateKey}.json`;
	const outJson = `${__dirname}/output/covid_timeseries_${jsonOutputDateKey}.json`;

	// const legacyJson = `${__dirname}/input/covid_legacy_timeseries_03-22-2020.json`;
	const legacyJson = `${__dirname}/input/covid_legacy_timeseries_03-17-2020.json`;

	const jsonInputFile = LEGACY ? legacyJson : inJson;
	const oldTimeseriesData: TimeseriesEntry[] = JSON.parse(fs.readFileSync(jsonInputFile).toString('utf-8'));

	const deltaJson = `${__dirname}/output/delta_${REPORT_EXTENSION_DATE}.json`;
	const dailyDelta = JSON.parse(fs.readFileSync(deltaJson).toString('utf-8'));

	const processedAggregationKeys = {};

	if (dailyDelta['date'] !== REPORT_EXTENSION_DATE) {
		console.error('Unexpected date!');
		return;
	}

	const deltaSequence: Aggregation[] = dailyDelta['sequence'];
	const deltaEntriesByLocation = dailyDelta['entries'];

	const newTimeseriesData = [];
	for (const entry of oldTimeseriesData) {

		const locationDetails = entry.location;
		const aggregationKey = ParserUtility.getAggregationKey(locationDetails);
		const debugInfo = ParserUtility.getDebuggingInformationForLocation(locationDetails);

		processedAggregationKeys[aggregationKey] = true;

		const delta: Aggregation = deltaEntriesByLocation[aggregationKey];
		if (delta && delta.localeHash !== entry.localeHash) {
			console.error('Locale hash mismatch!');
			process.exit(1);
		}

		for (const currentMetric of metrics) {
			if (SKIP_US_RECOVERIES && currentMetric === Metric.Recovered && locationDetails.country.short_name === 'US') {
				continue;
			}

			const metricEntry = entry.entries[currentMetric];
			if (metricEntry[timeseriesDateKey] !== undefined) {
				console.error('Timeseries already contains date key:', timeseriesDateKey);
				return;
			}
			if (metricEntry[timeseriesPreviousDateKey] === undefined) {
				console.error('Timeseries does not yet contain previous date key:', timeseriesPreviousDateKey);
				return;
			}

			const previousValue = entry.entries[currentMetric][timeseriesPreviousDateKey];

			if (currentMetric === Metric.Recovered && locationDetails.state && locationDetails.state.long_name === 'California') {
				debugger
			}

			if (delta) {
				const newValue = delta[currentMetric];
				/*
				if (!Number.isSafeInteger(previousValue)) {
					// previous value is unsafe integer
					console.error(`Last ${currentMetric} value was non-numeric ${previousValue}, overriding in lieu of new value ${newValue} // ${debugInfo}`);
					entry.entries[currentMetric][timeseriesDateKey] = previousValue;
					continue;
				}
				if (newValue < previousValue) {
					console.log(`Attempting to undo time: ${currentMetric} ${previousValue} -> ${newValue} // ${debugInfo}`);
					if (newValue <= 0) {
						// the entire record is being eliminated!
						console.log('\tDisallowing record elimination, null going forward');
						// assuming data is unreliable going forward
						entry.entries[currentMetric][timeseriesDateKey] = null;
						continue;
					}
					const valueDelta = previousValue - newValue;
					const fraction = newValue / previousValue;
					if (fraction < 0.6 && valueDelta > 1) {
						console.log('\tDisallowing data manipulation (removing 40% of the value exceeding 1), null going forward');
						// assuming data is unreliable going forward
						entry.entries[currentMetric][timeseriesDateKey] = null;
						continue;
					}
					console.log('\tAssuming non-malicious record correction.');
				}
				*/
				entry.entries[currentMetric][timeseriesDateKey] = newValue;
			} else {
				console.error(`No new information available for location, extend previous value: ${currentMetric} ${previousValue} // ${debugInfo}`);
				entry.entries[currentMetric][timeseriesDateKey] = previousValue;
			}
		}
		newTimeseriesData.push(entry);
	}

	const emptyTimeseries = {};
	const timeDelta = reportExtensionMoment.diff(firstMoment, 'day');
	for (let i = 0; i < timeDelta; i++) {
		const currentMoment = firstMoment.clone().add(i, 'day');
		const timeseriesKey = currentMoment.format(TIME_SERIES_KEY_FORMAT);
		emptyTimeseries[timeseriesKey] = 0;
	}

	for (const delta of deltaSequence) {
		const locationDetails = delta.location;
		const aggregationKey = ParserUtility.getAggregationKey(locationDetails);
		const debugInfo = delta.localeHash;

		if (processedAggregationKeys[aggregationKey]) {
			continue;
		}

		const template: TimeseriesEntry = {
			localeHash: delta.localeHash,
			location: delta.location,
			entries: {}
		};

		for (const currentMetric of metrics) {

			if (SKIP_US_RECOVERIES && currentMetric === Metric.Recovered && locationDetails.country.short_name === 'US') {
				continue;
			}

			template.entries[currentMetric] = {
				...emptyTimeseries,
				[timeseriesDateKey]: delta[currentMetric]
			};
		}

		// this is a new entry!
		// debugger

		newTimeseriesData.push(template);
	}

	const output = BEAUTIFY ? JSON.stringify(newTimeseriesData, null, 4) : JSON.stringify(newTimeseriesData);
	fs.writeFileSync(outJson, output);

})();
