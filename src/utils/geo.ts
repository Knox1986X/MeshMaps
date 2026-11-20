import area from '@turf/area'
import turfBbox from '@turf/bbox'
import buffer from '@turf/buffer'
import centerOfMass from '@turf/center-of-mass'
import union from '@turf/union'
import { featureCollection, multiPolygon, polygon } from '@turf/helpers'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon, Position } from 'geojson'
import type { FeatureProps, MapObject } from '@/types'
import { getCategory } from '@/icons/categories'
import { mapIconId } from '@/icons'

/* ------------------------------------------------------------------ */
/* basics                                                              */
/* ------------------------------------------------------------------ */

export const EARTH_R = 6378137

export function haversine(a: Position, b: Position): number {
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLon = (b[0] - a[0]) * toRad
  const lat1 = a[1] * toRad
  const lat2 = b[1] * toRad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearing(a: Position, b: Position): number {
  const toRad = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * toRad) * Math.cos(b[1] * toRad)
  const x =
    Math.cos(a[1] * toRad) * Math.sin(b[1] * toRad) -
    Math.sin(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.cos((b[0] - a[0]) * toRad)
  return (Math.atan2(y, x) * 180) / Math.PI
}

export function pathLength(coords: Position[]): number {
  let sum = 0
  for (let i = 1; i < coords.length; i++) sum += haversine(coords[i - 1], coords[i])
  return sum
}

export function ringArea(ring: Position[]): number {
  if (ring.length < 3) return 0
  // turf handles spherical excess properly
  return area(polygon([ring]))
}

export function geometryLength(g: Geometry): number {
  if (g.type === 'LineString') return pathLength(g.coordinates)
  if (g.type === 'MultiLineString') return g.coordinates.reduce((s, c) => s + pathLength(c), 0)
  if (g.type === 'Polygon') return pathLength(g.coordinates[0] ?? [])
  if (g.type === 'MultiPolygon')
    return g.coordinates.reduce((s, p) => s + pathLength(p[0] ?? []), 0)
  return 0
}

export function geometryArea(g: Geometry): number {
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    try {
      return area(g as Polygon | MultiPolygon)
    } catch {
      return 0
    }
  }
  return 0
}

export function geometryPoints(g: Geometry): Position[] {
  switch (g.type) {
    case 'Point':
      return [g.coordinates]
    case 'MultiPoint':
      return g.coordinates
    case 'LineString':
      return g.coordinates
    case 'MultiLineString':
      return g.coordinates.flat()
    case 'Polygon':
      return g.coordinates.flat()
    case 'MultiPolygon':
      return g.coordinates.flat(2)
    default:
      return []
  }
}

export function centroidOf(g: Geometry): [number, number] {
  try {
    const c = centerOfMass(g as any)
    return c.geometry.coordinates as [number, number]
  } catch {
    const pts = geometryPoints(g)
    if (!pts.length) return [0, 0]
    const sum = pts.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sum[0] / pts.length, sum[1] / pts.length]
  }
}

export function bboxOfObjects(objects: MapObject[]): [number, number, number, number] | null {
  const coords: number[][] = []
  for (const o of objects) for (const p of geometryPoints(o.geometry)) coords.push([p[0], p[1]])
  if (!coords.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of coords) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}

export function bboxCenter(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
}

/* ------------------------------------------------------------------ */
/* shapes                                                              */
/* ------------------------------------------------------------------ */

export function circlePolygon(center: Position, radiusM: number, steps = 72): Position[] {
  const ring: Position[] = []
  const latRad = (center[1] * Math.PI) / 180
  const dLat = radiusM / 111320
  const dLon = radiusM / (111320 * Math.max(0.05, Math.cos(latRad)))
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    ring.push([center[0] + dLon * Math.cos(t), center[1] + dLat * Math.sin(t)])
  }
  return ring
}

export function bufferOf(obj: MapObject): Feature<Polygon> | null {
  const r = obj.radius ?? 0
  if (!r || r <= 0) return null
  const c = centroidOf(obj.geometry)
  return polygon([circlePolygon(c, r)])
}

