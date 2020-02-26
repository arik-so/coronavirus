import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit
import csv
import pathlib
import matplotlib.dates as mdates
import math
import dateutil
import datetime
from dateutil.parser import parse

PRINT_PROGNOSIS = True

def parse_cases():
    dir_path = pathlib.Path(__file__).parent.absolute()
    csv_path = f'{dir_path}/covid_confirmed.csv'

    days = []
    geographies = []
    with open(csv_path) as csv_file:
        label_reader = csv.reader(csv_file)
        labels = next(label_reader)
        days = labels[4:]
        csv_reader = csv.DictReader(csv_file, fieldnames=labels)
        for row in csv_reader:
            geographies.append(row)

    time_sequence = [0] * len(days)

    for current_geography in geographies:
        if current_geography['Country/Region'] != 'US':
            pass
            # continue


        if current_geography['Country/Region'] == 'Mainland China':
            continue
        if current_geography['Country/Region'] == 'Macau':
            continue
        if current_geography['Country/Region'] == 'Hong Kong':
            continue

        if current_geography['Province/State'] == 'Diamond Princess cruise ship':
            print("Skipped cruise ship")
            continue

        if 'From Diamond Princess' in current_geography['Province/State']:
            print("Skipped _from_ cruise ship")
            continue

        day_index = 0
        for current_day in days:
            count = int(current_geography[current_day])
            time_sequence[day_index] += count
            day_index += 1

    # return non-Chinese cases by day
    return days, time_sequence

def plot_cases(days, cases):
    dates = [parse(x) for x in days]

    days = mdates.DayLocator()   # every year
    months = mdates.WeekdayLocator(byweekday=dateutil.rrule.SU)  # every month
    yearsFmt = mdates.DateFormatter('%B %d')

    fig, ax = plt.subplots()
    ax.xaxis.set_major_locator(months)
    ax.xaxis.set_major_formatter(yearsFmt)
    ax.xaxis.set_minor_locator(days)

    start_date = parse("1/19/20")
    end_date_delta = len(cases) + 5

    plt.scatter(dates, cases, c='orange')

    model_beginning_offset = 28
    data_x = range(0, len(cases))
    linear_x = range(0, model_beginning_offset)
    exponential_x = range(0, len(data_x))

    def linear(x, a, b):
        return a * x + b

    def exponential(x, a, b, c): # f(x) = a*e^(b*x)+c
        # return np.divide(a, np.add(1, np.multiply(b, np.exp(np.multiply(c, x)))))
        # return np.add(a, np.multiply(b, np.exp(np.multiply(x, c))))
        # return a * x * x + b
        return a * np.exp(b*(x+c))

    def composite(x, a, b, c, d, e):
        return a + b * x + c * np.exp(d*x + e)

    def calculate_linear_regression():
        # we need to project the first 28 cases days to a linear scale

        linear_x_first = linear_x[0]
        linear_x_last = linear_x[-1]
        linear_data = cases[linear_x_first:linear_x_last+1]

        params, _ = curve_fit(linear, linear_x, linear_data)
        return params

    linear_regression_params = calculate_linear_regression()

    # let's extend our dates for easier mapping x -> date
    extrapolation_size = 2
    extrapolation_max = data_x[-1] + extrapolation_size
    extrapolation_x = range(data_x[0], extrapolation_max + 1)
    extended_dates = [dates[0] + datetime.timedelta(days=delta) for delta in extrapolation_x]


    # let's plot the linear data
    linear_extrapolation_x = range(linear_x[0], data_x[-1]+1)
    linear_extrapolation_y = linear(linear_extrapolation_x, *linear_regression_params)
    linear_extrapolation_dates = extended_dates[linear_extrapolation_x[0]:linear_extrapolation_x[-1]+1]
    # plt.plot(linear_extrapolation_dates, linear_extrapolation_y, 'g-')


    # now, let's subtract the linear extrapolation from the case values
    non_linear_filtered_cases = np.maximum(0, np.round(np.subtract(cases, linear_extrapolation_y)))
    # plt.scatter(dates, non_linear_filtered_cases, c='red')

    # and now we can calculate an exponential regression based on the result
    def calculate_exponential_regression():
        exponential_x_first = exponential_x[0]
        exponential_x_last = exponential_x[-1]
        exponential_data = non_linear_filtered_cases[exponential_x_first:exponential_x_last+1]

        exponential_params, _ = curve_fit(exponential, exponential_x, exponential_data)
        return exponential_params

    exponential_params = calculate_exponential_regression()
    exponential_extrapolation_x = range(exponential_x[0], exponential_x[-1] + extrapolation_size + 1)
    exponential_extrapolation_y = exponential(exponential_extrapolation_x, *exponential_params)
    exponential_extrapolation_dates = extended_dates[exponential_extrapolation_x[0]:exponential_extrapolation_x[-1]+1]
    # plt.plot(exponential_extrapolation_dates, exponential_extrapolation_y, 'b-')


    # and now we can calculate an exponential regression based on the result
    def calculate_composite_regression():
        composite_x = data_x
        composite_data = cases

        params, _ = curve_fit(composite, composite_x, composite_data)
        return params



    recombined_extrapolation_y = np.add(exponential(extrapolation_x, *exponential_params), linear(extrapolation_x, *linear_regression_params))
    # plt.plot(extended_dates, recombined_extrapolation_y, c='blue')


    composite_params = calculate_composite_regression()
    composite_extrapolation_x = range(0, data_x[-1] + 1 + extrapolation_size)
    composite_extrapolation_y = composite(composite_extrapolation_x, *composite_params)
    composite_extrapolation_dates = extended_dates[composite_extrapolation_x[0]:composite_extrapolation_x[-1]+1]
    plt.plot(composite_extrapolation_dates, composite_extrapolation_y, c='red')


    end_date_delta += extrapolation_size
    end_date_delta = math.ceil(end_date_delta/7)*7
    end_date = start_date + datetime.timedelta(days=end_date_delta)
    ax.set_xlim(start_date, end_date)

    plt.xticks(rotation=30)
    # plt.yscale('log')
    plt.grid(True)
    plt.show()






    return

    extension = 2
    end_date_delta += extension


    regression_values = exponential(extended_range, *exponential_params)
    plt.plot(extended_dates, regression_values, 'r-')






    dir_path = pathlib.Path(__file__).parent.absolute()
    plot_path = f'{dir_path}/plots/plot.png'
    # plt.figure(dpi=300)
    # plt.savefig(plot_path, dpi=200)

days, sequence = parse_cases()
plot_cases(days, sequence)


