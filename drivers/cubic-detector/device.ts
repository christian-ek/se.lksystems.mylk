import { Device } from "homey";
import type Homey from "homey/lib/Homey";
import type { CubicDetectorMeasurement, Notification } from "../../lib/lk-types";
import type { DeviceData } from "../../lib/driver-types";
import { LkApi } from "../../lib/lk-api";
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
      // Get device measurement for temperature, humidity, battery, etc.
      const measurement = await this.api.getCubicDetectorMeasurement(
        this.deviceData.id
      );

      // Get messages for leak detection instead of using device leak state
      const messages = await this.api.getProductMessages(this.deviceData.id);

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

      await this.updateCapabilities(measurement, messages);

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

  private convertVoltageToBatteryPercentage(voltageMillivolts: number): number {
    if (voltageMillivolts >= 2880) {
      // 2880mV and above → 50–100%
      return Math.round(50 + ((voltageMillivolts - 2880) / (3300 - 2880)) * 50);
    } else if (voltageMillivolts >= 2550) {
      // 2550–2880mV → 10–50%
      return Math.round(10 + ((voltageMillivolts - 2550) / (2880 - 2550)) * 40);
    } else if (voltageMillivolts >= 2100) {
      // 2100–2550mV → 1-10%
      return Math.round(1 + ((voltageMillivolts - 2100) / (2550 - 2100)) * 9);
    } else {
      // below 2100mV → below 1%
      return 0;
    }
  }

  private async updateCapabilities(measurement: CubicDetectorMeasurement, messages: Notification[]) {
    try {
      const promises: Array<Promise<void> | undefined> = [];

      // Update water leak alarm based on specific unread message types from messaging service
      const leakMessages = messages.filter(msg => 
        !msg.isRead && msg.messageType && (
          msg.messageType === 'messaging_service.cubicdetector_flood' ||
          msg.messageType === 'messaging_service.cubicdetector_freeze'
        )
      );
      const hasLeak = leakMessages.length > 0;
      promises.push(updateCapability(this, "alarm_water", hasLeak));

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
            measurement.currentHumidity / 10
          )
        );
      }

      // Battery
      if (measurement.currentBattery != null) {
        const batteryPercentage = this.convertVoltageToBatteryPercentage(measurement.currentBattery);
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
