'use strict';

const Homey = require('homey');
const { getWaterStatus, doRequest } = require('../../lib/Utils');

class MasterUnitDriver extends Homey.Driver {

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

      this.log('Start requesting water master unit info from LK Webserver...');

      return this.getMasterUnitData(settings)
        .then(unit => foundDevices.push(unit))
        .then(() => this.saveSettings(data))
        .catch(err => {
          return Promise.reject(err);
        });
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

  async getMasterUnitData(settings) {
    const url = `http://${settings.ip}/water.json`;
    this.log('Requesting thermostat data from URL:', url);

    return doRequest(settings.password, url, 'GET')
      .then(res => {
        const status = getWaterStatus(res);
        return {
          name: status.name,
          settings: {
            ip: settings.ip,
            interval: settings.interval,
            password: settings.password,
          },
          data: {
            name: status.name,
          },
        };
      })
      .catch(err => {
        this.log(err);
        return Promise.reject(err);
      });
  }

  saveSettings(data) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('password', data.password);
  }

}

module.exports = MasterUnitDriver;
