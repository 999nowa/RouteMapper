import type { LocationSample } from '../types/location';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied';

export type LocationService = {
  requestPermission: () => Promise<LocationPermissionState>;
  getCurrentLocation: () => Promise<LocationSample>;
};

export const locationService: LocationService = {
  async requestPermission() {
    return 'unknown';
  },

  async getCurrentLocation() {
    throw new Error('Location service is not configured yet.');
  },
};
