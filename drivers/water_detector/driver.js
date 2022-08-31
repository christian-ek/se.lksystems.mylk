'use strict';

const Homey = require('homey');
const { doRequest, getWaterDetectorStatus } = require('../../lib/Utils');

class WaterDetectorDriver extends Homey.Driver {

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
    const waterDetectors = await this.getActiveWaterDetectors();
    this.log(`Active Water Detector IDs: ${waterDetectors}`);

    // return devices when searching is done
    return waterDetectors;
  }

  async getActiveWaterDetectors() {
    const url = `http://${this.homey.settings.get('ip')}/water.json`;

    this.log('Requesting list of active devices..');
    const devices = [];

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res.units)
      .catch(err => this.log(err));

    if (result) {
      this.log(`Response: ${result}`);
      for (let i = 0; i < result.length; i++) {
        let device = {};

        if (result[i].unit_type === 'detector') {
          const status = getWaterDetectorStatus(result[i]);
          device = {
            name: status.name,
            data: {
              name: status.name,
              id: status.id,
            },
          };
          devices.push(device);
        }
      }
    }

    return devices;
  }

}

module.exports = WaterDetectorDriver;
