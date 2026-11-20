import type { ExpressionSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl'
import {
  BUILDING_3D_FILTER,
  DEFAULT_BUILDING_HEIGHT,
  buildingBaseExpr,
  buildingHeightExpr,
} from './realism'

/**
 * Keyless vector basemap built on OpenFreeMap tiles (OpenStreetMap data, OpenMapTiles schema).
 *
 * Why not CARTO/Stadia/MapTiler: they answer unregistered clients with
 * "API KEY REQUIRED" watermark tiles — that is exactly the grey wall the APK showed.
 * OpenFreeMap needs no key and covers the whole planet, so the app works from a clean install.
 */

export const VECTOR_TILEJSON = 'https://tiles.openfreemap.org/planet'
/**
 * Tiles and glyphs are requested through the offline protocol: downloaded packs answer
 * from IndexedDB, everything else goes to the network. One style for online and offline.
 */
export const OFFLINE_TILES = 'mmoffline://omvt/{z}/{x}/{y}'
export const OFFLINE_GLYPHS = 'mmoffline://font/{fontstack}/{range}'
export const VECTOR_ATTRIBUTION = '© OpenFreeMap · © OpenStreetMap contributors'
export const VECTOR_MAX_ZOOM = 14

type Palette = {
  background: string
  green: string
  greenStrong: string
  residential: string
  commercial: string
  industrial: string
  civic: string
  water: string
  waterLine: string
  coast: string
  boundary: string
  boundaryCountry: string
  roadCasing: string
  roadMajor: string
  roadMedium: string
  roadMinor: string
  roadService: string
  rail: string
  building: string
  buildingLine: string
  building3dLow: string
  building3dMid: string
  building3dHigh: string
  label: string
  labelHalo: string
  poi: string
}

const DARK: Palette = {
  // land is a touch lighter than water: at z3–6 the map must still read as a map,
  // otherwise the whole continent turns into an empty black rectangle
  background: '#131b25',
  green: '#16231f',
  greenStrong: '#122019',
  residential: '#151e28',
  commercial: '#18212c',
  industrial: '#16202a',
  civic: '#18212e',
  water: '#081420',
  waterLine: '#12233a',
  coast: '#2b4a63',
  boundary: '#26313f',
  boundaryCountry: '#3a4759',
  roadCasing: '#1b2431',
  roadMajor: '#2b3a4f',
  roadMedium: '#242f40',
  roadMinor: '#1f2836',
  roadService: '#1a222d',
  rail: '#28313f',
  building: '#161d28',
  buildingLine: '#1c2531',
  building3dLow: '#1c2735',
  building3dMid: '#2b3a4e',
  building3dHigh: '#44586f',
  label: '#a7b6cc',
  labelHalo: '#070b11',
  poi: '#c8d3e2',
}

const LIGHT: Palette = {
  background: '#eef1f6',
  green: '#e2ecdd',
  greenStrong: '#d8e8d3',
  residential: '#eaeef4',
  commercial: '#e7ebf2',
  industrial: '#e9e9ee',
  civic: '#e8edf4',
  water: '#cadff4',
  waterLine: '#bcd6ef',
  coast: '#8fb6d8',
  boundary: '#c3ccda',
  boundaryCountry: '#a9b4c6',
  roadCasing: '#dfe4ec',
  roadMajor: '#ffffff',
  roadMedium: '#ffffff',
  roadMinor: '#ffffff',
  roadService: '#f6f8fb',
  rail: '#d5dbe5',
  building: '#e3e8f0',
  buildingLine: '#d5dbe5',
  building3dLow: '#eef2f7',
  building3dMid: '#dfe6ef',
  building3dHigh: '#c9d5e4',
  label: '#46536a',
  labelHalo: '#ffffff',
  poi: '#33415a',
}

const ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path'] as const

const zoomInterp = (a: number, av: number, b: number, bv: number): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], a, av, b, bv]

export function vectorSources(): Record<string, SourceSpecification> {
  return {
    openmaptiles: { type: 'vector', tiles: [OFFLINE_TILES], maxzoom: VECTOR_MAX_ZOOM },
  }
}

