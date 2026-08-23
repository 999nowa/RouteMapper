import type { RoutePoint } from '../types/route';

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function createGpx(points: RoutePoint[], name = 'RouteMapper route') {
  const waypoints = points.map((point, index) => `    <wpt lat="${point.latitude}" lon="${point.longitude}"><name>${escapeXml(point.label || `Stopp ${index + 1}`)}</name></wpt>`).join('\n');
  const routePoints = points.map(point => `      <rtept lat="${point.latitude}" lon="${point.longitude}" />`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RouteMapper" xmlns="http://www.topografix.com/GPX/1/1">\n${waypoints}\n  <rte><name>${escapeXml(name)}</name>\n${routePoints}\n  </rte>\n</gpx>`;
}
