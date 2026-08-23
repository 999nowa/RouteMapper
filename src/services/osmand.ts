import { Linking } from 'react-native';
import type { RoutePoint } from '../types/route';

export function buildOsmAndNavigationUrl(points: RoutePoint[], currentLocation?: RoutePoint): string | null {
  if (!points.length) return null;

  const start = currentLocation ?? points[0];
  const finish = points.length > 1 ? points[points.length - 1] : points[0];
  const params = new URLSearchParams({
    start: `${start.latitude},${start.longitude}`,
    finish: `${finish.latitude},${finish.longitude}`,
    profile: 'car',
  });

  return `https://osmand.net/map/?${params.toString()}`;
}

export async function openRouteInOsmAnd(points: RoutePoint[], currentLocation?: RoutePoint): Promise<boolean> {
  const url = buildOsmAndNavigationUrl(points, currentLocation);
  if (!url) return false;
  const supported = await Linking.canOpenURL(url);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
}
