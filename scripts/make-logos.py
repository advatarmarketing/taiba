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
import os, sys, re, hashlib, importlib.util

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(HERE)

# The PNG reader/writer and the resampler already exist, in the icon script.
# Importing them rather than copying them keeps one implementation of each.
spec = importlib.util.spec_from_file_location('mkicons', os.path.join(HERE, 'scripts', 'make-icons.py'))
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)

SOURCE = 'assets/logo-source.png'

# px trimmed off every edge before anything else. The first artwork arrived
# with a thin printed frame round it; the current one has none, and on a clean
# file this only ever removes blank margin, so it is cheap insurance either way.
INSET  = 5

# ---------------------------------------------------------------------------
# HOW BIG THE DELIVERED FILES ARE, and why they are not the source size.
#
# The source is as large as the client sent it, and should be — it is the
# master. What the BROWSER downloads is a different question, and getting it
# wrong is expensive in the one place it is least affordable: the arch is in
# the header of every single page.
#
# The arch is drawn at 38px tall (54px in the footer). The stacked logo is
# drawn at most 200px wide, on the loading panel. Shipping a 1050px-tall PNG
# for a 38px slot cost 528KB per visitor to throw away 96% of the pixels.
#
# So each delivered file is capped at roughly 3x the largest size it is ever
# drawn at — enough for the densest screen anyone has, and nothing beyond it.
# Raise a number here if a file starts being used somewhere bigger.
#
# The 1080 square masters are NOT capped: nothing on the site loads them. They
# are the social-media profile picture and the source the icons are built from.
# ---------------------------------------------------------------------------
MAX_MARK_HEIGHT = 420    # drawn at 38–54px
MAX_LOGO_WIDTH  = 640    # drawn at up to 200px wide

WHITE_CUTOFF = 250

if not os.path.exists(SOURCE):
    raise SystemExit(f'Cannot find {SOURCE} — the artwork as supplied, on white.')


