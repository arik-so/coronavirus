import ParserUtility, {AddressComponent, CSVEntry, LocationDetails} from './ParserUtility';
import * as fs from 'fs';
import * as rp from 'request-promise-native';
import {GOOGLE_API_KEY} from './ApiCredentials';

export default class LocationUtility {

	static lookupInitialized = false;
	static lookupResults;

	static async getLocationDetailsForEntry(entry: CSVEntry): Promise<LocationDetails> {
		const coordinateCacheJson = __dirname + '/coordinateCache.json';
		if (!this.lookupInitialized) {
			// handle some caching
			this.lookupInitialized = true;

			try {
				this.lookupResults = JSON.parse(fs.readFileSync(coordinateCacheJson).toString('utf8'));
			} catch (e) {
				console.trace(e);
			}
		}

		const locationKey = ParserUtility.getLocationKeyForEntry(entry);
		if (this.auxiliaryDisambiguationLookups[locationKey]) {
			return this.auxiliaryDisambiguationLookups[locationKey];
		}

		const debuggingInformation = ParserUtility.getDebuggingInformationForCSVEntry(entry);
		if (debuggingInformation.includes('cruise') || debuggingInformation.includes('Princess') || debuggingInformation.includes('ship')) {
			// all cruise ship affairs must be solved before any request is sent to Google!
			console.log('unexpected cruise ship:', debuggingInformation);
			process.exit(1);
			// debugger
			// @ts-ignore
			return {skip: true};
		}

		const latitude = entry.Lat;
		const longitude = entry.Long_;
		const lookupKey = `${latitude}|${longitude}`;

		let addressComponents: AddressComponent[] = this.auxiliaryCoordinateLookups[lookupKey] || this.lookupResults[lookupKey]; // allow auxiliary entries to override cache
		if (!addressComponents) {
			console.log('No cached data, looking up:', ParserUtility.getDebuggingInformationForCSVEntry(entry));
			const uri = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
			try {
				const location = await rp({
					uri,
					json: true
				});
				const results: object[] = location['results'];
				if (results.length < 1) {
					throw new Error('no lookup results whatsoever');
				}
				if (results.length > 1) {
					results.sort((resA, resB) => {
						const addressComponentsA = resA['address_components'];
						const addressComponentsB = resB['address_components'];

						// does it contain a county?
						const keys = ['administrative_area_level_2', 'administrative_area_level_1', 'country'];
						for (const currentKey of keys) {
							const countyA = addressComponentsA.find(ac => ac.types.includes(currentKey) && ac.types.includes('political'));
							const countyB = addressComponentsB.find(ac => ac.types.includes(currentKey) && ac.types.includes('political'));

							if (countyA && countyB) {
								return 0;
							} else if (countyA) {
								return -1;
							} else if (countyB) {
								return 1;
							}
						}
						return 0;
					});
				}
				const bestResult = results[0];
				addressComponents = bestResult['address_components'];

				const country = addressComponents.find(ac => ac.types.includes('country') && ac.types.includes('political'));
				if (!country) {
					throw new Error('no politically precise lookup result');
				}

				// addressComponents = location['results'][0]['address_components'];
				this.lookupResults[lookupKey] = addressComponents;
				// console.dir(addressComponents);
				fs.writeFileSync(coordinateCacheJson, JSON.stringify(this.lookupResults, null, 4));
			} catch (e) {


				// is it one of these retarded US edge-cases?
				if (entry.Country_Region === 'US' && (entry.Admin2.startsWith('Out of ') || entry.Admin2 === 'Unassigned' || entry.Lat === '0')) {
					// console.log('US out-of/unassigned edge case');
					const stateLongName = entry.Province_State;
					const stateShortName = this.getUSState({name: stateLongName});
					addressComponents = [
						{
							short_name: 'US',
							long_name: 'United States',
							types: ['country', 'political']
						},
						{
							long_name: stateLongName,
							short_name: stateShortName,
							types: [
								'administrative_area_level_1',
								'political'
							]
						}
					];
				} else {
					if (e.message.includes('whatsoever')) {
						console.error('No lookup results at all:', debuggingInformation);
						console.error(locationKey);
						process.exit(1);
					}

					addressComponents = [
						{
							// @ts-ignore
							error: 'NO_LOOKUP_RESULT',
							types: ['country', 'political']
						}
					];
					// console.trace(e);
					console.error(`${e.message} for:`, ParserUtility.getDebuggingInformationForCSVEntry(entry));
				}
			}
		}

		const country = addressComponents.find(ac => ac.types.includes('country') && ac.types.includes('political'));
		const state = addressComponents.find(ac => ac.types.includes('administrative_area_level_1') && ac.types.includes('political'));
		const county = addressComponents.find(ac => ac.types.includes('administrative_area_level_2') && ac.types.includes('political'));

		const googleLocationDetails = {country, state, county};

		if (entry.Country_Region === 'US') {
			const csvState = entry.Province_State;
			const googleState = (state && state.long_name);
			const googleCountry = (country && country.long_name);
			const googleLocale = `${googleCountry}, ${googleState}`;
			if (csvState !== googleState) {
				console.error(`State mismatch: ${csvState} -> ${googleLocale} //`, ParserUtility.getDebuggingInformationForCSVEntry(entry));
			}
		}

		return googleLocationDetails;
	}

