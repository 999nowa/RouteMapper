import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinate } from '../types/location';

const SEARCH_AREA_KEY = '@routemapper/search-area';

export type SearchArea = Coordinate & {
  name: string;
  radiusKm: number;
};

export async function loadSearchArea(): Promise<SearchArea | null> {
  const raw = await AsyncStorage.getItem(SEARCH_AREA_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as SearchArea; } catch { return null; }
}

export async function saveSearchArea(area: SearchArea): Promise<void> {
  await AsyncStorage.setItem(SEARCH_AREA_KEY, JSON.stringify(area));
}

export async function clearSearchArea(): Promise<void> {
  await AsyncStorage.removeItem(SEARCH_AREA_KEY);
}

export function distanceKm(a: Coordinate, b: Coordinate): number {
  const lat = (b.latitude - a.latitude) * Math.PI / 180;
  const lon = (b.longitude - a.longitude) * Math.PI / 180;
  const la1 = a.latitude * Math.PI / 180;
  const la2 = b.latitude * Math.PI / 180;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
