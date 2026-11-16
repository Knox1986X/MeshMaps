import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Position } from 'geojson';
import { db, type FeatureRecord, type LayerRecord } from './db';
import { newId, saveFeature, createLayer } from './userData';
import { zipRead, zipStore, type ZipEntry } from './zip';
import { saveFile, readBytes } from './files';
import type { FeatureKind, LineType, Passability } from '../core/types';

const BACKUP_VERSION = 1;

function kindOf(g: Geometry): FeatureKind | null {
  if (g.type === 'Point') return 'poi';
  if (g.type === 'LineString' || g.type === 'MultiLineString') return 'line';
  if (g.type === 'Polygon') return 'polygon';
  return null;
}

async function allUser(): Promise<{ layers: LayerRecord[]; features: FeatureRecord[] }> {
  const layers = await db.layers.orderBy('order').toArray();
  const features = await db.features.toArray();
  return { layers, features };
}

function layerNameMap(layers: LayerRecord[]): Map<string, string> {
  return new Map(layers.map((l) => [l.id, l.name]));
}

// ---------- GeoJSON ----------

export async function exportGeoJSON(): Promise<string> {
  const { layers, features } = await allUser();
  const names = layerNameMap(layers);
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: f.name,
        description: f.description,
        kind: f.kind,
        layer: names.get(f.layerId) ?? 'Слой',
        lineType: f.lineType,
        passability: f.passability,
        icon: f.icon,
        color: f.color,
      },
    })),
  };
  return JSON.stringify(fc, null, 2);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Imports features into a new layer named after the file. Returns the number of objects. */
export async function importGeoJSON(text: string, layerName: string): Promise<number> {
  const parsed = JSON.parse(text) as FeatureCollection | Feature | Geometry;
  const feats: Feature[] =
    parsed.type === 'FeatureCollection'
      ? parsed.features
      : parsed.type === 'Feature'
        ? [parsed]
        : [{ type: 'Feature', properties: {}, geometry: parsed as Geometry }];
  const layerId = await createLayer(layerName);
  let count = 0;
  for (const f of feats) {
    if (!f.geometry) continue;
    const kind = kindOf(f.geometry);
    if (!kind) continue;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const lt = str(p.lineType);
    const pass = str(p.passability);
    await saveFeature({
      layerId,
      kind,
      name: str(p.name),
      description: str(p.description),
      geometry: f.geometry,
      lineType: (['trail', 'gravel', 'road'] as const).includes(lt as LineType) ? (lt as LineType) : null,
      passability: (['foot', 'bike', 'car'] as const).includes(pass as Passability) ? (pass as Passability) : null,
      icon: str(p.icon) || null,
      color: str(p.color) || null,
      photo: null,
      source: 'import',
    });
    count++;
  }
  return count;
}

// ---------- GPX ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function exportGPX(): Promise<string> {
  const { features } = await allUser();
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<gpx version="1.1" creator="MeshMaps" xmlns="http://www.topografix.com/GPX/1/1">');
  const pts = (coords: Position[]) =>
    coords.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('');
  for (const f of features) {
    const g = f.geometry;
    if (g.type === 'Point') {
      const [lon, lat] = g.coordinates;
      out.push(`<wpt lat="${lat}" lon="${lon}"><name>${esc(f.name)}</name><desc>${esc(f.description)}</desc></wpt>`);
    } else if (g.type === 'LineString') {
      out.push(`<trk><name>${esc(f.name)}</name><trkseg>${pts(g.coordinates)}</trkseg></trk>`);
    } else if (g.type === 'MultiLineString') {
      const segs = g.coordinates.map((s) => `<trkseg>${pts(s)}</trkseg>`).join('');
      out.push(`<trk><name>${esc(f.name)}</name>${segs}</trk>`);
    } else if (g.type === 'Polygon') {
      // GPX has no polygons: export the outer ring as a closed track.
      out.push(`<trk><name>${esc(f.name)}</name><trkseg>${pts(g.coordinates[0])}</trkseg></trk>`);
    }
  }
  out.push('</gpx>');
  return out.join('\n');
}

