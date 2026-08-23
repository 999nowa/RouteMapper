import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { createGpx } from './gpx';
import type { RoutePoint } from '../types/route';

export async function shareRouteAsGpx(points: RoutePoint[], name: string) {
  const fileName = `${name.replace(/[^a-z0-9åäö _-]/gi, '_') || 'route'}.gpx`;
  const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
  await RNFS.writeFile(path, createGpx(points, name), 'utf8');
  return Share.open({ url: `file://${path}`, type: 'application/gpx+xml', failOnCancel: false });
}
