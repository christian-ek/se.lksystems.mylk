import { SimpleClass } from "homey";
import type Homey from "homey/lib/Homey";
import axios from "axios";
import type {
  AxiosRequestConfig,
  AxiosError,
  RawAxiosRequestHeaders,
  AxiosResponse,
  Method,
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
  SenseTemperatureDTO,
} from "./lk-types";
import { ValveState } from "./lk-types";

export const HttpMethod: Record<string, Method> = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
};

export class LkApi extends SimpleClass {
  private readonly SUBSCRIPTION_KEY: string =
    "deb63224fa0443d5a8e9167e88b4b4d9";
  private readonly apiHost: string;
  private email: string;
  private password: string;
  private accessToken: string | null | undefined;
  private refreshToken: string | null | undefined;
  private homey: Homey;
  public debug = true;

  constructor(
    email: string,
    password: string,
    homey: Homey,
    apiHost = "https://lk-home-assistant-dev.azure-api.net"
  ) {
    super();

    this.homey = homey;
    this.email = email;
    this.password = password;
    this.apiHost = apiHost;

    this.log("Initializing with email:", email, "host:", apiHost);

    if (!email || !password) {
      this.error("Email and/or password not provided to LkApi constructor.");
      throw new Error("LkApi requires valid email and password.");
    }

    this.loadTokens();
    this.log("Initialized for host:", apiHost);

    axios.defaults.headers.common = {
      "Content-Type": "application/json",
      "Api-Version": "1.0",
      "Ocp-Apim-Subscription-Key": this.SUBSCRIPTION_KEY,
    };

    this.setupAxiosInterceptor();
  }

  // biome-ignore lint/suspicious/noExplicitAny: logs
  log(...args: any[]): void {
    // Format date for console log
    const date = new Date();
    const formattedDate = `${date.toISOString().split("T")[0]} ${
      date.toTimeString().split(" ")[0]
    }`;

    console.log(formattedDate, "[log]", "[LkApi]", ...args);
  }

