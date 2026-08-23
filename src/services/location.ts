import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import type { LocationSample } from '../types/location';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied';

export type LocationService = {
  requestPermission: () => Promise<LocationPermissionState>;
  getCurrentLocation: () => Promise<LocationSample>;
};

async function requestAndroidPermission(): Promise<LocationPermissionState> {
  if (Platform.OS !== 'android') return 'granted';

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'RouteMapper behöver din position',
      message: 'Din position används för att visa dig på kartan och bygga rutter.',
      buttonPositive: 'Tillåt',
      buttonNegative: 'Neka',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}

export const locationService: LocationService = {
  async requestPermission() {
    return requestAndroidPermission();
  },

  async getCurrentLocation() {
    const permission = await requestAndroidPermission();

    if (permission !== 'granted') {
      throw new Error('Åtkomst till position nekades.');
    }

    return new Promise<LocationSample>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const { coords } = position;
          resolve({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? undefined,
            altitude: coords.altitude ?? undefined,
            heading: coords.heading ?? undefined,
            speed: coords.speed ?? undefined,
            timestamp: position.timestamp,
          });
        },
        error => reject(new Error(error.message)),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        },
      );
    });
  },
};
