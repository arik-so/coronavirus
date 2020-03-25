// https://maps.googleapis.com/maps/api/geocode/json?latlng=40.714224,-73.961452&key=AIzaSyBAYWv2G3w-yqfevwZafZnmjjCgKOcBrXI

import * as csvParser from 'csv-parse/lib/sync';
import * as fs from 'fs';
import * as rp from 'request-promise-native';
import LocationUtility from './LocationUtility';
import ParserUtility, {Metric, Timeseries, TimeseriesEntry} from './ParserUtility';

const coordinateCacheJson = __dirname + '/addressLookups.json';

const confirmedCsv = __dirname + '/input/time_series_19-covid-Confirmed.csv';
const recoveredCsv = __dirname + '/input/time_series_19-covid-Recovered.csv';
const deadCsv = __dirname + '/input/time_series_19-covid-Deaths.csv';

const nonDataKeys = ['Province/State', 'Country/Region', 'Lat', 'Long', 'country', 'state', 'county'];

let prefix = '';

const confirmedJson = __dirname + `/output/${prefix}covid_confirmed.json`;
const recoveredJson = __dirname + `/output/${prefix}covid_recovered.json`;
const deadJson = __dirname + `/output/${prefix}covid_dead.json`;

// do some manual maintenance. These are not to be saved

// stop updating the recovery data going forward
const csvFiles = [confirmedCsv, recoveredCsv, deadCsv];
const jsonFiles = [confirmedJson, recoveredJson, deadJson];

const jsonFile = __dirname + `/output/covid_legacy_timeseries.json`;
const metrics = [Metric.Infected, Metric.Recovered, Metric.Dead];

(async () => {

	// optionally, we may wanna aggregate the results to make the calculations faster on the website
	const aggregationIndices = {};
	const aggregatedResults = [];


	for (const [dataIndex, csvFile] of csvFiles.entries()) {

		const rawCsvData = fs.readFileSync(csvFile);
		// const jsonFile = jsonFiles[dataIndex];
		const metric = metrics[dataIndex];

		const parsedCsvRecords = csvParser(rawCsvData, {columns: true});
		const sanitizedRecords: TimeseriesEntry[] = [];

		const entryCounter = {};
		const trailingEmptyCells = {};
		for (const [i, currentRecord] of parsedCsvRecords.entries()) {
			console.log('Annotating row', i + 1, 'of', parsedCsvRecords.length);
			const normalizedRecord = ParserUtility.normalizeEntry(currentRecord);

			const debuggingInformation = ParserUtility.getDebuggingInformationForCSVEntry(normalizedRecord);
			const {country, state, county, skip} = await LocationUtility.getLocationDetailsForEntry(normalizedRecord);

			if (skip) {
				continue;
			}

			try {
				const entryCounterKey = `${country['long_name']}|${state ? state['long_name'] : ''}`;
				entryCounter[entryCounterKey] = (entryCounter[entryCounterKey] || 0) + 1;

				const columns = Object.keys(currentRecord);
				const lastKey = columns[columns.length - 1];
				const lastValue = currentRecord[lastKey];
				if (lastValue === '') {
					trailingEmptyCells[entryCounterKey] = i;
				}

			} catch (e) {
				console.log('no country result for:');
				console.dir(debuggingInformation);
			}


			const sanitizedRow = {
				country,
				state,
				county,
				...currentRecord
			};
			const normalizedRow = ParserUtility.normalizeTimeseries(sanitizedRow, metric);
			sanitizedRecords.push(normalizedRow);
		}

		// SECTION REMOVED: Trailing empty cell autofill

		for (const [index, sanitizedRow] of sanitizedRecords.entries()) {
			const locationDetails = sanitizedRow.location;
			const aggregationKey = ParserUtility.getAggregationKey(locationDetails);

			if (!locationDetails.country) {
				console.log('Empty country:');
				console.dir(sanitizedRow);
			}

			const aggregationIndex = Number.isSafeInteger(aggregationIndices[aggregationKey]) ? aggregationIndices[aggregationKey] : aggregatedResults.length;
			aggregationIndices[aggregationKey] = aggregationIndex;

			// let's first clean up the current delta

			let startSkipping = false;
			const metricEntries: Timeseries = sanitizedRow.entries[metric];
			for (const [currentKey, currentRawValue] of Object.entries(metricEntries)) {

				let currentValue = parseInt(`${currentRawValue}`);
				if (!Number.isSafeInteger(currentValue) || startSkipping) {
					currentValue = 0;
				}

				/*
				// LOOKS LIKE THIS IS NO LONGER NECESSARY
				if (rawCountry === 'US' && rawProvince.includes(',') && currentKey === '3/9/20') {
					startSkipping = true; // the next entry, starting with 3/10/20, will be skipped
				}
				*/

				sanitizedRow.entries[metric][currentKey] = currentValue;
			}

			const aggregation: TimeseriesEntry = aggregatedResults[aggregationIndex] || sanitizedRow;

			if (aggregationIndex !== aggregatedResults.length) {
				// this is not a new entry, so it can be appended
				const previousEntries = aggregation.entries[metric];
				if (previousEntries) {
					// it may have only been from a different metric
					for (const currentKey of Object.keys(metricEntries)) {
						let currentValue = metricEntries[currentKey];
						let previousValue = previousEntries[currentKey];
						aggregation.entries[metric][currentKey] = previousValue + currentValue;
					}
				} else {
					// this is a new data key
					aggregation.entries[metric] = sanitizedRow.entries[metric];
				}
			}
			aggregatedResults[aggregationIndex] = aggregation;
		}

		fs.writeFileSync(jsonFile, JSON.stringify(aggregatedResults, null, 4));
	}

})();
