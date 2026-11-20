import type { MapViewState } from '@/types'

export interface ShareState {
  view: MapViewState
  mode: '2d' | '3d'
  theme: 'dark' | 'light'
  basemap: string
  selectedId?: string | null
}

/** Compact hash so the whole view can be restored from a link (idea 17). */
export function buildShareUrl(s: ShareState): string {
  const [lng, lat] = s.view.center
  const parts = [
    `v=${s.view.zoom.toFixed(2)}/${lat.toFixed(5)}/${lng.toFixed(5)}/${s.view.bearing.toFixed(0)}/${s.view.pitch.toFixed(0)}`,
    `m=${s.mode}`,
    `t=${s.theme}`,
    `b=${s.basemap}`,
  ]
  if (s.selectedId) parts.push(`sel=${s.selectedId}`)
  return `${location.origin}${location.pathname}#${parts.join('&')}`
}

export function parseShareHash(hash: string): {
  view?: Partial<MapViewState>
  mode?: '2d' | '3d'
  theme?: 'dark' | 'light'
  basemap?: string
  selectedId?: string
} {
  const out: ReturnType<typeof parseShareHash> = {}
  const raw = hash.replace(/^#/, '')
  if (!raw) return out
  const params = new URLSearchParams(raw)
  const v = params.get('v')
  if (v) {
    const [zoom, lat, lng, bearing, pitch] = v.split('/').map(Number)
    if ([zoom, lat, lng].every((n) => Number.isFinite(n))) {
      out.view = { zoom, center: [lng, lat], bearing: bearing || 0, pitch: pitch || 0 }
    }
  }
  const m = params.get('m')
  if (m === '2d' || m === '3d') out.mode = m
  const t = params.get('t')
  if (t === 'dark' || t === 'light') out.theme = t
  const b = params.get('b')
  if (b) out.basemap = b
  const sel = params.get('sel')
  if (sel) out.selectedId = sel
  return out
}
