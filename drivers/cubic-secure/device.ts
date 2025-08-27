import { Device } from "homey";
import type Homey from "homey/lib/Homey";
import type {
  CubicSecureConfig,
  CubicSecureMeasurement,
  Notification,
} from "../../lib/lk-types";
import type { DeviceData } from "../../lib/driver-types";
import { LkApi } from "../../lib/lk-api";
import { ValveState } from "../../lib/lk-types";
import {
  updateCapability,
  formatError,
  scheduleUpdate,
} from "../../lib/lk-utils";

const UPDATE_INTERVAL_SECONDS = 20; // Set update interval

interface DeviceSettings {
  email: string;
  password: string;
  [key: string]: string | number | boolean | undefined;
}

class CubicSecureDevice extends Device {
  public readonly homey!: Homey;

  private api!: LkApi;
  private deviceData!: DeviceData;
  private updateTimeout!: NodeJS.Timeout;
  private pauseUntil = 0;

  // Override log method to include device identifier
  log(...args: unknown[]) {
    if (this.deviceData?.id) {
      super.log(`[${this.getName()}][${this.deviceData.id}]`, ...args);
    } else {
      super.log(`[${this.getName()}]`, ...args);
    }
  }

  // Override error method to include device identifier
  error(...args: unknown[]) {
    if (this.deviceData?.id) {
      super.error(`[${this.getName()}][${this.deviceData.id}]`, ...args);
    } else {
      super.error(`[${this.getName()}]`, ...args);
    }
  }

  async onInit() {
    this.log("CubicSecure device has been initialized");

    try {
      this.deviceData = this.getData();
      this.log("Device loaded");

      const settings = this.getSettings() as DeviceSettings;
      if (!settings.email || !settings.password) {
        this.error(
          "Email or password missing in settings during initialization."
        );
        await this.setUnavailable("Missing credentials").catch(this.error);
        return;
      }

      this.api = new LkApi(settings.email, settings.password, this.homey);

      await this.api.validateToken().catch(async (err) => {
        this.error(`Initial token validation failed: ${err.message}`);
        try {
          await this.api.login();
          this.log("Login successful after failed initial token validation.");
        } catch (loginErr) {
          this.error(
            `Login failed during initialization: ${
              loginErr instanceof Error ? loginErr.message : String(loginErr)
            }`
          );
          await this.setUnavailable("Invalid credentials").catch(this.error);
          return;
        }
      });

      // Register capability listeners
      this.registerCapabilityListener(
        "onoff",
        this.onCapabilityOnOff.bind(this)
      );

      // Ensure the device has all required capabilities
      if (
        !this.hasCapability("measure_temperature.ambient") &&
        this.hasCapability("measure_temperature")
      ) {
        // Migration: rename legacy capability to new sub-capability
        await this.removeCapability("measure_temperature");
        await this.addCapability("measure_temperature.ambient");
      }

      if (!this.hasCapability("measure_temperature.water")) {
        await this.addCapability("measure_temperature.water");
      }

      // Migrate water consumption capabilities
      if (
        !this.hasCapability("meter_water.day") &&
        this.hasCapability("measure_water")
      ) {
        await this.removeCapability("measure_water");
        await this.addCapability("meter_water.day");
      }

      if (
        !this.hasCapability("meter_water.total") &&
        this.hasCapability("meter_water")
      ) {
        await this.removeCapability("meter_water");
        await this.addCapability("meter_water.total");
      }

      await this.fetchDeviceData();

      await this.setAvailable().catch(this.error);
    } catch (error) {
      this.error(`Error during onInit: ${formatError(error)}`);
      await this.setUnavailable("Initialization failed").catch(this.error);
    }
  }

