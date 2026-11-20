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
    `<rect x="1.5" y="1.5" width="45" height="45" rx="13.5" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".28" stroke-width="1"/>`,
  circle: (c, o, s) =>
    `<circle cx="24" cy="24" r="22.5" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".28" stroke-width="1"/>`,
  square: (c, o, s) =>
    `<rect x="1.5" y="1.5" width="45" height="45" rx="6" fill="${c}" fill-opacity="${o}" stroke="${s}" stroke-opacity=".28" stroke-width="1"/>`,
}

/**
 * Wireframe hexagon from the reference sheet («Иконки для карт», page 09):
 * a double pointy-top hexagon with a thin three-edge "prism" inside, glyph on top.
 */
function hexFrame(hw: number, hh: number): string {
  return `M24 ${24 - hh}L${24 + hw} ${24 - hh / 2}V${24 + hh / 2}L24 ${24 + hh}L${24 - hw} ${24 + hh / 2}V${24 - hh / 2}Z`
}

const HEX_OUTER = hexFrame(15.4, 18.3)
const HEX_INNER = hexFrame(13.1, 15.6)
/** prism edges: two upper corners → centre + centre → bottom vertex */
const HEX_EDGES = 'M10.9 16.2 24 24M37.1 16.2 24 24M24 24V42.3'

/** Full 48×48 icon: plate + hexagonal keyline + glyph (glyph is haloed so lines don't cut through). */
export function iconSvg(glyphKey: string, opts: IconSvgOptions): string {
  const glyph = opts.glyph ?? GLYPHS[glyphKey] ?? GLYPHS.dot
  const shape = opts.shape ?? 'rounded'
  const color = opts.color
  const opacity = opts.opacity ?? 1
  const plate = PLATE_PATH[shape](color, opacity, opts.stroke ?? '#ffffff')
  const frame =
    shape === 'circle'
      ? `<circle cx="24" cy="24" r="17.6" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
<circle cx="24" cy="24" r="14.2" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>`
      : `<g fill="none" stroke="#fff" stroke-linejoin="round" stroke-linecap="round">
<path d="${HEX_OUTER}" stroke-opacity=".92" stroke-width="1.2"/>
<path d="${HEX_INNER}" stroke-opacity=".5" stroke-width="1"/>
<path d="${HEX_EDGES}" stroke-opacity=".38" stroke-width=".9"/>
</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
${plate}
${frame}
<g transform="translate(12.6 12.4) scale(.91)" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
<g transform="translate(12.6 12.4) scale(.91)" fill="none" stroke="#fff" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
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
