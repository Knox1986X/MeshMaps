import type { Feature, Geometry } from 'geojson';

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
  kind: 'poi' | 'building' | 'road';
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

export interface AppState {
  selected: PickedFeature | null;
  routeTo: RouteTarget | null;
  tab: TabId;
  is3D: boolean;
  activeRegionId: string | null;
  bboxDraft: BboxDraft | null;
  /** Bumped whenever the region database changes, so panels re-render. */
  regionsRev: number;
}

export const appState = new Store<AppState>({
  selected: null,
  routeTo: null,
  tab: 'map',
  is3D: true,
  activeRegionId: null,
  bboxDraft: null,
  regionsRev: 0,
});