  private async fetchDeviceData() {
    // Clear any existing timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Check if updates are paused
    const now = Date.now();
    if (now < this.pauseUntil) {
      const remainingPauseTime = Math.ceil((this.pauseUntil - now) / 1000);
      this.log(
        `Updates paused for another ${remainingPauseTime} seconds, skipping data fetch`
      );

      this.updateTimeout = scheduleUpdate(
        this,
        this.homey,
        this.fetchDeviceData.bind(this),
        UPDATE_INTERVAL_SECONDS
      );
      return;
    }

    if (!this.api) {
      this.error("API client not initialized");
      this.updateTimeout = scheduleUpdate(
        this,
        this.homey,
        this.fetchDeviceData.bind(this),
        UPDATE_INTERVAL_SECONDS
      );
      return;
    }

    try {
      const measurement = await this.api.getCubicSecureMeasurement(
        this.deviceData.id
      );

      if (!measurement) {
        this.log("No measurement data received - device may be offline");
        this.updateTimeout = scheduleUpdate(
          this,
          this.homey,
          this.fetchDeviceData.bind(this),
          UPDATE_INTERVAL_SECONDS
        );
        return;
      }

      // Also fetch configuration to get valve state
      const configuration = await this.api.getCubicSecureConfiguration(
        this.deviceData.id
      );

      // Get messages for leak detection instead of using device leak state
      const messages = await this.api.getProductMessages(this.deviceData.id);

      // Mark device as available if it was unavailable
      if (!this.getAvailable()) {
        await this.setAvailable().catch(this.error);
        this.log("Device marked as available after receiving data");
      }

      await this.updateCapabilities(measurement, configuration, messages);

      // Schedule the next update
      this.updateTimeout = scheduleUpdate(
        this,
        this.homey,
        this.fetchDeviceData.bind(this),
        UPDATE_INTERVAL_SECONDS
      );
    } catch (error) {
      this.error(`Error fetching data: ${formatError(error)}`);
      await this.setUnavailable("Failed to fetch device data").catch(
        this.error
      );

      // If there was an error, try again after a shorter delay
      this.updateTimeout = scheduleUpdate(
        this,
        this.homey,
        this.fetchDeviceData.bind(this),
        Math.max(10, UPDATE_INTERVAL_SECONDS / 2)
      );
    }
  }

  private async updateCapabilities(
    measurement: CubicSecureMeasurement,
    configuration: CubicSecureConfig,
    messages: Notification[]
  ) {
    try {
      const promises: Array<Promise<void> | undefined> = [];

      // Update water leak alarm based on specific unread message types from messaging service
      const leakMessages = messages.filter(msg => 
        !msg.isRead && msg.messageType && (
          msg.messageType === 'messaging_service.cubicsecure_leak_large' ||
          msg.messageType === 'messaging_service.cubicsecure_leak_medium' ||
          msg.messageType === 'messaging_service.cubicsecure_leak_pressure' ||
          msg.messageType === 'messaging_service.cubicsecure_leak_small'
        )
      );
      const hasLeak = leakMessages.length > 0;
      promises.push(updateCapability(this, "alarm_water", hasLeak));

      // Enable or disable the onoff capability based on leak state
      if (hasLeak) {
        // There's a leak - disable the onoff capability
        this.log("Leak detected - disabling valve control");
        promises.push(
          this.setCapabilityOptions("onoff", { disabled: true }).catch(
            this.error
          )
        );
      } else {
        // No leak - ensure the onoff capability is enabled
        promises.push(
          this.setCapabilityOptions("onoff", { disabled: false }).catch(
            this.error
          )
        );
      }

      // Update on/off based on valve state - pass boolean directly instead of 0/1
      // Only update if not in pause state
      const now = Date.now();
      if (configuration?.valveState && now >= this.pauseUntil) {
        const isOpen = configuration.valveState === ValveState.OPEN;
        promises.push(updateCapability(this, "onoff", isOpen));
      } else if (configuration?.valveState && this.hasCapability("onoff")) {
        const isOpen = configuration.valveState === ValveState.OPEN;
        if (this.getCapabilityValue("onoff") !== isOpen) {
          this.log(
            `Skipping onoff update to ${
              isOpen ? "open" : "closed"
            } (updates paused)`
          );
        }
      }

      // Surrounding/Ambient temperature
      promises.push(
        updateCapability(
          this,
          "measure_temperature.ambient",
          measurement.tempAmbient
        )
      );

      // Water temperature
      if (measurement.tempWaterAverage != null) {
        promises.push(
          updateCapability(
            this,
            "measure_temperature.water",
            measurement.tempWaterAverage
          )
        );
      }

      // Water pressure
      if (measurement.waterPressure != null) {
        // Convert to appropriate units if needed (assuming API returns in kPa)
        const pressureInBar = measurement.waterPressure / 1000;
        promises.push(
          updateCapability(this, "measure_pressure", pressureInBar)
        );
      }

      // Water consumption daily
      if (measurement.volumeTotalDay != null) {
        promises.push(
          updateCapability(this, "meter_water.day", measurement.volumeTotalDay)
        );
      }

      // Total water consumption
      if (measurement.volumeTotal != null) {
        promises.push(
          updateCapability(this, "meter_water.total", measurement.volumeTotal)
        );
      }

      // Signal strength
      if (measurement.rssi != null) {
        promises.push(
          updateCapability(this, "measure_signal_strength", measurement.rssi)
        );
      }

      // Wait for all capability updates to complete
      await Promise.all(promises.filter((p) => p !== undefined));
    } catch (error) {
      this.error(`Error processing capability updates: ${formatError(error)}`);
    }
  }

