/** Pure URL helpers for the `mmoffline://` protocol (testable without MapLibre). */
export interface OfflineUrl {
  kind: string
  rest: string
}

export function parseOfflineUrl(url: string): OfflineUrl | null {
  const m = /^mmoffline:\/\/([^/]+)\/(.+)$/.exec(url)
  if (!m) return null
  let rest = m[2]
  try {
    rest = decodeURIComponent(rest)
  } catch {
    /* keep raw */
  }
  return { kind: m[1], rest }
}

/** `mmoffline://omvt/15/19808/10306` → tile id, or null. */
export function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
  const parsed = parseOfflineUrl(url)
  if (!parsed || parsed.kind !== 'omvt') return null
  const parts = parsed.rest.replace(/\.pbf$/, '').split('/')
  if (parts.length !== 3) return null
  const [z, x, y] = parts.map(Number)
  if (![z, x, y].every((n) => Number.isFinite(n) && n >= 0)) return null
  return { z, x, y }
}

/** `mmoffline://font/Open Sans Semibold/1024-1279` → glyph range request. */
export function parseFontUrl(url: string): { stack: string; range: string } | null {
  const parsed = parseOfflineUrl(url)
  if (!parsed || parsed.kind !== 'font') return null
  const slash = parsed.rest.indexOf('/')
  if (slash < 0) return null
  return { stack: parsed.rest.slice(0, slash), range: parsed.rest.slice(slash + 1).replace(/\.pbf$/, '') }
}
