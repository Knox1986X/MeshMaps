import type { MapObject } from '@/types'
import { createObject } from '@/store/useStore'

const ring = (c: [number, number], dx: number, dy: number, n = 6): [number, number][] => {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const k = 1 + Math.sin(t * 3) * 0.12
    pts.push([c[0] + Math.cos(t) * dx * k, c[1] + Math.sin(t) * dy * k])
  }
  return pts
}

const poly = (c: [number, number], dx: number, dy: number, n = 5) => {
  const r = ring(c, dx, dy, n)
  return { type: 'Polygon' as const, coordinates: [[...r, r[0]]] }
}

/** Small, meaningful demo scene so the first visit is not an empty map. */
export function seedObjects(): MapObject[] {
  const C: [number, number] = [37.6229, 55.7528]
  const mk = (o: Parameters<typeof createObject>[0]) => createObject(o, 'MeshMaps')

  const park = mk({
    type: 'polygon',
    category: 'nature',
    name: 'Парк «Зарядье»',
    description: 'Демо-полигон территории: дорожки, газоны, амфитеатр.',
    geometry: poly([C[0] - 0.0016, C[1] + 0.0005], 0.0021, 0.0013, 8),
    properties: { тип: 'парк', доступ: 'свободный', площадь_га: 10.2 },
    tags: ['демо', 'парк'],
    radius: 0,
  })

  const trail = mk({
    type: 'line',
    category: 'trail',
    name: 'Набережная — тропа',
    description: 'Пешеходный маршрут вдоль реки, грунтово-настилочное покрытие.',
    geometry: {
      type: 'LineString',
      coordinates: [
        [C[0] - 0.0034, C[1] - 0.0013],
        [C[0] - 0.0018, C[1] - 0.0006],
        [C[0] - 0.0002, C[1] - 0.0011],
        [C[0] + 0.0014, C[1] - 0.0005],
        [C[0] + 0.0031, C[1] - 0.0012],
      ],
    },
    properties: { покрытие: 'грунт', ширина: 2.4, стиль: 'dashed' },
    tags: ['демо', 'тропа'],
  })

  const road = mk({
    type: 'line',
    category: 'road',
    name: 'Москворецкая наб.',
    description: 'Асфальт, 2 полосы.',
    geometry: {
      type: 'LineString',
      coordinates: [
        [C[0] - 0.0038, C[1] + 0.0019],
        [C[0] - 0.0012, C[1] + 0.0022],
        [C[0] + 0.0016, C[1] + 0.0021],
        [C[0] + 0.0038, C[1] + 0.0017],
      ],
    },
    properties: { покрытие: 'асфальт', полос: 2, стиль: 'solid' },
    tags: ['демо', 'дорога'],
  })

  const b1 = mk({
    type: 'building',
    category: 'building',
    name: 'Корпус А · 6 этажей',
    geometry: poly([C[0] - 0.0009, C[1] + 0.0011], 0.00042, 0.00026, 4),
    height: 21,
    buildingLevels: 6,
    roofType: 'flat',
    wallColor: '#5b6f92',
    properties: { материал: 'монолит', этажей: 6, назначение: 'офисы' },
    tags: ['демо', 'здание'],
  })

  const b2 = mk({
    type: 'building',
    category: 'public',
    name: 'Павильон «Купол»',
    geometry: poly([C[0] + 0.0004, C[1] - 0.0003], 0.0005, 0.00034, 7),
    height: 12,
    buildingLevels: 2,
    roofType: 'gabled',
    wallColor: '#4d7f6f',
    properties: { материал: 'стекло/дерево', вместимость: 180 },
    tags: ['демо', 'павильон'],
  })

  const b3 = mk({
    type: 'building',
    category: 'school',
    name: 'Школа № 000 (демо)',
    geometry: poly([C[0] + 0.0021, C[1] + 0.0012], 0.00055, 0.0003, 4),
    height: 16.5,
    buildingLevels: 4,
    roofType: 'hipped',
    wallColor: '#8a7396',
    properties: { этажей: 4, учеников: 620 },
    tags: ['демо', 'школа'],
  })

  const fence = mk({
    type: 'fence',
    category: 'fence',
    name: 'Охраняемая территория корпуса А',
    description: 'Сетка-рабица по периметру, высота 2.2 м.',
    geometry: poly([C[0] - 0.0009, C[1] + 0.0011], 0.00072, 0.00046, 4),
    height: 2.2,
    fenceType: 'guarded',
    fenceStyle: 'mesh',
    color: '#22c55e',
    fenceOpacity: 0.95,
    properties: { высота: 2.2, тип: 'сетка' },
    tags: ['демо', 'охрана'],
  })

  const fence2 = mk({
    type: 'fence',
    category: 'fence',
    name: 'Стройплощадка',
    description: 'Временное ограждение, зона ограниченного доступа.',
    geometry: poly([C[0] + 0.0016, C[1] - 0.0011], 0.0005, 0.00034, 4),
    height: 1.8,
    fenceType: 'construction',
    fenceStyle: 'picket',
    color: '#eab308',
    properties: { срок: '2026' },
    tags: ['демо', 'стройка'],
  })

  const poi = (name: string, cat: string, icon: string, color: string, dx: number, dy: number, extra: Record<string, string | number> = {}) =>
    mk({
      type: 'point',
      category: cat,
      name,
      geometry: { type: 'Point', coordinates: [C[0] + dx, C[1] + dy] },
      icon,
      color,
      properties: extra,
      tags: ['демо'],
      radius: 0,
    })

  return [
    park,
    trail,
    road,
    b1,
    b2,
    b3,
    fence,
    fence2,
    poi('Кофейня «Купол»', 'cafe', 'cafe', '#f97316', -0.0004, -0.0009, { часы: '08:00–22:00', мест: 40 }),
    poi('Банкомат', 'atm', 'atm', '#10b981', 0.0002, 0.0006, { банк: 'Демо-банк' }),
    poi('Смотровая площадка', 'monument', 'star', '#c084fc', 0.0032, 0.0002, { высота: 12 }),
    poi('Скамейка у воды', 'bench', 'bench', '#a16207', -0.0021, -0.0016),
    poi('Камера наблюдения', 'camera', 'camera', '#94a3b8', 0.0011, 0.0019, { зона: 'вход' }),
    poi('Заметка: проверить доступ', 'note', 'note', '#facc15', -0.0012, 0.0016, { текст: 'Уточнить границы участка' }),
  ]
}