export async function importGPX(text: string, layerName: string): Promise<number> {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('GPX: некорректный XML');
  const layerId = await createLayer(layerName);
  let count = 0;
  const read = (el: Element, tag: string) => el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
  const coordsOf = (nodes: HTMLCollectionOf<Element>): [number, number][] =>
    Array.from(nodes).map((n) => [Number(n.getAttribute('lon')), Number(n.getAttribute('lat'))]);

  for (const wpt of Array.from(doc.getElementsByTagName('wpt'))) {
    await saveFeature({
      layerId,
      kind: 'poi',
      name: read(wpt, 'name'),
      description: read(wpt, 'desc'),
      geometry: { type: 'Point', coordinates: [Number(wpt.getAttribute('lon')), Number(wpt.getAttribute('lat'))] },
      lineType: null,
      passability: null,
      icon: null,
      color: null,
      photo: null,
      source: 'import',
    });
    count++;
  }
  const tracks = [...Array.from(doc.getElementsByTagName('trk')), ...Array.from(doc.getElementsByTagName('rte'))];
  for (const trk of tracks) {
    const segs = Array.from(trk.children).filter((c) => c.tagName === 'trkseg');
    const lines: [number, number][][] = segs
      .map((s) => coordsOf(s.getElementsByTagName('trkpt')))
      .filter((l) => l.length >= 2);
    const direct = coordsOf(trk.getElementsByTagName('rtept'));
    if (direct.length >= 2) lines.push(direct);
    if (!lines.length) continue;
    const geometry: LineString | MultiLineString =
      lines.length === 1 ? { type: 'LineString', coordinates: lines[0] } : { type: 'MultiLineString', coordinates: lines };
    await saveFeature({
      layerId,
      kind: 'line',
      name: read(trk, 'name'),
      description: '',
      geometry,
      lineType: 'trail',
      passability: 'foot',
      icon: null,
      color: null,
      photo: null,
      source: 'import',
    });
    count++;
  }
  return count;
}

// ---------- Full backup (.zip) ----------

export async function buildBackup(): Promise<Uint8Array> {
  const { layers, features } = await allUser();
  const entries: ZipEntry[] = [];
  const enc = new TextEncoder();
  const featureRows = [];
  for (const f of features) {
    let photo: string | null = null;
    if (f.photo) {
      photo = `photos/${f.id}.jpg`;
      entries.push({ name: photo, data: new Uint8Array(await f.photo.arrayBuffer()) });
    }
    const { photo: _ignored, ...rest } = f;
    void _ignored;
    featureRows.push({ ...rest, photo });
  }
  entries.unshift(
    { name: 'manifest.json', data: enc.encode(JSON.stringify({ app: 'MeshMaps', version: BACKUP_VERSION, exportedAt: new Date().toISOString() })) },
    { name: 'layers.json', data: enc.encode(JSON.stringify(layers)) },
    { name: 'features.json', data: enc.encode(JSON.stringify(featureRows)) },
  );
  return zipStore(entries);
}

export function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `meshmaps-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

/** Restores a backup as NEW layers and features (ids are regenerated, nothing is overwritten). */
export async function restoreBackup(file: File): Promise<number> {
  const files = zipRead(await readBytes(file));
  const dec = new TextDecoder();
  const manifest = files.get('manifest.json');
  if (!manifest || JSON.parse(dec.decode(manifest)).app !== 'MeshMaps') throw new Error('Это не бэкап MeshMaps');
  const layers = JSON.parse(dec.decode(files.get('layers.json') ?? new Uint8Array())) as LayerRecord[];
  const feats = JSON.parse(dec.decode(files.get('features.json') ?? new Uint8Array())) as (Omit<FeatureRecord, 'photo'> & {
    photo: string | null;
  })[];

  const layerMap = new Map<string, string>();
  for (const l of layers) {
    const id = newId('L');
    layerMap.set(l.id, id);
    await db.layers.put({ ...l, id, createdAt: Date.now() });
  }
  let count = 0;
  for (const f of feats) {
    const photoBytes = f.photo ? files.get(f.photo) : undefined;
    const { photo: _p, id: _id, layerId, createdAt: _c, updatedAt: _u, ...rest } = f;
    void _p;
    void _id;
    void _c;
    void _u;
    await saveFeature({
      ...rest,
      layerId: layerMap.get(layerId) ?? layerId,
      photo: photoBytes ? new Blob([photoBytes as BlobPart], { type: 'image/jpeg' }) : null,
    });
    count++;
  }
  // Keep at least one layer visible even if the backup had none.
  if (layers.length === 0) await createLayer('Восстановлено');
  return count;
}

export async function saveGeoJSON(): Promise<void> {
  await saveFile('meshmaps.geojson', 'application/geo+json', await exportGeoJSON());
}

export async function saveGPX(): Promise<void> {
  await saveFile('meshmaps.gpx', 'application/gpx+xml', await exportGPX());
}

export async function saveBackup(): Promise<void> {
  await saveFile(backupFileName(), 'application/zip', await buildBackup());
}

