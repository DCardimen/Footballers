"""v106 THE KIT ON THE PORTRAIT — cut the team-colour mask for the main menu's
helmet portrait straight off the picture's own edges.

`public/menu/portrait_helmet.webp` is a photograph of a bare helmet: a matte grey
shell lit from behind-right, so its whole right/rear side is a warm gold rim against
a black ground, with a dark tinted visor behind the facemask.  The menu lays the
player's SECONDARY team colour over that picture through the alpha of
`public/menu/portrait_helmet_mask_s.webp` (see `tint()` in `public/rib-menu.js`),
so the mask has to answer one question per pixel: is this the helmet, or not.

The old mask was a plain colour key (`neutral(por, .35, 48, 255)`), and a key cannot
answer it: the lit side of the shell reads lum 22..40 and the glow in the black
behind it reads 14..26, so no threshold separates them, and the tinted visor reads
darker than either — the whole gold flank stayed grey and the visor's reflections
went team-coloured.

What separates them is geometry, not colour:

  * THE SILHOUETTE IS A RIM.  Every outer edge of the shell — crown, front, the
    whole rear flank — is marked by a bright line (the crown is lit at 120..160,
    the flank carries the gold rim at 100..220) and the ground outside falls to
    <30 within three pixels.  So a radial scan out of the shell's centre, taking
    the OUTERMOST sample over 48, lands on the true outline to about a pixel,
    all the way round the 222 degrees where the rim is the outermost thing.
  * THE REST IS TRACED.  Over the remaining arc the outermost bright thing is the
    facemask (front) or the neck (bottom), so that stretch — the shell's bottom lip,
    the jaw, and the notches around the visor's two brow wings — is a hand-traced
    curve in per-cent-free 640-space, `CUT`.
  * THE FACEMASK IS A LATTICE OF TUBES.  Each bar is a dark tube with a lit edge a
    few pixels wide; the visor behind it is a smooth field forty pixels across.  A
    white top-hat (opening radius 12, so its element is 25 across) keeps everything
    narrower than itself and throws away everything wider, so it keeps the bars' lit
    edges and drops the glass and the long reflection down it.  A closing across each
    tube walks its dark core shut between its own two edges, and a closing ALONG the
    tube — a one-pixel rule at eight angles — carries it over the stretch where its
    lit edge fades into the ground.

What is kit and what is not: the whole shell, out to the true silhouette, with its
vents, its ear hole, its clips and snaps, the rear rim, the chin-strap buckle, and
the facemask bars.  The tinted glass, the chin-strap cup, the interior padding, the
neck below the shell and the black ground all stay at alpha zero.

    python3 scripts/menu-kit-portrait.py        (from the repo root)

Writes public/menu/portrait_helmet_mask_s.webp (320x320 RGBA, RGB zero, alpha the
mask) and prints its own report.  When MENU_KIT_DEBUG names a directory that exists
it also writes an overlay and a zoomed crop of every edge there; if it does not, the
script simply writes no pictures, so a build machine never trips over it.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

SRC_ART = 'art/menu/portrait_helmet.png'      # the original render
SHIPPED = 'public/menu/portrait_helmet.webp'  # what the menu shows (640x640)
OUT = 'public/menu/portrait_helmet_mask_s.webp'
DEBUG_DIR = os.environ.get('MENU_KIT_DEBUG', '')

# the picture build-menu-art.py cuts: crop, centred in a square, resized to 640.
CROP, SQUARE, PASTE = (94, 64, 1202, 1177), 1113, (2, 0)
N = SQUARE                      # we segment at the crop's own resolution (1.74x the
S = N / 640.0                   # shipped picture) and only then step down to 320


# ---------------------------------------------------------------- the picture ----
def source():
    """The shipped 640 picture at its pre-resize resolution, so the trace has room."""
    if os.path.exists(SRC_ART):
        c = Image.open(SRC_ART).convert('RGB').crop(CROP)
        sq = Image.new('RGB', (N, N), (4, 4, 6)); sq.paste(c, PASTE)
        return sq
    return Image.open(SHIPPED).convert('RGB').resize((N, N), Image.LANCZOS)


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def poly(pts):
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).polygon([(x * S, y * S) for x, y in pts], fill=255)
    return np.asarray(m) > 0


# ------------------------------------------------- 1. the shell's outer arc ------
# The centre only has to see every rim point on its own ray; the shell spans
# x 127..605, y 32..520 in 640-space, so its middle does.  ARC0..ARC1 are the angles
# (atan2 in screen space, so +90 is DOWN) where the rim is the outermost bright
# thing: from the front brow, up over the crown, down the flank, to the rear jaw.
ARC_C, ARC0, ARC1, ARC_T = (370.0, 260.0), 185.7, 407.9, 48.0


def outer_arc(lum):
    cx, cy = ARC_C[0] * S, ARC_C[1] * S
    angs = np.linspace(ARC0, ARC1, 1600)
    rr = np.arange(40, 720, 0.5)
    out = []
    for a in angs:
        t = np.radians(a)
        xs, ys = cx + np.cos(t) * rr, cy + np.sin(t) * rr
        ok = (xs >= 0) & (xs < N) & (ys >= 0) & (ys < N)
        v = np.zeros(rr.shape)
        v[ok] = ndi.map_coordinates(lum, [ys[ok], xs[ok]], order=1)
        i = np.nonzero(v > ARC_T)[0]
        out.append(rr[i.max()] if len(i) else 0.0)
    out = ndi.median_filter(np.array(out), 9)          # one stray sample is not an edge
    return [(cx + np.cos(np.radians(a)) * r, cy + np.sin(np.radians(a)) * r)
            for a, r in zip(angs, out)]


# --------------------------------------------- 2. the traced lower boundary ------
# Read off the picture at 640, clockwise from where the arc stops (the rear jaw)
# back to where it starts (the front brow): the bottom lip over the neck, the jaw
# up the visor's edge, then the two notches that keep the visor's brow wings out
# while keeping the shell tongue between them and the clips on the shell.
CUT = [
    (572, 484), (564, 486), (556, 484), (548, 482), (542, 481), (543, 487),   # rear jaw:
    (539, 493), (534, 498), (527, 503), (518, 507), (508, 512), (497, 517),   # the strap's
    (487, 520), (478, 522), (465, 524), (452, 529), (438, 534),   # bottom lip  # gold hook
    (425, 538), (410, 542), (395, 544), (380, 544), (365, 542), (350, 539),
    (340, 532), (340, 520), (337, 500), (338, 478), (344, 458), (351, 438),   # the jaw
    (356, 415), (358, 390), (357, 360), (356, 330), (354, 300), (353, 270),
    (352, 250), (348, 248), (345, 240), (341, 230), (335, 221), (325, 214),   # wing 2
    (312, 210), (298, 208), (285, 209), (272, 214), (260, 222), (250, 232),
    (247, 238), (230, 237), (210, 236), (203, 240), (202, 258), (178, 261),   # the tongue
    (164, 258), (162, 238), (162, 215), (163, 203), (155, 198), (145, 195),   # wing 1
    (133, 193), (122, 194), (112, 197), (104, 201), (100, 212), (98, 232),
    (94, 248), (84, 254), (74, 248),
]

# --------------------------------------------------- 3. the facemask's room ------
# Everything the lattice can reach, and nothing the neck can: the bars run out to
# x 10 on the left and off the bottom of the frame, the neck starts under x 440.
FM_ZONE = [(0, 185), (140, 168), (300, 180), (380, 205), (420, 300), (440, 430),
           (440, 470), (440, 510), (420, 545), (390, 590), (350, 630), (250, 648),
           (60, 648), (0, 560)]

# the tinted glass, generously inside its own frame: below the top bar, in to the
# side bar.  Nothing in here is shell, and the bars that cross it are near-black, so
# inside this outline nothing survives that the top-hat did not itself see as a bar.
# It is what keeps the long soft reflection down the glass out of the mask.
VISOR = [(75, 262), (120, 252), (200, 250), (280, 252), (340, 262), (352, 300),
         (352, 400), (345, 440), (320, 465), (250, 478), (170, 478), (110, 470),
         (75, 440), (65, 380), (66, 320)]

# the chin-strap cup: glossy leather under the shell, with a broad soft highlight
# the top-hat cannot tell from a bar.  Named, so it stays out.
CHIN = [(133, 545), (150, 530), (175, 522), (205, 522), (240, 528), (275, 540),
        (305, 553), (325, 566), (332, 580), (325, 592), (300, 600), (265, 602),
        (225, 597), (190, 586), (160, 570), (140, 558)]

# a tube is 15..25px across here and the reflection down the glass is 40, so the
# top-hat's structuring element goes between them: radius 12, diameter 25.
TOP_R, TOP_T, CLOSE_R, RUN_L = 12, 12, 6, 17


def line(length, deg):
    """A one-pixel rule at `deg`, for closing a bar ALONG itself."""
    se = np.zeros((length, length), bool); c = length // 2
    for t in np.linspace(-c, c, 4 * length):
        se[int(round(c + t * np.sin(np.radians(deg)))),
           int(round(c + t * np.cos(np.radians(deg))))] = True
    return se


def facemask(lum, shell):
    fz = poly(FM_ZONE)
    top = lum - ndi.grey_opening(lum, footprint=disk(TOP_R))
    seed = (top > TOP_T) & fz
    bars = ndi.binary_closing(seed, disk(CLOSE_R)) & fz     # across: walk a tube shut
    bars = ndi.binary_opening(bars, disk(2))                # drop the render's speckle
    run = bars.copy()                                       # along: carry a tube over
    for deg in range(0, 180, 22):                           # the stretch where its
        run |= ndi.binary_closing(bars, line(RUN_L, deg))   # lit edge fades out
    bars = ndi.binary_closing(run & fz, disk(3))
    glass = poly(VISOR) & ~ndi.binary_closing(seed, disk(8))
    return bars & ~glass & ~poly(CHIN) & ~shell


# ------------------------------------------------------------------- the mask ----
def build():
    im = source()
    lum = np.asarray(im).astype(float).mean(2)
    shell = poly([(p[0] / S, p[1] / S) for p in outer_arc(lum)] + CUT)
    mask = shell | facemask(lum, shell)
    mask = ndi.binary_closing(mask, disk(2))
    mask = ndi.binary_opening(mask, disk(2))
    lab, n = ndi.label(mask)                                # keep the helmet, drop dust
    if n:
        area = np.bincount(lab.ravel())
        mask = np.isin(lab, [i for i in range(1, n + 1) if area[i] > 400])
    return im, lum, shell, mask


def finish(mask):
    """Same shape as build-menu-art.py's finish(): RGB zero, alpha the mask.

    A two-pixel push at full res and a one-pixel pull at half res, which very nearly
    cancel: the blur is symmetric, so a pull alone would stop the tint two pixels
    short of the gold rim, and a push alone would put 29/255 of it on the ground
    behind the rim.  Together the rim is carried and the ground two pixels out
    reads 5."""
    m = ndi.binary_dilation(mask, disk(2))
    m = Image.fromarray((m * 255).astype('uint8'), 'L').resize((320, 320), Image.LANCZOS)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = Image.new('RGBA', (320, 320), (0, 0, 0, 0)); rgba.putalpha(m)
    rgba.save(OUT, 'WEBP', quality=80, method=6)
    return np.asarray(m)


# ------------------------------------------------------------------- checking ----
def report(im, lum, shell, mask, alpha):
    """Three numbers decide it: nothing on the ground, nothing on the glass,
    nothing missing on the shell."""
    a = alpha.astype(int)
    sil = np.asarray(Image.fromarray((mask * 255).astype('uint8'), 'L')
                     .resize((320, 320), Image.LANCZOS)) > 127
    outside = int(a[~ndi.binary_dilation(sil, disk(2))].max())   # the blur's own 2px
    far = int(a[~ndi.binary_dilation(sil, disk(4))].max())
    # the ground the eye can actually see: black, and more than a tube's width from
    # anything the picture draws — a bar's own unlit half is not the ground
    dist = ndi.distance_transform_edt(~((lum > 26) | shell))
    dark = (lum < 22) & (dist > 14)
    d320 = np.asarray(Image.fromarray((dark * 255).astype('uint8'), 'L')
                      .resize((320, 320), Image.LANCZOS)) > 200
    ground = float((a[d320] > 32).mean()) if d320.any() else 0.0
    # the glass: inside the visor outline and away from any bar the top-hat found
    top = lum - ndi.grey_opening(lum, footprint=disk(TOP_R))
    gl = poly(VISOR) & ~ndi.binary_dilation(top > TOP_T, disk(10))
    g320 = np.asarray(Image.fromarray((gl * 255).astype('uint8'), 'L')
                      .resize((320, 320), Image.LANCZOS)) > 200
    glass = int(a[g320].max()) if g320.any() else 0
    # the shell itself at 640, matte crown and warm-lit flank counted apart
    a640 = np.asarray(Image.fromarray(alpha, 'L').resize((640, 640), Image.BILINEAR))
    lo = np.asarray(Image.fromarray((shell * 255).astype('uint8'), 'L')
                    .resize((640, 640), Image.BILINEAR)) > 200
    lo = ndi.binary_erosion(lo, disk(2))               # the shell, not its soft edge
    l640 = np.asarray(im.resize((640, 640), Image.LANCZOS)).astype(float).mean(2)
    matte, lit = lo & (l640 > 80), lo & (l640 <= 80)
    cov = lambda sel: float((a640[sel] > 128).mean()) if sel.any() else 1.0
    print(f'mask {OUT}  {os.path.getsize(OUT) // 1024} KB  320x320 RGBA')
    print(f'  alpha 2px outside the outline (max)  {outside}/255   (must be <= 8)')
    print(f'  alpha 4px outside the outline (max)  {far}/255   (must be 0)')
    print(f'  black ground carrying any tint       {ground * 100:.3f}%   (must be < 0.2%)')
    print(f'  alpha on the visor glass (max)       {glass}/255   (must be <= 8)')
    print(f'  shell covered, matte side            {cov(matte) * 100:.2f}%  ({matte.sum()} px)')
    print(f'  shell covered, warm-lit side         {cov(lit) * 100:.2f}%  ({lit.sum()} px)')
    print(f'  mask area                            {(a > 128).mean() * 100:.2f}% of the frame')
    assert outside <= 8, f'the mask bleeds into the ground (alpha {outside})'
    assert far == 0, f'the mask bleeds well outside the outline (alpha {far})'
    assert ground < 0.002, f'the mask lands on the black ground ({ground * 100:.2f}%)'
    assert glass <= 8, f'the mask lands on the visor glass (alpha {glass})'
    assert cov(matte) > 0.99 and cov(lit) > 0.99, 'the shell is not fully covered'


def debug(im, alpha):
    if not os.path.isdir(DEBUG_DIR):
        return
    big = np.asarray(im.resize((640, 640), Image.LANCZOS)).astype(float)
    a = np.asarray(Image.fromarray(alpha, 'L').resize((640, 640), Image.BILINEAR)).astype(float)[..., None] / 255.
    ov = big * (1 - a * 0.75) + np.array([40, 120, 255]) * (a * 0.75)
    ov = Image.fromarray(ov.astype('uint8'))
    p = os.path.join(DEBUG_DIR, 'portrait_final_overlay.png'); ov.save(p)
    print(f'  overlay  {p}')
    for name, box, z in [('crown', (230, 10, 400, 90), 6), ('rim', (545, 150, 625, 400), 6),
                         ('rear', (490, 420, 620, 540), 7), ('earhole', (430, 330, 560, 470), 6),
                         ('visor', (60, 230, 380, 480), 3), ('brow', (70, 175, 380, 300), 4),
                         ('bottom', (300, 460, 560, 570), 5), ('front', (0, 380, 140, 640), 4)]:
        c = ov.crop(box)
        c = c.resize((int(c.width * z), int(c.height * z)), Image.NEAREST)
        q = os.path.join(DEBUG_DIR, f'portrait_edge_{name}.png'); c.save(q)
        print(f'  edge     {q}')


if __name__ == '__main__':
    im, lum, shell, mask = build()
    alpha = finish(mask)
    report(im, lum, shell, mask, alpha)
    debug(im, alpha)
