import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  BaseMapId,
  FenceStyle,
  FenceType,
  LayerVisibility,
  MapObject,
  MapViewState,
  ObjKind,
  RoofType,
  RouteResult,
  SearchResult,
  Snapshot,
  ToolId,
  ViewMode,
} from '@/types'
import { CATEGORIES, getCategory } from '@/icons/categories'
import { geometryArea, geometryLength, haversine, pathLength } from '@/utils/geo'

export type Locale = 'ru' | 'en'
export type SortKey = 'updated' | 'created' | 'name' | 'category' | 'size'
export type ModalId =
  | 'settings'
  | 'legend'
  | 'stats'
  | 'history'
  | 'shortcuts'
  | 'report'
  | 'admin'
  | 'layers'
  | 'import'
  | 'geometry'
  | 'about'
  | null

export interface Draft {
  kind: 'point' | 'line' | 'polygon' | 'building' | 'fence' | 'measure-distance' | 'measure-area' | 'route'
  coords: [number, number][]
  hover: [number, number] | null
}

export interface MeasureResult {
  distance: number
  area: number
  segments: number[]
}

export interface Toast {
  id: string
  kind: 'ok' | 'info' | 'warn' | 'error'
  text: string
}

export interface Settings {
  author: string
  locale: Locale
  sound: boolean
  labels: boolean
  animateMarkers: boolean
  shadows: boolean
  sunDate: string
  units: 'metric'
  showGrid: boolean
  osmBuildings: boolean
  autoSave: boolean
  cluster: boolean
}

export interface PendingDraw {
  category: string
  color: string | null
  height: number
  buildingLevels: number
  fenceType: FenceType
  fenceStyle: FenceStyle
  radius: number
  lineStyle: 'solid' | 'dashed'
}

export interface HistoryEntry {
  objects: MapObject[]
  label: string
}

interface StoreState {
  objects: MapObject[]
  selectedId: string | null
  hoverId: string | null
  tool: ToolId
  mode: ViewMode
  theme: 'dark' | 'light'
  basemap: BaseMapId
  layers: LayerVisibility
  settings: Settings
  filters: { categories: string[]; tags: string[]; query: string; onlyPinned: boolean }
  sort: SortKey
  view: MapViewState
  draft: Draft | null
  pending: PendingDraw
  measure: { points: [number, number][]; result: MeasureResult | null }
  route: { points: [number, number][]; result: RouteResult | null; profile: 'driving' | 'walking' | 'cycling' }
  history: { past: HistoryEntry[]; future: HistoryEntry[] }
  modal: ModalId
  bottomOpen: boolean
  split: boolean
  year: number | null
  toasts: Toast[]
  saveState: 'saved' | 'saving' | 'idle'
  snapshots: Snapshot[]
  searchResults: SearchResult[]
  searchLoading: boolean
  cursor: [number, number] | null
  flyTo: { center: [number, number]; zoom?: number; bearing?: number; pitch?: number; ts: number } | null
  hydrated: boolean

  // ---- actions ----
  hydrate(objects: MapObject[], patch?: Partial<StoreState>): void
  addObject(partial: Partial<MapObject> & { geometry: MapObject['geometry'] }, opts?: { silent?: boolean }): MapObject
  addObjects(list: MapObject[], label?: string): void
  updateObject(id: string, patch: Partial<MapObject>, opts?: { silent?: boolean }): void
  deleteObject(id: string): void
  deleteSelected(): void
  duplicateObject(id: string): void
  select(id: string | null): void
  hover(id: string | null): void
  setTool(tool: ToolId): void
  setMode(mode: ViewMode): void
  toggleMode(): void
  setTheme(theme: 'dark' | 'light'): void
  toggleTheme(): void
  setBasemap(id: BaseMapId): void
  toggleLayer(key: keyof LayerVisibility, value?: boolean): void
  patchSettings(patch: Partial<Settings>): void
  setFilter(patch: Partial<StoreState['filters']>): void
  toggleCategoryFilter(id: string): void
  setSort(sort: SortKey): void
  setView(view: Partial<MapViewState>): void
  setDraft(draft: Draft | null): void
  patchPending(patch: Partial<PendingDraw>): void
  pushDraftPoint(p: [number, number]): void
  popDraftPoint(): void
  setMeasurePoints(points: [number, number][]): void
  setRoutePoints(points: [number, number][]): void
  setRouteResult(result: RouteResult | null): void
  setRouteProfile(p: 'driving' | 'walking' | 'cycling'): void
  undo(): void
  redo(): void
  pushHistory(label: string): void
  setModal(modal: ModalId): void
  setBottomOpen(open: boolean): void
  toggleSplit(): void
  setYear(year: number | null): void
  toast(kind: Toast['kind'], text: string): void
  dismissToast(id: string): void
  setSaveState(s: StoreState['saveState']): void
  setSnapshots(list: Snapshot[]): void
  setSearchResults(list: SearchResult[]): void
  setSearchLoading(v: boolean): void
  setCursor(p: [number, number] | null): void
  requestFlyTo(center: [number, number], zoom?: number, extra?: { bearing?: number; pitch?: number }): void
  selectCategory(kind: ObjKind, category?: string): void
  clearAll(): void
}

