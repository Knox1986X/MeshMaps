import type { Map as MapLibreMap } from 'maplibre-gl'
import { GLYPHS } from './glyphs'

export interface IconSvgOptions {
  /** plate colour */
  color: string
  shape?: 'rounded' | 'circle' | 'square'
  /** 0..1 — how translucent the plate is */
  opacity?: number
  stroke?: string
  glyph?: string
}

const PLATE_PATH: Record<NonNullable<IconSvgOptions['shape']>, (color: string, opacity: number, stroke: string) => string> = {
  rounded: (c, o, s) =>
    `<rect x="2.5" y="2.5" width="43" height="43" rx="14" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".55" stroke-width="2"/>`,
  circle: (c, o, s) =>
    `<circle cx="24" cy="24" r="21.5" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".55" stroke-width="2"/>`,
  square: (c, o, s) =>
    `<rect x="3" y="3" width="42" height="42" rx="4" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".55" stroke-width="2"/>`,
}

/** Full 48×48 two-layer icon: plate + glyph. */
export function iconSvg(glyphKey: string, opts: IconSvgOptions): string {
  const glyph = opts.glyph ?? GLYPHS[glyphKey] ?? GLYPHS.dot
  const plate = PLATE_PATH[opts.shape ?? 'rounded'](opts.color, opts.opacity ?? 1, opts.stroke ?? '#ffffff')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
<defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
</linearGradient></defs>
${plate}
<rect x="2.5" y="2.5" width="43" height="43" rx="14" fill="url(#sh)"/>
<g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function iconDataUrl(glyphKey: string, color: string, shape: IconSvgOptions['shape'] = 'rounded'): string {
  return svgToDataUrl(iconSvg(glyphKey, { color, shape }))
}

export const mapIconId = (glyphKey: string, color: string) =>
  `mm-${glyphKey}-${color.replace('#', '')}`

const imageCache = new Map<string, Promise<HTMLImageElement>>()

function decodeSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('icon decode failed'))
    img.src = svgToDataUrl(svg)
  })
}

export function loadIcon(glyphKey: string, color: string): Promise<HTMLImageElement> {
  const id = mapIconId(glyphKey, color)
  let p = imageCache.get(id)
  if (!p) {
    p = decodeSvg(iconSvg(glyphKey, { color }))
    imageCache.set(id, p)
  }
  return p
}

/** Register every (glyph, color) pair that is present on the map. */
export async function ensureMapIcons(
  map: MapLibreMap,
  pairs: { glyph: string; color: string }[],
): Promise<void> {
  await Promise.all(
    pairs.map(async ({ glyph, color }) => {
      const id = mapIconId(glyph, color)
      if (map.hasImage(id)) return
      try {
        const img = await loadIcon(glyph, color)
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 })
      } catch {
        /* ignore broken custom glyphs */
      }
    }),
  )
}

export function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

export const customIconId = (objectId: string) => `mm-custom-${objectId}`

/** Registers uploaded SVG/PNG markers (idea 78). */
export async function ensureCustomIcons(
  map: MapLibreMap,
  items: { id: string; src: string }[],
): Promise<void> {
  await Promise.all(
    items.map(async ({ id, src }) => {
      const key = customIconId(id)
      if (map.hasImage(key)) return
      try {
        const img = await decodeImage(src)
        if (!map.hasImage(key)) map.addImage(key, img, { pixelRatio: 2 })
      } catch {
        /* ignore malformed uploads */
      }
    }),
  )
}

export { GLYPHS }

/** Inline React icon used by panels / lists / legend. */
export function MapIcon({
  glyph,
  color,
  size = 20,
  shape = 'rounded',
  className,
}: {
  glyph: string
  color: string
  size?: number
  shape?: IconSvgOptions['shape']
  className?: string
}) {
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}
      dangerouslySetInnerHTML={{
        __html: iconSvg(glyph, { color, shape }).replace(
          'width="48" height="48"',
          `width="${size}" height="${size}"`,
        ),
      }}
    />
  )
}
