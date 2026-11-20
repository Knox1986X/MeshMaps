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
import { describeBuilding, infoForBuilding, lightFor, pluralFloors } from '../src/map/realism'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import {
  CITIES,
  REGIONS,
  customPack,
  estimateBytes,
  estimateTiles,
  formatBytes,
  tilesForBBox,
} from '../src/offline/catalog'
import { parseFontUrl, parseTileUrl } from '../src/offline/url'
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
ok(
  Array.isArray((darkStyle.sources.openmaptiles as { tiles?: string[] }).tiles) &&
    (darkStyle.sources.openmaptiles as { tiles: string[] }).tiles[0].startsWith('mmoffline://'),
  'векторные тайлы идут через офлайн-протокол (кеш → сеть)',
)
ok(darkStyle.glyphs.startsWith('mmoffline://'), 'глифы тоже через офлайн-протокол')
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
/* offline packs                                                       */
/* ------------------------------------------------------------------ */

const kurgan = CITIES.find((c) => c.label === 'Курган')
const kurganRegion = REGIONS.find((r) => r.label === 'Курганская область')
ok(!!kurgan && kurgan.kind === 'city', 'в каталоге есть город Курган')
ok(!!kurganRegion && kurganRegion.kind === 'region', 'в каталоге есть Курганская область')
ok(CITIES.length >= 20 && REGIONS.length >= 10, `каталог: ${CITIES.length} городов, ${REGIONS.length} областей`)

const cityTiles = tilesForBBox(kurgan!.bbox, kurgan!.minZoom, kurgan!.maxZoom)
ok(cityTiles.length > 100 && cityTiles.length < 2000, `город ≈ ${cityTiles.length} тайлов (разумный объём)`)
ok(cityTiles.every((t) => t.x >= 0 && t.y >= 0 && t.z >= kurgan!.minZoom), 'тайлы в пределах сетки')
const regionTiles = estimateTiles(kurganRegion!)
ok(regionTiles > cityTiles.length, 'область требует больше тайлов, чем город')
ok(estimateBytes(kurgan!) > 0 && formatBytes(estimateBytes(kurgan!)).endsWith('МБ'), 'оценка размера в МБ')
ok(tilesForBBox([0, 0, 0, 0], 3, 3).length === 1, 'нулевой bbox → один тайл')
const custom = customPack([37.5, 55.6, 37.7, 55.8], 15.4)
ok(custom.kind === 'custom' && custom.maxZoom === 15 && custom.minZoom === 9, 'набор «текущий вид» строится от зума')

ok(parseTileUrl('mmoffline://omvt/15/19808/10306')?.z === 15, 'протокол разбирает URL тайла')
ok(parseTileUrl('mmoffline://omvt/15/19808/10306.pbf')?.x === 19808, 'расширение .pbf не мешает')
ok(parseTileUrl('mmoffline://omvt/bad/url') === null, 'битый URL тайла отклоняется')
ok(parseFontUrl('mmoffline://font/Open%20Sans%20Semibold/1024-1279')?.stack === 'Open Sans Semibold', 'протокол разбирает URL глифов')
ok(parseTileUrl('mmoffline://font/Open%20Sans%20Semibold/0-255') === null, 'шрифты и тайлы не путаются')

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

/* ---------------- реалистичная карта: высоты, этажи, свет ---------------- */

const realistic = vectorLayers('dark').find((l) => l.id === 'basemap-buildings-3d') as any
ok(!!realistic && realistic.type === 'fill-extrusion', '3D-здания — fill-extrusion')
ok(JSON.stringify(realistic.paint['fill-extrusion-height']).includes('render_height'), 'высота берётся из render_height (реальные метры OSM)')
ok(JSON.stringify(realistic.paint['fill-extrusion-base']).includes('render_min_height'), 'основание — render_min_height')
ok(realistic.paint['fill-extrusion-opacity'] === 1, 'стены непрозрачные (как настоящие дома)')
ok(realistic.paint['fill-extrusion-vertical-gradient'] === false, 'градиент выключен: свет даёт реальные тени граней')
ok(JSON.stringify(realistic.filter).includes('hide_3d'), 'скрытые 3D-части не выдавливаются')

const poi = vectorLayers('light').find((l) => l.id === 'basemap-pois')
const houses = vectorLayers('light').find((l) => l.id === 'basemap-housenumbers')
ok(!!poi && !!houses, 'есть POI и номера домов (как в 2ГИС)')
ok(!!poi && JSON.stringify(poi.layout).includes('name:ru'), 'POI подписаны по-русски')

const light = lightFor(225, 42, 'dark')
ok(light.anchor === 'map' && (light.position as number[])[1] === 225, 'солнце привязано к карте и к азимуту')
ok(JSON.stringify(lightFor(225, -5, 'dark')).includes('0.28'), 'ночью свет мягче')
ok(JSON.stringify(buildStyle('carto-dark', 'dark')).includes('"anchor":"map"'), 'свет задан в самом стиле')

ok(infoForBuilding({ render_height: 27 })!.floors === 9, '27 м ≈ 9 этажей')
ok(infoForBuilding({ height: 3.2 })!.floors === 1, 'низкое строение — 1 этаж')
ok(infoForBuilding({ 'building:levels': 5 })!.height === 15.75, 'этажи → метры, если высоты нет')
ok(infoForBuilding(null) === null, 'без данных дом не подписывается')
ok(pluralFloors(1) === 'этаж' && pluralFloors(3) === 'этажа' && pluralFloors(11) === 'этажей', 'склонение «этаж/этажа/этажей»')
ok(describeBuilding({ render_height: 30 })!.startsWith('Дом · ≈ 10 этажей'), 'подпись дома: этажи и метры')
ok(describeBuilding({ render_height: 30, name: 'Ратуша' })!.startsWith('Ратуша ·'), 'имя дома, если оно есть в тайлах')

/* ------------------------------------------------------------------ */

console.log(`\n${failures === 0 ? '✅' : '❌'} ${checks - failures}/${checks} проверок пройдено`)
if (failures) process.exit(1)
