// node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b2 = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b2[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b2[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j2 = b2[i2]; j2 < b2[i2 + 1]; ++j2) {
      r[j2] = j2 - b2[i2] << 5 | i2;
    }
  }
  return { b: b2, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v2 = le[cd[i2] - 1]++ << r_1;
        for (var m = v2 | (1 << r_1) - 1; v2 <= m; ++v2) {
          co[rev[v2] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d2, p, m) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d2, p) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8 | d2[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v2, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v2.length)
    e = v2.length;
  return new u8(v2.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b2 = fleb[i2];
          add = bits(dat, pos, (1 << b2) - 1) + fl[i2];
          pos += b2;
        }
        var d2 = dm[bits16(dat, pos) & dms], dsym = d2 >> 4;
        if (!d2)
          err(3);
        pos += d2 & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b2 = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b2) - 1, pos += b2;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var gzs = function(d2) {
  if (d2[0] != 31 || d2[1] != 139 || d2[2] != 8)
    err(6, "invalid gzip data");
  var flg = d2[3];
  var st = 10;
  if (flg & 4)
    st += (d2[10] | d2[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d2[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d2) {
  var l = d2.length;
  return (d2[l - 4] | d2[l - 3] << 8 | d2[l - 2] << 16 | d2[l - 1] << 24) >>> 0;
};
var zls = function(d2, dict) {
  if ((d2[0] & 15) != 8 || d2[0] >> 4 > 7 || (d2[0] << 8 | d2[1]) % 31)
    err(6, "invalid zlib data");
  if ((d2[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d2[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d2[1] >> 3 & 4) + 2;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function decompressSync(data, opts) {
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// node_modules/pmtiles/dist/esm/index.js
var j = Object.defineProperty;
var S = Math.pow;
var d = (o, t) => j(o, "name", { value: t, configurable: true });
var h = (o, t, e) => new Promise((r, n) => {
  var s = (c) => {
    try {
      a(e.next(c));
    } catch (l) {
      n(l);
    }
  }, i2 = (c) => {
    try {
      a(e.throw(c));
    } catch (l) {
      n(l);
    }
  }, a = (c) => c.done ? r(c.value) : Promise.resolve(c.value).then(s, i2);
  a((e = e.apply(o, t)).next());
});
var re = d((o, t) => {
  let e = false, r = "", n = L.GridLayer.extend({ createTile: d((s, i2) => {
    let a = document.createElement("img"), c = new AbortController(), l = c.signal;
    return a.cancel = () => {
      c.abort();
    }, e || (o.getHeader().then((u) => {
      u.tileType === 1 || u.tileType === 6 ? console.error("Error: archive contains vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details.") : u.tileType === 2 ? r = "image/png" : u.tileType === 3 ? r = "image/jpeg" : u.tileType === 4 ? r = "image/webp" : u.tileType === 5 && (r = "image/avif");
    }), e = true), o.getZxy(s.z, s.x, s.y, l).then((u) => {
      if (u) {
        let m = new Blob([u.data], { type: r }), g = window.URL.createObjectURL(m);
        a.src = g;
      } else a.style.display = "none";
      a.cancel = void 0, i2(void 0, a);
    }).catch((u) => {
      if (u.name !== "AbortError") throw u;
    }), a;
  }, "createTile"), _removeTile: d(function(s) {
    let i2 = this._tiles[s];
    i2 && (i2.el.cancel && i2.el.cancel(), i2.el.src && window.URL.revokeObjectURL(i2.el.src), i2.el.width = 0, i2.el.height = 0, i2.el.deleted = true, L.DomUtil.remove(i2.el), delete this._tiles[s], this.fire("tileunload", { tile: i2.el, coords: this._keyToTileCoords(s) }));
  }, "_removeTile") });
  return new n(t);
}, "leafletRasterLayer");
var z = d((o) => (t, e) => {
  if (e instanceof AbortController) return o(t, e);
  let r = new AbortController();
  return o(t, r).then((n) => e(void 0, n.data, n.cacheControl || "", n.expires || ""), (n) => e(n)).catch((n) => e(n)), { cancel: d(() => r.abort(), "cancel") };
}, "v3compat");
var A = class A2 {
  constructor(t) {
    this.tilev4 = d((t2, e) => h(this, null, function* () {
      if (t2.type === "json") {
        let g = t2.url.substr(10), p = this.tiles.get(g);
        if (p || (p = new w(g), this.tiles.set(g, p)), this.metadata) {
          let K = yield p.getTileJson(t2.url);
          return e.signal.throwIfAborted(), { data: K };
        }
        let f = yield p.getHeader();
        return e.signal.throwIfAborted(), (f.minLon >= f.maxLon || f.minLat >= f.maxLat) && console.error(`Bounds of PMTiles archive ${f.minLon},${f.minLat},${f.maxLon},${f.maxLat} are not valid.`), { data: { tiles: [`${t2.url}/{z}/{x}/{y}`], minzoom: f.minZoom, maxzoom: f.maxZoom, bounds: [f.minLon, f.minLat, f.maxLon, f.maxLat] } };
      }
      let r = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/), n = t2.url.match(r);
      if (!n) throw new Error("Invalid PMTiles protocol URL");
      let s = n[1], i2 = this.tiles.get(s);
      i2 || (i2 = new w(s), this.tiles.set(s, i2));
      let a = n[2], c = n[3], l = n[4], u = yield i2 == null ? void 0 : i2.getZxy(+a, +c, +l, e.signal);
      if (e.signal.throwIfAborted(), u) return { data: new Uint8Array(u.data), cacheControl: u.cacheControl, expires: u.expires };
      let m = yield i2.getHeader();
      if (m.tileType === 1 || m.tileType === 6) {
        if (this.errorOnMissingTile) throw new Error("Tile not found.");
        return { data: new Uint8Array() };
      }
      return { data: null };
    }), "tilev4");
    this.tile = z(this.tilev4);
    this.tiles = /* @__PURE__ */ new Map(), this.metadata = (t == null ? void 0 : t.metadata) || false, this.errorOnMissingTile = (t == null ? void 0 : t.errorOnMissingTile) || false;
  }
  add(t) {
    this.tiles.set(t.source.getKey(), t);
  }
  get(t) {
    return this.tiles.get(t);
  }
};
d(A, "Protocol");
function b(o, t) {
  return (t >>> 0) * 4294967296 + (o >>> 0);
}
d(b, "toNum");
function N(o, t) {
  let e = t.buf, r = e[t.pos++], n = (r & 112) >> 4;
  if (r < 128 || (r = e[t.pos++], n |= (r & 127) << 3, r < 128) || (r = e[t.pos++], n |= (r & 127) << 10, r < 128) || (r = e[t.pos++], n |= (r & 127) << 17, r < 128) || (r = e[t.pos++], n |= (r & 127) << 24, r < 128) || (r = e[t.pos++], n |= (r & 1) << 31, r < 128)) return b(o, n);
  throw new Error("Expected varint not more than 10 bytes");
}
d(N, "readVarintRemainder");
function x2(o) {
  let t = o.buf, e = t[o.pos++], r = e & 127;
  return e < 128 || (e = t[o.pos++], r |= (e & 127) << 7, e < 128) || (e = t[o.pos++], r |= (e & 127) << 14, e < 128) || (e = t[o.pos++], r |= (e & 127) << 21, e < 128) ? r : (e = t[o.pos], r |= (e & 15) << 28, N(r, o));
}
d(x2, "readVarint");
function I(o, t, e, r, n) {
  return n === 0 ? r !== 0 ? [o - 1 - e, o - 1 - t] : [e, t] : [t, e];
}
d(I, "rotate");
function q(o, t, e) {
  if (o > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  if (t >= 1 << o || e >= 1 << o) throw new Error("tile x/y outside zoom level bounds");
  let r = ((1 << o) * (1 << o) - 1) / 3, n = o - 1, [s, i2] = [t, e];
  for (let a = 1 << n; a > 0; a >>= 1) {
    let c = s & a, l = i2 & a;
    r += (3 * c ^ l) * (1 << n), [s, i2] = I(a, s, i2, c, l), n--;
  }
  return r;
}
d(q, "zxyToTileId");
function G(o) {
  let t = 3 * o + 1;
  return t < 4294967296 ? 31 - Math.clz32(t) : 63 - Math.clz32(t / 4294967296);
}
d(G, "tileIdToZ");
function ie(o) {
  let t = G(o) >> 1;
  if (t > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  let e = ((1 << t) * (1 << t) - 1) / 3, r = o - e, n = 0, s = 0, i2 = 1 << t;
  for (let a = 1; a < i2; a <<= 1) {
    let c = a & r / 2, l = a & (r ^ c);
    [n, s] = I(a, n, s, c, l), r = r / 2, n += c, s += l;
  }
  return [t, n, s];
}
d(ie, "tileIdToZxy");
var J = ((s) => (s[s.Unknown = 0] = "Unknown", s[s.None = 1] = "None", s[s.Gzip = 2] = "Gzip", s[s.Brotli = 3] = "Brotli", s[s.Zstd = 4] = "Zstd", s))(J || {});
function P(o, t) {
  return h(this, null, function* () {
    if (t === 1 || t === 0) return o;
    if (t === 2) {
      if (typeof globalThis.DecompressionStream == "undefined") return decompressSync(new Uint8Array(o));
      let e = new Response(o).body;
      if (!e) throw new Error("Failed to read response stream");
      let r = e.pipeThrough(new globalThis.DecompressionStream("gzip"));
      return new Response(r).arrayBuffer();
    }
    throw new Error("Compression method not supported");
  });
}
d(P, "defaultDecompress");
var O = ((a) => (a[a.Unknown = 0] = "Unknown", a[a.Mvt = 1] = "Mvt", a[a.Png = 2] = "Png", a[a.Jpeg = 3] = "Jpeg", a[a.Webp = 4] = "Webp", a[a.Avif = 5] = "Avif", a[a.Mlt = 6] = "Mlt", a))(O || {});
function _(o) {
  return o === 1 ? ".mvt" : o === 2 ? ".png" : o === 3 ? ".jpg" : o === 4 ? ".webp" : o === 5 ? ".avif" : o === 6 ? ".mlt" : "";
}
d(_, "tileTypeExt");
var Y = 127;
function Q(o, t) {
  let e = 0, r = o.length - 1;
  for (; e <= r; ) {
    let n = r + e >> 1, s = t - o[n].tileId;
    if (s > 0) e = n + 1;
    else if (s < 0) r = n - 1;
    else return o[n];
  }
  return r >= 0 && (o[r].runLength === 0 || t - o[r].tileId < o[r].runLength) ? o[r] : null;
}
d(Q, "findTile");
var T = class T2 {
  constructor(t) {
    this.file = t;
  }
  getKey() {
    return this.file.name;
  }
  getBytes(t, e) {
    return h(this, null, function* () {
      return { data: yield this.file.slice(t, t + e).arrayBuffer() };
    });
  }
};
d(T, "FileSource");
var D = class D2 {
  constructor(t, e = new Headers(), r = void 0) {
    var a, c;
    this.url = t, this.customHeaders = e, this.credentials = r, this.mustReload = false;
    let n = "";
    "navigator" in globalThis && (n = (c = (a = globalThis.navigator) == null ? void 0 : a.userAgent) != null ? c : "");
    let s = n.indexOf("Windows") > -1, i2 = /Chrome|Chromium|Edg|OPR|Brave/.test(n);
    this.chromeWindowsNoCache = false, s && i2 && (this.chromeWindowsNoCache = true);
  }
  getKey() {
    return this.url;
  }
  setHeaders(t) {
    this.customHeaders = t;
  }
  getBytes(t, e, r, n) {
    return h(this, null, function* () {
      let s, i2;
      r ? i2 = r : (s = new AbortController(), i2 = s.signal);
      let a = new Headers(this.customHeaders);
      a.set("range", `bytes=${t}-${t + e - 1}`);
      let c;
      this.mustReload ? c = "reload" : this.chromeWindowsNoCache && (c = "no-store");
      let l = yield fetch(this.url, { signal: i2, cache: c, headers: a, credentials: this.credentials });
      if (t === 0 && l.status === 416) {
        let p = l.headers.get("Content-Range");
        if (!p || !p.startsWith("bytes */")) throw new Error("Missing content-length on 416 response");
        let f = +p.substr(8);
        a.set("range", `bytes=0-${f - 1}`), l = yield fetch(this.url, { signal: i2, cache: "reload", headers: a, credentials: this.credentials });
      }
      let u = l.headers.get("Etag");
      if (u != null && u.startsWith("W/") && (u = null), l.status === 416 || n && u && u !== n) throw this.mustReload = true, new v(`Server returned non-matching ETag ${n} after one retry. Check browser extensions and servers for issues that may affect correct ETag headers.`);
      if (l.status >= 300) throw new Error(`Bad response code: ${l.status}`);
      let m = l.headers.get("Content-Length");
      if (l.status === 200 && (!m || +m > e)) throw s && s.abort(), new Error("Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving.");
      return { data: yield l.arrayBuffer(), etag: u || void 0, cacheControl: l.headers.get("Cache-Control") || void 0, expires: l.headers.get("Expires") || void 0 };
    });
  }
};
d(D, "FetchSource");
var E = D;
function y(o, t) {
  let e = o.getUint32(t + 4, true), r = o.getUint32(t + 0, true);
  return e * S(2, 32) + r;
}
d(y, "getUint64");
function X(o, t) {
  let e = new DataView(o), r = e.getUint8(7);
  if (r > 3) throw new Error(`Archive is spec version ${r} but this library supports up to spec version 3`);
  return { specVersion: r, rootDirectoryOffset: y(e, 8), rootDirectoryLength: y(e, 16), jsonMetadataOffset: y(e, 24), jsonMetadataLength: y(e, 32), leafDirectoryOffset: y(e, 40), leafDirectoryLength: y(e, 48), tileDataOffset: y(e, 56), tileDataLength: y(e, 64), numAddressedTiles: y(e, 72), numTileEntries: y(e, 80), numTileContents: y(e, 88), clustered: e.getUint8(96) === 1, internalCompression: e.getUint8(97), tileCompression: e.getUint8(98), tileType: e.getUint8(99), minZoom: e.getUint8(100), maxZoom: e.getUint8(101), minLon: e.getInt32(102, true) / 1e7, minLat: e.getInt32(106, true) / 1e7, maxLon: e.getInt32(110, true) / 1e7, maxLat: e.getInt32(114, true) / 1e7, centerZoom: e.getUint8(118), centerLon: e.getInt32(119, true) / 1e7, centerLat: e.getInt32(123, true) / 1e7, etag: t };
}
d(X, "bytesToHeader");
function Z(o) {
  let t = { buf: new Uint8Array(o), pos: 0 }, e = x2(t), r = [], n = 0;
  for (let s = 0; s < e; s++) {
    let i2 = x2(t);
    r.push({ tileId: n + i2, offset: 0, length: 0, runLength: 1 }), n += i2;
  }
  for (let s = 0; s < e; s++) r[s].runLength = x2(t);
  for (let s = 0; s < e; s++) r[s].length = x2(t);
  for (let s = 0; s < e; s++) {
    let i2 = x2(t);
    i2 === 0 && s > 0 ? r[s].offset = r[s - 1].offset + r[s - 1].length : r[s].offset = i2 - 1;
  }
  return r;
}
d(Z, "deserializeIndex");
var R = class R2 extends Error {
};
d(R, "EtagMismatch");
var v = R;
function V(o, t) {
  return h(this, null, function* () {
    let e = yield o.getBytes(0, 16384);
    if (new DataView(e.data).getUint16(0, true) !== 19792) throw new Error("Wrong magic number for PMTiles archive");
    let n = e.data.slice(0, Y), s = X(n, e.etag), i2 = e.data.slice(s.rootDirectoryOffset, s.rootDirectoryOffset + s.rootDirectoryLength), a = `${o.getKey()}|${s.etag || ""}|${s.rootDirectoryOffset}|${s.rootDirectoryLength}`, c = Z(yield t(i2, s.internalCompression));
    return [s, [a, c.length, c]];
  });
}
d(V, "getHeaderAndRoot");
function F(o, t, e, r, n, s) {
  return h(this, null, function* () {
    let i2 = yield o.getBytes(e, r, s, n.etag), a = yield t(i2.data, n.internalCompression), c = Z(a);
    if (c.length === 0) throw new Error("Empty directory is invalid");
    return c;
  });
}
d(F, "getDirectory");
var U = class U2 {
  constructor(t = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return h(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, r.data;
      let n = yield V(t, this.decompress);
      return n[1] && this.cache.set(n[1][0], { lastUsed: this.counter++, data: n[1][2] }), this.cache.set(e, { lastUsed: this.counter++, data: n[0] }), this.prune(), n[0];
    });
  }
  getDirectory(t, e, r, n, s) {
    return h(this, null, function* () {
      let i2 = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, a = this.cache.get(i2);
      if (a) return a.lastUsed = this.counter++, a.data;
      let c = yield F(t, this.decompress, e, r, n, s);
      return this.cache.set(i2, { lastUsed: this.counter++, data: c }), this.prune(), c;
    });
  }
  prune() {
    if (this.cache.size > this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return h(this, null, function* () {
      this.cache.delete(t.getKey());
    });
  }
};
d(U, "ResolvedValueCache");
var M = class M2 {
  constructor(t = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.invalidations = /* @__PURE__ */ new Map(), this.pendingFetches = /* @__PURE__ */ new Map(), this.maxCacheEntries = t, this.counter = 1, this.decompress = r;
  }
  getHeader(t) {
    return h(this, null, function* () {
      let e = t.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, yield r.data;
      let n = new Promise((s, i2) => {
        V(t, this.decompress).then((a) => {
          a[1] && this.cache.set(a[1][0], { lastUsed: this.counter++, data: Promise.resolve(a[1][2]) }), s(a[0]), this.prune();
        }).catch((a) => {
          i2(a);
        });
      });
      return this.cache.set(e, { lastUsed: this.counter++, data: n }), n;
    });
  }
  trackSignal(t, e, r) {
    e.refs++, r.addEventListener("abort", () => {
      --e.refs <= 0 && this.pendingFetches.get(t) === e && (e.controller.abort(), this.cache.delete(t), this.pendingFetches.delete(t));
    }, { once: true });
  }
  getDirectory(t, e, r, n, s) {
    return h(this, null, function* () {
      let i2 = `${t.getKey()}|${n.etag || ""}|${e}|${r}`, a = this.cache.get(i2);
      if (a) {
        a.lastUsed = this.counter++;
        let m = this.pendingFetches.get(i2);
        return m && this.trackSignal(i2, m, s != null ? s : new AbortController().signal), yield a.data;
      }
      let c = new AbortController(), l = { controller: c, refs: 0 };
      this.trackSignal(i2, l, s != null ? s : new AbortController().signal), this.pendingFetches.set(i2, l);
      let u = new Promise((m, g) => {
        F(t, this.decompress, e, r, n, c.signal).then((p) => {
          this.pendingFetches.delete(i2), m(p), this.prune();
        }).catch((p) => {
          g(p);
        });
      });
      return this.cache.set(i2, { lastUsed: this.counter++, data: u }), u;
    });
  }
  prune() {
    if (this.cache.size >= this.maxCacheEntries) {
      let t = 1 / 0, e;
      this.cache.forEach((r, n) => {
        r.lastUsed < t && (t = r.lastUsed, e = n);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t) {
    return h(this, null, function* () {
      let e = t.getKey();
      if (this.invalidations.get(e)) return yield this.invalidations.get(e);
      this.cache.delete(t.getKey());
      let r = new Promise((n, s) => {
        this.getHeader(t).then((i2) => {
          n(), this.invalidations.delete(e);
        }).catch((i2) => {
          s(i2);
        });
      });
      this.invalidations.set(e, r);
    });
  }
};
d(M, "SharedPromiseCache");
var C = M;
var H = class H2 {
  constructor(t, e, r) {
    typeof t == "string" ? this.source = new E(t) : this.source = t, r ? this.decompress = r : this.decompress = P, e ? this.cache = e : this.cache = new C();
  }
  getHeader() {
    return h(this, null, function* () {
      return yield this.cache.getHeader(this.source);
    });
  }
  getZxyAttempt(t, e, r, n) {
    return h(this, null, function* () {
      let s = q(t, e, r), i2 = yield this.cache.getHeader(this.source);
      if (n == null || n.throwIfAborted(), t < i2.minZoom || t > i2.maxZoom) return;
      let a = i2.rootDirectoryOffset, c = i2.rootDirectoryLength;
      for (let l = 0; l <= 3; l++) {
        let u = yield this.cache.getDirectory(this.source, a, c, i2, n);
        n == null || n.throwIfAborted();
        let m = Q(u, s);
        if (m) {
          if (m.runLength > 0) {
            let g = yield this.source.getBytes(i2.tileDataOffset + m.offset, m.length, n, i2.etag);
            return { data: yield this.decompress(g.data, i2.tileCompression), cacheControl: g.cacheControl, expires: g.expires };
          }
          a = i2.leafDirectoryOffset + m.offset, c = m.length;
        } else return;
      }
      throw new Error("Maximum directory depth exceeded");
    });
  }
  getZxy(t, e, r, n) {
    return h(this, null, function* () {
      try {
        return yield this.getZxyAttempt(t, e, r, n);
      } catch (s) {
        if (s instanceof v) return this.cache.invalidate(this.source), yield this.getZxyAttempt(t, e, r, n);
        throw s;
      }
    });
  }
  getMetadataAttempt() {
    return h(this, null, function* () {
      let t = yield this.cache.getHeader(this.source), e = yield this.source.getBytes(t.jsonMetadataOffset, t.jsonMetadataLength, void 0, t.etag), r = yield this.decompress(e.data, t.internalCompression), n = new TextDecoder("utf-8");
      return JSON.parse(n.decode(r));
    });
  }
  getMetadata() {
    return h(this, null, function* () {
      try {
        return yield this.getMetadataAttempt();
      } catch (t) {
        if (t instanceof v) return this.cache.invalidate(this.source), yield this.getMetadataAttempt();
        throw t;
      }
    });
  }
  getTileJson(t) {
    return h(this, null, function* () {
      let e = yield this.getHeader(), r = yield this.getMetadata(), n = _(e.tileType);
      return { tilejson: "3.0.0", scheme: "xyz", tiles: [`${t}/{z}/{x}/{y}${n}`], vector_layers: r.vector_layers, attribution: r.attribution, description: r.description, name: r.name, version: r.version, bounds: [e.minLon, e.minLat, e.maxLon, e.maxLat], center: [e.centerLon, e.centerLat, e.centerZoom], minzoom: e.minZoom, maxzoom: e.maxZoom };
    });
  }
};
d(H, "PMTiles");
var w = H;

// src/storage/pmtilesLocal.ts
var LocalFileSource = class {
  constructor(file, key) {
    this.file = file;
    this.key = key;
  }
  file;
  key;
  getKey() {
    return this.key;
  }
  async getBytes(offset, length) {
    const data = await this.file.slice(offset, offset + length).arrayBuffer();
    return { data };
  }
};

// src/core/routing/types.ts
var PROFILE_INDEX = { foot: 0, bike: 1, car: 2 };

// src/core/routing/graph.ts
var EARTH_R = 63710088e-1;
function distanceM(a, b2) {
  const p1 = a[1] * Math.PI / 180;
  const p2 = b2[1] * Math.PI / 180;
  const dp = p2 - p1;
  const dl = (b2[0] - a[0]) * Math.PI / 180;
  const h2 = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h2)));
}
var OSM_SPEED = {
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
  ferry: [0, 0, 0]
};
var OSM_DEFAULT_SPEED = [4.5, 12, 20];
var USER_SPEED = {
  trail: [4.5, 10, 12],
  gravel: [4.5, 14, 25],
  road: [4.5, 18, 40]
};
var MAX_KMH = { foot: 4.5, bike: 18, car: 100 };
var ACCESS_KEY = { foot: "foot", bike: "bicycle", car: "motor_vehicle" };
function baseSpeeds(line) {
  let kmh;
  if (line.user) {
    kmh = [...USER_SPEED[line.user.lineType]];
    const rank = PROFILE_INDEX[line.user.passability];
    for (let p = 0; p < 3; p++) if (p > rank) kmh[p] = 0;
  } else {
    kmh = [...OSM_SPEED[line.cls] ?? OSM_DEFAULT_SPEED];
    if (line.sub === "steps") kmh[1] = 0;
    const profiles = ["foot", "bike", "car"];
    profiles.forEach((prof, p) => {
      const v2 = line.access[ACCESS_KEY[prof]] ?? line.access.generic;
      if (v2 === "no" || v2 === "private") kmh[p] = 0;
    });
  }
  return [kmh[0] / 3.6, kmh[1] / 3.6, kmh[2] / 3.6];
}
var CELL = 2e-3;
var MAX_RING = 12;
var MAX_SNAP_M = 120;
var RoadGraph = class {
  lng = [];
  lat = [];
  adj = [];
  from = [];
  to = [];
  len = [];
  /** speed[p][edge] in m/s, 0 when the profile cannot use the edge. */
  speed = [[], [], []];
  nodeIds = /* @__PURE__ */ new Map();
  grid = /* @__PURE__ */ new Map();
  node(p) {
    const key = `${Math.round(p[0] * 1e7)}:${Math.round(p[1] * 1e7)}`;
    let id = this.nodeIds.get(key);
    if (id === void 0) {
      id = this.lng.length;
      this.lng.push(p[0]);
      this.lat.push(p[1]);
      this.adj.push([]);
      this.nodeIds.set(key, id);
    }
    return id;
  }
  addLine(line) {
    const base = baseSpeeds(line);
    if (base.every((v2) => v2 === 0)) return;
    for (let i2 = 1; i2 < line.coords.length; i2++) {
      const a = line.coords[i2 - 1];
      const b2 = line.coords[i2];
      const u = this.node(a);
      const v2 = this.node(b2);
      if (u === v2) continue;
      const len = distanceM(a, b2);
      if (len < 0.05) continue;
      const fwd = base.map((s, p) => p === 0 || line.oneway !== -1 ? s : 0);
      const bwd = base.map((s, p) => p === 0 || line.oneway !== 1 ? s : 0);
      if (fwd.some((s) => s > 0)) this.addEdge(u, v2, len, fwd);
      if (bwd.some((s) => s > 0)) this.addEdge(v2, u, len, bwd);
    }
  }
  addEdge(u, v2, len, sp) {
    const e = this.from.length;
    this.from.push(u);
    this.to.push(v2);
    this.len.push(len);
    for (let p = 0; p < 3; p++) this.speed[p].push(sp[p]);
    this.adj[u].push(e);
    this.indexEdge(e);
    return e;
  }
  cellKey(ix, iy) {
    return (ix + 2e5) * 4e5 + (iy + 2e5);
  }
  /** Registers the edge in every grid cell along its geometry (sampled every half cell). */
  indexEdge(e) {
    const a = [this.lng[this.from[e]], this.lat[this.from[e]]];
    const b2 = [this.lng[this.to[e]], this.lat[this.to[e]]];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b2[0] - a[0]), Math.abs(b2[1] - a[1])) / (CELL / 2)));
    const seen = /* @__PURE__ */ new Set();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const ix = Math.floor((a[0] + (b2[0] - a[0]) * t) / CELL);
      const iy = Math.floor((a[1] + (b2[1] - a[1]) * t) / CELL);
      const k2 = this.cellKey(ix, iy);
      if (seen.has(k2)) continue;
      seen.add(k2);
      const list = this.grid.get(k2);
      if (list) list.push(e);
      else this.grid.set(k2, [e]);
    }
  }
  /**
   * Returns the node of the closest point on a road usable by the profile.
   * The road edge is split at the projected point, so the route really starts there.
   */
  snap(p, profile) {
    const pi = PROFILE_INDEX[profile];
    const cx = Math.floor(p[0] / CELL);
    const cy = Math.floor(p[1] / CELL);
    const cellW = CELL * 111320 * Math.cos(p[1] * Math.PI / 180);
    const kx = 111320 * Math.cos(p[1] * Math.PI / 180);
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
            const b2 = this.to[e];
            const ax = (this.lng[a] - p[0]) * kx;
            const ay = (this.lat[a] - p[1]) * ky;
            const bx = (this.lng[b2] - p[0]) * kx;
            const by = (this.lat[b2] - p[1]) * ky;
            const vx = bx - ax;
            const vy = by - ay;
            const vv = vx * vx + vy * vy;
            const t = vv === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / vv));
            const px = ax + vx * t;
            const py = ay + vy * t;
            const d2 = Math.hypot(px, py);
            if (d2 < bestD) {
              bestD = d2;
              best = e;
              bestT = t;
            }
          }
        }
      }
      if (best >= 0 && bestD <= r * cellW) break;
    }
    if (best < 0 || bestD > MAX_SNAP_M) {
      const d2 = best < 0 ? "\u2014" : `${Math.round(bestD)} \u043C`;
      throw new Error(
        `\u0422\u043E\u0447\u043A\u0430 \u043D\u0435 \u043D\u0430 \u0434\u043E\u0440\u043E\u0433\u0435 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0444\u0438\u043B\u044F (\u0434\u043E \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0439 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0439 \u0434\u043E\u0440\u043E\u0433\u0438 ${d2}). \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0447\u043A\u0443 \u0431\u043B\u0438\u0436\u0435 \u043A \u0434\u043E\u0440\u043E\u0433\u0435 \u0438\u043B\u0438 \u0442\u0440\u043E\u043F\u0435.`
      );
    }
    return this.splitEdge(best, bestT);
  }
  /** Inserts a node at fraction t of edge e (and of its reverse, if present). */
  splitEdge(e, t) {
    const u = this.from[e];
    const v2 = this.to[e];
    if (t < 1e-4) return u;
    if (t > 1 - 1e-4) return v2;
    const a = [this.lng[u], this.lat[u]];
    const b2 = [this.lng[v2], this.lat[v2]];
    const pt = [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t];
    const s = this.lng.length;
    this.lng.push(pt[0]);
    this.lat.push(pt[1]);
    this.adj.push([]);
    const sp = [this.speed[0][e], this.speed[1][e], this.speed[2][e]];
    this.addEdge(u, s, distanceM(a, pt), sp);
    this.addEdge(s, v2, distanceM(pt, b2), sp);
    this.disableEdge(e);
    for (const r of this.adj[v2]) {
      if (this.to[r] !== u || this.speed.every((arr) => arr[r] <= 0)) continue;
      const rsp = [this.speed[0][r], this.speed[1][r], this.speed[2][r]];
      this.addEdge(v2, s, distanceM(b2, pt), rsp);
      this.addEdge(s, u, distanceM(pt, a), rsp);
      this.disableEdge(r);
      break;
    }
    return s;
  }
  disableEdge(e) {
    for (let p = 0; p < 3; p++) this.speed[p][e] = 0;
  }
  /** A* by travel time. Returns the edge list, or null when unreachable. */
  shortestPath(start, goal, profile) {
    const pi = PROFILE_INDEX[profile];
    const n = this.lng.length;
    const maxMps = MAX_KMH[profile] / 3.6;
    const gx = this.lng[goal];
    const gy = this.lat[goal];
    const heur = (node) => distanceM([this.lng[node], this.lat[node]], [gx, gy]) / maxMps;
    const g = new Float64Array(n).fill(Infinity);
    const via = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    g[start] = 0;
    const heapF = [];
    const heapN = [];
    const push = (f, node) => {
      heapF.push(f);
      heapN.push(node);
      let i2 = heapF.length - 1;
      while (i2 > 0) {
        const parent = i2 - 1 >> 1;
        if (heapF[parent] <= heapF[i2]) break;
        [heapF[parent], heapF[i2]] = [heapF[i2], heapF[parent]];
        [heapN[parent], heapN[i2]] = [heapN[i2], heapN[parent]];
        i2 = parent;
      }
    };
    const pop = () => {
      const top = heapN[0];
      const lastF = heapF.pop();
      const lastN = heapN.pop();
      if (heapF.length > 0) {
        heapF[0] = lastF;
        heapN[0] = lastN;
        let i2 = 0;
        for (; ; ) {
          const l = 2 * i2 + 1;
          const r = l + 1;
          let m = i2;
          if (l < heapF.length && heapF[l] < heapF[m]) m = l;
          if (r < heapF.length && heapF[r] < heapF[m]) m = r;
          if (m === i2) break;
          [heapF[m], heapF[i2]] = [heapF[i2], heapF[m]];
          [heapN[m], heapN[i2]] = [heapN[i2], heapN[m]];
          i2 = m;
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
    const edges = [];
    for (let node = goal; node !== start; ) {
      const e = via[node];
      edges.push(e);
      node = this.from[e];
    }
    edges.reverse();
    return { edges, seconds: g[goal] };
  }
};
function planRoute(lines, from, to, profile) {
  const graph = new RoadGraph();
  for (const line of lines) graph.addLine(line);
  if (graph.lng.length === 0) {
    throw new Error("\u0412 \u044D\u0442\u043E\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u043D\u0435\u0442 \u0434\u043E\u0440\u043E\u0436\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0435\u0433\u0438\u043E\u043D, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u043C\u0430\u0440\u0448\u0440\u0443\u0442.");
  }
  const a = graph.snap(from, profile);
  const b2 = graph.snap(to, profile);
  const coords = [from];
  let distance = distanceM(from, [graph.lng[a], graph.lat[a]]);
  let duration = distance / (4.5 / 3.6);
  if (a !== b2) {
    const path = graph.shortestPath(a, b2, profile);
    if (!path) throw new Error("\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D: \u0442\u043E\u0447\u043A\u0438 \u043D\u0435 \u0441\u0432\u044F\u0437\u0430\u043D\u044B \u0434\u043E\u0440\u043E\u0433\u0430\u043C\u0438 \u0432 \u044D\u0442\u043E\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u0438.");
    duration += path.seconds;
    for (const e of path.edges) {
      distance += graph.len[e];
      const next = [graph.lng[graph.to[e]], graph.lat[graph.to[e]]];
      const last = coords[coords.length - 1];
      if (last[0] !== next[0] || last[1] !== next[1]) coords.push(next);
    }
  }
  const tail = distanceM([graph.lng[b2], graph.lat[b2]], to);
  distance += tail;
  duration += tail / (4.5 / 3.6);
  coords.push(to);
  return { coords, distance, duration };
}

// node_modules/@mapbox/point-geometry/index.js
function Point(x3, y2) {
  this.x = x3;
  this.y = y2;
}
Point.prototype = {
  /**
   * Clone this point, returning a new point that can be modified
   * without affecting the old one.
   * @return {Point} the clone
   */
  clone() {
    return new Point(this.x, this.y);
  },
  /**
   * Add this point's x & y coordinates to another point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  add(p) {
    return this.clone()._add(p);
  },
  /**
   * Subtract this point's x & y coordinates to from point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  sub(p) {
    return this.clone()._sub(p);
  },
  /**
   * Multiply this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  multByPoint(p) {
    return this.clone()._multByPoint(p);
  },
  /**
   * Divide this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  divByPoint(p) {
    return this.clone()._divByPoint(p);
  },
  /**
   * Multiply this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  mult(k2) {
    return this.clone()._mult(k2);
  },
  /**
   * Divide this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  div(k2) {
    return this.clone()._div(k2);
  },
  /**
   * Rotate this point around the 0, 0 origin by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @return {Point} output point
   */
  rotate(a) {
    return this.clone()._rotate(a);
  },
  /**
   * Rotate this point around p point by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @param {Point} p Point to rotate around
   * @return {Point} output point
   */
  rotateAround(a, p) {
    return this.clone()._rotateAround(a, p);
  },
  /**
   * Multiply this point by a 4x1 transformation matrix
   * @param {[number, number, number, number]} m transformation matrix
   * @return {Point} output point
   */
  matMult(m) {
    return this.clone()._matMult(m);
  },
  /**
   * Calculate this point but as a unit vector from 0, 0, meaning
   * that the distance from the resulting point to the 0, 0
   * coordinate will be equal to 1 and the angle from the resulting
   * point to the 0, 0 coordinate will be the same as before.
   * @return {Point} unit vector point
   */
  unit() {
    return this.clone()._unit();
  },
  /**
   * Compute a perpendicular point, where the new y coordinate
   * is the old x coordinate and the new x coordinate is the old y
   * coordinate multiplied by -1
   * @return {Point} perpendicular point
   */
  perp() {
    return this.clone()._perp();
  },
  /**
   * Return a version of this point with the x & y coordinates
   * rounded to integers.
   * @return {Point} rounded point
   */
  round() {
    return this.clone()._round();
  },
  /**
   * Return the magnitude of this point: this is the Euclidean
   * distance from the 0, 0 coordinate to this point's x and y
   * coordinates.
   * @return {number} magnitude
   */
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  /**
   * Judge whether this point is equal to another point, returning
   * true or false.
   * @param {Point} other the other point
   * @return {boolean} whether the points are equal
   */
  equals(other) {
    return this.x === other.x && this.y === other.y;
  },
  /**
   * Calculate the distance from this point to another point
   * @param {Point} p the other point
   * @return {number} distance
   */
  dist(p) {
    return Math.sqrt(this.distSqr(p));
  },
  /**
   * Calculate the distance from this point to another point,
   * without the square root step. Useful if you're comparing
   * relative distances.
   * @param {Point} p the other point
   * @return {number} distance
   */
  distSqr(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    return dx * dx + dy * dy;
  },
  /**
   * Get the angle from the 0, 0 coordinate to this point, in radians
   * coordinates.
   * @return {number} angle
   */
  angle() {
    return Math.atan2(this.y, this.x);
  },
  /**
   * Get the angle from this point to another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleTo(b2) {
    return Math.atan2(this.y - b2.y, this.x - b2.x);
  },
  /**
   * Get the angle between this point and another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleWith(b2) {
    return this.angleWithSep(b2.x, b2.y);
  },
  /**
   * Find the angle of the two vectors, solving the formula for
   * the cross product a x b = |a||b|sin(θ) for θ.
   * @param {number} x the x-coordinate
   * @param {number} y the y-coordinate
   * @return {number} the angle in radians
   */
  angleWithSep(x3, y2) {
    return Math.atan2(
      this.x * y2 - this.y * x3,
      this.x * x3 + this.y * y2
    );
  },
  /** @param {[number, number, number, number]} m */
  _matMult(m) {
    const x3 = m[0] * this.x + m[1] * this.y, y2 = m[2] * this.x + m[3] * this.y;
    this.x = x3;
    this.y = y2;
    return this;
  },
  /** @param {Point} p */
  _add(p) {
    this.x += p.x;
    this.y += p.y;
    return this;
  },
  /** @param {Point} p */
  _sub(p) {
    this.x -= p.x;
    this.y -= p.y;
    return this;
  },
  /** @param {number} k */
  _mult(k2) {
    this.x *= k2;
    this.y *= k2;
    return this;
  },
  /** @param {number} k */
  _div(k2) {
    this.x /= k2;
    this.y /= k2;
    return this;
  },
  /** @param {Point} p */
  _multByPoint(p) {
    this.x *= p.x;
    this.y *= p.y;
    return this;
  },
  /** @param {Point} p */
  _divByPoint(p) {
    this.x /= p.x;
    this.y /= p.y;
    return this;
  },
  _unit() {
    this._div(this.mag());
    return this;
  },
  _perp() {
    const y2 = this.y;
    this.y = this.x;
    this.x = -y2;
    return this;
  },
  /** @param {number} angle */
  _rotate(angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x3 = cos * this.x - sin * this.y, y2 = sin * this.x + cos * this.y;
    this.x = x3;
    this.y = y2;
    return this;
  },
  /**
   * @param {number} angle
   * @param {Point} p
   */
  _rotateAround(angle, p) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x3 = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y2 = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
    this.x = x3;
    this.y = y2;
    return this;
  },
  _round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  },
  constructor: Point
};
Point.convert = function(p) {
  if (p instanceof Point) {
    return (
      /** @type {Point} */
      p
    );
  }
  if (Array.isArray(p)) {
    return new Point(+p[0], +p[1]);
  }
  if (p.x !== void 0 && p.y !== void 0) {
    return new Point(+p.x, +p.y);
  }
  throw new Error("Expected [x, y] or {x, y} point format");
};

