'use strict';

const Homey = require('homey');
const { getWaterDetectorStatus, doRequest } = require('../../lib/Utils');

class WaterDetectorDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();
    const updateInterval = Number(this.getSetting('interval')) * 1000;
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.getName()}][${device.id}]`, 'Connected to device');
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');
    const url = `http://${this.getSetting('ip')}/water.json`;

    this.log('Requesting device information:', url);

    await doRequest(this.getSetting('password'), url, 'GET')
      .then(res => res.units)
      .then(list => {
        for (const unit of list) {
          if (unit.id === device.id) {
            const status = getWaterDetectorStatus(unit);

            this.setCapabilityValue('measure_temperature', status.temperature).catch(this.error);
            this.setCapabilityValue('alarm_battery', status.alarm_battery).catch(this.error);
            this.setCapabilityValue('alarm_water', status.alarm_water).catch(this.error);
          }
        }
      })
      .catch(err => this.log(err));
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

module.exports = WaterDetectorDevice;
