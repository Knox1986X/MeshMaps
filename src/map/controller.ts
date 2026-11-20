import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { featureCollection } from '@turf/helpers'
import type { FeatureProps, MapObject } from '@/types'
import type { StoreState } from '@/store/useStore'
import { visibleObjects } from '@/store/useStore'
import { mapIconId, ensureMapIcons, ensureCustomIcons, customIconId } from '@/icons'
import { fencePanels, objectsToFeatures, sunPosition } from '@/utils/geo'
import { lightFor } from './realism'
import { draftFeatureCollection, measureFeatureCollection, routeFeatureCollection } from '@/drawing'
import { LYR, SRC, applyLayerVisibility, setSourceData } from './layers'

/** Adds `iconKey` + building props and pushes data into the map sources. */
export async function applyData(map: MapLibreMap, state: StoreState): Promise<void> {
  const objects = visibleObjects(state)
  const geo = objectsToFeatures(objects, {
    year: state.year,
    selectedId: state.selectedId,
    hoverId: state.hoverId,
  })

  const byId = new Map(objects.map((o) => [o.id, o]))
  const decorate = (fc: FeatureCollection<Geometry, FeatureProps>) => {
    for (const f of fc.features) {
      const p = f.properties ?? {}
      p.iconKey = mapIconId(String(p.glyph ?? 'poi'), String(p.color ?? '#4f8cff'))
      if (p.objectId) {
        const o = byId.get(String(p.objectId))
        if (o) {
          if (o.type === 'building') {
            p.height = o.height ?? (o.buildingLevels ? o.buildingLevels * 3.1 + 1 : 9)
            p.wallColor = o.wallColor ?? o.color
            p.base = 0
          }
          if (o.icon) p.glyph = o.icon
          if (o.customIcon) p.iconKey = customIconId(o.id)
        }
      }
    }
  }
  decorate(geo.points)
  decorate(geo.lines)
  decorate(geo.polygons)
  decorate(geo.buildings)
  decorate(geo.labels)

  // fence 3D panels
  const panels: Feature[] = []
  for (const obj of objects) {
    if (obj.type === 'fence') panels.push(...fencePanels(obj).features)
  }

  setSourceData(map, SRC.points, geo.points)
  setSourceData(map, SRC.clusters, geo.points)
  setSourceData(map, SRC.lines, geo.lines)
  setSourceData(map, SRC.polygons, geo.polygons)
  setSourceData(map, SRC.buildings, geo.buildings)
  setSourceData(map, SRC.labels, geo.labels)
  setSourceData(map, SRC.buffers, geo.buffers)
  setSourceData(map, SRC.fences, featureCollection(panels))

  // highlight geometry of the selection
  const selected = state.selectedId ? byId.get(state.selectedId) : undefined
  if (selected && selected.geometry.type !== 'Point') {
    setSourceData(map, SRC.highlight, featureCollection([{ type: 'Feature', properties: {}, geometry: selected.geometry }]))
  } else {
    setSourceData(map, SRC.highlight, featureCollection([]))
  }

  setSourceData(map, SRC.draft, draftFeatureCollection(state.draft))
  const areaMode = state.draft?.kind === 'measure-area' || state.tool === 'measure-area'
  setSourceData(
    map,
    SRC.measure,
    state.tool === 'measure-distance' || state.tool === 'measure-area'
      ? measureFeatureCollection(state.measure.points, state.tool === 'measure-area')
      : featureCollection([]),
  )
  setSourceData(
    map,
    SRC.route,
    state.tool === 'route'
      ? routeFeatureCollection(state.route.points, state.route.result?.coordinates)
      : featureCollection([]),
  )
  // route line currently re-uses the measure styling source when measuring
  if (areaMode) {
    /* noop — keeps intent obvious for future tweaks */
  }

  const pairs = new Map<string, { glyph: string; color: string }>()
  for (const fc of [geo.points, geo.labels]) {
    for (const f of fc.features) {
      const glyph = String(f.properties?.glyph ?? 'poi')
      const color = String(f.properties?.color ?? '#4f8cff')
      pairs.set(`${glyph}|${color}`, { glyph, color })
    }
  }
  await ensureMapIcons(map, [...pairs.values()])
  await ensureCustomIcons(
    map,
    objects.filter((o) => !!o.customIcon).map((o) => ({ id: o.id, src: o.customIcon! })),
  )
}

export function applyVisibility(map: MapLibreMap, state: StoreState) {
  applyLayerVisibility(map, {
    mode: state.mode,
    layers: state.layers,
    clusterEnabled: state.settings.cluster,
  })
}

