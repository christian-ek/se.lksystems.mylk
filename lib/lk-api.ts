import { SimpleClass } from "homey";
import axios, {
  type AxiosRequestConfig,
  type AxiosError,
  type RawAxiosRequestHeaders,
} from "axios";
import type {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  UserInfo,
  RealEstate,
  ArcHubConfig,
  ArcHubMeasurement,
  ArcSenseConfig,
  ArcSenseMeasurement,
  CubicSecureConfig,
  CubicSecureMeasurement,
  CubicDetectorConfig,
  CubicDetectorMeasurement,
  DeviceTitle,
  DeviceInformation,
  RealEstateStructure,
  ValveState,
  HubMode,
  HubStructure,
  DeviceMeasurement,
} from "./lk-types";

// Homey typings
interface Homey {
  settings: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
  };
}

/**
 * Client for the Lk API that uses Homey's SimpleClass for logging
 */
export class LkApi extends SimpleClass {
  private readonly SUBSCRIPTION_KEY: string =
    "deb63224fa0443d5a8e9167e88b4b4d9";
  private readonly authBaseUrl: string;
  private readonly serviceBaseUrl: string;
  private email: string;
  private password: string;
  private accessToken: string | null | undefined;
  private refreshToken: string | null | undefined;
  private homey: Homey;

