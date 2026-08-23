import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import type {RoutePoint} from '../types/route';
import {createGpx} from './gpx';

export async function openRouteInOsmAnd(points: RoutePoint[], name = 'RouteMapper route'): Promise<boolean> {
  if (!points.length) return false;

  const fileName = `RouteMapper-${Date.now()}.gpx`;
  const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
  await RNFS.writeFile(path, createGpx(points, name), 'utf8');

  // react-native-share supports Android's package option, but its published
  // TypeScript declaration has not caught up with that native capability.
  await Share.open({
    url: `file://${path}`,
    type: 'application/gpx+xml',
    package: 'net.osmand',
    failOnCancel: false,
  } as Parameters<typeof Share.open>[0]);

  return true;
}