	static getUSState(filter: { code?: string, name?: string }): string {
		const hashTable = {
			'AL': 'Alabama',
			'AK': 'Alaska',
			'AS': 'American Samoa',
			'AZ': 'Arizona',
			'AR': 'Arkansas',
			'CA': 'California',
			'CO': 'Colorado',
			'CT': 'Connecticut',
			'DE': 'Delaware',
			'DC': 'District Of Columbia',
			'FM': 'Federated States Of Micronesia',
			'FL': 'Florida',
			'GA': 'Georgia',
			'GU': 'Guam',
			'HI': 'Hawaii',
			'ID': 'Idaho',
			'IL': 'Illinois',
			'IN': 'Indiana',
			'IA': 'Iowa',
			'KS': 'Kansas',
			'KY': 'Kentucky',
			'LA': 'Louisiana',
			'ME': 'Maine',
			'MH': 'Marshall Islands',
			'MD': 'Maryland',
			'MA': 'Massachusetts',
			'MI': 'Michigan',
			'MN': 'Minnesota',
			'MS': 'Mississippi',
			'MO': 'Missouri',
			'MT': 'Montana',
			'NE': 'Nebraska',
			'NV': 'Nevada',
			'NH': 'New Hampshire',
			'NJ': 'New Jersey',
			'NM': 'New Mexico',
			'NY': 'New York',
			'NC': 'North Carolina',
			'ND': 'North Dakota',
			'MP': 'Northern Mariana Islands',
			'OH': 'Ohio',
			'OK': 'Oklahoma',
			'OR': 'Oregon',
			'PW': 'Palau',
			'PA': 'Pennsylvania',
			'PR': 'Puerto Rico',
			'RI': 'Rhode Island',
			'SC': 'South Carolina',
			'SD': 'South Dakota',
			'TN': 'Tennessee',
			'TX': 'Texas',
			'UT': 'Utah',
			'VT': 'Vermont',
			'VI': 'Virgin Islands',
			'VA': 'Virginia',
			'WA': 'Washington',
			'WV': 'West Virginia',
			'WI': 'Wisconsin',
			'WY': 'Wyoming'
		};
		if (filter.code) {
			return hashTable[filter.code];
		} else if (filter.name) {
			for (const [code, name] of Object.entries(hashTable)) {
				if (name === filter.name) {
					return code;
				}
			}
		}

		throw new Error('invalid search filter: ' + JSON.stringify(filter));
	}

