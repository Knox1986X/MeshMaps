import Dexie, { type Table } from 'dexie'
import type { MapObject, Snapshot } from '@/types'

export interface KV {
  key: string
  value: unknown
}

export interface TileRow {
  /** `<provider>/<z>/<x>/<y>` or `font/<fontstack>/<range>` */
  key: string
  /** offline pack id the tile belongs to */
  pack: string
  blob: Blob
  at: number
}

export interface PackRow {
  id: string
  label: string
  kind: 'city' | 'region' | 'custom'
  bbox: [number, number, number, number]
  minZoom: number
  maxZoom: number
  tiles: number
  bytes: number
  createdAt: number
}

export interface OsmCacheRow {
  key: string
  at: number
  payload: unknown
}

/**
 * Local-first storage. Everything the user draws is written straight to
 * IndexedDB, so a reload never loses data (acceptance #7, idea #29).
 */
class MeshMapsDB extends Dexie {
  objects!: Table<MapObject, string>
  snapshots!: Table<Snapshot, string>
  kv!: Table<KV, string>
  osmCache!: Table<OsmCacheRow, string>
  tiles!: Table<TileRow, string>
  packs!: Table<PackRow, string>

  constructor() {
    super('meshmaps')
    this.version(1).stores({
      objects: 'id, type, category, updatedAt, createdAt, pinned',
      snapshots: 'id, at',
      kv: 'key',
      osmCache: 'key, at',
    })
    // v2 — offline map packs (vector tiles + font ranges)
    this.version(2).stores({
      tiles: 'key, pack, at',
      packs: 'id, kind, createdAt',
    })
  }
}

export const db = new MeshMapsDB()

export async function saveObject(obj: MapObject) {
  await db.objects.put(obj)
}

export async function saveObjects(objs: MapObject[]) {
  if (!objs.length) return
  await db.objects.bulkPut(objs)
}

export async function deleteObjectById(id: string) {
  await db.objects.delete(id)
}

export async function loadObjects(): Promise<MapObject[]> {
  return db.objects.toArray()
}

/**
 * Writes only what actually changed (added/updated/removed since `prev`).
 * Rewriting the whole collection on every edit was a noticeable stall on phones.
 */
export async function syncObjectChanges(next: MapObject[], prev: MapObject[]) {
  const prevById = new Map(prev.map((o) => [o.id, o]))
  const nextIds = new Set(next.map((o) => o.id))
  const changed = next.filter((o) => prevById.get(o.id) !== o)
  const removed = prev.filter((o) => !nextIds.has(o.id)).map((o) => o.id)
  if (!changed.length && !removed.length) return
  await db.transaction('rw', db.objects, async () => {
    if (changed.length) await db.objects.bulkPut(changed)
    if (removed.length) await db.objects.bulkDelete(removed)
  })
}

/** Keeps the whole collection in sync with the store (cheap `bulkPut`). */
export async function replaceAll(objs: MapObject[]) {
  await db.transaction('rw', db.objects, async () => {
    const existing = await db.objects.toArray()
    const ids = new Set(objs.map((o) => o.id))
    const stale = existing.filter((o) => !ids.has(o.id)).map((o) => o.id)
    if (stale.length) await db.objects.bulkDelete(stale)
    await db.objects.bulkPut(objs)
  })
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return (row?.value as T) ?? fallback
}

export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value })
}

export async function addSnapshot(snap: Snapshot) {
  await db.snapshots.put(snap)
  const all = await db.snapshots.orderBy('at').toArray()
  if (all.length > 40) {
    await db.snapshots.bulkDelete(all.slice(0, all.length - 40).map((s) => s.id))
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('at').reverse().toArray()
}