# ------------------------------------------------------- white -> alpha ----
def key_out_white(w, h, px):
    """
    The artwork arrives on a white background. Make the white transparent, and
    give every pixel the colour of the ink it actually belongs to.

    COVERAGE comes from the darkest channel: white is 255 everywhere, so it
    gives 0; the navy gives ~0.98 and the gold ~0.93. That number becomes the
    alpha, and it is the only thing taken from the pixel's brightness.

    COLOUR is not un-premultiplied per pixel, and that is the change worth
    knowing about. Dividing the white back out of a barely-covered edge pixel
    divides by a number close to zero, which amplifies whatever noise the
    source encoding left behind: a file that is two colours came back with
    25,832 distinct RGBA values, all of them near-identical fringes like
    (0,128,128,4) beside (0,128,255,4). Invisible, and PNG cannot compress
    them, so the header's arch weighed 160KB.

    This logo IS two colours. So each pixel is assigned to the nearer of them
    and given that exact value, keeping its own alpha. Which ink is decided by
    the sign of (red - blue) on the ORIGINAL pixel, which survives all the way
    down to near-zero coverage: composited on white, navy always pulls blue
    above red and gold always the other way round, in proportion to how much
    ink is there.

    The result is ~500 distinct values instead of 25,832, cleaner edges with
    no colour fringing, and a file a fraction of the size. The inks are
    measured from the artwork rather than hard-coded, so this keeps working
    when the artwork changes.
    """
    # 1. Measure the two inks, from pixels solid enough to be trusted.
    sums = {'cold': [0, 0, 0, 0], 'warm': [0, 0, 0, 0]}
    for i in range(w * h):
        r, g, b = px[i*4], px[i*4+1], px[i*4+2]
        if 255 - min(r, g, b) < 200:
            continue
        key = 'warm' if r > b else 'cold'
        acc = sums[key]
        acc[0] += r; acc[1] += g; acc[2] += b; acc[3] += 1

    inks = {}
    for key, acc in sums.items():
        inks[key] = tuple(acc[c] // acc[3] for c in range(3)) if acc[3] else None
    if inks['cold'] is None and inks['warm'] is None:
        raise SystemExit('no ink found — is the source really artwork on white?')
    # A one-colour logo is perfectly legal; both names then point at it.
    inks['cold'] = inks['cold'] or inks['warm']
    inks['warm'] = inks['warm'] or inks['cold']
    print(f'  inks measured: cold #%02X%02X%02X   warm #%02X%02X%02X' % (*inks['cold'], *inks['warm']))

    # 2. Rebuild every pixel as "that ink, at this coverage".
    out = bytearray(w * h * 4)
    for i in range(w * h):
        r, g, b = px[i*4], px[i*4+1], px[i*4+2]
        a = 255 - min(r, g, b)
        if a <= 2:
            continue                      # leave it fully transparent
        out[i*4:i*4+3] = bytes(inks['warm' if r > b else 'cold'])
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
    to the pale gold the site uses on navy. Which is which is decided per pixel
    by hue: gold is warm (red above blue), navy is cold.

    The pale gold is READ OUT OF styles.css rather than written here. It was
    written here once, --gold-soft moved, and the reversed logo went out for
    two commits in a gold the site had stopped using — on the loading panel
    and in the footer, where it sits inches from elements painted in the real
    one.
    """
    GOLD = mk.token('--gold-soft')
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


def fit(w, h, px, *, max_width=None, max_height=None):
    """
    Shrink to fit inside a cap, keeping the shape. Never enlarges — a source
    smaller than the cap is already as good as it gets, and scaling it up
    would only make a bigger file out of the same detail.

    resize_area averages every source pixel that lands in a target pixel,
    which is the right filter for taking high-contrast line artwork a long way
    down. Sampling one pixel and discarding the rest breaks up a 3px gold
    hairline into dots.
    """
    scale = 1.0
    if max_width:  scale = min(scale, max_width / w)
    if max_height: scale = min(scale, max_height / h)
    if scale >= 1: return w, h, px

    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    return nw, nh, mk.resize_area(w, h, px, nw, nh)


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

# Shrink once, then reverse — so both variants come off the same resampled
# pixels and cannot end up a pixel different from each other.
sw, sh, small_arch = fit(aw, ah, arch, max_height=MAX_MARK_HEIGHT)
lw, lh, small_logo = fit(w, h, px, max_width=MAX_LOGO_WIDTH)

WRITE = [
    ('assets/mark-dark.png',   sw, sh, small_arch),
    ('assets/mark-light.png',  sw, sh, reverse_out(sw, sh, small_arch)),
    ('assets/logo-dark.png',   lw, lh, small_logo),
    ('assets/logo-light.png',  lw, lh, reverse_out(lw, lh, small_logo)),
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


# --------------------------------------------------------- Cache stamp ----
def stamp_references():
    """
    Put a content stamp on every link to these files, so a browser that has
    the old one knows to go and get the new one.

    THIS IS NOT HOUSEKEEPING. vercel.json caches /assets/ for an hour and then
    serves it STALE FOR A WEEK while it revalidates in the background — which
    is exactly right for files that never change, and exactly wrong the day
    they do. The filenames are fixed, so nothing in the request tells a
    browser that logo-light.png is not the logo-light.png it already has.

    New artwork therefore went live and nobody could see it: not the client,
    not a visitor who had been to the site in the previous week. The file was
    correct on the server the whole time.

    The stamp is the content's own hash, so it changes when — and only when —
    the artwork does. Rebuilding identical files rewrites nothing, and a
    rebuild that changes a single pixel busts every cache holding it.
    """
    # Everything under /assets/ that the site links to. The film is not built
    # by this script, but it lives under the same week-long cache and needs
    # busting for the same reason — so it is stamped with the rest.
    files = ['mark-dark.png', 'mark-light.png', 'logo-dark.png', 'logo-light.png', 'loader.mp4']
    files = [name for name in files if os.path.exists(f'assets/{name}')]

    digest = hashlib.sha1()
    for name in files:
        with open(f'assets/{name}', 'rb') as handle:
            digest.update(handle.read())
    stamp = digest.hexdigest()[:8]

    # /assets/<one of ours>, with or without a stamp already on it.
    pattern = re.compile(
        r'(/assets/(?:' + '|'.join(re.escape(name) for name in files) + r'))(?:\?v=[0-9a-f]+)?')

    for path in ('index.html', 'app.js'):
        with open(path, encoding='utf-8') as handle:
            before = handle.read()
        after = pattern.sub(lambda m: f'{m.group(1)}?v={stamp}', before)
        if after != before:
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(after)
            print(f'  stamped {path}')
    return stamp


print(f"\n  reversed artwork uses --gold-soft #%02X%02X%02X, read from styles.css" % mk.token('--gold-soft'))
print(f'  cache stamp ?v={stamp_references()}')
print('\nCHECK THE TOKENS: the inks printed above are what the artwork actually')
print('contains. --brand and --gold in styles.css should be those two values.')
print('\nNow run:  python3 scripts/make-icons.py')
