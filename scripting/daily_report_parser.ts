import * as csvParser from 'csv-parse/lib/sync';
import * as fs from 'fs';
import ParserUtility, {AddressComponent, Aggregation, CSVEntry, LocationDetails} from './ParserUtility';
import LocationUtility from './LocationUtility';

const INITIAL_REPORT = '03-23-2020';

async function processSingleDayDelta(reportDate: string) {
	const reportCsv = `${__dirname}/../docs/data/fetcher/COVID-19/csse_covid_19_data/csse_covid_19_daily_reports/${reportDate}.csv`;
	const deltaJson = `${__dirname}/output/delta_${reportDate}.json`;

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
		const locationDetails = await LocationUtility.getLocationDetailsForEntry(currentEntry);
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

	// const date = moment(INITIAL_REPORT);
	const output = {
		date: INITIAL_REPORT,
		entries: deltasByGroup,
		sequence: deltaSequence
	};
	fs.writeFileSync(deltaJson, JSON.stringify(output, null, 4));
}

(async () => {
	const confirmedJson = `${__dirname}/../docs/data/covid_confirmed.json`;

	await processSingleDayDelta(INITIAL_REPORT);

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
