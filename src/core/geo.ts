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

export type LngLat = [number, number];

/** Great-circle distance in metres. */
export function haversine(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLength(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

/** Area of a polygon ring in m² (equirectangular projection around its centroid). */
export function ringArea(ring: LngLat[]): number {
  if (ring.length < 4) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 6371008.8 * Math.cos(lat0) * (Math.PI / 180);
  const ky = 6371008.8 * (Math.PI / 180);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * kx;
    const y1 = ring[i][1] * ky;
    const x2 = ring[i + 1][0] * kx;
    const y2 = ring[i + 1][1] * ky;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} км` : `${Math.round(m)} м`;
}
