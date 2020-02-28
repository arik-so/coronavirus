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
    const confirmedResponse = await axios({
        method: 'get',
        url: 'docs/data/covid_confirmed.csv',
    });
    const deadResponse = await axios({
        method: 'get',
        url: 'docs/data/covid_dead.csv',
    });
    const confirmedCases = await csv({output: 'json'}).fromString(confirmedResponse.data);
    const deadCases = await csv({output: 'json'}).fromString(deadResponse.data);

    const dateLabels = new Set();
    for (const key of Object.keys(confirmedCases[0])) {
        if (['Province/State', 'Country/Region', 'Lat', 'Long'].includes(key)) {
            continue;
        }
        dateLabels.add(key);
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
    const ctx = document.getElementById('graph_canvas').getContext('2d');
    const chartConfig = {
        type: 'line',
        data: {
            labels: Array.from(dateLabels),
            datasets: [
                {
                    label: 'Case Count',
                    data: [],
                    backgroundColor: 'rgb(0, 0, 0)',
                    borderColor: 'rgba(240, 200, 50, 1)',
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                },
                {
                    label: 'Deaths',
                    data: [],
                    backgroundColor: 'rgb(0, 0, 0)',
                    borderColor: 'rgba(220, 50, 50, 1)',
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                },
                {
                    label: 'Case Regression',
                    data: [],
                    backgroundColor: 'rgb(0, 0, 0)',
                    borderColor: 'rgba(50, 50, 150, 1)',
                    fill: false,
                    cubicInterpolationMode: 'monotone',
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
            }
        }
    };
    const graph = new Chart(ctx, chartConfig);


    const Home = {template: '<p>home page</p>'};

    const params = {
        checkedCountries: [],
        showCases: true,
        showDeaths: true,
        axes: 'joint',
        derivative: false,
        includeCruiseShip: false,
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
            selectAll: false,
            partialSelection: false,
            regressionOffsetMinimum: 0,
            regressionOffsetMaximum: dateLabels.size - 3,
            ...params,
        },
        created: function () {
            const query = this.$route.query;
            const validKeys = Object.keys(params);
            for (const key of Object.keys(query)) {
                if (!validKeys.includes(key)) {
                    return;
                }
                const value = query[key];
                if (['showCases', 'showDeaths', 'derivative', 'includeCruiseShip', 'includeCruiseShipDescendants'].includes(key)) {
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
        methods: {
            formatCountry: function (country) {
                if (country === 'Others') {
                    return 'Cruise Ship';
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
                    if (!this.includeCruiseShip && currentState === 'Diamond Princess cruise ship') {
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
                } else {
                    chartConfig.options.scales.yAxes = doubleAxes;
                    chartConfig.data.datasets[0].yAxisID = doubleAxes[0].id;
                    chartConfig.data.datasets[2].yAxisID = doubleAxes[0].id;
                    chartConfig.data.datasets[1].yAxisID = doubleAxes[1].id;
                }
                this.updateLocation();
                graph.update();
            },
            canSeparateAxes: function (newValue) {
                if (!newValue) {
                    this.axes = 'joint';
                }
            },
            timeSeries: function () {
                this.updateLocation();
                graph.update();
            },
            regressionSeries: function () {
                this.updateLocation();
                graph.update();
            }
        },
        computed: {
            selectionLength: function () {
                return this.checkedCountries.length;
            },
            canSeparateAxes: function () {
                return this.showCases && this.showDeaths;
            },
            timeSeries: function () {
                let confirmedYValues = this.filterDatasetBySelectedCountries(this.cases);
                let deadYValues = this.filterDatasetBySelectedCountries(this.deaths);

                if (this.derivative) {
                    confirmedYValues = calculateDerivative(confirmedYValues);
                    deadYValues = calculateDerivative(deadYValues);
                }

                if (this.showCases) {
                    chartConfig.data.datasets[0].data = confirmedYValues;
                } else {
                    chartConfig.data.datasets[0].data = [];
                }

                if (this.showDeaths) {
                    chartConfig.data.datasets[1].data = deadYValues;
                } else {
                    chartConfig.data.datasets[1].data = [];
                }

                if (this.regression !== 'exponential') {
                    chartConfig.data.labels = Array.from(dateLabels);
                    chartConfig.data.datasets[2].data = [];
                }

                return [confirmedYValues, deadYValues];
            },
            regressionSeries: function () {
                const confirmedYValues = this.timeSeries[0];
                const confirmedExtrapolationBasis = confirmedYValues.slice(this.modelOffset);
                const deadYValues = this.timeSeries[1];
                const deadExtrapolationBasis = deadYValues.slice(this.modelOffset);

                const regressionDetails = {};

                chartConfig.data.labels = Array.from(dateLabels);
                chartConfig.data.datasets[2].data = [];
                if (this.regression === 'exponential') {
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

                    console.dir(regressionRange);

                    const regressionData = confirmedExtrapolationBasis.map((value, index) => [index, value]);
                    const regressionParams = regression.exponential(regressionData);
                    const extrapolationValues = regressionRange.map(y => regressionParams.predict(y - this.modelOffset));
                    console.dir(regressionData);
                    console.dir(regressionParams);
                    const extrapolationY = extrapolationValues.map(([x, value], index) => {
                        if (index < this.modelOffset) {
                            console.log('x:', x, 'index:', index, 'model offset', this.modelOffset);
                            return null;
                        }
                        return Math.round(value);
                    });
                    chartConfig.data.datasets[2].data = extrapolationY;
                    console.dir(extrapolationY);
                    regressionDetails.cases = regressionParams;
                }

                return regressionDetails;
            }
        }
    });

})();
