export const POI_CLASS_RU: Record<string, string> = {
  shop: 'Магазин',
  clothing_store: 'Одежда',
  clothes: 'Одежда',
  supermarket: 'Супермаркет',
  convenience: 'Продукты',
  mall: 'ТЦ',
  department_store: 'Универмаг',
  hardware: 'Строительный магазин',
  food: 'Еда',
  restaurant: 'Ресторан',
  fast_food: 'Фастфуд',
  bar: 'Бар',
  pub: 'Паб',
  cafe: 'Кафе',
  bank: 'Банк',
  atm: 'Банкомат',
  pharmacy: 'Аптека',
  chemist: 'Аптека',
  hospital: 'Больница',
  clinic: 'Клиника',
  doctors: 'Врач',
  fuel: 'АЗС',
  bus_stop: 'Остановка',
  bus: 'Автобус',
  rail: 'Ж/д станция',
  railway: 'Ж/д станция',
  subway: 'Метро',
};

export const ROAD_CLASS_RU: Record<string, string> = {
  motorway: 'Автомагистраль',
  trunk: 'Магистраль',
  primary: 'Главная дорога',
  secondary: 'Второстепенная',
  tertiary: 'Третьестепенная',
  minor: 'Жилая улица',
  service: 'Служебная',
  residential: 'Жилая улица',
  track: 'Грунтовка',
  path: 'Тропа',
  pedestrian: 'Пешеходная',
  rail: 'Железная дорога',
};

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function floorsFromHeight(heightM: number): number {
  return Math.max(1, Math.round(heightM / 3));
}

export function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