  /**
   * Construct the client
   * @param email - Email for logging into the Lk API
   * @param password - Password for logging into the Lk API
   * @param homey - Homey instance
   * @param apiHost - Optional custom API host
   */
  constructor(
    email: string,
    password: string,
    homey: Homey,
    apiHost = "https://link2.lk.nu"
  ) {
    super();

    this.homey = homey;
    this.email = email;
    this.password = password;
    this.authBaseUrl = `${apiHost}/auth`;
    this.serviceBaseUrl = `${apiHost}/service`;

    // Try to load stored token
    const storedAccessToken = this.homey.settings.get("lkAccessToken");
    const storedRefreshToken = this.homey.settings.get("lkRefreshToken");

    if (typeof storedAccessToken === "string") {
      this.accessToken = storedAccessToken;
    }

    if (typeof storedRefreshToken === "string") {
      this.refreshToken = storedRefreshToken;
    }

    /* Validate the configuration */
    if (!email || !password) {
      this.error("Email and password not found in config");
      throw new Error(
        'Not all required configuration values found. Need "email" and "password".'
      );
    }

    /* Configure axios defaults */
    axios.defaults.headers.common = {
      "Content-Type": "application/json",
      "Api-Version": "1.0",
      "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
    };

    /* Configure an interceptor to refresh our authentication credentials */
    axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        /* Return any error not due to authentication */
        if (!error.response || error.response.status !== 401) {
          return Promise.reject(error);
        }

        /* Reject if we were trying to authenticate and it failed */
        if (
          error.config?.url?.includes("/auth/login") ||
          error.config?.url?.includes("/auth/refresh")
        ) {
          return Promise.reject(error);
        }

        /* Try to refresh the token and retry the request */
        try {
          let newToken: string;

          // Try to refresh the token first if we have a refresh token
          if (this.refreshToken) {
            try {
              const refreshResponse = await this.refreshAccessToken();
              if (refreshResponse.accessToken === null) {
                throw new Error("Received null access token from refresh");
              }
              newToken = refreshResponse.accessToken;
            } catch (refreshError) {
              // If refresh fails, try a full login
              const loginResponse = await this.login();
              if (loginResponse.accessToken === null) {
                throw new Error("Received null access token from login");
              }
              newToken = loginResponse.accessToken;
            }
          } else {
            // No refresh token, do a full login
            const loginResponse = await this.login();
            if (loginResponse.accessToken === null) {
              throw new Error("Received null access token from login");
            }
            newToken = loginResponse.accessToken;
          }

          // New request with new token
          if (error.config) {
            // Set the Authorization header directly
            if (error.config.headers) {
              error.config.headers.Authorization = `Bearer ${newToken}`;
            }
            return axios.request(error.config);
          }
          return Promise.reject(new Error("Request config not available"));
        } catch (authError) {
          return Promise.reject(authError);
        }
      }
    );
  }

  /**
   * Authenticate with the Lk API
   * @returns Promise with login response containing access token
   */
  async login(): Promise<LoginResponse> {
    const data: LoginRequest = {
      email: this.email,
      password: this.password,
    };

    this.log(`Sending login request with email: ${this.email}`);

    try {
      const response = await axios.post<LoginResponse>(
        `${this.authBaseUrl}/auth/login`,
        data
      );
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      // Store tokens for later use
      this.homey.settings.set("lkAccessToken", response.data.accessToken);
      this.homey.settings.set("lkRefreshToken", response.data.refreshToken);

      this.log(
        `Authentication successful, token expires in ${response.data.accessTokenExpire} seconds`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.error("Authentication failed: Invalid credentials");
        throw new Error("Invalid email or password");
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Authentication failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token
   * @returns Promise with login response containing new access token
   */
  async refreshAccessToken(): Promise<LoginResponse> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available, please log in first");
    }

    const data: RefreshRequest = {
      refreshToken: this.refreshToken,
    };

    try {
      const response = await axios.post<LoginResponse>(
        `${this.authBaseUrl}/auth/refresh`,
        data
      );
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      // Update stored tokens
      this.homey.settings.set("lkAccessToken", response.data.accessToken);
      this.homey.settings.set("lkRefreshToken", response.data.refreshToken);

      this.log(
        `Token refreshed successfully, new token expires in ${response.data.accessTokenExpire} seconds`
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Token refresh failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get the current user information
   * @returns Promise with user information
   */
  async getUserInfo(): Promise<UserInfo> {
    return this.makeAuthorizedRequest<UserInfo>(
      `${this.authBaseUrl}/auth/user`,
      "GET"
    );
  }

  /**
   * Get user structure (homes/realestates)
   * @param userId The user ID
   * @returns Promise with user structure information
   */
  async getUserStructure(userId: string): Promise<RealEstateStructure[]> {
    return this.makeAuthorizedRequest<RealEstateStructure[]>(
      `${this.serviceBaseUrl}/users/user/${userId}/structure/false`,
      "GET"
    );
  }

  /**
   * Get real estate information
   * @param realestateId The real estate ID
   * @returns Promise with real estate information
   */
  async getRealEstateTitle(realestateId: string): Promise<RealEstate> {
    return this.makeAuthorizedRequest<RealEstate>(
      `${this.serviceBaseUrl}/structure/realestate/${realestateId}/title/false`,
      "GET"
    );
  }

  /**
   * Get real estate measurements (all devices status)
   * @param realestateId The real estate ID
   * @returns Promise with measurements for all devices
   */
  async getRealEstateMeasurements(
    realestateId: string
  ): Promise<DeviceMeasurement[]> {
    return this.makeAuthorizedRequest<DeviceMeasurement[]>(
      `${this.serviceBaseUrl}/structure/realestate/${realestateId}/measurements/false`,
      "GET"
    );
  }

  /**
   * Get real estate machines (all devices)
   * @param realestateId The real estate ID
   * @returns Promise with all devices in the real estate
   */
  async getRealEstateMachines(realestateId: string): Promise<DeviceTitle[]> {
    return this.makeAuthorizedRequest<DeviceTitle[]>(
      `${this.serviceBaseUrl}/structure/realestate/${realestateId}/realestateMachines/false`,
      "GET"
    );
  }

  /**
   * Get ArcHub configuration
   * @param serialNumber The hub serial number
   * @returns Promise with hub configuration
   */
  async getArcHubConfiguration(serialNumber: string): Promise<ArcHubConfig> {
    return this.makeAuthorizedRequest<ArcHubConfig>(
      `${this.serviceBaseUrl}/arc/hub/${serialNumber}/configuration/false`,
      "GET"
    );
  }

  /**
   * Get ArcHub measurement data
   * @param serialNumber The hub serial number
   * @returns Promise with hub measurement data
   */
  async getArcHubMeasurement(serialNumber: string): Promise<ArcHubMeasurement> {
    return this.makeAuthorizedRequest<ArcHubMeasurement>(
      `${this.serviceBaseUrl}/arc/hub/${serialNumber}/measurement/false`,
      "GET"
    );
  }

  /**
   * Get ArcHub structure (connected devices)
   * @param serialNumber The hub serial number
   * @returns Promise with hub structure data
   */
  async getArcHubStructure(serialNumber: string): Promise<HubStructure> {
    return this.makeAuthorizedRequest<HubStructure>(
      `${this.serviceBaseUrl}/arc/hub/${serialNumber}/structure/false`,
      "GET"
    );
  }

  /**
   * Get ArcSense configuration
   * @param mac The sensor MAC address
   * @returns Promise with sensor configuration
   */
  async getArcSenseConfiguration(mac: string): Promise<ArcSenseConfig> {
    return this.makeAuthorizedRequest<ArcSenseConfig>(
      `${this.serviceBaseUrl}/arc/sense/${mac}/configuration/false`,
      "GET"
    );
  }

  /**
   * Get ArcSense measurement data
   * @param mac The sensor MAC address
   * @returns Promise with sensor measurement data
   */
  async getArcSenseMeasurement(mac: string): Promise<ArcSenseMeasurement> {
    return this.makeAuthorizedRequest<ArcSenseMeasurement>(
      `${this.serviceBaseUrl}/arc/sense/${mac}/measurement/false`,
      "GET"
    );
  }

  /**
   * Get CubicSecure configuration
   * @param serialNumber The device serial number
   * @returns Promise with device configuration
   */
  async getCubicSecureConfiguration(
    serialNumber: string
  ): Promise<CubicSecureConfig> {
    return this.makeAuthorizedRequest<CubicSecureConfig>(
      `${this.serviceBaseUrl}/cubic/secure/${serialNumber}/configuration/false`,
      "GET"
    );
  }

  /**
   * Get CubicSecure measurement data
   * @param serialNumber The device serial number
   * @returns Promise with device measurement data
   */
  async getCubicSecureMeasurement(
    serialNumber: string
  ): Promise<CubicSecureMeasurement> {
    return this.makeAuthorizedRequest<CubicSecureMeasurement>(
      `${this.serviceBaseUrl}/cubic/secure/${serialNumber}/measurement/false`,
      "GET"
    );
  }

  /**
   * Get CubicDetector configuration
   * @param serialNumber The device serial number
   * @returns Promise with device configuration
   */
  async getCubicDetectorConfiguration(
    serialNumber: string
  ): Promise<CubicDetectorConfig> {
    return this.makeAuthorizedRequest<CubicDetectorConfig>(
      `${this.serviceBaseUrl}/cubic/detector/${serialNumber}/configuration/false`,
      "GET"
    );
  }

  /**
   * Get CubicDetector measurement data
   * @param serialNumber The device serial number
   * @returns Promise with device measurement data
   */
  async getCubicDetectorMeasurement(
    serialNumber: string
  ): Promise<CubicDetectorMeasurement> {
    return this.makeAuthorizedRequest<CubicDetectorMeasurement>(
      `${this.serviceBaseUrl}/cubic/detector/${serialNumber}/measurement/false`,
      "GET"
    );
  }

  /**
   * Get device information
   * @param deviceIdentity The device identity/serial
   * @returns Promise with device information
   */
  async getDeviceInformation(
    deviceIdentity: string
  ): Promise<DeviceInformation> {
    return this.makeAuthorizedRequest<DeviceInformation>(
      `${this.serviceBaseUrl}/devices/device/${deviceIdentity}/information/false`,
      "GET"
    );
  }

  /**
   * Get device title information
   * @param deviceIdentity The device identity/serial
   * @returns Promise with device title information
   */
  async getDeviceTitle(deviceIdentity: string): Promise<DeviceTitle> {
    return this.makeAuthorizedRequest<DeviceTitle>(
      `${this.serviceBaseUrl}/devices/device/${deviceIdentity}/title/false`,
      "GET"
    );
  }

  /**
   * Update ArcSense temperature setpoint
   * @param mac The sensor MAC address
   * @param desiredTemperature The desired temperature value
   * @returns Promise indicating success
   */
  async updateArcSenseTemperature(
    mac: string,
    desiredTemperature: number
  ): Promise<boolean> {
    try {
      // Based on API exploration and OpenAPI spec
      const data = { desiredTemperature };
      await this.makeAuthorizedRequest(
        `${this.serviceBaseUrl}/arc/sense/${mac}/setpoint/false`,
        "PUT",
        data
      );
      this.log(
        `Successfully set temperature to ${
          desiredTemperature / 10
        }°C for device ${mac}`
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Failed to update temperature: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Update ArcHub mode (heating/cooling)
   * @param serialNumber The hub serial number
   * @param mode The mode value (from HubMode enum)
   * @returns Promise indicating success
   */
  async updateArcHubMode(
    serialNumber: string,
    mode: HubMode
  ): Promise<boolean> {
    try {
      // Based on the pattern in the API, this is the likely endpoint
      const data = { mode };
      await this.makeAuthorizedRequest(
        `${this.serviceBaseUrl}/arc/hub/${serialNumber}/mode/false`,
        "PUT",
        data
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Failed to update hub mode: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Update ArcHub LED state
   * @param serialNumber The hub serial number
   * @param ledsEnabled Whether LEDs should be enabled
   * @returns Promise indicating success
   */
  async updateArcHubLeds(
    serialNumber: string,
    ledsEnabled: boolean
  ): Promise<boolean> {
    try {
      // Based on the pattern in the API, this is the likely endpoint
      const data = { ledsEnabled };
      await this.makeAuthorizedRequest(
        `${this.serviceBaseUrl}/arc/hub/${serialNumber}/leds/false`,
        "PUT",
        data
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Failed to update LED state: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Update CubicSecure valve state (open/close)
   * @param serialNumber The device serial number
   * @param valveState The valve state (from ValveState enum)
   * @returns Promise indicating success
   */
  async updateCubicSecureValveState(
    serialNumber: string,
    valveState: ValveState
  ): Promise<boolean> {
    try {
      // Based on the pattern in the API, this is the likely endpoint
      const data = { valveState };
      await this.makeAuthorizedRequest(
        `${this.serviceBaseUrl}/cubic/secure/${serialNumber}/valve/false`,
        "PUT",
        data
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`Failed to update valve state: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Make an authorized request to the API
   * @param url The endpoint URL
   * @param method The HTTP method
   * @param data Optional data to send
   * @returns Promise with the response data
   */
  private async makeAuthorizedRequest<T>(
    url: string,
    method = "GET",
    data?: unknown
  ): Promise<T> {
    // Ensure we have a token
    if (!this.accessToken) {
      const loginResponse = await this.login();
      if (loginResponse.accessToken === null) {
        throw new Error("Received null access token from login");
      }
    }

    if (this.accessToken === null) {
      throw new Error("Access token is null");
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      } as RawAxiosRequestHeaders,
      data,
    };

    try {
      this.log(`Making ${method} request to: ${url}`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // The interceptor should handle auth errors, but just in case
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        this.error(`Error calling ${url}: ${errorMessage}`);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.error(`Error calling ${url}: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Validate the current access token
   * @returns Promise<boolean> indicating if token is valid
   */
  async validateToken(): Promise<boolean> {
    if (!this.accessToken || this.accessToken === null) {
      return false;
    }

    try {
      const response = await axios.get<boolean>(
        `${this.authBaseUrl}/validate/token`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      return false;
    }
  }
}