/* ------------------------------------------------------------------ */
/* fences (3D panels)                                                  */
/* ------------------------------------------------------------------ */

interface PanelOpts {
  height: number
  thickness: number
  pitch: number
  panelLength: number
}

const FENCE_PRESETS: Record<string, PanelOpts> = {
  // pitch = distance between panel starts, panelLength = solid part
  picket: { height: 0, thickness: 0.28, pitch: 1.6, panelLength: 1.1 },
  mesh: { height: 0, thickness: 0.12, pitch: 1, panelLength: 1 },
  barbed: { height: 0, thickness: 0.18, pitch: 2.2, panelLength: 1.6 },
  concrete: { height: 0, thickness: 0.45, pitch: 1, panelLength: 1 },
  hedge: { height: 0, thickness: 1.1, pitch: 1, panelLength: 1 },
}

function quadAround(a: Position, b: Position, thickness: number): Position[] {
  const latRad = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  const mx = (b[0] - a[0]) * Math.cos(latRad) * 111320
  const my = (b[1] - a[1]) * 111320
  const len = Math.hypot(mx, my) || 1
  const px = -my / len
  const py = mx / len
  const halfT = thickness / 2
  const dLon = (px * halfT) / (111320 * Math.max(0.05, Math.cos(latRad)))
  const dLat = (py * halfT) / 111320
  return [
    [a[0] + dLon, a[1] + dLat],
    [b[0] + dLon, b[1] + dLat],
    [b[0] - dLon, b[1] - dLat],
    [a[0] - dLon, a[1] - dLat],
    [a[0] + dLon, a[1] + dLat],
  ]
}

function interpolate(a: Position, b: Position, t: number): Position {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Builds real 3D fence panels along the polygon perimeter. */
export function fencePanels(obj: MapObject): FeatureCollection<Polygon, FeatureProps> {
  const ring =
    obj.geometry.type === 'Polygon'
      ? obj.geometry.coordinates[0]
      : obj.geometry.type === 'MultiPolygon'
        ? obj.geometry.coordinates[0][0]
        : []
  const features: Feature<Polygon, FeatureProps>[] = []
  if (!ring || ring.length < 2) return featureCollection(features)

  const style = obj.fenceStyle ?? 'mesh'
  const preset = FENCE_PRESETS[style] ?? FENCE_PRESETS.mesh
  const height = Math.max(0.4, obj.height ?? 2)
  const color = obj.color ?? '#a855f7'
  const opacity = obj.fenceOpacity ?? 0.95

  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    const segLen = haversine(a, b)
    if (segLen < 0.4) continue
    const repeats = Math.max(1, Math.floor(segLen / preset.pitch))
    for (let k = 0; k < repeats; k++) {
      const t0 = (k * preset.pitch) / segLen
      const t1 = Math.min(1, (k * preset.pitch + preset.panelLength) / segLen)
      if (t1 <= t0) continue
      const p0 = interpolate(a, b, t0)
      const p1 = interpolate(a, b, t1)
      features.push({
        type: 'Feature',
        properties: {
          height,
          color,
          opacity,
          style,
          objectId: obj.id,
          base: 0,
        },
        geometry: { type: 'Polygon', coordinates: [quadAround(p0, p1, preset.thickness)] },
      })
    }
  }
  return featureCollection(features)
}

/* ------------------------------------------------------------------ */
/* conversion                                                          */
/* ------------------------------------------------------------------ */

export interface RenderOptions {
  year?: number | null
  selectedId?: string | null
  hoverId?: string | null
}

