import { appState } from './store';
import { drawStore } from './draw';
import { startTracking } from './location';
import { haversine, type LngLat } from './geo';
import { saveFeature } from '../storage/userData';
import { resetDraw } from './draw';

const MIN_STEP_M = 3;
const MAX_ACCURACY_M = 30;

let attached = false;

/** Subscribes to GPS fixes; while recording, appends points that moved at least MIN_STEP_M. */
export function attachRecorder(): void {
  if (attached) return;
  attached = true;
  appState.subscribe((s, prev) => {
    if (s.location === prev.location || !s.location) return;
    const d = drawStore.get();
    if (d.mode !== 'record') return;
    if (s.location.accuracy > MAX_ACCURACY_M) return;
    const p: [number, number] = [s.location.lng, s.location.lat];
    const last = d.points[d.points.length - 1];
    if (last && haversine(last as LngLat, p) < MIN_STEP_M) return;
    const length = last ? d.recordLength + haversine(last as LngLat, p) : 0;
    drawStore.set({ points: [...d.points, p], recordLength: length });
  });
}

export async function startRecording(layerId: string): Promise<void> {
  await startTracking();
  drawStore.set({ mode: 'record', points: [], layerId, recordLength: 0 });
  appState.set({ tab: 'map', selected: null });
}

/** Stops recording and, if requested and long enough, saves the track as a trail. */
export async function stopRecording(save: boolean): Promise<boolean> {
  const d = drawStore.get();
  const ok = save && d.points.length >= 2 && d.layerId !== null;
  if (ok) {
    const stamp = new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    await saveFeature({
      layerId: d.layerId!,
      kind: 'line',
      name: `Трек ${stamp}`,
      description: '',
      geometry: { type: 'LineString', coordinates: d.points },
      lineType: 'trail',
      passability: 'foot',
      icon: null,
      color: null,
      photo: null,
      source: 'gps',
    });
  }
  resetDraw();
  return ok;
}
