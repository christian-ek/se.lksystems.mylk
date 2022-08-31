'use strict';

const Homey = require('homey');
const { getThermostatStatus, doRequest } = require('../../lib/Utils');

class ThermostatDriver extends Homey.Driver {

  onInit() {
  }

  async onPairListDevices() {
    if (this.homey.settings.get('ip') === '') {
      this.log('No IP in app settings.');
      throw new Error('You must add IP in app settings before running.');
    }
    if (this.homey.settings.get('password') === '') {
      this.log('No password in app settings.');
      throw new Error('You must add LK webserver password in app settings before running.');
    }
    const thermostats = [];
    this.log('Start requesting thermostat info from LK Webserver...');

    const activeThermostatIds = await this.getActiveThermostats();
    this.log(`Active thermostat IDs: ${activeThermostatIds}`);

    for (let i = 0; i < activeThermostatIds.length; i++) {
      await this.getThermostatData(activeThermostatIds[i]).then(
        res => thermostats.push(res),
      );
    }

    this.log('Thermostat data collection done!');

    // return devices when searching is done
    return thermostats;
  }

  async getActiveThermostats() {
    const url = `http://${this.homey.settings.get('ip')}/main.json`;

    this.log('Requesting list of active devices..');
    const devices = [];

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res)
      .catch(err => this.log(err));

    if (result) {
      this.log(`Response: ${result}`);
      for (let i = 0; i < result.active.length; i++) {
        if (result.active[i] === '1') {
          devices.push(i + 1);
        }
      }
    }

    this.log(`Got thermostat ids: ${devices}`);
    return devices;
  }

  async getThermostatData(id) {
    let device = {};
    const url = `http://${this.homey.settings.get('ip')}/thermostat.json?tid=${id}`;
    this.log('Requesting thermostat data from URL:', url);

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res)
      .catch(err => this.log(err));

    if (result) {
      this.log(`Response: ${result}`);

      const status = getThermostatStatus(result);
      device = {
        name: status.name,
        data: {
          name: status.name,
          id,
        },
      };
    }

    return device;
  }

}

module.exports = ThermostatDriver;