// node_modules/@mapbox/vector-tile/index.js
var VectorTileFeature = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} end
   * @param {number} extent
   * @param {string[]} keys
   * @param {(number | string | boolean)[]} values
   */
  constructor(pbf, end, extent, keys, values) {
    this.properties = /* @__PURE__ */ Object.create(null);
    this.extent = extent;
    this.type = 0;
    this.id = void 0;
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 8) this.id = pbf.readVarint();
      else if (tag === 18) {
        const tagsEnd = pbf.readVarint() + pbf.pos;
        while (pbf.pos < tagsEnd) {
          const key = keys[pbf.readVarint()];
          const value = values[pbf.readVarint()];
          this.properties[key] = value;
        }
      } else if (tag === 24) this.type = /** @type {0 | 1 | 2 | 3} */
      pbf.readVarint();
      else if (tag === 34) {
        this._geometry = pbf.pos;
        pbf.skip(tag);
      } else pbf.skip(tag);
    }
  }
  loadGeometry() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    const lines = [];
    let line;
    let cmd = 1;
    let length = 0;
    let x3 = 0;
    let y2 = 0;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1) {
        x3 += pbf.readSVarint();
        y2 += pbf.readSVarint();
        if (line) lines.push(line);
        line = [new Point(x3, y2)];
      } else if (cmd === 2) {
        x3 += pbf.readSVarint();
        y2 += pbf.readSVarint();
        if (line) line.push(new Point(x3, y2));
      } else if (cmd === 7) {
        if (line) {
          line.push(line[0].clone());
        }
      } else {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  bbox() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1, length = 0, x3 = 0, y2 = 0, x1 = Infinity, x22 = -Infinity, y1 = Infinity, y22 = -Infinity;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1 || cmd === 2) {
        x3 += pbf.readSVarint();
        y2 += pbf.readSVarint();
        if (x3 < x1) x1 = x3;
        if (x3 > x22) x22 = x3;
        if (y2 < y1) y1 = y2;
        if (y2 > y22) y22 = y2;
      } else if (cmd !== 7) {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    return [x1, y1, x22, y22];
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {Feature}
   */
  toGeoJSON(x3, y2, z2) {
    const size = this.extent * Math.pow(2, z2), x0 = this.extent * x3, y0 = this.extent * y2, vtCoords = this.loadGeometry();
    function projectPoint(p) {
      return [
        (p.x + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
      ];
    }
    function projectLine(line) {
      return line.map(projectPoint);
    }
    let geometry;
    if (this.type === 1) {
      const points = [];
      for (const line of vtCoords) {
        points.push(line[0]);
      }
      const coordinates = projectLine(points);
      geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
    } else if (this.type === 2) {
      const coordinates = vtCoords.map(projectLine);
      geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
    } else if (this.type === 3) {
      const polygons = classifyRings(vtCoords);
      const coordinates = [];
      for (const polygon of polygons) {
        coordinates.push(polygon.map(projectLine));
      }
      geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
    } else {
      throw new Error("unknown feature type");
    }
    const result = {
      type: "Feature",
      geometry,
      properties: this.properties
    };
    if (this.id != null) {
      result.id = this.id;
    }
    return result;
  }
};
VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
function classifyRings(rings) {
  const len = rings.length;
  if (len <= 1) return [rings];
  const polygons = [];
  let polygon, ccw;
  for (let i2 = 0; i2 < len; i2++) {
    const area = signedArea(rings[i2]);
    if (area === 0) continue;
    if (ccw === void 0) ccw = area < 0;
    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i2]];
    } else if (polygon) {
      polygon.push(rings[i2]);
    }
  }
  if (polygon) polygons.push(polygon);
  return polygons;
}
function signedArea(ring) {
  let sum = 0;
  for (let i2 = 0, len = ring.length, j2 = len - 1, p1, p2; i2 < len; j2 = i2++) {
    p1 = ring[i2];
    p2 = ring[j2];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}
var VectorTileLayer = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end) {
    this.version = 1;
    this.name = "";
    this.extent = 4096;
    this.length = 0;
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];
    if (end === void 0) end = pbf.length;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 10) this.name = pbf.readString();
      else if (tag === 18) {
        this._features.push(pbf.pos);
        pbf.skip(tag);
      } else if (tag === 26) this._keys.push(pbf.readString());
      else if (tag === 34) this._values.push(readValueMessage(pbf));
      else if (tag === 40) this.extent = pbf.readVarint();
      else if (tag === 120) this.version = pbf.readVarint();
      else pbf.skip(tag);
    }
    this.length = this._features.length;
  }
  /** return feature `i` from this layer as a `VectorTileFeature`
   * @param {number} i
   */
  feature(i2) {
    if (i2 < 0 || i2 >= this._features.length) throw new Error("feature index out of bounds");
    this._pbf.pos = this._features[i2];
    const end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
  }
};
function readValueMessage(pbf) {
  let value = null;
  const end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    const tag = pbf.readVarint();
    value = tag === 10 ? pbf.readString() : tag === 21 ? pbf.readFloat() : tag === 25 ? pbf.readDouble() : tag === 32 ? pbf.readVarint(true) : tag === 40 ? pbf.readVarint() : tag === 48 ? pbf.readSVarint() : tag === 56 ? pbf.readBoolean() : (pbf.skip(tag), null);
  }
  if (value == null) {
    throw new Error("unknown feature value");
  }
  return value;
}
var VectorTile = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end = pbf.length) {
    const layers = /* @__PURE__ */ Object.create(null);
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 26) {
        const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
      } else pbf.skip(tag);
    }
    this.layers = layers;
  }
};

