const selectionSets = [
	{setName: 'Set A', defaultSetName: 'Set A'},
	{setName: 'Set B', defaultSetName: 'Set B'},
	{setName: 'Set C', defaultSetName: 'Set C'}
];

for (const currentSet of selectionSets) {
	// initialize
	currentSet.selectAll = false;
	currentSet.partialSelection = {
		total: false,
		US: false,
		CN: false
	};
	currentSet.territorySelections = {
		US: [],
		CN: []
	};
	currentSet.expandTerritories = {
		US: false,
		CN: false
	};
	currentSet.checkedCountries = [];
}

(async () => {

	const CONFIRMED_DATASET_INDEX = 0;
	const RECOVERED_DATASET_INDEX = 1;
	const DEAD_DATASET_INDEX = 2;
	const CONFIRMED_REGRESSION_DATASET_INDEX = 3;

	const cacheResetter = Math.round(Date.now() / (10 * 60 * 1000));

	const combinedCases = (await axios({
		method: 'get',
		url: `docs/data/covid_combined.json?cache=${cacheResetter}`,
	})).data;

	const countryPopulation = (await axios({
		method: 'get',
		url: `docs/data/population.json`,
	})).data;

	const nonDataKeys = ['Province/State', 'Country/Region', 'Lat', 'Long', 'country', 'state', 'county'];

	const dateKeys = [];
	const dateLabels = new Set();
	for (const key of Object.keys(combinedCases[0].entries.infected)) {
		if (nonDataKeys.includes(key)) {
			continue;
		}
		// const dateObject = Date.parse(key);
		dateKeys.push(key);
		const dateString = moment(key).format('MMM Do');
		dateLabels.add(dateString);
	}

	// parse the data into what we need
	const countryNames = new Set();
	const countryCodes = new Set();
	const canonicalCountries = new Set();

	const countryNamesByCode = {};
	const countryCodesByName = {};

	const usaStateNames = new Set();
	const usaStateCodes = new Set();
	const usaStateNamesByCode = {};
	const usaStateCodesByName = {};

	const chinaProvinceNames = new Set();
	const chinaProvinceCodes = new Set();
	const chinaProvinceNamesByCode = {};
	const chinaProvinceCodesByName = {};

	// const states = new Set();
	// const countriesByState = {}; // look up a state's country
	// const countryStates = {}; // enumerate up all states in a country

	for (const entry of combinedCases) {
		const location = entry['location'];
		// const currentCountry = location['Country/Region'];
		const currentCountry = location['country']['long_name'];
		const currentCode = location['country']['short_name'];
		countryNames.add(currentCountry);
		countryCodes.add(currentCode);
		canonicalCountries.add(currentCode || currentCountry);

		countryNamesByCode[currentCode] = currentCountry;
		countryCodesByName[currentCountry] = currentCode;

		if (currentCode === 'US') {
			const currentState = location['state']['long_name'];
			const currentStateCode = location['state']['short_name'];
			if (!currentState || !currentStateCode) {
				continue; // we don't want or need the cruise ships in there
			}
			usaStateNames.add(currentState);
			usaStateCodes.add(currentStateCode);

			usaStateNamesByCode[currentStateCode] = currentState;
			usaStateCodesByName[currentState] = currentStateCode;
		} else if (currentCode === 'CN') {
			const currentProvince = location['state']['long_name'];
			const currentProvinceCode = location['state']['short_name'];
			chinaProvinceNames.add(currentProvince);
			chinaProvinceCodes.add(currentProvinceCode);

			chinaProvinceNamesByCode[currentProvinceCode] = currentProvince;
			chinaProvinceCodesByName[currentProvince] = currentProvinceCode;
		}
	}

	const countrySubdivisions = {
		US: usaStateCodes,
		CN: chinaProvinceCodes
	};

	const territoryNamesByCountryAndCode = {
		CN: chinaProvinceNamesByCode,
		US: usaStateNamesByCode
	};

	const provinceCodes = Array.from(chinaProvinceCodes).sort();
	// console.log('Province Codes:', JSON.stringify(provinceCodes, null, 4));

	const ticks = {
		beginAtZero: true
	};

	const doubleAxes = [
		{
			id: 'cases-axis',
			ticks,
			scaleLabel: {
				display: true,
				labelString: 'Cases'
			},
			color: 'orange'
		},
		{
			id: 'deaths-axis',
			ticks,
			position: 'right',
			scaleLabel: {
				display: true,
				labelString: 'Deaths'
			},
			color: 'red'
		}
	];
	const singleAxis = [{ticks}];


	const placeholderRegressionDataset = {
		label: 'Case Regression',
		data: [],
		backgroundColor: 'rgba(50, 50, 150, 1)',
		borderColor: 'rgba(50, 50, 150, 1)',
		fill: false,
		cubicInterpolationMode: 'monotone',
		pointBorderWidth: 3,
		pointHoverRadius: 5,
		pointHoverBorderWidth: 1,
		pointRadius: 1
	};

	// initialize data set context
	const chartConfig = {
		type: 'line',
		data: {
			labels: Array.from(dateLabels),
			datasets: [
				{
					label: 'Cases',
					data: [],
					backgroundColor: 'rgba(80, 120, 226, 1)',
					borderColor: 'rgba(80, 120, 226, 1)',
					fill: false,
					cubicInterpolationMode: 'monotone',
					pointBorderWidth: 3,
					pointHoverRadius: 5,
					pointHoverBorderWidth: 1,
					pointRadius: 1
				},
				{
					label: 'Recoveries',
					data: [],
					backgroundColor: 'rgba(40, 200, 150, 1)',
					borderColor: 'rgba(40, 200, 150, 1)',
					fill: false,
					cubicInterpolationMode: 'monotone',
					pointBorderWidth: 3,
					pointHoverRadius: 5,
					pointHoverBorderWidth: 1,
					pointRadius: 1
				},
				{
					label: 'Deaths',
					data: [],
					backgroundColor: 'rgba(155, 66, 254, 1)',
					borderColor: 'rgba(155, 66, 254, 1)',
					fill: false,
					cubicInterpolationMode: 'monotone',
					pointBorderWidth: 3,
					pointHoverRadius: 5,
					pointHoverBorderWidth: 1,
					pointRadius: 1
				}
			],
		},
		options: {
			scales: {
				yAxes: singleAxis
			},
			tooltips: {
				// mode: 'x',
				mode: 'index',
				intersect: false,
			},
			responsive: true,
			maintainAspectRatio: false,
		}
	};

	const defaultChartConfig = JSON.parse(JSON.stringify(chartConfig));


	/*const mapData = (await axios({
		method: 'get',
		url: 'assets/topo/world-countries.json',
	})).data;*/

	const worldTopographyFeatures = (await axios({
		method: 'get',
		url: 'assets/topo/world-features.json',
	})).data;

	const usaStateTopographyFeatures = (await axios({
		method: 'get',
		url: 'assets/topo/us-features.json',
	})).data;

	const chinaProvinceTopographyFeatures = (await axios({
		method: 'get',
		url: 'assets/topo/china-features.json',
	})).data;

	const defaultCheckedCountries = new Set(canonicalCountries);
	defaultCheckedCountries.delete('HK'); // Hong Kong
	defaultCheckedCountries.delete('MO'); // Macao
	defaultCheckedCountries.delete('CN'); // China
	defaultCheckedCountries.delete('Diamond Princess Cruise Ship');
	defaultCheckedCountries.delete('Grand Princess Cruise Ship');
	defaultCheckedCountries.delete('IR'); // Iran
	defaultCheckedCountries.delete('US'); // USA

	const validValues = {
		axes: ['join'/*, 'separate'*/],
		scale: ['linear', 'log'],
		regression: ['none', 'exponential', 'logistic'],
		comparisonDataType: ['cases', 'recoveries', 'deaths'],
		mapDataSource: ['cases', 'recoveries', 'deaths'],
		mapDataReference: ['absolute', 'relative:cases', 'relative:recoveries', 'relative:outcomes', 'relative:population'],
		mapScope: ['World', 'USA', 'Europe', 'China'],
		derivativeType: ['absolute', 'relative'],
		relationType: ['absolute', 'relative']
	};

	const params = {
		showCases: true,
		showDeaths: true,
		showRecoveries: true,
		axes: 'joint',
		scale: 'linear',
		derivative: false,
		// includeCruiseShipDescendants: false,
		regression: 'none',
		modelOffset: 0,
		extrapolationSize: 5,
		mapDataSource: 'cases',
		mapDataReference: 'absolute',
		mapScope: 'World',
		comparisonMode: false,
		comparisonDataType: 'cases',
		derivativeType: 'absolute',
		relationType: 'absolute'
	};
	// only accessor for the country computed value
	const parametrizableKeys = ['countries', 'setB', 'setC', ...Object.keys(params)];

	const routes = [{
		path: '/',
		props: {
			abc: 'def'
		}
	}];
	const router = new VueRouter({routes});

	let pathUpdateTimeout = null;
	let graphUpdateTimeout = null;

	const app = new Vue({
		el: '#app',
		router,
		data: {
			loading: false,

			suspendRouteWatching: false,

			countryNames,
			countryCodes,

			allCases: combinedCases,

			regressionOffsetMinimum: 0,
			regressionOffsetMaximum: dateLabels.size - 3,

			// pass to country-selector for component control
			selectionSets,
			activeSelectionSetIndex: 0,

			...params,

			raw: {
				canonicalCountries,
				worldTopographyFeatures,
				usaStateTopographyFeatures,
				countryNamesByCode,
				usaStateNamesByCode,
				usaStateCodesByName,
				chinaProvinceTopographyFeatures,
				chinaProvinceNamesByCode,
				chinaProvinceCodesByName,
				allCases: combinedCases,
				dateKeys,
				countryNames,
				countryPopulation,
				countrySubdivisions,
				territoryNamesByCountryAndCode
			},
			graph: null,

			map: null,
			mapDate: dateLabels.size - 1,
			mapDateMinimum: 0,
			mapDateMaximum: dateLabels.size - 1,
			shareableLinkRaw: window.location.href,
			showShare: false,
			showCopyLink: true,

			developerMode: false,
			graphExportURL: null
		},
		created: function () {
			/*for (const countryCode of Object.keys(countrySubdivisions)) {
				this.territorySelections[countryCode] = [];
			}*/

			console.log('created vue');
			this.handleRoute(this.$route);
		},
		mounted: function () {
			console.log('mounted vue');
			SocialShareKit.init({
				title: 'Coronavirus tracker by @arikaleph and @elliebee',
				text: ''
			});
			this.$nextTick(() => {
				this.createChart();
			});
			if (this.comparisonMode) {
				// cycle initialization
				// super hacky, but eh
				this.$nextTick(() => {
					this.activeSelectionSetIndex = 1;
					this.$nextTick(() => {
						this.activeSelectionSetIndex = 2;
						this.$nextTick(() => {
							this.activeSelectionSetIndex = 0;
						});
					});
				});
			}
		},
		methods: {
			clearSelection: function () {
				selectionSets[this.activeSelectionSetIndex].checkedCountries = [];
				for (const countryCode of Object.keys(selectionSets[this.activeSelectionSetIndex].territorySelections)) {
					selectionSets[this.activeSelectionSetIndex].territorySelections[countryCode] = [];
				}
			},
			handleExportGraph: function (element, event) {
				debugger
				element.href = 'https://stackoverflow.com';
				return true;
				return true;
			},
			handleRoute: function (newRoute, oldRoute) {

				const query = newRoute.query;

				/*
				if (oldRoute) {
					console.log('old route:', oldRoute.query);
				}
				console.log('new route:', query);
				console.log('suspended?', this.suspendRouteWatching);
				*/

				if (this.suspendRouteWatching && oldRoute) {
					// if there is no old route, and it's at the beginning, we won't suspend
					return;
				}

				let querySpecifiedCountries = false;

				const countrySelectionKeys = ['countries', 'setB', 'setC'];
				for (const key of Object.keys(query)) {
					if (!parametrizableKeys.includes(key)) {
						return;
					}
					const value = query[key];
					if (['showCases', 'showDeaths', 'showRecoveries', 'derivative', 'comparisonMode'].includes(key)) {
						// handle booleans
						this[key] = (value === 'true' || value === true);
					} else if (countrySelectionKeys.includes(key)) {
						let checkedCountries = [];
						let territorySelections = {};
						const setIndex = countrySelectionKeys.indexOf(key);

						if (setIndex === 0) {
							querySpecifiedCountries = true;
						}

						const countryString = value || '';
						const countryRegexMatch = countryString.match(/[^,()]+(\([^()]*\))?/gm);
						// const countries = countryString.split(',');
						if (Array.isArray(countryRegexMatch) && countryRegexMatch.length > 0) {
							for (const currentCountryCode of countryRegexMatch) {
								if (currentCountryCode.includes('(')) {

									const parenthesisIndex = currentCountryCode.indexOf('(');
									const rawCountryCode = currentCountryCode.substr(0, parenthesisIndex);
									if (!canonicalCountries.has(rawCountryCode)) {
										continue;
									}
									const availableTerritories = countrySubdivisions[rawCountryCode];
									if (!availableTerritories) {
										continue;
									}

									const territoryCodeString = currentCountryCode.substring(parenthesisIndex + 1, currentCountryCode.length - 1) || '';
									const territoryCodes = territoryCodeString.split(',');

									territorySelections = [];
									for (const currentTerritoryCode of territoryCodes) {
										if (availableTerritories.has(currentTerritoryCode)) {
											territorySelections.push(currentTerritoryCode);
										}
									}
									selectionSets[setIndex].territorySelections[rawCountryCode] = territorySelections;
									if (territorySelections.length > 0 && territorySelections.length < availableTerritories.size) {
										selectionSets[setIndex].expandTerritories[rawCountryCode] = true;
									}
								} else if (canonicalCountries.has(currentCountryCode)) {
									checkedCountries.push(currentCountryCode);
								}
							}
						}

						selectionSets[setIndex].checkedCountries = checkedCountries;

					} else if (key === 'modelOffset') {
						let regression = parseInt(value);
						if (!Number.isSafeInteger(regression)) {
							continue;
						}
						regression = Math.max(regression, this.regressionOffsetMinimum);
						regression = Math.min(regression, this.regressionOffsetMaximum);
						this[key] = regression;
					} else if (key === 'extrapolationSize') {
						let extrapolation = parseInt(value);
						if (!Number.isSafeInteger(extrapolation)) {
							continue;
						}
						extrapolation = Math.max(extrapolation, 0);
						extrapolation = Math.min(extrapolation, 15);
						this[key] = extrapolation;
					} else {
						const currentValidValues = validValues[key];
						if (!Array.isArray(currentValidValues)) {
							console.log('no valid values for query setting:', key);
						} else if (!currentValidValues.includes(value)) {
							continue;
						}
						this[key] = value;
					}
				}

				if (!querySpecifiedCountries) {
					selectionSets[0].checkedCountries = Array.from(defaultCheckedCountries);
				}


				if (oldRoute && this.comparisonMode) {
					// cycle initialization
					// super hacky, but eh

					const initialSetIndex = this.activeSelectionSetIndex;
					this.$nextTick(() => {
						this.activeSelectionSetIndex = (initialSetIndex + 1) % 3;
						this.$nextTick(() => {
							this.activeSelectionSetIndex = (initialSetIndex + 2) % 3;
							this.$nextTick(() => {
								this.activeSelectionSetIndex = initialSetIndex % 3;
							});
						});
					});
				}

			},
			calculateSetPopulation: function (set) {
				let setPopulation = 0;
				const skipTerritories = {};
				const territoryMappers = {CN: 'China', US: 'USA'};
				for (const currentCountryCode of set.checkedCountries) {
					if (countrySubdivisions[currentCountryCode]) {
						// we'll deal with territories later
						skipTerritories[currentCountryCode] = true;
					}
					const currentCountryPopulation = countryPopulation[currentCountryCode];
					if (!currentCountryPopulation) {
						return NaN;
					}
					setPopulation += currentCountryPopulation;
				}
				for (const [currentCountryCode, territoryCodes] of Object.entries(set.territorySelections)) {
					if (skipTerritories[currentCountryCode]) {
						continue;
					}
					const countryKey = territoryMappers[currentCountryCode];
					for (const currentTerritoryCode of territoryCodes) {
						const currentTerritoryPopulation = countryPopulation[countryKey][currentTerritoryCode];
						if (!currentTerritoryPopulation) {
							return NaN;
						}
						setPopulation += currentTerritoryPopulation;
					}
				}
				return setPopulation;
			},
			calculateDerivative: function (values, forceAbsolute = false) {
				const derivative = [];
				let previousValue = 0;
				for (const currentValue of values) {
					let change = currentValue - previousValue;
					if (this.derivativeType === 'relative' && !forceAbsolute) {
						if (previousValue === 0) {
							change = null;
						} /*else if (currentValue === 0) {
							change = 0;
						} */ else {
							change = Math.round((currentValue / previousValue) * 10000) / 100 - 100;
						}
					}
					derivative.push(change);
					previousValue = currentValue;
				}
				return derivative;
			},
			getCountryCodeForEntry: function (entry) {
				// return entry['Country/Region'];
				if (!entry['location']) {
					debugger
				}
				return entry['location']['country']['short_name'] || entry['location']['country']['long_name'];
			},
			getCountryForEntry: function (entry) {
				// return entry['Country/Region'];
				return entry['country']['long_name'];
			},
			getStateForEntry: function (entry) {
				return entry['location']['state']['long_name'];
				// return entry['Province/State'];
			},
			toggleShare: function () {
				this.showShare = !this.showShare;
				this.showCopyLink = true;
				if (this.showShare) {
					const link_box = document.getElementById('link_box');
					link_box.value = this.shareableLinkRaw;
					this.$nextTick(() => {
						link_box.focus();
						link_box.select();
					});
				}
			},
			copyLink: function () {
				const pasteUrl = this.shareableLinkRaw;

				const onCopy = () => {
					this.showCopyLink = false;
					console.log('Async: Copying to clipboard was successful!');
				};

				function fallbackCopyTextToClipboard() {
					const link_box = document.getElementById('link_box');
					link_box.value = pasteUrl;
					link_box.focus();
					link_box.select();
					try {
						document.execCommand('copy');
						link_box.blur();
						onCopy();
					} catch (err) {
					}
				}

				if (!navigator.clipboard) {
					fallbackCopyTextToClipboard();
					return;
				}

				navigator.clipboard.writeText(pasteUrl).then(() => {
					onCopy();
				});
			},
			createChart: function () {
				const canvas = document.getElementById('graph_canvas');
				const context = canvas.getContext('2d');
				chartConfig.options.scales.yAxes[0].ticks.callback = (value) => {
					const formatedValue = Number(value).toLocaleString();
					if (this.derivative && this.derivativeType === 'relative') {
						return formatedValue + '%';
					}
					if (this.relationType === 'relative') {
						return formatedValue + '‱';
					}
					return formatedValue;
				};
				chartConfig.options.tooltips.callbacks = {
					label: (tooltipItem, data) => {
						const value = tooltipItem.value;
						let label = data.datasets[tooltipItem.datasetIndex].label;

						if (this.derivative) {
							if (this.derivativeType === 'relative') {
								let localeString = Number(value).toLocaleString();
								if (value > 0) {
									localeString = `+${localeString}`;
								}
								return `${label} Increase: ${localeString}%`;
							} else {
								return `New ${label}: ${Number(value).toLocaleString()}`;
							}
						}

						if (this.relationType === 'relative') {
							return `${label}: ${Number(value).toLocaleString()}‱`;
						}

						return `${label}: ${Number(value).toLocaleString()}`;
					}
				};
				if (this.developerMode) {
					chartConfig.options.animation = {
						onComplete: () => {
							const data = canvas.toDataURL('image/png');
							this.graphExportURL = data;
						}
					};
				}
				this.graph = new Chart(context, chartConfig);
			},
			formatMapDate: function (date) {
				return Array.from(dateLabels)[date];
			},
			formatCountry: function (countryCode) {
				const country = countryNamesByCode[countryCode] || countryCode;
				if (country === 'Diamond Princess Cruise Ship') {
					return '💎👸🚢 Cruise Ship';
				}
				if (country === 'Grand Princess Cruise Ship') {
					return 'Grand 👸🚢 Cruise Ship';
				}
				return country;
			},
			updateGraph: function () {
				// update router
				clearTimeout(graphUpdateTimeout);
				const repaintGraph = () => {
					this.graph.update();
				};
				graphUpdateTimeout = setTimeout(repaintGraph, 5);
			},
			updateLocation: function () {
				// update router
				this.suspendRouteWatching = true;
				clearTimeout(pathUpdateTimeout);
				const refreshRoute = () => {
					const query = {};
					for (const key of parametrizableKeys) {
						query[key] = this[key];
					}

					if (this.comparisonMode) {
						// special case handling
						query['setB'] = this.countriesToParamString(1);
						query['setC'] = this.countriesToParamString(2);
					}
					router.push({query}, (location) => {
						// console.dir(location);
						// this.shareableLinkRaw = window.location.href;
						this.showCopyLink = true;
						this.shareableLinkRaw = `${window.location.origin}${window.location.pathname}${window.location.search}#${location.fullPath}`;
					});
					this.$nextTick(() => {
						this.suspendRouteWatching = false;
					});
					// this.shareableLinkRaw = `${window.location.origin}${window.location.pathname}${window.location.search}#?`
				};
				pathUpdateTimeout = setTimeout(refreshRoute, 300);
			},
			parseRowEntryForDate: function (row, date, group = 'infected', allowPropagation = false, allowNull = false) {
				// const value = row[date];
				const groupEntries = row['entries'][group];
				if (groupEntries && !groupEntries[date]) {
					if (allowPropagation && date === this.todayKey) {
						const availableDateKeys = Object.keys(groupEntries);
						const lastAvailableDateKey = availableDateKeys[availableDateKeys.length - 1];
						return groupEntries[lastAvailableDateKey]
					} else if (!allowNull) {
						throw new Error('value not available for date, though it was historically!');
					}
				}
				const entry = groupEntries && groupEntries[date];
				/*if (!Number.isSafeInteger(entry)) {
					entry = 0;
					console.log('Skipping count for entry:', this.getCountryForEntry(row), this.getStateForEntry(row), date, value);
				}*/
				if (isNaN(entry)) {
					if (allowNull) {
						return null;
					}
					throw new Error('value not available for date!');
				}
				return entry;
			},
			filterDatasetBySelectedCountries: function (setIndex = 0, group = 'infected') {
				const filteredData = [];
				for (const currentEntry of combinedCases) {
					const currentLocation = currentEntry['location'];
					const currentCountry = this.getCountryCodeForEntry(currentEntry);
					if (countrySubdivisions[currentCountry]) {
						// this country has territory subdivisions
						const selectedTerritories = selectionSets[setIndex].territorySelections[currentCountry] || [];
						if (!selectedTerritories.includes(currentLocation['state']['short_name'])) {
							// this territory has not been selected
							continue;
						}
					} else if (!selectionSets[setIndex].checkedCountries.includes(currentCountry)) {
						continue;
					}
					// const currentState = this.getStateForEntry(currentLocation);
					// if (!this.includeCruiseShipDescendants && currentState.includes('From Diamond Princess')) {
					// 	continue;
					// }


					let dateIndex = 0;
					const groupEntries = currentEntry.entries[group];
					if (!groupEntries) {
						// perhaps this is a location without recovery data
						continue;
					}
					for (const key of Object.keys(groupEntries)) {
						const currentCount = this.parseRowEntryForDate(currentEntry, key, group, false, true);

						filteredData[dateIndex] = filteredData[dateIndex] || 0;
						filteredData[dateIndex] += currentCount;
						dateIndex++;
					}
				}
				return filteredData;
			},
			moveArrayEntry: function (array, from, to) {
				return array.splice(to, 0, array.splice(from, 1)[0]);
			},
			validateGraphLayout: function () {
				if (!this.canShowLogScale) {
					this.scale = 'linear';
				}
				const scaleType = (this.scale === 'log') ? 'logarithmic' : 'linear';
				for (const axis of chartConfig.options.scales.yAxes) {
					axis.type = scaleType;
				}
			},
			fixMapDataConfiguration: function () {
				if (this.mapDataSource === 'recoveries' && !this.canShowMapSourceRecoveries) {
					this.mapDataSource = 'cases';
				}

				if (this.mapDataReference === 'relative:recoveries' && !this.canShowMapRelativeToRecoveries) {
					this.mapDataReference = 'relative:cases';
				}
				if (this.mapDataReference === 'relative:cases' && !this.canShowMapRelativeToCases) {
					this.mapDataReference = 'absolute';
				}
				if (this.mapDataReference === 'relative:outcomes' && !this.canShowMapRelativeToOutcomes) {
					this.mapDataReference = 'absolute';
				}
			},
			countriesToParamString: function (setIndex = 0) {
				// used for the URL calculation
				// country names better not contain commas!
				const checkedCountries = Array.from(selectionSets[setIndex].checkedCountries);
				// console.log('checked countries');
				// console.dir(checkedCountries);
				for (const [countryCode, territoryCodes] of Object.entries(selectionSets[setIndex].territorySelections)) {
					const availableTerritoryCodes = countrySubdivisions[countryCode];
					const selectionCount = territoryCodes.length;
					const availableCount = availableTerritoryCodes.size;
					if (selectionCount > 0 && selectionCount < availableCount) {
						// there is a partial selection
						const partialSelection = Array.from(territoryCodes);
						partialSelection.sort();

						// remove the raw entry
						const index = checkedCountries.indexOf(countryCode);
						if (index > -1) {
							checkedCountries.splice(index, 1);
						}

						// add the partial entry
						checkedCountries.push(`${countryCode}(${partialSelection.join(',')})`)
					}
				}
				checkedCountries.sort();
				return checkedCountries.join(',');
			}
		},
		watch: {
			$route(newRoute, oldRoute) {
				this.handleRoute(newRoute, oldRoute);
			},
			axes: function (newValue) {
				if (newValue === 'joint') {
					// remove second y axis
					chartConfig.options.scales.yAxes = singleAxis;
					delete chartConfig.data.datasets[0].yAxisID;
					delete chartConfig.data.datasets[1].yAxisID;
					delete chartConfig.data.datasets[2].yAxisID;

					if (chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX]) {
						delete chartConfig.data.datasets[3].yAxisID;
					}
				} else {
					chartConfig.options.scales.yAxes = doubleAxes;
					const dataToggles = [this.showCases, this.showRecoveries, this.showDeaths];
					const axisLabels = ['Cases', 'Recoveries', 'Deaths'];
					let axisIndex = 0;
					for (const [index, toggle] of dataToggles.entries()) {
						if (toggle) {
							chartConfig.data.datasets[index].yAxisID = doubleAxes[axisIndex].id;
							chartConfig.options.scales.yAxes[axisIndex].scaleLabel.labelString = axisLabels[index];
							axisIndex++;
							if (axisIndex > 1) {
								break;
							}
						}
					}
					if (chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX] && this.showCases) {
						chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].yAxisID = doubleAxes[0].id;
					}
				}
				this.validateGraphLayout();
				this.updateLocation();
				this.updateGraph();
			},
			canSeparateAxes: function (newValue) {
				if (!newValue) {
					this.axes = 'joint';
				}
			},
			comparisonMode: function (newValue) {
				if (newValue) {
					chartConfig.data.datasets[0].label = selectionSets[0].setName;
					chartConfig.data.datasets[1].label = selectionSets[1].setName;
					chartConfig.data.datasets[2].label = selectionSets[2].setName;
				} else {
					chartConfig.data.datasets[0].label = defaultChartConfig.data.datasets[0].label;
					chartConfig.data.datasets[1].label = defaultChartConfig.data.datasets[1].label;
					chartConfig.data.datasets[2].label = defaultChartConfig.data.datasets[2].label;
				}
			},
			setLabels: function (newValue) {
				if (this.comparisonMode) {
					chartConfig.data.datasets[0].label = newValue[0];
					chartConfig.data.datasets[1].label = newValue[1];
					chartConfig.data.datasets[2].label = newValue[2];
					this.updateGraph();
				}
			},
			mapDate: function () {
				// it has come to this
				this.fixMapDataConfiguration();
			},
			mapDataSource: function () {
				this.fixMapDataConfiguration();
				this.updateLocation();
			},
			mapDataReference: function () {
				this.updateLocation();
			},
			dataSets: {
				immediate: true,
				handler: function (newValue) {
					chartConfig.data.datasets[CONFIRMED_DATASET_INDEX].data = newValue[0];
					chartConfig.data.datasets[RECOVERED_DATASET_INDEX].data = newValue[1];
					chartConfig.data.datasets[DEAD_DATASET_INDEX].data = newValue[2];

					if (this.regression !== 'none' && !this.comparisonMode) {
						// show regression
						chartConfig.data.labels = Array.from(dateLabels);
						// console.dir(chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX]);
						chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX] = placeholderRegressionDataset;
						chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].data = newValue[3];
						// console.dir(chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX]);

						const regressionDateLabels = Array.from(dateLabels);
						const extrapolationSize = Math.round(this.extrapolationSize);
						for (let x = 1; x <= extrapolationSize; x++) {
							regressionDateLabels.push(`+${x}`);
						}
						chartConfig.data.labels = regressionDateLabels;
					} else {
						chartConfig.data.labels = Array.from(dateLabels);
						if (chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX]) {
							chartConfig.data.datasets.pop();
						}
					}

					this.updateGraph();
					this.updateLocation();
				}
			},
			mapScope: function () {
				this.fixMapDataConfiguration();
				this.updateLocation();
				// TODO
			},
			canShowRegression: function (newValue) {
				if (newValue === false) {
					this.regression = 'none';
				}
			},
			canCalculateRelation: function (newValue) {
				if (newValue === false) {
					this.relationType = 'absolute';
				}
			},
			scale: function () {
				this.validateGraphLayout();
				this.updateGraph();
				this.updateLocation();
			}
		},
		computed: {
			aggregationLabel: function () {
				if (this.selectionSets[0].setName !== this.selectionSets[0].defaultSetName) {
					const customSetName = this.selectionSets[0].setName;
					// const normalizedSetName = customSetName.normalize('NFC');
					// const ascii = /^[ -~]+$/;
					// if (ascii.test(customSetName)) {
					// no emoji fuckery
					// return customSetName;
					// }
					const emoji = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c\ude32-\ude3a]|[\ud83c\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/;
					if (!emoji.test(customSetName)) {
						return customSetName;
					}
				}
				return 'Aggregate';
			},
			setLabels: function () {
				return this.selectionSets.map(s => s.setName);
			},
			showSelectionTotals: function () {
				// console.log('check selection totals');
				if (this.comparisonMode) {
					return false;
				}
				if (selectionSets[0].checkedCountries.length > 0) {
					return true;
				}
				for (const [, territories] of Object.entries(selectionSets[0].territorySelections)) {
					if (territories.length > 0) {
						return true;
					}
				}
				return false;
			},
			decoratedCountries: function () {
				console.log('redecorating');
				const countryDecorations = {};
				const emoji = {
					infected: '🤒',
					recovered: '👍',
					dead: '☠️'
				};
				for (const [group, data] of Object.entries(this.latestLocationTotals)) {
					for (const [countryCode, value] of Object.entries(data)) {
						countryDecorations[countryCode] = countryDecorations[countryCode] || '';
						countryDecorations[countryCode] += `<span>${emoji[group]} ${Number(value).toLocaleString()}</span>`;
					}
				}

				return countryDecorations;
			},
			todayKey: function () {
				return dateKeys[dateKeys.length - 1];
			},
			latestLocationTotals: function () {
				console.log('calculating location totals');
				const rawData = combinedCases;

				const locationTotals = {};
				const dateKey = this.todayKey;

				for (const currentEntry of rawData) {
					const currentCountry = this.getCountryCodeForEntry(currentEntry);
					for (const group of Object.keys(currentEntry.entries)) {
						if (!locationTotals[group]) {
							locationTotals[group] = {};
						}

						const currentCount = this.parseRowEntryForDate(currentEntry, dateKey, group, true);
						// init
						locationTotals[group][currentCountry] = locationTotals[group][currentCountry] || 0;
						locationTotals[group]['total'] = locationTotals[group]['total'] || 0;
						// fill or amend
						locationTotals[group][currentCountry] += currentCount;
						locationTotals[group]['total'] += currentCount;
					}
				}

				return locationTotals;
			},
			mapScopes: function () {
				return validValues.mapScope
			},
			countries: function () {
				return this.countriesToParamString(0);
			},
			shareableLink: function () {
				return this.shareableLinkRaw;
			},
			canShowRegression: function () {
				return !!this.showCases && !this.derivative && !this.comparisonMode;
			},
			canShowRelation: function () {
				return !this.derivative;
			},
			canCalculateRelation: function () {
				if (!this.canShowRelation) {
					return false;
				}
				for (const [index, currentSet] of selectionSets.entries()) {
					if (!this.comparisonMode && index !== 0) {
						break;
					}
					const setPopulation = this.calculateSetPopulation(currentSet);
					if (isNaN(setPopulation)) {
						return false;
					}
				}
				return true;
			},
			canSeparateAxes: function () {
				if (this.comparisonMode) {
					return false;
				}
				let viewCount = 0;

				if (this.showCases) {
					viewCount++;
				}
				if (this.showRecoveries) {
					viewCount++;
				}
				if (this.showDeaths) {
					viewCount++;
				}

				return viewCount === 2;
			},
			canShowLogScale: function () {
				return true;
				// return (this.axes === 'joint');
			},
			canShowMapSourceRecoveries: function () {
				return this.mapScope !== 'USA' && this.mapDate <= 60;
			},
			canShowMapRelativeToCases: function () {
				return this.mapDataSource !== 'cases';
			},
			canShowMapRelativeToRecoveries: function () {
				if (this.mapScope === 'USA' || this.mapDate > 60) {
					return false; // currently unavailable for the US
				}
				return this.mapDataSource === 'deaths';
			},
			canShowMapRelativeToOutcomes: function () {
				if (this.mapScope === 'USA' || this.mapDate > 60) {
					return false; // currently unavailable for the US
				}
				return this.mapDataSource !== 'cases';
			},
			sortedCountries: function () {
				const countries = Array.from(this.countryNames);
				countries.sort();

				// move the cruise ship first and china second
				let targetIndex = 0;
				const diamondCruiseShipIndex = countries.indexOf('Diamond Princess Cruise Ship');
				if (diamondCruiseShipIndex !== -1) {
					this.moveArrayEntry(countries, diamondCruiseShipIndex, targetIndex);
					targetIndex++;
				}
				const grandCruiseShipIndex = countries.indexOf('Grand Princess Cruise Ship');
				if (grandCruiseShipIndex !== -1) {
					this.moveArrayEntry(countries, grandCruiseShipIndex, targetIndex);
					targetIndex++;
				}

				/* const chinaIndex = countries.indexOf('China');
				this.moveArrayEntry(countries, chinaIndex, 2);
				const usIndex = countries.indexOf('United States');
				this.moveArrayEntry(countries, usIndex, 3); */

				return countries.map(c => ({
					code: countryCodesByName[c] || c,
					formated: this.formatCountry(countryCodesByName[c] || c),
					hasSubdivisions: !!countrySubdivisions[countryCodesByName[c] || c]
				}));
			},
			sortedTerritories: function () {
				const territories = {};
				for (const code of countryCodes) {
					territories[code] = [];
					if (code === 'US') {
						const territoryNames = Array.from(usaStateNames);
						territoryNames.sort();
						territories[code] = territoryNames.map(t => ({code: usaStateCodesByName[t], formated: t}));
					} else if (code === 'CN') {
						const territoryNames = Array.from(chinaProvinceNames);
						territoryNames.sort();
						territories[code] = territoryNames.map(t => ({code: chinaProvinceCodesByName[t], formated: t}));
					}
				}
				return territories;
			},
			athElapsedDays: function () {
				const rawCases = this.rawTimeSeries[0];
				const derivative = this.calculateDerivative(rawCases, true);
				const maxValue = Math.max(...derivative);
				const reverseChronologicalDerivative = derivative.reverse();
				const elapsedDays = reverseChronologicalDerivative.indexOf(maxValue);
				const dateLabel = Array.from(dateLabels)[dateLabels.size - 1 - elapsedDays];
				return elapsedDays + ` (${dateLabel})`;
			},
			comparisonDataGroup: function () {
				if (this.comparisonDataType === 'cases') {
					return 'infected';
				} else if (this.comparisonDataType === 'recoveries') {
					return 'recovered';
				} else if (this.comparisonDataType === 'deaths') {
					return 'dead';
				}
				console.error('invalid comparison data type');
				return [];
			},
			rawTimeSeries: function () {
				if (!this.comparisonMode) {
					const confirmedYValues = this.filterDatasetBySelectedCountries(0, 'infected');
					const recoveredYValues = this.filterDatasetBySelectedCountries(0, 'recovered');
					const deadYValues = this.filterDatasetBySelectedCountries(0, 'dead');
					return [confirmedYValues, recoveredYValues, deadYValues];
				} else {
					const setA = this.filterDatasetBySelectedCountries(0, this.comparisonDataGroup);
					const setB = this.filterDatasetBySelectedCountries(1, this.comparisonDataGroup);
					const setC = this.filterDatasetBySelectedCountries(2, this.comparisonDataGroup);
					return [setA, setB, setC];
				}
			},
			totalTimeSeries: function () {
				if (this.relationType === 'relative') {
					// divide each one by the population
					const relativeTimeSeries = [];
					for (const [index, currentSeries] of this.rawTimeSeries.entries()) {
						let currentRelativeSeries = [];
						const currentDivisor = this.setPopulations[index];
						for (const currentValue of currentSeries) {
							const relativeValue = Math.round(currentValue / currentDivisor * 100000000) / 10000;
							currentRelativeSeries.push(relativeValue);
						}
						relativeTimeSeries.push(currentRelativeSeries);
					}
					return relativeTimeSeries;
				}
				return this.rawTimeSeries;
			},
			setPopulations: function () {
				if (!this.canCalculateRelation) {
					return [NaN, NaN, NaN];
				}
				const populations = [];
				for (const [index, currentSet] of selectionSets.entries()) {
					if (!this.comparisonMode && index !== 0) {
						populations.push(populations[0]);
						continue;
					}
					const currentPopulation = this.calculateSetPopulation(currentSet);
					populations.push(currentPopulation);
				}
				return populations;
			},
			derivedTimeSeries: function () {
				return this.rawTimeSeries.map(s => this.calculateDerivative(s));
			},
			regressionSeries: function () {
				const confirmedYValues = this.rawTimeSeries[0];
				const confirmedExtrapolationBasis = confirmedYValues.slice(this.modelOffset);

				const regressionDetails = {
					extrapolation: [],
					cases: {
						equation: [NaN, NaN],
						parameterValues: [NaN, NaN, NaN],
					}
				};

				if (this.regression === 'none') {
					return regressionDetails;
				}

				const regressionRange = [];
				const extrapolationSize = Math.round(this.extrapolationSize);
				for (let x = 0; x < confirmedYValues.length + extrapolationSize; x++) {
					regressionRange.push(x);
				}

				let extrapolationY = [];
				let regressionParams = {};

				try {
					if (this.regression === 'exponential') {
						const regressionData = confirmedExtrapolationBasis.map((value, index) => [index, value]);
						regressionParams = regression.exponential(regressionData);
						const extrapolationValues = regressionRange.map(y => regressionParams.predict(y - this.modelOffset));
						extrapolationY = extrapolationValues.map(([x, value], index) => {
							if (index < this.modelOffset) {
								return null;
							}
							return Math.round(value);
						});
						regressionDetails.extrapolation = extrapolationY;
					} else if (this.regression === 'logistic') {
						const logisticParams = LogisticFitter.fitSigmoid(confirmedExtrapolationBasis);
						const sigmoid = logisticParams[0];
						regressionParams = logisticParams[1];
						const extrapolationValues = regressionRange.map(y => sigmoid(y - this.modelOffset));
						extrapolationY = extrapolationValues.map((value, index) => {
							if (index < this.modelOffset) {
								return null;
							}
							return Math.round(value);
						});
						regressionDetails.extrapolation = extrapolationY;
					}
					regressionDetails.cases = regressionParams;
				} catch (e) {
					// regression failed
					return {
						regressionError: e,
						...regressionDetails
					}
				}

				return regressionDetails;
			},
			dataSets: function () {
				const factualData = this.derivative ? this.derivedTimeSeries : this.totalTimeSeries;
				const dataSets = [...factualData];
				if (Array.isArray(this.regressionSeries.extrapolation)) {
					if (this.relationType === 'relative') {
						const absoluteRegression = this.regressionSeries.extrapolation;
						const divisor = this.setPopulations[0];
						const relativeRegression = absoluteRegression.map(r => Math.round(r / divisor * 100000000) / 10000);
						dataSets.push(relativeRegression);
					} else {
						dataSets.push(this.regressionSeries.extrapolation);
					}
				}
				if (!this.comparisonMode) {
					if (!this.showCases) {
						dataSets[0] = [];
					}
					if (!this.showRecoveries) {
						dataSets[1] = [];
					}
					if (!this.showDeaths) {
						dataSets[2] = [];
					}
				}
				return dataSets;

				if (!this.comparisonMode) {
					// we are drilling down into different data types from one set
					let confirmedYValues = this.filterDatasetBySelectedCountries(0, 'infected');
					let deadYValues = this.filterDatasetBySelectedCountries(0, 'recovered');
					let recoveredYValues = this.filterDatasetBySelectedCountries(0, 'dead');

					if (this.derivative) {
						confirmedYValues = this.calculateDerivative(confirmedYValues);
						deadYValues = this.calculateDerivative(deadYValues);
						recoveredYValues = this.calculateDerivative(recoveredYValues);
					}

					if (this.showCases) {
						chartConfig.data.datasets[CONFIRMED_DATASET_INDEX].data = confirmedYValues;
					} else {
						chartConfig.data.datasets[CONFIRMED_DATASET_INDEX].data = [];
					}

					if (this.showDeaths) {
						chartConfig.data.datasets[DEAD_DATASET_INDEX].data = deadYValues;
					} else {
						chartConfig.data.datasets[DEAD_DATASET_INDEX].data = [];
					}

					if (this.showRecoveries) {
						chartConfig.data.datasets[RECOVERED_DATASET_INDEX].data = recoveredYValues;
					} else {
						chartConfig.data.datasets[RECOVERED_DATASET_INDEX].data = [];
					}

					if (this.regression === 'none') {
						chartConfig.data.labels = Array.from(dateLabels);
						if (chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX]) {
							chartConfig.data.datasets.pop();
						}
					}

					return [confirmedYValues, deadYValues, recoveredYValues];
				} else {
					// we are aggregating sets
					let setA = this.filterDatasetBySelectedCountries(0, this.comparisonDataGroup);
					let setB = this.filterDatasetBySelectedCountries(1, this.comparisonDataGroup);
					let setC = this.filterDatasetBySelectedCountries(2, this.comparisonDataGroup);

					if (this.derivative) {
						[setA, setB, setC] = [setA, setB, setC].map(s => this.calculateDerivative(s));
					}

					console.log('calculated new sets');

					chartConfig.data.datasets[0].data = setA;
					chartConfig.data.datasets[1].data = setB;
					chartConfig.data.datasets[2].data = setC;

					return [setA, setB, setC];
				}
			},
			aggregatedTotals: function () {
				// console.log('aggregating totals');

				let series = this.rawTimeSeries;
				if (this.derivative) {
					series = series.map(s => this.calculateDerivative(s, true));
				}
				const confirmedSeries = series[0];
				const recoveredSeries = series[1];
				const deadSeries = series[2];

				const lastInfectionValue = confirmedSeries[confirmedSeries.length - 1];
				const lastRecoveryValue = recoveredSeries[recoveredSeries.length - 1];
				const lastDeathValue = deadSeries[deadSeries.length - 1];

				return {
					cases: lastInfectionValue !== undefined ? Number(lastInfectionValue).toLocaleString() : null,
					recoveries: lastRecoveryValue !== undefined ? Number(lastRecoveryValue).toLocaleString() : null,
					deaths: lastDeathValue !== undefined ? Number(lastDeathValue).toLocaleString() : null
				};
			},

			// experimentalChartConfig: function () {
			// 	const ticks = {
			// 		beginAtZero: true,
			// 		callback: function (value) {
			// 			return Number(value).toLocaleString();
			// 		}
			// 	};
			//
			// 	const doubleAxes = [
			// 		{
			// 			id: 'cases-axis',
			// 			ticks,
			// 			scaleLabel: {
			// 				display: true,
			// 				labelString: 'Cases'
			// 			},
			// 			labelString: 'Cases',
			// 			color: 'orange'
			// 		},
			// 		{
			// 			id: 'deaths-axis',
			// 			ticks,
			// 			position: 'right',
			// 			scaleLabel: {
			// 				display: true,
			// 				labelString: 'Deaths'
			// 			},
			// 			color: 'red'
			// 		}
			// 	];
			// 	const singleAxis = [{ticks}];
			//
			//
			// 	// initialize data set context
			// 	const datasets = [
			// 		{
			// 			label: 'Cases',
			// 			data: this.timeSeries[0],
			// 			backgroundColor: 'rgba(80, 120, 226, 1)',
			// 			borderColor: 'rgba(80, 120, 226, 1)',
			// 			fill: false,
			// 			cubicInterpolationMode: 'monotone',
			// 			pointBorderWidth: 3,
			// 			pointHoverRadius: 5,
			// 			pointHoverBorderWidth: 1,
			// 			pointRadius: 1
			// 		},
			// 		{
			// 			label: 'Recoveries',
			// 			data: this.timeSeries[1],
			// 			backgroundColor: 'rgba(40, 200, 150, 1)',
			// 			borderColor: 'rgba(40, 200, 150, 1)',
			// 			fill: false,
			// 			cubicInterpolationMode: 'monotone',
			// 			pointBorderWidth: 3,
			// 			pointHoverRadius: 5,
			// 			pointHoverBorderWidth: 1,
			// 			pointRadius: 1
			// 		},
			// 		{
			// 			label: 'Deaths',
			// 			data: this.timeSeries[2],
			// 			backgroundColor: 'rgba(155, 66, 254, 1)',
			// 			borderColor: 'rgba(155, 66, 254, 1)',
			// 			fill: false,
			// 			cubicInterpolationMode: 'monotone',
			// 			pointBorderWidth: 3,
			// 			pointHoverRadius: 5,
			// 			pointHoverBorderWidth: 1,
			// 			pointRadius: 1
			// 		}
			// 	];
			//
			// 	if (this.canShowRegression && this.regression !== 'none') {
			// 		datasets.push({
			// 			label: 'Case Regression',
			// 			data: this.regressionSeries.extrapolation || [],
			// 			backgroundColor: 'rgba(50, 50, 150, 1)',
			// 			borderColor: 'rgba(50, 50, 150, 1)',
			// 			fill: false,
			// 			cubicInterpolationMode: 'monotone',
			// 			pointBorderWidth: 3,
			// 			pointHoverRadius: 5,
			// 			pointHoverBorderWidth: 1,
			// 			pointRadius: 1
			// 		});
			// 	}
			//
			// 	const chartConfig = {
			// 		type: 'line',
			// 		data: {
			// 			labels: Array.from(dateLabels),
			// 			datasets,
			// 		},
			// 		options: {
			// 			scales: {
			// 				yAxes: singleAxis
			// 			},
			// 			tooltips: {
			// 				// mode: 'x',
			// 				mode: 'index',
			// 				intersect: false,
			// 				callbacks: {
			// 					label: function (tooltipItem, data) {
			// 						const value = tooltipItem.value;
			// 						const label = data.datasets[tooltipItem.datasetIndex].label;
			// 						return `${label}: ${Number(value).toLocaleString()}`;
			// 					}
			// 				}
			// 			},
			// 			responsive: true,
			// 			maintainAspectRatio: false,
			// 		}
			// 	};
			//
			// 	return chartConfig;
			// }
		}
	});

})();
