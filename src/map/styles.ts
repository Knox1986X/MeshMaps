import type { StyleSpecification } from 'maplibre-gl'
import type { BaseMapId } from '@/types'

export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
export const FONT_STACK = ['Open Sans Semibold']

export const TERRAIN_SOURCE = {
  type: 'raster-dem' as const,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxzoom: 14,
  encoding: 'terrarium' as const,
  attribution: 'Elevation: AWS Terrain Tiles',
}

interface RasterDef {
  tiles: string[]
  attribution: string
  maxzoom: number
  tileSize?: number
}

export const BASEMAPS: Record<
  BaseMapId,
  { id: BaseMapId; labelRu: string; labelEn: string; swatch: string; kind: 'raster' | 'none' }
> = {
  osm: { id: 'osm', labelRu: 'OSM стандарт', labelEn: 'OSM standard', swatch: '#c8dfb4', kind: 'raster' },
  'carto-dark': { id: 'carto-dark', labelRu: 'Тёмная', labelEn: 'Dark', swatch: '#1b2431', kind: 'raster' },
  'carto-light': { id: 'carto-light', labelRu: 'Светлая', labelEn: 'Light', swatch: '#eef1f5', kind: 'raster' },
  satellite: { id: 'satellite', labelRu: 'Сателлит', labelEn: 'Satellite', swatch: '#2f4a34', kind: 'raster' },
  topo: { id: 'topo', labelRu: 'Топографическая', labelEn: 'Topographic', swatch: '#e8e0cf', kind: 'raster' },
  blank: { id: 'blank', labelRu: 'Только разметка', labelEn: 'Markup only', swatch: '#0b0f16', kind: 'none' },
}

const RASTER: Record<string, RasterDef> = {
  osm: {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  'carto-dark': {
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    ],
    attribution: '© OpenStreetMap contributors © CARTO',
    maxzoom: 20,
  },
  'carto-light': {
    tiles: [
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    ],
    attribution: '© OpenStreetMap contributors © CARTO',
    maxzoom: 20,
  },
  satellite: {
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
  },
  topo: {
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors',
    maxzoom: 17,
  },
}

export function buildStyle(id: BaseMapId, theme: 'dark' | 'light'): StyleSpecification {
  const background = theme === 'dark' ? '#0a0e15' : '#e9edf3'
  const def = RASTER[id]
  const style: StyleSpecification = {
    version: 8,
    name: `MeshMaps · ${id}`,
    glyphs: GLYPHS_URL,
    sources: { terrain: TERRAIN_SOURCE },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': background },
      },
    ],
  }
  if (def) {
    style.sources['basemap'] = {
      type: 'raster',
      tiles: def.tiles,
      tileSize: 256,
      maxzoom: def.maxzoom,
      attribution: def.attribution,
    }
    style.layers.push({
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 220,
        // soften the OSM/topo raster so overlays read better
        'raster-saturation': id === 'satellite' ? -0.12 : 0,
        'raster-contrast': theme === 'dark' ? 0.06 : 0,
      },
    })
  }
  return style
}

/** Attribution string for the current basemap (used in the bottom bar). */
export function attributionFor(id: BaseMapId): string {
  return RASTER[id]?.attribution ?? 'Собственная разметка MeshMaps'
}
