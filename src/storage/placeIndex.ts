import { PMTiles } from 'pmtiles';
import { db, type PlaceRecord, type RegionRecord } from './db';
import { LocalFileSource } from './pmtilesLocal';
import { normalizeName, matchScore, type SearchHit } from '../core/search';
import { PLACE_CLASS_RU, POI_CLASS_RU } from '../core/format';
import { decodeNamedFeatures, tileRange } from '../workers/tiles';

/**
 * Offline search index: named places and POI read straight from a region archive.
 * Zoom 12 carries every place label (settlements, districts, states, countries) and most POI,
 * so one pass over zoom-12 tiles covers the region without loading the map view.
 */
const INDEX_ZOOM = 12;
/** Upper bound on tiles per region, keeps indexing within minutes on a phone. */
const MAX_INDEX_TILES = 30000;
const CONCURRENCY = 8;
const CHUNK = 2000;

export type IndexProgress = (fraction: number) => void;

/** Builds (or rebuilds) the index for one region. Returns the number of stored names. */
export async function buildPlaceIndex(rec: RegionRecord, file: File, onProgress: IndexProgress): Promise<number> {
  const pm = new PMTiles(new LocalFileSource(file, `index-${rec.id}`));
  const header = await pm.getHeader();
  const z = Math.min(INDEX_ZOOM, header.maxZoom);
  const [w, s, e, n] = rec.bbox;
  const r = tileRange(w, s, e, n, z);
  const cols = r.x1 - r.x0 + 1;
  const rows = r.y1 - r.y0 + 1;
  const total = cols * rows;
  if (total > MAX_INDEX_TILES) {
    throw new Error('Регион слишком большой для индекса поиска. Импортируйте более мелкий регион (например, один город или область).');
  }

  const found = new Map<string, PlaceRecord>();
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < total) {
      const idx = next++;
      const x = r.x0 + (idx % cols);
      const y = r.y0 + Math.floor(idx / cols);
      const tile = await pm.getZxy(z, x, y);
      if (tile) {
        for (const f of decodeNamedFeatures(tile.data, x, y, z, ['place', 'poi'])) {
          // Tiles overlap the region border; keep only names inside the region box.
          if (f.lng < w || f.lng > e || f.lat < s || f.lat > n) continue;
          const kind = f.layer === 'place' ? 'place' : 'poi';
          const key = `${kind}|${normalizeName(f.name)}|${f.lng.toFixed(6)}|${f.lat.toFixed(6)}`;
          if (found.has(key)) continue;
          found.set(key, {
            id: `${rec.id}|${key}`,
            regionId: rec.id,
            kind,
            subtitle: kind === 'place' ? placeSubtitle(f.cls) : poiSubtitle(f.cls),
            title: f.name,
            norm: normalizeName(f.name),
            lng: f.lng,
            lat: f.lat,
          });
        }
      }
      done++;
      if (done % 16 === 0 || done === total) {
        onProgress(done / total);
        // Let the UI breathe: indexing runs on the main thread.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  await db.transaction('rw', db.places, db.regions, async () => {
    await db.places.where('regionId').equals(rec.id).delete();
    const all = [...found.values()];
    for (let i = 0; i < all.length; i += CHUNK) await db.places.bulkPut(all.slice(i, i + CHUNK));
    await db.regions.update(rec.id, { indexedAt: Date.now() });
  });
  return found.size;
}

function placeSubtitle(cls: string): string {
  return PLACE_CLASS_RU[cls] ?? 'Населённый пункт';
}

function poiSubtitle(cls: string): string {
  return POI_CLASS_RU[cls] ?? 'Место';
}

/** Matches the query against stored names. regionId null means every indexed region. */
export async function searchIndex(query: string, regionId: string | null): Promise<{ hit: SearchHit; score: number }[]> {
  const rows = regionId
    ? await db.places.where('regionId').equals(regionId).toArray()
    : await db.places.toArray();
  const out: { hit: SearchHit; score: number }[] = [];
  for (const row of rows) {
    const score = matchScore(row.title, query);
    if (!score) continue;
    out.push({
      hit: { id: row.id, title: row.title, subtitle: row.subtitle, lng: row.lng, lat: row.lat, kind: row.kind },
      // Settlements and admin areas rank above POI with the same name.
      score: score + (row.kind === 'place' ? 0.5 : 0),
    });
  }
  return out;
}

export async function indexedRegionCount(regionId: string): Promise<number> {
  return db.places.where('regionId').equals(regionId).count();
}
