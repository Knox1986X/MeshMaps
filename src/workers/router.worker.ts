/// <reference lib="webworker" />
import { PMTiles } from 'pmtiles';
import { LocalFileSource } from '../storage/pmtilesLocal';
import { planRoute } from '../core/routing/graph';
import type { Profile, RouteResult, RoadLine, UserLineInput } from '../core/routing/types';
import { decodeRoadTile, ROUTE_ZOOM, tileRange } from './tiles';

export type TileSourceSpec =
  | { kind: 'archive'; file: File; key: string }
  | { kind: 'online'; tilejsonUrl: string };

export interface RouteRequest {
  type: 'route';
  id: number;
  from: [number, number];
  to: [number, number];
  profile: Profile;
  source: TileSourceSpec;
  user: UserLineInput[];
}

export type RouteReply =
  | { id: number; ok: true; result: RouteResult }
  | { id: number; ok: false; error: string };

/** Hard limit that keeps one request bounded in memory and time. */
const MAX_TILES = 1200;
const CACHE_LIMIT = 900;
const CONCURRENCY = 12;

const archives = new Map<string, PMTiles>();
const onlineTemplates = new Map<string, string>();
/** Parsed road lines per tile; insertion order is used as LRU. */
const tileCache = new Map<string, RoadLine[]>();

function remember(key: string, lines: RoadLine[]): void {
  tileCache.delete(key);
  tileCache.set(key, lines);
  if (tileCache.size > CACHE_LIMIT) {
    const oldest = tileCache.keys().next().value;
    if (oldest !== undefined) tileCache.delete(oldest);
  }
}

function archiveFor(spec: Extract<TileSourceSpec, { kind: 'archive' }>): PMTiles {
  let pm = archives.get(spec.key);
  if (!pm) {
    pm = new PMTiles(new LocalFileSource(spec.file, spec.key));
    archives.set(spec.key, pm);
  }
  return pm;
}

async function onlineTemplate(url: string): Promise<string> {
  const cached = onlineTemplates.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Сервер карт недоступен (HTTP ${res.status})`);
  const json = (await res.json()) as { tiles?: string[] };
  const template = json.tiles?.[0];
  if (!template) throw new Error('Сервер карт вернул неверное описание тайлов');
  onlineTemplates.set(url, template);
  return template;
}

async function loadTiles(
  spec: TileSourceSpec,
  xs: number[],
  ys: number[],
  z: number,
): Promise<RoadLine[]> {
  const jobs: [number, number][] = [];
  for (const y of ys) for (const x of xs) jobs.push([x, y]);
  const out: RoadLine[] = [];
  let next = 0;
  const sourceKey = spec.kind === 'archive' ? spec.key : spec.tilejsonUrl;
  const template = spec.kind === 'online' ? await onlineTemplate(spec.tilejsonUrl) : null;
  const pm = spec.kind === 'archive' ? archiveFor(spec) : null;

  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const [x, y] = jobs[next++];
      const cacheKey = `${sourceKey}/${z}/${x}/${y}`;
      let lines = tileCache.get(cacheKey);
      if (!lines) {
        let data: ArrayBuffer | Uint8Array | null = null;
        if (pm) {
          const tile = await pm.getZxy(z, x, y);
          data = tile ? tile.data : null;
        } else if (template) {
          const res = await fetch(template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
          if (!res.ok) throw new Error(`Тайл недоступен (HTTP ${res.status})`);
          data = await res.arrayBuffer();
        }
        lines = data ? decodeRoadTile(data, x, y, z) : [];
        remember(cacheKey, lines);
      }
      for (const l of lines) out.push(l);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return out;
}

function userLines(input: UserLineInput[]): RoadLine[] {
  return input.map((u) => ({
    coords: u.coords,
    cls: '',
    sub: '',
    oneway: 0,
    access: {},
    user: { lineType: u.lineType, passability: u.passability },
  }));
}

async function handleRoute(req: RouteRequest): Promise<RouteResult> {
  const [fx, fy] = req.from;
  const [tx, ty] = req.to;
  const span = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));
  const margin = Math.max(0.01, span * 0.3);
  const w = Math.min(fx, tx) - margin;
  const e = Math.max(fx, tx) + margin;
  const s = Math.min(fy, ty) - margin;
  const n = Math.max(fy, ty) + margin;

  let z = ROUTE_ZOOM;
  if (req.source.kind === 'archive') {
    const header = await archiveFor(req.source).getHeader();
    z = Math.min(ROUTE_ZOOM, header.maxZoom);
  }
  const r = tileRange(w, s, e, n, z);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = r.x0; x <= r.x1; x++) xs.push(x);
  for (let y = r.y0; y <= r.y1; y++) ys.push(y);
  if (xs.length * ys.length > MAX_TILES) {
    throw new Error('Маршрут слишком длинный для одного расчёта. Попробуйте более короткий участок.');
  }

  const lines = await loadTiles(req.source, xs, ys, z);
  lines.push(...userLines(req.user));
  const plan = planRoute(lines, req.from, req.to, req.profile);
  return {
    coords: plan.coords,
    distance: plan.distance,
    duration: plan.duration,
    profile: req.profile,
    from: req.from,
    to: req.to,
  };
}

self.onmessage = (ev: MessageEvent<RouteRequest>) => {
  const req = ev.data;
  handleRoute(req)
    .then((result) => {
      const reply: RouteReply = { id: req.id, ok: true, result };
      self.postMessage(reply);
    })
    .catch((err: unknown) => {
      const reply: RouteReply = {
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : 'Не удалось построить маршрут',
      };
      self.postMessage(reply);
    });
};