/** Converts the store objects to the collection the map layers consume. */
export function objectsToFeatures(objects: MapObject[], opts: RenderOptions = {}): {
  points: FeatureCollection<Point, FeatureProps>
  lines: FeatureCollection<Geometry, FeatureProps>
  polygons: FeatureCollection<Polygon | MultiPolygon, FeatureProps>
  buildings: FeatureCollection<Polygon | MultiPolygon, FeatureProps>
  labels: FeatureCollection<Point, FeatureProps>
  buffers: FeatureCollection<Polygon, FeatureProps>
} {
  const points: Feature<Point, FeatureProps>[] = []
  const lines: Feature<Geometry, FeatureProps>[] = []
  const polygons: Feature<Polygon | MultiPolygon, FeatureProps>[] = []
  const buildings: Feature<Polygon | MultiPolygon, FeatureProps>[] = []
  const labels: Feature<Point, FeatureProps>[] = []
  const buffers: Feature<Polygon, FeatureProps>[] = []

  for (const obj of objects) {
    if (opts.year != null) {
      const from = obj.yearFrom ?? 0
      const to = obj.yearTo ?? 9999
      if (opts.year < from || opts.year > to) continue
    }
    const cat = getCategory(obj.category)
    const base: FeatureProps = {
      id: obj.id,
      objectId: obj.id,
      name: obj.name || cat.labelRu,
      category: obj.category,
      kind: obj.type,
      color: obj.color,
      icon: obj.icon || cat.icon,
      glyph: obj.icon || cat.icon,
      iconKey: mapIconId(obj.icon || cat.icon, obj.color),
      dashed:
        obj.properties?.['покрытие'] === 'грунт' ||
        obj.properties?.['стиль'] === 'dashed' ||
        obj.category === 'trail' ||
        obj.category === 'powerline',
      width: Number(obj.properties?.['ширина'] ?? 0) || 0,
      selected: opts.selectedId === obj.id,
      hover: opts.hoverId === obj.id,
      pinned: obj.pinned ? 1 : 0,
      height: obj.height ?? 0,
      opacity: obj.fenceOpacity ?? 0.9,
      fenceType: obj.fenceType ?? 'none',
      tags: (obj.tags ?? []).join(','),
      yearFrom: obj.yearFrom ?? null,
    }

    const buf = bufferOf(obj)
    if (buf) buffers.push({ ...buf, properties: { ...base } })

    if (obj.geometry.type === 'Point') {
      points.push({
        type: 'Feature',
        properties: base,
        geometry: obj.geometry,
      })
      if (obj.name) labels.push({ type: 'Feature', properties: base, geometry: obj.geometry })
    } else if (obj.geometry.type === 'LineString' || obj.geometry.type === 'MultiLineString') {
      lines.push({ type: 'Feature', properties: base, geometry: obj.geometry })
      labels.push({
        type: 'Feature',
        properties: base,
        geometry: { type: 'Point', coordinates: midpointOf(obj.geometry) },
      })
    } else if (obj.geometry.type === 'Polygon' || obj.geometry.type === 'MultiPolygon') {
      if (obj.type === 'building') buildings.push({ type: 'Feature', properties: base, geometry: obj.geometry })
      else polygons.push({ type: 'Feature', properties: base, geometry: obj.geometry as Polygon | MultiPolygon })
      if (obj.name) {
        labels.push({
          type: 'Feature',
          properties: base,
          geometry: { type: 'Point', coordinates: centroidOf(obj.geometry) },
        })
      }
    }
  }

  return {
    points: featureCollection(points),
    lines: featureCollection(lines),
    polygons: featureCollection(polygons),
    buildings: featureCollection(buildings),
    labels: featureCollection(labels),
    buffers: featureCollection(buffers),
  }
}

export function midpointOf(g: Geometry): [number, number] {
  const pts = geometryPoints(g)
  if (!pts.length) return [0, 0]
  if (pts.length === 1) return [pts[0][0], pts[0][1]]
  const idx = Math.floor(pts.length / 2)
  return [pts[idx][0], pts[idx][1]]
}

/* ------------------------------------------------------------------ */
/* import / export                                                     */
/* ------------------------------------------------------------------ */

