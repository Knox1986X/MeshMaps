import type { Feature, FeatureCollection, Geometry, LineString, Point, Polygon } from 'geojson'
import { featureCollection } from '@turf/helpers'
import type { Draft } from '@/store/useStore'
import type { MapObject } from '@/types'
import { createObject } from '@/store/useStore'
import { getCategory } from '@/icons/categories'

const POLY_KINDS = ['polygon', 'building', 'fence', 'measure-area']

export function draftFeatureCollection(draft: Draft | null): FeatureCollection {
  if (!draft) return featureCollection([])
  const coords = draft.hover ? [...draft.coords, draft.hover] : draft.coords
  const features: Feature<Geometry>[] = []

  if (draft.kind === 'point') {
    const p = draft.hover ?? draft.coords[0]
    if (p) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })
    return featureCollection(features)
  }

  const isPoly = POLY_KINDS.includes(draft.kind)
  const closed = isPoly && coords.length >= 3 ? [...coords, coords[0]] : coords

  if (closed.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: closed } as LineString,
    })
  }
  if (isPoly && closed.length >= 4) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [closed] } as Polygon,
    })
  }
  for (const c of draft.coords) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } as Point })
  }
  return featureCollection(features)
}

export interface DraftDefaults {
  category?: string
  color?: string
  icon?: string
  height?: number
  buildingLevels?: number
  fenceType?: MapObject['fenceType']
  fenceStyle?: MapObject['fenceStyle']
}

export function draftToObject(draft: Draft, defaults: DraftDefaults = {}): MapObject | null {
  const { coords, kind } = draft
  if (kind === 'point') return null
  if (kind === 'line' && coords.length < 2) return null
  if ((kind === 'polygon' || kind === 'building' || kind === 'fence') && coords.length < 3) return null

  let geometry: Geometry
  if (kind === 'line') {
    geometry = { type: 'LineString', coordinates: coords }
  } else {
    geometry = { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
  }

  const cat = getCategory(defaults.category ?? defaultCategory(kind))
  return createObject({
    type: (kind === 'line' ? 'line' : kind) as MapObject['type'],
    category: defaults.category ?? defaultCategory(kind),
    geometry,
    icon: defaults.icon ?? cat.icon,
    color: defaults.color ?? cat.color,
    height: kind === 'building' ? (defaults.height ?? 12) : kind === 'fence' ? (defaults.height ?? 2) : undefined,
    buildingLevels: kind === 'building' ? (defaults.buildingLevels ?? 3) : undefined,
    roofType: kind === 'building' ? 'flat' : undefined,
    fenceType: kind === 'fence' ? (defaults.fenceType ?? 'fence') : undefined,
    fenceStyle: kind === 'fence' ? (defaults.fenceStyle ?? 'mesh') : undefined,
    fenceOpacity: kind === 'fence' ? 0.92 : undefined,
    name: '',
    tags: [],
  })
}

function defaultCategory(kind: Draft['kind']): string {
  switch (kind) {
    case 'building':
      return 'building'
    case 'fence':
      return 'fence'
    case 'line':
      return 'trail'
    case 'polygon':
      return 'nature'
    default:
      return 'poi'
  }
}

/** Live preview collection for the measure tool. */
export function measureFeatureCollection(points: [number, number][], areaMode: boolean): FeatureCollection {
  const features: Feature<Geometry>[] = []
  if (points.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: areaMode && points.length >= 3 ? [...points, points[0]] : points,
      },
    })
  }
  if (areaMode && points.length >= 3) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
    })
  }
  for (const p of points) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })
  }
  return featureCollection(features)
}

export function routeFeatureCollection(
  waypoints: [number, number][],
  line?: [number, number][],
): FeatureCollection {
  const features: Feature<Geometry>[] = []
  const coords = line && line.length > 1 ? line : waypoints
  if (coords.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    })
  }
  for (const p of waypoints) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } })
  }
  return featureCollection(features)
}
