import { loadGoogleMapsApiKey } from './apiKeyStorage';
import type { Coordinate } from '../types/location';

export type GeocodingResult = Coordinate & {
  displayName: string;
};

const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const apiKey = await loadGoogleMapsApiKey();

  if (apiKey) {
    const url = `${GOOGLE_GEOCODING_URL}?address=${encodeURIComponent(trimmed)}&components=country:SE&language=sv&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google adressökning misslyckades (${response.status}).`);
    }

    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(data.error_message ? `Google: ${data.error_message}` : `Google adressökning: ${data.status}.`);
    }

    return data.results.slice(0, 6).map(result => ({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      displayName: result.formatted_address,
    }));
  }

  const url = `${NOMINATIM_URL}?format=jsonv2&limit=6&countrycodes=se&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Adressökningen misslyckades (${response.status}).`);
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  return data.map(result => ({
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: result.display_name,
  }));
}
