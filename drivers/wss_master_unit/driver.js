'use strict';

const Homey = require('homey');
const { getWaterStatus, doRequest } = require('../../lib/Utils');

class MasterUnitDriver extends Homey.Driver {

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

    return this.getMasterUnitData();
  }

  async getMasterUnitData() {
    let device = {};
    const url = `http://${this.homey.settings.get('ip')}/water.json`;
    this.log('Requesting thermostat data from URL:', url);

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res)
      .catch(err => this.log(err));

    if (result) {
      this.log(`Response: ${result}`);

      const status = getWaterStatus(result);
      device = {
        name: status.name,
        data: {
          name: status.name,
        },
      };
    }

    return device;
  }

}

module.exports = MasterUnitDriver;
