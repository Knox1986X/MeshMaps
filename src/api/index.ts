import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { FeatureProps, MapObject, RouteResult, SearchResult } from '@/types'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSRM = 'https://router.project-osrm.org'
const OVERPASS = 'https://overpass-api.de/api/interpreter'

async function jsonFetch<T>(url: string, init?: RequestInit, timeout = 18000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* Nominatim                                                           */
/* ------------------------------------------------------------------ */

interface NominatimItem {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
  type?: string
  class?: string
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!query.trim()) return []
  const url = `${NOMINATIM}/search?format=jsonv2&limit=8&accept-language=ru,en&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Nominatim error')
  const data = (await res.json()) as NominatimItem[]
  return data.map((d) => ({
    id: String(d.place_id),
    label: d.display_name,
    center: [parseFloat(d.lon), parseFloat(d.lat)],
    bbox: d.boundingbox
      ? [
          parseFloat(d.boundingbox[2]),
          parseFloat(d.boundingbox[0]),
          parseFloat(d.boundingbox[3]),
          parseFloat(d.boundingbox[1]),
        ]
      : undefined,
    type: d.type,
  }))
}

export async function reverseGeocode(lng: number, lat: number): Promise<string> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&accept-language=ru&lat=${lat}&lon=${lng}`
  try {
    const data = await jsonFetch<{ display_name?: string }>(url, undefined, 12000)
    return data.display_name ?? ''
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/* OSRM routing                                                        */
/* ------------------------------------------------------------------ */

const OSRM_PROFILE: Record<string, string> = {
  driving: 'driving',
  walking: 'foot',
  cycling: 'bike',
}

export async function fetchRoute(
  points: [number, number][],
  profile: 'driving' | 'walking' | 'cycling',
): Promise<RouteResult> {
  if (points.length < 2) throw new Error('Нужно минимум 2 точки')
  const coords = points.map((p) => `${p[0]},${p[1]}`).join(';')
  const url = `${OSRM}/route/v1/${OSRM_PROFILE[profile] ?? 'driving'}/${coords}?overview=full&geometries=geojson&steps=false`
  try {
    const data = await jsonFetch<{ routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] }>(url)
    const route = data.routes?.[0]
    if (!route) throw new Error('Маршрут не найден')
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
      profile,
    }
  } catch (err) {
    if (profile !== 'driving') return fetchRoute(points, 'driving')
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* Overpass — OSM buildings & POI import                              */
/* ------------------------------------------------------------------ */

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
  center?: { lat: number; lon: number }
}

export function parseBuildingHeight(tags: Record<string, string>): number {
  if (tags['height']) {
    const h = parseFloat(tags['height'].replace(',', '.'))
    if (Number.isFinite(h) && h > 0) return h
  }
  if (tags['building:levels']) {
    const l = parseFloat(tags['building:levels'].replace(',', '.'))
    if (Number.isFinite(l) && l > 0) return l * 3.1 + 1
  }
  return 9
}

function buildingColor(tags: Record<string, string>): string {
  const t = tags['building'] ?? ''
  if (t === 'industrial' || t === 'warehouse') return '#5b667a'
  if (t === 'commercial' || t === 'retail') return '#6b7f9e'
  if (t === 'residential' || t === 'apartments' || t === 'house') return '#7d8597'
  if (t === 'school' || t === 'university') return '#6f7d99'
  if (t === 'church' || t === 'cathedral') return '#8b7f70'
  return '#748094'
}

export async function fetchOsmBuildings(
  bounds: [number, number, number, number],
): Promise<FeatureCollection<Polygon, FeatureProps>> {
  const bbox = `${bounds[1].toFixed(5)},${bounds[0].toFixed(5)},${bounds[3].toFixed(5)},${bounds[2].toFixed(5)}`
  const query = `[out:json][timeout:25];way["building"](${bbox});out geom;`
  const data = await jsonFetch<{ elements: OverpassElement[] }>(
    OVERPASS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
    30000,
  )
  const features: Feature<Polygon, FeatureProps>[] = []
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue
    const ring = el.geometry.map((p) => [p.lon, p.lat] as [number, number])
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0])
    }
    const tags = el.tags ?? {}
    const height = parseBuildingHeight(tags)
    const minHeight = tags['min_height'] ? parseFloat(tags['min_height']) || 0 : 0
    const levels = parseFloat(tags['building:levels'] ?? '') || Math.max(1, Math.round(height / 3.1))
    features.push({
      type: 'Feature',
      properties: {
        osmId: el.id,
        name: tags['name'] ?? '',
        height,
        minHeight,
        levels,
        color: buildingColor(tags),
        roofColor: tags['roof:colour'] ?? '#4a5568',
        roofType: tags['roof:shape'] ?? 'flat',
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }
  return { type: 'FeatureCollection', features }
}

const AMENITY_MAP: Record<string, string> = {
  restaurant: 'cafe',
  fast_food: 'cafe',
  cafe: 'cafe',
  bar: 'cafe',
  bank: 'atm',
  atm: 'atm',
  hospital: 'hospital',
  clinic: 'hospital',
  pharmacy: 'hospital',
  school: 'school',
  university: 'school',
  college: 'school',
  kindergarten: 'school',
  bench: 'bench',
  waste_basket: 'trash',
  place_of_worship: 'church',
  parking: 'parking',
  fuel: 'shop',
  marketplace: 'shop',
}

function osmCategory(tags: Record<string, string>): string {
  if (tags['shop']) return 'shop'
  if (tags['tourism']) return tags['tourism'] === 'attraction' ? 'monument' : 'poi'
  if (tags['amenity'] && AMENITY_MAP[tags['amenity']]) return AMENITY_MAP[tags['amenity']]
  if (tags['highway']) return tags['highway'] === 'footway' || tags['highway'] === 'path' ? 'trail' : 'road'
  if (tags['leisure'] === 'park' || tags['landuse'] === 'forest') return 'nature'
  if (tags['natural'] === 'water' || tags['waterway']) return 'water'
  if (tags['man_made'] === 'mast' || tags['man_made'] === 'tower') return 'hazard'
  return 'poi'
}

/** "Скачать область" — imports real OSM POIs / ways from Overpass (idea 60). */
export async function fetchOsmObjects(
  bounds: [number, number, number, number],
  limit = 220,
): Promise<Partial<MapObject>[]> {
  const bbox = `${bounds[1].toFixed(5)},${bounds[0].toFixed(5)},${bounds[3].toFixed(5)},${bounds[2].toFixed(5)}`
  const query = `[out:json][timeout:25];
(
  node["amenity"](${bbox});
  node["shop"](${bbox});
  node["tourism"~"attraction|viewpoint|museum"](${bbox});
  node["historic"](${bbox});
  node["man_made"~"mast|tower"](${bbox});
  way["highway"~"footway|path|cycleway"](${bbox});
  way["leisure"~"park|garden"](${bbox});
);
out center ${limit};`
  const data = await jsonFetch<{ elements: OverpassElement[] }>(
    OVERPASS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
    30000,
  )
  const objects: Partial<MapObject>[] = []
  for (const el of data.elements) {
    const tags = el.tags ?? {}
    const category = osmCategory(tags)
    const name = tags['name:ru'] ?? tags['name'] ?? tags['operator'] ?? ''
    const kind: MapObject['type'] = el.type === 'node' ? 'point' : tags['highway'] ? 'line' : 'polygon'
    let geometry: MapObject['geometry'] | null = null
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      geometry = { type: 'Point', coordinates: [el.lon, el.lat] }
    } else if (el.geometry && el.geometry.length > 1) {
      const coords = el.geometry.map((p) => [p.lon, p.lat] as [number, number])
      geometry =
        kind === 'line'
          ? { type: 'LineString', coordinates: coords }
          : {
              type: 'Polygon',
              coordinates: [[...coords, coords[0]]],
            }
    } else if (el.center) {
      geometry = { type: 'Point', coordinates: [el.center.lon, el.center.lat] }
    }
    if (!geometry) continue
    objects.push({
      type: kind === 'line' ? 'line' : kind === 'polygon' ? 'polygon' : 'point',
      category,
      name: name || 'OSM объект',
      description: [tags['amenity'], tags['shop'], tags['tourism'], tags['highway']]
        .filter(Boolean)
        .join(' · '),
      geometry,
      tags: ['osm'],
      properties: {
        osmId: el.id,
        'OSM теги': Object.entries(tags)
          .slice(0, 6)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    })
  }
  return objects
}

/* ------------------------------------------------------------------ */
/* Elevation                                                           */
/* ------------------------------------------------------------------ */

export async function fetchElevationProfile(
  coords: [number, number][],
  samples = 24,
): Promise<{ distance: number; elevation: number }[]> {
  if (coords.length < 2) return []
  const pts: [number, number][] = []
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const idx = Math.min(coords.length - 1, Math.round(t * (coords.length - 1)))
    pts.push(coords[idx])
  }
  const locations = pts.map((p) => `${p[1]},${p[0]}`).join('|')
  const data = await jsonFetch<{ results: { elevation: number }[] }>(
    `https://api.open-elevation.com/api/v1/lookup?locations=${locations}`,
    undefined,
    20000,
  )
  const total = coords.reduce((s, c, i) => (i ? s + dist(coords[i - 1], c) : 0), 0)
  return data.results.map((r, i) => ({
    distance: (total * i) / Math.max(1, data.results.length - 1),
    elevation: r.elevation,
  }))
}

function dist(a: [number, number], b: [number, number]) {
  const R = 6378137
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
