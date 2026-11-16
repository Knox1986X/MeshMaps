export type FeatureKind = 'line' | 'polygon' | 'poi';
export type LineType = 'trail' | 'gravel' | 'road';
export type Passability = 'foot' | 'bike' | 'car';
export type DrawMode = 'idle' | 'line' | 'polygon' | 'poi' | 'edit' | 'record';

export const LINE_TYPE_RU: Record<LineType, string> = {
  trail: 'Тропа',
  gravel: 'Грунтовка',
  road: 'Дорога',
};

export const PASSABILITY_RU: Record<Passability, string> = {
  foot: 'Пешком',
  bike: 'Вело',
  car: 'Авто',
};

export const LAYER_COLORS = ['#38bdf8', '#a855f7', '#34d399', '#f472b6', '#facc15', '#fb923c'];
