import type { BboxDraft } from './store';

/** [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number];

export function normalizeBbox(a: [number, number], b: [number, number]): Bbox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

export function draftRect(d: BboxDraft | null): Bbox | null {
  if (!d) return null;
  if (d.a && d.b) return normalizeBbox(d.a, d.b);
  if (d.a) return normalizeBbox(d.a, d.a);
  return null;
}

export function formatBbox(b: Bbox): string {
  return `${b[0].toFixed(3)}, ${b[1].toFixed(3)} → ${b[2].toFixed(3)}, ${b[3].toFixed(3)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} МБ`;
  return `${(n / 1024 ** 3).toFixed(2)} ГБ`;
}
