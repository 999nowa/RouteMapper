import TextRecognition from '@react-native-ml-kit/text-recognition';
import {launchImageLibrary} from 'react-native-image-picker';
import {searchAddress, type GeocodingResult} from './geocoding';

export function normalizeAddress(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9åäö ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function streetNumberKey(value: string) {
  const normalized = normalizeAddress(value);
  const match = normalized.match(/^(.*?\b\d+[a-z]?\b)/i);
  return match?.[1]?.trim() || normalized;
}

export async function importAddressesFromImage(): Promise<GeocodingResult[]> {
  const picker = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1});
  if (picker.didCancel || !picker.assets?.[0]?.uri) return [];

  const recognition = await TextRecognition.recognize(picker.assets[0].uri);
  const lines = recognition.blocks
    .flatMap(block => block.lines.map(line => line.text.trim()))
    .filter(Boolean);

  const candidates: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\d/.test(line) && line.length >= 5) candidates.push(line);

    const next = lines[index + 1];
    if (next && /\d/.test(next) && line.length >= 3 && line.length <= 80) {
      const combined = `${line} ${next}`.trim();
      if (combined.length >= 5 && !candidates.includes(combined)) candidates.push(combined);
    }
  }

  const seen = new Set<string>();
  const results: GeocodingResult[] = [];

  for (const candidate of candidates) {
    const key = streetNumberKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const matches = await searchAddress(candidate);
      if (matches.length) results.push(matches[0]);
    } catch {
      // Continue with the remaining OCR candidates.
    }
  }

  const coordinateKeys = new Set<string>();
  const addressKeys = new Set<string>();

  return results.filter(result => {
    const addressKey = streetNumberKey(result.displayName);
    const coordinateKey = `${result.latitude.toFixed(5)},${result.longitude.toFixed(5)}`;
    if (addressKeys.has(addressKey) || coordinateKeys.has(coordinateKey)) return false;
    addressKeys.add(addressKey);
    coordinateKeys.add(coordinateKey);
    return true;
  });
}
