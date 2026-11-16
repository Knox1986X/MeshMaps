import type { Map as MlMap, GeoJSONSource, FilterSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { FeatureRecord, LayerRecord } from '../storage/db';

export const USER_SRC = 'mm-user';
export const DRAFT_SRC = 'mm-draft';

/** Layer ids that hold user objects; picking checks them first. */
export const USER_PICK_LAYERS = ['mm-user-poi-icon', 'mm-user-poi-halo', 'mm-user-line-core', 'mm-user-line-glow', 'mm-user-poly-fill'];

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

let layersState: LayerRecord[] = [];
let featuresState: FeatureRecord[] = [];

export function setUserData(layers: LayerRecord[], features: FeatureRecord[]): void {
  layersState = layers;
  featuresState = features;
}

/** Builds the render collection: hidden layers are skipped, colours come from the layer. */
export function buildUserCollection(): FeatureCollection {
  const visible = new Map(layersState.map((l) => [l.id, l]));
  const features: Feature[] = [];
  for (const f of featuresState) {
    const layer = visible.get(f.layerId);
    if (!layer || !layer.visible) continue;
    features.push({
      type: 'Feature',
      properties: {
        fid: f.id,
        kind: f.kind,
        name: f.name,
        color: f.color ?? layer.color,
        lineType: f.lineType ?? 'trail',
        icon: f.icon ?? 'dot',
      },
      geometry: f.geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

export function refreshUserSource(map: MlMap): void {
  (map.getSource(USER_SRC) as GeoJSONSource | undefined)?.setData(buildUserCollection());
}

export function addUserLayers(map: MlMap): void {
  if (map.getSource(USER_SRC)) return;
  map.addSource(USER_SRC, { type: 'geojson', data: EMPTY });
  const kind = (k: string): FilterSpecification => ['==', ['get', 'kind'], k];
  const lineNotTrail: FilterSpecification = ['all', ['==', ['get', 'kind'], 'line'], ['!=', ['get', 'lineType'], 'trail']];
  const lineTrail: FilterSpecification = ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'lineType'], 'trail']];

  map.addLayer({
    id: 'mm-user-poly-fill',
    type: 'fill',
    source: USER_SRC,
    filter: kind('polygon'),
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.22 },
  });
  map.addLayer({
    id: 'mm-user-poly-line',
    type: 'line',
    source: USER_SRC,
    filter: kind('polygon'),
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
  });
  map.addLayer({
    id: 'mm-user-line-glow',
    type: 'line',
    source: USER_SRC,
    filter: kind('line'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 5, 18, 14],
      'line-blur': 5,
      'line-opacity': 0.55,
    },
  });
  map.addLayer({
    id: 'mm-user-line-core',
    type: 'line',
    source: USER_SRC,
    filter: lineNotTrail,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.8, 18, 5],
    },
  });
  map.addLayer({
    id: 'mm-user-trail',
    type: 'line',
    source: USER_SRC,
    filter: lineTrail,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.8, 18, 5],
      'line-dasharray': [2, 1.6],
    },
  });
  map.addLayer({
    id: 'mm-user-poi-halo',
    type: 'circle',
    source: USER_SRC,
    filter: kind('poi'),
    paint: { 'circle-radius': 16, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 },
  });
  map.addLayer({
    id: 'mm-user-poi-icon',
    type: 'symbol',
    source: USER_SRC,
    filter: kind('poi'),
    layout: {
      'icon-image': ['concat', 'mm-', ['get', 'icon']],
      'icon-size': 0.6,
      'icon-allow-overlap': true,
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#f8fafc', 'text-halo-color': '#0b0f19', 'text-halo-width': 1.5 },
  });
  refreshUserSource(map);
}

// ---------- draft (what is being drawn right now) ----------

export function addDraftLayers(map: MlMap): void {
  if (map.getSource(DRAFT_SRC)) return;
  map.addSource(DRAFT_SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'mm-draft-fill',
    type: 'fill',
    source: DRAFT_SRC,
    filter: ['==', ['get', 'kind'], 'area'],
    paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'mm-draft-line',
    type: 'line',
    source: DRAFT_SRC,
    filter: ['==', ['get', 'kind'], 'path'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#38bdf8', 'line-width': 3, 'line-dasharray': [1.5, 1] },
  });
  map.addLayer({
    id: 'mm-draft-vertex',
    type: 'circle',
    source: DRAFT_SRC,
    filter: ['==', ['get', 'kind'], 'vertex'],
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 9, 6],
      'circle-color': ['case', ['get', 'selected'], '#facc15', '#ffffff'],
      'circle-stroke-color': '#2563eb',
      'circle-stroke-width': 2.5,
    },
  });
}

export function setDraft(map: MlMap, points: [number, number][], polygon: boolean, selected: number | null): void {
  const src = map.getSource(DRAFT_SRC) as GeoJSONSource | undefined;
  if (!src) return;
  const features: Feature[] = [];
  if (points.length >= 2 && !polygon) {
    features.push({ type: 'Feature', properties: { kind: 'path' }, geometry: { type: 'LineString', coordinates: points } });
  }
  if (points.length >= 3 && polygon) {
    features.push({
      type: 'Feature',
      properties: { kind: 'area' },
      geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
    });
  }
  points.forEach((p, i) => {
    features.push({
      type: 'Feature',
      properties: { kind: 'vertex', selected: i === selected },
      geometry: { type: 'Point', coordinates: p },
    });
  });
  src.setData({ type: 'FeatureCollection', features });
}
