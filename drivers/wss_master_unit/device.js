'use strict';

const Homey = require('homey');
const { doRequest, getWaterStatus } = require('../../lib/Utils');

class MasterUnitDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000 * 60;
    this.log(`[${this.getName()}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}]`, 'Connected to device');
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    this.log(`[${this.getName()}]`, 'Refresh device');
    const url = `http://${this.homey.settings.get('ip')}/water.json`;

    this.log('Requesting device information:', url);

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res)
      .catch(err => this.log(err));

    if (result) {
      const status = getWaterStatus(result);

      this.setCapabilityValue('measure_pressure', status.pressure).catch(this.error);
      this.setCapabilityValue('onoff', status.valve).catch(this.error);
    }
  }

  async onCapabilityOnOff(value) {
    try {
      await this.setCapabilityValue('onoff', value);
      await this.updateCapabilityValues('onoff');
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

  // eslint-disable-next-line consistent-return
  async updateCapabilityValues(capability) {
    try {
      const urlBase = `http://${this.homey.settings.get('ip')}`;
      let url;

      const timestamp = Math.floor(Date.now() / 1000);

      // eslint-disable-next-line default-case
      switch (capability) {
        case 'onoff':
          url = `${urlBase}/update.cgi?water_on=${Number(this.getCapabilityValue('onoff'))}&_=${timestamp}`;
          if (Number(this.getCapabilityValue('onoff'))) {
            const resetUrl = `${urlBase}/update.cgi?water_on=4&_=${timestamp}`;
            this.log('Sending alarm reset before turning on the water:', resetUrl);
            await doRequest(this.homey, resetUrl, 'GET')
              .then(res => res)
              .catch(err => this.log(err));
          }
          break;
      }

      this.log('Requesting device update:', url);
      await doRequest(this.homey, url, 'GET')
        .then(res => res)
        .catch(err => this.log(err));
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

  onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
  }

  onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    const updateInterval = Number(newInterval) * 1000 * 60;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    const { interval } = this;
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval} min and creating new ${newSettings.interval} min`);
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  onDeleted() {
    const { interval, device } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = MasterUnitDevice;
