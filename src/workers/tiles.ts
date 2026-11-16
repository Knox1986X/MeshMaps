import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { RoadLine } from '../core/routing/types';

/** Zoom at which OpenMapTiles carries the full road network. */
export const ROUTE_ZOOM = 14;

/** Tile column/row range covering a lng/lat box at zoom z. */
export function tileRange(w: number, s: number, e: number, n: number, z: number): { x0: number; x1: number; y0: number; y1: number } {
  const scale = 2 ** z;
  const lngX = (lng: number): number => Math.floor(((lng + 180) / 360) * scale);
  const latY = (lat: number): number => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * scale);
  };
  const clampMax = scale - 1;
  return {
    x0: Math.max(0, Math.min(clampMax, lngX(w))),
    x1: Math.max(0, Math.min(clampMax, lngX(e))),
    y0: Math.max(0, Math.min(clampMax, latY(n))),
    y1: Math.max(0, Math.min(clampMax, latY(s))),
  };
}

function tileToLngLat(gx: number, gy: number, z: number): [number, number] {
  const scale = 2 ** z;
  const lng = (gx / scale) * 360 - 180;
  const m = Math.PI - (2 * Math.PI * gy) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(m) - Math.exp(-m)));
  return [lng, lat];
}

function oneway(v: unknown): -1 | 0 | 1 {
  if (v === -1 || v === '-1') return -1;
  if (v === 1 || v === true || v === '1' || v === 'yes') return 1;
  return 0;
}

function text(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).toLowerCase();
}

/** Decodes the `transportation` layer of one MVT tile into road lines in WGS84. */
export function decodeRoadTile(data: ArrayBuffer | Uint8Array, x: number, y: number, z: number): RoadLine[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const tile = new VectorTile(new PbfReader(bytes));
  const layer = tile.layers.transportation;
  if (!layer) return [];
  const lines: RoadLine[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 2) continue;
    const p = f.properties;
    const cls = text(p.class);
    const sub = text(p.subclass);
    const ow = oneway(p.oneway);
    const access: Record<string, string> = {};
    const keys: [string, string][] = [
      ['generic', 'access'],
      ['foot', 'foot'],
      ['bicycle', 'bicycle'],
      ['motor_vehicle', 'motor_vehicle'],
    ];
    for (const [k, src] of keys) {
      const v = text(p[src]);
      if (v) access[k] = v;
    }
    const ext = f.extent || 4096;
    for (const ring of f.loadGeometry()) {
      if (ring.length < 2) continue;
      const coords = ring.map((pt): [number, number] => tileToLngLat(x + pt.x / ext, y + pt.y / ext, z));
      // Global coordinates of shared tile edges are identical, so neighbouring tiles connect exactly.
      lines.push({ coords, cls, sub, oneway: ow, access, user: null });
    }
  }
  return lines;
}

export interface NamedPoint {
  layer: string;
  cls: string;
  name: string;
  lng: number;
  lat: number;
}

/** Named point features (place, poi, ...) of one MVT tile; used to build the offline search index. */
export function decodeNamedFeatures(
  data: ArrayBuffer | Uint8Array,
  x: number,
  y: number,
  z: number,
  layers: string[],
): NamedPoint[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const tile = new VectorTile(new PbfReader(bytes));
  const out: NamedPoint[] = [];
  for (const layerName of layers) {
    const layer = tile.layers[layerName];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 1) continue;
      const name = f.properties.name;
      if (typeof name !== 'string' || name.trim() === '') continue;
      const p = f.loadGeometry()[0]?.[0];
      if (!p) continue;
      const ext = f.extent || 4096;
      const [lng, lat] = tileToLngLat(x + p.x / ext, y + p.y / ext, z);
      out.push({ layer: layerName, cls: text(f.properties.class), name: name.trim(), lng, lat });
    }
  }
  return out;
}
