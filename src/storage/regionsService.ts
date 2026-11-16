import { db, type RegionRecord } from './db';
import { inspectArchive, missingLayers } from './pmtilesLocal';
import { openRegionFile, removeRegionFile, writeRegionFile } from './opfs';
import type { Bbox } from '../core/geo';

/** Download/import progress by region id, 0..1. */
export const progress = new Map<string, number>();

export interface RegionPreset {
  id: string;
  name: string;
  bbox: Bbox;
  osmSource: string;
}

/** Bounding boxes: Wikipedia region template (W, S, E, N). */
export const PRESETS: RegionPreset[] = [
  {
    id: 'kurgan',
    name: 'Курганская область',
    bbox: [61.7, 54.0, 68.9, 57.0],
    osmSource: 'russia/ural-fed-district',
  },
];

const DEFAULT_OSM = 'russia/ural-fed-district';

export async function seedPresets(): Promise<void> {
  for (const p of PRESETS) {
    if (await db.regions.get(p.id)) continue;
    await db.regions.put({
      id: p.id,
      name: p.name,
      bbox: p.bbox,
      status: 'planned',
      fileName: null,
      bytes: 0,
      minZoom: 0,
      maxZoom: 14,
      osmSource: p.osmSource,
      error: null,
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
    });
  }
}

/** Shell/planetiler command that produces an OpenMapTiles .pmtiles for the bbox. */
export function planetilerCommand(rec: RegionRecord): string {
  const osmFile = `${rec.osmSource.split('/').pop() ?? 'region'}-latest.osm.pbf`;
  const [w, s, e, n] = rec.bbox.map((v) => v.toFixed(4));
  return [
    `java -Xmx6g -jar planetiler.jar`,
    `  --osm-path=data/${osmFile}`,
    `  --bounds=${w},${s},${e},${n}`,
    `  --maxzoom=${rec.maxZoom}`,
    `  --output=data/${rec.id}.pmtiles --force`,
  ].join(' \\\n');
}

export async function createPlannedRegion(name: string, bbox: Bbox): Promise<RegionRecord> {
  const rec: RegionRecord = {
    id: `r-${Date.now().toString(36)}`,
    name: name.trim() || 'Новый регион',
    bbox,
    status: 'planned',
    fileName: null,
    bytes: 0,
    minZoom: 0,
    maxZoom: 14,
    osmSource: DEFAULT_OSM,
    error: null,
    createdAt: Date.now(),
  };
  await db.regions.put(rec);
  return rec;
}

/**
 * Imports a ready .pmtiles file. If targetId is given, it fills that planned region;
 * otherwise a new region is created from the file name.
 */
export async function importRegionFile(
  file: File,
  targetId: string | null,
  onChange: () => void,
): Promise<RegionRecord> {
  const info = await inspectArchive(file);
  if (!info.isMvt) throw new Error('Файл не векторный (нужен MVT/PMTiles с векторными тайлами)');
  const missing = missingLayers(info.layers);
  if (missing.length) {
    throw new Error(`Схема не OpenMapTiles, нет слоёв: ${missing.join(', ')}`);
  }

  const existing = targetId ? await db.regions.get(targetId) : undefined;
  const id = existing?.id ?? `f-${Date.now().toString(36)}`;
  const fileName = `${id}.pmtiles`;
  const rec: RegionRecord = {
    id,
    name: existing?.name ?? file.name.replace(/\.pmtiles$/i, ''),
    bbox: info.bounds,
    status: 'importing',
    fileName,
    bytes: 0,
    minZoom: info.minZoom,
    maxZoom: info.maxZoom,
    osmSource: existing?.osmSource ?? DEFAULT_OSM,
    error: null,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await db.regions.put(rec);

  progress.set(id, 0);
  let last = 0;
  try {
    await writeRegionFile(fileName, file, (done, total) => {
      progress.set(id, total ? done / total : 1);
      const now = Date.now();
      if (now - last > 200) {
        last = now;
        onChange();
      }
    });
    await db.regions.update(id, { status: 'ready', bytes: file.size, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.regions.update(id, { status: 'error', error: msg });
    throw err;
  } finally {
    progress.delete(id);
    onChange();
  }
  return (await db.regions.get(id)) as RegionRecord;
}

export async function deleteRegion(id: string): Promise<void> {
  const rec = await db.regions.get(id);
  if (rec?.fileName) await removeRegionFile(rec.fileName);
  await db.regions.delete(id);
  const active = await db.prefs.get('activeRegion');
  if (active?.value === id) await db.prefs.put({ key: 'activeRegion', value: null });
}

/** Verifies that the stored file still opens (used before activation). */
export async function assertRegionFile(rec: RegionRecord): Promise<File> {
  if (!rec.fileName) throw new Error('Файл региона не импортирован');
  return openRegionFile(rec.fileName);
}