export const defaultLayers: LayerVisibility = {
  basemap: true,
  buildings: true,
  osm3d: true,
  objects: true,
  labels: true,
  clusters: true,
  heatmap: false,
  grid: false,
  hillshade: false,
  terrain: true,
  shadows: true,
  buffers: true,
}

export const defaultSettings: Settings = {
  author: 'Вы',
  locale: 'ru',
  sound: true,
  labels: true,
  animateMarkers: true,
  shadows: true,
  sunDate: new Date().toISOString(),
  units: 'metric',
  showGrid: false,
  osmBuildings: true,
  autoSave: true,
  cluster: true,
}

export function createObject(
  partial: Partial<MapObject> & { geometry: MapObject['geometry'] },
  author = 'Вы',
): MapObject {
  const kind: ObjKind =
    partial.type ??
    (partial.geometry.type === 'Point'
      ? 'point'
      : partial.geometry.type === 'LineString'
        ? 'line'
        : 'polygon')
  const category = partial.category ?? (kind === 'building' ? 'building' : kind === 'fence' ? 'fence' : kind === 'line' ? 'trail' : 'poi')
  const cat = getCategory(category)
  const now = new Date().toISOString()
  return {
    id: partial.id ?? nanoid(10),
    type: kind,
    category,
    name: partial.name ?? '',
    description: partial.description ?? '',
    geometry: partial.geometry,
    properties: partial.properties ?? {},
    icon: partial.icon ?? cat.icon,
    color: partial.color ?? cat.color,
    tags: partial.tags ?? [],
    attachments: partial.attachments ?? [],
    height: partial.height,
    buildingLevels: partial.buildingLevels,
    roofType: partial.roofType,
    roofColor: partial.roofColor,
    wallColor: partial.wallColor,
    fenceType: partial.fenceType,
    fenceStyle: partial.fenceStyle,
    fenceOpacity: partial.fenceOpacity,
    pinned: partial.pinned ?? false,
    radius: partial.radius ?? 0,
    rating: partial.rating,
    comments: partial.comments ?? [],
    schedule: partial.schedule,
    customIcon: partial.customIcon,
    yearFrom: partial.yearFrom,
    yearTo: partial.yearTo,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
    author: partial.author ?? author,
  }
}

const HISTORY_LIMIT = 50

