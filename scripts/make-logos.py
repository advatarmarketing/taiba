#!/usr/bin/env python3
"""
Rebuild every logo file in assets/ from the artwork as it was supplied.

WHEN YOU NEED THIS: only when the artwork changes. Everything it writes is
committed to the repository, so a normal deploy never runs it.

HOW TO RUN IT, from the website folder:

    python3 scripts/make-logos.py
    python3 scripts/make-icons.py      # then rebuild the app icons

It reads  assets/logo-source.png  — the artwork exactly as the client sent it:
the arch, the wordmark and the diamond rule, in navy and gold, on WHITE, with
a thin frame round the edge. Everything below is worked out from that one
file, so replacing it and running this again is the whole job.

WHAT IT WRITES

  mark-dark.png          the arch on its own, navy + gold      (for the page)
  mark-light.png         the arch on its own, white + pale gold (for navy)
  logo-dark.png          the complete stacked logo, as supplied
  logo-light.png         the complete stacked logo, reversed out
  logo-square-dark.png   1080x1080 master, the complete logo centred
  logo-square-light.png  1080x1080 master, THE ARCH ONLY, in white

All of them are transparent PNGs trimmed tight to the artwork, because the
header and the footer size the logo by its HEIGHT — padding baked into the
file would shrink the artwork inside it with no way to get it back from CSS.

WHY THE ARCH IS SPLIT OUT

The header does NOT use a picture of the wordmark. "TAIBA / ISLAMIC CENTRE"
is set as live text beside the arch (see brandMark() in app.js), in the same
serif the headings use. The supplied artwork is 627px wide, which leaves the
two words about 14px tall — enough for the stacked logo on the loading panel,
nowhere near enough for crisp lettering in a 36px header on a retina screen.
Live text is sharp at every size, scales with the layout, and is selectable
and readable to a search engine. So the arch travels as a picture and the
name travels as type.

logo-square-light.png is the arch alone for the same reason: it is the master
the app icons are built from, and at 32px a wordmark is mush while an arch is
still an arch.

There are no dependencies — only Python's own zlib — so it runs on a Mac with
nothing installed.
"""
import os, sys, importlib.util

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(HERE)

# The PNG reader/writer and the resampler already exist, in the icon script.
# Importing them rather than copying them keeps one implementation of each.
spec = importlib.util.spec_from_file_location('mkicons', os.path.join(HERE, 'scripts', 'make-icons.py'))
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)

SOURCE = 'assets/logo-source.png'
INSET  = 5      # px of frame to throw away on every edge before anything else
WHITE_CUTOFF = 250

if not os.path.exists(SOURCE):
    raise SystemExit(f'Cannot find {SOURCE} — the artwork as supplied, on white.')


# ------------------------------------------------------- white -> alpha ----
def key_out_white(w, h, px):
    """
    The artwork arrives on a white background. Make the white transparent and
    keep the ink, including the soft grey edges the JPEG left behind.

    Coverage is taken from the DARKEST channel: white is 255 everywhere, so it
    gives 0; navy (10,44,108) gives 0.96; gold (181,129,41) gives 0.94. The
    colour is then un-premultiplied — divided back out of the white it was
    blended with — so a half-covered edge pixel keeps the full-strength ink
    colour and only its alpha says it is an edge. Without that step every
    outline comes back pale and the whole logo looks washed out.
    """
    out = bytearray(w * h * 4)
    for i in range(w * h):
        r, g, b = px[i*4], px[i*4+1], px[i*4+2]
        a = 255 - min(r, g, b)
        if a <= 2:
            continue                      # leave it fully transparent
        f = a / 255
        for c in range(3):
            v = (px[i*4+c] - 255 * (1 - f)) / f
            out[i*4+c] = max(0, min(255, round(v)))
        out[i*4+3] = a
    return bytes(out)


def trim(w, h, px, threshold=8):
    """Crop away every fully (or nearly) transparent row and column."""
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[(y*w + x)*4 + 3] > threshold:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        raise SystemExit('nothing but transparency — is the source really on white?')
    return mk.crop(w, h, px, minx, miny, maxx + 1, maxy + 1)


