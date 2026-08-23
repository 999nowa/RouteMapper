import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_MAPS_API_KEY_STORAGE = '@routemapper/google_maps_api_key';

export async function loadGoogleMapsApiKey(): Promise<string> {
  return (await AsyncStorage.getItem(GOOGLE_MAPS_API_KEY_STORAGE))?.trim() ?? '';
}

export async function saveGoogleMapsApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(GOOGLE_MAPS_API_KEY_STORAGE);
    return;
  }
  await AsyncStorage.setItem(GOOGLE_MAPS_API_KEY_STORAGE, trimmed);
}

export async function clearGoogleMapsApiKey(): Promise<void> {
  await AsyncStorage.removeItem(GOOGLE_MAPS_API_KEY_STORAGE);
}
