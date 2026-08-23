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
  const [showStops, setShowStops] = useState(true);

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

  const removePoint = (id: string) => {
    setPoints(current =>
      current
        .filter(point => point.id !== id)
        .map((point, index) => ({ ...point, label: `Stopp ${index + 1}` })),
    );
  };

  const clearPoints = () => setPoints([]);

  const fitRoute = () => {
    if (points.length === 0) return;
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 150, right: 50, bottom: 150, left: 50 },
      animated: true,
    });
  };

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
        {showStops
          ? points.map((point, index) => (
              <Marker
                key={point.id}
                coordinate={point}
                title={`Stopp ${index + 1}`}
                description={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
              />
            ))
          : null}

        {points.length > 1 ? (
          <Polyline coordinates={points} strokeWidth={5} strokeColor="#1769e0" />
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

      {points.length > 0 ? (
        <View style={[styles.stopPanel, { top: insets.top + 94 }]}>
          <View style={styles.stopPanelHeader}>
            <Text style={styles.stopPanelTitle}>Stopp ({points.length})</Text>
            <Pressable onPress={() => setShowStops(value => !value)}>
              <Text style={styles.panelAction}>{showStops ? 'Dölj' : 'Visa'}</Text>
            </Pressable>
          </View>
          {points.slice(-5).map((point, index, visiblePoints) => {
            const actualIndex = points.length - visiblePoints.length + index;
            return (
              <View key={point.id} style={styles.stopRow}>
                <View style={styles.stopNumber}>
                  <Text style={styles.stopNumberText}>{actualIndex + 1}</Text>
                </View>
                <View style={styles.stopDetails}>
                  <Text style={styles.stopName}>Stopp {actualIndex + 1}</Text>
                  <Text style={styles.stopCoordinates}>
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ta bort stopp ${actualIndex + 1}`}
                  onPress={() => removePoint(point.id)}
                  hitSlop={8}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            );
          })}
          {points.length > 5 ? (
            <Text style={styles.moreText}>Visar de senaste 5 stoppen</Text>
          ) : null}
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
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Visa hela rutten"
              onPress={fitRoute}
              style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
              <Text style={styles.controlText}>Visa rutt</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rensa alla stopp"
              onPress={clearPoints}
              style={({ pressed }) => [styles.controlButton, styles.darkButton, pressed && styles.pressed]}>
              <Text style={styles.controlTextDark}>Rensa</Text>
            </Pressable>
          </>
        ) : null}
      </View>
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
  stopPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxHeight: 310,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.97)',
    elevation: 5,
  },
  stopPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopPanelTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  panelAction: { fontSize: 13, color: '#1769e0', fontWeight: '600' },
  stopRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  stopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1769e0',
  },
  stopNumberText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stopDetails: { flex: 1, marginLeft: 10 },
  stopName: { fontSize: 13, fontWeight: '600', color: '#111' },
  stopCoordinates: { marginTop: 1, fontSize: 11, color: '#666' },
  removeText: { fontSize: 25, lineHeight: 25, color: '#a00', paddingHorizontal: 6 },
  moreText: { marginTop: 5, fontSize: 11, color: '#777' },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    minHeight: 48,
    paddingHorizontal: 14,
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
});

export default App;
