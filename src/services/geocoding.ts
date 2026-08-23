import { loadGoogleMapsApiKey } from './apiKeyStorage';
import { loadSearchArea, distanceKm } from './searchArea';
import type { Coordinate } from '../types/location';

export type GeocodingResult = Coordinate & { displayName: string };
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function searchNominatim(query: string, area?: Awaited<ReturnType<typeof loadSearchArea>>): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '10', countrycodes: 'se', q: query });
  if (area) {
    const deltaLat = area.radiusKm / 111;
    const deltaLon = area.radiusKm / (111 * Math.max(0.2, Math.cos(area.latitude * Math.PI / 180)));
    params.set('viewbox', `${area.longitude - deltaLon},${area.latitude + deltaLat},${area.longitude + deltaLon},${area.latitude - deltaLat}`);
    params.set('bounded', '1');
  }
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { headers: { 'Accept': 'application/json', 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' } });
  if (!response.ok) throw new Error(`Adressökningen misslyckades (${response.status}).`);
  const data = await response.json() as Array<{lat: string; lon: string; display_name: string}>;
  return data.map(result => ({ latitude: Number(result.lat), longitude: Number(result.lon), displayName: result.display_name }));
}

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const area = await loadSearchArea();
  const apiKey = await loadGoogleMapsApiKey();

  if (apiKey) {
    try {
      const params = new URLSearchParams({ address: trimmed, components: 'country:SE', language: 'sv', key: apiKey });
      if (area) {
        params.set('locationbias', `circle:${Math.round(area.radiusKm * 1000)}@${area.latitude},${area.longitude}`);
      }
      const response = await fetch(`${GOOGLE_GEOCODING_URL}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json() as {status: string; results: Array<{formatted_address: string; geometry: {location: {lat: number; lng: number}}}>};
        if (data.status === 'OK') {
          const results = data.results.slice(0, 10).map(result => ({ latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, displayName: result.formatted_address }));
          return area ? results.sort((a, b) => distanceKm(a, area) - distanceKm(b, area)) : results;
        }
        if (data.status === 'ZERO_RESULTS') return [];
      }
    } catch {
      // Fall through to OpenStreetMap.
    }
  }

  return searchNominatim(trimmed, area);
}
