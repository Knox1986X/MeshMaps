import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { appState } from '../core/store';
import { db } from '../storage/db';
import { openRegionFile } from '../storage/opfs';
import { routeProgress } from '../core/routing/progress';
import type { Profile, RouteProgress, RouteResult, UserLineInput } from '../core/routing/types';
import type { RouteReply, RouteRequest, TileSourceSpec } from '../workers/router.worker';
import { ONLINE_TILES_URL } from './createMap';

const ROUTE_SRC = 'mm-route';
const ENDS_SRC = 'mm-route-ends';
const ARROW = 'mm-route-arrow';
/** Distance from the route that triggers a new route from the current position. */
const OFF_ROUTE_M = 50;
const REROUTE_COOLDOWN_MS = 8000;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface Pending {
  resolve: (r: RouteResult) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('../workers/router.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (ev: MessageEvent<RouteReply>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  };
  w.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('Движок маршрутов остановлен. Повторите попытку.'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

/** The archive of the active offline region, or the online OpenFreeMap tiles when no region is active. */
async function tileSource(): Promise<TileSourceSpec> {
  const id = appState.get().activeRegionId;
  if (id) {
    const rec = await db.regions.get(id);
    if (rec?.fileName && rec.status === 'ready') {
      return { kind: 'archive', file: await openRegionFile(rec.fileName), key: `region-${rec.id}-${rec.fileName}` };
    }
  }
  return { kind: 'online', tilejsonUrl: ONLINE_TILES_URL };
}

/** Visible user-drawn lines; they are routable with their own passability. */
async function userInputs(): Promise<UserLineInput[]> {
  const [layers, features] = await Promise.all([db.layers.toArray(), db.features.toArray()]);
  const visible = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const out: UserLineInput[] = [];
  for (const f of features) {
    if (f.kind !== 'line' || !visible.has(f.layerId) || f.geometry.type !== 'LineString') continue;
    out.push({
      coords: f.geometry.coordinates as [number, number][],
      lineType: f.lineType ?? 'trail',
      passability: f.passability ?? 'foot',
    });
  }
  return out;
}

async function computeRoute(from: [number, number], to: [number, number], profile: Profile): Promise<RouteResult> {
  const [source, user] = await Promise.all([tileSource(), userInputs()]);
  const id = ++seq;
  return new Promise<RouteResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: RouteRequest = { type: 'route', id, from, to, profile, source, user };
    getWorker().postMessage(req);
  }).catch((err: Error) => {
    if (/Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      throw new Error('Нет связи с сервером карт. Для офлайн-маршрута загрузите регион в разделе «Регионы».');
    }
    throw err;
  });
}

let buildToken = 0;

export interface BuildOptions {
  /** Automatic rebuild while navigating: keep the old route on failure and start from GPS. */
  silent?: boolean;
  fromGps?: boolean;
}

/** Builds a route from the chosen start (or GPS) to the destination in the store. */
export async function buildRoute(opts: BuildOptions = {}): Promise<void> {
  const s = appState.get();
  if (!s.routeTo) {
    appState.set({ routeError: 'Выберите пункт назначения на карте.' });
    return;
  }
  const useGps = opts.fromGps || !s.routeFrom;
  const start = useGps ? (s.location ? { lng: s.location.lng, lat: s.location.lat } : null) : s.routeFrom;
  if (!start) {
    appState.set({
      routeError: 'Нет GPS-позиции. Включите геолокацию или выберите точку «Откуда» в карточке объекта.',
    });
    return;
  }
  const token = ++buildToken;
  appState.set({ routeBusy: true, routeError: null });
  try {
    const route = await computeRoute([start.lng, start.lat], [s.routeTo.lng, s.routeTo.lat], s.routeProfile);
    if (token !== buildToken) return;
    appState.set({ route, routeProgress: null, routeBusy: false });
  } catch (err) {
    if (token !== buildToken) return;
    const message = err instanceof Error ? err.message : 'Не удалось построить маршрут';
    appState.set(opts.silent ? { routeBusy: false, routeError: message } : { routeBusy: false, routeError: message, route: null, routeProgress: null });
  }
}

export function clearRoute(): void {
  buildToken++;
  appState.set({ route: null, routeProgress: null, routeError: null, routeBusy: false });
}

function arrowImage(): ImageData {
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 24;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas недоступен');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(8, 6);
  g.lineTo(16, 12);
  g.lineTo(8, 18);
  g.stroke();
  return g.getImageData(0, 0, 24, 24);
}

/** Route layers: neon gradient line with glow and direction arrows, plus start/finish markers. */
export function addRouteLayers(map: MlMap): void {
  if (!map.hasImage(ARROW)) map.addImage(ARROW, arrowImage());
  if (!map.getSource(ROUTE_SRC)) {
    map.addSource(ROUTE_SRC, { type: 'geojson', data: EMPTY, lineMetrics: true });
  }
  if (!map.getSource(ENDS_SRC)) {
    map.addSource(ENDS_SRC, { type: 'geojson', data: EMPTY });
  }
  const gradient = ['interpolate', ['linear'], ['line-progress'], 0, '#2563eb', 1, '#a855f7'] as unknown as string;
  map.addLayer({
    id: 'mm-route-glow',
    type: 'line',
    source: ROUTE_SRC,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-gradient': gradient as never, 'line-width': 16, 'line-blur': 8, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: 'mm-route-line',
    type: 'line',
    source: ROUTE_SRC,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-gradient': gradient as never, 'line-width': 5 },
  });
  map.addLayer({
    id: 'mm-route-arrows',
    type: 'symbol',
    source: ROUTE_SRC,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 110,
      'icon-image': ARROW,
      'icon-size': 0.7,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.9 },
  });
  map.addLayer({
    id: 'mm-route-ends',
    type: 'circle',
    source: ENDS_SRC,
    paint: {
      'circle-radius': 7,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#a855f7',
      'circle-stroke-width': 3,
    },
  });
}