export function applyTerrain(map: MapLibreMap, state: StoreState) {
  try {
    const wants = state.mode === '3d' && state.layers.terrain
    if (wants) {
      map.setTerrain({ source: 'terrain', exaggeration: 1.1 })
    } else {
      map.setTerrain(null)
    }
  } catch (err) {
    console.warn('terrain', err)
  }
}

export function applyHillshade(map: MapLibreMap, state: StoreState) {
  const id = 'mm-hillshade'
  const on = state.layers.hillshade
  try {
    if (on) {
      if (!map.getLayer(id)) {
        map.addLayer(
          {
            id,
            type: 'hillshade',
            source: 'terrain',
            paint: {
              'hillshade-exaggeration': 0.45,
              'hillshade-shadow-color': '#0a1424',
              'hillshade-highlight-color': '#9fb4c9',
              'hillshade-accent-color': '#556579',
            },
          } as never,
          'mm-poly-fill',
        )
      }
      map.setLayoutProperty(id, 'visibility', 'visible')
    } else if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none')
    }
  } catch (err) {
    console.warn('hillshade unsupported', err)
  }
}

/** Moves the style sun so facades and ground shadows agree (keeps 3D plausible). */
export function applySunLight(map: MapLibreMap, azimuth: number, altitude: number, theme: 'dark' | 'light') {
  try {
    map.setLight(lightFor(azimuth, altitude, theme))
  } catch {
    /* raster styles without light support */
  }
}

/** Sun-driven shadow direction for the flat shadow layers (idea 38). */
export function applyShadows(map: MapLibreMap, state: StoreState) {
  const center = map.getCenter()
  const date = new Date(state.settings.sunDate || Date.now())
  const { azimuth, altitude } = sunPosition(date, center.lat, center.lng)
  applySunLight(map, azimuth, altitude, state.theme)
  const strength = Math.max(0.05, Math.min(1, (altitude + 6) / 60))
  const len = 2 + (1 - strength) * 16
  const rad = ((azimuth + 180) * Math.PI) / 180
  const tx = Math.sin(rad) * len
  const ty = Math.cos(rad) * len
  try {
    map.setPaintProperty(LYR.bShadow, 'fill-translate', [tx, ty])
    map.setPaintProperty(LYR.osmShadow, 'fill-translate', [tx, ty])
    map.setPaintProperty(LYR.bShadow, 'fill-opacity', state.layers.shadows ? 0.12 + strength * 0.22 : 0)
    map.setPaintProperty(LYR.osmShadow, 'fill-opacity', state.layers.shadows ? 0.12 + strength * 0.2 : 0)
    map.setPaintProperty(LYR.b3d, 'fill-extrusion-opacity', 0.72 + strength * 0.24)
    if (map.getLayer('basemap-buildings-3d')) {
      // real buildings stay solid: see-through walls never look like a real city
      map.setPaintProperty('basemap-buildings-3d', 'fill-extrusion-opacity', 1)
    }
  } catch {
    /* layer may not exist yet */
  }
}

/**
 * Only the transient drawing sources (draft geometry, measurement, route preview).
 *
 * While a line or polygon is being drawn the draft changes on every pointer move; rebuilding
 * every object source at 18 Hz is what made drawing feel sticky on a phone.
 */
export function applyAux(map: MapLibreMap, state: StoreState) {
  setSourceData(map, SRC.draft, draftFeatureCollection(state.draft))
  setSourceData(
    map,
    SRC.measure,
    state.tool === 'measure-distance' || state.tool === 'measure-area'
      ? measureFeatureCollection(state.measure.points, state.tool === 'measure-area')
      : featureCollection([]),
  )
  setSourceData(
    map,
    SRC.route,
    state.tool === 'route'
      ? routeFeatureCollection(state.route.points, state.route.result?.coordinates)
      : featureCollection([]),
  )
}

/**
 * 3D buildings that come from the vector basemap (OpenFreeMap): real OSM heights,
 * no Overpass request, and they work from an offline pack. Only the vector styles
 * have these layers, so every call is guarded.
 */
export function syncBasemap3d(map: MapLibreMap, state: StoreState) {
  const show = state.mode === '3d' && state.settings.osmBuildings
  try {
    if (map.getLayer('basemap-buildings-3d')) {
      map.setLayoutProperty('basemap-buildings-3d', 'visibility', show ? 'visible' : 'none')
    }
    if (map.getLayer('basemap-buildings')) {
      map.setLayoutProperty('basemap-buildings', 'visibility', show ? 'none' : 'visible')
    }
  } catch {
    /* raster basemap or style mid-swap */
  }
}

