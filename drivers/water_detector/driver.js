'use strict';

const Homey = require('homey');
const { doRequest, getWaterDetectorStatus } = require('../../lib/Utils');

class WaterDetectorDriver extends Homey.Driver {

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

      this.log('Start requesting water detector info from LK Webserver...');

      return this.getActiveWaterDetectors(settings)
        .then(async list => {
          for (const unit of list) {
            foundDevices.push(unit);
          }
        })
        .then(() => this.saveSettings(data))
        .catch(err => {
          return Promise.reject(err);
        });
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

  async getActiveWaterDetectors(settings) {
    const url = `http://${settings.ip}/water.json`;

    this.log('Requesting list of active devices..');
    const devices = [];

    await doRequest(settings.password, url, 'GET')
      .then(res => res.units)
      .then(async list => {
        for (const unit of list) {
          if (unit.unit_type === 'detector') {
            const status = getWaterDetectorStatus(unit);
            const device = {
              name: status.name,
              settings: {
                ip: settings.ip,
                interval: settings.interval,
                password: settings.password,
              },
              data: {
                name: status.name,
                id: status.id,
              },
            };
            devices.push(device);
          }
        }
      })
      .catch(err => {
        this.log(err);
        return Promise.reject(err);
      });

    return devices;
  }

  saveSettings(data) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('password', data.password);
  }

}

module.exports = WaterDetectorDriver;
