import type { ExpressionSpecification, FilterSpecification, LightSpecification } from 'maplibre-gl'

/**
 * Realistic rendering helpers for the keyless vector basemap.
 *
 * The point of this module: make 3D buildings look like the real city — metric heights taken
 * from OpenStreetMap (`render_height` / `render_min_height` arrive already computed by
 * OpenMapTiles from `height` and `building:levels`), one sun shared by facades and ground
 * shadows, and a human readable "≈ N этажей" label for a tapped building.
 */

/** Average storey height in a residential block (OSM level model uses the same figure). */
export const METERS_PER_FLOOR = 3.15
/** Height used when OSM has no data at all — one low storey, not a skyscraper. */
export const DEFAULT_BUILDING_HEIGHT = 6

/** Extrusion height in **meters**: real OSM height first, then the raw `height` tag. */
export function buildingHeightExpr(): ExpressionSpecification {
  return ['coalesce', ['get', 'render_height'], ['get', 'height'], DEFAULT_BUILDING_HEIGHT]
}

/** Extrusion base in meters — buildings that start above the ground (bridges, overhangs). */
export function buildingBaseExpr(): ExpressionSpecification {
  return ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
}

/** OpenMapTiles marks indoor parts with `hide_3d`; extruding those produces ghost volumes. */
export const BUILDING_3D_FILTER: FilterSpecification = ['!=', ['get', 'hide_3d'], true]

export interface BuildingInfo {
  /** meters above the street */
  height: number
  /** estimated storeys (rounded, at least 1) */
  floors: number
  /** ready-to-show Russian text */
  label: string
}

const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export interface BuildingInfoOptions {
  /** pass false when the caller only wants a fallback description */
  height?: number | null
  /** explicit `building:levels`, when the tile carries it */
  levels?: number | null
}

/**
 * Turns feature properties into "высота + этажи".
 * `render_height` already folds `height`/`building:levels` together, but we accept the raw
 * tags as a fallback so the label stays honest when a tile editor drops them.
 */
export function infoForBuilding(
  props: Record<string, unknown> | null | undefined,
  opts: BuildingInfoOptions = {},
): BuildingInfo | null {
  const p = props ?? {}
  const explicitLevels = opts.levels ?? asNumber(p['building:levels']) ?? asNumber(p.levels)

  let height =
    opts.height ??
    asNumber(p.render_height) ??
    asNumber(p.height) ??
    (explicitLevels != null ? explicitLevels * METERS_PER_FLOOR : null)

  if (height == null || height <= 0) height = null
  const floors =
    explicitLevels != null && explicitLevels > 0
      ? Math.max(1, Math.round(explicitLevels))
      : height != null
        ? Math.max(1, Math.round(height / METERS_PER_FLOOR))
        : 1

  if (height == null && explicitLevels == null) return null

  const h = height ?? floors * METERS_PER_FLOOR
  const label = `≈ ${floors} ${pluralFloors(floors)} · ${formatMeters(h)}`
  return { height: h, floors, label }
}

export function pluralFloors(n: number): string {
  const mod10 = Math.abs(n) % 10
  const mod100 = Math.abs(n) % 100
  if (mod10 === 1 && mod100 !== 11) return 'этаж'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'этажа'
  return 'этажей'
}

export function formatMeters(h: number): string {
  const v = h >= 10 ? Math.round(h) : Math.round(h * 10) / 10
  return `${v} м`
}

/** Human summary for a tapped building, e.g. "9 этажей · 28 м". */
export function describeBuilding(props: Record<string, unknown> | null | undefined): string | null {
  const info = infoForBuilding(props)
  if (!info) return null
  const name = (props?.name as string | undefined) || (props?.['name:ru'] as string | undefined)
  return name ? `${name} · ${info.label}` : `Дом · ${info.label}`
}

/**
 * One sun for the whole scene: MapLibre shades extruded faces by `light`, and our flat
 * shadow layers already use `sunPosition()`. Keeping both in sync is what makes the city
 * look lit from a single direction instead of "glowing from everywhere".
 *
 * `position` = [radial, azimuth (0..360, 0 = north), polar (0 = overhead, 90 = horizon)].
 */
export function lightFor(
  azimuth: number,
  altitude: number,
  theme: 'dark' | 'light',
  enabled = true,
): LightSpecification {
  if (!enabled) {
    return { anchor: 'viewport', color: '#ffffff', intensity: 0.1, position: [1.15, 210, 30] }
  }
  const polar = Math.max(12, Math.min(86, 90 - altitude))
  const night = altitude <= 2
  return {
    anchor: 'map',
    color: night ? (theme === 'dark' ? '#9db4e0' : '#c8d4ee') : theme === 'dark' ? '#cfe0ff' : '#fff4e2',
    intensity: night ? 0.28 : theme === 'dark' ? 0.52 : 0.58,
    position: [1.35, ((azimuth % 360) + 360) % 360, polar],
  }
}

/** Fallback sun used before the first `sunPosition()` call (afternoon, south-west). */
export const DEFAULT_SUN = { azimuth: 225, altitude: 42 }
