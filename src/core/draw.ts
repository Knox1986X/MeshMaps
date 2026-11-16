import { Store } from './store';
import type { DrawMode, LineType, Passability } from './types';

export interface DrawState {
  mode: DrawMode;
  /** Vertices being drawn / edited, [lng, lat]. */
  points: [number, number][];
  layerId: string | null;
  lineType: LineType;
  passability: Passability;
  snap: boolean;
  /** True when the points form a closed polygon (draw mode or edited zone). */
  polygon: boolean;
  editFeatureId: string | null;
  selectedVertex: number | null;
  /** Track recording: length in metres of the recorded points. */
  recordLength: number;
}

export const drawStore = new Store<DrawState>({
  mode: 'idle',
  points: [],
  layerId: null,
  lineType: 'trail',
  passability: 'foot',
  snap: true,
  polygon: false,
  editFeatureId: null,
  selectedVertex: null,
  recordLength: 0,
});

export function resetDraw(): void {
  drawStore.set({ mode: 'idle', points: [], editFeatureId: null, selectedVertex: null, recordLength: 0 });
}
