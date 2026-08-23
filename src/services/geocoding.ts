import { loadGoogleMapsApiKey } from './apiKeyStorage';
import { loadSearchArea, distanceKm, type SearchArea } from './searchArea';
import type { Coordinate } from '../types/location';

export type GeocodingResult = Coordinate & { displayName: string };
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
type AreaLike = SearchArea | null | undefined;

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
  if (google !== null) return google;

  throw new Error('Google adressökning är inte tillgänglig. Kontrollera API-nyckeln och att Geocoding API är aktiverat.');
}

export async function searchPlace(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const google = await searchGoogle(trimmed);
  if (google !== null) return google;

  throw new Error('Google platssökning är inte tillgänglig. Kontrollera API-nyckeln och att Geocoding API är aktiverat.');
}
