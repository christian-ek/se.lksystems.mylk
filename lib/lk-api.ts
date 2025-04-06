import { SimpleClass } from "homey";
import type Homey from "homey/lib/Homey";
import axios from "axios";
import type {
  AxiosRequestConfig,
  AxiosError,
  RawAxiosRequestHeaders,
  AxiosResponse,
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
  DeviceMeasurement,
  HubStructure,
} from "./lk-types";
import { type ValveState, HubMode } from "./lk-types";

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

    if (!email || !password) {
      this.error("Email and/or password not provided to LkApi constructor.");
      throw new Error("LkApi requires valid email and password.");
    }

    this.loadTokens();
    this.log(`LkApi initialized for host: ${apiHost}`);

    axios.defaults.headers.common = {
      "Content-Type": "application/json",
      "Api-Version": "1.0",
      "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
    };

    this.setupAxiosInterceptor();
  }

  private loadTokens(): void {
    const storedAccessToken = this.homey.settings.get("lkAccessToken");
    const storedRefreshToken = this.homey.settings.get("lkRefreshToken");

    if (typeof storedAccessToken === "string" && storedAccessToken) {
      this.accessToken = storedAccessToken;
      this.log("Loaded access token from settings.");
    } else {
      this.accessToken = null;
      this.log("No valid access token found in settings.");
    }

    if (typeof storedRefreshToken === "string" && storedRefreshToken) {
      this.refreshToken = storedRefreshToken;
      this.log("Loaded refresh token from settings.");
    } else {
      this.refreshToken = null;
      this.log("No valid refresh token found in settings.");
    }
  }

  private saveTokens(access: string | null, refresh: string | null): void {
    this.homey.settings.set("lkAccessToken", access);
    this.homey.settings.set("lkRefreshToken", refresh);
    this.accessToken = access;
    this.refreshToken = refresh;
    if (access) this.log("Saved new access token.");
    else this.log("Cleared access token.");
    if (refresh) this.log("Saved new refresh token.");
    else this.log("Cleared refresh token.");
  }

  private clearTokens(): void {
    this.saveTokens(null, null);
  }

  private setupAxiosInterceptor(): void {
    axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (!originalRequest || error.response?.status !== 401) {
          return Promise.reject(error);
        }

        if (originalRequest.url?.includes("/auth/refresh")) {
          this.error("Refresh token request failed with 401. Clearing tokens.");
          this.clearTokens();
          return Promise.reject(error);
        }

        if (originalRequest.url?.includes("/auth/login")) {
          this.error("Login request failed with 401.");
          return Promise.reject(error);
        }

        this.log(
          `Intercepted 401 error for ${originalRequest.method?.toUpperCase()} ${
            originalRequest.url
          }. Attempting token refresh/login.`
        );

        try {
          let newAccessToken: string | null;

          if (this.refreshToken) {
            this.log("Attempting token refresh using existing refresh token.");
            try {
              const refreshResponse = await this.refreshAccessToken();
              newAccessToken = refreshResponse.accessToken;
            } catch (refreshError) {
              this.error(
                `Token refresh failed: ${
                  refreshError instanceof Error
                    ? refreshError.message
                    : String(refreshError)
                }. Attempting full login as fallback.`
              );
              const loginResponse = await this.login();
              newAccessToken = loginResponse.accessToken;
            }
          } else {
            this.log("No refresh token available, attempting full login.");
            const loginResponse = await this.login();
            newAccessToken = loginResponse.accessToken;
          }

          if (!newAccessToken) {
            throw new Error("Failed to obtain a new access token after 401.");
          }

          this.log(
            "Successfully obtained new access token. Retrying original request."
          );

          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          if (!originalRequest.headers["Ocp-Apim-Subscription-Key"]) {
            originalRequest.headers["Ocp-Apim-Subscription-Key"] =
              this.SUBSCRIPTION_KEY;
          }
          if (!originalRequest.headers["Api-Version"]) {
            originalRequest.headers["Api-Version"] = "1.0";
          }
          if (
            !originalRequest.headers["Content-Type"] &&
            originalRequest.data
          ) {
            originalRequest.headers["Content-Type"] = "application/json";
          }

          return axios(originalRequest);
        } catch (authError) {
          this.error(
            `Failed to re-authenticate after 401: ${
              authError instanceof Error ? authError.message : String(authError)
            }. Clearing tokens.`
          );
          this.clearTokens();
          return Promise.reject(error);
        }
      }
    );
  }

  async login(): Promise<LoginResponse> {
    const data: LoginRequest = {
      email: this.email,
      password: this.password,
    };
    this.log(`Attempting login with email: ${this.email}`);

    const requestHeaders: RawAxiosRequestHeaders = {
      "Content-Type": "application/json",
      "Api-Version": "1.0",
      "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
    };

    try {
      const response = await axios.post<LoginResponse>(
        `${this.authBaseUrl}/auth/login`,
        data,
        { headers: requestHeaders }
      );

      if (!response.data.accessToken || !response.data.refreshToken) {
        throw new Error("Login response missing access or refresh token.");
      }

      this.saveTokens(response.data.accessToken, response.data.refreshToken);
      this.log(
        `Login successful. Token expires in ${response.data.accessTokenExpire} seconds.`
      );
      return response.data;
    } catch (error) {
      this.error(
        `Login failed: ${
          error instanceof Error
            ? error.message
            : this.formatAxiosError(error as AxiosError)
        }`
      );
      this.clearTokens();
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error("Invalid email or password.");
      }
      throw error;
    }
  }

  async refreshAccessToken(): Promise<LoginResponse> {
    if (!this.refreshToken) {
      this.error("Cannot refresh token: No refresh token available.");
      throw new Error("No refresh token available.");
    }

    this.log("Attempting to refresh access token.");
    const data: RefreshRequest = { refreshToken: this.refreshToken };

    const requestHeaders: RawAxiosRequestHeaders = {
      "Content-Type": "application/json",
      "Api-Version": "1.0",
      "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
    };

    try {
      const response = await axios.post<LoginResponse>(
        `${this.authBaseUrl}/auth/refresh`,
        data,
        { headers: requestHeaders }
      );

      if (!response.data.accessToken || !response.data.refreshToken) {
        throw new Error(
          "Token refresh response missing access or refresh token."
        );
      }

      this.saveTokens(response.data.accessToken, response.data.refreshToken);
      this.log(
        `Token refreshed successfully. New token expires in ${response.data.accessTokenExpire} seconds.`
      );
      return response.data;
    } catch (error) {
      this.error(
        `Token refresh failed: ${
          error instanceof Error
            ? error.message
            : this.formatAxiosError(error as AxiosError)
        }`
      );
      throw error;
    }
  }

  private async makeAuthorizedRequest<T>(
    endpoint: string,
    method = "GET",
    data?: unknown,
    urlType: "service" | "auth" = "service"
  ): Promise<T> {
    if (!this.accessToken) {
      this.log(
        `No access token found before ${method} ${endpoint}. Attempting login.`
      );
      try {
        await this.login();
        if (!this.accessToken) {
          throw new Error("Failed to obtain valid access token via login.");
        }
        this.log("Login successful, proceeding with original request.");
      } catch (loginError) {
        this.error(
          `Login attempt failed during authorized request: ${
            loginError instanceof Error
              ? loginError.message
              : String(loginError)
          }`
        );
        throw new Error(
          `Authentication required for ${method} ${endpoint}, but login failed.`
        );
      }
    }

    const baseUrl = urlType === "auth" ? this.authBaseUrl : this.serviceBaseUrl;
    const fullUrl = `${baseUrl}${endpoint}`;

    const config: AxiosRequestConfig = {
      method,
      url: fullUrl,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
        "Api-Version": "1.0",
      } as RawAxiosRequestHeaders,
      data,
    };

    if (data) {
      (config.headers as RawAxiosRequestHeaders)["Content-Type"] =
        "application/json";
    }

    this.log(`Making authorized ${method} request to: ${fullUrl}`);

    try {
      const response: AxiosResponse<T> = await axios(config);
      return response.data;
    } catch (error) {
      this.error(
        `Error during ${method} ${fullUrl}: ${
          error instanceof Error
            ? error.message
            : this.formatAxiosError(error as AxiosError)
        }`
      );
      throw error;
    }
  }

  // API Methods
  async getUserInfo(): Promise<UserInfo> {
    return this.makeAuthorizedRequest<UserInfo>(
      "/auth/user",
      "GET",
      undefined,
      "auth"
    );
  }

  async getUserStructure(userId: string): Promise<RealEstateStructure[]> {
    return this.makeAuthorizedRequest<RealEstateStructure[]>(
      `/users/user/${encodeURIComponent(userId)}/structure/false`,
      "GET"
    );
  }

  async getRealEstateTitle(realestateId: string): Promise<RealEstate> {
    return this.makeAuthorizedRequest<RealEstate>(
      `/structure/realestate/${encodeURIComponent(realestateId)}/title/false`,
      "GET"
    );
  }

  async getRealEstateMeasurements(
    realestateId: string
  ): Promise<DeviceMeasurement[]> {
    return this.makeAuthorizedRequest<DeviceMeasurement[]>(
      `/structure/realestate/${encodeURIComponent(
        realestateId
      )}/measurements/false`,
      "GET"
    );
  }

  async getRealEstateMachines(realestateId: string): Promise<DeviceTitle[]> {
    return this.makeAuthorizedRequest<DeviceTitle[]>(
      `/structure/realestate/${encodeURIComponent(
        realestateId
      )}/realestateMachines/false`,
      "GET"
    );
  }

  async getArcHubConfiguration(serialNumber: string): Promise<ArcHubConfig> {
    return this.makeAuthorizedRequest<ArcHubConfig>(
      `/arc/hub/${encodeURIComponent(serialNumber)}/configuration/false`,
      "GET"
    );
  }

  async getArcHubMeasurement(serialNumber: string): Promise<ArcHubMeasurement> {
    return this.makeAuthorizedRequest<ArcHubMeasurement>(
      `/arc/hub/${encodeURIComponent(serialNumber)}/measurement/false`,
      "GET"
    );
  }

  async getArcHubStructure(serialNumber: string): Promise<HubStructure> {
    return this.makeAuthorizedRequest<HubStructure>(
      `/arc/hub/${encodeURIComponent(serialNumber)}/structure/false`,
      "GET"
    );
  }

  async updateArcHubMode(
    serialNumber: string,
    mode: HubMode
  ): Promise<boolean> {
    try {
      await this.makeAuthorizedRequest(
        `/arc/hub/${encodeURIComponent(serialNumber)}/mode/false`,
        "PUT",
        { mode }
      );
      this.log(
        `Successfully updated ArcHub mode for ${serialNumber} to ${HubMode[mode]}`
      );
      return true;
    } catch (error) {
      this.error(
        `Failed to update ArcHub mode for ${serialNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async updateArcHubLeds(
    serialNumber: string,
    ledsEnabled: boolean
  ): Promise<boolean> {
    try {
      await this.makeAuthorizedRequest(
        `/arc/hub/${encodeURIComponent(serialNumber)}/leds/false`,
        "PUT",
        { ledsEnabled }
      );
      this.log(
        `Successfully updated ArcHub LEDs for ${serialNumber} to ${
          ledsEnabled ? "enabled" : "disabled"
        }`
      );
      return true;
    } catch (error) {
      this.error(
        `Failed to update ArcHub LEDs for ${serialNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async getArcSenseConfiguration(mac: string): Promise<ArcSenseConfig> {
    return this.makeAuthorizedRequest<ArcSenseConfig>(
      `/arc/sense/${encodeURIComponent(mac)}/configuration/false`,
      "GET"
    );
  }

  async getArcSenseMeasurement(mac: string): Promise<ArcSenseMeasurement> {
    return this.makeAuthorizedRequest<ArcSenseMeasurement>(
      `/arc/sense/${encodeURIComponent(mac)}/measurement/true`,
      "GET"
    );
  }

  async updateArcSenseTemperature(
    mac: string,
    desiredTemperature: number
  ): Promise<boolean> {
    try {
      const data = { desiredTemperature };
      await this.makeAuthorizedRequest(
        `/arc/sense/${encodeURIComponent(mac)}/setpoint/false`,
        "PUT",
        data
      );
      this.log(
        `Successfully set target temperature to ${
          desiredTemperature / 10
        }°C for ArcSense ${mac}`
      );
      return true;
    } catch (error) {
      this.error(
        `Failed to update ArcSense temperature for ${mac}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async getCubicSecureConfiguration(
    serialNumber: string
  ): Promise<CubicSecureConfig> {
    return this.makeAuthorizedRequest<CubicSecureConfig>(
      `/cubic/secure/${encodeURIComponent(serialNumber)}/configuration/false`,
      "GET"
    );
  }

  async getCubicSecureMeasurement(
    serialNumber: string
  ): Promise<CubicSecureMeasurement> {
    return this.makeAuthorizedRequest<CubicSecureMeasurement>(
      `/cubic/secure/${encodeURIComponent(serialNumber)}/measurement/true`,
      "GET"
    );
  }

  async updateCubicSecureValveState(
    serialNumber: string,
    valveState: ValveState
  ): Promise<boolean> {
    try {
      await this.makeAuthorizedRequest(
        `/cubic/secure/${encodeURIComponent(serialNumber)}/valve/false`,
        "PUT",
        { valveState }
      );
      this.log(
        `Successfully updated CubicSecure valve state for ${serialNumber} to ${valveState}`
      );
      return true;
    } catch (error) {
      this.error(
        `Failed to update CubicSecure valve state for ${serialNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  async getCubicDetectorConfiguration(
    serialNumber: string
  ): Promise<CubicDetectorConfig> {
    return this.makeAuthorizedRequest<CubicDetectorConfig>(
      `/cubic/detector/${encodeURIComponent(serialNumber)}/configuration/false`,
      "GET"
    );
  }

  async getCubicDetectorMeasurement(
    serialNumber: string
  ): Promise<CubicDetectorMeasurement> {
    return this.makeAuthorizedRequest<CubicDetectorMeasurement>(
      `/cubic/detector/${encodeURIComponent(serialNumber)}/measurement/true`,
      "GET"
    );
  }

  async getDeviceInformation(
    deviceIdentity: string
  ): Promise<DeviceInformation> {
    return this.makeAuthorizedRequest<DeviceInformation>(
      `/devices/device/${encodeURIComponent(deviceIdentity)}/information/false`,
      "GET"
    );
  }

  async getDeviceTitle(deviceIdentity: string): Promise<DeviceTitle> {
    return this.makeAuthorizedRequest<DeviceTitle>(
      `/devices/device/${encodeURIComponent(deviceIdentity)}/title/false`,
      "GET"
    );
  }

  async validateToken(): Promise<boolean> {
    if (!this.accessToken) {
      this.log("Token validation check: No access token available.");
      return false;
    }
    try {
      this.log("Validating token by attempting to fetch user info...");
      await this.getUserInfo();
      this.log(
        "Token validation check: Successfully fetched user info, token appears valid."
      );
      return true;
    } catch (error) {
      this.error(
        `Token validation check failed: ${
          error instanceof Error
            ? error.message
            : this.formatAxiosError(error as AxiosError)
        }`
      );
      return false;
    }
  }

  private formatAxiosError(error: AxiosError): string {
    if (error.response) {
      const status = error.response.status;
      let responseData = error.response.data;
      if (typeof responseData === "object" && responseData !== null) {
        try {
          responseData = JSON.stringify(responseData);
        } catch (e) {
          responseData = "(Could not stringify response data)";
        }
      }
      return `Status ${status} - Response: ${
        responseData || "(No response data)"
      }`;
    }

    if (error.request) {
      return "No response received from server.";
    }

    return `Error setting up request: ${error.message}`;
  }
}
