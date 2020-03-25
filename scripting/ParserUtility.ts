import * as crypto from 'crypto';

export default class {
	static getLocationKeyForEntry(entry: CSVEntry): string {
		// ATTENTION! Long_ may be spelled with a trailing underscore! Check each day to verify it's still there
		let combinedKey = entry.Combined_Key;
		if (!combinedKey) {
			combinedKey = `${entry.Province_State}, ${entry.Country_Region}`;
		}
		return `${entry.Lat},${entry.Long_}|${combinedKey}`;
	}

	static getAggregationKey(locationDetails: LocationDetails): string {
		const country = locationDetails.country;
		const countryName = country.long_name;
		let aggregationKey = countryName;

		if (country.short_name === 'US') {
			aggregationKey = (locationDetails.state.short_name || locationDetails.state.long_name) + '|USA';
		} else if (country.short_name === 'CN') {
			aggregationKey = locationDetails.state.short_name + '|China';
		}

		if (aggregationKey === undefined) {
			debugger
		}

		return aggregationKey;
	}

	static getAggregationHash(locationDetails: LocationDetails): string {
		const aggregationKey = this.getAggregationKey(locationDetails);
		return crypto.createHash('sha256').update(aggregationKey).digest('hex')
	}

	static getDebuggingInformationForCSVEntry(entry: CSVEntry): string {
		// ATTENTION! Long_ may be spelled with a trailing underscore! Check each day to verify it's still there
		return `${entry.Country_Region}, ${entry.Province_State}, ${entry.Admin2}: (${entry.Lat},${entry.Long_}) (FIPS: ${entry.FIPS}) [${this.getLocationKeyForEntry(entry)}]`;
	}

	static normalizeEntry(entry: CSVEntry | object): CSVEntry {
		// @ts-ignore
		const response: CSVEntry = {
			...entry,
			Province_State: entry['Province_State'] || entry['Province/State'],
			Country_Region: entry['Country_Region'] || entry['Country/Region'],
			Lat: entry['Lat'] || entry['Latitude'] || '0',
			Long_: entry['Long_'] || entry['Longitude'] || entry['Long'] || '0'
		};
		if (response.Lat === undefined) {
			debugger
		}
		return response;
	}

	static normalizeTimeseries(entry: ProcessedCSVEntry | TimeseriesEntry, defaultMetric: Metric): TimeseriesEntry {
		if (!entry['entries']) {
			// @ts-ignore
			const result: TimeseriesEntry = {
				location: {
					country: entry['country'],
					state: entry['state'],
					county: entry['county']
				}
			};
			result['localeHash'] = this.getAggregationHash(result.location);
			const entries = {
				[defaultMetric]: {}
			};
			for (const [key, value] of Object.entries(entry)) {
				if (key.split('/').length !== 3) {
					// must be a date key
					continue;
				}
				entries[defaultMetric][key] = value;
			}
			result['entries'] = entries;
			// @ts-ignore
			return result;
		}
		// @ts-ignore
		return entry;
	}
}

export enum Metric {
	Infected = 'infected',
	Recovered = 'recovered',
	Dead = 'dead'
}

export interface Timeseries { [key: string]: number }

export interface TimeseriesEntry {
	localeHash: string,
	location: LocationDetails,
	entries: {
		infected?: Timeseries,
		recovered?: Timeseries,
		dead?: Timeseries,
	}
}

export interface Aggregation {
	localeHash: string,
	location: LocationDetails,
	infected: number,
	recovered: number,
	dead: number,
}



export interface CSVEntry {
	FIPS: string;
	Admin2: string;
	Province_State: string;
	Country_Region: string;
	Lat: string;
	Long_: string;
	Combined_Key: string,
	Confirmed: string,
	Recovered: string,
	Deaths: string
}

export interface ProcessedCSVEntry extends CSVEntry, LocationDetails {
}



export interface AddressComponent {
	short_name: string,
	long_name: string,
	types: string[]
}

export interface LocationDetails {
	country: AddressComponent,
	state: AddressComponent,
	county: AddressComponent,
	skip?: boolean
}
