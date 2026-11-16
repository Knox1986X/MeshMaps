import type { Map as MlMap, GeoJSONSource, FilterSpecification } from 'maplibre-gl';
import type { Feature, Geometry } from 'geojson';

export const HL_SOURCE = 'mm-highlight';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Neon highlight: glow + core line, extruded halo for buildings, ring for points. */
export function addHighlightLayers(map: MlMap): void {
  if (map.getSource(HL_SOURCE)) return;
  map.addSource(HL_SOURCE, { type: 'geojson', data: EMPTY, lineMetrics: true });

  const lineFilter: FilterSpecification = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];

  map.addLayer({
    id: 'hl-building',
    type: 'fill-extrusion',
    source: HL_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-extrusion-color': '#a855f7',
      'fill-extrusion-height': ['+', ['coalesce', ['get', 'render_height'], 6], 0.8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.55,
    },
  });
  map.addLayer({
    id: 'hl-line-glow',
    type: 'line',
    source: HL_SOURCE,
    filter: lineFilter,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#00f2fe',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 6, 18, 18],
      'line-blur': 6,
      'line-opacity': 0.9,
    },
  });
  map.addLayer({
    id: 'hl-line-core',
    type: 'line',
    source: HL_SOURCE,
    filter: lineFilter,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#2563eb', 1, '#a855f7'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 5],
    },
  });
  map.addLayer({
    id: 'hl-point',
    type: 'circle',
    source: HL_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 14,
      'circle-color': 'rgba(56, 189, 248, 0.15)',
      'circle-stroke-color': '#38bdf8',
      'circle-stroke-width': 3,
      'circle-blur': 0.2,
    },
  });
}

export function setHighlight(map: MlMap, feature: Feature<Geometry> | null): void {
  const src = map.getSource(HL_SOURCE) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY);
}

const BBOX_SOURCE = 'mm-bbox';

/** Overlay for the region rectangle being drawn. */
export function addOverlayLayers(map: MlMap): void {
  if (map.getSource(BBOX_SOURCE)) return;
  map.addSource(BBOX_SOURCE, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'mm-bbox-fill',
    type: 'fill',
    source: BBOX_SOURCE,
    paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.15 },
  });
  map.addLayer({
    id: 'mm-bbox-line',
    type: 'line',
    source: BBOX_SOURCE,
    paint: { 'line-color': '#38bdf8', 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
  });
}

/** Draws the rectangle [west, south, east, north] or clears it. */
export function setBboxDraft(map: MlMap, rect: [number, number, number, number] | null): void {
  const src = map.getSource(BBOX_SOURCE) as GeoJSONSource | undefined;
  if (!src) return;
  if (!rect) {
    src.setData(EMPTY);
    return;
  }
  const [w, s, e, n] = rect;
  src.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
      },
    ],
  });
}