/** Basemap layers (painted under the app's own markup layers). */
export function vectorLayers(theme: 'dark' | 'light'): LayerSpecification[] {
  const p = theme === 'dark' ? DARK : LIGHT
  const dark = theme === 'dark'
  const src = { source: 'openmaptiles' } as const

  const layers: LayerSpecification[] = [
    {
      id: 'basemap',
      type: 'background',
      paint: { 'background-color': p.background },
    },
    {
      id: 'basemap-landcover',
      type: 'fill',
      ...src,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'scrub', 'farmland', 'meadow']]],
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          ['wood'],
          p.greenStrong,
          p.green,
        ],
        'fill-opacity': 0.9,
      },
    },
    {
      id: 'basemap-landuse',
      type: 'fill',
      ...src,
      'source-layer': 'landuse',
      paint: {
        'fill-color': [
          'match',
          ['get', 'class'],
          ['residential', 'suburb', 'neighbourhood'],
          p.residential,
          ['commercial', 'retail'],
          p.commercial,
          ['industrial', 'railway', 'quarry'],
          p.industrial,
          ['cemetery', 'hospital', 'school', 'college', 'university', 'stadium', 'parking'],
          p.civic,
          p.residential,
        ],
        'fill-opacity': zoomInterp(6, 0, 12, 0.85),
      },
    },
    {
      id: 'basemap-water',
      type: 'fill',
      ...src,
      'source-layer': 'water',
      paint: { 'fill-color': p.water, 'fill-antialias': true },
    },
    {
      id: 'basemap-coast',
      type: 'line',
      ...src,
      'source-layer': 'water',
      filter: ['==', ['get', 'class'], 'ocean'],
      paint: {
        'line-color': p.coast,
        'line-width': zoomInterp(2, 0.7, 8, 1.5),
        'line-opacity': 0.85,
      },
    },
    {
      id: 'basemap-waterway',
      type: 'line',
      ...src,
      'source-layer': 'waterway',
      minzoom: 8,
      paint: {
        'line-color': p.waterLine,
        'line-width': zoomInterp(9, 0.6, 16, 3.2),
        'line-opacity': 0.9,
      },
    },
    {
      id: 'basemap-boundary',
      type: 'line',
      ...src,
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: {
        'line-color': ['case', ['==', ['get', 'admin_level'], 2], p.boundaryCountry, p.boundary],
        'line-width': zoomInterp(3, 0.6, 10, 1.6),
        'line-dasharray': [2.2, 1.6],
        'line-opacity': 0.8,
      },
    },
  ]

  // roads: casing first, then the fill
  layers.push({
    id: 'basemap-road-casing',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', [...ROADS]]],
    minzoom: 7,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': p.roadCasing,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        7,
        ['match', ['get', 'class'], ['motorway', 'trunk'], 1.4, 0.6],
        16,
        ['match', ['get', 'class'], ['motorway', 'trunk'], 12, ['primary', 'secondary'], 8.5, ['tertiary'], 6, ['minor'], 4.4, 2.6],
      ],
      'line-opacity': 0.95,
    },
  })

  layers.push({
    id: 'basemap-roads',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', [...ROADS.filter((c) => c !== 'path' && c !== 'track')]]],
    minzoom: 8,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk'],
        p.roadMajor,
        ['primary', 'secondary'],
        p.roadMedium,
        ['tertiary', 'minor'],
        p.roadMinor,
        p.roadService,
      ],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['match', ['get', 'class'], ['motorway', 'trunk'], 1, 0.4],
        16,
        ['match', ['get', 'class'], ['motorway', 'trunk'], 9.4, ['primary', 'secondary'], 6.6, ['tertiary'], 4.4, ['minor'], 3, ['service'], 1.6, 1.6],
      ],
    },
  })

  layers.push({
    id: 'basemap-paths',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
    minzoom: 13,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': p.roadMinor,
      'line-width': zoomInterp(13, 0.5, 18, 1.6),
      'line-dasharray': [1.8, 1.4],
      'line-opacity': 0.85,
    },
  })

  layers.push({
    id: 'basemap-rail',
    type: 'line',
    ...src,
    'source-layer': 'transportation',
    filter: ['==', ['get', 'class'], 'rail'],
    minzoom: 10,
    paint: {
      'line-color': p.rail,
      'line-width': zoomInterp(11, 0.6, 17, 2),
      'line-dasharray': [3, 2],
      'line-opacity': 0.85,
    },
  })

  layers.push({
    id: 'basemap-buildings',
    type: 'fill',
    ...src,
    'source-layer': 'building',
    filter: BUILDING_3D_FILTER,
    minzoom: 13.5,
    paint: {
      'fill-color': p.building,
      'fill-opacity': zoomInterp(13.5, 0, 15.5, 0.95),
      'fill-outline-color': p.buildingLine,
    },
  })

  // country + region labels: without them a wide view looks like an empty canvas
  layers.push({
    id: 'basemap-countries',
    type: 'symbol',
    ...src,
    'source-layer': 'place',
    minzoom: 3,
    maxzoom: 9,
    filter: ['==', ['get', 'class'], 'country'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name'], ['get', 'name:en']],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomInterp(3, 11, 8, 15),
      'text-letter-spacing': 0.14,
      'text-transform': 'uppercase',
      'text-max-width': 7,
      'text-padding': 8,
    },
    paint: {
      'text-color': p.label,
      'text-halo-color': p.labelHalo,
      'text-halo-width': 1.4,
      'text-opacity': 0.82,
    },
  })

  layers.push({
    id: 'basemap-regions',
    type: 'symbol',
    ...src,
    'source-layer': 'place',
    minzoom: 5,
    maxzoom: 11,
    filter: ['==', ['get', 'class'], 'state'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name'], ['get', 'name:en']],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomInterp(5, 9.5, 10, 12.5),
      'text-letter-spacing': 0.08,
      'text-max-width': 8,
      'text-padding': 6,
    },
    paint: {
      'text-color': p.label,
      'text-halo-color': p.labelHalo,
      'text-halo-width': 1.2,
      'text-opacity': 0.6,
    },
  })

  // 3D buildings straight from the vector tiles: `render_height` is OSM's own metric height
  // (height / building:levels folded together by OpenMapTiles), so this needs no Overpass
  // request, no API key and works from an offline pack. Heights are real meters, and the
  // faces are shaded by the style `light` (one sun for roofs, facades and shadows).
  layers.push({
    id: 'basemap-buildings-3d',
    type: 'fill-extrusion',
    ...src,
    'source-layer': 'building',
    filter: BUILDING_3D_FILTER,
    minzoom: 13,
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], DEFAULT_BUILDING_HEIGHT],
        0,
        p.building3dLow,
        12,
        p.building3dMid,
        45,
        p.building3dHigh,
      ],
      'fill-extrusion-height': buildingHeightExpr(),
      'fill-extrusion-base': buildingBaseExpr(),
      // solid volumes read as real buildings; translucent ones look like ghosts
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': false,
    },
  })

  // POIs and house numbers: what makes a neighbourhood recognisable at street level.
  // Text only — the style ships no sprite, so we never guess an icon URL.
  const POI_CLASSES = [
    'cafe',
    'restaurant',
    'fast_food',
    'bar',
    'pub',
    'shop',
    'supermarket',
    'bakery',
    'pharmacy',
    'hospital',
    'clinic',
    'dentist',
    'school',
    'university',
    'college',
    'kindergarten',
    'bank',
    'atm',
    'lodging',
    'fuel',
    'parking',
    'bus',
    'railway',
    'theatre',
    'cinema',
    'museum',
    'attraction',
    'park',
    'playground',
    'pitch',
    'sports_centre',
    'post',
    'police',
    'fire_station',
    'library',
    'place_of_worship',
    'town_hall',
  ]

  layers.push({
    id: 'basemap-housenumbers',
    type: 'symbol',
    ...src,
    'source-layer': 'housenumber',
    minzoom: 17,
    layout: {
      'text-field': ['get', 'housenumber'],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomInterp(17, 8.5, 20, 11),
      'text-padding': 3,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': p.label,
      'text-halo-color': p.labelHalo,
      'text-halo-width': 1.2,
      'text-opacity': 0.72,
    },
  })

  layers.push({
    id: 'basemap-pois',
    type: 'symbol',
    ...src,
    'source-layer': 'poi',
    minzoom: 15.5,
    filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', POI_CLASSES]]],
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 9.5, 18, 12],
      'text-max-width': 7,
      'text-padding': 4,
      'text-optional': true,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 10],
    },
    paint: {
      'text-color': p.poi,
      'text-halo-color': p.labelHalo,
      'text-halo-width': dark ? 1.3 : 1.1,
      'text-opacity': 0.9,
    },
  })

  layers.push({
    id: 'basemap-places',
    type: 'symbol',
    ...src,
    'source-layer': 'place',
    minzoom: 5,
    filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name'], ['get', 'name:en']],
      'text-font': ['Open Sans Semibold'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,
        ['match', ['get', 'class'], ['city'], 11, 9],
        12,
        ['match', ['get', 'class'], ['city'], 15, ['town'], 13, 11.5],
        17,
        ['match', ['get', 'class'], ['city'], 18, ['town'], 15, 13],
      ],
      'text-letter-spacing': 0.04,
      'text-max-width': 8,
      'text-allow-overlap': false,
      'text-padding': 6,
    },
    paint: {
      'text-color': p.label,
      'text-halo-color': p.labelHalo,
      'text-halo-width': dark ? 1.4 : 1.2,
      'text-opacity': 0.95,
    },
  })

  // a faint water label helps orientation on the dark canvas
  layers.push({
    id: 'basemap-water-labels',
    type: 'symbol',
    ...src,
    'source-layer': 'water_name',
    minzoom: 11,
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomInterp(11, 10, 17, 13),
      'text-letter-spacing': 0.12,
      'text-transform': 'uppercase',
      'text-max-width': 7,
    },
    paint: {
      'text-color': p.label,
      'text-halo-color': p.labelHalo,
      'text-halo-width': 1.1,
      'text-opacity': 0.7,
    },
  })

  return layers
}
