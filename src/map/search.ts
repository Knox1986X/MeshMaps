import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { db } from '../storage/db';
import { appState } from '../core/store';
import { searchIndex } from '../storage/placeIndex';
import { PLACE_CLASS_RU as PLACE_RU, POI_CLASS_RU, ROAD_CLASS_RU, asString } from '../core/format';
import { matchScore, parseCoords, rankHits, type HitKind, type SearchHit } from '../core/search';

/** Vector source of the active basemap (OpenMapTiles schema, offline or online). */
const BASEMAP_SRC = 'openmaptiles';
const PIN_SRC = 'mm-search-pin';
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

const LAYERS: { sourceLayer: string; kind: HitKind }[] = [
  { sourceLayer: 'place', kind: 'place' },
  { sourceLayer: 'poi', kind: 'poi' },
  { sourceLayer: 'transportation_name', kind: 'street' },
];

function centerOf(g: Geometry): [number, number] | null {
  if (g.type === 'Point') return g.coordinates as [number, number];
  if (g.type === 'LineString') {
    const c = g.coordinates;
    return c.length ? (c[Math.floor(c.length / 2)] as [number, number]) : null;
  }
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0] ?? [];
    if (!ring.length) return null;
    const sum = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  return null;
}

/** Names from the basemap tiles that are loaded right now (works offline for any region already viewed). */
function basemapHits(map: MlMap, query: string): { hit: SearchHit; score: number }[] {
  if (!map.getSource(BASEMAP_SRC)) return [];
  const out: { hit: SearchHit; score: number }[] = [];
  for (const { sourceLayer, kind } of LAYERS) {
    let feats: Feature[];
    try {
      feats = map.querySourceFeatures(BASEMAP_SRC, { sourceLayer });
    } catch {
      continue;
    }
    for (const f of feats) {
      const name = asString(f.properties?.name);
      if (!name || !f.geometry) continue;
      const score = matchScore(name, query);
      if (!score) continue;
      const c = centerOf(f.geometry);
      if (!c) continue;
      const cls = asString(f.properties?.class) ?? '';
      const subtitle =
        kind === 'poi'
          ? (POI_CLASS_RU[cls] ?? 'Место')
          : kind === 'street'
            ? (ROAD_CLASS_RU[cls] ?? 'Дорога')
            : (PLACE_RU[cls] ?? 'Населённый пункт');
      out.push({
        hit: { id: `${kind}-${c[0].toFixed(6)}-${c[1].toFixed(6)}`, title: name, subtitle, lng: c[0], lat: c[1], kind },
        // Settlements rank above minor objects with the same name.
        score: score + (kind === 'place' ? 0.5 : 0),
      });
    }
  }
  return out;
}

/** The user's own objects (points, lines, zones) matching the query. */
async function userHits(query: string): Promise<{ hit: SearchHit; score: number }[]> {
  const features = await db.features.toArray();
  const out: { hit: SearchHit; score: number }[] = [];
  for (const f of features) {
    const score = matchScore(f.name, query);
    if (!score) continue;
    const g = f.geometry;
    const c = centerOf(g);
    if (!c) continue;
    out.push({
      hit: {
        id: `user-${f.id}`,
        title: f.name,
        subtitle: f.kind === 'poi' ? 'Мой объект' : f.kind === 'line' ? 'Моя линия' : 'Моя зона',
        lng: c[0],
        lat: c[1],
        kind: 'user',
      },
      score: score + 0.25,
    });
  }
  return out;
}

/** Search across the basemap and user objects; «lat, lng» input returns the coordinates themselves. */
export async function searchAll(map: MlMap, raw: string): Promise<SearchHit[]> {
  const query = raw.trim();
  const coords = parseCoords(query);
  if (coords) {
    const [lng, lat] = coords;
    return [{ id: 'coords', title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, subtitle: 'Координаты', lng, lat, kind: 'coords' }];
  }
  if (query.length < 2) return [];
  const regionId = appState.get().activeRegionId;
  const [indexed, user] = [await searchIndex(query, regionId), await userHits(query)];
  // Streets and objects of the loaded map view complement the offline index.
  return rankHits([...indexed, ...user, ...basemapHits(map, query)]);
}

/** Pin layer for the selected search result. */
export function addSearchLayers(map: MlMap): void {
  if (map.getSource(PIN_SRC)) return;
  map.addSource(PIN_SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'mm-search-pin',
    type: 'circle',
    source: PIN_SRC,
    paint: {
      'circle-radius': 9,
      'circle-color': '#38bdf8',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2.5,
    },
  });
}

export function setSearchPin(map: MlMap, hit: SearchHit | null): void {
  const src = map.getSource(PIN_SRC) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(
    hit
      ? {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [hit.lng, hit.lat] } }],
        }
      : EMPTY,
  );
}

export function goToHit(map: MlMap, hit: SearchHit): void {
  map.flyTo({ center: [hit.lng, hit.lat], zoom: Math.max(map.getZoom(), 16), duration: 900 });
  setSearchPin(map, hit);
}
