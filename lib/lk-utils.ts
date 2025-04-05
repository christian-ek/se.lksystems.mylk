import type { Device } from "homey";
import type Homey from "homey/lib/Homey";

/**
 * Updates a device capability with proper error handling
 * @param device The Homey device instance
 * @param capId Capability ID to update
 * @param newValue New value from the API (should already be transformed to the correct format)
 * @returns Promise that resolves when the capability is updated
 */
export const updateCapability = (
  device: Device,
  capId: string,
  newValue: number | null | undefined
): Promise<void> | undefined => {
  if (!device.hasCapability(capId)) return;

  if (newValue === null || newValue === undefined) return;

  if (
    typeof newValue === "number" &&
    device.getCapabilityValue(capId) !== newValue
  ) {
    device.log(`Updating ${capId} to ${newValue}`);
    return device.setCapabilityValue(capId, newValue).catch((err) => {
      device.error(`Failed to set capability ${capId}: ${err.message}`);
    });
  }
  if (typeof newValue !== "number") {
    device.error(`Invalid value type for ${capId}: ${typeof newValue}`);
  }

  return Promise.resolve();
};

/**
 * Helper to convert API temperature (x10) to user temperature
 * @param value API temperature value
 * @returns Human-readable temperature value
 */
export const convertApiTemperature = (value: number): number => value / 10;

/**
 * Helper to convert user temperature to API format (x10)
 * @param value User temperature value
 * @returns API-formatted temperature value
 */
export const convertToApiTemperature = (value: number): number =>
  Math.round(value * 10);

/**
 * Format errors consistently across the application
 * @param error The error object
 * @returns Formatted error message
 */
export const formatError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

/**
 * Schedules an update after the specified seconds
 * @param device The Homey device instance for logging
 * @param homey The Homey instance to schedule with
 * @param updateFn The function to execute when the update is triggered
 * @param seconds Seconds to wait before executing the update
 * @returns The new timeout object
 */
export const scheduleUpdate = (
  device: Device,
  homey: Homey,
  updateFn: () => void,
  seconds: number
): NodeJS.Timeout => {
  device.log(`Scheduling update in ${seconds} seconds`);
  return homey.setTimeout(updateFn, seconds * 1000);
};
