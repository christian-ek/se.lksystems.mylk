/**
 * Configuration interface for the Lk API client
 */
export interface LkPlatformConfig {
  email: string;
  password: string;
  apiHost?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Authentication request interface
 */
export interface LoginRequest {
  email: string | null;
  password: string | null;
}

/**
 * Refresh token request interface
 */
export interface RefreshRequest {
  refreshToken: string | null;
}

/**
 * Authentication response interface
 */
export interface LoginResponse {
  accessToken: string | null;
  accessTokenExpire: number;
  refreshToken: string | null;
  refreshTokenExpire: number;
}

/**
 * Basic user information from auth endpoint
 */
export interface User {
  userId: string | null;
}

/**
 * Extended user information
 */
export interface UserInfo {
  userId: string | null;
  adId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  lastActivityTime: string | null;
  appVersion?: {
    [key: string]: string;
  } | null;
  cacheUpdated: number;
}

/**
 * Zone interface used throughout the API
 */
export interface Zone {
  zoneId: string | null;
  zoneName: string | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Real Estate interface
 */
export interface RealEstate {
  realestateId: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  country: string | null;
  coordinates: string | null;
  ownerId: string | null;
  status: string | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * ArcHub Configuration interface
 */
export interface ArcHubConfig {
  mode: number;
  humidityLimit: number;
  modeString: string | null;
  ledsEnabled: boolean | null;
  actuatorType: string | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * ArcHub Measurement interface
 */
export interface ArcHubMeasurement {
  serialNumber: string | null;
  iotId: string | null;
  connectionState: ConnectionState | null;
  rssi: number;
  isWired: boolean;
  lastActivityTime: string | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * ArcSense Measurement interface
 *
 * Temperature and humidity values are integers multiplied by 10:
 * - 235 = 23.5°C
 * - 450 = 45.0% humidity
 */
export interface ArcSenseMeasurement {
  mac: string | null;
  currentTemperature: number | null;
  currentHumidity: number | null;
  currentRssi: number | null;
  currentBattery: number | null;
  desiredTemperature: number | null;
  lastActivityTime: string | null;
  connectionState: ConnectionState | null;
  actuators: Array<{
    n: number; // Actuator number
    s: number; // Actuator state (0 = off, 1 = on)
  }> | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * ArcSense Configuration interface
 */
export interface ArcSenseConfig {
  hub: string | null;
  mac: string | null;
  wired: boolean | null;
  byPass: boolean | null;
  bleBleNode: boolean | null;
  bleBleClients: string[] | null;
  busBleNode: boolean | null;
  busBleClients: string[] | null;
  actuators: number[] | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * LeakState enum for leak detection systems
 */
export enum LeakState {
  NO_LEAK = "noLeak",
  PRESSURE = "pressure",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
  FORCE_OPEN = "forceOpen",
}

/**
 * CubicLeak interface for leak information
 */
export interface CubicLeak {
  leakState: LeakState | null;
  meanFlow: number;
  dateStartedAt: number;
  dateUpdatedAt: number;
  acknowledged: string | null;
}

/**
 * CubicSecure Configuration interface
 */
export interface CubicSecureConfig {
  firmwareVersion: string | null;
  hardwareVersion: number | null;
  timeZonePosix: string | null;
  valveState: ValveState | null;
  thresholds?: {
    pressure?: {
      sensitivity?: number;
      duration?: number;
      closeDelay?: number;
      notificationDelay?: number;
    };
    leakMedium?: {
      threshold?: number;
      closeDelay?: number;
      notificationDelay?: number;
    };
    leakLarge?: {
      threshold?: number;
      closeDelay?: number;
      notificationDelay?: number;
    };
  };
  links?: Record<string, unknown>[];
  paired?: {
    role?: string;
    serial?: string;
  };
  muteLeak?: number;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * CubicSecure Measurement interface
 */
export interface CubicSecureMeasurement {
  serialNumber: string | null;
  connectionState: ConnectionState | null;
  rssi: number;
  currentRssi: number;
  lastStatus: number;
  type: string | null;
  subType: string | null;
  tempAmbient: number;
  tempWaterAverage: number;
  tempWaterMin: number;
  tempWaterMax: number;
  volumeTotal: number;
  volumeTotalDay?: number;
  waterPressure: number;
  leak: CubicLeak;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * CubicDetector Configuration interface
 */
export interface CubicDetectorConfig {
  firmwareVersion: string | null;
  hardwareVersion: string | null;
  links?: Record<string, unknown>[];
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * CubicDetector Measurement interface
 */
export interface CubicDetectorMeasurement {
  serialNumber: string | null;
  connectionState: ConnectionState | null;
  rssi: number;
  currentRssi: number;
  currentBattery: number;
  tempAmbient: number;
  currentHumidity: number;
  lastStatus: number;
  type: string | null;
  leak: CubicLeak;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Device Title interface (common across device types)
 */
export interface DeviceTitle {
  identity: string | null;
  externalId?: string | null;
  deviceGroup: string | null;
  deviceType: string | null;
  deviceRole: string | null;
  realestateId: string | null;
  realestateMachineId: string | null;
  zone: Zone;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Device Information interface
 */
export interface DeviceInformation {
  identity: string | null;
  productionNumber?: string | null;
  productType?: string | null;
  modelNumber?: string | null;
  articleNumber?: string | null;
  shopOrderNumber?: string | null;
  dateCreated?: string | null;
  cacheUpdated?: number;
  realestateMachineId?: string | null;
  realestateId?: string | null;
  [key: string]: string | number | boolean | null | undefined; // Device information is returned as key-value pairs
}

/**
 * Structure data for real estate
 */
export interface RealEstateStructure {
  realestateId: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  country: string | null;
  coordinates: string | null;
  ownerId: string | null;
  status: string | null;
  userPermissions: UserPermissions[] | null;
  realestateMachines: DeviceTitle[] | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * User permissions
 */
export interface UserPermissions {
  productPermissionId: string | null;
  name: string | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Hub Structure response from arc/hub/{serial_number}/structure
 */
export interface HubStructure {
  devices: HubStructureDevice[] | null;
  cacheTimer?: number;
  cacheUpdated?: number;
}

/**
 * Hub Structure Device information
 */
export interface HubStructureDevice {
  mac: string | null;
  deviceTitle: DeviceTitle;
  measurement: ArcSenseMeasurement;
  configuration: ArcSenseConfig;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Device measurement for realestate measurements endpoint
 */
export interface DeviceMeasurement {
  identity: string | null;
  deviceGroup: string | null;
  deviceType: string | null;
  deviceRole: string | null;
  realestateId: string | null;
  realestateMachineId: string | null;
  zone: Zone;
  measurements: DeviceMeasurementData | null;
  cacheTimer?: number;
  cacheUpdated: number;
}

/**
 * Response from arc/sense/{mac}/structure endpoint
 * Note: Based on API documentation, this appears to use the same structure as HubStructure
 */
export interface SenseStructure extends HubStructure {}

/**
 * Dynamic measurement data based on device type
 */
export interface DeviceMeasurementData {
  connectionState?: ConnectionState;
  currentTemperature?: number | string;
  currentHumidity?: number | string;
  currentRssi?: number | string;
  currentBattery?: number | string;
  desiredTemperature?: number | string;
  lastActivityTime?: string;
  rssi?: number | string;
  isWired?: boolean | string;
  subType?: string;
  tempAmbient?: number | string;
  tempWaterAverage?: number | string;
  tempWaterMin?: number | string;
  tempWaterMax?: number | string;
  volumeTotal?: number | string;
  waterPressure?: number | string;
  [key: string]: string | number | boolean | undefined | null;
}

/*
 * Connection state enum
 */
export enum ConnectionState {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
}

/**
 * ValveState enum for CubicSecure valves
 */
export enum ValveState {
  OPEN = "open",
  CLOSED = "closed",
}

/**
 * HubMode enum for ArcHub modes
 */
export enum HubMode {
  OFF = 0,
  HEATING = 1,
  COOLING = 2,
}

/**
 * Temperature update request payload for setting
 * the desired temperature on an Arc Sense device
 */
export interface TemperatureUpdateRequest {
  desiredTemperature: number; // Target temperature in API format (e.g., 230 = 23.0°C)
}
