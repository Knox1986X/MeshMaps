import Dexie, { type Table } from 'dexie'
import type { MapObject, Snapshot } from '@/types'

export interface KV {
  key: string
  value: unknown
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

  constructor() {
    super('meshmaps')
    this.version(1).stores({
      objects: 'id, type, category, updatedAt, createdAt, pinned',
      snapshots: 'id, at',
      kv: 'key',
      osmCache: 'key, at',
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
