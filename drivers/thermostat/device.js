'use strict';

const Homey = require('homey');
const { getThermostatStatus, doRequest } = require('../../lib/Utils');

class ThermostatDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
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
    const urlBase = `http://${this.getSetting('ip')}/thermostat.json?tid=`;
    const url = urlBase + device.id;

    this.log('Requesting device information:', url);

    await doRequest(this.getSetting('password'), url, 'GET')
      .then(res => {
        const status = getThermostatStatus(res);

        this.setCapabilityValue('target_temperature', status.target_temperature).catch(this.error);
        this.setCapabilityValue('measure_temperature', status.measure_temperature).catch(this.error);
        this.setCapabilityValue('measure_battery', status.battery).catch(this.error);
      })
      .catch(err => this.log(err));
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
      const urlBase = `http://${this.getSetting('ip')}`;
      let url;

      const timestamp = Math.floor(Date.now() / 1000);

      // eslint-disable-next-line default-case
      switch (capability) {
        case 'target_temperature':
          url = `${urlBase}/update.cgi?tid=${device.id}&set_room_deg=${this.getCapabilityValue('target_temperature').toFixed(1) * 100}&_=${timestamp}`;
          break;
      }

      this.log('Requesting device update:', url);
      await doRequest(this.getSetting('password'), url, 'GET')
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
    const updateInterval = Number(newInterval) * 1000;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    const { interval } = this;
    for (const name of changedKeys) {
      /* Log setting changes except for password */
      if (name !== 'password') {
        this.log(`Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`);
      }
    }
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`);
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

module.exports = ThermostatDevice;
