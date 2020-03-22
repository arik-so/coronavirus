Vue.component('country-selector', {
	props: [
		'setIndex'
	],
	data: function () {
		console.log('accessing country selector data:', this.setIndex);
		return {
			setIndex: 0,
			setData: selectionSets[this.setIndex]
		}
	},
	watch: {
		'setData.selectAll': function (newValue) {
			if (newValue) {
				this.setData.checkedCountries = Array.from(this.$parent.raw.canonicalCountries);
				this.setData.partialSelection.total = false;
			} else {
				this.setData.checkedCountries = [];
			}
		},
		'setData.checkedCountries': function (newValue, oldValue) {
			const selectedCountryCount = newValue.length;
			const totalCountryCount = this.$parent.raw.countryNames.size;
			if (selectedCountryCount === 0 || selectedCountryCount === totalCountryCount) {
				this.setData.selectAll = (selectedCountryCount === totalCountryCount);
				this.setData.partialSelection.total = false;
				this.setData.partialSelection.CN = false;
				this.setData.partialSelection.US = false;
			} else {
				this.setData.partialSelection.total = true;
			}

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
						this.setData.partialSelection[countryCode] = false;
					} else {
						this.setData.partialSelection[countryCode] = true;
						this.setData.partialSelection.total = true;
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
					this.setData.partialSelection.total = false;
				}
			}
		},
	},
	created: function () {
		console.log('creating country selector');
	},
	mounted: function () {
		console.log('mounting country selector');
	},
	template: '<slot v-bind:setData="setData"></slot>'
});