  // biome-ignore lint/suspicious/noExplicitAny: logs
  error(...args: any[]): void {
    // Format date for console log
    const date = new Date();
    const formattedDate = `${date.toISOString().split("T")[0]} ${
      date.toTimeString().split(" ")[0]
    }`;

    console.error(formattedDate, "[error]", "[LkApi]", ...args);
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

    if (access) {
      this.log("Saved new access token.");
    } else {
      this.log("Cleared access token.");
    }

    if (refresh) {
      this.log("Saved new refresh token.");
    } else {
      this.log("Cleared refresh token.");
    }
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
        `${this.apiHost}/auth/auth/login`,
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
      const errorMsg = `Login failed: ${
        error instanceof Error
          ? error.message
          : this.formatAxiosError(error as AxiosError)
      }`;
      this.error(errorMsg);
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
        `${this.apiHost}/auth/auth/refresh`,
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
      const errorMsg = `Token refresh failed: ${
        error instanceof Error
          ? error.message
          : this.formatAxiosError(error as AxiosError)
      }`;
      this.error(errorMsg);
      throw error;
    }
  }

  private async makeAuthorizedRequest<T>(
    fullPath: string,
    method: Method = HttpMethod.GET,
    data?: unknown
  ): Promise<T> {
    if (!this.accessToken) {
      this.log(
        `No access token found before ${method} ${fullPath}. Attempting login.`
      );
      try {
        await this.login();
        if (!this.accessToken) {
          throw new Error("Failed to obtain valid access token via login.");
        }
        this.log("Login successful, proceeding with original request.");
      } catch (loginError) {
        const errorMsg = `Login attempt failed during authorized request: ${
          loginError instanceof Error ? loginError.message : String(loginError)
        }`;
        this.error(errorMsg);
        throw new Error(
          `Authentication required for ${method} ${fullPath}, but login failed.`
        );
      }
    }

    const fullUrl = `${this.apiHost}${fullPath}`;

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

    // Debug log for request
    if (this.debug) {
      const requestHeaders = { ...config.headers };
      if ("Authorization" in requestHeaders) {
        requestHeaders.Authorization = "Bearer ****";
      }

      this.log("DEBUG:", `REQUEST ${method} ${fullUrl}`);
      this.log("DEBUG:", `Headers: ${JSON.stringify(requestHeaders)}`);
      if (data) {
        this.log("DEBUG:", `Body: ${JSON.stringify(data)}`);
      }
    }

    try {
      const response: AxiosResponse<T> = await axios(config);

      // Debug log for response
      if (this.debug) {
        this.log("DEBUG:", `RESPONSE ${method} ${fullUrl}`);
        this.log("DEBUG:", `Status: ${response.status}`);
        this.log("DEBUG:", `Data: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      const errorMsg = `Error during ${method} ${fullUrl}: ${
        error instanceof Error
          ? error.message
          : this.formatAxiosError(error as AxiosError)
      }`;

      this.error(errorMsg);
      throw error;
    }
  }

  async getUserInfo(): Promise<UserInfo> {
    return this.makeAuthorizedRequest<UserInfo>(
      "/auth/auth/user",
      HttpMethod.GET
    );
  }

  async getUserStructure(userId: string): Promise<RealEstateStructure[]> {
    return this.makeAuthorizedRequest<RealEstateStructure[]>(
      `/service/users/user/${encodeURIComponent(userId)}/structure/false`,
      HttpMethod.GET
    );
  }

  async getRealEstateTitle(realestateId: string): Promise<RealEstate> {
    return this.makeAuthorizedRequest<RealEstate>(
      `/service/structure/realestate/${encodeURIComponent(
        realestateId
      )}/title/false`,
      HttpMethod.GET
    );
  }

  async getRealEstateMeasurements(
    realestateId: string
  ): Promise<DeviceMeasurement[]> {
    return this.makeAuthorizedRequest<DeviceMeasurement[]>(
      `/service/structure/realestate/${encodeURIComponent(
        realestateId
      )}/measurements/false`,
      HttpMethod.GET
    );
  }

  async getRealEstateMachines(realestateId: string): Promise<DeviceTitle[]> {
    return this.makeAuthorizedRequest<DeviceTitle[]>(
      `/service/structure/realestate/${encodeURIComponent(
        realestateId
      )}/realestateMachines/false`,
      HttpMethod.GET
    );
  }

  async getArcHubConfiguration(serialNumber: string): Promise<ArcHubConfig> {
    return this.makeAuthorizedRequest<ArcHubConfig>(
      `/service/arc/hub/${encodeURIComponent(
        serialNumber
      )}/configuration/false`,
      HttpMethod.GET
    );
  }

  async getArcHubMeasurement(serialNumber: string): Promise<ArcHubMeasurement> {
    return this.makeAuthorizedRequest<ArcHubMeasurement>(
      `/service/arc/hub/${encodeURIComponent(serialNumber)}/measurement/false`,
      HttpMethod.GET
    );
  }

  async getArcHubStructure(serialNumber: string): Promise<HubStructure> {
    return this.makeAuthorizedRequest<HubStructure>(
      `/service/arc/hub/${encodeURIComponent(serialNumber)}/structure/false`,
      HttpMethod.GET
    );
  }

  async getArcSenseConfiguration(mac: string): Promise<ArcSenseConfig> {
    return this.makeAuthorizedRequest<ArcSenseConfig>(
      `/service/arc/sense/${encodeURIComponent(mac)}/configuration/false`,
      HttpMethod.GET
    );
  }

  async getArcSenseMeasurement(mac: string): Promise<ArcSenseMeasurement> {
    return this.makeAuthorizedRequest<ArcSenseMeasurement>(
      `/service/arc/sense/${encodeURIComponent(mac)}/measurement/true`,
      HttpMethod.GET
    );
  }

  async getCubicSecureConfiguration(
    serialNumber: string
  ): Promise<CubicSecureConfig> {
    return this.makeAuthorizedRequest<CubicSecureConfig>(
      `/service/cubic/secure/${encodeURIComponent(
        serialNumber
      )}/configuration/true`,
      HttpMethod.GET
    );
  }

  async getCubicSecureMeasurement(
    serialNumber: string
  ): Promise<CubicSecureMeasurement> {
    return this.makeAuthorizedRequest<CubicSecureMeasurement>(
      `/service/cubic/secure/${encodeURIComponent(
        serialNumber
      )}/measurement/true`,
      HttpMethod.GET
    );
  }

  async getCubicDetectorConfiguration(
    serialNumber: string
  ): Promise<CubicDetectorConfig> {
    return this.makeAuthorizedRequest<CubicDetectorConfig>(
      `/service/cubic/detector/${encodeURIComponent(
        serialNumber
      )}/configuration/false`,
      HttpMethod.GET
    );
  }

  async getCubicDetectorMeasurement(
    serialNumber: string
  ): Promise<CubicDetectorMeasurement> {
    return this.makeAuthorizedRequest<CubicDetectorMeasurement>(
      `/service/cubic/detector/${encodeURIComponent(
        serialNumber
      )}/measurement/true`,
      HttpMethod.GET
    );
  }

  async getDeviceInformation(
    deviceIdentity: string
  ): Promise<DeviceInformation> {
    return this.makeAuthorizedRequest<DeviceInformation>(
      `/service/devices/device/${encodeURIComponent(
        deviceIdentity
      )}/information/false`,
      HttpMethod.GET
    );
  }

  async getDeviceTitle(deviceIdentity: string): Promise<DeviceTitle> {
    return this.makeAuthorizedRequest<DeviceTitle>(
      `/service/devices/device/${encodeURIComponent(
        deviceIdentity
      )}/title/false`,
      HttpMethod.GET
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
      const errorMsg = `Token validation check failed: ${
        error instanceof Error
          ? error.message
          : this.formatAxiosError(error as AxiosError)
      }`;
      this.error(errorMsg);
      return false;
    }
  }

  async updateArcSenseTemperature(
    mac: string,
    temperature: number
  ): Promise<boolean> {
    try {
      const data: SenseTemperatureDTO = { temperature };
      await this.makeAuthorizedRequest<SenseTemperatureDTO>(
        `/control/arc/sense/${encodeURIComponent(mac)}/temperature`,
        HttpMethod.POST,
        data
      );

      this.log(`Temperature for ${mac} updated to ${temperature}`);
      return true;
    } catch (error) {
      const errorMsg = `Failed to update temperature for ${mac}: ${this.formatAxiosError(
        error as AxiosError
      )}`;
      this.error(errorMsg);
      return false;
    }
  }

  async updateCubicSecureValveState(
    serialNumber: string,
    state: ValveState
  ): Promise<boolean> {
    try {
      const endpoint =
        state === ValveState.OPEN
          ? `/control/cubic/secure/${encodeURIComponent(
              serialNumber
            )}/valve/open`
          : `/control/cubic/secure/${encodeURIComponent(
              serialNumber
            )}/valve/close`;

      await this.makeAuthorizedRequest(endpoint, HttpMethod.POST);

      this.log(`Valve for ${serialNumber} set to ${state}`);
      return true;
    } catch (error) {
      const errorMsg = `Failed to update valve state for ${serialNumber}: ${this.formatAxiosError(
        error as AxiosError
      )}`;
      this.error(errorMsg);
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
