import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_LATITUDE_DELTA, DEFAULT_LONGITUDE_DELTA } from './src/constants/map';
import { searchAddress, type GeocodingResult } from './src/services/geocoding';
import { loadGoogleMapsApiKey, saveGoogleMapsApiKey, clearGoogleMapsApiKey } from './src/services/apiKeyStorage';
import { deleteRoute, loadRoutes, saveRoute } from './src/services/routeStorage';
import { openRouteInOsmAnd } from './src/services/osmand';
import { useCurrentLocation } from './src/hooks/useCurrentLocation';
import type { Coordinate } from './src/types/location';
import type { Route, RoutePoint } from './src/types/route';

const FALLBACK_REGION = { latitude: 59.3293, longitude: 18.0686, latitudeDelta: 8, longitudeDelta: 8 };

function App() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { location, error } = useCurrentLocation();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showStops, setShowStops] = useState(true);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [routeName, setRouteName] = useState('Min rutt');
  const [message, setMessage] = useState('');
  const [showAddress, setShowAddress] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const userCoordinate = useMemo<Coordinate | undefined>(() => location ? { latitude: location.latitude, longitude: location.longitude } : undefined, [location]);

  useEffect(() => { loadRoutes().then(setRoutes).catch(() => setRoutes([])); loadGoogleMapsApiKey().then(setApiKey).catch(() => setApiKey('')); }, []);

  const addCoordinate = (coordinate: Coordinate, label?: string) => setPoints(current => [...current, { id: `${Date.now()}-${current.length}`, label: label ?? `Stopp ${current.length + 1}`, ...coordinate }]);
  const addPoint = (event: MapPressEvent) => addCoordinate(event.nativeEvent.coordinate);
  const centerOnLocation = () => { if (userCoordinate) mapRef.current?.animateToRegion({ ...userCoordinate, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: DEFAULT_LONGITUDE_DELTA }, 500); };
  const fitRoute = () => { if (points.length) mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 180, right: 50, bottom: 180, left: 50 }, animated: true }); };
  const removePoint = (id: string) => setPoints(current => current.filter(p => p.id !== id).map((p, i) => ({ ...p, label: p.label?.startsWith('Stopp ') ? `Stopp ${i + 1}` : p.label })));
  const openEditor = (point: RoutePoint) => { setEditingPoint(point); setEditLabel(point.label ?? ''); };
  const saveEditedPoint = () => { if (!editingPoint) return; setPoints(current => current.map(p => p.id === editingPoint.id ? { ...p, label: editLabel.trim() || p.label } : p)); setEditingPoint(null); };

  const performSearch = async () => {
    if (!addressQuery.trim()) return;
    setSearching(true); setSearchError('');
    try { setAddressResults(await searchAddress(addressQuery)); }
    catch (e) { setSearchError(e instanceof Error ? e.message : 'Sökningen misslyckades.'); }
    finally { setSearching(false); }
  };

  const selectAddress = (result: GeocodingResult) => {
    addCoordinate(result, result.displayName.split(',').slice(0, 2).join(', '));
    setAddressResults([]); setAddressQuery(''); setShowAddress(false);
    mapRef.current?.animateToRegion({ ...result, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  };

  const saveCurrentRoute = async () => {
    if (!points.length) return setMessage('Lägg till minst ett stopp först.');
    const now = Date.now();
    await saveRoute({ id: `${now}`, name: routeName.trim() || 'Min rutt', points, createdAt: now, updatedAt: now });
    setRoutes(await loadRoutes()); setShowSave(false); setMessage(`Sparade "${routeName.trim() || 'Min rutt'}".`);
  };
  const loadSavedRoute = (route: Route) => { setPoints(route.points); setRouteName(route.name); setShowRoutes(false); setTimeout(() => mapRef.current?.fitToCoordinates(route.points, { edgePadding: { top: 180, right: 50, bottom: 180, left: 50 }, animated: true }), 100); };
  const removeSavedRoute = async (route: Route) => { await deleteRoute(route.id); setRoutes(await loadRoutes()); };

  const navigateWithOsmAnd = async () => {
    if (!points.length) return setMessage('Lägg till minst ett stopp först.');
    try {
      const opened = await openRouteInOsmAnd(points, userCoordinate ? { id: 'current', ...userCoordinate } : undefined);
      if (!opened) setMessage('Kunde inte öppna OsmAnd. Kontrollera att OsmAnd är installerat.');
      else if (points.length > 2) setMessage('OsmAnd öppnades med start och slut. Mellanstopp kräver GPX-export i nästa steg.');
    } catch { setMessage('Kunde inte öppna OsmAnd.'); }
  };

  const openSettings = async () => { const key = await loadGoogleMapsApiKey(); setApiKey(key); setApiKeyInput(key); setShowSettings(true); };
  const saveApiKey = async () => { setSavingKey(true); try { await saveGoogleMapsApiKey(apiKeyInput); setApiKey(apiKeyInput.trim()); setShowSettings(false); setMessage(apiKeyInput.trim() ? 'API-nyckeln sparades lokalt på enheten.' : 'API-nyckeln togs bort.'); } finally { setSavingKey(false); } };
  const removeApiKey = () => Alert.alert('Ta bort API-nyckel?', 'Den lokalt sparade nyckeln raderas från enheten.', [{ text: 'Avbryt', style: 'cancel' }, { text: 'Ta bort', style: 'destructive', onPress: async () => { await clearGoogleMapsApiKey(); setApiKey(''); setApiKeyInput(''); setShowSettings(false); setMessage('API-nyckeln raderades.'); } }]);

  return <View style={styles.container}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={userCoordinate ? { ...userCoordinate, latitudeDelta: DEFAULT_LATITUDE_DELTA, longitudeDelta: DEFAULT_LONGITUDE_DELTA } : FALLBACK_REGION} showsUserLocation={Boolean(userCoordinate)} showsMyLocationButton={false} showsCompass toolbarEnabled onPress={addPoint}>
      {showStops ? points.map((point, index) => <Marker key={point.id} coordinate={point} title={`${index + 1}. ${point.label ?? `Stopp ${index + 1}`}`} description={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`} onCalloutPress={() => openEditor(point)} />) : null}
      {points.length > 1 ? <Polyline coordinates={points} strokeWidth={5} strokeColor="#1769e0" /> : null}
    </MapView>

    <View style={[styles.header, { top: insets.top + 10 }]}><View style={styles.headerRow}><View style={styles.headerText}><Text style={styles.title}>RouteMapper</Text><Text style={styles.subtitle}>{location ? `${points.length} stopp` : error ? 'Positionen kunde inte hämtas' : 'Hämtar position...'}</Text></View><Pressable style={styles.headerButton} onPress={() => setShowAddress(true)}><Text style={styles.headerButtonText}>Adress</Text></Pressable><Pressable style={styles.settingsButton} onPress={openSettings}><Text style={styles.settingsText}>⚙</Text></Pressable></View></View>

    {points.length > 0 ? <View style={[styles.stopPanel, { top: insets.top + 92 }]}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Stopp ({points.length})</Text><Pressable onPress={() => setShowStops(v => !v)}><Text style={styles.action}>{showStops ? 'Dölj' : 'Visa'}</Text></Pressable></View>{points.slice(-6).map((point, index, visible) => { const actual = points.length - visible.length + index; return <View key={point.id} style={styles.stopRow}><View style={styles.stopNumber}><Text style={styles.stopNumberText}>{actual + 1}</Text></View><Pressable style={styles.stopDetails} onPress={() => openEditor(point)}><Text style={styles.stopName}>{point.label}</Text><Text style={styles.coordinates}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text></Pressable><Pressable onPress={() => removePoint(point.id)} hitSlop={8}><Text style={styles.remove}>×</Text></Pressable></View>; })}</View> : null}

    {!location && !error ? <View style={styles.loading}><ActivityIndicator /><Text>Hämtar din position...</Text></View> : null}
    {message ? <Pressable style={[styles.message, { top: insets.top + 175 }]} onPress={() => setMessage('')}><Text>{message}</Text></Pressable> : null}

    <View style={[styles.controls, { bottom: insets.bottom + 18 }]}><Pressable onPress={centerOnLocation} style={styles.control}><Text style={styles.controlText}>⌖ Min position</Text></Pressable>{points.length ? <Pressable onPress={fitRoute} style={styles.control}><Text style={styles.controlText}>Visa rutt</Text></Pressable> : null}{points.length ? <Pressable onPress={navigateWithOsmAnd} style={styles.osmandControl}><Text style={styles.osmandText}>Navigera i OsmAnd</Text></Pressable> : null}<Pressable onPress={() => setShowRoutes(true)} style={styles.control}><Text style={styles.controlText}>Sparade</Text></Pressable>{points.length ? <Pressable onPress={() => setShowSave(true)} style={styles.control}><Text style={styles.controlText}>Spara</Text></Pressable> : null}</View>

    <Modal visible={showAddress} transparent animationType="slide" onRequestClose={() => setShowAddress(false)}><View style={styles.backdrop}><View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Lägg till adress</Text><Pressable onPress={() => setShowAddress(false)}><Text style={styles.action}>Stäng</Text></Pressable></View><View style={styles.searchRow}><TextInput value={addressQuery} onChangeText={setAddressQuery} onSubmitEditing={performSearch} placeholder="Adress, ort eller postnummer" style={styles.input} autoFocus /><Pressable onPress={performSearch} style={styles.searchButton}><Text style={styles.searchText}>{searching ? '...' : 'Sök'}</Text></Pressable></View>{searchError ? <Text style={styles.error}>{searchError}</Text> : null}{addressResults.map(result => <Pressable key={`${result.latitude}-${result.longitude}`} style={styles.result} onPress={() => selectAddress(result)}><Text style={styles.resultTitle}>{result.displayName}</Text><Text style={styles.resultHint}>Tryck för att lägga till</Text></Pressable>)}{!searching && addressQuery.trim() && !addressResults.length && !searchError ? <Text style={styles.empty}>Inga träffar.</Text> : null}</View></View></Modal>

    <Modal visible={Boolean(editingPoint)} transparent animationType="fade" onRequestClose={() => setEditingPoint(null)}><View style={styles.backdrop}><View style={styles.smallModal}><Text style={styles.modalTitle}>Redigera stopp</Text><TextInput value={editLabel} onChangeText={setEditLabel} placeholder="Namn på stopp" style={styles.inputFull} /><View style={styles.actions}><Pressable onPress={() => setEditingPoint(null)} style={styles.secondary}><Text>Avbryt</Text></Pressable><Pressable onPress={saveEditedPoint} style={styles.primary}><Text style={styles.primaryText}>Spara</Text></Pressable></View></View></View></Modal>

    <Modal visible={showSave} transparent animationType="fade" onRequestClose={() => setShowSave(false)}><View style={styles.backdrop}><View style={styles.smallModal}><Text style={styles.modalTitle}>Spara rutt</Text><TextInput value={routeName} onChangeText={setRouteName} placeholder="Ruttnamn" style={styles.inputFull} /><View style={styles.actions}><Pressable onPress={() => setShowSave(false)} style={styles.secondary}><Text>Avbryt</Text></Pressable><Pressable onPress={saveCurrentRoute} style={styles.primary}><Text style={styles.primaryText}>Spara</Text></Pressable></View></View></View></Modal>

    <Modal visible={showRoutes} transparent animationType="slide" onRequestClose={() => setShowRoutes(false)}><View style={styles.backdrop}><View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Sparade rutter</Text><Pressable onPress={() => setShowRoutes(false)}><Text style={styles.action}>Stäng</Text></Pressable></View>{routes.map(route => <View key={route.id} style={styles.savedRow}><Pressable style={styles.stopDetails} onPress={() => loadSavedRoute(route)}><Text style={styles.resultTitle}>{route.name}</Text><Text style={styles.resultHint}>{route.points.length} stopp</Text></Pressable><Pressable onPress={() => removeSavedRoute(route)}><Text style={styles.remove}>×</Text></Pressable></View>)}{!routes.length ? <Text style={styles.empty}>Inga sparade rutter.</Text> : null}</View></View></Modal>

    <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}><View style={styles.backdrop}><View style={styles.smallModal}><Text style={styles.modalTitle}>API-inställningar</Text><Text style={styles.description}>Google API-nyckeln sparas lokalt på denna enhet. Den läggs inte i GitHub.</Text><TextInput value={apiKeyInput} onChangeText={setApiKeyInput} placeholder="Klistra in Google API-nyckel" style={styles.inputFull} autoCapitalize="none" autoCorrect={false} secureTextEntry /><Text style={styles.status}>{apiKey ? '✓ Lokal API-nyckel är konfigurerad' : 'Ingen lokal API-nyckel sparad'}</Text><View style={styles.actions}><Pressable onPress={() => setShowSettings(false)} style={styles.secondary}><Text>Avbryt</Text></Pressable>{apiKey ? <Pressable onPress={removeApiKey} style={styles.delete}><Text style={styles.primaryText}>Radera</Text></Pressable> : null}<Pressable disabled={savingKey} onPress={saveApiKey} style={styles.primary}><Text style={styles.primaryText}>{savingKey ? 'Sparar...' : 'Spara'}</Text></Pressable></View></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, header: { position: 'absolute', left: 14, right: 14, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', elevation: 5 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerText: { flex: 1 }, title: { fontSize: 22, fontWeight: '700', color: '#111' }, subtitle: { marginTop: 3, fontSize: 13, color: '#555' }, headerButton: { backgroundColor: '#1769e0', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 }, headerButtonText: { color: '#fff', fontWeight: '700' }, settingsButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }, settingsText: { fontSize: 22 }, stopPanel: { position: 'absolute', left: 14, right: 14, maxHeight: 300, padding: 11, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)', elevation: 5 }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }, panelTitle: { fontSize: 15, fontWeight: '700', color: '#111' }, action: { color: '#1769e0', fontWeight: '700' }, stopRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' }, stopNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1769e0', alignItems: 'center', justifyContent: 'center' }, stopNumberText: { color: '#fff', fontWeight: '700' }, stopDetails: { flex: 1, marginLeft: 10 }, stopName: { fontWeight: '600', color: '#111' }, coordinates: { fontSize: 11, color: '#666' }, remove: { fontSize: 26, color: '#a00', paddingHorizontal: 6 }, loading: { position: 'absolute', alignSelf: 'center', top: '48%', flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#fff', elevation: 4 }, message: { position: 'absolute', left: 16, right: 16, padding: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 4 }, controls: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, control: { minHeight: 48, flexGrow: 1, flexBasis: '20%', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)', alignItems: 'center', justifyContent: 'center', elevation: 5, paddingHorizontal: 8 }, osmandControl: { minHeight: 48, flexGrow: 1, flexBasis: '35%', borderRadius: 14, backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center', elevation: 5, paddingHorizontal: 8 }, controlText: { fontWeight: '600', color: '#111' }, osmandText: { fontWeight: '700', color: '#fff' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' }, modal: { maxHeight: '82%', padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#fff' }, smallModal: { margin: 20, padding: 18, borderRadius: 18, backgroundColor: '#fff', elevation: 8 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, modalTitle: { fontSize: 19, fontWeight: '700', color: '#111' }, searchRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingHorizontal: 12, color: '#111' }, inputFull: { minHeight: 48, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingHorizontal: 12, color: '#111', marginTop: 12 }, searchButton: { minWidth: 64, borderRadius: 12, backgroundColor: '#1769e0', alignItems: 'center', justifyContent: 'center' }, searchText: { color: '#fff', fontWeight: '700' }, result: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, resultTitle: { fontWeight: '600', color: '#111' }, resultHint: { marginTop: 3, fontSize: 12, color: '#777' }, empty: { paddingVertical: 20, color: '#777' }, error: { marginTop: 10, color: '#a00' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 }, secondary: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 11, backgroundColor: '#eee' }, primary: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 11, backgroundColor: '#1769e0' }, delete: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 11, backgroundColor: '#a00' }, primaryText: { color: '#fff', fontWeight: '700' }, savedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, description: { color: '#555', lineHeight: 20, marginBottom: 2 }, status: { marginTop: 10, color: '#555', fontSize: 12 }
});

export default App;
