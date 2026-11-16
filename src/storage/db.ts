import Dexie, { type Table } from 'dexie';
import type { Bbox } from '../core/geo';
import type { FeatureKind, LineType, Passability } from '../core/types';

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

/** User-made group of objects; drawn with its colour, can be hidden or reordered. */
export interface LayerRecord {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  order: number;
  createdAt: number;
}

export interface FeatureRecord {
  id: string;
  layerId: string;
  kind: FeatureKind;
  name: string;
  description: string;
  /** Point for POI, LineString for lines/tracks, Polygon for zones (WGS84). */
  geometry: GeoJSON.Geometry;
  lineType: LineType | null;
  passability: Passability | null;
  /** Icon key from the POI icon set (src/map/icons.ts). */
  icon: string | null;
  /** Optional per-feature colour; falls back to the layer colour. */
  color: string | null;
  photo: Blob | null;
  source: 'draw' | 'gps' | 'import';
  createdAt: number;
  updatedAt: number;
}

class MeshDB extends Dexie {
  regions!: Table<RegionRecord, string>;
  prefs!: Table<PrefRecord, string>;
  layers!: Table<LayerRecord, string>;
  features!: Table<FeatureRecord, string>;

  constructor() {
    super('meshmaps');
    this.version(1).stores({
      regions: 'id, status, createdAt',
      prefs: 'key',
    });
    this.version(2).stores({
      layers: 'id, order',
      features: 'id, layerId, kind',
    });
  }
}

export const db = new MeshDB();