export const useStore = create<StoreState>((set, get) => ({
  objects: [],
  selectedId: null,
  hoverId: null,
  tool: 'select',
  mode: '2d',
  theme: 'dark',
  basemap: 'carto-dark',
  layers: defaultLayers,
  settings: defaultSettings,
  filters: { categories: [], tags: [], query: '', onlyPinned: false },
  sort: 'updated',
  view: { center: [37.6201, 55.7539], zoom: 15.2, pitch: 0, bearing: 0 },
  draft: null,
  pending: {
    category: 'poi',
    color: null,
    height: 12,
    buildingLevels: 3,
    fenceType: 'fence',
    fenceStyle: 'mesh',
    radius: 0,
    lineStyle: 'solid',
  },
  measure: { points: [], result: null },
  route: { points: [], result: null, profile: 'driving' },
  history: { past: [], future: [] },
  modal: null,
  bottomOpen: false,
  split: false,
  year: null,
  toasts: [],
  saveState: 'idle',
  snapshots: [],
  searchResults: [],
  searchLoading: false,
  cursor: null,
  flyTo: null,
  hydrated: false,

  hydrate: (objects, patch) =>
    set((s) => ({
      ...patch,
      objects,
      hydrated: true,
      theme: (patch?.theme as any) ?? s.theme,
    })),

  pushHistory: (label) =>
    set((s) => ({
      history: {
        past: [...s.history.past, { objects: s.objects, label }].slice(-HISTORY_LIMIT),
        future: [],
      },
    })),

  addObject: (partial, opts) => {
    const obj = createObject(partial, get().settings.author)
    if (!opts?.silent) get().pushHistory(`add:${obj.type}`)
    set((s) => ({
      objects: [...s.objects, obj],
      selectedId: obj.id,
      saveState: 'saving',
    }))
    return obj
  },

  addObjects: (list, label = 'import') => {
    if (!list.length) return
    get().pushHistory(label)
    set((s) => ({ objects: [...s.objects, ...list], saveState: 'saving' }))
  },

  updateObject: (id, patch, opts) => {
    if (!opts?.silent) get().pushHistory('edit')
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o,
      ),
      saveState: 'saving',
    }))
  },

  deleteObject: (id) => {
    get().pushHistory('delete')
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      saveState: 'saving',
    }))
  },

  deleteSelected: () => {
    const id = get().selectedId
    if (id) get().deleteObject(id)
  },

  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id)
    if (!src) return
    get().pushHistory('duplicate')
    const copy: MapObject = {
      ...structuredClone(src),
      id: nanoid(10),
      name: `${src.name} (копия)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    copy.geometry = shiftGeometry(src.geometry, 18)
    set((s) => ({ objects: [...s.objects, copy], selectedId: copy.id, saveState: 'saving' }))
  },

  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoverId: id }),

  setTool: (tool) => {
    const kindMap: Record<string, Draft['kind'] | undefined> = {
      point: 'point',
      buffer: 'point',
      line: 'line',
      polygon: 'polygon',
      building: 'building',
      fence: 'fence',
      'measure-distance': 'measure-distance',
      'measure-area': 'measure-area',
      route: 'route',
    }
    const kind = kindMap[tool]
    set((s) => {
      let pending = s.pending
      if (kind === 'point' || kind === 'line' || kind === 'polygon' || kind === 'building' || kind === 'fence') {
        const valid = CATEGORIES.filter((c) => c.kind === kind).map((c) => c.id)
        const fallback: Record<string, string> = {
          point: 'poi',
          line: 'trail',
          polygon: 'nature',
          building: 'building',
          fence: 'fence',
        }
        const category = valid.includes(pending.category) ? pending.category : fallback[kind]
        // keep the height meaningful per tool: fences are 2 m, buildings ~12 m
        const height =
          kind === 'fence'
            ? pending.height > 8 || pending.height < 0.5
              ? 2
              : pending.height
            : kind === 'building'
              ? pending.height < 4
                ? 12
                : pending.height
              : pending.height
        pending = { ...pending, category, height }
      }
      return {
        tool,
        pending,
        draft: kind ? { kind, coords: [], hover: null } : null,
        measure: { points: [], result: null },
      }
    })
  },

  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((s) => ({ mode: s.mode === '2d' ? '3d' : '2d' })),

  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme
    set((s) => {
      const swap =
        s.basemap === 'carto-dark' || s.basemap === 'carto-light'
          ? theme === 'dark'
            ? 'carto-dark'
            : 'carto-light'
          : s.basemap
      return { theme, basemap: swap }
    })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  setBasemap: (basemap) => set({ basemap }),
  toggleLayer: (key, value) =>
    set((s) => ({ layers: { ...s.layers, [key]: value ?? !s.layers[key] } })),
  patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  setFilter: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleCategoryFilter: (id) =>
    set((s) => {
      const has = s.filters.categories.includes(id)
      return {
        filters: {
          ...s.filters,
          categories: has ? s.filters.categories.filter((c) => c !== id) : [...s.filters.categories, id],
        },
      }
    }),
  setSort: (sort) => set({ sort }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),

  setDraft: (draft) => set({ draft }),
  patchPending: (patch) => set((s) => ({ pending: { ...s.pending, ...patch } })),
  pushDraftPoint: (p) =>
    set((s) => {
      if (!s.draft) return {}
      return { draft: { ...s.draft, coords: [...s.draft.coords, p] } }
    }),
  popDraftPoint: () =>
    set((s) => (s.draft ? { draft: { ...s.draft, coords: s.draft.coords.slice(0, -1) } } : {})),

  setMeasurePoints: (points) => {
    const segments: number[] = []
    for (let i = 1; i < points.length; i++) segments.push(haversine(points[i - 1], points[i]))
    const distance = points.length > 1 ? pathLength(points) : 0
    let areaM2 = 0
    if (points.length > 2) {
      areaM2 = geometryArea({
        type: 'Polygon',
        coordinates: [[...points, points[0]]],
      })
    }
    set({ measure: { points, result: { distance, area: areaM2, segments } } })
  },

  setRoutePoints: (points) =>
    set((s) => ({ route: { ...s.route, points, result: points.length > 1 ? s.route.result : null } })),
  setRouteResult: (result) => set((s) => ({ route: { ...s.route, result } })),
  setRouteProfile: (profile) => set((s) => ({ route: { ...s.route, profile, result: null } })),

  undo: () =>
    set((s) => {
      const entry = s.history.past[s.history.past.length - 1]
      if (!entry) return {}
      return {
        objects: entry.objects,
        history: {
          past: s.history.past.slice(0, -1),
          future: [{ objects: s.objects, label: entry.label }, ...s.history.future].slice(0, HISTORY_LIMIT),
        },
        saveState: 'saving',
      }
    }),

  redo: () =>
    set((s) => {
      const entry = s.history.future[0]
      if (!entry) return {}
      return {
        objects: entry.objects,
        history: {
          past: [...s.history.past, { objects: s.objects, label: entry.label }],
          future: s.history.future.slice(1),
        },
        saveState: 'saving',
      }
    }),

  setModal: (modal) => set({ modal }),
  setBottomOpen: (bottomOpen) => set({ bottomOpen }),
  toggleSplit: () => set((s) => ({ split: !s.split })),
  setYear: (year) => set({ year }),

  toast: (kind, text) => {
    const id = nanoid(6)
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }].slice(-4) }))
    const sound = get().settings.sound
    if (sound) playTone(kind)
    setTimeout(() => get().dismissToast(id), 3200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setSaveState: (saveState) => set({ saveState }),
  setSnapshots: (snapshots) => set({ snapshots }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearchLoading: (searchLoading) => set({ searchLoading }),
  setCursor: (cursor) => set({ cursor }),

  requestFlyTo: (center, zoom, extra) =>
    set({ flyTo: { center, zoom, bearing: extra?.bearing, pitch: extra?.pitch, ts: Date.now() } }),

  selectCategory: (kind) => {
    const tool: ToolId =
      kind === 'building' ? 'building' : kind === 'fence' ? 'fence' : kind
    get().setTool(tool)
  },

  clearAll: () => {
    get().pushHistory('clear')
    set({ objects: [], selectedId: null, saveState: 'saving' })
  },
}))

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function shiftGeometry(g: MapObject['geometry'], meters: number): MapObject['geometry'] {
  const dLat = meters / 111320
  const map = (c: number[]) => [c[0] + dLat * 1.4, c[1] - dLat]
  const walk = (arr: any): any => (typeof arr[0] === 'number' ? map(arr) : arr.map(walk))
  return { ...g, coordinates: walk((g as any).coordinates) } as MapObject['geometry']
}

let audioCtx: AudioContext | null = null
function playTone(kind: Toast['kind']) {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const freq = kind === 'error' ? 220 : kind === 'warn' ? 440 : kind === 'ok' ? 784 : 620
    osc.type = kind === 'error' ? 'sawtooth' : 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {
    /* audio not available */
  }
}

/* ---- selectors ---- */

export function visibleObjects(state: StoreState): MapObject[] {
  const { objects, filters, year } = state
  const q = filters.query.trim().toLowerCase()
  return objects
    .filter((o) => {
      if (filters.categories.length && !filters.categories.includes(o.category)) return false
      if (filters.onlyPinned && !o.pinned) return false
      if (filters.tags.length && !filters.tags.every((t) => o.tags.includes(t))) return false
      if (year != null) {
        const from = o.yearFrom ?? 0
        const to = o.yearTo ?? 9999
        if (year < from || year > to) return false
      }
      if (q) {
        const hay = `${o.name} ${o.description} ${o.category} ${o.tags.join(' ')} ${Object.keys(o.properties).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      switch (state.sort) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'category':
          return a.category.localeCompare(b.category)
        case 'size':
          return (geometryArea(b.geometry) || geometryLength(b.geometry)) - (geometryArea(a.geometry) || geometryLength(a.geometry))
        case 'created':
          return b.createdAt.localeCompare(a.createdAt)
        default:
          return b.updatedAt.localeCompare(a.updatedAt)
      }
    })
}

export function objectStats(objects: MapObject[]) {
  const byCategory: Record<string, number> = {}
  let length = 0
  let area = 0
  let buildings = 0
  let fences = 0
  let maxHeight = 0
  for (const o of objects) {
    byCategory[o.category] = (byCategory[o.category] ?? 0) + 1
    length += geometryLength(o.geometry)
    area += geometryArea(o.geometry)
    if (o.type === 'building') buildings++
    if (o.type === 'fence') fences++
    maxHeight = Math.max(maxHeight, o.height ?? 0)
  }
  return { total: objects.length, byCategory, length, area, buildings, fences, maxHeight }
}

export type { StoreState }
export type FenceStyleType = FenceStyle
export type FenceTypeT = FenceType
export type RoofTypeT = RoofType
