export type Profile = 'foot' | 'bike' | 'car';

export const PROFILE_RU: Record<Profile, string> = {
  foot: 'Пешком',
  bike: 'Вело',
  car: 'Авто',
};

/** Index of each profile in the per-profile speed arrays. */
export const PROFILE_INDEX: Record<Profile, number> = { foot: 0, bike: 1, car: 2 };

/**
 * One road-like polyline the router can use.
 * OSM-derived lines come from the OpenMapTiles `transportation` layer; user lines from our own database.
 */
export interface RoadLine {
  coords: [number, number][];
  /** OpenMapTiles class (motorway, primary, path, ...). Empty for user lines. */
  cls: string;
  /** OpenMapTiles subclass (steps, footway, ...). Empty when absent. */
  sub: string;
  /** 1: only in the line direction, -1: only against it, 0: both ways. */
  oneway: -1 | 0 | 1;
  /** Access tags keyed by 'generic' | 'foot' | 'bicycle' | 'motor_vehicle'. */
  access: Record<string, string>;
  /** Set for user-drawn lines: how they can be used and what kind of surface they are. */
  user: { lineType: 'trail' | 'gravel' | 'road'; passability: Profile } | null;
}

/** Input from the main thread for a user-drawn line. */
export interface UserLineInput {
  coords: [number, number][];
  lineType: 'trail' | 'gravel' | 'road';
  passability: Profile;
}

export interface RouteResult {
  /** [lng, lat] points from start to finish, including the exact start and finish points. */
  coords: [number, number][];
  /** Metres. */
  distance: number;
  /** Seconds. */
  duration: number;
  profile: Profile;
  from: [number, number];
  to: [number, number];
}

export interface RouteProgress {
  /** Distance from the current position to the nearest point of the route, metres. */
  offM: number;
  /** Remaining distance along the route, metres. */
  remainingM: number;
  /** Remaining time estimate, seconds. */
  remainingS: number;
  arrived: boolean;
}
