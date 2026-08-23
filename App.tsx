import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from './src/constants/map';
import { useCurrentLocation } from './src/hooks/useCurrentLocation';
import type { Coordinate } from './src/types/location';
import type { RoutePoint } from './src/types/route';

const FALLBACK_REGION = {
  latitude: 59.3293,
  longitude: 18.0686,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

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
  const mapRef = useRef<MapView>(null);
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

  const centerOnLocation = () => {
    if (!userCoordinate) return;

    mapRef.current?.animateToRegion(
      {
        ...userCoordinate,
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA,
      },
      500,
    );
  };

  const clearPoints = () => setPoints([]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={
          userCoordinate
            ? {
                ...userCoordinate,
                latitudeDelta: DEFAULT_LATITUDE_DELTA,
                longitudeDelta: DEFAULT_LONGITUDE_DELTA,
              }
            : FALLBACK_REGION
        }
        showsUserLocation={Boolean(userCoordinate)}
        showsMyLocationButton={false}
        showsCompass
        toolbarEnabled
        onPress={addPoint}>
        {points.map(point => (
          <Marker
            key={point.id}
            coordinate={point}
            title={point.label}
            description={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
          />
        ))}

        {points.length > 1 ? (
          <Polyline
            coordinates={points}
            strokeWidth={5}
            strokeColor="#1769e0"
          />
        ) : null}
      </MapView>

      <View style={[styles.header, { top: insets.top + 12 }]}>
        <Text style={styles.title}>RouteMapper</Text>
        <Text style={styles.subtitle}>
          {location
            ? points.length === 0
              ? 'Tryck på kartan för att lägga till stopp'
              : `${points.length} stopp i rutten`
            : error
              ? 'Positionen kunde inte hämtas'
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

      <View style={[styles.controls, { bottom: insets.bottom + 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Centrera på min position"
          disabled={!userCoordinate}
          onPress={centerOnLocation}
          style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
          <Text style={styles.controlIcon}>⌖</Text>
          <Text style={styles.controlText}>Min position</Text>
        </Pressable>

        {points.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rensa alla stopp"
            onPress={clearPoints}
            style={({ pressed }) => [styles.controlButton, styles.darkButton, pressed && styles.pressed]}>
            <Text style={styles.controlTextDark}>Rensa stopp</Text>
          </Pressable>
        ) : null}
      </View>

      {points.length > 0 ? (
        <View style={[styles.routeSummary, { bottom: insets.bottom + 86 }]}>
          <Text style={styles.routeSummaryTitle}>Rutt</Text>
          <Text style={styles.routeSummaryText}>
            {points.length} {points.length === 1 ? 'stopp' : 'stopp'} • Tryck på kartan för nästa
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 3, fontSize: 13, color: '#555' },
  loadingCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    elevation: 4,
  },
  loadingText: { color: '#222' },
  errorCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
  errorText: { color: '#a00' },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  controlButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.97)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },
  darkButton: { backgroundColor: '#111' },
  controlIcon: { fontSize: 23, color: '#1769e0' },
  controlText: { color: '#111', fontWeight: '600' },
  controlTextDark: { color: '#fff', fontWeight: '600' },
  pressed: { opacity: 0.7 },
  routeSummary: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
  routeSummaryTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  routeSummaryText: { marginTop: 2, fontSize: 12, color: '#555' },
});

export default App;
