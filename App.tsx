import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from './src/constants/map';
import type { Coordinate } from './src/types/location';

function App() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  async function requestLocation() {
    if (Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        setError('GPS-behörighet nekades.');
        return;
      }
    }

    Geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      locationError => setError(locationError.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {location ? (
          <MapView
            style={styles.map}
            initialRegion={{
              ...location,
              latitudeDelta: DEFAULT_LATITUDE_DELTA,
              longitudeDelta: DEFAULT_LONGITUDE_DELTA,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            <Marker coordinate={location} title="Min position" />
          </MapView>
        ) : (
          <View style={styles.loading}>
            <Text>{error ?? 'Hämtar GPS-position...'}</Text>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default App;
