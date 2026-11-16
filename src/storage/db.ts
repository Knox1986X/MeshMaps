import Dexie, { type Table } from 'dexie';
import type { Bbox } from '../core/geo';

export type RegionStatus = 'planned' | 'importing' | 'ready' | 'error';

export interface RegionRecord {
  id: string;
  name: string;
  bbox: Bbox;
  status: RegionStatus;
  /** File name inside OPFS /regions, set once the archive is stored. */
  fileName: string | null;
  bytes: number;
  minZoom: number;
  maxZoom: number;
  /** Geofabrik extract that covers the region, used to build the archive. */
  osmSource: string;
  error: string | null;
  createdAt: number;
}

export interface PrefRecord {
  key: string;
  value: string | null;
}

class MeshDB extends Dexie {
  regions!: Table<RegionRecord, string>;
  prefs!: Table<PrefRecord, string>;

  constructor() {
    super('meshmaps');
    this.version(1).stores({
      regions: 'id, status, createdAt',
      prefs: 'key',
    });
  }
}

export const db = new MeshDB();
