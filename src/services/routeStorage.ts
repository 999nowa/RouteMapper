import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Route } from '../types/route';

const STORAGE_KEY = '@routemapper/routes/v1';

export async function loadRoutes(): Promise<Route[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Route[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRoutes(routes: Route[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export async function saveRoute(route: Route): Promise<void> {
  const routes = await loadRoutes();
  const existing = routes.findIndex(item => item.id === route.id);
  const next = [...routes];

  if (existing >= 0) next[existing] = route;
  else next.unshift(route);

  await saveRoutes(next);
}

export async function deleteRoute(routeId: string): Promise<void> {
  const routes = await loadRoutes();
  await saveRoutes(routes.filter(route => route.id !== routeId));
}
