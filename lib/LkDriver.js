'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const { getStatus } = require('./Utils');

class LkDriver extends Homey.Driver {

  onInit() {
  }

  async onPairListDevices() {
    const devices = [];
    this.log('Start requesting thermostat info from LK Webserver...');

    await this.collectThermostatData().then(res => {
      this.log('Thermostat data collection done!');

      // Add thermostats to devices
      Array.prototype.push.apply(devices, res);
    });

    // return devices when searching is done
    return devices;
  }

  async collectThermostatData() {
    const thermostats = [];

    return this.getThermostatInfo(1).then(res => {
      if (res.data.active === '1') {
        thermostats.push(res);
      }
      return this.getThermostatInfo(2);
    }).then(res => {
      if (res.data.active === '1') {
        thermostats.push(res);
      }
      return this.getThermostatInfo(3);
    }).then(res => {
      if (res.data.active === '1') {
        thermostats.push(res);
      }
      return this.getThermostatInfo(4);
    })
      .then(res => {
        if (res.data.active === '1') {
          thermostats.push(res);
        }
        return this.getThermostatInfo(5);
      })
      .then(res => {
        if (res.data.active === '1') {
          thermostats.push(res);
        } return thermostats;
      });
  }

  async getThermostatInfo(i) {
    const urlBase = `http://${this.homey.settings.get('ip')}/thermostat.json?tid=`;
    const password = this.homey.settings.get('password');
    const auth = `Basic ${Buffer.from(`lk:${password}`).toString('base64')}`;
    const url = urlBase + i;
    this.log('Requesting thermostat info:', url);
    let device = {};

    try {
      const response = await fetch(`${url}`, {
        method: 'GET',
        headers: {
          Authorization: auth,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const status = getStatus(result);
        device = {
          name: status.name,
          data: {
            name: status.name,
            id: i,
            active: status.active,
            battery: status.battery,
            measure_temperature: status.measure_temperature,
            target_temperature: status.target_temperature,
            mode: status.mode,
          },
        };
      }
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
    return device;
  }

}

module.exports = LkDriver;
