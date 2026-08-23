import { useEffect, useState } from 'react';

import type { LocationSample } from '../types/location';
import { locationService } from '../services/location';

export function useCurrentLocation() {
  const [location, setLocation] = useState<LocationSample | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    locationService
      .getCurrentLocation()
      .then(value => {
        if (active) setLocation(value);
      })
      .catch(value => {
        if (active) setError(value instanceof Error ? value : new Error(String(value)));
      });

    return () => {
      active = false;
    };
  }, []);

  return { location, error };
}
