import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from './src/constants/map';
import { useCurrentLocation } from './src/hooks/useCurrentLocation';
import type { Coordinate } from './src/types/location';
import type { RoutePoint } from './src/types/route';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { location, error } = useCurrentLocation();
  const [points, setPoints] = useState<RoutePoint[]>([]);

  const userCoordinate = useMemo<Coordinate | undefined>(
    () =>
      location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    [location],
  );

  const addPoint = (event: MapPressEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    setPoints(current => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        label: `Stopp ${current.length + 1}`,
        ...coordinate,
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {userCoordinate ? (
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            ...userCoordinate,
            latitudeDelta: DEFAULT_LATITUDE_DELTA,
            longitudeDelta: DEFAULT_LONGITUDE_DELTA,
          }}
          showsUserLocation
          showsMyLocationButton
          onPress={addPoint}>
          {points.map(point => (
            <Marker
              key={point.id}
              coordinate={point}
              title={point.label}
              description={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.emptyMap} />
      )}

      <View style={[styles.header, { top: insets.top + 12 }]}>
        <Text style={styles.title}>RouteMapper</Text>
        <Text style={styles.subtitle}>
          {location
            ? `${points.length} stopp`
            : error
              ? 'Kunde inte hämta position'
              : 'Hämtar position...'}
        </Text>
      </View>

      {!location && !error ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Hämtar din position...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorCard, { bottom: insets.bottom + 20 }]}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      ) : null}

      {points.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPoints([])}
          style={[styles.clearButton, { bottom: insets.bottom + 20 }]}>
          <Text style={styles.clearButtonText}>Rensa stopp</Text>
        </Pressable>
      ) : null}

      <View style={[styles.hint, { bottom: insets.bottom + 20 }]}>
        <Text style={styles.hintText}>Tryck på kartan för att lägga till ett stopp</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  emptyMap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e9e9e9' },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 2, fontSize: 13, color: '#555' },
  loadingCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  loadingText: { color: '#222' },
  errorCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  errorText: { color: '#a00' },
  clearButton: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  clearButtonText: { color: '#fff', fontWeight: '600' },
  hint: {
    position: 'absolute',
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  hintText: { fontSize: 12, color: '#444' },
});

export default App;
