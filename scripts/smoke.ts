/**
 * Node smoke test for the pure data layer (no DOM / WebGL required).
 *   npm run smoke
 */
import { seedObjects } from '../src/db/seed'
import {
  fencePanels,
  formatArea,
  formatCoords,
  formatDistance,
  gpxFromObjects,
  haversine,
  objectsToFeatures,
  objectsToGeoJSON,
  parseCoordinateInput,
  sunPosition,
  circlePolygon,
  ringArea,
  bufferOf,
} from '../src/utils/geo'
import { draftToObject } from '../src/drawing'
import { buildShareUrl, parseShareHash } from '../src/utils/share'
import { createObject, objectStats, useStore, visibleObjects } from '../src/store/useStore'
import { getCategory, CATEGORIES } from '../src/icons/categories'
import { iconSvg } from '../src/icons'
import { BASEMAPS, attributionFor, buildStyle, isVectorBasemap, sampleTileUrl } from '../src/map/styles'
import { vectorLayers, vectorSources } from '../src/map/vectorStyle'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import type { MapObject } from '../src/types'

// minimal globals used lazily by the store / share helpers
;(globalThis as any).location = { origin: 'https://meshmaps.app', pathname: '/' }
;(globalThis as any).document = {
  documentElement: { dataset: {} as Record<string, string> },
}

let failures = 0
let checks = 0

function ok(cond: unknown, label: string, extra?: unknown) {
  checks++
  if (!cond) {
    failures++
    console.error(`✗ ${label}`, extra ?? '')
  } else {
    console.log(`✓ ${label}`)
  }
}

/* ------------------------------------------------------------------ */
/* seed + model                                                        */
/* ------------------------------------------------------------------ */

const seeded = seedObjects()
ok(seeded.length >= 12, `seed создаёт ${seeded.length} объектов`)
ok(seeded.every((o) => o.id && o.createdAt && o.type), 'у всех объектов есть id/createdAt/type')
ok(seeded.filter((o) => o.type === 'building').length === 3, 'в сиде 3 здания')
ok(seeded.filter((o) => o.type === 'fence').length === 2, 'в сиде 2 ограждения')

const stats = objectStats(seeded)
ok(stats.total === seeded.length, 'objectStats.total совпадает')
ok(stats.area > 0 && stats.length > 0, 'статистика считает площадь и длину')
ok(stats.maxHeight >= 20, 'максимальная высота здания найдена')

/* ------------------------------------------------------------------ */
/* categories & icons                                                  */
/* ------------------------------------------------------------------ */