	static auxiliaryCoordinateLookups = {
		'31.9522|35.2332': [{
			long_name: 'West Bank',
			short_name: 'PS',
			types: [
				'country',
				'political'
			]
		}],
		'49.3723|-2.3644': [{
			long_name: 'Channel Islands',
			types: [
				'country',
				'political'
			]
		}],
		'35.1264|33.4299': [{
			long_name: 'Cyprus',
			short_name: 'CY',
			types: [
				'country',
				'political'
			]
		}],
		'35.4437|139.638': [{
			long_name: 'Diamond Princess Cruise Ship',
			types: [
				'country',
				'political'
			]
		}],
		'37.6489|-122.6655': [{
			long_name: 'Grand Princess Cruise Ship',
			types: [
				'country',
				'political'
			]
		}],
		'-17.6797|149.4068': [{
			long_name: 'French Polynesia',
			types: [
				'country',
				'political'
			]
		}],
		'42.6026|20.903': [{
			long_name: 'Kosovo',
			types: [
				'country',
				'political'
			]
		}],
		'42.6026|20.9030': [{
			long_name: 'Kosovo',
			types: [
				'country',
				'political'
			]
		}],
		'42.6026|20.903000000000002': [{
			long_name: 'Kosovo',
			types: [
				'country',
				'political'
			]
		}],
		'24.25|-76': [{
			long_name: 'The Bahamas',
			short_name: 'BS',
			types: [
				'country',
				'political'
			]
		}],
		'24.2500|-76.0000': [{
			long_name: 'The Bahamas',
			short_name: 'BS',
			types: [
				'country',
				'political'
			]
		}],
		'24.25|-76.0': [{
			long_name: 'The Bahamas',
			short_name: 'BS',
			types: [
				'country',
				'political'
			]
		}],
		'21.0943|-157.4983': [
			{
				long_name: 'Hawaii',
				short_name: 'HI',
				types: [
					'administrative_area_level_1',
					'political'
				]
			},
			{
				long_name: 'United States',
				short_name: 'US',
				types: [
					'country',
					'political'
				]
			}
		],
		'37.8099|101.0583': [
			{
				long_name: 'Gansu',
				short_name: 'Gansu',
				types: [
					'administrative_area_level_1',
					'political'
				]
			},
			{
				long_name: 'China',
				short_name: 'CN',
				types: [
					'country',
					'political'
				]
			}
		],
		'11.8251|42.5903': [
			{
				long_name: 'Djibouti',
				short_name: 'DJ',
				types: [
					'country',
					'political'
				]
			}
		],
		'52.72541116|-110.4086433': [
			{
				long_name: 'Alaska',
				short_name: 'AK',
				types: [
					'administrative_area_level_1',
					'political'
				]
			},
			{
				long_name: 'United States',
				short_name: 'US',
				types: [
					'country',
					'political'
				]
			}
		],
		'36.27167174|-90.09122243': [
			{
				long_name: 'Missouri',
				short_name: 'MO',
				types: [
					'administrative_area_level_1',
					'political'
				]
			},
			{
				long_name: 'United States',
				short_name: 'US',
				types: [
					'country',
					'political'
				]
			}
		]
	};

	static auxiliaryDisambiguationLookups = {
		'0.0,0.0|Diamond Princess, Cruise Ship': {
			country: {
				long_name: 'Diamond Princess Cruise Ship'
			}
		},
		'0,0|Diamond Princess, Cruise Ship': {
			country: {
				long_name: 'Diamond Princess Cruise Ship'
			}
		},
		'35.4498,139.6649|Diamond Princess, Cruise Ship': {
			country: {
				long_name: 'Diamond Princess Cruise Ship'
			}
		},
		'35.4437,139.638|Diamond Princess, Cruise Ship': {
			country: {
				long_name: 'Diamond Princess Cruise Ship'
			}
		},
		'0.0,0.0|Diamond Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'0,0|Diamond Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'35.4437,139.6380|Diamond Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'35.4437,139.638|Diamond Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'0.0,0.0|Grand Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'0,0|Grand Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'37.6489,-122.6655|Grand Princess, US': {
			country: {
				long_name: 'United States',
				short_name: 'US'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'0.0,0.0|Diamond Princess, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'0,0|Diamond Princess, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'0.0,0.0|Grand Princess, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'0,0|Grand Princess, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'37.6489,-122.6655|Grand Princess, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			},
			state: {
				long_name: 'Grand Princess'
			}
		},
		'35.4437,139.6380|From Diamond Princess, Australia': {
			country: {
				long_name: 'Australia',
				short_name: 'AU'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'35.4437,139.638|From Diamond Princess, Australia': {
			country: {
				long_name: 'Australia',
				short_name: 'AU'
			},
			state: {
				long_name: 'Diamond Princess'
			}
		},
		'0,0|External territories, Australia': {
			country: {
				long_name: 'Australia',
				short_name: 'AU'
			}
		},
		'0,0|Jervis Bay Territory, Australia': {
			country: {
				long_name: 'Australia',
				short_name: 'AU'
			}
		},
		'0,0|Northwest Territories, Canada': {
			country: {
				long_name: 'Canada',
				short_name: 'CA'
			}
		},
		'0.0,0.0|Recovered, Canada': {
			skip: true
		},
		'0.0,0.0|Recovered, US': {
			skip: true
		},
		'0.0,0.0|Unassigned, Wuhan Evacuee, US': {
			skip: true
		},
		'0,0|Unassigned, Wuhan Evacuee, US': {
			skip: true
		}
	};
}
