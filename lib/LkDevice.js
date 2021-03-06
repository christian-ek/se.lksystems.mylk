'use strict';

const Homey = require('homey');
const { getStatus, doRequest } = require('./Utils');

class LkDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000 * 60;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');
    const urlBase = `http://${this.homey.settings.get('ip')}/thermostat.json?tid=`;
    const url = urlBase + device.id;

    this.log('Requesting device information:', url);

    const result = await doRequest(this.homey, url, 'GET');
    if (result) {
      const status = getStatus(result);

      this.setCapabilityValue('target_temperature', status.target_temperature).catch(this.error);
      this.setCapabilityValue('measure_temperature', status.measure_temperature).catch(this.error);
      this.setCapabilityValue('measure_battery', status.battery).catch(this.error);
    }
  }

  async onCapabilitySetTemperature(value) {
    try {
      await this.setCapabilityValue('target_temperature', value);
      await this.updateCapabilityValues('target_temperature');
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

  // eslint-disable-next-line consistent-return
  async updateCapabilityValues(capability) {
    const { device } = this;
    try {
      const urlBase = `http://${this.homey.settings.get('ip')}`;
      let url;

      const timestamp = Math.floor(Date.now() / 1000);

      // eslint-disable-next-line default-case
      switch (capability) {
        case 'target_temperature':
          url = `${urlBase}/update.cgi?tid=${device.id}&set_room_deg=${this.getCapabilityValue('target_temperature').toFixed(1) * 100}&_=${timestamp}`;
          break;
      }

      this.log('Requesting device update:', url);
      await doRequest(this.homey, url, 'GET');
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

module.exports = LkDevice;
