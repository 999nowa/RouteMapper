import { loadGoogleMapsApiKey } from './apiKeyStorage';
import { loadSearchArea, distanceKm, type SearchArea } from './searchArea';
import type { Coordinate } from '../types/location';

export type GeocodingResult = Coordinate & { displayName: string };
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'User-Agent': 'RouteMapper/1.0 (mobile address search)',
};

type AreaLike = SearchArea | null | undefined;

async function searchNominatim(query: string, area?: AreaLike): Promise<GeocodingResult[]> {
  const searchQuery = area ? `${query}, ${area.name}` : query;
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '10',
    countrycodes: 'se',
    q: searchQuery,
    addressdetails: '1',
  });

  if (area) {
    const deltaLat = area.radiusKm / 111;
    const deltaLon = area.radiusKm / (111 * Math.max(0.2, Math.cos(area.latitude * Math.PI / 180)));
    params.set('viewbox', `${area.longitude - deltaLon},${area.latitude + deltaLat},${area.longitude + deltaLon},${area.latitude - deltaLat}`);
    params.set('bounded', '1');
  }

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) throw new Error(`Adressökningen misslyckades (${response.status}).`);

  const data = await response.json() as Array<{lat: string; lon: string; display_name: string}>;
  const results = data
    .map(result => ({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      displayName: result.display_name,
    }))
    .filter(result => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));

  return area
    ? results
        .filter(result => distanceKm(result, area) <= area.radiusKm * 1.15)
        .sort((a, b) => distanceKm(a, area) - distanceKm(b, area))
    : results;
}

async function searchGoogle(query: string, area?: AreaLike): Promise<GeocodingResult[] | null> {
  const apiKey = await loadGoogleMapsApiKey();
  if (!apiKey) return null;

  try {
    const searchQuery = area ? `${query}, ${area.name}` : query;
    const params = new URLSearchParams({
      address: searchQuery,
      components: 'country:SE',
      language: 'sv',
      key: apiKey,
    });

    if (area) {
      params.set('locationbias', `circle:${Math.round(area.radiusKm * 1000)}@${area.latitude},${area.longitude}`);
    }

    const response = await fetch(`${GOOGLE_GEOCODING_URL}?${params.toString()}`);
    if (!response.ok) return null;

    const data = await response.json() as {
      status: string;
      error_message?: string;
      results: Array<{formatted_address: string; geometry: {location: {lat: number; lng: number}}}>;
    };

    if (data.status === 'OK') {
      const results = data.results.slice(0, 10).map(result => ({
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        displayName: result.formatted_address,
      }));

      return area
        ? results
            .filter(result => distanceKm(result, area) <= area.radiusKm * 1.15)
            .sort((a, b) => distanceKm(a, area) - distanceKm(b, area))
        : results;
    }

    if (data.status === 'ZERO_RESULTS') return [];
  } catch {
    // Fall through to OpenStreetMap.
  }

  return null;
}

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const area = await loadSearchArea();
  const google = await searchGoogle(trimmed, area);
  if (google?.length) return google;

  const osm = await searchNominatim(trimmed, area);
  if (osm.length) return osm;

  // If the selected area is too restrictive for the provider, make one final
  // nationwide search and rank its results by distance to the selected area.
  if (area) {
    const fallback = await searchNominatim(trimmed);
    return fallback
      .sort((a, b) => distanceKm(a, area) - distanceKm(b, area))
      .slice(0, 10);
  }

  return google ?? osm;
}

export async function searchPlace(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const google = await searchGoogle(trimmed);
  if (google?.length) return google;
  return searchNominatim(trimmed);
}
