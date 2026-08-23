import type { Coordinate } from '../types/location';

export type GeocodingResult = Coordinate & {
  displayName: string;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

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