ok(CATEGORIES.length >= 20, `категорий: ${CATEGORIES.length} (нужно 9+)`)
const core = ['building', 'shop', 'road', 'trail', 'nature', 'fence', 'poi', 'hazard', 'public']
ok(core.every((c) => CATEGORIES.some((x) => x.id === c)), '9 базовых категорий присутствуют')
ok(getCategory('unknown-cat').id === 'poi', 'неизвестная категория → fallback')
const svg = iconSvg('house', { color: '#4f8cff' })
ok(svg.startsWith('<svg') && svg.includes('stroke'), 'iconSvg генерирует двухслойную иконку')
ok(iconSvg('nonexistent', { color: '#fff' }).includes('<circle'), 'неизвестный глиф → точка')
// reference sheet (page 09): rounded plate + double hexagon keyline + glyph
ok((svg.match(/<path d="M24 /g) ?? []).length >= 2, 'иконка содержит двойной шестиугольник из референса')
ok(svg.includes('stroke-opacity=".92"'), 'внешний контур гексагона виден')
ok((svg.match(/<g transform="translate\(12.6 12.4\) scale\(\.91\)"/g) ?? []).length === 2, 'глиф: подложка-обводка + белый контур')

/* ------------------------------------------------------------------ */
/* basemaps (must stay keyless — the APK broke on CARTO "API KEY REQUIRED") */
/* ------------------------------------------------------------------ */

const darkStyle = buildStyle('carto-dark', 'dark')
const allStyles = (['carto-dark', 'carto-light', 'osm', 'satellite', 'topo', 'blank'] as const).map((id) =>
  JSON.stringify(buildStyle(id, id === 'carto-light' ? 'light' : 'dark')),
)
ok(
  !allStyles.some((j) => /cartocdn|basemaps\.carto|api\.mapbox|stadiamaps|maptiler|thunderforest/i.test(j)),
  'в стилях нет провайдеров, требующих API-ключ',
)
ok(isVectorBasemap('carto-dark') && isVectorBasemap('carto-light'), 'тёмная/светлая — векторные (OpenFreeMap)')
ok(darkStyle.layers.filter((l) => l.type === 'raster').length === 0, 'в тёмной подложке нет растровых слоёв')
ok(darkStyle.layers[0].id === 'basemap', 'фоновый слой сохраняет id `basemap` (нужен мини-карте)')
ok((darkStyle.sources.openmaptiles as { url?: string }).url === 'https://tiles.openfreemap.org/planet', 'векторный источник задан через TileJSON (не привязан к версии тайлов)')
ok(Object.keys(vectorSources()).includes('openmaptiles'), 'источник openmaptiles объявлен')
ok(vectorLayers('dark').length >= 10, `слоёв векторной подложки: ${vectorLayers('dark').length}`)
ok(vectorLayers('dark').some((l) => l.type === 'fill' && l['source-layer'] === 'water'), 'есть вода')
ok(vectorLayers('dark').some((l) => l.type === 'fill' && l['source-layer'] === 'building'), 'есть здания')
ok(vectorLayers('light')[0].type === 'background' && JSON.stringify(vectorLayers('light')) !== JSON.stringify(vectorLayers('dark')), 'светлая палитра отличается')
ok(Object.keys(BASEMAPS).length === 6, `подложек: ${Object.keys(BASEMAPS).length}`)
const tileUrl = sampleTileUrl('osm', [37.6201, 55.7539], 15.2)
ok(!!tileUrl && /\/\d+\/\d+\/\d+\.png$/.test(tileUrl), 'URL-проба тайла подставляет z/x/y')
ok(sampleTileUrl('carto-dark', [37.6201, 55.7539], 15) === null, 'для векторной подложки проба идёт через TileJSON')
ok(sampleTileUrl('blank', [37.6201, 55.7539], 15) === null, 'для «только разметка» пробы нет')
ok(attributionFor('carto-dark').includes('OpenFreeMap'), 'атрибуция векторной подложки')
const styleIds = ['carto-dark', 'carto-light', 'osm', 'satellite', 'topo', 'blank'] as const
const invalid = styleIds
  .map((id) => [id, validateStyleMin(buildStyle(id, 'dark') as never)] as const)
  .filter(([, errors]) => errors.length > 0)
ok(invalid.length === 0, 'все стили проходят валидатор maplibre-gl-style-spec', invalid.map(([id, e]) => `${id}: ${e[0]?.message}`))

/* ------------------------------------------------------------------ */
/* drawing                                                             */
/* ------------------------------------------------------------------ */

const line = draftToObject(
  { kind: 'line', coords: [[37.6, 55.75], [37.61, 55.76]], hover: null },
  { category: 'trail' },
)
ok(line?.type === 'line' && line.geometry.type === 'LineString', 'draft → линия')

const poly = draftToObject(
  { kind: 'polygon', coords: [[37.6, 55.75], [37.61, 55.75], [37.61, 55.76]], hover: null },
  { category: 'nature' },
)
ok(poly?.type === 'polygon' && poly.geometry.type === 'Polygon', 'draft → полигон замкнут')

const building = draftToObject(
  { kind: 'building', coords: [[37.6, 55.75], [37.61, 55.75], [37.61, 55.76]], hover: null },
  { height: 24, buildingLevels: 8 },
)
ok(building?.height === 24 && building.buildingLevels === 8, 'здание получает высоту и этажи')

ok(draftToObject({ kind: 'line', coords: [[37.6, 55.75]], hover: null }) === null, 'линия из 1 точки отклонена')
ok(draftToObject({ kind: 'polygon', coords: [[37.6, 55.75], [37.6, 55.76]], hover: null }) === null, 'полигон из 2 точек отклонён')

const fenceDraft = draftToObject(
  { kind: 'fence', coords: [[37.6, 55.75], [37.601, 55.75], [37.601, 55.751], [37.6, 55.751]], hover: null },
  { fenceType: 'restricted', fenceStyle: 'barbed', height: 3 },
)
ok(fenceDraft?.fenceType === 'restricted' && fenceDraft.fenceStyle === 'barbed', 'ограждение получает тип и материал')

/* ------------------------------------------------------------------ */
/* geometry & rendering data                                           */
/* ------------------------------------------------------------------ */

const d = haversine([37.6, 55.75], [37.61, 55.75])
ok(d > 600 && d < 700, `haversine ~${Math.round(d)} м на 0.01°`)

const ring = circlePolygon([37.6, 55.75], 100)
ok(ring.length === 73, 'круг радиусом 100 м — 72 сегмента + замыкание')
ok(Math.abs(ringArea(ring) - Math.PI * 100 * 100) / (Math.PI * 10000) < 0.02, 'площадь круга ≈ πr²')

const objWithBuffer: MapObject = { ...seeded[0], radius: 250 }
ok(bufferOf(objWithBuffer) !== null, 'буфер объекта строится')
ok(bufferOf(seeded[0]) === null, 'без радиуса буфера нет')

const geo = objectsToFeatures(seeded, { selectedId: seeded[0].id })
ok(geo.points.features.length === 6, `точек в GeoJSON-наборе: ${geo.points.features.length}`)
ok(geo.buildings.features.length === 3, 'здания попадают в свой слой')
ok(geo.lines.features.length === 2, 'линии попадают в свой слой')
ok(geo.labels.features.length > 0, 'подписи генерируются')
const anyPoint = geo.points.features[0].properties as Record<string, unknown>
ok(typeof anyPoint.iconKey === 'string' && String(anyPoint.iconKey).startsWith('mm-'), 'у точек есть ключ иконки')

const panels = fencePanels(seeded[6])
ok(panels.features.length > 10, `3D-панели забора: ${panels.features.length} шт.`)
const panelProps = panels.features[0].properties as Record<string, unknown>
ok(panelProps.height === 2.2 && typeof panelProps.color === 'string', 'панели имеют высоту и цвет')
ok(panels.features.every((f) => f.geometry.type === 'Polygon'), 'каждая панель — полигон для экструзии')

const hay = fencePanels({ ...seeded[6], fenceStyle: 'hedge' })
const meshThickness = haversine(
  panels.features[0].geometry.coordinates[0][0],
  panels.features[0].geometry.coordinates[0][3],
)
const hedgeThickness = haversine(
  hay.features[0].geometry.coordinates[0][0],
  hay.features[0].geometry.coordinates[0][3],
)
ok(hedgeThickness > meshThickness * 3, `толщина панелей зависит от материала (${meshThickness.toFixed(2)} м vs ${hedgeThickness.toFixed(2)} м)`)

/* ------------------------------------------------------------------ */
/* export                                                              */
/* ------------------------------------------------------------------ */

const fc = objectsToGeoJSON(seeded)
ok(fc.features.length === seeded.length, 'GeoJSON содержит все объекты')
ok(fc.features.every((f) => f.properties && f.geometry), 'у фич есть свойства и геометрия')

const gpx = gpxFromObjects(seeded)
ok(gpx.includes('<wpt') && gpx.includes('<trk'), 'GPX содержит точки и треки')
ok((gpx.match(/<wpt/g) ?? []).length === 6, 'в GPX 6 waypoint-ов')

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

ok(formatDistance(850) === '850 м', 'formatDistance < 1 км')
ok(formatDistance(2400).includes('км'), 'formatDistance > 1 км')
ok(formatArea(25000).includes('га'), 'formatArea показывает гектары')
ok(formatCoords(37.62, 55.75).startsWith('55.75'), 'formatCoords: широта первая')
ok(parseCoordinateInput('55.75, 37.62')?.[0] === 37.62, 'координаты «широта, долгота»')
ok(parseCoordinateInput('55.75 37.62')?.[0] === 37.62, 'координаты через пробел')
ok(parseCoordinateInput('37.62, 55.75')?.[1] === 37.62, 'долгота первая тоже распознаётся')
ok(parseCoordinateInput('нет координат') === null, 'мусор не парсится')

const sun = sunPosition(new Date('2026-06-21T09:00:00Z'), 55.75, 37.62)
ok(sun.azimuth >= 0 && sun.azimuth <= 360 && Math.abs(sun.altitude) < 90, `солнце: az ${sun.azimuth.toFixed(0)}°, alt ${sun.altitude.toFixed(0)}°`)

/* ------------------------------------------------------------------ */
/* share link                                                          */
/* ------------------------------------------------------------------ */

const url = buildShareUrl({
  view: { center: [37.6, 55.75], zoom: 15.5, pitch: 55, bearing: -20 },
  mode: '3d',
  theme: 'dark',
  basemap: 'carto-dark',
  selectedId: 'abc',
})
const parsed = parseShareHash(url.split('#')[1])
ok(parsed.mode === '3d' && parsed.basemap === 'carto-dark', 'share-ссылка кодирует режим и подложку')
ok(Math.abs((parsed.view?.center?.[0] ?? 0) - 37.6) < 0.01, 'share-ссылка кодирует центр')
ok(parsed.selectedId === 'abc', 'share-ссылка кодирует выбранный объект')

/* ------------------------------------------------------------------ */
/* store                                                               */
/* ------------------------------------------------------------------ */

const store = useStore.getState()
store.hydrate(seeded, {})
ok(useStore.getState().objects.length === seeded.length, 'hydrate наполняет store')

const added = useStore.getState().addObject({
  type: 'point',
  category: 'cafe',
  geometry: { type: 'Point', coordinates: [37.6, 55.75] },
})
ok(useStore.getState().objects.length === seeded.length + 1, 'addObject добавляет объект')
ok(useStore.getState().selectedId === added.id, 'новый объект выделяется')

useStore.getState().updateObject(added.id, { name: 'Тестовая точка' })
ok(useStore.getState().objects.find((o) => o.id === added.id)?.name === 'Тестовая точка', 'updateObject меняет имя')

useStore.getState().undo()
ok(useStore.getState().objects.find((o) => o.id === added.id)?.name === '', 'undo откатывает изменение')
useStore.getState().undo()
ok(useStore.getState().objects.length === seeded.length, 'undo откатывает добавление')
useStore.getState().redo()
ok(useStore.getState().objects.length === seeded.length + 1, 'redo возвращает объект')

const filtered = visibleObjects({ ...useStore.getState(), filters: { categories: ['building', 'public', 'school'], tags: [], query: '', onlyPinned: false } })
ok(filtered.length === 3, 'фильтр по нескольким категориям работает')
const searched = visibleObjects({ ...useStore.getState(), filters: { categories: [], tags: [], query: 'кофейня', onlyPinned: false } })
ok(searched.length === 1, 'поиск по имени работает')

// tool switching normalises the pending category / height
useStore.getState().setTool('line')
ok(useStore.getState().pending.category === 'trail', 'инструмент «линия» ставит категорию trail')
useStore.getState().setTool('fence')
ok(useStore.getState().pending.category === 'fence', 'инструмент «ограждение» ставит категорию fence')
ok(useStore.getState().pending.height === 2, 'высота забора по умолчанию 2 м')
useStore.getState().setTool('building')
ok(useStore.getState().pending.height === 12, 'высота здания по умолчанию 12 м')

const tpl = createObject({ type: 'building', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } })
ok(tpl.type === 'building' && tpl.color.length === 7, 'createObject проставляет цвет и тип')

/* ------------------------------------------------------------------ */

console.log(`\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} проверок пройдено`)
if (failures) process.exit(1)