// node_modules/pbf/index.js
var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
var TEXT_DECODER_MIN_LENGTH = 12;
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
var PBF_VARINT = 0;
var PBF_FIXED64 = 1;
var PBF_BYTES = 2;
var PBF_FIXED32 = 5;
var PbfReader = class {
  /**
   * @param {Uint8Array | ArrayBuffer} buf
   */
  constructor(buf) {
    this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
    this.dataView = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.pos = 0;
    this.type = 0;
    this._valueStart = -1;
    this.length = this.buf.length;
  }
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: PbfReader) => void} readField
   * @param {T} result
   * @param {number} [end]
   */
  readFields(readField, result, end = this.length) {
    let field;
    while (field = this.nextField(end)) {
      readField(field, result, this);
    }
    return result;
  }
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: PbfReader) => void} readField
   * @param {T} result
   */
  readMessage(readField, result) {
    return this.readFields(readField, result, this.readVarint() + this.pos);
  }
  readFixed32() {
    const val = this.dataView.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readSFixed32() {
    const val = this.dataView.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readSFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readFloat() {
    const val = this.dataView.getFloat32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readDouble() {
    const val = this.dataView.getFloat64(this.pos, true);
    this.pos += 8;
    return val;
  }
  /**
   * @param {boolean} [isSigned]
   */
  readVarint(isSigned) {
    const buf = this.buf;
    const b0 = buf[this.pos++];
    if (b0 < 128) return b0;
    let val = b0 & 127, b2;
    b2 = buf[this.pos++];
    val |= (b2 & 127) << 7;
    if (b2 < 128) return val;
    b2 = buf[this.pos++];
    val |= (b2 & 127) << 14;
    if (b2 < 128) return val;
    b2 = buf[this.pos++];
    val |= (b2 & 127) << 21;
    if (b2 < 128) return val;
    b2 = buf[this.pos];
    val |= (b2 & 15) << 28;
    return readVarintRemainder(val, isSigned, this);
  }
  readSVarint() {
    const num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2;
  }
  readBoolean() {
    return Boolean(this.readVarint());
  }
  readString() {
    const end = this.readVarint() + this.pos;
    const pos = this.pos;
    this.pos = end;
    if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
      return utf8TextDecoder.decode(this.buf.subarray(pos, end));
    }
    return readUtf8(this.buf, pos, end);
  }
  readBytes() {
    const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  }
  // verbose for performance reasons; doesn't affect gzipped size
  /**
   * @param {number[]} [arr]
   * @param {boolean} [isSigned]
   */
  readPackedVarint(arr = [], isSigned) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readVarint(isSigned));
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSVarint(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSVarint());
    return arr;
  }
  /** @param {boolean[]} [arr] */
  readPackedBoolean(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readBoolean());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFloat(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFloat());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedDouble(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readDouble());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed64());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed64());
    return arr;
  }
  readPackedEnd() {
    return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
  }
  /**
   * Advance to the next field. Returns the field number, or 0 at end-of-message.
   * @param {number} [end]
   */
  nextField(end = this.length) {
    if (this.pos === this._valueStart) this.skip(this.type);
    if (this.pos >= end) return 0;
    const tag = this.readVarint();
    this.type = tag & 7;
    this._valueStart = this.pos;
    return tag >>> 3;
  }
  /** @param {number} val */
  skip(val) {
    const type = val & 7;
    if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
    }
    else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
    else if (type === PBF_FIXED32) this.pos += 4;
    else if (type === PBF_FIXED64) this.pos += 8;
    else throw new Error(`Unimplemented type: ${type}`);
  }
};
function readVarintRemainder(l, s, p) {
  const buf = p.buf;
  let h2, b2;
  b2 = buf[p.pos++];
  h2 = (b2 & 112) >> 4;
  if (b2 < 128) return toNum(l, h2, s);
  b2 = buf[p.pos++];
  h2 |= (b2 & 127) << 3;
  if (b2 < 128) return toNum(l, h2, s);
  b2 = buf[p.pos++];
  h2 |= (b2 & 127) << 10;
  if (b2 < 128) return toNum(l, h2, s);
  b2 = buf[p.pos++];
  h2 |= (b2 & 127) << 17;
  if (b2 < 128) return toNum(l, h2, s);
  b2 = buf[p.pos++];
  h2 |= (b2 & 127) << 24;
  if (b2 < 128) return toNum(l, h2, s);
  b2 = buf[p.pos++];
  h2 |= (b2 & 1) << 31;
  if (b2 < 128) return toNum(l, h2, s);
  throw new Error("Expected varint not more than 10 bytes");
}
function toNum(low, high, isSigned) {
  return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
}
function readUtf8(buf, pos, end) {
  let str = "";
  let i2 = pos;
  while (i2 < end) {
    const b0 = buf[i2];
    let c = null;
    let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
    if (i2 + bytesPerSequence > end) break;
    let b1, b2, b3;
    if (bytesPerSequence === 1) {
      if (b0 < 128) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i2 + 1];
      if ((b1 & 192) === 128) {
        c = (b0 & 31) << 6 | b1 & 63;
        if (c <= 127) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i2 + 1];
      b2 = buf[i2 + 2];
      if ((b1 & 192) === 128 && (b2 & 192) === 128) {
        c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
        if (c <= 2047 || c >= 55296 && c <= 57343) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i2 + 1];
      b2 = buf[i2 + 2];
      b3 = buf[i2 + 3];
      if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
        c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        if (c <= 65535 || c >= 1114112) {
          c = null;
        }
      }
    }
    if (c === null) {
      c = 65533;
      bytesPerSequence = 1;
    } else if (c > 65535) {
      c -= 65536;
      str += String.fromCharCode(c >>> 10 & 1023 | 55296);
      c = 56320 | c & 1023;
    }
    str += String.fromCharCode(c);
    i2 += bytesPerSequence;
  }
  return str;
}

