import maplibregl from 'maplibre-gl'
import { db } from '@/db/db'
import { fontKey, fontUrl, resolveTileTemplate, tileKey } from './storage'
import { parseFontUrl, parseTileUrl } from './url'

/**
 * `mmoffline://` resource protocol for MapLibre.
 *
 *   mmoffline://omvt/{z}/{x}/{y}          vector tiles (from an offline pack → network)
 *   mmoffline://font/{fontstack}/{range}  glyph ranges (same rule)
 *
 * Serving everything through the protocol means one and the same style works online and
 * offline: downloaded tiles come from IndexedDB, everything else goes to the network and
 * is simply skipped (empty response) when the device has no connection.
 */

const PROTOCOL = 'mmoffline'
const EMPTY = new ArrayBuffer(0)

let installed = false

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

async function readBlob(key: string): Promise<ArrayBuffer | null> {
  try {
    const row = await db.tiles.get(key)
    if (!row) return null
    return await row.blob.arrayBuffer()
  } catch {
    return null
  }
}

async function networkFetch(url: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  if (!online()) return null
  try {
    const res = await fetch(url, { mode: 'cors', signal })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export function installOfflineProtocol(): void {
  if (installed) return
  installed = true

  maplibregl.addProtocol(PROTOCOL, async (params, abortController) => {
    const signal = abortController?.signal ?? new AbortController().signal

    try {
      const tile = parseTileUrl(params.url)
      if (tile) {
        const cached = await readBlob(tileKey(tile.z, tile.x, tile.y))
        if (cached) return { data: cached }
        const template = await resolveTileTemplate()
        const url = template
          .replace('{z}', String(tile.z))
          .replace('{x}', String(tile.x))
          .replace('{y}', String(tile.y))
        const fetched = await networkFetch(url, signal)
        return { data: fetched ?? EMPTY }
      }

      const font = parseFontUrl(params.url)
      if (font) {
        const cached = await readBlob(fontKey(font.stack, font.range))
        if (cached) return { data: cached }
        const fetched = await networkFetch(fontUrl(font.stack, font.range), signal)
        return { data: fetched ?? EMPTY }
      }
    } catch {
      /* never break the map because of one tile */
    }
    return { data: EMPTY }
  })
}

