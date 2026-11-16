import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import { drawStore, resetDraw } from '../core/draw';
import { appState } from '../core/store';
import { haversine, type LngLat } from '../core/geo';
import { getFeature, patchFeature, saveFeature } from '../storage/userData';
import type { LineType, Passability } from '../core/types';
import { setDraft } from './userLayers';
import { attachRecorder } from '../core/recorder';

const SNAP_PX = 16;
const VERTEX_PX = 22;
const ROAD_LAYERS = ['road-main', 'road-secondary', 'road-minor', 'rail'];

/** Snaps to the nearest vertex of a visible road within SNAP_PX pixels, otherwise keeps the click. */
export function snapPoint(map: MlMap, e: MapMouseEvent): [number, number] {
  const fallback: [number, number] = [e.lngLat.lng, e.lngLat.lat];
  if (!drawStore.get().snap) return fallback;
  const { x, y } = e.point;
  const roads = map.queryRenderedFeatures(
    [
      [x - SNAP_PX, y - SNAP_PX],
      [x + SNAP_PX, y + SNAP_PX],
    ],
    { layers: ROAD_LAYERS },
  );
  let best: { d: number; p: [number, number] } | null = null;
  for (const r of roads) {
    const g = r.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const line of lines) {
      for (const c of line as [number, number][]) {
        const px = map.project(c);
        const d = Math.hypot(px.x - x, px.y - y);
        if (d <= SNAP_PX && (!best || d < best.d)) best = { d, p: c };
      }
    }
  }
  return best ? best.p : fallback;
}

function nearestVertex(map: MlMap, points: [number, number][], e: MapMouseEvent): number | null {
  let bestIdx: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const px = map.project(points[i]);
    const d = Math.hypot(px.x - e.point.x, px.y - e.point.y);
    if (d <= VERTEX_PX && d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Opens a stored line or zone for vertex editing. */
export async function startEditFeature(fid: string): Promise<void> {
  const f = await getFeature(fid);
  if (!f || (f.geometry.type !== 'LineString' && f.geometry.type !== 'Polygon')) return;
  const pts: [number, number][] =
    f.geometry.type === 'LineString'
      ? f.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number])
      : f.geometry.coordinates[0].slice(0, -1).map((c) => [c[0], c[1]] as [number, number]);
  drawStore.set({
    mode: 'edit',
    editFeatureId: fid,
    points: pts,
    selectedVertex: null,
    layerId: f.layerId,
    polygon: f.geometry.type === 'Polygon',
  });
  appState.set({ tab: 'map', selected: null });
}

export function startDrawing(mode: 'line' | 'polygon' | 'poi', layerId: string): void {
  drawStore.set({
    mode,
    points: [],
    layerId,
    selectedVertex: null,
    editFeatureId: null,
    polygon: mode === 'polygon',
  });
  appState.set({ tab: 'map', selected: null });
}

/**
 * Handles a map click in the current drawing mode.
 * Returns true when the click was consumed by drawing (so object picking is skipped).
 */
export function handleDrawClick(map: MlMap, e: MapMouseEvent): boolean {
  const s = drawStore.get();
  if (s.mode === 'line' || s.mode === 'polygon') {
    drawStore.set({ points: [...s.points, snapPoint(map, e)] });
    return true;
  }
  if (s.mode === 'edit') {
    const idx = nearestVertex(map, s.points, e);
    if (idx !== null) {
      drawStore.set({ selectedVertex: idx === s.selectedVertex ? null : idx });
    } else if (s.selectedVertex !== null) {
      const pts = s.points.slice();
      pts[s.selectedVertex] = snapPoint(map, e);
      drawStore.set({ points: pts });
    }
    return true;
  }
  return false;
}

export function undoPoint(): void {
  drawStore.set({ points: drawStore.get().points.slice(0, -1) });
}

export function deleteSelectedVertex(): void {
  const s = drawStore.get();
  if (s.selectedVertex === null) return;
  drawStore.set({ points: s.points.filter((_, i) => i !== s.selectedVertex), selectedVertex: null });
}

/** Length of the polyline (closed ring for polygons), metres. */
export function lengthOf(points: [number, number][], closed: boolean): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1] as LngLat, points[i] as LngLat);
  if (closed && points.length > 2) total += haversine(points[points.length - 1] as LngLat, points[0] as LngLat);
  return total;
}

/** Saves the drawn geometry as a new feature, or writes it back to the edited one. */
export async function commitGeometry(opts: {
  name: string;
  lineType: LineType;
  passability: Passability;
  layerId: string;
}): Promise<boolean> {
  const s = drawStore.get();
  const minPts = s.polygon ? 3 : 2;
  if (s.points.length < minPts) return false;
  const geometry: GeoJSON.Geometry = s.polygon
    ? { type: 'Polygon', coordinates: [[...s.points, s.points[0]]] }
    : { type: 'LineString', coordinates: s.points };

  if (s.mode === 'edit' && s.editFeatureId) {
    await patchFeature(s.editFeatureId, { geometry });
  } else {
    await saveFeature({
      layerId: opts.layerId,
      kind: s.polygon ? 'polygon' : 'line',
      name: opts.name,
      description: '',
      geometry,
      lineType: s.polygon ? null : opts.lineType,
      passability: s.polygon ? null : opts.passability,
      icon: null,
      color: null,
      photo: null,
      source: 'draw',
    });
  }
  resetDraw();
  return true;
}

/** Keeps the draft layer in sync with the drawing state. */
export function attachDrawing(map: MlMap): void {
  drawStore.subscribe((s) => setDraft(map, s.points, s.polygon, s.selectedVertex));
  attachRecorder();
}
