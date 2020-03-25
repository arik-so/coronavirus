import * as fs from 'fs';
import * as moment from 'moment';
import ParserUtility, {Aggregation, LocationDetails, Metric, TimeseriesEntry} from './ParserUtility';

const REPORT_EXTENSION_DATE = '03-24-2020';
const TIME_SERIES_KEY_FORMAT = 'M/D/YY';

// infected, recovered, dead
const metrics = [Metric.Infected, Metric.Dead];

const LEGACY = false;
const BEAUTIFY = true;

(async () => {
	const firstMoment = moment('2020-01-22');
	const reportExtensionMoment = moment(REPORT_EXTENSION_DATE);
	const lastReportMoment = moment(REPORT_EXTENSION_DATE).subtract(1, 'day');

	const timeseriesDateKey = reportExtensionMoment.format(TIME_SERIES_KEY_FORMAT);
	const timeseriesPreviousDateKey = lastReportMoment.format(TIME_SERIES_KEY_FORMAT);
	const jsonInputDateKey = lastReportMoment.format('YYYY-MM-DD');
	const jsonOutputDateKey = reportExtensionMoment.format('YYYY-MM-DD');

	const inJson = `${__dirname}/output/covid_timeseries_${jsonInputDateKey}.json`;
	const outJson = `${__dirname}/output/covid_timeseries_${jsonOutputDateKey}.json`;

	const legacyJson = `${__dirname}/input/covid_legacy_timeseries_03-22-2020.json`;

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
		const debugInfo = entry.localeHash;

		processedAggregationKeys[aggregationKey] = true;

		const delta: Aggregation = deltaEntriesByLocation[aggregationKey];
		if (delta && delta.localeHash !== entry.localeHash) {
			console.error('Locale hash mismatch!');
			process.exit(1);
		}

		for (const currentMetric of metrics) {
			const metricEntry = entry.entries[currentMetric];
			if (metricEntry[timeseriesDateKey] !== undefined) {
				console.error('Timeseries already contains date key:', timeseriesDateKey);
				return;
			}
			if (metricEntry[timeseriesPreviousDateKey] === undefined) {
				console.error('Timeseries does not yet contain previous date key:', timeseriesPreviousDateKey);
				return;
			}

			if (delta) {
				const relevantDelta = delta[currentMetric];
				entry.entries[currentMetric][timeseriesDateKey] = relevantDelta;
			} else {
				entry.entries[currentMetric][timeseriesDateKey] = entry.entries[currentMetric][timeseriesPreviousDateKey];
				console.error('No new information available for location, extend from previous known date:', debugInfo);
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
			template.entries[currentMetric] = {
				...emptyTimeseries,
				[timeseriesDateKey]: delta[currentMetric]
			};
		}

		// this is a new entry!
		debugger

		newTimeseriesData.push(template);
	}

	const output = BEAUTIFY ? JSON.stringify(newTimeseriesData, null, 4) : JSON.stringify(newTimeseriesData);
	fs.writeFileSync(outJson, output);

})();
