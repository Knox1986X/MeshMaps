import type { Profile, RoadLine } from './types';
import { PROFILE_INDEX } from './types';

type LngLat = [number, number];

const EARTH_R = 6371008.8;

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat): number {
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Speeds in km/h as [foot, bike, car]; 0 means the way is not usable by that profile. */
const OSM_SPEED: Record<string, [number, number, number]> = {
  motorway: [0, 0, 100],
  trunk: [0, 0, 80],
  primary: [4.5, 18, 60],
  secondary: [4.5, 18, 50],
  tertiary: [4.5, 18, 40],
  minor: [4.5, 16, 30],
  service: [4.5, 14, 20],
  track: [4.5, 12, 15],
  path: [4.5, 10, 0],
  pedestrian: [4.5, 8, 0],
  construction: [4.5, 8, 10],
  busway: [0, 0, 0],
  raceway: [0, 0, 0],
  rail: [0, 0, 0],
  ferry: [0, 0, 0],
};
const OSM_DEFAULT_SPEED: [number, number, number] = [4.5, 12, 20];

const USER_SPEED: Record<'trail' | 'gravel' | 'road', [number, number, number]> = {
  trail: [4.5, 10, 12],
  gravel: [4.5, 14, 25],
  road: [4.5, 18, 40],
};

/** Upper bound of each profile's speed (km/h); used for the A* heuristic to stay admissible. */
export const MAX_KMH: Record<Profile, number> = { foot: 4.5, bike: 18, car: 100 };

const ACCESS_KEY: Record<Profile, string> = { foot: 'foot', bike: 'bicycle', car: 'motor_vehicle' };

/** Speeds in m/s per profile for an undirected line (oneway is applied later per direction). */
function baseSpeeds(line: RoadLine): [number, number, number] {
  let kmh: [number, number, number];
  if (line.user) {
    kmh = [...USER_SPEED[line.user.lineType]] as [number, number, number];
    // A user line is usable only by profiles up to its passability level.
    const rank = PROFILE_INDEX[line.user.passability];
    for (let p = 0; p < 3; p++) if (p > rank) kmh[p] = 0;
  } else {
    kmh = [...(OSM_SPEED[line.cls] ?? OSM_DEFAULT_SPEED)] as [number, number, number];
    if (line.sub === 'steps') kmh[1] = 0;
    const profiles: Profile[] = ['foot', 'bike', 'car'];
    profiles.forEach((prof, p) => {
      const v = line.access[ACCESS_KEY[prof]] ?? line.access.generic;
      if (v === 'no' || v === 'private') kmh[p] = 0;
    });
  }
  return [kmh[0] / 3.6, kmh[1] / 3.6, kmh[2] / 3.6];
}

const CELL = 0.002; // degrees, about 130–220 m
const MAX_RING = 12;
/** Larger gaps mean the point is not on the network; routing it would add a silent walk. */
export const MAX_SNAP_M = 120;

/** Directed road graph with per-profile speeds on every edge. */
export class RoadGraph {
  readonly lng: number[] = [];
  readonly lat: number[] = [];
  readonly adj: number[][] = [];
  readonly from: number[] = [];
  readonly to: number[] = [];
  readonly len: number[] = [];
  /** speed[p][edge] in m/s, 0 when the profile cannot use the edge. */
  readonly speed: [number[], number[], number[]] = [[], [], []];
  private readonly nodeIds = new Map<string, number>();
  private grid = new Map<number, number[]>();

  node(p: LngLat): number {
    const key = `${Math.round(p[0] * 1e7)}:${Math.round(p[1] * 1e7)}`;
    let id = this.nodeIds.get(key);
    if (id === undefined) {
      id = this.lng.length;
      this.lng.push(p[0]);
      this.lat.push(p[1]);
      this.adj.push([]);
      this.nodeIds.set(key, id);
    }
    return id;
  }

  addLine(line: RoadLine): void {
    const base = baseSpeeds(line);
    if (base.every((v) => v === 0)) return;
    for (let i = 1; i < line.coords.length; i++) {
      const a = line.coords[i - 1];
      const b = line.coords[i];
      const u = this.node(a);
      const v = this.node(b);
      if (u === v) continue;
      const len = distanceM(a, b);
      if (len < 0.05) continue;
      // Oneway applies to vehicles only; pedestrians may walk against it.
      const fwd = base.map((s, p) => (p === 0 || line.oneway !== -1 ? s : 0)) as [number, number, number];
      const bwd = base.map((s, p) => (p === 0 || line.oneway !== 1 ? s : 0)) as [number, number, number];
      if (fwd.some((s) => s > 0)) this.addEdge(u, v, len, fwd);
      if (bwd.some((s) => s > 0)) this.addEdge(v, u, len, bwd);
    }
  }

  private addEdge(u: number, v: number, len: number, sp: [number, number, number]): number {
    const e = this.from.length;
    this.from.push(u);
    this.to.push(v);
    this.len.push(len);
    for (let p = 0; p < 3; p++) this.speed[p].push(sp[p]);
    this.adj[u].push(e);
    this.indexEdge(e);
    return e;
  }

  private cellKey(ix: number, iy: number): number {
    return (ix + 200000) * 400000 + (iy + 200000);
  }

  /** Registers the edge in every grid cell along its geometry (sampled every half cell). */
  private indexEdge(e: number): void {
    const a = [this.lng[this.from[e]], this.lat[this.from[e]]];
    const b = [this.lng[this.to[e]], this.lat[this.to[e]]];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / (CELL / 2)));
    const seen = new Set<number>();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const ix = Math.floor((a[0] + (b[0] - a[0]) * t) / CELL);
      const iy = Math.floor((a[1] + (b[1] - a[1]) * t) / CELL);
      const k = this.cellKey(ix, iy);
      if (seen.has(k)) continue;
      seen.add(k);
      const list = this.grid.get(k);
      if (list) list.push(e);
      else this.grid.set(k, [e]);
    }
  }

  /**
   * Returns the node of the closest point on a road usable by the profile.
   * The road edge is split at the projected point, so the route really starts there.
   */
  snap(p: LngLat, profile: Profile): number {
    const pi = PROFILE_INDEX[profile];
    const cx = Math.floor(p[0] / CELL);
    const cy = Math.floor(p[1] / CELL);
    const cellW = CELL * 111320 * Math.cos((p[1] * Math.PI) / 180);
    const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
    const ky = 110574;
    let best = -1;
    let bestT = 0;
    let bestD = Infinity;
    for (let r = 0; r <= MAX_RING; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const list = this.grid.get(this.cellKey(cx + dx, cy + dy));
          if (!list) continue;
          for (const e of list) {
            if (this.speed[pi][e] <= 0) continue;
            const a = this.from[e];
            const b = this.to[e];
            const ax = (this.lng[a] - p[0]) * kx;
            const ay = (this.lat[a] - p[1]) * ky;
            const bx = (this.lng[b] - p[0]) * kx;
            const by = (this.lat[b] - p[1]) * ky;
            const vx = bx - ax;
            const vy = by - ay;
            const vv = vx * vx + vy * vy;
            const t = vv === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / vv));
            const px = ax + vx * t;
            const py = ay + vy * t;
            const d = Math.hypot(px, py);
            if (d < bestD) {
              bestD = d;
              best = e;
              bestT = t;
            }
          }
        }
      }
      if (best >= 0 && bestD <= r * cellW) break;
    }
    if (best < 0 || bestD > MAX_SNAP_M) {
      const d = best < 0 ? '—' : `${Math.round(bestD)} м`;
      throw new Error(
        `Точка не на дороге для выбранного профиля (до ближайшей подходящей дороги ${d}). Выберите точку ближе к дороге или тропе.`,
      );
    }
    return this.splitEdge(best, bestT);
  }

  /** Inserts a node at fraction t of edge e (and of its reverse, if present). */
  private splitEdge(e: number, t: number): number {
    const u = this.from[e];
    const v = this.to[e];
    if (t < 1e-4) return u;
    if (t > 1 - 1e-4) return v;
    const a: LngLat = [this.lng[u], this.lat[u]];
    const b: LngLat = [this.lng[v], this.lat[v]];
    const pt: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const s = this.lng.length;
    this.lng.push(pt[0]);
    this.lat.push(pt[1]);
    this.adj.push([]);
    const sp = [this.speed[0][e], this.speed[1][e], this.speed[2][e]] as [number, number, number];
    this.addEdge(u, s, distanceM(a, pt), sp);
    this.addEdge(s, v, distanceM(pt, b), sp);
    // The opposite direction of a two-way road is split too.
    // The split edges replace the original ones, so disable the originals to keep snapping unambiguous.
    this.disableEdge(e);
    for (const r of this.adj[v]) {
      if (this.to[r] !== u || this.speed.every((arr) => arr[r] <= 0)) continue;
      const rsp = [this.speed[0][r], this.speed[1][r], this.speed[2][r]] as [number, number, number];
      this.addEdge(v, s, distanceM(b, pt), rsp);
      this.addEdge(s, u, distanceM(pt, a), rsp);
      this.disableEdge(r);
      break;
    }
    return s;
  }

  private disableEdge(e: number): void {
    for (let p = 0; p < 3; p++) this.speed[p][e] = 0;
  }

  /** A* by travel time. Returns the edge list, or null when unreachable. */
  shortestPath(start: number, goal: number, profile: Profile): { edges: number[]; seconds: number } | null {
    const pi = PROFILE_INDEX[profile];
    const n = this.lng.length;
    const maxMps = MAX_KMH[profile] / 3.6;
    const gx = this.lng[goal];
    const gy = this.lat[goal];
    const heur = (node: number): number => distanceM([this.lng[node], this.lat[node]], [gx, gy]) / maxMps;

    const g = new Float64Array(n).fill(Infinity);
    const via = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    g[start] = 0;

    // Binary heap of [f, node] pairs with lazy deletion.
    const heapF: number[] = [];
    const heapN: number[] = [];
    const push = (f: number, node: number): void => {
      heapF.push(f);
      heapN.push(node);
      let i = heapF.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heapF[parent] <= heapF[i]) break;
        [heapF[parent], heapF[i]] = [heapF[i], heapF[parent]];
        [heapN[parent], heapN[i]] = [heapN[i], heapN[parent]];
        i = parent;
      }
    };
    const pop = (): number => {
      const top = heapN[0];
      const lastF = heapF.pop()!;
      const lastN = heapN.pop()!;
      if (heapF.length > 0) {
        heapF[0] = lastF;
        heapN[0] = lastN;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heapF.length && heapF[l] < heapF[m]) m = l;
          if (r < heapF.length && heapF[r] < heapF[m]) m = r;
          if (m === i) break;
          [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
          [heapN[m], heapN[i]] = [heapN[i], heapN[m]];
          i = m;
        }
      }
      return top;
    };

    push(heur(start), start);
    while (heapN.length > 0) {
      const node = pop();
      if (closed[node]) continue;
      closed[node] = 1;
      if (node === goal) break;
      for (const e of this.adj[node]) {
        const sp = this.speed[pi][e];
        if (sp <= 0) continue;
        const to = this.to[e];
        if (closed[to]) continue;
        const ng = g[node] + this.len[e] / sp;
        if (ng < g[to]) {
          g[to] = ng;
          via[to] = e;
          push(ng + heur(to), to);
        }
      }
    }
    if (!Number.isFinite(g[goal])) return null;
    const edges: number[] = [];
    for (let node = goal; node !== start; ) {
      const e = via[node];
      edges.push(e);
      node = this.from[e];
    }
    edges.reverse();
    return { edges, seconds: g[goal] };
  }
}

