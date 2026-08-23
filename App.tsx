import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from './src/constants/map';
import { searchAddress, type GeocodingResult } from './src/services/geocoding';
import { deleteRoute, loadRoutes, saveRoute } from './src/services/routeStorage';
import { useCurrentLocation } from './src/hooks/useCurrentLocation';
import type { Coordinate } from './src/types/location';
import type { Route, RoutePoint } from './src/types/route';

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
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showRoutes, setShowRoutes] = useState(false);
  const [routeName, setRouteName] = useState('Min rutt');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [message, setMessage] = useState('');

  const userCoordinate = useMemo<Coordinate | undefined>(
    () => (location ? { latitude: location.latitude, longitude: location.longitude } : undefined),
    [location],
  );

  useEffect(() => {
    loadRoutes().then(setRoutes).catch(() => setRoutes([]));
  }, []);

  const addCoordinate = (coordinate: Coordinate, label?: string) => {
    setPoints(current => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        label: label ?? `Stopp ${current.length + 1}`,
        ...coordinate,
      },
    ]);
  };

  const addPoint = (event: MapPressEvent) => addCoordinate(event.nativeEvent.coordinate);

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
      current.filter(point => point.id !== id).map((point, index) => ({
        ...point,
        label: point.label?.startsWith('Stopp ') ? `Stopp ${index + 1}` : point.label,
      })),
    );
  };

  const clearPoints = () => setPoints([]);

  const fitRoute = () => {
    if (!points.length) return;
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 180, right: 50, bottom: 180, left: 50 },
      animated: true,
    });
  };

  const performSearch = async () => {
    if (!addressQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      setAddressResults(await searchAddress(addressQuery));
    } catch (searchException) {
      setSearchError(searchException instanceof Error ? searchException.message : 'Sökningen misslyckades.');
    } finally {
      setSearching(false);
    }
  };

  const selectAddress = (result: GeocodingResult) => {
    addCoordinate(result, result.displayName.split(',').slice(0, 2).join(', '));
    setAddressQuery('');
    setAddressResults([]);
    setShowAddressSearch(false);
    mapRef.current?.animateToRegion(
      {
        ...result,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500,
    );
  };

  const openEditor = (point: RoutePoint) => {
    setEditingPoint(point);
    setEditLabel(point.label ?? '');
  };

  const saveEditedPoint = () => {
    if (!editingPoint) return;
    setPoints(current =>
      current.map(point =>
        point.id === editingPoint.id ? { ...point, label: editLabel.trim() || point.label } : point,
      ),
    );
    setEditingPoint(null);
  };

  const saveCurrentRoute = async () => {
    if (!points.length) {
      setMessage('Lägg till minst ett stopp först.');
      return;
    }
    const now = Date.now();
    const route: Route = {
      id: `${now}`,
      name: routeName.trim() || 'Min rutt',
      points,
      createdAt: now,
      updatedAt: now,
    };
    await saveRoute(route);
    setRoutes(await loadRoutes());
    setShowSaveDialog(false);
    setMessage(`Sparade "${route.name}".`);
  };

  const loadSavedRoute = (route: Route) => {
    setPoints(route.points);
    setRouteName(route.name);
    setShowRoutes(false);
    setMessage(`Laddade "${route.name}".`);
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(route.points, {
        edgePadding: { top: 180, right: 50, bottom: 180, left: 50 },
        animated: true,
      });
    }, 100);
  };

  const removeSavedRoute = async (route: Route) => {
    await deleteRoute(route.id);
    setRoutes(await loadRoutes());
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={userCoordinate ? { ...userCoordinate, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: DEFAULT_LONGITUDE_DELTA } : FALLBACK_REGION}
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
                title={`${index + 1}. ${point.label ?? `Stopp ${index + 1}`}`}
                description={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                onCalloutPress={() => openEditor(point)}
              />
            ))
          : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeWidth={5} strokeColor="#1769e0" /> : null}
      </MapView>

      <View style={[styles.header, { top: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>RouteMapper</Text>
            <Text style={styles.subtitle}>
              {location ? (points.length ? `${points.length} stopp` : 'Lägg till stopp på kartan') : error ? 'Positionen kunde inte hämtas' : 'Hämtar position...'}
            </Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => setShowAddressSearch(true)}>
            <Text style={styles.headerButtonText}>Adress</Text>
          </Pressable>
        </View>
      </View>

      {points.length > 0 ? (
        <View style={[styles.stopPanel, { top: insets.top + 92 }]}>
          <View style={styles.stopPanelHeader}>
            <Text style={styles.stopPanelTitle}>Stopp ({points.length})</Text>
            <Pressable onPress={() => setShowStops(value => !value)}><Text style={styles.panelAction}>{showStops ? 'Dölj' : 'Visa'}</Text></Pressable>
          </View>
          {points.slice(-6).map((point, index, visible) => {
            const actualIndex = points.length - visible.length + index;
            return (
              <View key={point.id} style={styles.stopRow}>
                <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{actualIndex + 1}</Text></View>
                <Pressable style={styles.stopDetails} onPress={() => openEditor(point)}>
                  <Text style={styles.stopName}>{point.label ?? `Stopp ${actualIndex + 1}`}</Text>
                  <Text style={styles.stopCoordinates}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
                </Pressable>
                <Pressable onPress={() => removePoint(point.id)} hitSlop={8}><Text style={styles.removeText}>×</Text></Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {!location && !error ? <View style={styles.loadingCard}><ActivityIndicator /><Text style={styles.loadingText}>Hämtar din position...</Text></View> : null}
      {message ? <Pressable style={[styles.messageCard, { top: insets.top + 170 }]} onPress={() => setMessage('')}><Text style={styles.messageText}>{message}</Text></Pressable> : null}

      <View style={[styles.controls, { bottom: insets.bottom + 18 }]}>
        <Pressable onPress={centerOnLocation} disabled={!userCoordinate} style={styles.controlButton}><Text style={styles.controlIcon}>⌖</Text><Text style={styles.controlText}>Min position</Text></Pressable>
        {points.length > 0 ? <Pressable onPress={fitRoute} style={styles.controlButton}><Text style={styles.controlText}>Visa rutt</Text></Pressable> : null}
        <Pressable onPress={() => setShowRoutes(true)} style={styles.controlButton}><Text style={styles.controlText}>Sparade</Text></Pressable>
        {points.length > 0 ? <Pressable onPress={() => setShowSaveDialog(true)} style={styles.controlButton}><Text style={styles.controlText}>Spara</Text></Pressable> : null}
      </View>

      <Modal visible={showAddressSearch} transparent animationType="slide" onRequestClose={() => setShowAddressSearch(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Lägg till adress</Text><Pressable onPress={() => setShowAddressSearch(false)}><Text style={styles.closeText}>Stäng</Text></Pressable></View>
            <View style={styles.searchRow}>
              <TextInput value={addressQuery} onChangeText={setAddressQuery} onSubmitEditing={performSearch} placeholder="Sök adress, ort eller postnummer" style={styles.input} autoFocus />
              <Pressable onPress={performSearch} style={styles.searchButton}><Text style={styles.searchButtonText}>{searching ? '...' : 'Sök'}</Text></Pressable>
            </View>
            {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
            {addressResults.map(result => (
              <Pressable key={`${result.latitude}-${result.longitude}`} style={styles.resultRow} onPress={() => selectAddress(result)}>
                <Text style={styles.resultTitle}>{result.displayName}</Text>
                <Text style={styles.resultHint}>Tryck för att lägga till som stopp</Text>
              </Pressable>
            ))}
            {!searching && addressQuery.trim() && !addressResults.length && !searchError ? <Text style={styles.emptyText}>Inga träffar ännu.</Text> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingPoint)} transparent animationType="fade" onRequestClose={() => setEditingPoint(null)}>
        <View style={styles.modalBackdrop}><View style={styles.smallModalCard}>
          <Text style={styles.modalTitle}>Redigera stopp</Text>
          <TextInput value={editLabel} onChangeText={setEditLabel} placeholder="Namn på stopp" style={styles.inputFull} />
          <View style={styles.modalActions}><Pressable onPress={() => setEditingPoint(null)} style={styles.secondaryButton}><Text>Avbryt</Text></Pressable><Pressable onPress={saveEditedPoint} style={styles.primaryButton}><Text style={styles.primaryText}>Spara</Text></Pressable></View>
        </View></View>
      </Modal>

      <Modal visible={showSaveDialog} transparent animationType="fade" onRequestClose={() => setShowSaveDialog(false)}>
        <View style={styles.modalBackdrop}><View style={styles.smallModalCard}>
          <Text style={styles.modalTitle}>Spara rutt</Text>
          <TextInput value={routeName} onChangeText={setRouteName} placeholder="Ruttnamn" style={styles.inputFull} />
          <View style={styles.modalActions}><Pressable onPress={() => setShowSaveDialog(false)} style={styles.secondaryButton}><Text>Avbryt</Text></Pressable><Pressable onPress={saveCurrentRoute} style={styles.primaryButton}><Text style={styles.primaryText}>Spara</Text></Pressable></View>
        </View></View>
      </Modal>

      <Modal visible={showRoutes} transparent animationType="slide" onRequestClose={() => setShowRoutes(false)}>
        <View style={styles.modalBackdrop}><View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Sparade rutter</Text><Pressable onPress={() => setShowRoutes(false)}><Text style={styles.closeText}>Stäng</Text></Pressable></View>
          {routes.map(route => (
            <View key={route.id} style={styles.savedRouteRow}>
              <Pressable style={styles.savedRouteMain} onPress={() => loadSavedRoute(route)}><Text style={styles.resultTitle}>{route.name}</Text><Text style={styles.resultHint}>{route.points.length} stopp</Text></Pressable>
              <Pressable onPress={() => removeSavedRoute(route)}><Text style={styles.removeText}>×</Text></Pressable>
            </View>
          ))}
          {!routes.length ? <Text style={styles.emptyText}>Inga sparade rutter.</Text> : null}
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { position: 'absolute', left: 14, right: 14, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', elevation: 5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  subtitle: { marginTop: 3, fontSize: 13, color: '#555' },
  headerButton: { backgroundColor: '#1769e0', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 },
  headerButtonText: { color: '#fff', fontWeight: '700' },
  loadingCard: { position: 'absolute', alignSelf: 'center', top: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)', elevation: 4 },
  loadingText: { color: '#222' },
  messageCard: { position: 'absolute', left: 16, right: 16, padding: 11, borderRadius: 12, backgroundColor: 'rgba(20,20,20,0.9)' },
  messageText: { color: '#fff', textAlign: 'center' },
  stopPanel: { position: 'absolute', left: 14, right: 14, maxHeight: 300, padding: 11, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)', elevation: 5 },
  stopPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stopPanelTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  panelAction: { fontSize: 13, color: '#1769e0', fontWeight: '600' },
  stopRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  stopNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1769e0' },
  stopNumberText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stopDetails: { flex: 1, marginLeft: 10 },
  stopName: { fontSize: 13, fontWeight: '600', color: '#111' },
  stopCoordinates: { marginTop: 1, fontSize: 11, color: '#666' },
  removeText: { fontSize: 25, lineHeight: 25, color: '#a00', paddingHorizontal: 7 },
  controls: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7 },
  controlButton: { minHeight: 46, paddingHorizontal: 12, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.97)', flexDirection: 'row', alignItems: 'center', gap: 5, elevation: 5 },
  controlIcon: { fontSize: 22, color: '#1769e0' },
  controlText: { color: '#111', fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  smallModalCard: { margin: 24, padding: 18, borderRadius: 18, backgroundColor: '#fff', elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: '#111' },
  closeText: { color: '#1769e0', fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 12, color: '#111' },
  inputFull: { minHeight: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 12, marginTop: 12, color: '#111' },
  searchButton: { minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#1769e0' },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  resultRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  resultTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  resultHint: { marginTop: 3, fontSize: 11, color: '#666' },
  errorText: { marginTop: 10, color: '#a00' },
  emptyText: { marginTop: 18, textAlign: 'center', color: '#777' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  secondaryButton: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, backgroundColor: '#eee' },
  primaryButton: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 11, backgroundColor: '#1769e0' },
  primaryText: { color: '#fff', fontWeight: '700' },
  savedRouteRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd', paddingVertical: 10 },
  savedRouteMain: { flex: 1 },
});

export default App;
