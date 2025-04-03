import Homey from "homey";
import { LkApi } from "../../lib/lk-api";
import type {
  DeviceItem,
  HomeyWithSettings,
  LoginData,
  RealEstateSelection,
} from "../../lib/driver-types";

class ArcSenseDriver extends Homey.Driver {
  private api!: LkApi;
  private selectedRealEstate: Partial<RealEstateSelection> = {};
  private email = "";
  private password = "";
  protected readonly homey!: HomeyWithSettings;
  private listView = 1;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit(): Promise<void> {
    this.log("ArcSense driver has been initialized");
  }

  /**
   * Handles device discovery and pairing
   */
  // biome-ignore lint/suspicious/noExplicitAny: Can't use PairSession without error
  async onPair(session: any): Promise<void> {
    this.log("onPair started");

    // Reset state at the beginning of pairing
    this.selectedRealEstate = {};
    this.listView = 1;

    // Handle login credentials
    session.setHandler("login", async (data: LoginData): Promise<boolean> => {
      return await this.onLogin(data);
    });

    // Handle device listing
    session.setHandler("list_devices", async () => {
      return await this.onListDevices();
    });

    // Handle device selection
    session.setHandler(
      "list_devices_selection",
      async (data: RealEstateSelection[]) => {
        return await this.onListDeviceSelection(data);
      }
    );
  }

  /**
   * Handle login authentication
   */
  private async onLogin(data: LoginData): Promise<boolean> {
    this.log("Login handler called");

    this.email = data.username;
    this.password = data.password;

    // Initialize the LK API
    this.api = new LkApi(this.email, this.password, this.homey);

    try {
      // Attempt to log in
      await this.api.login();

      // Get user info to confirm login worked
      const userInfo = await this.api.getUserInfo();
      this.log("Login successful for user ID:", userInfo.userId || "unknown");

      return true; // Login successful
    } catch (error) {
      this.error("Login failed:", error);
      return false; // Login failed
    }
  }

  /**
   * Handle device listing based on current view
   */
  private async onListDevices(): Promise<RealEstateSelection[] | DeviceItem[]> {
    this.log("handler: list_devices");
    if (this.listView === 1) {
      this.listView = 2;
      return await this.onPairListRealEstates();
    }

    this.listView = 1;
    return await this.onPairListArcDevices();
  }

  /**
   * Handle device selection
   */
  private async onListDeviceSelection(
    data: RealEstateSelection[]
  ): Promise<void> {
    this.log("onListDeviceSelection()");

    if (data && data.length > 0) {
      this.selectedRealEstate = data[0];
      this.log("Real estate selected:", this.selectedRealEstate.name);
    }
    return;
  }

  /**
   * List available real estates
   */
  private async onPairListRealEstates(): Promise<RealEstateSelection[]> {
    this.log("onPairListRealEstates()");

    try {
      // Get user info to get the user ID
      const userInfo = await this.api.getUserInfo();

      if (!userInfo.userId) {
        throw new Error("User ID is null");
      }

      // Get user structure (homes/real estates)
      const structure = await this.api.getUserStructure(userInfo.userId);
      this.log(`Found ${structure.length} real estates`);

      // Map structure to list items
      const devices = structure.map((estate) => ({
        name: estate.name || `Estate ${estate.realestateId}`,
        data: {
          id: estate.realestateId || "",
          name: estate.name,
          address: estate.address,
          city: estate.city,
        },
      }));

      return devices;
    } catch (error) {
      this.error("Error listing real estates:", error);
      return [];
    }
  }

  /**
   * List Arc Sense devices for the selected real estate
   */
  private async onPairListArcDevices(): Promise<DeviceItem[]> {
    this.log("onPairListArcDevices()");

    try {
      // Check if we have a real estate ID from the previous step
      if (!this.selectedRealEstate?.data?.id) {
        this.error("No real estate selected - cannot list devices");
        return [];
      }

      const realEstateId = this.selectedRealEstate.data.id;
      this.log(
        `Listing Arc Sense devices for "${this.selectedRealEstate.name}" (${realEstateId})`
      );

      // Get devices in the selected real estate
      const devices = await this.api.getRealEstateMachines(realEstateId);

      // Filter for only Arc Sense devices (note: API uses lowercase "arc-sense")
      const arcSenseDevices = devices.filter(
        (device) =>
          device.deviceType === "arc-sense" && device.deviceRole === "arc-tune"
      );

      this.log(`Found ${arcSenseDevices.length} Arc Sense devices`);

      // Process devices in sequence to avoid overwhelming the API
      const deviceItems: DeviceItem[] = [];

      for (const device of arcSenseDevices) {
        if (!device.identity) {
          this.log("Skipping device with null identity");
          continue;
        }

        // Get additional device information if needed
        let measurement = null;
        try {
          measurement = await this.api.getArcSenseMeasurement(device.identity);
        } catch (error) {
          this.error(
            `Error getting measurement data for ${device.identity}:`,
            error
          );
        }

        // Use zone information for the device name
        const zoneName = device.zone?.zoneName || "Unknown Room";
        const deviceName = `Arc Sense - ${zoneName}`;

        this.log(`Adding device: ${deviceName} (${device.identity})`);

        deviceItems.push({
          name: deviceName,
          data: {
            id: device.identity,
            mac: device.identity, // For Arc Sense, identity is the MAC address
            externalId: device.externalId,
            realestateId: device.realestateId,
            realestateMachineId: device.realestateMachineId,
          },
          settings: {
            email: this.email,
            password: this.password,
            interval: 30, // Default 30 second refresh interval
          },
          capabilities: [
            "measure_battery",
            "measure_humidity",
            "measure_signal_strength",
            "target_temperature",
            "measure_temperature",
          ],
        });
      }

      return deviceItems;
    } catch (error) {
      this.error("Error listing devices:", error);
      return [];
    }
  }
}

module.exports = ArcSenseDriver;
