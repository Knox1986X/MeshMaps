import type { BaseMapId } from '@/types'
import { isVectorBasemap, sampleTileUrl } from './styles'
import { VECTOR_TILEJSON } from './vectorStyle'

/**
 * Basemap health check. Providers die, get rate-limited or start demanding API keys
 * (that is how the Android build ended up with a grey "API KEY REQUIRED" wall instead of a map).
 * We ping the provider once and fall back to plain OSM tiles if it does not answer,
 * so a fresh install always shows a map.
 */
const probed = new Map<BaseMapId, Promise<boolean>>()
const TIMEOUT = 7000

function probeRaster(url: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const img = new Image()
    const done = (ok: boolean) => {
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(ok)
    }
    const timer = window.setTimeout(() => done(false), TIMEOUT)
    img.onload = () => done(true)
    img.onerror = () => done(false)
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.src = url
  })
}

function probeVector(): Promise<boolean> {
  if (typeof fetch !== 'function') return Promise.resolve(true)
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = window.setTimeout(() => controller?.abort(), TIMEOUT)
  return fetch(VECTOR_TILEJSON, { mode: 'cors', signal: controller?.signal })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => window.clearTimeout(timer))
}

export function isBasemapReachable(id: BaseMapId, center: [number, number], zoom: number): Promise<boolean> {
  const cached = probed.get(id)
  if (cached) return cached

  let check: Promise<boolean>
  if (isVectorBasemap(id)) {
    check = probeVector()
  } else {
    const url = sampleTileUrl(id, center, zoom)
    check = url ? probeRaster(url) : Promise.resolve(true)
  }
  probed.set(id, check)
  return check
}

/** Forgets cached probe results (used by tests). */
export function resetBasemapProbe(): void {
  probed.clear()
}
