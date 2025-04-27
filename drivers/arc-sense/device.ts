import { Device } from "homey";
import type Homey from "homey/lib/Homey";
import type { ArcSenseMeasurement } from "../../lib/lk-types";
import type { DeviceData } from "../../lib/driver-types";
import { LkApi } from "../../lib/lk-api";
import {
  updateCapability,
  convertToApiTemperature,
  formatError,
  scheduleUpdate,
} from "../../lib/lk-utils";

const UPDATE_INTERVAL_SECONDS = 30; // Set update interval

interface DeviceSettings {
  email: string;
  password: string;
  [key: string]: string | number | boolean | undefined;
}

class ArcSenseDevice extends Device {
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
    this.log("ArcSense device has been initialized");

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

      this.registerCapabilityListener(
        "target_temperature",
        this.onCapabilityTargetTemperature.bind(this)
      );

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
      const measurement = await this.api.getArcSenseMeasurement(
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

      // Mark device as available if it was unavailable
      if (!this.getAvailable()) {
        await this.setAvailable().catch(this.error);
        this.log("Device marked as available after receiving data");
      }

      await this.updateCapabilities(measurement);

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

  private async updateCapabilities(measurement: ArcSenseMeasurement) {
    try {
      const promises: Array<Promise<void> | undefined> = [];

      // Temperature (divide by 10 to convert from API format)
      promises.push(
        updateCapability(
          this,
          "measure_temperature",
          measurement.currentTemperature != null
            ? measurement.currentTemperature / 10
            : undefined
        )
      );

      // Target Temperature (only if not paused)
      const now = Date.now();
      if (now >= this.pauseUntil) {
        promises.push(
          updateCapability(
            this,
            "target_temperature",
            measurement.desiredTemperature != null
              ? measurement.desiredTemperature / 10
              : undefined
          )
        );
      } else if (
        measurement.desiredTemperature != null &&
        this.hasCapability("target_temperature")
      ) {
        const apiTargetTemp = measurement.desiredTemperature / 10;
        if (this.getCapabilityValue("target_temperature") !== apiTargetTemp) {
          this.log(
            `Skipping target_temperature update to ${apiTargetTemp} (updates paused)`
          );
        }
      }

      // Humidity (divide by 10 to convert from API format)
      promises.push(
        updateCapability(
          this,
          "measure_humidity",
          measurement.currentHumidity != null
            ? measurement.currentHumidity / 10
            : undefined
        )
      );

      // Battery
      promises.push(
        updateCapability(this, "measure_battery", measurement.currentBattery)
      );

      // Signal Strength (RSSI)
      promises.push(
        updateCapability(
          this,
          "measure_signal_strength",
          measurement.currentRssi
        )
      );

      // Wait for all capability updates to complete
      await Promise.all(promises.filter((p) => p !== undefined));
    } catch (error) {
      this.error(`Error processing capability updates: ${formatError(error)}`);
    }
  }

  async onCapabilityTargetTemperature(value: number): Promise<void> {
    this.log(`Setting temperature to ${value}°C`);

    if (!this.api) {
      this.error("API client not initialized");
      throw new Error("API not initialized");
    }

    try {
      // Convert to API temperature format (multiply by 10)
      const apiTemp = convertToApiTemperature(value);

      // Pause updates for 30 seconds from now
      const pauseDuration = 30000; // 30 seconds in milliseconds
      const now = Date.now();
      this.pauseUntil = now + pauseDuration;
      this.log(
        `Pausing updates for ${
          pauseDuration / 1000
        } seconds while setting temperature to ${value}°C`
      );

      const success = await this.api.updateArcSenseTemperature(
        this.deviceData.id,
        apiTemp
      );

      if (!success) {
        this.error(`Failed to set temperature to ${value}°C`);
        this.pauseUntil = 0; // Reset pause if failed
        throw new Error("Failed to set target temperature");
      }

      this.log(
        `Temperature set to ${value}°C (${apiTemp}). Updates will resume automatically in ${
          pauseDuration / 1000
        } seconds.`
      );
    } catch (error) {
      this.error(`Temperature setting error: ${formatError(error)}`);
      this.pauseUntil = 0; // Reset pause if error
      throw new Error(`Temperature setting error: ${formatError(error)}`);
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

module.exports = ArcSenseDevice;
