// import library
const LM = require('ml-levenberg-marquardt');
// const LM = require('ml-levenberg-marquardt').default;


function sigmoidFunction([a, b, c]) {
    // return (x) => a * x + b;
    return (x) => a / (1 + b * Math.exp(c * (x)));
}

const fitSigmoid = function (yValues) {

    // function that receives the parameters and returns
    // a function with the independent variable as a parameter


    const xValues = yValues.map((value, index) => index);
    const data = {x: xValues, y: yValues};

    const initialA = Math.max(...yValues);
    const initialD = Math.floor(xValues.length/2);

    // array of initial parameter values
    const initialValues = [
        initialA, 50, -0.2
    ];

    const options = {
        damping: 1.5,
        initialValues: initialValues,
        minValues: [1, 0.01, -10],
        maxValues: [initialA*2, 200, 0],
        gradientDifference: 10e-2,
        maxIterations: 1000,
        errorTolerance: 10e-3
    };

    let fittedParams = LM(data, sigmoidFunction, options);
    const fittedSigmoid = sigmoidFunction(fittedParams.parameterValues);
    return [fittedSigmoid, fittedParams];
};

module.exports = {
    fitSigmoid
};

//
// const yValues = [547, 639, 916, 1399, 2062, 2863, 5494, 6070, 8124, 9783, 11871, 16607, 19693, 23680, 27409, 30553, 34075, 36778, 39790, 42306, 44327, 44699, 59832, 66292, 68347, 70446, 72364, 74139, 74546, 74999, 75472, 76922, 76938, 77152, 77660, 78065, 78498, 78824];
// const sigmoidOld = fitSigmoid(yValues);
// // const sigmoidOld = sigmoidFunction([80431.716919359, 13695.30647978299, 1.2899606381652462, -1445.84111846316]);
// const sigmoid = sigmoidFunction([83417.9, 59.7527, -0.231266, 0]);
// console.log('here');