/** Builds the graph for the given lines, plans a route and returns its geometry and totals. */
export function planRoute(
  lines: RoadLine[],
  from: LngLat,
  to: LngLat,
  profile: Profile,
): { coords: LngLat[]; distance: number; duration: number } {
  const graph = new RoadGraph();
  for (const line of lines) graph.addLine(line);
  if (graph.lng.length === 0) {
    throw new Error('В этой области нет дорожных данных. Выберите регион, который покрывает маршрут.');
  }
  const a = graph.snap(from, profile);
  const b = graph.snap(to, profile);
  const coords: LngLat[] = [from];
  let distance = distanceM(from, [graph.lng[a], graph.lat[a]]);
  let duration = distance / (4.5 / 3.6);
  if (a !== b) {
    const path = graph.shortestPath(a, b, profile);
    if (!path) throw new Error('Маршрут не найден: точки не связаны дорогами в этой области.');
    duration += path.seconds;
    for (const e of path.edges) {
      distance += graph.len[e];
      const next: LngLat = [graph.lng[graph.to[e]], graph.lat[graph.to[e]]];
      const last = coords[coords.length - 1];
      if (last[0] !== next[0] || last[1] !== next[1]) coords.push(next);
    }
  }
  const tail = distanceM([graph.lng[b], graph.lat[b]], to);
  distance += tail;
  duration += tail / (4.5 / 3.6);
  coords.push(to);
  return { coords, distance, duration };
}
