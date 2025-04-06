import { Device } from "homey";
import type Homey from "homey/lib/Homey";
import type { CubicDetectorMeasurement } from "../../lib/lk-types";
import type { DeviceData } from "../../lib/driver-types";
import { LkApi } from "../../lib/lk-api";
import { LeakState } from "../../lib/lk-types";
import {
  updateCapability,
  formatError,
  scheduleUpdate,
} from "../../lib/lk-utils";

const UPDATE_INTERVAL_SECONDS = 60; // Set update interval

interface DeviceSettings {
  email: string;
  password: string;
  [key: string]: string | number | boolean | undefined;
}

class CubicDetectorDevice extends Device {
  public readonly homey!: Homey;

  private api!: LkApi;
  private deviceData!: DeviceData;
  private updateTimeout!: NodeJS.Timeout;

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
    this.log("CubicDetector device has been initialized");

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
      const measurement = await this.api.getCubicDetectorMeasurement(
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

  private async updateCapabilities(measurement: CubicDetectorMeasurement) {
    try {
      const promises: Array<Promise<void> | undefined> = [];

      // Update water leak alarm
      const leakState = measurement.leak?.leakState;
      const hasLeak = leakState !== null && leakState !== LeakState.NO_LEAK;
      promises.push(updateCapability(this, "alarm_water", hasLeak ? 1 : 0));

      // Temperature
      promises.push(
        updateCapability(this, "measure_temperature", measurement.tempAmbient)
      );

      // Humidity
      if (measurement.currentHumidity != null) {
        promises.push(
          updateCapability(
            this,
            "measure_humidity",
            measurement.currentHumidity
          )
        );
      }

      // Battery
      if (measurement.currentBattery != null) {
        // Convert battery from mV to percentage if needed
        // The API seems to return values around 2900-3000 mV
        // We'll convert this to a percentage between 0-100%
        // Assuming 2500 mV is 0% and 3100 mV is 100%
        const minVoltage = 2500;
        const maxVoltage = 3100;
        const batteryVoltage = measurement.currentBattery;

        let batteryPercentage = Math.round(
          ((batteryVoltage - minVoltage) / (maxVoltage - minVoltage)) * 100
        );

        // Clamp the battery percentage between 0 and 100
        batteryPercentage = Math.max(0, Math.min(100, batteryPercentage));

        promises.push(
          updateCapability(this, "measure_battery", batteryPercentage)
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

module.exports = CubicDetectorDevice;
