export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LocationSample = Coordinate & {
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
};