export function syncMode(map: MapLibreMap, state: StoreState, animate = true) {
  const is3d = state.mode === '3d'
  const center = map.getCenter()
  const opts = {
    center,
    zoom: map.getZoom(),
    pitch: is3d ? 58 : 0,
    bearing: is3d ? (state.view.bearing || -24) : 0,
    duration: animate ? 1100 : 0,
    easing: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  }
  map.easeTo(opts as never)
  applyTerrain(map, state)
  applyVisibility(map, state)
  syncBasemap3d(map, state)
  if (is3d) map.setMaxPitch(85)
}

/** Grid overlay that follows the viewport (idea 42). */
export function updateGrid(map: MapLibreMap, state: StoreState) {
  if (!state.layers.grid) {
    setSourceData(map, SRC.grid, featureCollection([]))
    return
  }
  const b = map.getBounds()
  const zoom = map.getZoom()
  const step = zoom > 16 ? 0.002 : zoom > 14 ? 0.008 : zoom > 12 ? 0.03 : zoom > 10 ? 0.12 : 0.5
  const features: Feature<Geometry, FeatureProps>[] = []
  const w = b.getWest()
  const e = b.getEast()
  const s = b.getSouth()
  const n = b.getNorth()
  const startLon = Math.floor(w / step) * step
  const startLat = Math.floor(s / step) * step
  for (let lon = startLon; lon <= e + step; lon += step) {
    features.push({
      type: 'Feature',
      properties: { kind: 'lon', label: `${lon.toFixed(3)}°` },
      geometry: { type: 'LineString', coordinates: [[lon, s], [lon, n]] },
    })
  }
  for (let lat = startLat; lat <= n + step; lat += step) {
    features.push({
      type: 'Feature',
      properties: { kind: 'lat', label: `${lat.toFixed(3)}°` },
      geometry: { type: 'LineString', coordinates: [[w, lat], [e, lat]] },
    })
  }
  setSourceData(map, SRC.grid, featureCollection(features))
}

/** Object → HTML popup card (name, category, coords, photo, rating). */
export function popupHtml(obj: MapObject, categoryLabel: string, coords: [number, number]): string {
  const photo = obj.attachments.find((a) => /\.(png|jpe?g|gif|webp|svg)$/i.test(a) || a.startsWith('data:image'))
  const rating = obj.rating ? `${'★'.repeat(Math.round(obj.rating))}${'☆'.repeat(5 - Math.round(obj.rating))}` : ''
  const extra = Object.entries(obj.properties).slice(0, 3)
    .map(([k, v]) => `<div class="flex gap-2 text-[11px]"><span class="muted">${esc(k)}</span><span>${esc(String(v))}</span></div>`)
    .join('')
  return `<div class="panel-solid w-[268px] overflow-hidden animate-floatIn">
    ${photo ? `<div class="h-[110px] w-full bg-cover bg-center" style="background-image:url('${encodeURI(photo)}')"></div>` : ''}
    <div class="p-3">
      <div class="mb-1 flex items-start gap-2">
        <span class="mt-[2px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style="background:${esc(obj.color)}"></span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-semibold">${esc(obj.name || 'Без названия')}</div>
          <div class="muted text-[11px]">${esc(categoryLabel)}${obj.height ? ` · ${obj.height} м` : ''}</div>
        </div>
        ${rating ? `<div class="text-[10px] text-amber">${rating}</div>` : ''}
      </div>
      ${obj.description ? `<div class="muted mb-2 line-clamp-2 text-[11.5px] leading-snug">${esc(obj.description)}</div>` : ''}
      ${extra}
      <div class="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <code class="muted text-[10px]">${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}</code>
        <button data-action="open" class="btn btn-primary !px-2 !py-1 !text-[11px]">Открыть</button>
      </div>
    </div>
  </div>`
}

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function featureObjectId(f: { properties?: unknown } | undefined): string | null {
  const p = f?.properties as Record<string, unknown> | undefined
  const id = p?.['objectId'] ?? p?.['id']
  return id ? String(id) : null
}

export function pointOfGeometry(g: Geometry): [number, number] {
  if (g.type === 'Point') return g.coordinates as [number, number]
  const anyG = g as unknown as { coordinates?: unknown }
  const c = anyG.coordinates
  if (Array.isArray(c) && Array.isArray(c[0])) return c[0] as [number, number]
  return [0, 0]
}
