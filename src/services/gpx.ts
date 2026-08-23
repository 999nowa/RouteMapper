import type {RoutePoint} from '../types/route';

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Creates a GPX route for OsmAnd.
 *
 * Important: this deliberately exports an <rte> with named <rtept> elements
 * and no <trk>/<trkpt> track. OsmAnd can then treat the points as route
 * points and calculate the road geometry itself instead of following a
 * precomputed track.
 */
export function createGpx(points: RoutePoint[], name = 'RouteMapper route') {
  const routePoints = points.map((point, index) => {
    const label = escapeXml(point.label || `Stopp ${index + 1}`);
    return `    <rtept lat="${point.latitude}" lon="${point.longitude}">\n      <name>${label}</name>\n    </rtept>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RouteMapper" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte>\n    <name>${escapeXml(name)}</name>\n${routePoints}\n  </rte>\n</gpx>\n`;
}
