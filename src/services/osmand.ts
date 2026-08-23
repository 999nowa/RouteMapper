import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import type { RoutePoint } from '../types/route';
import { createGpx } from './gpx';

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
  if (!points.length) return false;

  if (points.length > 2) {
    const fileName = `RouteMapper-${Date.now()}.gpx`;
    const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
    await RNFS.writeFile(path, createGpx(points, 'RouteMapper route'), 'utf8');
    await Share.open({
      url: `file://${path}`,
      type: 'application/gpx+xml',
      package: 'net.osmand',
      failOnCancel: false,
    });
    return true;
  }

  const url = buildOsmAndNavigationUrl(points, currentLocation);
  if (!url) return false;
  await Share.open({
    url,
    type: 'text/plain',
    package: 'net.osmand',
    failOnCancel: false,
  });
  return true;
}
