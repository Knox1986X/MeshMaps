import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import { appState, type AppState, type LocationFix } from '../core/store';

const SRC = 'mm-location';
const CONE_RADIUS_M = 45;
const CONE_HALF_ANGLE = 32;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Point at distance (m) and bearing (deg, clockwise from north) from [lng, lat]. */
export function destination(lng: number, lat: number, bearingDeg: number, distM: number): [number, number] {
  const R = 6371008.8;
  const d = distM / R;
  const th = (bearingDeg * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lng * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((l2 * 180) / Math.PI + 540) % 360 - 180, (p2 * 180) / Math.PI];
}

function circleRing(loc: LocationFix, radiusM: number, steps = 48): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) ring.push(destination(loc.lng, loc.lat, (i * 360) / steps, radiusM));
  return ring;
}

/** Builds the GeoJSON for accuracy ring, direction cone and the position dot. */
export function buildLocationFeatures(loc: LocationFix | null, heading: number | null): FeatureCollection {
  if (!loc) return EMPTY;
  const features: Feature[] = [];
  const acc = Math.max(loc.accuracy, 4);
  const accuracyPoly: Polygon = { type: 'Polygon', coordinates: [circleRing(loc, acc)] };
  features.push({ type: 'Feature', properties: { kind: 'accuracy' }, geometry: accuracyPoly });

  if (heading !== null) {
    const ring: [number, number][] = [[loc.lng, loc.lat]];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = heading - CONE_HALF_ANGLE + (i * 2 * CONE_HALF_ANGLE) / steps;
      ring.push(destination(loc.lng, loc.lat, a, CONE_RADIUS_M));
    }
    ring.push([loc.lng, loc.lat]);
    features.push({ type: 'Feature', properties: { kind: 'cone' }, geometry: { type: 'Polygon', coordinates: [ring] } });
  }

  const dot: Point = { type: 'Point', coordinates: [loc.lng, loc.lat] };
  features.push({ type: 'Feature', properties: { kind: 'dot' }, geometry: dot });
  return { type: 'FeatureCollection', features };
}

export function addLocationLayers(map: MlMap): void {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'mm-loc-accuracy',
    type: 'fill',
    source: SRC,
    filter: ['==', ['get', 'kind'], 'accuracy'],
    paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: 'mm-loc-cone',
    type: 'fill',
    source: SRC,
    filter: ['==', ['get', 'kind'], 'cone'],
    paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.4 },
  });
  map.addLayer({
    id: 'mm-loc-halo',
    type: 'circle',
    source: SRC,
    filter: ['==', ['get', 'kind'], 'dot'],
    paint: { 'circle-radius': 16, 'circle-color': '#38bdf8', 'circle-opacity': 0.25 },
  });
  map.addLayer({
    id: 'mm-loc-dot',
    type: 'circle',
    source: SRC,
    filter: ['==', ['get', 'kind'], 'dot'],
    paint: {
      'circle-radius': 7,
      'circle-color': '#2563eb',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
    },
  });
}

function refresh(map: MlMap): void {
  const s = appState.get();
  (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(buildLocationFeatures(s.location, s.heading));
}

/** Keeps the location layers in sync and drives the camera in follow / nav modes. */
export function attachLocation(map: MlMap): void {
  let frame = 0;
  let lastCam = 0;

  const scheduleDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      refresh(map);
    });
  };

  const follow = (s: AppState, modeChanged: boolean) => {
    if (!s.location || s.locationMode === 'off') return;
    const now = performance.now();
    if (!modeChanged && now - lastCam < 250) return;
    lastCam = now;
    const center: [number, number] = [s.location.lng, s.location.lat];
    if (s.locationMode === 'follow') {
      map.easeTo({ center, duration: 400 });
    } else {
      map.easeTo({
        center,
        bearing: s.heading ?? map.getBearing(),
        pitch: 55,
        zoom: Math.max(map.getZoom(), 17),
        duration: 400,
      });
    }
  };

  appState.subscribe((s, prev) => {
    if (s.location !== prev.location || s.heading !== prev.heading) scheduleDraw();
    if (s.location !== prev.location || s.heading !== prev.heading || s.locationMode !== prev.locationMode) {
      follow(s, s.locationMode !== prev.locationMode);
    }
  });

  // A user drag or rotate gesture leaves follow / nav mode.
  const stopFollowOnGesture = (e: { originalEvent?: Event }) => {
    if (e.originalEvent && appState.get().locationMode !== 'off') appState.set({ locationMode: 'off' });
  };
  map.on('dragstart', stopFollowOnGesture);
  map.on('rotatestart', stopFollowOnGesture);

  refresh(map);
}