// src/workers/tiles.ts
var ROUTE_ZOOM = 14;
function tileRange(w2, s, e, n, z2) {
  const scale = 2 ** z2;
  const lngX = (lng) => Math.floor((lng + 180) / 360 * scale);
  const latY = (lat) => {
    const r = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * scale);
  };
  const clampMax = scale - 1;
  return {
    x0: Math.max(0, Math.min(clampMax, lngX(w2))),
    x1: Math.max(0, Math.min(clampMax, lngX(e))),
    y0: Math.max(0, Math.min(clampMax, latY(n))),
    y1: Math.max(0, Math.min(clampMax, latY(s)))
  };
}
function tileToLngLat(gx, gy, z2) {
  const scale = 2 ** z2;
  const lng = gx / scale * 360 - 180;
  const m = Math.PI - 2 * Math.PI * gy / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(m) - Math.exp(-m)));
  return [lng, lat];
}
function oneway(v2) {
  if (v2 === -1 || v2 === "-1") return -1;
  if (v2 === 1 || v2 === true || v2 === "1" || v2 === "yes") return 1;
  return 0;
}
function text(v2) {
  return v2 === void 0 || v2 === null ? "" : String(v2).toLowerCase();
}
function decodeRoadTile(data, x3, y2, z2) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const tile = new VectorTile(new PbfReader(bytes));
  const layer = tile.layers.transportation;
  if (!layer) return [];
  const lines = [];
  for (let i2 = 0; i2 < layer.length; i2++) {
    const f = layer.feature(i2);
    if (f.type !== 2) continue;
    const p = f.properties;
    const cls = text(p.class);
    const sub = text(p.subclass);
    const ow = oneway(p.oneway);
    const access = {};
    const keys = [
      ["generic", "access"],
      ["foot", "foot"],
      ["bicycle", "bicycle"],
      ["motor_vehicle", "motor_vehicle"]
    ];
    for (const [k2, src] of keys) {
      const v2 = text(p[src]);
      if (v2) access[k2] = v2;
    }
    const ext = f.extent || 4096;
    for (const ring of f.loadGeometry()) {
      if (ring.length < 2) continue;
      const coords = ring.map((pt) => tileToLngLat(x3 + pt.x / ext, y2 + pt.y / ext, z2));
      lines.push({ coords, cls, sub, oneway: ow, access, user: null });
    }
  }
  return lines;
}

