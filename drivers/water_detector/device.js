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
    const url = `http://${this.homey.settings.get('ip')}/water.json`;

    this.log('Requesting device information:', url);

    const result = await doRequest(this.homey, url, 'GET')
      .then(res => res.units)
      .catch(err => this.log(err));

    if (result) {
      for (let i = 0; i < result.length; i++) {
        if (result[i].id === device.id) {
          const status = getWaterDetectorStatus(result[i]);

          this.setCapabilityValue('measure_temperature', status.temperature).catch(this.error);
          this.setCapabilityValue('alarm_battery', status.alarm_battery).catch(this.error);
          this.setCapabilityValue('alarm_water', status.alarm_water).catch(this.error);
        }
      }
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

module.exports = WaterDetectorDevice;
