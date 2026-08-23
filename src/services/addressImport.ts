import TextRecognition from '@react-native-ml-kit/text-recognition';
import {launchImageLibrary} from 'react-native-image-picker';
import {searchAddress, type GeocodingResult} from './geocoding';

export function normalizeAddress(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9åäö0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
}

export async function importAddressesFromImage(): Promise<GeocodingResult[]> {
  const picker = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1});
  if (picker.didCancel || !picker.assets?.[0]?.uri) return [];
  const result = await TextRecognition.recognize(picker.assets[0].uri);
  const lines = result.blocks.flatMap(block => block.lines.map(line => line.text.trim())).filter(Boolean);
  const candidates = lines.filter(line => /\d/.test(line) && line.length >= 5);
  const seen = new Set<string>();
  const results: GeocodingResult[] = [];
  for (const candidate of candidates) {
    const key = normalizeAddress(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const matches = await searchAddress(candidate);
      if (matches.length) results.push(matches[0]);
    } catch {}
  }
  const coordinateKeys = new Set<string>();
  return results.filter(result => {
    const key = `${result.latitude.toFixed(6)},${result.longitude.toFixed(6)}`;
    if (coordinateKeys.has(key)) return false;
    coordinateKeys.add(key);
    return true;
  });
}
