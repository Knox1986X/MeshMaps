import { db, type PackRow } from '@/db/db'
import { AVG_TILE_BYTES, formatBytes, tilesForBBox, type PackDef } from './catalog'

/** OpenFreeMap serves tiles through a versioned path that changes with each planet rebuild. */
export const TILEJSON_URL = 'https://tiles.openfreemap.org/planet'
export const GLYPHS_TEMPLATE = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
/** Latin basic, Latin-1, Cyrillic, Cyrillic supplement, general punctuation. */
export const GLYPH_RANGES = ['0-255', '256-511', '1024-1279', '1280-1535', '8192-8447']
export const FONT_STACKS = ['Open Sans Semibold']

export interface PackProgress {
  done: number
  total: number
  bytes: number
}

let tileTemplate: string | null = null
let templatePromise: Promise<string> | null = null

/** Resolves the current versioned tile template (cached in memory + IndexedDB). */
export async function resolveTileTemplate(): Promise<string> {
  if (tileTemplate) return tileTemplate
  if (templatePromise) return templatePromise
  templatePromise = (async () => {
    try {
      const cached = await db.kv.get('omvt-template')
      if (cached && typeof cached.value === 'string') {
        tileTemplate = cached.value
        return tileTemplate
      }
    } catch {
      /* ignore */
    }
    const res = await fetch(TILEJSON_URL, { mode: 'cors' })
    if (!res.ok) throw new Error('tilejson')
    const json = (await res.json()) as { tiles?: string[] }
    const template = json.tiles?.[0]
    if (!template) throw new Error('tilejson: no tiles')
    tileTemplate = template
    void db.kv.put({ key: 'omvt-template', value: template }).catch(() => undefined)
    return template
  })().finally(() => {
    templatePromise = null
  })
  return templatePromise
}

export function tileKey(z: number, x: number, y: number): string {
  return `omvt/${z}/${x}/${y}`
}

export function fontKey(fontstack: string, range: string): string {
  return `font/${fontstack}/${range}`
}

export const fontUrl = (fontstack: string, range: string) =>
  GLYPHS_TEMPLATE.replace('{fontstack}', fontstack).replace('{range}', range)

/* ------------------------------------------------------------------ */
/* packs                                                               */
/* ------------------------------------------------------------------ */

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

async function fetchTile(url: string, signal: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors', signal })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

export async function listPacks(): Promise<PackRow[]> {
  try {
    return await db.packs.orderBy('createdAt').toArray()
  } catch {
    return []
  }
}

export async function getPack(id: string): Promise<PackRow | undefined> {
  try {
    return await db.packs.get(id)
  } catch {
    return undefined
  }
}

/**
 * Downloads a pack into IndexedDB. Tiles already present are skipped, so an interrupted
 * download can simply be resumed.
 */
export async function downloadPack(
  def: PackDef,
  onProgress: (p: PackProgress) => void,
  signal: AbortSignal,
): Promise<PackRow> {
  if (!online()) throw new Error('Нет соединения — офлайн-набор нельзя скачать')
  const template = await resolveTileTemplate()
  const tiles = tilesForBBox(def.bbox, def.minZoom, def.maxZoom)
  const total = tiles.length
  onProgress({ done: 0, total, bytes: 0 })

  const existing = new Set<string>()
  try {
    const keys = (await db.tiles.where('pack').equals(def.id).primaryKeys()) as string[]
    for (const k of keys) existing.add(k)
  } catch {
    /* fresh install */
  }

  let done = existing.size
  let bytes = done * AVG_TILE_BYTES
  let cursor = 0
  let failed = 0
  let lastReport = 0

  const report = (force = false) => {
    const now = performance.now()
    if (!force && now - lastReport < 120) return
    lastReport = now
    onProgress({ done, total, bytes })
  }

  const worker = async () => {
    while (cursor < tiles.length) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError')
      const t = tiles[cursor++]
      const key = tileKey(t.z, t.x, t.y)
      if (existing.has(key)) continue
      const url = template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))
      const blob = await fetchTile(url, signal)
      if (blob) {
        await db.tiles.put({ key, pack: def.id, blob, at: Date.now() })
        bytes += blob.size
      } else {
        failed += 1
        bytes += AVG_TILE_BYTES / 4
      }
      done += 1
      report()
    }
  }

  const CONCURRENCY = 4
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // fonts as well — otherwise every label turns into a blank box offline
  for (const stack of FONT_STACKS) {
    for (const range of GLYPH_RANGES) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError')
      const key = fontKey(stack, range)
      const has = await db.tiles.get(key)
      if (has) continue
      const blob = await fetchTile(fontUrl(stack, range), signal)
      if (blob) await db.tiles.put({ key, pack: def.id, blob, at: Date.now() })
    }
  }

  report(true)

  const row: PackRow = {
    id: def.id,
    label: def.label,
    kind: def.kind,
    bbox: def.bbox,
    minZoom: def.minZoom,
    maxZoom: def.maxZoom,
    tiles: Math.max(0, done - failed * 0),
    bytes,
    createdAt: Date.now(),
  }
  await db.packs.put(row)
  return row
}

export async function deletePack(id: string): Promise<void> {
  try {
    await db.tiles.where('pack').equals(id).delete()
    await db.packs.delete(id)
  } catch {
    /* ignore */
  }
}

/** Does any pack cover this coordinate at the given zoom? Used by the offline badge. */
export async function packForPoint(lon: number, lat: number, zoom: number): Promise<PackRow | undefined> {
  const packs = await listPacks()
  return packs.find(
    (p) =>
      zoom >= p.minZoom - 0.5 &&
      lon >= p.bbox[0] &&
      lon <= p.bbox[2] &&
      lat >= p.bbox[1] &&
      lat <= p.bbox[3],
  )
}

export async function storageUsage(): Promise<{ used: number; quota: number }> {
  try {
    const est = await navigator.storage?.estimate?.()
    return { used: est?.usage ?? 0, quota: est?.quota ?? 0 }
  } catch {
    return { used: 0, quota: 0 }
  }
}

export function describePack(row: PackRow): string {
  return `${formatBytes(row.bytes)} · ${row.tiles} тайлов · z${row.minZoom}–${row.maxZoom}`
}
