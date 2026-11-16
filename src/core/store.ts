import type { Feature, Geometry } from 'geojson';
import type { Profile, RouteProgress, RouteResult } from './routing/types';

export type Listener<T> = (state: T, prev: T) => void;

/** Minimal observable store (no framework needed). */
export class Store<T extends object> {
  private listeners = new Set<Listener<T>>();
  private state: T;

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(patch: Partial<T>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const fn of this.listeners) fn(this.state, prev);
  }

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export type TabId = 'map' | 'route' | 'layers' | 'regions' | 'settings';

export interface RouteTarget {
  lng: number;
  lat: number;
  name: string;
}

export interface PickedFeature {
  kind: 'poi' | 'building' | 'road' | 'user';
  /** Set for user-made objects: id of the FeatureRecord. */
  userFeatureId?: string;
  title: string;
  subtitle: string;
  address: string | null;
  heightM: number | null;
  lngLat: { lng: number; lat: number };
  /** Geometry used for the neon highlight (already in WGS84). */
  highlight: Feature<Geometry>;
}

/** Region rectangle being drawn on the map: first and second corner ([lng, lat]). */
export interface BboxDraft {
  a: [number, number] | null;
  b: [number, number] | null;
}

export type LocationMode = 'off' | 'follow' | 'nav';

export interface LocationFix {
  lng: number;
  lat: number;
  /** Horizontal accuracy in metres. */
  accuracy: number;
  /** Ground speed in m/s, null when unknown. */
  speed: number | null;
}

export interface AppState {
  selected: PickedFeature | null;
  routeTo: RouteTarget | null;
  tab: TabId;
  is3D: boolean;
  activeRegionId: string | null;
  bboxDraft: BboxDraft | null;
  /** Bumped whenever the region database changes, so panels re-render. */
  regionsRev: number;
  /** Last GPS fix; null until the first fix arrives. */
  location: LocationFix | null;
  /** Heading in degrees clockwise from north (GPS course when moving, otherwise compass). */
  heading: number | null;
  locationMode: LocationMode;
  locationError: string | null;
  /** Bumped on every change of user layers/features. */
  userRev: number;
  /** Route start chosen from a map object; null means the current GPS position. */
  routeFrom: RouteTarget | null;
  routeProfile: Profile;
  route: RouteResult | null;
  routeBusy: boolean;
  routeError: string | null;
  routeProgress: RouteProgress | null;
}

export const appState = new Store<AppState>({
  selected: null,
  routeTo: null,
  tab: 'map',
  is3D: true,
  activeRegionId: null,
  bboxDraft: null,
  regionsRev: 0,
  location: null,
  heading: null,
  locationMode: 'off',
  locationError: null,
  userRev: 0,
  routeFrom: null,
  routeProfile: 'foot',
  route: null,
  routeBusy: false,
  routeError: null,
  routeProgress: null,
});
