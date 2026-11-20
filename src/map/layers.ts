import type { LayerSpecification, Map as MapLibreMap, SourceSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

export const SRC = {
  clusters: 'mm-clusters',
  points: 'mm-points',
  lines: 'mm-lines',
  polygons: 'mm-polygons',
  buildings: 'mm-buildings',
  fences: 'mm-fences',
  labels: 'mm-labels',
  buffers: 'mm-buffers',
  osm3d: 'mm-osm3d',
  highlight: 'mm-highlight',
  draft: 'mm-draft',
  measure: 'mm-measure',
  route: 'mm-route',
  grid: 'mm-grid',
} as const

export const LYR = {
  grid: 'mm-grid-line',
  heat: 'mm-heat',
  bufferFill: 'mm-buffer-fill',
  bufferLine: 'mm-buffer-line',
  polyFill: 'mm-poly-fill',
  polyOutline: 'mm-poly-outline',
  polyDash: 'mm-poly-outline-dash',
  osmShadow: 'mm-osm-shadow',
  osm3d: 'mm-osm-3d',
  bShadow: 'mm-building-shadow',
  bFill: 'mm-building-fill',
  bOutline: 'mm-building-outline',
  b3d: 'mm-building-3d',
  fence3d: 'mm-fence-3d',
  lines: 'mm-line',
  linesDashed: 'mm-line-dashed',
  hlFill: 'mm-highlight-fill',
  hlLine: 'mm-highlight-line',
  routeGlow: 'mm-route-glow',
  route: 'mm-route',
  draftFill: 'mm-draft-fill',
  draftLine: 'mm-draft-line',
  draftVerts: 'mm-draft-verts',
  measureFill: 'mm-measure-fill',
  measureLine: 'mm-measure-line',
  measureVerts: 'mm-measure-verts',
  clusterCircle: 'mm-cluster-circle',
  clusterCount: 'mm-cluster-count',
  pointShadow: 'mm-point-shadow',
  pointRing: 'mm-point-ring',
  points: 'mm-points-symbol',
  labels: 'mm-labels-text',
} as const

export const CLICK_LAYERS = [
  LYR.points,
  LYR.clusterCircle,
  LYR.lines,
  LYR.linesDashed,
  LYR.polyFill,
  LYR.bFill,
  LYR.b3d,
  LYR.fence3d,
]

export const HIT_LAYERS = [
  LYR.points,
  LYR.lines,
  LYR.linesDashed,
  LYR.polyFill,
  LYR.bFill,
  LYR.b3d,
  LYR.fence3d,
]

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

const ACCENT = '#4f8cff'

export function addMeshLayers(map: MapLibreMap, theme: 'dark' | 'light') {
  const addSource = (id: string, spec: SourceSpecification) => {
    if (!map.getSource(id)) map.addSource(id, spec)
  }

  addSource(SRC.clusters, {
    type: 'geojson',
    data: empty,
    cluster: true,
    clusterRadius: 54,
    clusterMaxZoom: 15,
  } as SourceSpecification)
  addSource(SRC.points, { type: 'geojson', data: empty })
  addSource(SRC.lines, { type: 'geojson', data: empty })
  addSource(SRC.polygons, { type: 'geojson', data: empty })
  addSource(SRC.buildings, { type: 'geojson', data: empty })
  addSource(SRC.fences, { type: 'geojson', data: empty })
  addSource(SRC.labels, { type: 'geojson', data: empty })
  addSource(SRC.buffers, { type: 'geojson', data: empty })
  addSource(SRC.osm3d, { type: 'geojson', data: empty })
  addSource(SRC.highlight, { type: 'geojson', data: empty })
  addSource(SRC.draft, { type: 'geojson', data: empty })
  addSource(SRC.measure, { type: 'geojson', data: empty })
  addSource(SRC.route, { type: 'geojson', data: empty })
  addSource(SRC.grid, { type: 'geojson', data: empty })

  const stroke = theme === 'dark' ? '#0b0f16' : '#ffffff'

  const layers: LayerSpecification[] = [
    {
      id: LYR.grid,
      type: 'line',
      source: SRC.grid,
      paint: {
        'line-color': theme === 'dark' ? '#8fb4ff' : '#2b62d1',
        'line-opacity': 0.22,
        'line-width': 0.7,
        'line-dasharray': [2, 3],
      },
    },
    {
      id: LYR.heat,
      type: 'heatmap',
      source: SRC.points,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 1.6],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 34, 18, 60],
        'heatmap-opacity': 0.8,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(30,64,175,0)',
          0.2,
          'rgba(56,189,248,0.55)',
          0.45,
          'rgba(163,230,53,0.75)',
          0.7,
          'rgba(251,191,36,0.85)',
          0.9,
          'rgba(239,68,68,0.95)',
        ],
      },
    },
    {
      id: LYR.bufferFill,
      type: 'fill',
      source: SRC.buffers,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.09 },
    },
    {
      id: LYR.bufferLine,
      type: 'line',
      source: SRC.buffers,
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': 0.65,
        'line-width': 1.2,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: LYR.polyFill,
      type: 'fill',
      source: SRC.polygons,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['==', ['get', 'fenceType'], 'restricted'],
          0.14,
          ['==', ['get', 'fenceType'], 'construction'],
          0.16,
          ['==', ['get', 'fenceType'], 'guarded'],
          0.12,
          ['boolean', ['get', 'hover'], false],
          0.34,
          0.2,
        ],
      },
    },
    {
      id: LYR.polyOutline,
      type: 'line',
      source: SRC.polygons,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['==', ['get', 'fenceType'], 'none'], 1.8, 2.4],
        'line-opacity': 0.95,
      },
    },
    {
      id: LYR.polyDash,
      type: 'line',
      source: SRC.polygons,
      filter: ['in', ['get', 'fenceType'], ['literal', ['restricted', 'construction']]],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2.6,
        'line-dasharray': [1.8, 1.4],
        'line-opacity': 0.95,
      },
    },
    {
      id: LYR.osmShadow,
      type: 'fill',
      source: SRC.osm3d,
      paint: {
        'fill-color': '#000000',
        'fill-opacity': 0.28,
        'fill-translate': [3, 5],
        'fill-translate-anchor': 'viewport',
      },
    },
    {
      id: LYR.osm3d,
      type: 'fill-extrusion',
      source: SRC.osm3d,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 9],
        'fill-extrusion-base': ['coalesce', ['get', 'minHeight'], 0],
        'fill-extrusion-opacity': 0.86,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: LYR.bShadow,
      type: 'fill',
      source: SRC.buildings,
      paint: {
        'fill-color': '#000000',
        'fill-opacity': theme === 'dark' ? 0.34 : 0.18,
        'fill-translate': [2, 4],
        'fill-translate-anchor': 'viewport',
      },
    },
    {
      id: LYR.bFill,
      type: 'fill',
      source: SRC.buildings,
      paint: {
        'fill-color': ['coalesce', ['get', 'wallColor'], ['get', 'color']],
        'fill-opacity': 0.9,
      },
    },
    {
      id: LYR.bOutline,
      type: 'line',
      source: SRC.buildings,
      paint: {
        'line-color': theme === 'dark' ? 'rgba(255,255,255,.55)' : 'rgba(15,23,42,.5)',
        'line-width': 1.3,
      },
    },
    {
      id: LYR.b3d,
      type: 'fill-extrusion',
      source: SRC.buildings,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': ['coalesce', ['get', 'wallColor'], ['get', 'color']],
        'fill-extrusion-height': ['max', 2.5, ['coalesce', ['get', 'height'], 9]],
        'fill-extrusion-base': ['coalesce', ['get', 'base'], 0],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: LYR.fence3d,
      type: 'fill-extrusion',
      source: SRC.fences,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': ['get', 'opacity'],
      },
    },
    {
      id: LYR.linesDashed,
      type: 'line',
      source: SRC.lines,
      filter: ['==', ['get', 'dashed'], true],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 16, 2.6],
        'line-dasharray': [1.6, 1.6],
        'line-opacity': 0.95,
      },
    },
    {
      id: LYR.lines,
      type: 'line',
      source: SRC.lines,
      filter: ['!=', ['get', 'dashed'], true],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 16, 4.2],
        'line-opacity': 0.95,
      },
    },
    {
      id: LYR.hlFill,
      type: 'fill',
      source: SRC.highlight,
      paint: { 'fill-color': ACCENT, 'fill-opacity': 0.12 },
    },
    {
      id: LYR.hlLine,
      type: 'line',
      source: SRC.highlight,
      paint: {
        'line-color': ACCENT,
        'line-width': 3,
        'line-opacity': 0.95,
        'line-blur': 0.4,
      },
    },
    {
      id: LYR.routeGlow,
      type: 'line',
      source: SRC.route,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ACCENT, 'line-width': 14, 'line-opacity': 0.18, 'line-blur': 8 },
    },
    {
      id: LYR.route,
      type: 'line',
      source: SRC.route,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ACCENT,
        'line-width': 4.6,
        'line-dasharray': [1.6, 1.1],
        'line-opacity': 1,
      },
    },
    {
      id: LYR.draftFill,
      type: 'fill',
      source: SRC.draft,
      paint: { 'fill-color': ACCENT, 'fill-opacity': 0.16 },
    },
    {
      id: LYR.draftLine,
      type: 'line',
      source: SRC.draft,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ACCENT, 'line-width': 2.6, 'line-dasharray': [1.4, 1.2] },
    },
    {
      id: LYR.draftVerts,
      type: 'circle',
      source: SRC.draft,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5.5,
        'circle-color': '#ffffff',
        'circle-stroke-color': ACCENT,
        'circle-stroke-width': 2.2,
      },
    },
    {
      id: LYR.measureFill,
      type: 'fill',
      source: SRC.measure,
      paint: { 'fill-color': '#a3e635', 'fill-opacity': 0.14 },
    },
    {
      id: LYR.measureLine,
      type: 'line',
      source: SRC.measure,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#a3e635', 'line-width': 2.4, 'line-dasharray': [2, 1.4] },
    },
    {
      id: LYR.measureVerts,
      type: 'circle',
      source: SRC.measure,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': '#a3e635',
        'circle-stroke-color': '#0b0f16',
        'circle-stroke-width': 1.6,
      },
    },
    {
      id: LYR.clusterCircle,
      type: 'circle',
      source: SRC.clusters,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          'rgba(79,140,255,.85)',
          10,
          'rgba(56,189,248,.88)',
          30,
          'rgba(163,230,53,.88)',
          80,
          'rgba(251,191,36,.9)',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 17, 10, 22, 30, 27, 80, 33],
        'circle-stroke-width': 2,
        'circle-stroke-color': theme === 'dark' ? 'rgba(11,15,22,.85)' : '#ffffff',
        'circle-blur': 0.05,
      },
    },
    {
      id: LYR.clusterCount,
      type: 'symbol',
      source: SRC.clusters,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Semibold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#04070d' },
    },
    {
      id: LYR.pointShadow,
      type: 'circle',
      source: SRC.points,
      paint: {
        'circle-color': '#000000',
        'circle-radius': 11,
        'circle-blur': 1,
        'circle-opacity': 0.38,
        'circle-translate': [0, 3],
      },
    },
    {
      id: LYR.pointRing,
      type: 'circle',
      source: SRC.points,
      filter: ['==', ['get', 'selected'], true],
      paint: {
        'circle-radius': 20,
        'circle-color': 'rgba(79,140,255,.12)',
        'circle-stroke-width': 2,
        'circle-stroke-color': ACCENT,
        'circle-blur': 0.1,
      },
    },
    {
      id: LYR.points,
      type: 'symbol',
      source: SRC.points,
      layout: {
        'icon-image': ['get', 'iconKey'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 1, 19, 1.3],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center',
      },
    },
    {
      id: LYR.labels,
      type: 'symbol',
      source: SRC.labels,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Semibold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 17, 13],
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-optional': true,
        'text-allow-overlap': false,
        'text-padding': 4,
        'text-max-width': 9,
      },
      paint: {
        'text-color': theme === 'dark' ? '#e8edf6' : '#111927',
        'text-halo-color': theme === 'dark' ? 'rgba(7,10,16,.85)' : 'rgba(255,255,255,.9)',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.4,
      },
    },
  ]

  for (const layer of layers) {
    if (!map.getLayer(layer.id)) {
      try {
        map.addLayer(layer)
      } catch (err) {
        console.warn('layer failed', layer.id, err)
      }
    }
  }
  if (stroke) {
    // hint for future styling tweaks
  }
}