/** Pushes the route (or nothing) into the map sources; safe before the style is ready. */
export function setRouteOnMap(map: MlMap, route: RouteResult | null): void {
  const line = map.getSource(ROUTE_SRC) as GeoJSONSource | undefined;
  const ends = map.getSource(ENDS_SRC) as GeoJSONSource | undefined;
  if (!line || !ends) return;
  if (!route) {
    line.setData(EMPTY);
    ends.setData(EMPTY);
    return;
  }
  line.setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.coords } }],
  });
  const point = (c: [number, number]): Feature => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: c },
  });
  ends.setData({ type: 'FeatureCollection', features: [point(route.from), point(route.to)] });
}

function sameProgress(a: RouteProgress, b: RouteProgress | null): boolean {
  return (
    !!b &&
    Math.round(a.offM) === Math.round(b.offM) &&
    Math.round(a.remainingM / 5) === Math.round(b.remainingM / 5) &&
    a.arrived === b.arrived
  );
}

/** Keeps the route drawn on the map, tracks progress along it and rebuilds it when the user leaves it. */
export function attachRouting(map: MlMap): void {
  let lastReroute = 0;
  appState.subscribe((s, prev) => {
    if (s.route !== prev.route) setRouteOnMap(map, s.route);

    // A new destination makes the old route stale.
    if (s.routeTo !== prev.routeTo && s.route && s.routeTo) {
      const to = s.route.to;
      if (to[0] !== s.routeTo.lng || to[1] !== s.routeTo.lat) {
        appState.set({ route: null, routeProgress: null });
        return;
      }
    }

    if (!s.route || !s.location) return;
    if (s.location === prev.location && s.route === prev.route) return;

    const pos: [number, number] = [s.location.lng, s.location.lat];
    const progress = routeProgress(s.route, pos);
    if (!sameProgress(progress, s.routeProgress)) appState.set({ routeProgress: progress });

    const offRoute = progress.offM > OFF_ROUTE_M && !progress.arrived;
    if (offRoute && s.locationMode !== 'off' && !s.routeBusy && Date.now() - lastReroute > REROUTE_COOLDOWN_MS) {
      lastReroute = Date.now();
      void buildRoute({ silent: true, fromGps: true });
    }
  });
}
