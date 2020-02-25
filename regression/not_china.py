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

INCLUDE_CRUISE_SHIP = True
PRINT_PROGNOSIS = True
CALCULATE_PROJECTION = True

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

        if current_geography['Province/State'] == 'Diamond Princess cruise ship' and not INCLUDE_CRUISE_SHIP:
            print("Skipped cruise ship")
            continue

        if 'From Diamond Princess' in current_geography['Province/State'] and not INCLUDE_CRUISE_SHIP:
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

    # let's model the data
    def exponential(x, a, b, c): # f(x) = a*e^(b*x)+c
        return a * np.exp(b*(x-c))
        # return np.divide(a, np.add(1, np.multiply(b, np.exp(np.multiply(c, x)))))
        # return np.add(a, np.multiply(b, np.exp(np.multiply(x, c))))

    extension = 5
    end_date_delta += extension

    model_beginning_offset = 0

    if not INCLUDE_CRUISE_SHIP:
        model_beginning_offset = 28
        extension = 2

    # x_values = x_values[model_beginning_offset:]
    if CALCULATE_PROJECTION:
        modeling_cases = cases[model_beginning_offset:]
        x_value_min = model_beginning_offset
        x_value_max = len(modeling_cases) + model_beginning_offset
        x_values = range(x_value_min, x_value_max)

        exponential_params, _ = curve_fit(exponential, x_values, modeling_cases)
        print(exponential_params)

        extension_max = len(cases) + extension
        extended_range = range(model_beginning_offset, extension_max)
        extended_dates = [dates[0] + datetime.timedelta(days=delta) for delta in extended_range]
        regression_values = exponential(extended_range, *exponential_params)
        plt.plot(extended_dates, regression_values, 'r-')

        # print out deltas
        for day in x_values:
            reality = int(cases[day])
            date = extended_dates[day-model_beginning_offset].strftime("%B %d")
            if PRINT_PROGNOSIS:
                expectation = int(round(regression_values[day-model_beginning_offset]))
                delta = expectation - reality
                percentage = round(delta/reality*10000)/100
                sign = '+' if delta >= 0 else ''

                print(f'{date} true case count: {reality}; regression: {expectation} ({sign}{delta}, {sign}{percentage}%)')
            else:
                print(f'{date} case count: {reality}')

        # where future starts
        for day in range(x_value_max, extension_max):
            expectation = int(round(regression_values[day-model_beginning_offset]))
            date = extended_dates[day-model_beginning_offset].strftime("%B %d")
            print(f"{date} projection: {expectation}")

    end_date_delta = math.ceil(end_date_delta/7)*7
    end_date = start_date + datetime.timedelta(days=end_date_delta)
    ax.set_xlim(start_date, end_date)

    plt.xticks(rotation=30)
    plt.grid(True)
    plt.show()

    dir_path = pathlib.Path(__file__).parent.absolute()
    plot_path = f'{dir_path}/plots/plot.png'
    # plt.figure(dpi=300)
    # plt.savefig(plot_path, dpi=200)

days, sequence = parse_cases()
plot_cases(days, sequence)


