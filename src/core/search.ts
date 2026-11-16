export type HitKind = 'user' | 'place' | 'poi' | 'street' | 'coords';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  lng: number;
  lat: number;
  kind: HitKind;
}

/** Lower-case, ё → е, collapsed spaces: the form used for all matching. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Parses "lat, lng" (either order is not guessed: first is latitude). Returns [lng, lat] or null. */
export function parseCoords(query: string): [number, number] | null {
  const m = query.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lng = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

/** 3 = equal, 2 = starts with the query, 1 = a word starts with the query, 0 = no match. */
export function matchScore(name: string, query: string): number {
  const n = normalizeName(name);
  const q = normalizeName(query);
  if (!q || !n) return 0;
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.split(' ').some((w) => w.startsWith(q)) || n.includes(` ${q}`)) return 1;
  return 0;
}

/** Approximate distance in metres (equirectangular; fine at city scale). */
function metresBetween(a: SearchHit, b: SearchHit): number {
  const kx = 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 110574);
}

/** Keeps the best hits, merges duplicates (same name within 30 m) and sorts by relevance. */
export function rankHits(scored: { hit: SearchHit; score: number }[], limit = 30): SearchHit[] {
  scored.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title, 'ru'));
  const out: SearchHit[] = [];
  for (const { hit } of scored) {
    const dup = out.some(
      (k) => normalizeName(k.title) === normalizeName(hit.title) && metresBetween(k, hit) < 30,
    );
    if (dup) continue;
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
