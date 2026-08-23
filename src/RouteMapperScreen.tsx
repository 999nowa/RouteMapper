import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {Marker, Polyline, type MapPressEvent} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {searchAddress, searchPlace, type GeocodingResult} from './services/geocoding';
import {importAddressesFromImage, normalizeAddress} from './services/addressImport';
import {openRouteInOsmAnd} from './services/osmand';
import {shareRouteAsGpx} from './services/shareGpx';
import {clearSearchArea, loadSearchArea, saveSearchArea, type SearchArea} from './services/searchArea';
import {clearGoogleMapsApiKey, loadGoogleMapsApiKey, saveGoogleMapsApiKey} from './services/apiKeyStorage';
import {deleteRoute, loadRoutes, saveRoute} from './services/routeStorage';
import {DEFAULT_SETTINGS, loadAppSettings, saveAppSettings, type AppSettings} from './services/appSettings';
import {useCurrentLocation} from './hooks/useCurrentLocation';
import type {RoutePoint, Route} from './types/route';
import type {Coordinate} from './types/location';

const FALLBACK = {latitude: 59.3293, longitude: 18.0686, latitudeDelta: 8, longitudeDelta: 8};
const RADII = [1, 5, 10, 25, 50, 100];

function dedupeKey(value: string) {
  return normalizeAddress(value.split(',')[0] ?? value);
}

