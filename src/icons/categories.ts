import type { CategoryDef, PropertyValue } from '@/types'

export const PALETTE = [
  '#4f8cff',
  '#38bdf8',
  '#22c55e',
  '#a3e635',
  '#fbbf24',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#8b5cf6',
  '#14b8a6',
  '#64748b',
] as const

/** 9 core categories from the reference sheet + extended set. */
export const CATEGORIES: CategoryDef[] = [
  // ---- core 9 ----
  { id: 'building', labelRu: 'Здание / дом', labelEn: 'Building / house', icon: 'house', color: '#4f8cff', kind: 'building' },
  { id: 'shop', labelRu: 'Магазин / торговля', labelEn: 'Shop / retail', icon: 'shop', color: '#fbbf24', kind: 'point' },
  { id: 'road', labelRu: 'Дорога / парковка', labelEn: 'Road / parking', icon: 'road', color: '#64748b', kind: 'line' },
  { id: 'trail', labelRu: 'Тропа / маршрут', labelEn: 'Trail / route', icon: 'trail', color: '#f97316', kind: 'line' },
  { id: 'nature', labelRu: 'Природа / парк', labelEn: 'Nature / park', icon: 'nature', color: '#22c55e', kind: 'polygon' },
  { id: 'fence', labelRu: 'Ограда / территория', labelEn: 'Fence / territory', icon: 'fence', color: '#a855f7', kind: 'fence' },
  { id: 'poi', labelRu: 'Точка интереса', labelEn: 'Point of interest', icon: 'poi', color: '#38bdf8', kind: 'point' },
  { id: 'hazard', labelRu: 'Опасность / вышка', labelEn: 'Hazard / tower', icon: 'hazard', color: '#ef4444', kind: 'point' },
  { id: 'public', labelRu: 'Общественный объект', labelEn: 'Public building', icon: 'public', color: '#14b8a6', kind: 'building' },
  // ---- extended ----
  { id: 'cafe', labelRu: 'Кафе / ресторан', labelEn: 'Cafe / restaurant', icon: 'cafe', color: '#f97316', kind: 'point' },
  { id: 'water', labelRu: 'Вода / озеро', labelEn: 'Water / lake', icon: 'water', color: '#0ea5e9', kind: 'polygon' },
  { id: 'forest', labelRu: 'Лес / роща', labelEn: 'Forest', icon: 'tree', color: '#16a34a', kind: 'polygon' },
  { id: 'school', labelRu: 'Школа / вуз', labelEn: 'School', icon: 'school', color: '#8b5cf6', kind: 'building' },
  { id: 'hospital', labelRu: 'Больница / медпункт', labelEn: 'Hospital', icon: 'cross', color: '#f43f5e', kind: 'building' },
  { id: 'church', labelRu: 'Церковь / храм', labelEn: 'Church', icon: 'church', color: '#e2b04a', kind: 'building' },
  { id: 'bench', labelRu: 'Скамейка / МАФ', labelEn: 'Bench / street furniture', icon: 'bench', color: '#a16207', kind: 'point' },
  { id: 'lamp', labelRu: 'Фонарь / освещение', labelEn: 'Street lamp', icon: 'lamp', color: '#facc15', kind: 'point' },
  { id: 'camera', labelRu: 'Камера / наблюдение', labelEn: 'Camera', icon: 'camera', color: '#94a3b8', kind: 'point' },
  { id: 'trash', labelRu: 'Урна / контейнер', labelEn: 'Bin', icon: 'trash', color: '#6b7280', kind: 'point' },
  { id: 'atm', labelRu: 'Банкомат / банк', labelEn: 'ATM', icon: 'atm', color: '#10b981', kind: 'point' },
  { id: 'parking', labelRu: 'Парковка', labelEn: 'Parking', icon: 'parking', color: '#3b82f6', kind: 'polygon' },
  { id: 'powerline', labelRu: 'ЛЭП / трубопровод', labelEn: 'Power line / pipe', icon: 'antenna', color: '#f59e0b', kind: 'line' },
  { id: 'construction', labelRu: 'Стройплощадка', labelEn: 'Construction site', icon: 'crane', color: '#eab308', kind: 'polygon' },
  { id: 'monument', labelRu: 'Достопримечательность', labelEn: 'Landmark', icon: 'star', color: '#c084fc', kind: 'point' },
  { id: 'note', labelRu: 'Заметка на карте', labelEn: 'Sticky note', icon: 'note', color: '#facc15', kind: 'point' },
  { id: 'route', labelRu: 'Маршрут', labelEn: 'Route', icon: 'trail', color: '#4f8cff', kind: 'line' },
]

