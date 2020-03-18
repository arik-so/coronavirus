Vue.component('covid-map', {
	props: [
		'scope',
		'mapDate',
		'mapDataSource',
		'mapDataReference'
	],
	data: function () {
		return {
			count: 0,
			map: null,
			benchmark: null
		}
	},
	mounted: function () {
		// alert('here')
		this.createMap();
	},
	watch: {
		scope: function () {
			this.map.destroy();
			this.createMap(); // completely reset it

			/*
			this.map.clear();
			this.updateScope();
			this.layoutMapForDate(this.mapDate);
			 */
		},
		mapDataSource: function () {
			this.layoutMapForDate(this.mapDate);
		},
		mapDataReference: function () {
			this.layoutMapForDate(this.mapDate);
		},
		mapDate: function () {
			this.layoutMapForDate(this.mapDate);
		}
	},
	computed: {
		europeanCountryCodes: function () {
			// return {
			// 	iso: ['GB', 'DE', 'IT'],
			// 	ids: []
			// };

			const europeanUnionCountries = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"];
			const europeanCountries = ['CH', 'NO', 'IS', 'IL', 'TR', 'BY', 'UA', 'LB', 'SY',
				'MC', 'SM', 'VA', 'BA', 'RS', 'ME', 'MK', 'AL', 'MD', 'AD', 'JO', 'GI', 'MA', 'DZ', 'TN', 'MT',
				'PS', 'EG', 'LY',
				...europeanUnionCountries];
			return {
				iso: europeanCountries,
				ids: ['CS-KM']
			}
		},
		topographyFeatures: function () {
			/*const worldTopography = this.$parent.$data.raw.mapData;
			this.bench('1');

			this.bench('2');
			const countryObjects = worldTopography.objects.countries1;
			this.bench('3');
			debugger
			const featuresContainer = ChartGeo.topojson.feature(worldTopography, countryObjects);
			this.bench('4');
			const unfilteredFeatures = featuresContainer.features;*/

			const unfilteredFeatures = this.$parent.$data.raw.worldTopographyFeatures;
			const subdividedCountries = ['Antarctica'];
			const mapCountryFeatures = unfilteredFeatures.filter((f) => !subdividedCountries.includes(f.properties.name));

			if (this.scope === 'World') {
				return mapCountryFeatures;
			} else if (this.scope === 'Europe') {
				const europe = this.europeanCountryCodes;
				const europeanFeatures = mapCountryFeatures.filter(f => europe.iso.includes(f.properties['Alpha-2']) || europe.ids.includes(f.id));
				return europeanFeatures;
			} else if (this.scope === 'USA') {
				return this.$parent.$data.raw.usaStateTopographyFeatures;
			}
			return [];
		},
		topographyConfiguration: function () {
			const mapCountryFeatures = this.topographyFeatures;

			let labels, outline, data, projection = null;
			let maintainAspectRatio = false;
			let aspectRatio = null;

			if (['World', 'Europe'].includes(this.scope)) {

				const mapCountryData = mapCountryFeatures.map((c) => ({
					feature: c,
					value: 0,
					fraction: 0,
					code: c.properties['Alpha-2']
				}));
				labels = mapCountryFeatures.map((c) => {
					return {code: c.properties['Alpha-2'], name: c.properties.name}
				});

				outline = mapCountryFeatures;
				data = mapCountryData;
				projection = 'mercator';

				if (this.scope === 'World') {
					maintainAspectRatio = true;
					aspectRatio = 1.6;
				} else if (this.scope === 'Europe') {
					maintainAspectRatio = false;
					aspectRatio = 0.8;
				}

			} else if (this.scope === 'USA') {
				const {nation, states} = mapCountryFeatures;

				const stateData = states.map((s) => ({
					feature: s,
					value: 0,
					fraction: 0,
					code: this.$parent.$data.raw.usaStateCodesByName[s.properties.name]
				}));
				labels = states.map(s => ({
					code: this.$parent.$data.raw.usaStateCodesByName[s.properties.name],
					name: s.properties.name
				}));

				outline = [nation];
				projection = 'albersUsa';
				data = stateData;
			}

			return {labels, outline, data, projection, maintainAspectRatio, aspectRatio};
		},
		mapRawData: function () {
			let dataSource = this.$parent.$data.raw.confirmedCases;
			if (this.mapDataSource === 'recoveries') {
				dataSource = this.$parent.$data.raw.recoveredCases;
			} else if (this.mapDataSource === 'deaths') {
				dataSource = this.$parent.$data.raw.deadCases;
			}
			return dataSource;
		},
		mapCountryValues: function () {
			console.log('recalculating');
			const dataSource = this.mapRawData;

			let denominators = null;
			if (this.mapDataReference.startsWith('relative:') && this.mapDataReference !== 'relative:population') {
				let comparisonDataSource = this.$parent.$data.raw.confirmedCases;
				if (this.mapDataReference === 'relative:recoveries') {
					comparisonDataSource = this.$parent.$data.raw.recoveredCases;
				} else if (this.mapDataReference === 'relative:outcomes') {
					if (this.mapDataSource === 'recoveries') {
						comparisonDataSource = this.$parent.$data.raw.deadCases;
					} else {
						comparisonDataSource = this.$parent.$data.raw.recoveredCases;
					}
				}

				denominators = [];
				for (let i = this.$parent.$data.mapDateMinimum; i <= this.$parent.$data.mapDateMaximum; i++) {
					const dateKey = this.$parent.$data.raw.dateKeys[i];
					const totalByCountries = {};
					for (const currentHistory of comparisonDataSource) {
						if (this.shouldSkipEntry(currentHistory)) {
							continue;
						}
						const locationCode = this.getCodeForEntry(currentHistory);
						const currentDelta = currentHistory[dateKey];
						totalByCountries[locationCode] = totalByCountries[locationCode] || 0;
						totalByCountries[locationCode] += currentDelta;
					}
					denominators.push(totalByCountries);
				}
			}

			const locationTotals = [];
			for (let i = this.$parent.$data.mapDateMinimum; i <= this.$parent.$data.mapDateMaximum; i++) {
				const dateKey = this.$parent.$data.raw.dateKeys[i];
				const totalByCountries = {};
				for (const currentHistory of dataSource) {
					if (this.shouldSkipEntry(currentHistory)) {
						continue;
					}
					const locationCode = this.getCodeForEntry(currentHistory);

					let denominator = 1;
					if (denominators && denominators[i]) {
						denominator = denominators[i][locationCode];
					} else if (this.mapDataReference === 'relative:population') {
						denominator = this.$parent.$data.raw.countryPopulation[locationCode]/* || 0*/;
						if (this.scope === 'USA') {
							denominator = this.$parent.$data.raw.countryPopulation['USA'][locationCode]/* || 0*/;
						}
					}

					totalByCountries[locationCode] = totalByCountries[locationCode] || {
						enumerator: 0,
						denominator
					};

					const currentDelta = currentHistory[dateKey];
					totalByCountries[locationCode].enumerator += currentDelta;

					if (this.mapDataReference === 'relative:outcomes') {
						// instead of calculating dead/recovered, calculate dead/(dead+recovered)
						totalByCountries[locationCode].denominator += currentDelta;
					}
				}
				locationTotals.push(totalByCountries);
			}
			console.dir(locationTotals);
			return locationTotals;
		},
		mapHistoricalCountryHigh: function () {
			let maximum = 0;
			const countryTotal = this.mapCountryValues[this.$parent.$data.mapDateMaximum];
			// console.dir(countryTotal);
			for (const [key, {enumerator, denominator}] of Object.entries(countryTotal)) {
				if (denominator === 0 || !Number.isSafeInteger(denominator)) {
					continue;
				}
				const value = enumerator / denominator;
				maximum = Math.max(maximum, value);
			}
			console.log('maximum:', maximum);
			return maximum;
		},
	},
	methods: {
		bench: function (annotation) {
			const now = Date.now();
			let delta = null;
			if (this.benchmark) {
				const elapsed = now - this.benchmark;
				delta = ` (${elapsed}ms)`
			}
			this.benchmark = now;
			console.log(annotation, delta);

		},
		getCodeForEntry: function (entry) {
			if (this.scope === 'USA') {
				return entry['state']['short_name'];
			}
			return entry['country']['short_name'] || entry['country']['long_name'];
		},
		shouldSkipEntry: function (entry) {
			if (this.scope === 'World') {
				return false;
			} else if (this.scope === 'USA' && entry['country']['short_name'] !== 'US') {
				return true;
			} else if (this.scope === 'Europe') {
				const europe = this.europeanCountryCodes;
				return !europe.iso.includes(entry['country']['short_name']);
			}
			return false;
		},
		updateScope: function () {
			/*
			const mapCountryFeatures = this.topographyFeatures;
			const mapCountryData = mapCountryFeatures.map((d) => ({feature: d, value: 0, fraction: 0}));
			const mapCountryLabels = mapCountryFeatures.map((d) => {
				return {code: d.properties['Alpha-2'], name: d.properties.name}
			});

			this.map.data.labels = mapCountryLabels;
			this.map.data.datasets[0].data = mapCountryData;
			this.map.data.datasets[0].outline = mapCountryFeatures;
			 */
		},
		createMap: function () {
			const {labels, outline, data, projection, maintainAspectRatio, aspectRatio} = this.topographyConfiguration;

			const context = this.$el.getContext("2d");
			this.map = new Chart(context, {
				type: 'choropleth',
				data: {
					labels,
					// labels: ['Germany', 'Austria'],
					datasets: [{
						label: 'Countries',
						outline,
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
						data
					}]
				},
				options: {
					tooltips: {
						callbacks: {
							label: (tooltipItem, data) => {
								const locationDetails = data.labels[tooltipItem.index];
								let locationName = this.$parent.$data.raw.countryNamesByCode[locationDetails.code] || locationDetails.name;
								if (this.scope === 'USA') {
									locationName = this.$parent.$data.raw.usaStateNamesByCode[locationDetails.code];
								}
								const {enumerator, denominator} = data.datasets[0].data[tooltipItem.index].value;
								let value = Number(enumerator).toLocaleString();
								if (this.mapDataReference.startsWith('relative:')) {
									value = Number(Math.round(enumerator / denominator * 10000) / 100).toLocaleString() + '%';
									if (this.mapDataReference === 'relative:population') {
										// it's a bit more
										value = Number(Math.round(enumerator / denominator * 100000000) / 10000).toLocaleString() + '‱';
									}
									if (denominator === 0) {
										value = '∞';
									}
								}
								return `${locationName}: ${value}`;
							}
						}
					},
					responsive: true,
					maintainAspectRatio,
					aspectRatio,
					showOutline: false,
					showGraticule: false,
					legend: {
						display: false
					},
					scale: {
						projection
					}
				}
			});
			this.layoutMapForDate(this.mapDate);
		},
		layoutMapForDate: function (dateIndex) {
			const locationTotals = this.mapCountryValues[dateIndex];
			for (const currentLocation of this.map.data.datasets[0].data) {
				const currentLocationCode = currentLocation.code;
				const value = locationTotals[currentLocationCode];
				if (!value) {
					currentLocation.value = {enumerator: 0, denominator: 1};
					currentLocation.fraction = 0;
					continue;
				}

				const {enumerator, denominator} = value;
				if (enumerator === 0) {
					currentLocation.value = {enumerator: 0, denominator: 1};
					currentLocation.fraction = 0;
					continue;
				}

				let fraction = Math.log(enumerator) / Math.log(this.mapHistoricalCountryHigh) * 0.6 + 0.15;
				if (this.mapDataReference.startsWith('relative:')) {
					let value = enumerator / denominator;
					fraction = value / this.mapHistoricalCountryHigh * 0.6 + 0.15;

					if (this.mapDataReference === 'relative:cases') {
						// we need to amplify the smaller numbers (basically, comparing to large values like cases or population)
						fraction = Math.min(Math.max(Math.log(value * 100) / Math.log(this.mapHistoricalCountryHigh * 100) * 0.6 + 0.15, 0.075), 0.6 + 0.2);
					} else if (this.mapDataReference === 'relative:population') {
						// we need to amplify the smaller numbers (basically, comparing to large values like cases or population)
						const logFactor = 300;
						// fraction = Math.min(Math.max(Math.log(value * logFactor) / Math.log(this.mapHistoricalCountryHigh * logFactor) * 0.6 + 0.15, 0.075), 0.6 + 0.2);
						// fraction = Math.log(value * 10) / Math.log(this.mapHistoricalCountryHigh * 10) * 0.6 + 0.15;
						// fraction = Math.log(value / this.mapHistoricalCountryHigh * logFactor);
						// fraction = Math.min(Math.max(fraction * 0.6 + 0.15, 0.075), 0.6 + 0.2);
						// debugger
						// console.log(currentCountry.feature.properties.name);
						// console.log('value:', value);
						// console.log('maximum:', this.mapHistoricalCountryHigh);
						// console.log('fraction of maximum:', value/this.mapHistoricalCountryHigh);
						fraction = Math.min(Math.max(Math.log(value / this.mapHistoricalCountryHigh * 50) * 0.6 + 0.15, 0.075), 0.8);

					}

					if (denominator === 0) {
						// we have an infinity!
						fraction = 1;
					}
				}

				currentLocation.value = value;
				currentLocation.fraction = fraction;
			}
			this.map.update();
		}
	},
	template: '<canvas></canvas>'
});
