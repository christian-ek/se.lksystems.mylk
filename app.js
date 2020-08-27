'use strict';

const Homey = require('homey');

class MyLkApp extends Homey.App {
	
	onInit() {
		this.log('MyApp is running...');
	}
	
}

module.exports = MyLkApp;