export function objectsToGeoJSON(objects: MapObject[]): FeatureCollection<Geometry, FeatureProps> {
  return featureCollection(
    objects.map<Feature<Geometry, FeatureProps>>((o) => ({
      type: 'Feature',
      geometry: o.geometry,
      properties: {
        id: o.id,
        type: o.type,
        category: o.category,
        name: o.name,
        description: o.description,
        icon: o.icon,
        color: o.color,
        tags: o.tags,
        attachments: o.attachments,
        height: o.height,
        buildingLevels: o.buildingLevels,
        roofType: o.roofType,
        roofColor: o.roofColor,
        wallColor: o.wallColor,
        fenceType: o.fenceType,
        fenceStyle: o.fenceStyle,
        fenceOpacity: o.fenceOpacity,
        radius: o.radius,
        rating: o.rating,
        pinned: o.pinned,
        yearFrom: o.yearFrom,
        yearTo: o.yearTo,
        schedule: o.schedule,
        comments: o.comments,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        author: o.author,
        ...o.properties,
        customProperties: o.properties,
      },
    })),
  )
}

export function featureKind(f: Feature): MapObject['type'] {
  const g = f.geometry
  if (g.type === 'Point' || g.type === 'MultiPoint') return 'point'
  if (g.type === 'LineString' || g.type === 'MultiLineString')
    return f.properties?.['building'] ? 'building' : 'line'
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    if (f.properties?.['fenceType']) return 'fence'
    if (f.properties?.['building'] || f.properties?.['height']) return 'building'
    return 'polygon'
  }
  return 'point'
}

export function gpxFromObjects(objects: MapObject[]): string {
  const esc = (s: string) =>
    s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string)
  const wpts = objects
    .filter((o) => o.geometry.type === 'Point')
    .map((o) => {
      const [lon, lat] = (o.geometry as unknown as Point).coordinates
      return `  <wpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><name>${esc(o.name || 'POI')}</name><desc>${esc(o.description || '')}</desc></wpt>`
    })
    .join('\n')
  const trks = objects
    .filter((o) => o.geometry.type === 'LineString' || o.geometry.type === 'MultiLineString')
    .map((o) => {
      const g = o.geometry as unknown as { type: string; coordinates: Position[] | Position[][] }
      const coords: Position[] = g.type === 'LineString' ? (g.coordinates as Position[]) : (g.coordinates as Position[][]).flat()
      return `  <trk><name>${esc(o.name || 'Track')}</name><trkseg>${coords
        .map((c) => `<trkpt lat="${c[1].toFixed(7)}" lon="${c[0].toFixed(7)}"/>`)
        .join('')}</trkseg></trk>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MeshMaps" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n${trks}\n</gpx>`
}

export function parseGpx(xml: string): { name: string; geometry: Geometry }[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const out: { name: string; geometry: Geometry }[] = []
  doc.querySelectorAll('wpt').forEach((w) => {
    const lat = parseFloat(w.getAttribute('lat') ?? '')
    const lon = parseFloat(w.getAttribute('lon') ?? '')
    if (Number.isFinite(lat) && Number.isFinite(lon))
      out.push({
        name: w.querySelector('name')?.textContent ?? 'GPX point',
        geometry: { type: 'Point', coordinates: [lon, lat] },
      })
  })
  doc.querySelectorAll('trkseg, rte').forEach((seg) => {
    const coords: Position[] = []
    seg.querySelectorAll('trkpt, rtept').forEach((p) => {
      const lat = parseFloat(p.getAttribute('lat') ?? '')
      const lon = parseFloat(p.getAttribute('lon') ?? '')
      if (Number.isFinite(lat) && Number.isFinite(lon)) coords.push([lon, lat])
    })
    if (coords.length > 1)
      out.push({
        name: seg.closest('trk,rte')?.querySelector('name')?.textContent ?? 'GPX track',
        geometry: { type: 'LineString', coordinates: coords },
      })
  })
  return out
}

/* ------------------------------------------------------------------ */
/* geometry ops (idea 76)                                              */
/* ------------------------------------------------------------------ */

export function bufferGeometry(g: Geometry, meters: number): Geometry | null {
  try {
    const b: any = buffer(g as any, meters / 1000, { units: 'kilometers', steps: 8 })
    return (b?.geometry as Geometry) ?? null
  } catch {
    return null
  }
}

export function unionGeometries(gs: Geometry[]): Geometry | null {
  const polys = gs.filter((g) => g.type === 'Polygon' || g.type === 'MultiPolygon')
  if (!polys.length) return null
  try {
    let acc: any = polys[0]
    for (let i = 1; i < polys.length; i++) {
      const res = union(featureCollection([acc as any, polys[i] as any]) as any)
      acc = res?.geometry ?? acc
    }
    return acc as Geometry
  } catch {
    return null
  }
}

export function turfBboxOf(g: Geometry): [number, number, number, number] | null {
  try {
    return turfBbox(g as any) as [number, number, number, number]
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* grid (idea 42)                                                      */
/* ------------------------------------------------------------------ */

export function gridLines(bounds: [number, number, number, number], stepDeg: number) {
  const features: Feature<Geometry, FeatureProps>[] = []
  const [w, s, e, n] = bounds
  const startLon = Math.floor(w / stepDeg) * stepDeg
  const startLat = Math.floor(s / stepDeg) * stepDeg
  for (let lon = startLon; lon <= e + stepDeg; lon += stepDeg) {
    features.push({
      type: 'Feature',
      properties: { kind: 'lon', label: `${lon.toFixed(2)}°` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, s],
          [lon, n],
        ],
      },
    })
  }
  for (let lat = startLat; lat <= n + stepDeg; lat += stepDeg) {
    features.push({
      type: 'Feature',
      properties: { kind: 'lat', label: `${lat.toFixed(2)}°` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [w, lat],
          [e, lat],
        ],
      },
    })
  }
  return featureCollection(features)
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (m < 1) return `${(m * 100).toFixed(0)} см`
  if (m < 1000) return `${m.toFixed(m < 20 ? 2 : 0)} м`
  return `${(m / 1000).toFixed(2)} км`
}

