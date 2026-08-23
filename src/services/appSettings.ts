import AsyncStorage from '@react-native-async-storage/async-storage';

export type MapType = 'standard' | 'satellite';

export type AppSettings = {
  mapType: MapType;
  autoFitRoute: boolean;
  showStops: boolean;
  searchRadiusKm: number;
};

const STORAGE_KEY = '@routemapper/settings/v1';

export const DEFAULT_SETTINGS: AppSettings = {
  mapType: 'satellite',
  autoFitRoute: true,
  showStops: true,
  searchRadiusKm: 25,
};

export async function loadAppSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      mapType: parsed.mapType === 'standard' ? 'standard' : 'satellite',
      autoFitRoute: parsed.autoFitRoute !== false,
      showStops: parsed.showStops !== false,
      searchRadiusKm: Number.isFinite(parsed.searchRadiusKm) ? Number(parsed.searchRadiusKm) : DEFAULT_SETTINGS.searchRadiusKm,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
