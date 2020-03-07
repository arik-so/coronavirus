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

    const confirmedResponse = await axios({
        method: 'get',
        url: `docs/data/covid_confirmed.csv?cache=${cacheResetter}`,
    });
    const deadResponse = await axios({
        method: 'get',
        url: `docs/data/covid_dead.csv?cache=${cacheResetter}`,
    });
    const recoveredResponse = await axios({
        method: 'get',
        url: `docs/data/covid_recovered.csv?cache=${cacheResetter}`,
    });
    const confirmedCases = await csv({output: 'json'}).fromString(confirmedResponse.data);
    const deadCases = await csv({output: 'json'}).fromString(deadResponse.data);
    const recoveredCases = await csv({output: 'json'}).fromString(recoveredResponse.data);

    const dateKeys = [];
    const dateLabels = new Set();
    for (const key of Object.keys(confirmedCases[0])) {
        if (['Province/State', 'Country/Region', 'Lat', 'Long'].includes(key)) {
            continue;
        }
        // const dateObject = Date.parse(key);
        dateKeys.push(key);
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
    const mapCountryLabels = mapCountryFeatures.map((d) => d.properties.name);


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
        scale: 'linear',
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
            graph: null,
            map: null,
            mapDate: dateLabels.size - 1,
            mapDateMinimum: 0,
            mapDateMaximum: dateLabels.size - 1,
            mapDataSource: 'cases',
            mapDataReference: 'absolute'
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
            this.createMap();
        },
        methods: {
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
                                    const countryName = data.labels[tooltipItem.index];
                                    const value = data.datasets[0].data[tooltipItem.index].value;
                                    if (this.mapDataReference.startsWith('relative:')) {
                                        const printedValue = Number(Math.round(value * 10000) / 100).toLocaleString();
                                        return `${countryName}: ${printedValue}%`;
                                    }
                                    return `${countryName}: ${Number(value).toLocaleString()}`;
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
                        let currentCount = parseInt(value);
                        if (!Number.isSafeInteger(currentCount)) {
                            currentCount = 0;
                            console.log('Skipping count for entry:', currentLocation['Country/Region'], currentLocation['Province/State'], key, value);
                        }
                        filteredData[dateIndex] = filteredData[dateIndex] || 0;
                        filteredData[dateIndex] += currentCount;
                        dateIndex++;
                    }
                }
                return filteredData;
            },
            normalizeDataCountryNameToMapCountryName: function (dataSourceCountryName) {
                const map = {
                    'Mainland China': 'China',
                    'UK': 'United Kingdom',
                    'US': 'United States of America'
                };
                return map[dataSourceCountryName] || dataSourceCountryName;
            },
            moveArrayEntry: function (array, from, to) {
                return array.splice(to, 0, array.splice(from, 1)[0]);
            },
            layoutMapForDate: function (dateIndex) {
                const countryTotals = this.mapCountryValues[dateIndex];
                for (const currentCountry of this.map.data.datasets[0].data) {
                    const currentCountryName = currentCountry.feature.properties.name;
                    if (!countryTotals[currentCountryName]) {
                        currentCountry.value = 0;
                        currentCountry.fraction = 0;
                        continue;
                    }
                    const value = countryTotals[currentCountryName];
                    let fraction = Math.log(value) / Math.log(this.mapHistoricalCountryHigh) * 0.6 + 0.15;
                    if (this.mapDataReference.startsWith('relative:')) {
                        fraction = value / this.mapHistoricalCountryHigh * 0.6 + 0.15;
                        if (this.mapDataReference !== 'relative:recoveries') {
                            // we need to amplify the smaller numbers
                            fraction = Math.log(value * 100) / Math.log(this.mapHistoricalCountryHigh * 100) * 0.6 + 0.15;
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
                this.layoutMapForDate(this.mapDate);
            },
            mapDataReference: function () {
                this.layoutMapForDate(this.mapDate);
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
                    }
                    denominators = [];
                    for (let i = this.mapDateMinimum; i <= this.mapDateMaximum; i++) {
                        const dateKey = dateKeys[i];
                        const totalByCountries = {};
                        for (const currentHistory of comparisonDataSource) {
                            const currentCountry = currentHistory['Country/Region'];
                            const normalizedCountryName = this.normalizeDataCountryNameToMapCountryName(currentCountry);
                            const rawDelta = currentHistory[dateKey];
                            let currentDelta = parseInt(rawDelta);
                            if (!Number.isSafeInteger(currentDelta)) {
                                currentDelta = 0;
                                console.log('Skipping map delta for entry:', currentHistory['Country/Region'], currentHistory['Province/State'], dateKey, rawDelta);
                            }
                            totalByCountries[normalizedCountryName] = totalByCountries[normalizedCountryName] || 0;
                            totalByCountries[normalizedCountryName] += currentDelta;
                        }
                        denominators.push(totalByCountries);
                    }
                }

                const countryTotals = [];
                for (let i = this.mapDateMinimum; i <= this.mapDateMaximum; i++) {
                    const dateKey = dateKeys[i];
                    const totalByCountries = {};
                    for (const currentHistory of dataSource) {
                        const currentCountry = currentHistory['Country/Region'];
                        const normalizedCountryName = this.normalizeDataCountryNameToMapCountryName(currentCountry);

                        totalByCountries[normalizedCountryName] = totalByCountries[normalizedCountryName] || 0;

                        const rawDelta = currentHistory[dateKey];
                        let currentDelta = parseInt(rawDelta);
                        if (!Number.isSafeInteger(currentDelta)) {
                            currentDelta = 0;
                            console.log('Skipping map delta for entry:', currentHistory['Country/Region'], currentHistory['Province/State'], dateKey, rawDelta);
                        }

                        if (denominators && denominators[i]) {
                            const denominator = denominators[i][normalizedCountryName];
                            if (denominator === 0) {
                                continue;
                            }
                            currentDelta /= denominator;
                        }
                        totalByCountries[normalizedCountryName] += currentDelta;
                    }
                    countryTotals.push(totalByCountries);
                }
                return countryTotals;
            },
            mapHistoricalCountryHigh: function () {
                let maximum = 0;
                const countryTotal = this.mapCountryValues[this.mapDateMaximum];
                // console.dir(countryTotal);
                for (const [key, value] of Object.entries(countryTotal)) {
                    maximum = Math.max(maximum, value);
                }
                return maximum;
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
