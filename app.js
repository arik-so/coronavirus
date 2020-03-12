function calculateDerivative(values) {
	const derivative = [];
	let previousValue = 0;
	for (const currentValue of values) {
		derivative.push(currentValue - previousValue);
		previousValue = currentValue;
	}
	return derivative;
}

(async () => {

	const CONFIRMED_DATASET_INDEX = 0;
	const RECOVERED_DATASET_INDEX = 1;
	const DEAD_DATASET_INDEX = 2;
	const CONFIRMED_REGRESSION_DATASET_INDEX = 3;

	const cacheResetter = Math.round(Date.now() / (10 * 60 * 1000));

	const confirmedCases = (await axios({
		method: 'get',
		url: `docs/data/covid_confirmed.json?cache=${cacheResetter}`,
	})).data;
	const deadCases = (await axios({
		method: 'get',
		url: `docs/data/covid_dead.json?cache=${cacheResetter}`,
	})).data;
	const recoveredCases = (await axios({
		method: 'get',
		url: `docs/data/covid_recovered.json?cache=${cacheResetter}`,
	})).data;

	const nonDataKeys = ['Province/State', 'Country/Region', 'Lat', 'Long', 'country', 'state', 'county'];

	const dateKeys = [];
	const dateLabels = new Set();
	for (const key of Object.keys(confirmedCases[0])) {
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

	// const states = new Set();
	// const countriesByState = {}; // look up a state's country
	// const countryStates = {}; // enumerate up all states in a country

	for (const location of confirmedCases) {
		// const currentCountry = location['Country/Region'];
		const currentCountry = location['country']['long_name'];
		const currentCode = location['country']['short_name'];
		countryNames.add(currentCountry);
		countryCodes.add(currentCode);
		canonicalCountries.add(currentCode || currentCountry);

		countryNamesByCode[currentCode] = currentCountry;
		countryCodesByName[currentCountry] = currentCode;

		// const currentState = location['Province/State'];
		// const currentState = location['state']['long_name'];
		// if (currentState.length < 1) {
		// 	continue;
		// }
		// states.add(currentState);
		// countriesByState[currentState] = currentCountry;
		// countryStates[currentCountry] = countryStates[currentCountry] || new Set();
		// countryStates[currentCountry].add(currentState);
	}

	const ticks = {
		beginAtZero: true,
		callback: function (value) {
			return Number(value).toLocaleString();
		}
	};

	const doubleAxes = [
		{
			id: 'cases-axis',
			ticks,
			scaleLabel: {
				display: true,
				labelString: 'Cases'
			},
			labelString: 'Cases',
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
				},
				{
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
				},
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
				callbacks: {
					label: function (tooltipItem, data) {
						const value = tooltipItem.value;
						const label = data.datasets[tooltipItem.datasetIndex].label;
						return `${label}: ${Number(value).toLocaleString()}`;
					}
				}
			},
			responsive: true,
			maintainAspectRatio: false,
		}
	};


	const mapData = (await axios({
		method: 'get',
		url: 'assets/topo/world-countries.json',
	})).data;

	// const subdividedCountries = ['Antarctica', 'United States of America', 'China'];
	const subdividedCountries = ['Antarctica'];
	const mapCountryFeatures = ChartGeo.topojson.feature(mapData, mapData.objects.countries1).features.filter((f) => !subdividedCountries.includes(f.properties.name));
	const mapCountryData = mapCountryFeatures.map((d) => ({feature: d, value: 0, fraction: 0}));
	const mapCountryLabels = mapCountryFeatures.map((d) => {
		return {code: d.properties['Alpha-2'], name: d.properties.name}
	});


	const defaultCheckedCountries = new Set(canonicalCountries);
	defaultCheckedCountries.delete('HK'); // Hong Kong
	defaultCheckedCountries.delete('MO'); // Macao
	defaultCheckedCountries.delete('CN'); // China
	defaultCheckedCountries.delete('Diamond Princess Cruise Ship');
	defaultCheckedCountries.delete('Grand Princess Cruise Ship');
	defaultCheckedCountries.delete('US'); // USA

	const validValues = {
		axes: ['join', 'separate'],
		scale: ['linear', 'log'],
		regression: ['none', 'exponential', 'logistic'],
		mapDataSource: ['cases', 'recoveries', 'deaths'],
		mapDataReference: ['absolute', 'relative:cases', 'relative:recoveries'],
	};

	const params = {
		showCases: true,
		showDeaths: true,
		showRecoveries: true,
		axes: 'joint',
		scale: 'linear',
		derivative: false,
		includeCruiseShipDescendants: false,
		regression: 'none',
		modelOffset: 0,
		extrapolationSize: 5,
		mapDataSource: 'deaths',
		mapDataReference: 'relative:outcomes'
	};
	const parametrizableKeys = ['countries', ...Object.keys(params)];

	const routes = [{
		path: '/',
		props: {
			abc: 'def'
		}
	}];
	const router = new VueRouter({routes});

	let pathUpdateTimeout = null;

	const app = new Vue({
		el: '#app',
		router,
		data: {
			checkedCountries: [],
			countryNames,
			countryCodes,
			cases: confirmedCases,
			deaths: deadCases,
			recoveries: recoveredCases,
			selectAll: false,
			partialSelection: false,
			regressionOffsetMinimum: 0,
			regressionOffsetMaximum: dateLabels.size - 3,
			...params,
			graph: null,
			map: null,
			mapDate: dateLabels.size - 1,
			mapDateMinimum: 0,
			mapDateMaximum: dateLabels.size - 1,
			shareableLinkRaw: window.location.href,
			showShare: false,
			showCopyLink: true
		},
		created: function () {
			const query = this.$route.query;

			let querySpecifiedCountries = false;

			for (const key of Object.keys(query)) {
				if (!parametrizableKeys.includes(key)) {
					return;
				}
				const value = query[key];
				if (['showCases', 'showDeaths', 'showRecoveries', 'derivative', 'includeCruiseShipDescendants'].includes(key)) {
					// handle booleans
					this[key] = (value === 'true');
				} else if (key === 'countries') {
					let checkedCountries = [];
					querySpecifiedCountries = true;
					const countries = (value || '').split(',');
					if (Array.isArray(countries)) {
						for (const currentCountryCode of countries) {
							if (canonicalCountries.has(currentCountryCode)) {
								checkedCountries.push(currentCountryCode);
							}
						}
					}
					this.checkedCountries = checkedCountries;
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
					extrapolation = Math.min(extrapolation, 10);
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
				this.checkedCountries = Array.from(defaultCheckedCountries);
			}
		},
		mounted: function () {
			this.createChart();
			this.createMap();
			SocialShareKit.init({
				title: 'Coronavirus tracker by @arikaleph and @elliebee',
				text: ''
			});
		},
		methods: {
			getCountryCodeForEntry: function (entry) {
				// return entry['Country/Region'];
				return entry['country']['short_name'] || entry['country']['long_name'];
			},
			getCountryForEntry: function (entry) {
				// return entry['Country/Region'];
				return entry['country']['long_name'];
			},
			getStateForEntry: function (entry) {
				return entry['Province/State'];
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
				const context = document.getElementById('graph_canvas').getContext('2d');
				this.graph = new Chart(context, chartConfig);
			},
			createMap: function () {
				const context = document.getElementById("map").getContext("2d");
				this.map = new Chart(context, {
					type: 'choropleth',
					data: {
						labels: [...mapCountryLabels],
						// labels: ['Germany', 'Austria'],
						datasets: [{
							label: 'Countries',
							outline: mapCountryFeatures,
							backgroundColor: (context) => {
								if (context.dataIndex == null) {
									// return 'rgb(237, 241, 247)';
									return null;
								}
								const value = context.dataset.data[context.dataIndex].fraction;
								if (!value || value === 0) {
									// return new Color({r: 245, g: 247, b: 251}).rgbString();
									return 'rgb(237, 241, 247)';
								}

								let baseColor = new Color({r: 80, g: 120, b: 226});
								if (this.mapDataSource === 'recoveries') {
									baseColor = new Color({r: 40, g: 200, b: 150});

								} else if (this.mapDataSource === 'deaths') {
									baseColor = new Color({r: 155, g: 66, b: 254});
								}

								return baseColor.lightness(100 - value * 100).rgbString();
								// return `rgba(155, 66, 254, ${value})`; // new Color({r: 155, g: 66, b: 254}).lightness(100 - value * 100).rgbString();
							},
							data: [...mapCountryData]
						}]
					},
					options: {
						tooltips: {
							callbacks: {
								label: (tooltipItem, data) => {
									const countryDetails = data.labels[tooltipItem.index];
									const countryName = countryNamesByCode[countryDetails.code] || countryDetails.name;
									const {enumerator, denominator} = data.datasets[0].data[tooltipItem.index].value;
									let value = Number(enumerator).toLocaleString();
									if (this.mapDataReference.startsWith('relative:')) {
										value = Number(Math.round(enumerator / denominator * 10000) / 100).toLocaleString() + '%';
										if (denominator === 0) {
											value = '∞';
										}
									}
									return `${countryName}: ${value}`;
								}
							}
						},
						responsive: true,
						maintainAspectRatio: true,
						showOutline: false,
						showGraticule: false,
						legend: {
							display: false
						},
						scale: {
							projection: 'mercator'
						}
					}
				});
				this.layoutMapForDate(this.mapDate);
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
			updateLocation: function () {
				// update router
				clearTimeout(pathUpdateTimeout);
				const refreshRoute = () => {
					const query = {};
					for (const key of parametrizableKeys) {
						query[key] = this[key];
					}
					router.push({query}, (location) => {
						// console.dir(location);
						// this.shareableLinkRaw = window.location.href;
						this.showCopyLink = true;
						this.shareableLinkRaw = `${window.location.origin}${window.location.pathname}${window.location.search}#${location.fullPath}`;
					});
					// this.shareableLinkRaw = `${window.location.origin}${window.location.pathname}${window.location.search}#?`
				};
				pathUpdateTimeout = setTimeout(refreshRoute, 300);
			},
			parseRowEntryForDate: function (row, date) {
				// const value = row[date];
				const entry = row[date]
				/*if (!Number.isSafeInteger(entry)) {
					entry = 0;
					console.log('Skipping count for entry:', this.getCountryForEntry(row), this.getStateForEntry(row), date, value);
				}*/
				return entry;
			},
			filterDatasetBySelectedCountries: function (data) {
				const filteredData = [];
				for (const currentLocation of data) {
					const currentCountry = this.getCountryCodeForEntry(currentLocation);
					const currentState = this.getStateForEntry(currentLocation);
					if (!this.checkedCountries.includes(currentCountry)) {
						continue;
					}
					if (!this.includeCruiseShipDescendants && currentState.includes('From Diamond Princess')) {
						continue;
					}
					let dateIndex = 0;
					for (const key of Object.keys(currentLocation)) {
						if (nonDataKeys.includes(key)) {
							continue;
						}

						const currentCount = this.parseRowEntryForDate(currentLocation, key);

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
			layoutMapForDate: function (dateIndex) {
				const countryTotals = this.mapCountryValues[dateIndex];
				for (const currentCountry of this.map.data.datasets[0].data) {
					const currentCountryCode = currentCountry.feature.properties['Alpha-2'];
					const value = countryTotals[currentCountryCode];
					if (!value) {
						currentCountry.value = {enumerator: 0, denominator: 1};
						currentCountry.fraction = 0;
						continue;
					}

					const {enumerator, denominator} = value;
					if (enumerator === 0) {
						currentCountry.value = {enumerator: 0, denominator: 1};
						currentCountry.fraction = 0;
						continue;
					}

					let fraction = Math.log(enumerator) / Math.log(this.mapHistoricalCountryHigh) * 0.6 + 0.15;
					if (this.mapDataReference.startsWith('relative:')) {
						let value = enumerator / denominator;
						fraction = value / this.mapHistoricalCountryHigh * 0.6 + 0.15;

						if (this.mapDataReference !== 'relative:recoveries' && this.mapDataReference !== 'relative:outcomes') {
							// we need to amplify the smaller numbers (basically, comparing to large values like cases or population)
							fraction = Math.min(Math.max(Math.log(value * 100) / Math.log(this.mapHistoricalCountryHigh * 100) * 0.6 + 0.15, 0.075), 0.6 + 0.2);
						}

						if (denominator === 0) {
							// we have an infinity!
							fraction = 1;
						}
					}

					currentCountry.value = value;
					currentCountry.fraction = fraction;
				}
				this.map.update();
			},
			validateGraphLayout: function () {
				if (!this.canShowLogScale) {
					this.scale = 'linear';
				}
				const scaleType = (this.scale === 'log') ? 'logarithmic' : 'linear';
				for (const axis of chartConfig.options.scales.yAxes) {
					axis.type = scaleType;
				}
			}
		},
		watch: {
			selectAll: function (newValue) {
				if (newValue) {
					this.checkedCountries = Array.from(canonicalCountries);
					this.partialSelection = false;
				} else {
					this.checkedCountries = [];
				}
			},
			checkedCountries: function (newValue) {
				const selectedCountryCount = newValue.length;
				const totalCountryCount = this.countryNames.size;
				if (selectedCountryCount === 0) {
					this.selectAll = false;
					this.partialSelection = false;
				} else if (selectedCountryCount === totalCountryCount) {
					this.selectAll = true;
					this.partialSelection = false;
				} else {
					this.partialSelection = true;
				}
			},
			axes: function (newValue) {
				if (newValue === 'joint') {
					// remove second y axis
					chartConfig.options.scales.yAxes = singleAxis;
					delete chartConfig.data.datasets[0].yAxisID;
					delete chartConfig.data.datasets[1].yAxisID;
					delete chartConfig.data.datasets[2].yAxisID;
					delete chartConfig.data.datasets[3].yAxisID;
				} else {
					chartConfig.options.scales.yAxes = doubleAxes;
					chartConfig.data.datasets[CONFIRMED_DATASET_INDEX].yAxisID = doubleAxes[0].id;
					chartConfig.data.datasets[RECOVERED_DATASET_INDEX].yAxisID = doubleAxes[0].id;
					chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].yAxisID = doubleAxes[0].id;
					chartConfig.data.datasets[DEAD_DATASET_INDEX].yAxisID = doubleAxes[1].id;
				}
				this.validateGraphLayout();
				this.updateLocation();
				this.graph.update();
			},
			canSeparateAxes: function (newValue) {
				if (!newValue) {
					this.axes = 'joint';
				}
			},
			mapDate: function (newValue) {
				this.layoutMapForDate(newValue);
			},
			mapDataSource: function () {
				if (this.mapDataReference === 'relative:recoveries' && !this.canShowMapRelativeToRecoveries) {
					this.mapDataReference = 'relative:cases';
				}
				if (this.mapDataReference === 'relative:cases' && !this.canShowMapRelativeToCases) {
					this.mapDataReference = 'absolute';
				}
				if (this.mapDataReference === 'relative:outcomes' && !this.canShowMapRelativeToOutcomes) {
					this.mapDataReference = 'absolute';
				}
				this.layoutMapForDate(this.mapDate);
				this.updateLocation();
			},
			mapDataReference: function () {
				this.layoutMapForDate(this.mapDate);
				this.updateLocation();
			},
			timeSeries: function () {
				this.updateLocation();
				this.graph.update();
			},
			regressionSeries: function () {
				this.updateLocation();
				this.graph.update();
			},
			includeCruiseShipDescendants: function () {
				this.updateLocation();
			},
			canShowRegression: function (newValue) {
				if (newValue === false) {
					this.regression = 'none';
				}
			},
			scale: function () {
				this.validateGraphLayout();
				this.graph.update();
				this.updateLocation();
			}
		},
		computed: {
			countries: function () {
				// country names better not contain commas!
				const checkedCountries = Array.from(this.checkedCountries);
				checkedCountries.sort();
				return checkedCountries.join(',');
			},
			shareableLink: function () {
				return this.shareableLinkRaw;
			},
			canShowRegression: function () {
				return !!this.showCases && !this.derivative;
			},
			canSeparateAxes: function () {
				return (this.showCases || this.showRecoveries) && this.showDeaths;
			},
			canShowLogScale: function () {
				return true;
				// return (this.axes === 'joint');
			},
			canShowMapRelativeToCases: function () {
				return this.mapDataSource !== 'cases';
			},
			canShowMapRelativeToRecoveries: function () {
				return this.mapDataSource === 'deaths';
			},
			canShowMapRelativeToOutcomes: function () {
				return this.mapDataSource !== 'cases';
			},
			mapRawData: function () {
				let dataSource = confirmedCases;
				if (this.mapDataSource === 'recoveries') {
					dataSource = recoveredCases;
				} else if (this.mapDataSource === 'deaths') {
					dataSource = deadCases;
				}
				return dataSource;
			},
			mapCountryValues: function () {
				console.log('recalculating');
				const dataSource = this.mapRawData;

				let denominators = null;
				if (this.mapDataReference.startsWith('relative:')) {
					let comparisonDataSource = confirmedCases;
					if (this.mapDataReference === 'relative:recoveries') {
						comparisonDataSource = recoveredCases;
					} else if (this.mapDataReference === 'relative:outcomes') {
						if (this.mapDataSource === 'recoveries') {
							comparisonDataSource = deadCases;
						} else {
							comparisonDataSource = recoveredCases;
						}
					}

					denominators = [];
					for (let i = this.mapDateMinimum; i <= this.mapDateMaximum; i++) {
						const dateKey = dateKeys[i];
						const totalByCountries = {};
						for (const currentHistory of comparisonDataSource) {
							const countryCode = this.getCountryCodeForEntry(currentHistory);
							const currentDelta = this.parseRowEntryForDate(currentHistory, dateKey);
							totalByCountries[countryCode] = totalByCountries[countryCode] || 0;
							totalByCountries[countryCode] += currentDelta;
						}
						denominators.push(totalByCountries);
					}
				}

				const countryTotals = [];
				for (let i = this.mapDateMinimum; i <= this.mapDateMaximum; i++) {
					const dateKey = dateKeys[i];
					const totalByCountries = {};
					for (const currentHistory of dataSource) {
						const countryCode = this.getCountryCodeForEntry(currentHistory);

						let denominator = 1;
						if (denominators && denominators[i]) {
							denominator = denominators[i][countryCode];
						}

						totalByCountries[countryCode] = totalByCountries[countryCode] || {
							enumerator: 0,
							denominator
						};

						const currentDelta = this.parseRowEntryForDate(currentHistory, dateKey);
						totalByCountries[countryCode].enumerator += currentDelta;

						if (this.mapDataReference === 'relative:outcomes') {
							// instead of calculating dead/recovered, calculate dead/(dead+recovered)
							totalByCountries[countryCode].denominator += currentDelta;
						}
					}
					countryTotals.push(totalByCountries);
				}
				return countryTotals;
			},
			mapHistoricalCountryHigh: function () {
				let maximum = 0;
				const countryTotal = this.mapCountryValues[this.mapDateMaximum];
				// console.dir(countryTotal);
				for (const [key, {enumerator, denominator}] of Object.entries(countryTotal)) {
					if (denominator === 0) {
						continue;
					}
					const value = enumerator / denominator;
					maximum = Math.max(maximum, value);
				}
				return maximum;
			},
			sortedCountries: function () {
				const countries = Array.from(this.countryNames);
				countries.sort();

				// move the cruise ship first and china second
				const diamondCruiseShipIndex = countries.indexOf('Diamond Princess Cruise Ship');
				this.moveArrayEntry(countries, diamondCruiseShipIndex, 0);
				const grandCruiseShipIndex = countries.indexOf('Grand Princess Cruise Ship');
				this.moveArrayEntry(countries, grandCruiseShipIndex, 1);
				const chinaIndex = countries.indexOf('China');
				this.moveArrayEntry(countries, chinaIndex, 2);

				return countries.map(c => countryCodesByName[c] || c);
			},
			timeSeries: function () {
				let confirmedYValues = this.filterDatasetBySelectedCountries(this.cases);
				let deadYValues = this.filterDatasetBySelectedCountries(this.deaths);
				let recoveredYValues = this.filterDatasetBySelectedCountries(this.recoveries);

				if (this.derivative) {
					confirmedYValues = calculateDerivative(confirmedYValues);
					deadYValues = calculateDerivative(deadYValues);
					recoveredYValues = calculateDerivative(recoveredYValues);
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
					chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].data = [];
				}

				return [confirmedYValues, deadYValues, recoveredYValues];
			},

			regressionSeries: function () {

				const confirmedYValues = this.timeSeries[0];
				const confirmedExtrapolationBasis = confirmedYValues.slice(this.modelOffset);
				const deadYValues = this.timeSeries[1];
				const deadExtrapolationBasis = deadYValues.slice(this.modelOffset);

				const regressionDetails = {};

				chartConfig.data.labels = Array.from(dateLabels);
				chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].data = [];

				if (this.regression !== 'none') {
					const regressionDateLabels = Array.from(dateLabels);
					const regressionRange = [];
					const extrapolationSize = Math.round(this.extrapolationSize);
					for (let x = 0; x < confirmedYValues.length + extrapolationSize; x++) {
						regressionRange.push(x);
					}
					for (let x = 1; x <= extrapolationSize; x++) {
						regressionDateLabels.push(`+${x}`);
					}
					chartConfig.data.labels = regressionDateLabels;

					console.log('regressionRange:');
					console.dir(regressionRange);

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
						}
					} catch (e) {
						// regression failed
						return {
							regressionError: e,
							cases: {
								equation: [NaN, NaN],
								parameterValues: [NaN, NaN, NaN],
							}
						}
					}

					console.log('regressionParams:');
					console.dir(regressionParams);
					console.log('extrapolationY:');
					console.dir(extrapolationY);
					chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].data = extrapolationY;
					console.log('extrapolationY:');
					console.dir(extrapolationY);
					regressionDetails.cases = regressionParams;

				}

				return regressionDetails;
			}
		}
	});

})();
