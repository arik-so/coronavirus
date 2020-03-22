Vue.component('country-selector', {
	props: [
		'setIndex'
	],
	data: function () {
		// console.log('accessing country selector data:', this.setIndex);
		return {
			setIndex: 0,
			setData: selectionSets[this.setIndex]
		}
	},
	watch: {
		'setData.selectAll': function (newValue) {
			if (newValue) {
				this.setData.checkedCountries = Array.from(this.$parent.raw.canonicalCountries);
			} else {
				this.setData.checkedCountries = [];
			}
		},
		'setData.checkedCountries': function (newValue, oldValue) {
			const selectedCountryCount = newValue.length;
			const totalCountryCount = this.$parent.raw.countryNames.size;

			for (const countryCode of Object.keys(this.$parent.raw.countrySubdivisions)) {
				// these country codes have subdivisions

				if (newValue.includes(countryCode) && !oldValue.includes(countryCode)) {
					// has this country been added?
					this.setData.territorySelections[countryCode] = Array.from(this.$parent.raw.countrySubdivisions[countryCode]);
				} else if (!newValue.includes(countryCode) && oldValue.includes(countryCode)) {
					// has this country been removed?
					this.setData.territorySelections[countryCode] = [];
				}
			}
		},
		'setData.territorySelections': {
			deep: true,
			handler: function (newValue) {
				// console.log('old territory selections:', JSON.stringify(oldValue, null, 4));
				// console.log('new territory selections:', JSON.stringify(newValue, null, 4));
				let totalTerritoryCount = 0;
				for (const [countryCode, territoryCodes] of Object.entries(newValue)) {
					const availableTerritoryCodes = this.$parent.raw.countrySubdivisions[countryCode];
					const selectionCount = territoryCodes.length;
					const availableCount = availableTerritoryCodes.size;

					totalTerritoryCount += selectionCount;

					if (selectionCount === 0 || selectionCount === availableCount) {
						// this.setData.partialSelection[countryCode] = false;
					} else {
						// this.setData.partialSelection[countryCode] = true;
						// this.setData.partialSelection.total = true;
					}

					if (selectionCount === availableCount && !this.setData.checkedCountries.includes(countryCode)) {
						this.setData.checkedCountries.push(countryCode);
					} else if (selectionCount === 0 && this.setData.checkedCountries.includes(countryCode)) {
						console.log('removing country', countryCode);
						const index = this.setData.checkedCountries.indexOf(countryCode);
						this.setData.checkedCountries.splice(index, 1);
					}

				}

				if (totalTerritoryCount === 0 && this.setData.checkedCountries.length === 0) {
					// this.setData.partialSelection.total = false;
				}
			}
		},
		// selectAll: function (newValue) {
		// 	this.setData.selectAll = newValue;
		// },
		partialSelection: function (newValue) {
			this.setData.partialSelection = newValue;
		},
		setName: function (newValue) {
			this.setData.setName = newValue || this.setData.defaultSetName;
		}
	},
	computed: {
		selectAll: function () {
			const selectedCountryCount = this.setData.checkedCountries.length;
			const totalCountryCount = this.$parent.raw.countryNames.size;

			return (selectedCountryCount === totalCountryCount);
		},
		partialSelection: function () {
			const countrySelectionCount = this.setData.checkedCountries.length;
			const totalCountryCount = this.$parent.raw.countryNames.size;

			const selection = {
				total: false
			};

			if (countrySelectionCount > 0 && countrySelectionCount < totalCountryCount) {
				selection.total = true;
			}

			for (const [countryCode, territories] of Object.entries(this.setData.territorySelections)) {
				const territorySelectionCount = territories.length;
				const availableTerritoryCodes = this.$parent.raw.countrySubdivisions[countryCode].size;
				if (territorySelectionCount > 0 && territorySelectionCount < availableTerritoryCodes) {
					selection.total = true;
					selection[countryCode] = true;
				} else {
					selection[countryCode] = false;
				}

				// check edge cases
				//
			}
			return selection;
		},
		setName: function () {
			for (const [countryCode, territories] of Object.entries(this.setData.territorySelections)) {
				const selectionCount = territories.length;
				const availableTerritoryCodes = this.$parent.raw.countrySubdivisions[countryCode].size;

				if ((selectionCount === 1 || selectionCount === availableTerritoryCodes) && this.setData.checkedCountries.length <= 1) {
					// only one territory is selected, and up to one country is selected
					if (this.setData.checkedCountries.length === 1 && this.setData.checkedCountries[0] !== countryCode) {
						// it's a different country code, ignore
						// this.setData.setName = this.setData.defaultSetName;
						return null;
					}

					if (selectionCount === 1) {
						// a single territory is selected
						return `${this.$parent.raw.territoryNamesByCountryAndCode[countryCode][territories[0]]}, ${this.$parent.formatCountry(countryCode)}`;
					} else if (selectionCount === availableTerritoryCodes) {
						// the entire country is selected
						return this.$parent.formatCountry(countryCode);
					}

				} else if (selectionCount > 1) {
					// multiple territories are selected
					return null;
				} // if it's 0, we need to look at the next examples
			}

			const countrySelectionCount = this.setData.checkedCountries.length;
			if (countrySelectionCount === 1) {
				return this.$parent.formatCountry(this.setData.checkedCountries[0]);
			}

			return null;
		}
	},
	created: function () {
		// console.log('creating country selector');
		this.setData.selectAll = this.selectAll;
		this.setData.partialSelection = this.partialSelection;
		this.setData.setName = this.setName || this.setData.defaultSetName;
	},
	mounted: function () {
		// console.log('mounting country selector');
	},
	template: '<slot v-bind:setData="setData"></slot>'
});
