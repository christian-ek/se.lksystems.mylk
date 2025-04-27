import type { Device } from "homey";
import type Homey from "homey/lib/Homey";

/**
 * Updates a device capability with proper error handling and type conversion
 * @param device The Homey device instance
 * @param capId Capability ID to update
 * @param newValue New value from the API (should already be transformed to the correct format)
 * @returns Promise that resolves when the capability is updated
 */
export const updateCapability = (
  device: Device,
  capId: string,
  newValue: number | boolean | null | undefined
): Promise<void> | undefined => {
  if (!device.hasCapability(capId)) return;

  if (newValue === null || newValue === undefined) return;

  // Get current value for comparison and type detection
  const currentValue = device.getCapabilityValue(capId);
  let valueToSet: number | boolean = newValue;

  // Handle type conversion based on the capability's expected type
  if (typeof currentValue === "boolean") {
    // Convert to boolean if the current capability stores a boolean
    valueToSet = typeof newValue === "number" ? Boolean(newValue) : newValue;
  } else if (typeof currentValue === "number" && typeof newValue !== "number") {
    // Convert to number if the current capability stores a number
    valueToSet = Number(newValue);
  }

  // Only update if the value has changed
  if (device.getCapabilityValue(capId) !== valueToSet) {
    device.log(`Updating ${capId} to ${valueToSet}`);
    return device.setCapabilityValue(capId, valueToSet).catch((err) => {
      device.error(`Failed to set capability ${capId}: ${err.message}`);
    });
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
