#!/usr/bin/env python3
"""
Rebuild the favicon and the app icons from the logo.

WHEN YOU NEED THIS: only when the logo artwork changes. The icons are
committed to the repository, so a normal deploy never runs it.

HOW TO RUN IT, from the website folder:

    python3 scripts/make-icons.py

It reads  assets/logo-square-light.png  (the WHITE ARCH on transparency,
written by scripts/make-logos.py)
and writes, into the project root:

    favicon.ico            16 + 32 + 48, for the browser tab
    favicon-16/32/48.png   the same three on their own
    icon-192.png           Android home screen
    icon-512.png           Android splash, and the app listing
    icon-maskable-512.png  Android again, with room for it to be cropped round
    apple-touch-icon.png   iPhone and iPad home screen

Every one is the arch in WHITE on a SOLID BRAND-NAVY tile. That is
deliberate, and worth not undoing:

  * A transparent icon is composited on black by iOS, so black lettering
    vanishes. A solid tile always works.
  * A dark browser tab strip does the same thing to a dark logo.
  * The navy tile is recognisable at 16px even when the fine gold lines
    inside the arch are not, which is most of what a favicon has to do.

  * It is the ARCH, not the whole logo: at 32px "ISLAMIC CENTRE" is four
    grey smudges, while an arch is still unmistakably an arch.

There are no dependencies — only Python's own zlib — so it runs on a Mac with
nothing installed.
"""
import struct, zlib, os, sys

# ---------------------------------------------------------------- PNG I/O --
def read_png(path):
    d = open(path, 'rb').read()
    pos, idat = 8, b''
    w = h = bd = ct = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]
        data = d[pos+8:pos+8+ln]
        if typ == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', data[:10])
        elif typ == b'IDAT': idat += data
        pos += 12 + ln
    if bd != 8: raise SystemExit(f'{path}: need 8-bit, got {bd}')
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    stride = w * ch
    out = bytearray(); prev = bytearray(stride); p = 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        for i in range(stride):
            a = line[i-ch] if i >= ch else 0
            b = prev[i]
            c = prev[i-ch] if i >= ch else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out += line; prev = line
    # normalise to RGBA
    if ch == 4: return w, h, bytes(out)
    px = bytearray(w*h*4)
    for i in range(w*h):
        if ch == 3: px[i*4:i*4+3] = out[i*3:i*3+3]; px[i*4+3] = 255
        elif ch == 1: px[i*4:i*4+3] = bytes([out[i]]*3); px[i*4+3] = 255
        else: px[i*4:i*4+3] = bytes([out[i*2]]*3); px[i*4+3] = out[i*2+1]
    return w, h, bytes(px)

def write_png(path, w, h, rgba):
    raw = b''.join(b'\x00' + rgba[y*w*4:(y+1)*w*4] for y in range(h))
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)

# ------------------------------------------------------------- Resampling --
def crop(w, h, px, x0, y0, x1, y1):
    cw, chh = x1-x0, y1-y0
    out = bytearray(cw*chh*4)
    for y in range(chh):
        s = ((y+y0)*w + x0)*4
        out[y*cw*4:(y+1)*cw*4] = px[s:s+cw*4]
    return cw, chh, bytes(out)

