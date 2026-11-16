import { decodeRoadTile } from './worker-dec.mjs';
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

const L=decodeRoadTile(tileBytes,TX,TY,Z); console.log(L.map(l=>({cls:l.cls,sub:l.sub,ow:l.oneway,n:l.coords.length})));
