import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from '../constants/map';
import type { Coordinate } from '../types/location';

export type RouteMapProps = {
  center?: Coordinate;
  userLocation?: Coordinate;
};

export function RouteMap({ center, userLocation }: RouteMapProps) {
  const coordinate = center ?? userLocation;

  if (!coordinate) return null;

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        ...coordinate,
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA,
      }}
      showsUserLocation={Boolean(userLocation)}
      showsMyLocationButton={Boolean(userLocation)}
    >
      {userLocation ? <Marker coordinate={userLocation} title="Min position" /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
