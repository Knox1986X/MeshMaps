import { liveQuery } from 'dexie';
import { db, type FeatureRecord, type LayerRecord } from './db';
import { LAYER_COLORS } from '../core/types';

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Returns the id of the first layer, creating «Мои объекты» on first run. */
export async function ensureDefaultLayer(): Promise<string> {
  const first = await db.layers.orderBy('order').first();
  if (first) return first.id;
  const id = newId('L');
  await db.layers.put({
    id,
    name: 'Мои объекты',
    color: LAYER_COLORS[0],
    visible: true,
    order: 0,
    createdAt: Date.now(),
  });
  return id;
}

export async function createLayer(name: string): Promise<string> {
  const last = await db.layers.orderBy('order').last();
  const id = newId('L');
  const rec: LayerRecord = {
    id,
    name: name.trim() || 'Новый слой',
    color: LAYER_COLORS[(await db.layers.count()) % LAYER_COLORS.length],
    visible: true,
    order: (last?.order ?? -1) + 1,
    createdAt: Date.now(),
  };
  await db.layers.put(rec);
  return id;
}

export async function updateLayer(id: string, patch: Partial<Omit<LayerRecord, 'id'>>): Promise<void> {
  await db.layers.update(id, patch);
}

/** Swaps order with the neighbour in the given direction. */
export async function moveLayer(id: string, dir: -1 | 1): Promise<void> {
  const all = await db.layers.orderBy('order').toArray();
  const i = all.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  const a = all[i];
  const b = all[j];
  await db.transaction('rw', db.layers, async () => {
    await db.layers.update(a.id, { order: b.order });
    await db.layers.update(b.id, { order: a.order });
  });
}

export async function deleteLayer(id: string): Promise<void> {
  await db.transaction('rw', db.layers, db.features, async () => {
    await db.features.where('layerId').equals(id).delete();
    await db.layers.delete(id);
  });
}

export async function saveFeature(
  rec: Omit<FeatureRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  const now = Date.now();
  const id = rec.id ?? newId('F');
  await db.features.put({ ...rec, id, createdAt: now, updatedAt: now });
  return id;
}

export async function getFeature(id: string): Promise<FeatureRecord | undefined> {
  return db.features.get(id);
}

export async function patchFeature(id: string, patch: Partial<Omit<FeatureRecord, 'id'>>): Promise<void> {
  await db.features.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteFeature(id: string): Promise<void> {
  await db.features.delete(id);
}

/** Subscribes to layers and features; the callback runs on every change (Dexie liveQuery). */
export function watchUserData(cb: (layers: LayerRecord[], features: FeatureRecord[]) => void): () => void {
  const sub = liveQuery(async () => {
    const [layers, features] = await Promise.all([db.layers.orderBy('order').toArray(), db.features.toArray()]);
    return { layers, features };
  }).subscribe({
    next: ({ layers, features }) => cb(layers, features),
    error: (err) => console.error('[MeshMaps] user data query failed', err),
  });
  return () => sub.unsubscribe();
}
