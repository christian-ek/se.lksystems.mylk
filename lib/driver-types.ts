// Type definitions for LK Systems device drivers

/**
 * Data for login credentials used in pairing
 */
export interface LoginData {
  username: string;
  password: string;
}

/**
 * Data structure for a real estate (home) selection
 */
export interface RealEstateSelection {
  name: string;
  data: {
    id: string;
    name?: string | null;
    address?: string | null;
    city?: string | null;
  };
  icon: string;
}

/**
 * Base device data structure used in device creation
 */
export interface DeviceData {
  id: string;
  mac: string;
  externalId?: string | null;
  realestateId?: string | null;
  realestateMachineId?: string | null;
  wired?: boolean;
}

/**
 * Complete device item structure returned during pairing
 */
export interface DeviceItem {
  name: string;
  data: DeviceData;
  settings: {
    email: string;
    password: string;
    apiHost?: string;
    interval?: number;
  };
}
