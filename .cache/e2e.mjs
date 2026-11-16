const enc = new TextEncoder();
const varint = (n) => { const o = []; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
const key = (f, wt) => varint((f << 3) | wt);
const bytes = (f, b) => [...key(f, 2), ...varint(b.length), ...b];
const str = (f, s) => bytes(f, [...enc.encode(s)]);
const uint = (f, n) => [...key(f, 0), ...varint(n)];
const zz = (n) => (n << 1) ^ (n >> 31);
// Build a line geometry from tile-space points (absolute, first moveTo then lineTo deltas).
function lineGeom(pts) {
  const g = [(1 & 7) | (1 << 3), zz(pts[0][0]), zz(pts[0][1]), (2 & 7) | ((pts.length - 1) << 3)];
  for (let i = 1; i < pts.length; i++) g.push(zz(pts[i][0] - pts[i - 1][0]), zz(pts[i][1] - pts[i - 1][1]));
  return g.flatMap((v) => varint(v));
}
function feature(tags, pts) {
  return [...uint(3, 2), ...bytes(2, tags.flatMap((t) => varint(t))), ...bytes(4, lineGeom(pts))];
}
function mvt(features) {
  const layer = [...uint(15, 2), ...str(1, 'transportation'), ...features.map((f) => bytes(2, f.bytes)).flat(),
    ...str(3, 'class'), ...str(3, 'subclass'), ...str(3, 'oneway'),
    ...bytes(4, str(1, 'primary')), ...bytes(4, str(1, 'footway')), ...bytes(4, str(1, 'path')), ...bytes(4, uint(5, 1)), ...bytes(4, uint(5, 0)),
    ...uint(5, 4096)];
  return new Uint8Array(bytes(3, layer));
}
const Z = 14;
const lngX = (lng) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const latY = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z); };
const A = [37.6, 55.4]; const B = [37.62, 55.41];
const TX = lngX(A[0]), TY = latY(A[1]);
// Road: primary across the tile (west->east at y=2000, then north-south at x=3000), footway diagonal at x=1000
const road = feature([0, 0, 2, 4], [[100, 2000], [1000, 2000], [3900, 2000], [3900, 100]]);
const trail = feature([0, 2, 1, 1], [[1000, 2000], [1000, 3900]]);
const tileBytes = mvt([{ bytes: road }, { bytes: trail }]);
// Second tile: connect east of primary (x=3900,y=100) to the north via the next tile row? Keep single tile.
globalThis.self = globalThis;
const replies = [];
globalThis.postMessage = (m) => replies.push(m);
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('tiles.openfreemap.org')) return new Response(JSON.stringify({ tiles: ['https://t.example/{z}/{x}/{y}.pbf'] }), { status: 200 });
  const m = u.match(/\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
  const [, z, x, y] = m.map(Number);
  if (x === TX && y === TY && z === Z) return new Response(tileBytes, { status: 200 });
  return new Response(new Uint8Array(0), { status: 200 });
};
await import('./worker-node.mjs');
const send = (req) => new Promise((resolve) => { const n = replies.length; globalThis.self.onmessage({ data: req }); const t = setInterval(() => { if (replies.length > n) { clearInterval(t); resolve(replies[replies.length - 1]); } }, 5); });
// Route inside the tile: from west part of primary road to the north-south leg via footway
const px = (p) => { const s = 2 ** Z; const gx = (p[0] + 180) / 360 * s; const r = p[1] * Math.PI / 180; const gy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s; return [ (gx - TX) * 4096, (gy - TY) * 4096 ]; };
const tileToLng = (tx, ty) => [(((TX + tx / 4096) / 2 ** Z) * 360) - 180, ((180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * ((TY + ty / 4096) / 2 ** Z)))))];
const pA = tileToLng(300, 2000), pB = tileToLng(3500, 2000), pC = tileToLng(1000, 3000);
const src = { kind: 'online', tilejsonUrl: 'https://tiles.openfreemap.org/planet' };
let r1 = await send({ type: 'route', id: 1, from: pA, to: pB, profile: 'car', source: src, user: [] });
console.log('car A->B', r1.ok, r1.ok ? `${r1.result.distance.toFixed(0)} m, ${r1.result.duration.toFixed(0)} s, pts ${r1.result.coords.length}` : r1.error);
let r2 = await send({ type: 'route', id: 2, from: pA, to: pC, profile: 'car', source: src, user: [] });
console.log('car A->C (footway only)', r2.ok, r2.ok ? 'found' : r2.error);
let r3 = await send({ type: 'route', id: 3, from: pA, to: pC, profile: 'foot', source: src, user: [] });
console.log('foot A->C', r3.ok, r3.ok ? `${r3.result.distance.toFixed(0)} m` : r3.error);
let r4 = await send({ type: 'route', id: 4, from: pA, to: pB, profile: 'bike', source: src, user: [] });
console.log('bike A->B', r4.ok, r4.ok ? `${r4.result.distance.toFixed(0)} m` : r4.error);
let r5 = await send({ type: 'route', id: 5, from: pA, to: [37.9, 55.9], profile: 'foot', source: src, user: [] });
console.log('far destination', r5.ok, r5.ok ? 'found' : r5.error.slice(0, 90));