export function formatArea(m2: number): string {
  if (!Number.isFinite(m2)) return '—'
  if (m2 < 100) return `${m2.toFixed(1)} м²`
  if (m2 < 100_000) return `${m2.toFixed(0)} м² · ${(m2 / 10_000).toFixed(2)} га`
  return `${(m2 / 1_000_000).toFixed(2)} км²`
}

export function formatCoords(lng: number, lat: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function formatDms(lng: number, lat: number): string {
  const fmt = (v: number, pos: string, neg: string) => {
    const dir = v >= 0 ? pos : neg
    const abs = Math.abs(v)
    const d = Math.floor(abs)
    const m = Math.floor((abs - d) * 60)
    const s = (((abs - d) * 60 - m) * 60).toFixed(1)
    return `${d}°${m}'${s}"${dir}`
  }
  return `${fmt(lat, 'N', 'S')} ${fmt(lng, 'E', 'W')}`
}

export function parseCoordinateInput(input: string): [number, number] | null {
  const cleaned = input.trim().replace(/[()]/g, '')
  const m = cleaned.match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const a = parseFloat(m[1].replace(',', '.'))
  const b = parseFloat(m[2].replace(',', '.'))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  // heuristics: lat first if |a| <= 90
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [b, a]
  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [a, b]
  return null
}

export function compassLabel(deg: number): string {
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']
  return dirs[Math.round(((deg % 360) / 45)) % 8]
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/* ------------------------------------------------------------------ */
/* sun position (idea 38)                                              */
/* ------------------------------------------------------------------ */

export function sunPosition(date: Date, lat: number, lon: number): { azimuth: number; altitude: number } {
  const rad = Math.PI / 180
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hours - 12) / 24)
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const timeOffset = eqTime + 4 * lon - 60 * date.getTimezoneOffset() * -1
  const trueSolarTime = ((hours * 60 + timeOffset) % 1440 + 1440) % 1440
  const hourAngle = (trueSolarTime / 4 - 180) * rad
  const latRad = lat * rad
  const cosZenith =
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  const altitude = 90 - Math.acos(clamp(cosZenith, -1, 1)) / rad
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(decl) * Math.cos(latRad),
    ) /
      rad +
      180) %
    360
  return { azimuth, altitude }
}
