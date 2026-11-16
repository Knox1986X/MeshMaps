import { decodeRoadTile, tileRange } from './tiles.ts';
const enc = new TextEncoder();
function varint(n: number): number[] { const o: number[] = []; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return o; }
const key = (f: number, wt: number) => varint((f << 3) | wt);
const bytes = (f: number, b: number[]) => [...key(f, 2), ...varint(b.length), ...b];
const str = (f: number, s: string) => bytes(f, [...enc.encode(s)]);
const zz = (n: number) => (n << 1) ^ (n >> 31);
const uint = (f: number, n: number) => [...key(f, 0), ...varint(n)];
function feature(tags: number[], geom: number[]): number[] {
  return [...bytes(2, tags.flatMap((t) => varint(t))).length ? [] : [], ...uint(3, 2), ...bytes(2, tags.flatMap((t) => varint(t))), ...bytes(4, geom.flatMap((g) => varint(g)))];
}
// Line in tile coords: moveTo(100,200) lineTo(+200,0)
const geom = [(1 & 7) | (1 << 3), zz(100), zz(200), (2 & 7) | (1 << 3), zz(200), zz(0)];
const feat = [...uint(3, 2), ...bytes(2, [...varint(0), ...varint(0), ...varint(1), ...varint(1)]), ...bytes(4, geom.flatMap((g) => varint(g)))];
const feat2 = [...uint(3, 2), ...bytes(2, [...varint(0), ...varint(2)]), ...bytes(4, geom.flatMap((g) => varint(g)))];
const values = [...str(1, 'primary'), ...uint(5, 1), ...str(1, 'footway')];
const layer = [...uint(15, 2), ...str(1, 'transportation'), ...bytes(2, feat), ...bytes(2, feat2), ...str(3, 'class'), ...str(3, 'oneway'), ...bytes(4, [...str(1, 'primary')]), ...bytes(4, uint(5, 1)), ...bytes(4, str(1, 'footway')), ...uint(5, 4096)];
const tile = new Uint8Array(bytes(3, layer));
const X = 9800, Y = 5000, Z = 14;
const lines = decodeRoadTile(tile, X, Y, Z);
console.log(JSON.stringify(lines.map((l) => ({ cls: l.cls, ow: l.oneway, n: l.coords.length, c: l.coords.map((c) => c.map((v) => +v.toFixed(6))) }))));
const expLng0 = (X + 100 / 4096) / 2 ** Z * 360 - 180;
console.log('expected first lng', expLng0.toFixed(6), 'got', lines[0]?.coords[0][0].toFixed(6));
console.log('range', JSON.stringify(tileRange(37.5, 55.3, 37.7, 55.5, 14)));