// src/workers/router.worker.ts
var MAX_TILES = 1200;
var CACHE_LIMIT = 900;
var CONCURRENCY = 12;
var archives = /* @__PURE__ */ new Map();
var onlineTemplates = /* @__PURE__ */ new Map();
var tileCache = /* @__PURE__ */ new Map();
function remember(key, lines) {
  tileCache.delete(key);
  tileCache.set(key, lines);
  if (tileCache.size > CACHE_LIMIT) {
    const oldest = tileCache.keys().next().value;
    if (oldest !== void 0) tileCache.delete(oldest);
  }
}
function archiveFor(spec) {
  let pm = archives.get(spec.key);
  if (!pm) {
    pm = new w(new LocalFileSource(spec.file, spec.key));
    archives.set(spec.key, pm);
  }
  return pm;
}
async function onlineTemplate(url) {
  const cached = onlineTemplates.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`\u0421\u0435\u0440\u0432\u0435\u0440 \u043A\u0430\u0440\u0442 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D (HTTP ${res.status})`);
  const json = await res.json();
  const template = json.tiles?.[0];
  if (!template) throw new Error("\u0421\u0435\u0440\u0432\u0435\u0440 \u043A\u0430\u0440\u0442 \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0442\u0430\u0439\u043B\u043E\u0432");
  onlineTemplates.set(url, template);
  return template;
}
async function loadTiles(spec, xs, ys, z2) {
  const jobs = [];
  for (const y2 of ys) for (const x3 of xs) jobs.push([x3, y2]);
  const out = [];
  let next = 0;
  const sourceKey = spec.kind === "archive" ? spec.key : spec.tilejsonUrl;
  const template = spec.kind === "online" ? await onlineTemplate(spec.tilejsonUrl) : null;
  const pm = spec.kind === "archive" ? archiveFor(spec) : null;
  const worker = async () => {
    while (next < jobs.length) {
      const [x3, y2] = jobs[next++];
      const cacheKey = `${sourceKey}/${z2}/${x3}/${y2}`;
      let lines = tileCache.get(cacheKey);
      if (!lines) {
        let data = null;
        if (pm) {
          const tile = await pm.getZxy(z2, x3, y2);
          data = tile ? tile.data : null;
        } else if (template) {
          const res = await fetch(template.replace("{z}", String(z2)).replace("{x}", String(x3)).replace("{y}", String(y2)));
          if (!res.ok) throw new Error(`\u0422\u0430\u0439\u043B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D (HTTP ${res.status})`);
          data = await res.arrayBuffer();
        }
        lines = data ? decodeRoadTile(data, x3, y2, z2) : [];
        remember(cacheKey, lines);
      }
      for (const l of lines) out.push(l);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return out;
}
function userLines(input) {
  return input.map((u) => ({
    coords: u.coords,
    cls: "",
    sub: "",
    oneway: 0,
    access: {},
    user: { lineType: u.lineType, passability: u.passability }
  }));
}
async function handleRoute(req) {
  const [fx, fy] = req.from;
  const [tx, ty] = req.to;
  const span = Math.max(Math.abs(tx - fx), Math.abs(ty - fy));
  const margin = Math.max(0.01, span * 0.3);
  const w2 = Math.min(fx, tx) - margin;
  const e = Math.max(fx, tx) + margin;
  const s = Math.min(fy, ty) - margin;
  const n = Math.max(fy, ty) + margin;
  let z2 = ROUTE_ZOOM;
  if (req.source.kind === "archive") {
    const header = await archiveFor(req.source).getHeader();
    z2 = Math.min(ROUTE_ZOOM, header.maxZoom);
  }
  const r = tileRange(w2, s, e, n, z2);
  const xs = [];
  const ys = [];
  for (let x3 = r.x0; x3 <= r.x1; x3++) xs.push(x3);
  for (let y2 = r.y0; y2 <= r.y1; y2++) ys.push(y2);
  if (xs.length * ys.length > MAX_TILES) {
    throw new Error("\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043B\u0438\u043D\u043D\u044B\u0439 \u0434\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0431\u043E\u043B\u0435\u0435 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0443\u0447\u0430\u0441\u0442\u043E\u043A.");
  }
  const lines = await loadTiles(req.source, xs, ys, z2);
  lines.push(...userLines(req.user));
  const plan = planRoute(lines, req.from, req.to, req.profile);
  return {
    coords: plan.coords,
    distance: plan.distance,
    duration: plan.duration,
    profile: req.profile,
    from: req.from,
    to: req.to
  };
}
self.onmessage = (ev) => {
  const req = ev.data;
  handleRoute(req).then((result) => {
    const reply = { id: req.id, ok: true, result };
    self.postMessage(reply);
  }).catch((err2) => {
    const reply = {
      id: req.id,
      ok: false,
      error: err2 instanceof Error ? err2.message : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043C\u0430\u0440\u0448\u0440\u0443\u0442"
    };
    self.postMessage(reply);
  });
};
