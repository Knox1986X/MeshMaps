import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  Point,
  Polygon,
} from 'geojson'

export type ObjKind = 'point' | 'line' | 'polygon' | 'building' | 'fence'

export type PropertyValue = string | number | boolean

export interface MapComment {
  id: string
  author: string
  text: string
  createdAt: string
}

/** Main data model — everything the user draws lives here. */
export interface MapObject {
  id: string
  type: ObjKind
  category: string
  name: string
  description: string
  geometry: Geometry
  properties: Record<string, PropertyValue>
  icon: string
  color: string
  tags: string[]
  attachments: string[]
  /** Buildings & fences */
  height?: number
  buildingLevels?: number
  roofType?: RoofType
  roofColor?: string
  wallColor?: string
  /** Fence only */
  fenceType?: FenceType
  fenceStyle?: FenceStyle
  fenceOpacity?: number
  /** Draw order helper — pinned objects render on top */
  pinned?: boolean
  /** Buffer circle radius in meters (0 = none) */
  radius?: number
  /** Social layer */
  rating?: number
  comments?: MapComment[]
  /** Free-form schedule (idea 63) */
  schedule?: Record<string, string>
  /** Custom SVG (uploaded by the user, idea 78) */
  customIcon?: string
  /** Version metadata */
  createdAt: string
  updatedAt: string
  author: string
  /** Optional lifecycle for the time-machine (idea 90) */
  yearFrom?: number
  yearTo?: number
}

export type FenceType = 'fence' | 'guarded' | 'restricted' | 'construction'
export type FenceStyle = 'picket' | 'mesh' | 'barbed' | 'concrete' | 'hedge'
export type RoofType = 'flat' | 'gabled' | 'mansard' | 'hipped'

export interface CategoryDef {
  id: string
  labelRu: string
  labelEn: string
  icon: string
  color: string
  kind: ObjKind
  /** default drawable geometry type */
}

export type ToolId =
  | 'select'
  | 'point'
  | 'line'
  | 'polygon'
  | 'building'
  | 'fence'
  | 'measure-distance'
  | 'measure-area'
  | 'buffer'
  | 'route'
  | 'pan'

export type BaseMapId = 'osm' | 'carto-dark' | 'carto-light' | 'satellite' | 'topo' | 'blank'

export type ViewMode = '2d' | '3d'

export interface LayerVisibility {
  basemap: boolean
  buildings: boolean
  osm3d: boolean
  objects: boolean
  labels: boolean
  clusters: boolean
  heatmap: boolean
  grid: boolean
  hillshade: boolean
  terrain: boolean
  shadows: boolean
  buffers: boolean
}

export interface MapViewState {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

export interface Snapshot {
  id: string
  at: string
  label: string
  objects: MapObject[]
}

export interface RouteResult {
  coordinates: [number, number][]
  distance: number
  duration: number
  profile: 'driving' | 'walking' | 'cycling'
}

export interface SearchResult {
  id: string
  label: string
  center: [number, number]
  bbox?: [number, number, number, number]
  type?: string
}

export type FeatureProps = GeoJsonProperties & Record<string, any>

export type MapObjectFeature = Feature<Geometry, FeatureProps>
export type MapObjectCollection = FeatureCollection<Geometry, FeatureProps>

export type { Geometry, Point, LineString, Polygon, Feature, FeatureCollection }
