/**
 * Offline map packs: "установить область / город" and open the map without network.
 *
 * What is stored (IndexedDB, Dexie table `tiles`):
 *   • OpenFreeMap vector tiles (`.pbf`) for the chosen bbox + zoom range — keyless, ODbL,
 *     the provider explicitly allows heavy/normal app usage (unlike tile.openstreetmap.org,
 *     whose policy forbids bulk downloads);
 *   • glyph ranges, so labels keep working without network.
 *
 * Tiles are served to MapLibre through the `mmoffline://` protocol (see protocol.ts), which
 * reads the pack first and falls back to the network for everything not downloaded.
 */

export type PackKind = 'city' | 'region' | 'custom'

export interface PackDef {
  id: string
  label: string
  subtitle?: string
  kind: PackKind
  bbox: [number, number, number, number] // west, south, east, north
  minZoom: number
  maxZoom: number
}

const cityBox = (lon: number, lat: number): [number, number, number, number] => [
  Number((lon - 0.15).toFixed(4)),
  Number((lat - 0.1).toFixed(4)),
  Number((lon + 0.15).toFixed(4)),
  Number((lat + 0.1).toFixed(4)),
]

const city = (id: string, label: string, lon: number, lat: number): PackDef => ({
  id,
  label,
  kind: 'city',
  bbox: cityBox(lon, lat),
  minZoom: 11,
  maxZoom: 14,
})

export const CITIES: PackDef[] = [
  city('city-kurgan', 'Курган', 65.3411, 55.4408),
  city('city-moscow', 'Москва', 37.6173, 55.7558),
  city('city-spb', 'Санкт-Петербург', 30.3351, 59.9343),
  city('city-ekb', 'Екатеринбург', 60.5975, 56.8389),
  city('city-tyumen', 'Тюмень', 65.5412, 57.1522),
  city('city-chelyabinsk', 'Челябинск', 61.4024, 55.1644),
  city('city-omsk', 'Омск', 73.3682, 54.9893),
  city('city-nsk', 'Новосибирск', 82.9346, 55.0084),
  city('city-kazan', 'Казань', 49.1064, 55.7963),
  city('city-nn', 'Нижний Новгород', 44.002, 56.3269),
  city('city-samara', 'Самара', 50.1002, 53.1959),
  city('city-rostov', 'Ростов-на-Дону', 39.7015, 47.2357),
  city('city-krasnodar', 'Краснодар', 38.9769, 45.0355),
  city('city-sochi', 'Сочи', 39.7303, 43.5855),
  city('city-perm', 'Пермь', 56.2463, 58.0105),
  city('city-ufa', 'Уфа', 55.9721, 54.7388),
  city('city-voronezh', 'Воронеж', 39.2003, 51.672),
  city('city-volgograd', 'Волгоград', 44.5133, 48.708),
  city('city-saratov', 'Саратов', 46.0343, 51.5336),
  city('city-tomsk', 'Томск', 84.9744, 56.4846),
  city('city-barnaul', 'Барнаул', 83.7698, 53.3548),
  city('city-krasnoyarsk', 'Красноярск', 92.8672, 56.0106),
  city('city-irkutsk', 'Иркутск', 104.2964, 52.2871),
  city('city-vladivostok', 'Владивосток', 131.8855, 43.1155),
  city('city-khabarovsk', 'Хабаровск', 135.0719, 48.4827),
]

const region = (
  id: string,
  label: string,
  bbox: [number, number, number, number],
  maxZoom = 10,
): PackDef => ({ id, label, kind: 'region', bbox, minZoom: 7, maxZoom })

export const REGIONS: PackDef[] = [
  region('reg-kurgan', 'Курганская область', [61.0, 54.0, 68.6, 56.9]),
  region('reg-sverdlovsk', 'Свердловская область', [57.2, 56.0, 66.2, 61.9]),
  region('reg-tyumen', 'Тюменская область', [64.5, 55.2, 74.0, 59.1]),
  region('reg-chelyabinsk', 'Челябинская область', [57.1, 52.0, 63.0, 56.4]),
  region('reg-omsk', 'Омская область', [70.5, 53.4, 76.0, 57.5]),
  region('reg-nsk', 'Новосибирская область', [75.1, 53.2, 85.0, 57.3]),
  region('reg-moscow', 'Московская область', [35.4, 54.6, 39.6, 56.9]),
  region('reg-leningrad', 'Ленинградская область', [27.0, 58.4, 35.0, 61.3]),
  region('reg-tatarstan', 'Республика Татарстан', [45.5, 53.9, 54.3, 56.7]),
  region('reg-krasnodar', 'Краснодарский край', [36.5, 43.3, 42.2, 46.9], 9),
  region('reg-primorsky', 'Приморский край', [130.5, 42.2, 139.1, 46.6], 9),
  region('reg-voronezh', 'Воронежская область', [38.2, 49.5, 42.3, 52.1]),
  region('reg-samara', 'Самарская область', [47.0, 51.5, 52.7, 54.5]),
  region('reg-bashkortostan', 'Республика Башкортостан', [53.1, 51.3, 60.0, 56.6]),
  region('reg-perm', 'Пермский край', [51.4, 56.0, 59.4, 61.6]),
  region('reg-krasnoyarsk', 'Красноярский край (центр)', [88.0, 54.0, 96.5, 58.5], 9),
]

export const ALL_PACKS: PackDef[] = [...CITIES, ...REGIONS]

/** Pack for the current viewport ("скачать то, что видно"). */
export function customPack(bbox: [number, number, number, number], zoom: number): PackDef {
  const maxZoom = Math.max(11, Math.min(15, Math.round(zoom)))
  return {
    id: `custom-${bbox.map((v) => v.toFixed(2)).join('-')}`,
    label: `Текущий вид · z${maxZoom}`,
    subtitle: `${bbox[0].toFixed(2)}, ${bbox[1].toFixed(2)} → ${bbox[2].toFixed(2)}, ${bbox[3].toFixed(2)}`,
    kind: 'custom',
    bbox,
    minZoom: Math.max(6, maxZoom - 6),
    maxZoom,
  }
}

/* ------------------------------------------------------------------ */
/* tile maths                                                          */
/* ------------------------------------------------------------------ */

export interface TileId {
  z: number
  x: number
  y: number
}

const lonToX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
const latToY = (lat: number, z: number) => {
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

export function tilesForBBox(bbox: [number, number, number, number], minZoom: number, maxZoom: number): TileId[] {
  const [w, s, e, n] = bbox
  const out: TileId[] = []
  for (let z = minZoom; z <= maxZoom; z++) {
    const max = 2 ** z - 1
    const x0 = Math.max(0, Math.min(max, lonToX(w, z)))
    const x1 = Math.max(0, Math.min(max, lonToX(e, z)))
    const y0 = Math.max(0, Math.min(max, latToY(n, z)))
    const y1 = Math.max(0, Math.min(max, latToY(s, z)))
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) out.push({ z, x, y })
    }
  }
  return out
}

/** Rough download size: a vector tile of a city/region averages ~26 KB. */
export const AVG_TILE_BYTES = 26_000

export function estimateBytes(def: PackDef): number {
  const count = tilesForBBox(def.bbox, def.minZoom, def.maxZoom).length
  return count * AVG_TILE_BYTES
}

export function estimateTiles(def: PackDef): number {
  return tilesForBBox(def.bbox, def.minZoom, def.maxZoom).length
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`
}
