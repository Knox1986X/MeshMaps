#!/usr/bin/env python3
"""
Build offline MapLibre glyph PBFs (SDF) from TTF fonts, without native deps.

  python3 tools/build-glyphs.py            # downloads Noto Sans (OFL) if missing
  -> public/fonts/<Font Name>/<start>-<end>.pbf

Format: mapbox glyphs.proto (fontstack{name,range,glyph{id,bitmap,w,h,left,top,advance}}),
SDF parameters identical to fontnik defaults: size 24, buffer 3, radius 8, cutoff 0.25.
Requires: freetype-py, numpy, scipy (see tools/requirements.txt).
"""
import io, os, sys, tarfile, urllib.request
import numpy as np
import freetype
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'tools', 'fonts-src')
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')
FONT_TARBALL = 'https://codeload.github.com/openmaptiles/fonts/tar.gz/refs/heads/master'

SIZE, BUFFER, RADIUS, CUTOFF = 24, 3, 8, 0.25
RANGES = [(0, 255), (256, 511), (512, 767), (768, 1023), (1024, 1279), (8192, 8447), (8448, 8703)]

# name shown in style, source file
FONTS = [
    ('Noto Sans Regular', 'NotoSans-Regular.ttf'),
    ('Noto Sans Bold', 'NotoSans-Bold.ttf'),
    ('Noto Sans Italic', 'NotoSans-Italic.ttf'),
]


def ensure_sources():
    os.makedirs(SRC_DIR, exist_ok=True)
    missing = [f for _, f in FONTS if not os.path.exists(os.path.join(SRC_DIR, f))]
    if not missing:
        return
    print('downloading Noto Sans (OFL) from openmaptiles/fonts ...')
    data = urllib.request.urlopen(FONT_TARBALL, timeout=300).read()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tf:
        for member in tf.getmembers():
            base = os.path.basename(member.name)
            if member.name.startswith('fonts-master/noto-sans/') and base in [f for _, f in FONTS]:
                with tf.extractfile(member) as src, open(os.path.join(SRC_DIR, base), 'wb') as dst:
                    dst.write(src.read())
            if member.name.startswith('fonts-master/noto-sans/LICENSE'):
                with tf.extractfile(member) as src, open(os.path.join(SRC_DIR, 'LICENSE-NotoSans.txt'), 'wb') as dst:
                    dst.write(src.read())


# ---------- minimal protobuf encoder ----------
def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def key(field, wire):
    return varint((field << 3) | wire)


def f_varint(field, value):
    return key(field, 0) + varint(value)


def f_sint(field, value):  # zigzag
    return key(field, 0) + varint((value << 1) ^ (value >> 63) if value >= 0 else ((-value) << 1) - 1)


def f_bytes(field, data):
    return key(field, 2) + varint(len(data)) + data


def encode_glyph(g):
    buf = f_varint(1, g['id'])
    if g['bitmap']:
        buf += f_bytes(2, g['bitmap'])
    buf += f_varint(3, g['w']) + f_varint(4, g['h'])
    buf += f_sint(5, g['left']) + f_sint(6, g['top']) + f_varint(7, g['advance'])
    return buf


def encode_stack(name, rng, glyphs):
    buf = f_bytes(1, name.encode('utf-8')) + f_bytes(2, rng.encode('ascii'))
    for g in glyphs:
        buf += f_bytes(3, encode_glyph(g))
    return buf


def sdf_from_alpha(alpha):
    """alpha: uint8 HxW coverage. Returns uint8 SDF bitmap padded by BUFFER."""
    pad = BUFFER + RADIUS + 2
    a = np.pad(alpha, pad, mode='constant', constant_values=0)
    inside = a >= 128
    if not inside.any():
        return None
    dist_out = ndimage.distance_transform_edt(~inside)
    dist_in = ndimage.distance_transform_edt(inside)
    signed = dist_out - dist_in  # >0 outside, <0 inside
    val = 255.0 * (1.0 - (signed / RADIUS + CUTOFF))
    val = np.clip(np.round(val), 0, 255).astype(np.uint8)
    # crop to the glyph bbox + BUFFER
    ys, xs = np.where(inside)
    y0, y1 = ys.min() - BUFFER, ys.max() + BUFFER + 1
    x0, x1 = xs.min() - BUFFER, xs.max() + BUFFER + 1
    return val[y0:y1, x0:x1], (x0 - pad), (y0 - pad)  # dx, dy: crop origin in freetype bitmap coords


def build_font(name, path):
    face = freetype.Face(path)
    face.set_pixel_sizes(0, SIZE)
    charmap_cps = []
    cp, idx = face.get_first_char()
    while idx:
        charmap_cps.append(cp)
        cp, idx = face.get_next_char(cp, idx)
    cps = set(charmap_cps)
    os.makedirs(os.path.join(OUT_DIR, name), exist_ok=True)
    written = 0
    for start, end in RANGES:
        glyphs = []
        for c in range(start, end + 1):
            if c not in cps:
                continue
            face.load_char(c, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_NORMAL)
            slot = face.glyph
            advance = int(round(slot.advance.x / 64.0))
            bm = slot.bitmap
            gid = face.get_char_index(c)
            if bm.rows == 0 or bm.width == 0:
                glyphs.append({'id': c, 'bitmap': b'', 'w': 0, 'h': 0,
                               'left': 0, 'top': 0, 'advance': advance})
                continue
            alpha = np.array(bm.buffer, dtype=np.uint8).reshape(bm.rows, bm.pitch)[:, :bm.width]
            res = sdf_from_alpha(alpha)
            if res is None:
                glyphs.append({'id': c, 'bitmap': b'', 'w': 0, 'h': 0,
                               'left': 0, 'top': 0, 'advance': advance})
                continue
            sdf, dx, dy = res
            # bitmap top-left (incl. buffer) sits at (bitmap_left + dx, bitmap_top - dy);
            # MapLibre metrics refer to the visible glyph box, i.e. without buffer.
            left = slot.bitmap_left + dx + BUFFER
            top = slot.bitmap_top - dy - BUFFER
            h, w = sdf.shape
            glyphs.append({'id': c, 'bitmap': sdf.tobytes(), 'w': w - 2 * BUFFER, 'h': h - 2 * BUFFER,
                           'left': left, 'top': top, 'advance': advance})
        if not glyphs:
            continue
        payload = f_bytes(1, encode_stack(name, f'{start}-{end}', glyphs))
        out_path = os.path.join(OUT_DIR, name, f'{start}-{end}.pbf')
        with open(out_path, 'wb') as f:
            f.write(payload)
        written += 1
        print(f'  {name} {start}-{end}: {len(glyphs)} glyphs, {len(payload)//1024} KB')
    return written


def main():
    ensure_sources()
    total = 0
    for name, fname in FONTS:
        p = os.path.join(SRC_DIR, fname)
        if not os.path.exists(p):
            print('skip missing', p, file=sys.stderr)
            continue
        total += build_font(name, p)
    print(f'done: {total} range files in {OUT_DIR}')


if __name__ == '__main__':
    main()
