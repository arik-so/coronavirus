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

    const confirmedResponse = await axios({
        method: 'get',
        url: 'docs/data/covid_confirmed.csv',
    });
    const deadResponse = await axios({
        method: 'get',
        url: 'docs/data/covid_dead.csv',
    });
    const recoveredResponse = await axios({
        method: 'get',
        url: 'docs/data/covid_recovered.csv',
    });
    const confirmedCases = await csv({output: 'json'}).fromString(confirmedResponse.data);
    const deadCases = await csv({output: 'json'}).fromString(deadResponse.data);
    const recoveredCases = await csv({output: 'json'}).fromString(recoveredResponse.data);

    const dateLabels = new Set();
    for (const key of Object.keys(confirmedCases[0])) {
        if (['Province/State', 'Country/Region', 'Lat', 'Long'].includes(key)) {
            continue;
        }
        // const dateObject = Date.parse(key);
        const dateString = moment(key).format('MMM Do');
        dateLabels.add(dateString);
    }

    // parse the data into what we need
    const countries = new Set();
    const states = new Set();
    const countriesByState = {}; // look up a state's country
    const countryStates = {}; // enumerate up all states in a country
    for (const location of confirmedCases) {
        const currentCountry = location['Country/Region'];
        const currentState = location['Province/State'];
        countries.add(currentCountry);
        if (currentState.length < 1) {
            continue;
        }
        states.add(currentState);
        countriesByState[currentState] = currentCountry;
        countryStates[currentCountry] = countryStates[currentCountry] || new Set();
        countryStates[currentCountry].add(currentState);
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

    const Home = {template: '<p>home page</p>'};

    const defaultCheckedCountries = new Set(countries);
    defaultCheckedCountries.delete('Hong Kong');
    defaultCheckedCountries.delete('Macau');
    defaultCheckedCountries.delete('Mainland China');
    defaultCheckedCountries.delete('Others');
    defaultCheckedCountries.delete('US');

    const params = {
        checkedCountries: [],
        showCases: true,
        showDeaths: true,
        showRecoveries: true,
        axes: 'joint',
        derivative: false,
        includeCruiseShipDescendants: false,
        regression: 'none',
        modelOffset: 0,
        extrapolationSize: 5,
    };

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
            countries,
            cases: confirmedCases,
            deaths: deadCases,
            recoveries: recoveredCases,
            selectAll: false,
            partialSelection: false,
            regressionOffsetMinimum: 0,
            regressionOffsetMaximum: dateLabels.size - 3,
            ...params,
            graph: null
        },
        created: function () {
            const query = this.$route.query;
            const validKeys = Object.keys(params);

            if (Object.entries(query) < 1) {
                // only set the country default if the query is empty
                this.checkedCountries = Array.from(defaultCheckedCountries);
            }

            for (const key of Object.keys(query)) {
                if (!validKeys.includes(key)) {
                    return;
                }
                const value = query[key];
                if (['showCases', 'showDeaths', 'showRecoveries', 'derivative', 'includeCruiseShipDescendants'].includes(key)) {
                    // handle booleans
                    this[key] = (value === 'true');
                } else if (key === 'checkedCountries') {
                    let checkedCountries = [];
                    if (Array.isArray(value)) {
                        for (const currentCountry of value) {
                            if (countries.has(currentCountry)) {
                                checkedCountries.push(currentCountry);
                            }
                        }
                    } else if (countries.has(value)) {
                        checkedCountries.push(value);
                    }
                    this[key] = checkedCountries;
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
                    this[key] = value;
                }
            }
        },
        mounted: function () {
            this.createChart();
        },
        methods: {
            createChart: function () {
                const ctx = document.getElementById('graph_canvas').getContext('2d');
                this.graph = new Chart(ctx, chartConfig);
            },
            formatCountry: function (country) {
                if (country === 'Others') {
                    return '💎👸🚢 Cruise Ship';
                }
                return country;
            },
            updateLocation: function () {
                // update router
                clearTimeout(pathUpdateTimeout);
                const refreshRoute = () => {
                    const query = {};
                    for (const key of Object.keys(params)) {
                        query[key] = this[key];
                    }
                    router.push({query});
                };
                pathUpdateTimeout = setTimeout(refreshRoute, 300);
            },
            filterDatasetBySelectedCountries: function (data) {
                const filteredData = [];
                for (const currentLocation of data) {
                    const currentCountry = currentLocation['Country/Region'];
                    const currentState = currentLocation['Province/State'];
                    if (!this.checkedCountries.includes(currentCountry)) {
                        continue;
                    }
                    if (!this.includeCruiseShipDescendants && currentState.includes('From Diamond Princess')) {
                        continue;
                    }
                    let dateIndex = 0;
                    for (const [key, value] of Object.entries(currentLocation)) {
                        if (['Province/State', 'Country/Region', 'Lat', 'Long'].includes(key)) {
                            continue;
                        }
                        const currentCount = parseInt(value);
                        filteredData[dateIndex] = filteredData[dateIndex] || 0;
                        filteredData[dateIndex] += currentCount;
                        dateIndex++;
                    }
                }
                return filteredData;
            },
            moveArrayEntry: function (array, from, to) {
                return array.splice(to, 0, array.splice(from, 1)[0]);
            }
        },
        watch: {
            selectAll: function (newValue) {
                if (newValue) {
                    this.checkedCountries = Array.from(this.countries);
                    this.partialSelection = false;
                } else {
                    this.checkedCountries = [];
                }
            },
            checkedCountries: function (newValue) {
                const selectedCountryCount = newValue.length;
                const totalCountryCount = this.countries.size;
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
                this.updateLocation();
                this.graph.update();
            },
            canSeparateAxes: function (newValue) {
                if (!newValue) {
                    this.axes = 'joint';
                }
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
            }
        },
        computed: {
            canShowRegression: function () {
                return !!this.showCases;
            },
            canSeparateAxes: function () {
                return (this.showCases || this.showRecoveries) && this.showDeaths;
            },
            sortedCountries: function () {
                const countries = Array.from(this.countries);
                countries.sort();

                // move the cruise ship first and china second
                const cruiseShipIndex = countries.indexOf('Others');
                this.moveArrayEntry(countries, cruiseShipIndex, 0);
                const chinaIndex = countries.indexOf('Mainland China');
                this.moveArrayEntry(countries, chinaIndex, 1);

                return countries
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
