import * as csvParser from 'csv-parse/lib/sync';
import * as fs from 'fs';
import ParserUtility, {AddressComponent, Aggregation, CSVEntry, LocationDetails} from './ParserUtility';
import LocationUtility from './LocationUtility';

const config = require('./extraction_config.json');
const INITIAL_REPORT = config.date;

const REPORT_INPUT_DIRECTORY = `${__dirname}/../docs/data/fetcher/COVID-19/csse_covid_19_data/csse_covid_19_daily_reports`;
const DELTA_OUTPUT_DIRECTORY = `${__dirname}/output`;

let hasFailedLocationLookups = false;

async function processSingleDayDelta(reportDate: string) {
	const reportCsv = `${REPORT_INPUT_DIRECTORY}/${reportDate}.csv`;
	const deltaJson = `${DELTA_OUTPUT_DIRECTORY}/delta_${reportDate}.json`;

	const locationDebuggingJson = `${__dirname}/location_debugging.json`;

	// step 1: parse the csv
	const csvBuffer = fs.readFileSync(reportCsv);
	const reportData: CSVEntry[] = csvParser(csvBuffer, {columns: true}).map(ParserUtility.normalizeEntry);

	const locationReferences: { [key: string]: LocationDetails } = {};
	const locationDebugging = {};
	for (const currentEntry of reportData) {
		const locationKey = ParserUtility.getLocationKeyForEntry(currentEntry);
		if (locationReferences[locationKey]) {
			continue;
		}
		let locationDetails;
		try {
			locationDetails = await LocationUtility.getLocationDetailsForEntry(currentEntry);
		} catch (e) {
			hasFailedLocationLookups = true;
			continue;
		}
		locationReferences[locationKey] = locationDetails;
		locationDebugging[ParserUtility.getDebuggingInformationForCSVEntry(currentEntry)] = locationDetails;
	}

	fs.writeFileSync(locationDebuggingJson, JSON.stringify(locationDebugging, null, 4));

	// step 2: aggregate the deltas
	const deltaSequence = [];
	const deltasByGroup = {};
	const deltaSequenceIndices = {};

	for (const [index, currentEntry] of reportData.entries()) {
		const locationKey = ParserUtility.getLocationKeyForEntry(currentEntry);
		const locationDetails = locationReferences[locationKey];

		if (locationDetails.skip) {
			console.log('Skipping:', ParserUtility.getDebuggingInformationForCSVEntry(currentEntry));
			continue; // ignore
		}

		const country = locationDetails.country;
		if (!country) {
			console.error('Empty country:', ParserUtility.getDebuggingInformationForCSVEntry(currentEntry));
			continue;
		}

		const aggregationKey = ParserUtility.getAggregationKey(locationDetails);

		const sequenceIndex = Number.isSafeInteger(deltaSequenceIndices[aggregationKey]) ? deltaSequenceIndices[aggregationKey] : deltaSequence.length;
		deltaSequenceIndices[aggregationKey] = sequenceIndex;
		const aggregation: Aggregation = deltaSequence[sequenceIndex] || {
			location: locationDetails,
			localeHash: ParserUtility.getAggregationHash(locationDetails),
			infected: 0,
			recovered: 0,
			dead: 0
		};

		let confirmed = parseInt(currentEntry.Confirmed);
		let recovered = parseInt(currentEntry.Recovered);
		let dead = parseInt(currentEntry.Deaths);

		if (!Number.isSafeInteger(confirmed)) {
			confirmed = 0;
		}
		if (!Number.isSafeInteger(recovered)) {
			recovered = 0;
		}
		if (!Number.isSafeInteger(dead)) {
			dead = 0;
		}

		aggregation.infected += confirmed;
		aggregation.recovered += recovered;
		aggregation.dead += dead;
		deltaSequence[sequenceIndex] = aggregation;
		deltasByGroup[aggregationKey] = aggregation;
	}

	if (hasFailedLocationLookups) {
		// don't save anything
		return;
	}

	// const date = moment(INITIAL_REPORT);
	const output = {
		date: reportDate,
		entries: deltasByGroup,
		sequence: deltaSequence
	};
	const outputString = config.daily.beautify_output ? JSON.stringify(output, null, 4) : JSON.stringify(output);
	fs.writeFileSync(deltaJson, outputString);
}

async function processTimeRange(startDate: string) {
	const contents = fs.readdirSync(REPORT_INPUT_DIRECTORY);
	const startTimestamp = new Date(startDate).getTime();
	const reportFiles = contents.filter(filename => {
		if (!filename.endsWith('.csv')) {
			return false;
		}
		const date = filename.substr(0, filename.length - 4);
		const timestamp = new Date(date).getTime();
		return timestamp >= startTimestamp;
	});

	// const promises = [];

	for (const currentFile of reportFiles){
		const date = currentFile.substr(0, currentFile.length-4);
		const currentProcessing = processSingleDayDelta(date);
		await currentProcessing;
		// promises.push(currentProcessing);
	}

	// await Promise.all(promises);
}

(async () => {
	const confirmedJson = `${__dirname}/../docs/data/covid_confirmed.json`;

	// await processSingleDayDelta(INITIAL_REPORT);
	await processTimeRange(INITIAL_REPORT);

	return;
	const dailySeriesFolder = `${__dirname}/../docs/data/fetcher/COVID-19/csse_covid_19_data/csse_covid_19_daily_reports/`;
	const directory = fs.readdirSync(dailySeriesFolder);
	for (const currentFile of directory) {
		if (!currentFile.endsWith('.csv')) {
			continue;
		}
		const components = currentFile.split('-');
		if (components.length !== 3) {
			continue;
		}

		const date = currentFile.substr(0, currentFile.length - 4);
		await processSingleDayDelta(date);
	}


})();
