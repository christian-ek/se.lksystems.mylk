'use strict';

const Homey = require('homey');
const { getThermostatStatus, doRequest } = require('../../lib/Utils');

class ThermostatDriver extends Homey.Driver {

  onInit() {
  }

  // Pairing
  onPair(session) {
    this.log('Pairing started');

    session.setHandler('getSettings', async () => {
      return {
        ip: this.homey.settings.get('ip'),
        password: this.homey.settings.get('password'),
      };
    });

    const foundDevices = [];

    session.setHandler('connect', async data => {
      const settings = data;

      this.log('Start requesting thermostat info from LK Webserver...');

      return this.getActiveThermostats(settings)
        .then(async list => {
          for (const id of list) {
            foundDevices.push(await this.getDeviceData(id, settings));
          }
        })
        .then(() => this.saveSettings(data))
        .catch(err => {
          this.log(err);
          return Promise.reject(err);
        });
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

  saveSettings(data) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('password', data.password);
  }

  async getActiveThermostats(settings) {
    const url = `http://${settings.ip}/main.json`;

    this.log('Requesting list of active devices..');
    const devices = [];

    const result = await doRequest(settings.password, url, 'GET')
      .then(res => res)
      .catch(err => {
        this.log(err);
        return Promise.reject(err);
      });

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

  async getDeviceData(id, settings) {
    let device = {};
    const url = `http://${settings.ip}/thermostat.json?tid=${id}`;
    this.log('Requesting thermostat data from URL:', url);

    const result = await doRequest(settings.password, url, 'GET')
      .then(res => res)
      .catch(err => {
        this.log(err);
        return Promise.reject(err);
      });

    if (result) {
      this.log('Response:', result);

      const status = getThermostatStatus(result);
      device = {
        name: status.name,
        settings: {
          ip: settings.ip,
          interval: settings.interval,
          password: settings.password,
        },
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