def resize_area(w, h, px, nw, nh):
    """Area-average downscale. The right filter for shrinking a high-contrast
    logo a long way — it averages every source pixel that lands in a target
    pixel, rather than sampling one and throwing the rest away."""
    out = bytearray(nw*nh*4)
    for ty in range(nh):
        sy0, sy1 = ty*h//nh, max(ty*h//nh + 1, (ty+1)*h//nh)
        for tx in range(nw):
            sx0, sx1 = tx*w//nw, max(tx*w//nw + 1, (tx+1)*w//nw)
            ar = ag = ab = aa = n = 0
            for sy in range(sy0, sy1):
                for sx in range(sx0, sx1):
                    i = (sy*w + sx)*4
                    a = px[i+3]
                    # premultiply, so transparent pixels don't drag colour in
                    ar += px[i]*a; ag += px[i+1]*a; ab += px[i+2]*a; aa += a; n += 1
            o = (ty*nw + tx)*4
            if aa:
                out[o]   = min(255, ar//aa)
                out[o+1] = min(255, ag//aa)
                out[o+2] = min(255, ab//aa)
            out[o+3] = aa//n
    return bytes(out)

def on_solid(w, h, px, bg):
    """Composite over an opaque background colour."""
    out = bytearray(w*h*4)
    for i in range(w*h):
        a = px[i*4+3]/255
        for c in range(3):
            out[i*4+c] = round(px[i*4+c]*a + bg[c]*(1-a))
        out[i*4+3] = 255
    return bytes(out)

def tile(src_w, src_h, src, size, bg, pad):
    """One square icon: the wordmark centred on a solid tile, with `pad` of
    the size left clear on the narrow axis."""
    inner = size * (1 - 2*pad)
    scale = min(inner/src_w, inner/src_h)
    tw, th = max(1, round(src_w*scale)), max(1, round(src_h*scale))
    small = resize_area(src_w, src_h, src, tw, th)
    out = bytearray()
    for _ in range(size*size):
        out += bytes(bg) + b'\xff'
    ox, oy = (size-tw)//2, (size-th)//2
    for y in range(th):
        for x in range(tw):
            i = (y*tw + x)*4
            a = small[i+3]/255
            o = ((y+oy)*size + (x+ox))*4
            for c in range(3):
                out[o+c] = round(small[i+c]*a + out[o+c]*(1-a))
    return bytes(out)

# ------------------------------------------------------------------- ICO ---
def write_ico(path, images):
    """images: list of (size, rgba). Each entry stored as a PNG, which every
    browser in use has understood for well over a decade."""
    blobs = []
    for size, rgba in images:
        raw = b''.join(b'\x00' + rgba[y*size*4:(y+1)*size*4] for y in range(size))
        def chunk(t, d):
            c = t + d
            return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        blobs.append(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(raw, 9))
                     + chunk(b'IEND', b''))
    out = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16*len(images)
    for (size, _), blob in zip(images, blobs):
        out += struct.pack('<BBBBHHII', size if size < 256 else 0, size if size < 256 else 0,
                           0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    open(path, 'wb').write(out + b''.join(blobs))

# ------------------------------------------------------------------ Build --
if __name__ == '__main__':
    HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(HERE)

    BRAND = (0x0A, 0x2C, 0x6C)          # --brand in styles.css
    SOURCE = 'assets/logo-square-light.png'

    if not os.path.exists(SOURCE):
        raise SystemExit(f'Cannot find {SOURCE}. It should be the white arch '
                         f'on a transparent square — run scripts/make-logos.py first.')

    w, h, px = read_png(SOURCE)

    # Find the artwork inside the square, so the padding below is ours to
    # choose rather than whatever the file happens to have.
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[((y*w + x)*4) + 3] > 16:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    cw, ch, mark = crop(w, h, px, minx, miny, maxx+1, maxy+1)
    print(f'artwork found at {cw}x{ch} inside a {w}x{h} file')

    # name -> (pixels, how much of the tile to leave clear round the edge)
    PLAIN = {
        'favicon-16.png': (16, 0.10),
        'favicon-32.png': (32, 0.10),
        'favicon-48.png': (48, 0.10),
        'icon-192.png': (192, 0.12),
        'icon-512.png': (512, 0.12),
        # iOS rounds the corners itself, so this file stays square — and it
        # must be opaque, or iOS puts it on black.
        'apple-touch-icon.png': (180, 0.14),
        # Android crops this one to whatever shape the launcher uses. Only the
        # middle 80% is guaranteed, and a circle inside that is tighter still,
        # so it gets much more room.
        'icon-maskable-512.png': (512, 0.26),
    }

    made = {}
    for name, (size, pad) in PLAIN.items():
        rgba = tile(cw, ch, mark, size, BRAND, pad)
        write_png(name, size, size, rgba)
        made[size] = rgba
        print(f'  wrote {name:24} {size}x{size}')

    write_ico('favicon.ico', [(16, made[16]), (32, made[32]), (48, made[48])])
    print(f'  wrote {"favicon.ico":24} 16 + 32 + 48')
    print('\nDone. Hard-refresh the browser (Shift + reload) to see a new favicon —')
    print('browsers hold on to the old one harder than almost anything else.')
