import { Device } from "homey";
import type { ArcSenseMeasurement } from "../../lib/lk-types";
import type { DeviceData, HomeyWithSettings } from "../../lib/driver-types";
import { LkApi } from "../../lib/lk-api";

interface DeviceSettings {
  email: string;
  password: string;
  interval: number;
  apiHost?: string;
  [key: string]: string | number | boolean | undefined;
}

interface HomeyDevice extends Device {
  homey: HomeyWithSettings;
}

export default class ArcSenseDevice extends Device {
  private api!: LkApi;
  private deviceData!: DeviceData;
  private updateInterval!: NodeJS.Timeout;
  private pauseUpdates = false;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log("ArcSense device has been initialized");

    this.deviceData = this.getData();
    this.log(`Device loaded: ${this.getName()} (ID: ${this.deviceData.id})`);

    // Initialize the API with the stored credentials
    const settings = this.getSettings() as DeviceSettings;
    this.api = new LkApi(
      settings.email,
      settings.password,
      (this as unknown as HomeyDevice).homey,
      settings.apiHost
    );

    // Set up capability listeners
    this.registerCapabilityListener(
      "target_temperature",
      this.onCapabilityTargetTemperature.bind(this)
    );

    // Get initial device data
    await this.fetchDeviceData();

    // Set up the update interval
    this.startUpdateInterval();
  }

  /**
   * Start or restart the update interval
   */
  private startUpdateInterval() {
    const settings = this.getSettings() as DeviceSettings;
    let updateInterval = settings.interval * 1000;

    // Ensure minimum interval is 10 seconds
    if (!updateInterval || updateInterval < 10000) {
      updateInterval = 10000;
    }

    this.log(
      `Setting update interval to ${updateInterval}ms for ${this.getName()}`
    );

    // Clear existing interval if it exists
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Set new interval
    this.updateInterval = setInterval(async () => {
      await this.fetchDeviceData();
    }, updateInterval);
  }

  /**
   * Fetch device data from the API
   */
  private async fetchDeviceData() {
    if (this.pauseUpdates) {
      this.log("Updates paused, skipping data fetch");
      return;
    }

    try {
      const measurement = await this.api.getArcSenseMeasurement(
        this.deviceData.id
      );

      if (!measurement) {
        this.error("No measurement data received from API");
        return;
      }

      this.log(`Retrieved measurement data for ${this.getName()}`);
      await this.updateCapabilities(measurement);
    } catch (error) {
      this.error(
        `Error fetching device data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Update device capabilities with fresh data
   */
  private async updateCapabilities(measurement: ArcSenseMeasurement) {
    try {
      // Current temperature - divided by 10 to convert from API format to degrees
      if (
        measurement.currentTemperature !== undefined &&
        measurement.currentTemperature !== null
      ) {
        const temp = measurement.currentTemperature / 10;
        await this.setCapabilityValue("measure_temperature", temp).catch(
          this.error
        );
      }

      // Target temperature - only update if not paused due to recent setting
      if (
        measurement.desiredTemperature !== undefined &&
        measurement.desiredTemperature !== null &&
        !this.pauseUpdates
      ) {
        const targetTemp = measurement.desiredTemperature / 10;
        await this.setCapabilityValue("target_temperature", targetTemp).catch(
          this.error
        );
      }

      // Humidity - divided by 10 to convert from API format to percentage
      if (
        measurement.currentHumidity !== undefined &&
        measurement.currentHumidity !== null
      ) {
        const humidity = measurement.currentHumidity / 10;
        await this.setCapabilityValue("measure_humidity", humidity).catch(
          this.error
        );
      }

      // Battery level
      if (
        measurement.currentBattery !== undefined &&
        measurement.currentBattery !== null
      ) {
        await this.setCapabilityValue(
          "measure_battery",
          measurement.currentBattery
        ).catch(this.error);
      }

      // Signal strength
      if (
        measurement.currentRssi !== undefined &&
        measurement.currentRssi !== null
      ) {
        await this.setCapabilityValue(
          "measure_signal_strength",
          measurement.currentRssi
        ).catch(this.error);
      }
    } catch (error) {
      this.error(
        `Error updating capabilities: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Handle target temperature capability changes
   */
  async onCapabilityTargetTemperature(value: number): Promise<void> {
    this.log(`Setting target temperature to ${value}°C`);

    try {
      // Set the value locally first
      await this.setCapabilityValue("target_temperature", value).catch(
        this.error
      );

      // Prepare the temperature in the format expected by the API (degrees * 10)
      const apiTemp = Math.round(value * 10);

      // Pause automatic updates to avoid overwriting our change
      this.pauseUpdates = true;

      // Send the update to the API
      const success = await this.api.updateArcSenseTemperature(
        this.deviceData.id,
        apiTemp
      );

      if (success) {
        this.log(
          `Target temperature successfully set to ${value}°C (${apiTemp} in API format)`
        );
      } else {
        this.error(`Failed to set target temperature to ${value}°C`);
      }

      // Resume updates after delay to allow API to update
      setTimeout(() => {
        this.pauseUpdates = false;
        this.log("Device updates resumed");
      }, 30000); // 30 second pause
    } catch (error) {
      this.error(
        `Failed to set target temperature: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.pauseUpdates = false;
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log(`ArcSense device has been added: ${this.getName()}`);
  }

  /**
   * onSettings is called when the user updates the device's settings.
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: DeviceSettings;
    newSettings: DeviceSettings;
    changedKeys: string[];
  }): Promise<string | undefined> {
    this.log("ArcSense device settings were changed");

    // Log changed settings (except password)
    for (const key of changedKeys) {
      if (key !== "password") {
        this.log(
          `Setting '${key}' changed from '${oldSettings[key]}' to '${newSettings[key]}'`
        );
      } else {
        this.log("Password was changed");
      }
    }

    // Handle email, password or API host change
    if (
      changedKeys.includes("email") ||
      changedKeys.includes("password") ||
      changedKeys.includes("apiHost")
    ) {
      this.log("Reinitializing API connection with new credentials");
      this.api = new LkApi(
        newSettings.email,
        newSettings.password,
        this.homey,
        newSettings.apiHost
      );

      // Test the new credentials
      try {
        await this.api.login();
        this.log("New credentials validated successfully");
      } catch (error) {
        this.error(
          `Failed to validate new credentials: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw new Error(
          "Invalid credentials. Please check your email and password."
        );
      }
    }

    // Handle interval change
    if (changedKeys.includes("interval")) {
      this.log("Update interval changed, restarting interval timer");
      this.startUpdateInterval();
    }

    return "Settings saved successfully";
  }

  /**
   * onRenamed is called when the user updates the device's name.
   */
  async onRenamed(name: string) {
    this.log(`Device renamed to ${name}`);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log(`ArcSense device has been deleted: ${this.getName()}`);

    // Clean up interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