export function setVis(map: MapLibreMap, id: string, visible: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export interface ApplyOptions {
  mode: '2d' | '3d'
  layers: {
    objects: boolean
    labels: boolean
    buildings: boolean
    osm3d: boolean
    clusters: boolean
    heatmap: boolean
    grid: boolean
    buffers: boolean
    terrain: boolean
    hillshade: boolean
    shadows: boolean
  }
  clusterEnabled: boolean
}

export function applyLayerVisibility(map: MapLibreMap, opts: ApplyOptions) {
  const { mode, layers } = opts
  const is3d = mode === '3d'
  setVis(map, LYR.grid, layers.grid)
  setVis(map, LYR.heat, layers.heatmap)
  setVis(map, LYR.bufferFill, layers.buffers)
  setVis(map, LYR.bufferLine, layers.buffers)
  setVis(map, LYR.polyFill, layers.objects)
  setVis(map, LYR.polyOutline, layers.objects)
  setVis(map, LYR.polyDash, layers.objects)
  setVis(map, LYR.lines, layers.objects)
  setVis(map, LYR.linesDashed, layers.objects)
  setVis(map, LYR.osm3d, layers.osm3d && is3d)
  setVis(map, LYR.osmShadow, layers.osm3d && !is3d && layers.shadows)
  setVis(map, LYR.bFill, layers.buildings && !is3d)
  setVis(map, LYR.bOutline, layers.buildings && !is3d)
  setVis(map, LYR.bShadow, layers.buildings && !is3d && layers.shadows)
  setVis(map, LYR.b3d, layers.buildings && is3d)
  setVis(map, LYR.fence3d, layers.objects)
  setVis(map, LYR.clusterCircle, (layers.clusters ?? true) && opts.clusterEnabled)
  setVis(map, LYR.clusterCount, (layers.clusters ?? true) && opts.clusterEnabled)
  setVis(map, LYR.pointShadow, layers.objects)
  setVis(map, LYR.pointRing, layers.objects)
  setVis(map, LYR.labels, layers.objects && layers.labels)
  // hide individual points while clustering is active at lower zooms
  setPointLayersMinZoom(map, opts.clusterEnabled ? 15 : 0)
  setVis(map, LYR.points, layers.objects)
}

export function setSourceData(map: MapLibreMap, id: string, data: unknown) {
  const src = map.getSource(id) as { setData?: (d: unknown) => void } | undefined
  if (src?.setData) src.setData(data)
}

/**
 * Clustering is a source-level option, so instead of recreating the source we
 * lift the `minzoom` of the icon/ring layers while cluster bubbles are on.
 * `minzoom` is a layer property (not a layout one) — hence remove + re-add.
 */
export function setPointLayersMinZoom(map: MapLibreMap, minzoom: number) {
  const ids = [LYR.pointShadow, LYR.pointRing, LYR.points]
  for (const id of ids) {
    const layer = map.getLayer(id)
    if (!layer) continue
    if ((layer as { minzoom?: number }).minzoom === minzoom) continue
    const clone = { ...(layer as unknown as Record<string, unknown>), minzoom } as LayerSpecification
    try {
      map.removeLayer(id)
      if (map.getLayer(LYR.labels)) map.addLayer(clone, LYR.labels)
      else map.addLayer(clone)
    } catch (err) {
      console.warn('minzoom re-add failed', id, err)
    }
  }
}
