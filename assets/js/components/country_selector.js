Vue.component('country-selector', {
	props: [
		'dataSet'
	],
	data: function () {
		return {
			dataSet: {}
		}
	},
	mounted: function () {
		this.dataSet['abc'] = 'def';
		console.dir(this.dataSet);
		console.dir(this.$parent.$data.selectionSets);
	},
	template: '<slot></slot>'
});
