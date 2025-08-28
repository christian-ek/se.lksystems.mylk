import { Driver } from "homey";
import type Homey from "homey/lib/Homey";
import { LkApi } from "../../lib/lk-api";
import type {
  DeviceItem,
  LoginData,
  RealEstateSelection,
} from "../../lib/driver-types";

class CubicSecureDriver extends Driver {
  public readonly homey!: Homey;

  private api!: LkApi;
  private selectedRealEstate: Partial<RealEstateSelection> = {};
  private email = "";
  private password = "";
  private listView = 1;

  async onInit(): Promise<void> {
    this.log("CubicSecure driver has been initialized");
  }

  // biome-ignore lint/suspicious/noExplicitAny: Base type mismatch workaround
  async onPair(session: any): Promise<void> {
    this.log("onPair started");

    this.selectedRealEstate = {};
    this.listView = 1;

    session.setHandler("login", async (data: LoginData): Promise<boolean> => {
      return await this.onLogin(data);
    });

    session.setHandler("list_devices", async () => {
      return await this.onListDevices();
    });

    session.setHandler(
      "list_devices_selection",
      async (data: RealEstateSelection[]) => {
        return await this.onListDeviceSelection(data);
      }
    );
  }

  private async onLogin(data: LoginData): Promise<boolean> {
    this.log("Login handler called");

    this.email = data.username;
    this.password = data.password;

    this.api = new LkApi(this.email, this.password, this.homey);

    try {
      await this.api.login();

      const userInfo = await this.api.getUserInfo();
      this.log("Login successful for user ID:", userInfo.userId || "unknown");

      return true;
    } catch (error) {
      this.error("Login failed:", error);
      return false;
    }
  }

  private async onListDevices(): Promise<RealEstateSelection[] | DeviceItem[]> {
    this.log("handler: list_devices");
    if (this.listView === 1) {
      this.listView = 2;
      return await this.onPairListRealEstates();
    }

    this.listView = 1;
    return await this.onPairListCubicSecureDevices();
  }

  private async onListDeviceSelection(
    data: RealEstateSelection[]
  ): Promise<void> {
    this.log("onListDeviceSelection()");

    if (data && data.length > 0) {
      this.selectedRealEstate = data[0];
      this.log("Real estate selected:", this.selectedRealEstate.name);
    }
  }

  private async onPairListRealEstates(): Promise<RealEstateSelection[]> {
    this.log("onPairListRealEstates()");

    if (!this.api) {
      this.error("API not initialized before listing real estates.");
      return [];
    }

    try {
      const userInfo = await this.api.getUserInfo();

      if (!userInfo.userId) {
        throw new Error("User ID is null");
      }

      const structure = await this.api.getUserStructure(userInfo.userId);
      this.log(`Found ${structure.length} real estates`);

      const devices = structure.map((estate) => ({
        name: estate.name || `Estate ${estate.realestateId}`,
        data: {
          id: estate.realestateId || "",
          name: estate.name,
          address: estate.address,
          city: estate.city,
        },
        icon: "../../../assets/house.svg",
      }));

      return devices;
    } catch (error) {
      this.error("Error listing real estates:", error);
      return [];
    }
  }

  private async onPairListCubicSecureDevices(): Promise<DeviceItem[]> {
    this.log("onPairListCubicSecureDevices()");

    if (!this.api) {
      this.error("API not initialized before listing devices.");
      return [];
    }

    try {
      const realEstateId = this.selectedRealEstate?.data?.id;
      if (!realEstateId) {
        this.error("No real estate selected - cannot list devices");
        return [];
      }

      this.log(
        `Listing CubicSecure devices for "${this.selectedRealEstate.name}" (${realEstateId})`
      );

      const devices = await this.api.getRealEstateMachines(realEstateId);

      const cubicSecureDevices = devices.filter(
        (device) =>
          device.deviceType?.toLowerCase() === "cubicsecure" &&
          device.deviceRole?.toLowerCase() === "cubicsecure"
      );

      this.log(`Found ${cubicSecureDevices.length} CubicSecure devices`);

      const deviceItems: DeviceItem[] = [];
      for (const device of cubicSecureDevices) {
        if (!device.identity) {
          this.log("Skipping device with null identity");
          continue;
        }

        const zoneName = device.zone?.zoneName || "Unknown Room";
        const deviceName = `CubicSecure - ${zoneName}`;

        this.log(`Adding device: ${deviceName} (${device.identity})`);

        deviceItems.push({
          name: deviceName,
          data: {
            id: device.identity,
            mac: device.identity,
            externalId: device.externalId,
            realestateId: device.realestateId,
            realestateMachineId: device.realestateMachineId,
          },
          settings: {
            email: this.email,
            password: this.password,
          },
        });
      }

      return deviceItems;
    } catch (error) {
      this.error("Error listing devices:", error);
      return [];
    }
  }
}

module.exports = CubicSecureDriver;
