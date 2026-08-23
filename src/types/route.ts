import type { Coordinate } from './location';

export type RoutePoint = Coordinate & {
  id: string;
  label?: string;
};

export type Route = {
  id: string;
  name: string;
  points: RoutePoint[];
  createdAt: number;
  updatedAt: number;
};
