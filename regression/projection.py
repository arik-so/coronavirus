import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit


def fit(old_method_data, new_method_data):

    def sigmoid(x, a, b, c): # a / (1 + b * e ^ (cx))
        return np.divide(a, np.add(1, np.multiply(b, np.exp(np.multiply(c, x)))))
        # return np.add(a, np.multiply(b, np.exp(np.multiply(x, c))))

    def line(x, a):
        return np.divide(a, np.add(1, x))

    cases_old_method = old_method_data
    old_method_case_count = len(cases_old_method)

    x_data = range(0, old_method_case_count)

    initial_params = [2000., 50., -1.]
    old_method_sigmoid_params, _ = curve_fit(sigmoid, x_data, cases_old_method, p0=initial_params)

    cases_new_method = new_method_data
    extension_x = range(old_method_case_count, old_method_case_count + len(cases_new_method))
    plt.scatter(extension_x, cases_new_method, c='orange')

    initial_params_new = [70000., 1000000.0, -1.0]
    # new_method_sigmoid_params, _ = curve_fit(sigmoid, extension_x, cases_new_method, p0=initial_params_new)
    relevant_new_method_cases = cases_new_method[1:]
    new_method_sigmoid_params, _ = curve_fit(sigmoid, extension_x[1:], relevant_new_method_cases, p0=initial_params_new)

    # fig = plt.figure(dpi=1200)
    # ax = fig.gca()
    # ax.set_xticks(np.arange(0, 30, 1))
    # ax.set_yticks(np.arange(0, 70000, 5000))
    plt.grid()

    plt.scatter(x_data, cases_old_method, c='orange')

    projection_range = range(0, 41)
    old_method_case_projection = sigmoid(projection_range, *old_method_sigmoid_params)
    new_method_case_reflection = sigmoid(projection_range, *new_method_sigmoid_params)
    plt.plot(projection_range, old_method_case_projection, 'r-')
    plt.plot(projection_range, new_method_case_reflection, 'r--')

    # future = range(old_method_case_count, 30)
    # plt.scatter(future, sigmoid(future, *old_method_sigmoid_params), c='blue')


    def sigmoid_adjustment(x, a):
        # return np.add(a, np.multiply(x, b))
        return np.multiply(x, a) # assume proportional scaling only

    def opinionated_sigmoid_adjustment(x, a, b):
        return np.multiply(a, sigmoid(np.multiply(x, b), *old_method_sigmoid_params))

    # Let's take the future cases that we have adjustments for and scale them to fit the new cases
    # scaling_adjustment_projected_cases are the cases projected based on the old methodology for days for which we already have the actual factual numbers
    scaling_adjustment_projected_cases = old_method_case_projection[old_method_case_count:old_method_case_count + len(cases_new_method)]
    # scaling_adjustments, _ = curve_fit(sigmoid_adjustment, scaling_adjustment_projected_cases, cases_new_method)

    # Experimenting with adjusting only based on a subselection of the new information
    # scaling_adjustments, _ = curve_fit(sigmoid_adjustment, scaling_adjustment_projected_cases[1:], cases_new_method[1:])
    scaling_adjustments, _ = curve_fit(opinionated_sigmoid_adjustment, extension_x[1:], cases_new_method[1:])

    # revised_cases = sigmoid_adjustment(old_method_case_projection, *scaling_adjustments)
    revised_cases = opinionated_sigmoid_adjustment(projection_range, *scaling_adjustments)

    # Disable the green curve for the time being
    # plt.plot(projection_range, revised_cases, 'g--')


    print("params:", new_method_sigmoid_params)
    print("projection:", sigmoid(21, *old_method_sigmoid_params))
    print("projection:", sigmoid(22, *old_method_sigmoid_params))
    print("projection:", sigmoid(23, *old_method_sigmoid_params))

    new_methodology_beginning = extension_x[0]
    today = extension_x[-1]

    for day in range(new_methodology_beginning, today+1):
        expectation_composite = int(round(revised_cases[day]))
        expectation_new = int(round(new_method_case_reflection[day]))
        expectation = expectation_new
        reality = int(new_method_data[day - today-1])
        delta = reality - expectation
        percentage = round(delta/reality*10000)/100
        sign = '+' if delta >= 0 else ''
        print(f'Day {day} revision: {expectation}; reality: {reality} ({sign}{delta}, {sign}{percentage}%)')

    for day in range(today+1, today+11):
        expectation_composite = int(round(revised_cases[day]))
        expectation_new = int(round(new_method_case_reflection[day]))
        expectation = expectation_new
        print(f"Day {day} projection: {expectation}")

    plt.show()


fit(
    [580, 845, 1317, 2015, 2800, 4581, 6058, 7813, 9821, 11948, 14551, 17389, 20628, 24553, 28276, 31439,
        34876, 37552, 40553, 43099, 45170],
    # [59283, 64439, 66900]
    [59283, 64439, 67100, 69197, 71329, 73332, 75198, 75700] #, 67100]
)
