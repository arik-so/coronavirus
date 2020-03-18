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

	//
	// const confirmedCasesUSA = (await axios({
	// 	method: 'get',
	// 	url: `docs/data/usa_covid_confirmed.json?cache=${cacheResetter}`,
	// })).data;
	// const deadCasesUSA = (await axios({
	// 	method: 'get',
	// 	url: `docs/data/usa_covid_dead.json?cache=${cacheResetter}`,
	// })).data;
	// const recoveredCasesUSA = (await axios({
	// 	method: 'get',
	// 	url: `docs/data/usa_covid_recovered.json?cache=${cacheResetter}`,
	// })).data;

	const countryPopulation = (await axios({
		method: 'get',
		url: `docs/data/population.json`,
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

	const usaStateNames = new Set();
	const usaStateCodes = new Set();
	const usaStateNamesByCode = {};
	const usaStateCodesByName = {};

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

		if (currentCode === 'US') {
			const currentState = location['state']['long_name'];
			const currentStateCode = location['state']['short_name'];
			usaStateNames.add(currentState);
			usaStateCodes.add(currentStateCode);

			usaStateNamesByCode[currentStateCode] = currentState;
			usaStateCodesByName[currentState] = currentStateCode;
		}
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
		mapDataReference: ['absolute', 'relative:cases', 'relative:recoveries', 'relative:population'],
		mapScope: ['World', 'USA', 'Europe'/*, 'China'*/]
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
		mapDataSource: 'deaths',
		mapDataReference: 'relative:outcomes',
		mapScope: 'World'
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
			raw: {
				worldTopographyFeatures,
				usaStateTopographyFeatures,
				countryNamesByCode,
				usaStateNamesByCode,
				usaStateCodesByName,
				confirmedCases,
				recoveredCases,
				deadCases,
				dateKeys,
				countryPopulation
			},
			includeCruiseShipDescendants: true,
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
				this.checkedCountries = Array.from(defaultCheckedCountries);
			}
		},
		mounted: function () {
			this.createChart();
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
				const entry = row[date];
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
				this.updateLocation();
			},
			mapDataReference: function () {
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
			mapScope: function () {
				this.updateLocation();
				// TODO
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
			showSelectionTotals: function(){
				console.log('check selection totals');
				return this.checkedCountries.length > 0;
			},
			decoratedCountries: function(){
				console.log('redecorating');
				const countryDecorations = {};
				const emoji = {
					cases: '🤒',
					recoveries: '👍',
					deaths: '☠️'
				};
				for (const [group, data] of Object.entries(this.latestLocationTotals)){
					for(const [countryCode, value] of Object.entries(data)){
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
				const rawData = {
					cases: confirmedCases,
					recoveries: recoveredCases,
					deaths: deadCases
				};

				const locationTotals = {};
				const dateKey = this.todayKey;

				for (const [group, data] of Object.entries(rawData)) {
					locationTotals[group] = {};
					for (const currentLocation of data) {
						// debugger
						const currentCountry = this.getCountryCodeForEntry(currentLocation);
						const currentState = this.getStateForEntry(currentLocation);
						if (!this.includeCruiseShipDescendants && currentState.includes('From Diamond Princess')) {
							continue;
						}
						const currentCount = this.parseRowEntryForDate(currentLocation, dateKey);
						locationTotals[group][currentCountry] = locationTotals[group][currentCountry] || 0;
						locationTotals[group]['total'] = locationTotals[group]['total'] || 0;
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
			aggregatedTotals: function () {
				console.log('aggregating totals');

				const series = this.timeSeries;
				const confirmedSeries = series[0];
				const deadSeries = series[1];
				const recoveredSeries = series[2];

				return {
					cases: Number(confirmedSeries[confirmedSeries.length - 1]).toLocaleString(),
					deaths: Number(deadSeries[deadSeries.length - 1]).toLocaleString(),
					recoveries: Number(recoveredSeries[recoveredSeries.length - 1]).toLocaleString(),
				};
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

					// console.log('regressionRange:');
					// console.dir(regressionRange);

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

					// console.log('regressionParams:');
					// console.dir(regressionParams);
					// console.log('extrapolationY:');
					// console.dir(extrapolationY);
					chartConfig.data.datasets[CONFIRMED_REGRESSION_DATASET_INDEX].data = extrapolationY;
					// console.log('extrapolationY:');
					// console.dir(extrapolationY);
					regressionDetails.cases = regressionParams;

				}

				return regressionDetails;
			}
		}
	});

})();