  async onCapabilityOnOff(value: boolean): Promise<void> {
    this.log(`Setting valve to ${value ? "open" : "closed"}`);

    if (!this.api) {
      this.error("API client not initialized");
      throw new Error("API not initialized");
    }

    try {
      // Pause updates for 30 seconds from now
      const pauseDuration = 30000; // 30 seconds in milliseconds
      const now = Date.now();
      this.pauseUntil = now + pauseDuration;
      this.log(
        `Pausing updates for ${
          pauseDuration / 1000
        } seconds while setting valve to ${value ? "open" : "closed"}`
      );

      const valveState = value ? ValveState.OPEN : ValveState.CLOSED;
      const success = await this.api.updateCubicSecureValveState(
        this.deviceData.id,
        valveState
      );

      if (!success) {
        this.error(`Failed to set valve to ${value ? "open" : "closed"}`);
        this.pauseUntil = 0; // Reset pause if failed
        throw new Error("Failed to set valve state");
      }

      this.log(
        `Valve set to ${
          value ? "open" : "closed"
        }. Updates will resume automatically in ${
          pauseDuration / 1000
        } seconds.`
      );
    } catch (error) {
      this.error(`Valve setting error: ${formatError(error)}`);
      this.pauseUntil = 0; // Reset pause if error
      throw new Error(`Valve setting error: ${formatError(error)}`);
    }
  }

  async onAdded() {
    this.log("Device has been added");
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: DeviceSettings;
    newSettings: DeviceSettings;
    changedKeys: string[];
  }): Promise<string> {
    this.log("Updating device settings");

    // Log changes (except password)
    for (const key of changedKeys) {
      if (key === "password") {
        this.log("Password changed");
      } else {
        this.log(
          `Setting '${key}' changed from '${oldSettings[key]}' to '${newSettings[key]}'`
        );
      }
    }

    // Credentials changed - user needs to restart the app
    if (changedKeys.includes("email") || changedKeys.includes("password")) {
      this.log("Credentials changed - will take effect after app restart");
      return "Settings saved. Restart the app for the new credentials to take effect.";
    }

    return "Settings saved successfully";
  }

  async onRenamed(name: string) {
    this.log(`Device renamed to ${name}`);
  }

  async onDeleted() {
    this.log("Device has been deleted");
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.log("Cleared update timeout");
    }
  }
}

module.exports = CubicSecureDevice;