export const CATEGORY_MAP: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
)

export function getCategory(id: string): CategoryDef {
  return CATEGORY_MAP[id] ?? CATEGORIES[6]
}

export function categoriesFor(kind: 'point' | 'line' | 'polygon' | 'building' | 'fence'): CategoryDef[] {
  if (kind === 'fence') return CATEGORIES.filter((c) => c.kind === 'fence' || c.id === 'construction')
  return CATEGORIES.filter((c) => c.kind === kind)
}

export const FENCE_TYPES = [
  { id: 'fence', labelRu: 'Забор', labelEn: 'Fence', color: '#a855f7', icon: 'fence', desc: 'Штакетник / сетка по периметру' },
  { id: 'guarded', labelRu: 'Охраняемая территория', labelEn: 'Guarded area', color: '#22c55e', icon: 'shield', desc: 'Пульсирующая граница, значок охраны' },
  { id: 'restricted', labelRu: 'Запретная зона', labelEn: 'Restricted zone', color: '#ef4444', icon: 'hazard', desc: 'Красный штрихованный периметр' },
  { id: 'construction', labelRu: 'Строительная площадка', labelEn: 'Construction', color: '#eab308', icon: 'crane', desc: 'Жёлтый пунктир, значок стройки' },
] as const

export const FENCE_STYLES = [
  { id: 'picket', labelRu: 'Штакетник', labelEn: 'Picket' },
  { id: 'mesh', labelRu: 'Сетка-рабица', labelEn: 'Mesh' },
  { id: 'barbed', labelRu: 'Колючая проволока', labelEn: 'Barbed' },
  { id: 'concrete', labelRu: 'Бетонный', labelEn: 'Concrete' },
  { id: 'hedge', labelRu: 'Живая изгородь', labelEn: 'Hedge' },
] as const

export const ROOF_TYPES = [
  { id: 'flat', labelRu: 'Плоская', labelEn: 'Flat' },
  { id: 'gabled', labelRu: 'Скатная', labelEn: 'Gabled' },
  { id: 'mansard', labelRu: 'Мансардная', labelEn: 'Mansard' },
  { id: 'hipped', labelRu: 'Вальмовая', labelEn: 'Hipped' },
] as const

export type ObjectTemplate = {
  id: string
  labelRu: string
  labelEn: string
  type: 'point' | 'line' | 'polygon' | 'building' | 'fence'
  category: string
  properties: Record<string, PropertyValue>
  height?: number
  buildingLevels?: number
  roofType?: 'flat' | 'gabled' | 'mansard' | 'hipped'
}

/** Ready-made presets (idea 72). */
export const TEMPLATES: ObjectTemplate[] = [
  {
    id: 't-house',
    labelRu: 'Дом · 3 этажа · кирпич',
    labelEn: 'House · 3 floors · brick',
    type: 'building',
    category: 'building',
    height: 9.5,
    buildingLevels: 3,
    roofType: 'gabled',
    properties: { материал: 'кирпич', этажей: 3 },
  },
  {
    id: 't-shop24',
    labelRu: 'Магазин · 24/7',
    labelEn: 'Shop · 24/7',
    type: 'point',
    category: 'shop',
    properties: { часы: '24/7', тип: 'продукты' },
  },
  {
    id: 't-trail',
    labelRu: 'Тропа · грунтовая',
    labelEn: 'Trail · ground',
    type: 'line',
    category: 'trail',
    properties: { покрытие: 'грунт', ширина: 1.5 },
  },
  {
    id: 't-asphalt',
    labelRu: 'Дорога · асфальт',
    labelEn: 'Road · asphalt',
    type: 'line',
    category: 'road',
    properties: { покрытие: 'асфальт', полос: 2 },
  },
  {
    id: 't-park',
    labelRu: 'Парк',
    labelEn: 'Park',
    type: 'polygon',
    category: 'nature',
    properties: { тип: 'парк', доступ: 'свободный' },
  },
  {
    id: 't-fence3',
    labelRu: 'Забор · 2 м · сетка',
    labelEn: 'Fence · 2 m · mesh',
    type: 'fence',
    category: 'fence',
    height: 2,
    properties: { высота: 2 },
  },
]