export default function RouteMapperScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const {location, error: locationError} = useCurrentLocation();

  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [area, setArea] = useState<SearchArea | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaResults, setAreaResults] = useState<GeocodingResult[]>([]);
  const [areaRadius, setAreaRadius] = useState(DEFAULT_SETTINGS.searchRadiusKm);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [routeName, setRouteName] = useState('Min rutt');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [stopsOpen, setStopsOpen] = useState(false);

  const currentCoordinate = useMemo<Coordinate | undefined>(
    () => location ? {latitude: location.latitude, longitude: location.longitude} : undefined,
    [location],
  );

  useEffect(() => {
    Promise.all([loadRoutes(), loadAppSettings(), loadSearchArea(), loadGoogleMapsApiKey()])
      .then(([savedRoutes, savedSettings, savedArea, apiKey]) => {
        setRoutes(savedRoutes);
        setSettings(savedSettings);
        setArea(savedArea);
        setAreaRadius(savedArea?.radiusKm ?? savedSettings.searchRadiusKm);
        setHasApiKey(Boolean(apiKey));
      })
      .catch(() => setMessage('Kunde inte läsa lokala inställningar.'));
  }, []);

  useEffect(() => {
    saveAppSettings(settings).catch(() => undefined);
  }, [settings]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 3200);
    return () => clearTimeout(timeout);
  }, [message]);

  const theme = settings.darkMode ? darkStyles : styles;

  const openStreetView = async (point: RoutePoint) => {
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.latitude},${point.longitude}&language=sv`;
    try {
      await Linking.openURL(url);
    } catch {
      setMessage('Kunde inte öppna Google Maps för Street View.');
    }
  };

  const addPoint = (coordinate: Coordinate, label?: string) => {
    setPoints(current => {
      const incomingName = dedupeKey(label ?? '');
      const incomingCoordinate = `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
      if (current.some(point => dedupeKey(point.label ?? '') === incomingName || `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` === incomingCoordinate)) {
        return current;
      }
      return [...current, {
        id: `${Date.now()}-${current.length}`,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        label: label?.trim() || `Stopp ${current.length + 1}`,
      }];
    });
  };

  const handleMapPress = (event: MapPressEvent) => addPoint(event.nativeEvent.coordinate);

  const fitRoute = () => {
    if (points.length) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: {top: 180, right: 50, bottom: 220, left: 50},
        animated: true,
      });
    } else if (currentCoordinate) {
      mapRef.current?.animateToRegion({...currentCoordinate, latitudeDelta: 0.04, longitudeDelta: 0.04}, 500);
    }
  };

  const centerOnLocation = () => {
    if (!currentCoordinate) {
      setMessage(locationError?.message ?? 'Aktuell position kunde inte hämtas.');
      return;
    }
    mapRef.current?.animateToRegion({...currentCoordinate, latitudeDelta: 0.04, longitudeDelta: 0.04}, 500);
  };

  const performSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const nextResults = await searchAddress(query);
      setResults(nextResults);
      if (!nextResults.length) setMessage('Inga adresser hittades.');
    } catch (e) {
      setResults([]);
      setMessage(e instanceof Error ? e.message : 'Adressökningen misslyckades.');
    } finally {
      setBusy(false);
    }
  };

  const selectAddress = (result: GeocodingResult) => {
    addPoint(result, result.displayName.split(',').slice(0, 2).join(', '));
    setResults([]);
    setQuery('');
    setSearchOpen(false);
    mapRef.current?.animateToRegion({...result, latitudeDelta: 0.02, longitudeDelta: 0.02}, 500);
  };

  const importImage = async () => {
    setBusy(true);
    setMessage('');
    try {
      const found = await importAddressesFromImage();
      let added = 0;
      setPoints(current => {
        const names = new Set(current.map(point => dedupeKey(point.label ?? '')));
        const coordinates = new Set(current.map(point => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`));
        const next = [...current];
        for (const result of found) {
          const label = result.displayName.split(',').slice(0, 2).join(', ');
          const name = dedupeKey(label);
          const coordinate = `${result.latitude.toFixed(5)},${result.longitude.toFixed(5)}`;
          if (names.has(name) || coordinates.has(coordinate)) continue;
          next.push({id: `${Date.now()}-${next.length}`, latitude: result.latitude, longitude: result.longitude, label});
          names.add(name);
          coordinates.add(coordinate);
          added += 1;
        }
        return next;
      });
      setMessage(added ? `${added} nya adresser importerades.` : 'Inga nya adresser kunde läggas till.');
    } catch {
      setMessage('Kunde inte läsa bilden.');
    } finally {
      setBusy(false);
    }
  };

  const searchAreaPlace = async () => {
    if (!areaQuery.trim()) return;
    setBusy(true);
    try {
      const next = await searchPlace(areaQuery);
      setAreaResults(next);
      if (!next.length) setMessage('Inga platser hittades.');
    } catch (e) {
      setAreaResults([]);
      setMessage(e instanceof Error ? e.message : 'Områdessökningen misslyckades.');
    } finally {
      setBusy(false);
    }
  };

  const chooseArea = async (result: GeocodingResult) => {
    const next = {
      name: result.displayName,
      latitude: result.latitude,
      longitude: result.longitude,
      radiusKm: areaRadius,
    };
    await saveSearchArea(next);
    setArea(next);
    setAreaOpen(false);
    setAreaQuery('');
    setAreaResults([]);
    mapRef.current?.animateToRegion({latitude: result.latitude, longitude: result.longitude, latitudeDelta: 0.25, longitudeDelta: 0.25}, 500);
    setMessage('Sökområdet sparades.');
  };

  const resetArea = async () => {
    await clearSearchArea();
    setArea(null);
    setAreaOpen(false);
    setAreaResults([]);
    setMessage('Sökområdet rensades.');
  };

  const removePoint = (id: string) => {
    setPoints(current => current.filter(point => point.id !== id));
  };

  const clearPoints = () => {
    if (!points.length) return;
    Alert.alert('Rensa stopp?', 'Alla aktuella stopp tas bort från den aktuella rutten.', [
      {text: 'Avbryt', style: 'cancel'},
      {text: 'Rensa', style: 'destructive', onPress: () => setPoints([])},
    ]);
  };

  const openEditor = (point: RoutePoint) => {
    setEditingPoint(point);
    setEditLabel(point.label ?? '');
  };

  const saveEditedPoint = () => {
    if (!editingPoint) return;
    const nextLabel = editLabel.trim();
    setPoints(current => current.map(point => point.id === editingPoint.id ? {...point, label: nextLabel || point.label} : point));
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
    setSaveOpen(false);
    setMessage('Rutten sparades lokalt.');
  };

  const loadSavedRoute = (route: Route) => {
    setPoints(route.points);
    setRouteName(route.name);
    setSavedOpen(false);
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(route.points, {edgePadding: {top: 180, right: 50, bottom: 220, left: 50}, animated: true});
    }, 100);
  };

  const removeSavedRoute = async (route: Route) => {
    await deleteRoute(route.id);
    setRoutes(await loadRoutes());
  };

  const exportGpx = async () => {
    if (!points.length) {
      setMessage('Lägg till minst ett stopp först.');
      return;
    }
    try {
      await shareRouteAsGpx(points, routeName.trim() || 'RouteMapper route');
      setMessage('GPX-filen är klar att delas eller öppnas.');
    } catch {
      setMessage('Kunde inte skapa GPX-filen.');
    }
  };

  const navigateWithOsmAnd = async () => {
    if (!points.length) {
      setMessage('Lägg till minst ett stopp först.');
      return;
    }
    try {
      const opened = await openRouteInOsmAnd(points, routeName.trim() || 'RouteMapper route');
      setMessage(opened ? 'Rutten skickades till OsmAnd.' : 'Kunde inte öppna OsmAnd.');
    } catch {
      setMessage('Kunde inte öppna OsmAnd. Kontrollera att OsmAnd är installerat.');
    }
  };

  const openSettings = async () => {
    const key = await loadGoogleMapsApiKey();
    setApiKeyInput(key);
    setHasApiKey(Boolean(key));
    setSettingsOpen(true);
  };

  const saveApiKey = async () => {
    await saveGoogleMapsApiKey(apiKeyInput);
    setHasApiKey(Boolean(apiKeyInput.trim()));
    setSettingsOpen(false);
    setMessage(apiKeyInput.trim() ? 'API-nyckeln sparades lokalt.' : 'API-nyckeln raderades.');
  };

  const removeApiKey = () => {
    Alert.alert('Radera API-nyckel?', 'Den lokalt sparade nyckeln tas bort från enheten.', [
      {text: 'Avbryt', style: 'cancel'},
      {text: 'Radera', style: 'destructive', onPress: async () => {
        await clearGoogleMapsApiKey();
        setApiKeyInput('');
        setHasApiKey(false);
        setSettingsOpen(false);
      }},
    ]);
  };

  return (
    <View style={theme.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={settings.mapType}
        initialRegion={FALLBACK}
        showsUserLocation={Boolean(currentCoordinate)}
        showsCompass
        toolbarEnabled
        onPress={handleMapPress}
      >
        {settings.showStops ? points.map((point, index) => (
          <Marker
            key={point.id}
            coordinate={point}
            title={`${index + 1}. ${point.label ?? `Stopp ${index + 1}`}`}
            onPress={() => openStreetView(point)}
          />
        )) : null}
        {points.length > 1 ? <Polyline coordinates={points} strokeWidth={4} strokeColor="#1769e0" /> : null}
        {area ? <Marker coordinate={area} pinColor="#7a4cff" title="Sökområde" /> : null}
      </MapView>

      <SafeAreaView style={theme.overlay}>
        <View style={theme.topCard}>
          <View style={theme.headerRow}>
            <View style={theme.headerText}>
              <Text style={theme.title}>RouteMapper</Text>
              <Text style={theme.subtitle}>{points.length} stopp{locationError ? ' · GPS ej tillgänglig' : ''}</Text>
            </View>
            <Pressable style={theme.headerButton} onPress={() => setAreaOpen(true)}><Text style={theme.headerButtonText}>{area ? 'Område' : 'Sökområde'}</Text></Pressable>
            <Pressable style={theme.headerButton} onPress={openSettings}><Text style={theme.headerButtonText}>Inställningar</Text></Pressable>
          </View>
          {area ? <Text style={theme.areaText} numberOfLines={1}>{area.name} · {area.radiusKm} km</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={theme.row}>
            <Pressable style={theme.button} onPress={() => setSearchOpen(true)}><Text>Sök adress</Text></Pressable>
            <Pressable style={theme.button} onPress={importImage}><Text>Bild</Text></Pressable>
            <Pressable style={theme.button} onPress={centerOnLocation}><Text>Min position</Text></Pressable>
            <Pressable style={theme.button} onPress={fitRoute}><Text>Visa rutt</Text></Pressable>
            <Pressable style={theme.button} onPress={() => setSettings(s => ({...s, mapType: s.mapType === 'satellite' ? 'standard' : 'satellite'}))}><Text>{settings.mapType === 'satellite' ? 'Karta' : 'Satellit'}</Text></Pressable>
            <Pressable style={theme.button} onPress={() => points.length ? openStreetView(points[points.length - 1]) : setMessage('Lägg till ett stopp först.')}><Text>Street View</Text></Pressable>
          </ScrollView>
        </View>

        {points.length ? (
          <View style={theme.stopCard}>
            <View style={theme.panelHeader}>
              <Text style={theme.panelTitle}>Senaste stopp ({points.length})</Text>
              <View style={theme.row}>
                <Pressable onPress={() => setSettings(s => ({...s, showStops: !s.showStops}))}><Text style={theme.action}>{settings.showStops ? 'Dölj' : 'Visa'}</Text></Pressable>
                <Pressable onPress={() => setStopsOpen(true)}><Text style={theme.action}>Alla</Text></Pressable><Pressable onPress={clearPoints}><Text style={theme.actionDanger}>Rensa</Text></Pressable>
              </View>
            </View>
            {points.slice(-3).map((point, index, visible) => {
              const actual = points.length - visible.length + index;
              return (
                <View key={point.id} style={theme.stopRow}>
                  <View style={theme.number}><Text style={theme.numberText}>{actual + 1}</Text></View>
                  <Pressable style={theme.stopDetails} onPress={() => openEditor(point)}>
                    <Text style={theme.stopName} numberOfLines={1}>{point.label}</Text>
                    <Text style={theme.coordinates}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
                  </Pressable>
                  <Pressable onPress={() => openStreetView(point)} style={theme.smallAction}><Text>SV</Text></Pressable>
                  <Pressable onPress={() => removePoint(point.id)} style={theme.smallAction}><Text style={theme.actionDanger}>×</Text></Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {busy ? <View style={theme.loading}><ActivityIndicator /><Text>Arbetar...</Text></View> : null}
        {message ? <View style={theme.message}><Text style={theme.messageText}>{message}</Text></View> : null}

        <View style={[theme.bottomBar, {paddingBottom: insets.bottom + 8}]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={theme.row}>
            <Pressable style={theme.button} onPress={() => setSavedOpen(true)}><Text>Sparade</Text></Pressable>
            {points.length ? <Pressable style={theme.button} onPress={() => setSaveOpen(true)}><Text>Spara</Text></Pressable> : null}
            {points.length ? <Pressable style={theme.button} onPress={exportGpx}><Text>Exportera GPX</Text></Pressable> : null}
            {points.length ? <Pressable style={theme.primaryButton} onPress={navigateWithOsmAnd}><Text style={theme.primaryText}>Navigera i OsmAnd</Text></Pressable> : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <View style={theme.backdrop}><View style={theme.modal}>
          <View style={theme.modalHeader}><Text style={theme.modalTitle}>Sök adress</Text><Pressable onPress={() => setSearchOpen(false)}><Text style={theme.action}>Stäng</Text></Pressable></View>
          <View style={theme.searchRow}><TextInput style={theme.input} value={query} onChangeText={setQuery} onSubmitEditing={performSearch} placeholder="Gata, nummer och ort" autoFocus /><Pressable style={theme.primaryButton} onPress={performSearch}><Text style={theme.primaryText}>Sök</Text></Pressable></View>
          {results.map(result => <Pressable key={`${result.latitude}-${result.longitude}-${result.displayName}`} style={theme.result} onPress={() => selectAddress(result)}><Text style={theme.resultTitle}>{result.displayName}</Text><Text style={theme.resultHint}>Tryck för att lägga till</Text></Pressable>)}
          {!busy && query.trim() && !results.length ? <Text style={theme.empty}>Inga träffar.</Text> : null}
        </View></View>
      </Modal>

      <Modal visible={areaOpen} transparent animationType="slide" onRequestClose={() => setAreaOpen(false)}>
        <View style={theme.backdrop}><View style={theme.modal}>
          <View style={theme.modalHeader}><Text style={theme.modalTitle}>Sökområde</Text><Pressable onPress={() => setAreaOpen(false)}><Text style={theme.action}>Stäng</Text></Pressable></View>
          <Text style={theme.description}>Adressökningen prioriterar träffar inom det valda området.</Text>
          <View style={theme.searchRow}><TextInput style={theme.input} value={areaQuery} onChangeText={setAreaQuery} onSubmitEditing={searchAreaPlace} placeholder="Sök plats" /><Pressable style={theme.primaryButton} onPress={searchAreaPlace}><Text style={theme.primaryText}>Sök</Text></Pressable></View>
          {areaResults.map(result => <Pressable key={`${result.latitude}-${result.longitude}-${result.displayName}`} style={theme.result} onPress={() => chooseArea(result)}><Text style={theme.resultTitle}>{result.displayName}</Text></Pressable>)}
          <Text style={theme.label}>Radie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={theme.row}>{RADII.map(radius => <Pressable key={radius} style={[theme.radius, areaRadius === radius ? theme.radiusSelected : null]} onPress={() => {setAreaRadius(radius); setSettings(s => ({...s, searchRadiusKm: radius}));}}><Text>{radius} km</Text></Pressable>)}</ScrollView>
          <View style={theme.row}>{area ? <Pressable style={theme.deleteButton} onPress={resetArea}><Text style={theme.primaryText}>Rensa område</Text></Pressable> : null}</View>
        </View></View>
      </Modal>

      <Modal visible={saveOpen} transparent animationType="fade" onRequestClose={() => setSaveOpen(false)}>
        <View style={theme.backdrop}><View style={theme.smallModal}><Text style={theme.modalTitle}>Spara rutt</Text><TextInput style={theme.inputFull} value={routeName} onChangeText={setRouteName} placeholder="Ruttnamn"/><View style={theme.actions}><Pressable style={theme.button} onPress={() => setSaveOpen(false)}><Text>Avbryt</Text></Pressable><Pressable style={theme.primaryButton} onPress={saveCurrentRoute}><Text style={theme.primaryText}>Spara</Text></Pressable></View></View></View>
      </Modal>

      <Modal visible={savedOpen} transparent animationType="slide" onRequestClose={() => setSavedOpen(false)}>
        <View style={theme.backdrop}><View style={theme.modal}>
          <View style={theme.modalHeader}><Text style={theme.modalTitle}>Sparade rutter</Text><Pressable onPress={() => setSavedOpen(false)}><Text style={theme.action}>Stäng</Text></Pressable></View>
          {routes.map(route => <View key={route.id} style={theme.savedRow}><Pressable style={theme.stopDetails} onPress={() => loadSavedRoute(route)}><Text style={theme.resultTitle}>{route.name}</Text><Text style={theme.resultHint}>{route.points.length} stopp</Text></Pressable><Pressable onPress={() => removeSavedRoute(route)}><Text style={theme.actionDanger}>Ta bort</Text></Pressable></View>)}
          {!routes.length ? <Text style={theme.empty}>Inga sparade rutter.</Text> : null}
        </View></View>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={theme.backdrop}><View style={theme.modal}>
          <View style={theme.modalHeader}><Text style={theme.modalTitle}>Inställningar</Text><Pressable onPress={() => setSettingsOpen(false)}><Text style={theme.action}>Stäng</Text></Pressable></View>
          <Text style={theme.sectionTitle}>Utseende</Text>
          <View style={theme.settingRow}><View style={theme.stopDetails}><Text style={theme.settingText}>Mörkt läge</Text><Text style={theme.resultHint}>Använd mörkare paneler och dialoger</Text></View><Switch value={settings.darkMode} onValueChange={value => setSettings(s => ({...s, darkMode: value}))}/></View>
          <Text style={theme.sectionTitle}>Karta</Text>
          <View style={theme.settingRow}><View style={theme.stopDetails}><Text>Automatisk inpassning</Text><Text style={theme.resultHint}>Visa hela rutten efter sökning och import</Text></View><Switch value={settings.autoFitRoute} onValueChange={value => setSettings(s => ({...s, autoFitRoute: value}))}/></View>
          <View style={theme.settingRow}><View style={theme.stopDetails}><Text>Visa stoppmarkörer</Text></View><Switch value={settings.showStops} onValueChange={value => setSettings(s => ({...s, showStops: value}))}/></View>
          <View style={theme.settingRow}><Text>Standardvy</Text><Pressable style={theme.button} onPress={() => setSettings(s => ({...s, mapType: s.mapType === 'satellite' ? 'standard' : 'satellite'}))}><Text>{settings.mapType === 'satellite' ? 'Satellit' : 'Karta'}</Text></Pressable></View>
          <Text style={theme.sectionTitle}>Google API-nyckel</Text>
          <Text style={theme.description}>Nyckeln för adressökning sparas endast lokalt på enheten.</Text>
          <TextInput style={theme.inputFull} value={apiKeyInput} onChangeText={setApiKeyInput} placeholder="API-nyckel" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={theme.status}>{hasApiKey ? 'API-nyckel konfigurerad' : 'Ingen lokal API-nyckel konfigurerad'}</Text>
          <View style={theme.actions}><Pressable style={theme.button} onPress={removeApiKey}><Text>Radera nyckel</Text></Pressable><Pressable style={theme.primaryButton} onPress={saveApiKey}><Text style={theme.primaryText}>Spara</Text></Pressable></View>
        </View></View>
      </Modal>

      <Modal visible={Boolean(editingPoint)} transparent animationType="fade" onRequestClose={() => setEditingPoint(null)}>
        <View style={theme.backdrop}><View style={theme.smallModal}><Text style={theme.modalTitle}>Redigera stopp</Text><TextInput style={theme.inputFull} value={editLabel} onChangeText={setEditLabel} placeholder="Namn"/><View style={theme.actions}><Pressable style={theme.button} onPress={() => setEditingPoint(null)}><Text>Avbryt</Text></Pressable><Pressable style={theme.primaryButton} onPress={saveEditedPoint}><Text style={theme.primaryText}>Spara</Text></Pressable></View></View></View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  overlay: {flex: 1, justifyContent: 'space-between'},
  topCard: {margin: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', elevation: 4},
  headerRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  headerText: {flex: 1},
  title: {fontSize: 21, fontWeight: '700'},
  subtitle: {fontSize: 12, opacity: 0.7},
  areaText: {marginTop: 5, fontSize: 12, opacity: 0.75},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  button: {backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, elevation: 2},
  primaryButton: {backgroundColor: '#1769e0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10},
  deleteButton: {backgroundColor: '#b42318', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10},
  primaryText: {color: '#fff', fontWeight: '700'},
  headerButton: {backgroundColor: '#1769e0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9},
  headerButtonText: {color: '#fff', fontWeight: '700', fontSize: 12},
  stopCard: {marginHorizontal: 10, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', elevation: 4},
  panelHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5},
  panelTitle: {fontSize: 16, fontWeight: '700'},
  action: {color: '#1769e0', fontWeight: '600'},
  actionDanger: {color: '#b42318', fontWeight: '600'},
  stopRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8},
  number: {width: 28, height: 28, borderRadius: 14, backgroundColor: '#1769e0', alignItems: 'center', justifyContent: 'center'},
  numberText: {color: '#fff', fontWeight: '700'},
  stopDetails: {flex: 1},
  stopName: {fontWeight: '600'},
  coordinates: {fontSize: 10, opacity: 0.6},
  smallAction: {padding: 6},
  bottomBar: {paddingHorizontal: 10},
  message: {alignSelf: 'center', marginBottom: 8, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, elevation: 3, maxWidth: '90%'},
  loading: {alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12, elevation: 2},
  backdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)'},
  modal: {maxHeight: '86%', backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12},
  smallModal: {marginHorizontal: 18, backgroundColor: '#fff', padding: 18, borderRadius: 18, gap: 12},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  modalTitle: {fontSize: 19, fontWeight: '700'},
  searchRow: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  input: {flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff'},
  inputFull: {borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10},
  result: {paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee'},
  resultTitle: {fontWeight: '600'},
  resultHint: {fontSize: 12, opacity: 0.6, marginTop: 2},
  empty: {paddingVertical: 12, opacity: 0.65},
  description: {fontSize: 13, color: '#555'},
  label: {fontWeight: '700'},
  radius: {paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#eee'},
  radiusSelected: {backgroundColor: '#d5e7ff'},
  actions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 8},
  savedRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee'},
  settingRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8},
  sectionTitle: {fontSize: 15, fontWeight: '700', marginTop: 4},
  status: {fontSize: 12, opacity: 0.65},
  streetViewContainer: {flex: 1, backgroundColor: '#fff'},
  streetHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10},
  webLoading: {flex: 1},
});


const darkStyles = {
  ...styles,
  ...StyleSheet.create({
    container: {backgroundColor: '#111827'},
    topCard: {backgroundColor: 'rgba(17,24,39,0.96)'},
    stopCard: {backgroundColor: 'rgba(17,24,39,0.96)'},
    button: {backgroundColor: '#263244'},
    message: {alignSelf: 'center', marginBottom: 8, backgroundColor: '#263244', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, elevation: 3, maxWidth: '90%'},
    messageText: {color: '#f8fafc'},
    loading: {backgroundColor: '#263244'},
    modal: {backgroundColor: '#111827'},
    smallModal: {backgroundColor: '#111827'},
    input: {backgroundColor: '#1f2937', borderColor: '#475569', color: '#f8fafc'},
    inputFull: {backgroundColor: '#1f2937', borderColor: '#475569', color: '#f8fafc'},
    result: {borderBottomColor: '#334155'},
    savedRow: {borderBottomColor: '#334155'},
    description: {color: '#cbd5e1'},
    radius: {backgroundColor: '#263244'},
    radiusSelected: {backgroundColor: '#1d4ed8'},
    streetViewContainer: {backgroundColor: '#111827'},
  }),
};