def row_gaps(w, h, px, threshold=24):
    """
    Rows with no ink in them, as (start, end) pairs. Used to find where the
    arch stops and the lettering starts.

    The threshold is 24 rather than 0 on purpose. The artwork arrived as a
    JPEG, and JPEG leaves a haze of very faint pixels around every hard edge —
    at a threshold of 8 the gap under the arch is not empty at all and the
    bands cannot be told apart. 24 ignores the haze and still finds nothing in
    the gaps, which is the whole job.
    """
    empty = [not any(px[(y*w + x)*4 + 3] > threshold for x in range(w)) for y in range(h)]
    gaps, run = [], None
    for y, blank in enumerate(empty):
        if blank and run is None: run = y
        if not blank and run is not None:
            gaps.append((run, y - 1)); run = None
    if run is not None: gaps.append((run, h - 1))
    return gaps


# ------------------------------------------------------------- recolour ----
def reverse_out(w, h, px):
    """
    The logo for a dark background.

    NOT a flat "make everything white" — that throws away half the logo. The
    navy lines are the ones that vanish against a navy panel, so those become
    white; the gold is already light enough to read and only comes up a little,
    to the pale gold the site uses for small text on navy. Which is which is
    decided per pixel by hue: gold is warm (red above blue), navy is cold.
    """
    GOLD = (226, 193, 133)     # --gold-soft
    out = bytearray(px)
    for i in range(w * h):
        a = px[i*4+3]
        if not a:
            continue
        r, b = px[i*4], px[i*4+2]
        tint = GOLD if r > b + 20 else (255, 255, 255)
        out[i*4:i*4+3] = bytes(tint)
    return bytes(out)


def whiten(w, h, px):
    """Everything white, keeping the shape. The master the app icons use."""
    out = bytearray(px)
    for i in range(w * h):
        if px[i*4+3]:
            out[i*4:i*4+3] = b'\xff\xff\xff'
    return bytes(out)


def square(w, h, px, size, pad):
    """The artwork centred on a transparent square, `pad` of it left clear."""
    inner = size * (1 - 2*pad)
    scale = min(inner/w, inner/h)
    tw, th = max(1, round(w*scale)), max(1, round(h*scale))
    small = mk.resize_area(w, h, px, tw, th)
    out = bytearray(size*size*4)
    ox, oy = (size-tw)//2, (size-th)//2
    for y in range(th):
        src = y*tw*4
        dst = ((y+oy)*size + ox)*4
        out[dst:dst+tw*4] = small[src:src+tw*4]
    return bytes(out)


# ------------------------------------------------------------------ build --
W, H, RAW = mk.read_png(SOURCE)
w, h, px = mk.crop(W, H, RAW, INSET, INSET, W-INSET, H-INSET)
px = key_out_white(w, h, px)
w, h, px = trim(w, h, px)
print(f'artwork trimmed to {w}x{h}')

# The bands, top to bottom: the arch, TAIBA, ISLAMIC CENTRE, the diamond rule.
# The first real gap is the one under the arch — everything below it is type.
# A gap touching the very top is the same JPEG haze at the edge of the file,
# not a band boundary, so it is dropped before the first real one is taken.
gaps = [g for g in row_gaps(w, h, px) if g[1] - g[0] >= 5 and g[0] > 0]
if not gaps:
    raise SystemExit('could not find the gap under the arch')
arch_end = gaps[0][0]
print(f'arch is rows 0-{arch_end-1}; the wordmark starts at {gaps[0][1]+1}')

aw, ah, arch = trim(*mk.crop(w, h, px, 0, 0, w, arch_end))
print(f'  arch      {aw}x{ah}')

WRITE = [
    ('assets/mark-dark.png',   aw, ah, arch),
    ('assets/mark-light.png',  aw, ah, reverse_out(aw, ah, arch)),
    ('assets/logo-dark.png',   w,  h,  px),
    ('assets/logo-light.png',  w,  h,  reverse_out(w, h, px)),
]
for path, pw, ph, data in WRITE:
    mk.write_png(path, pw, ph, data)
    print(f'  wrote {path:32} {pw}x{ph}')

# The two 1080 masters. The dark one is the whole logo, for a social profile
# picture; the light one is the arch alone, because make-icons.py builds the
# favicon and the home-screen icons from it.
mk.write_png('assets/logo-square-dark.png', 1080, 1080, square(w, h, px, 1080, 0.10))
print('  wrote assets/logo-square-dark.png     1080x1080  (whole logo, in colour)')
mk.write_png('assets/logo-square-light.png', 1080, 1080,
             square(aw, ah, whiten(aw, ah, arch), 1080, 0.14))
print('  wrote assets/logo-square-light.png    1080x1080  (the arch, in white)')

print('\nNow run:  python3 scripts/make-icons.py')
