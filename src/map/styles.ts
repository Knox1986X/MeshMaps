import type { StyleSpecification } from 'maplibre-gl'
import type { BaseMapId } from '@/types'
import { OFFLINE_GLYPHS, VECTOR_ATTRIBUTION, vectorLayers, vectorSources } from './vectorStyle'

export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
export const FONT_STACK = ['Open Sans Semibold']

/**
 * Basemaps are intentionally **keyless**: the app has to work right after a fresh install,
 * so no provider that requires an API key / token is used here.
 *
 * ⚠️ Do not put `basemaps.cartocdn.com` back — since 2024 CARTO's basemap CDN answers
 * unregistered clients with tiles that only contain the "API KEY REQUIRED" watermark
 * (the whole map turns into a grey wall with that text, see issue on mobile APK).
 * Same story for Stadia/MapTiler/Thunderforest: they need a key.
 */
export const TERRAIN_SOURCE = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxzoom: 14,
  encoding: 'terrarium' as const,
  attribution: 'Elevation: AWS Terrain Tiles',
}

export interface RasterLayerDef {
  tiles: string[]
  maxzoom: number
  opacity?: number
}

interface BasemapDef {
  /** raster layers, painted bottom → top (the first one keeps the id `basemap`) */
  layers: RasterLayerDef[]
  attribution: string
}

export const BASEMAPS: Record<
  BaseMapId,
  { id: BaseMapId; labelRu: string; labelEn: string; swatch: string; kind: 'raster' | 'vector' | 'none' }
> = {
  osm: { id: 'osm', labelRu: 'OSM стандарт', labelEn: 'OSM standard', swatch: '#c8dfb4', kind: 'raster' },
  // ids are kept for backward compatibility with already-persisted settings / share links
  'carto-dark': { id: 'carto-dark', labelRu: 'Тёмная', labelEn: 'Dark', swatch: '#1b2431', kind: 'vector' },
  'carto-light': { id: 'carto-light', labelRu: 'Светлая', labelEn: 'Light', swatch: '#eef1f5', kind: 'vector' },
  satellite: { id: 'satellite', labelRu: 'Сателлит', labelEn: 'Satellite', swatch: '#2f4a34', kind: 'raster' },
  topo: { id: 'topo', labelRu: 'Топографическая', labelEn: 'Topographic', swatch: '#e8e0cf', kind: 'raster' },
  blank: { id: 'blank', labelRu: 'Только разметка', labelEn: 'Markup only', swatch: '#0b0f16', kind: 'none' },
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'

const RASTER: Partial<Record<BaseMapId, BasemapDef>> = {
  osm: {
    layers: [{ tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], maxzoom: 19 }],
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    layers: [
      {
        tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
        maxzoom: 19,
      },
    ],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  topo: {
    layers: [
      {
        tiles: [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        maxzoom: 17,
      },
    ],
    attribution: '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors',
  },
}

export function isVectorBasemap(id: BaseMapId): boolean {
  return id === 'carto-dark' || id === 'carto-light'
}

export function buildStyle(id: BaseMapId, theme: 'dark' | 'light'): StyleSpecification {
  const background = theme === 'dark' ? '#0a0e15' : '#e9edf3'
  if (isVectorBasemap(id)) {
    // keyless vector basemap — see ./vectorStyle.ts
    return {
      version: 8,
      name: `MeshMaps · ${id}`,
      glyphs: OFFLINE_GLYPHS,
      sources: { terrain: TERRAIN_SOURCE, ...vectorSources() },
      layers: vectorLayers(id === 'carto-dark' ? 'dark' : 'light'),
    }
  }
  const def = RASTER[id]
  const style: StyleSpecification = {
    version: 8,
    name: `MeshMaps · ${id}`,
    glyphs: GLYPHS_URL,
    sources: { terrain: TERRAIN_SOURCE },
    layers: [
      {
        id: 'basemap-background',
        type: 'background',
        paint: { 'background-color': background },
      },
    ],
  }
  if (def) {
    def.layers.forEach((layer, i) => {
      const sourceId = i === 0 ? 'basemap' : `basemap-${i}`
      style.sources[sourceId] = {
        type: 'raster',
        tiles: layer.tiles,
        tileSize: 256,
        maxzoom: layer.maxzoom,
      }
      style.layers.push({
        id: sourceId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': layer.opacity ?? 1,
          'raster-fade-duration': 220,
          // soften the raster so our own markup reads better on top of it
          'raster-saturation': id === 'satellite' ? -0.12 : 0,
          'raster-contrast': theme === 'dark' ? 0.06 : 0,
        },
      })
    })
  }
  return style
}

/** Attribution string for the current basemap (used in the bottom bar). */
export function attributionFor(id: BaseMapId): string {
  if (isVectorBasemap(id)) return VECTOR_ATTRIBUTION
  return RASTER[id]?.attribution ?? 'Собственная разметка MeshMaps'
}

/** Endpoint the health check pings: TileJSON for the vector basemap, a single tile otherwise. */
export function sampleTileUrl(id: BaseMapId, center: [number, number], zoom: number): string | null {
  const def = RASTER[id]
  if (!def) return null
  const layer = def.layers[0]
  const z = Math.max(2, Math.min(Math.round(zoom), layer.maxzoom, 14))
  const n = 2 ** z
  const lat = Math.max(-85.05, Math.min(85.05, center[1]))
  const x = Math.floor(((center[0] + 180) / 360) * n)
  const rad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  const template = layer.tiles[0]
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{s}', 'a')
}
