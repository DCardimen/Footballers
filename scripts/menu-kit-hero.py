"""v106 THE KIT IS CUT FROM THE PHOTOGRAPH — the hero picture's team-colour masks.

`art/menu/hero_tunnel_wall.png` is a photograph; the menu lays the team's colours over it
through two alpha masks, `_p` (PRIMARY — the jersey) and `_s` (SECONDARY — helmet and pants).
Hand-placed polygons were never going to land on a photographed outline: they spilled past
both sleeves onto the tunnel, ran the pants wide of the hips, and left the shoulder band and
the sleeve hems grey. Nor can a colour key do it — the tunnel light is warm enough that lit
grey fabric reads as chromatic as skin (the right sleeve's rim is chroma 91, the arm 57).

So the outline is MEASURED off the picture. Every garment is bounded by four curves, and every
point on every curve is snapped to the real luminance step under it: a rough hand guess says
where to look (within a radius given in percent), a 1-D scan across the boundary finds the
OUTERMOST strong step inside that window — outermost, so a lit rim on the fabric's own edge
counts as fabric — and a median filter over the walk kills the odd outlier. The garment is then
the set of pixels inside its row span AND between its top and bottom curves; the jersey and the
pants share one waist curve, so they meet with no grey gap and no overlap past the anti-alias.

What is kit and what is not: `_p` is every thread of jersey — both sleeves out to and including
the hems, the collar and the lit shoulder band — down to the hem where the pants start. `_s` is
the shell with its lit rim, its clips and chinstrap, and the pants from the belt to the bottom
of the frame. Skin, gloves, the black gap over the neck under the helmet, the lit tunnel floor
that shows between an arm and the torso: all of it stays at alpha zero.

    python3 scripts/menu-kit-hero.py          # from the repo root

Writes public/menu/hero_mask_{p,s}.webp (RGBA, half the source resolution, RGB zero) and, when
MENU_KIT_DEBUG names a directory that exists, an overlay and zoomed crops of every edge. It
prints its own report: the coverage, the anti-aliasing ramp measured in source pixels outside the
traced line, and every probe point scripts/menu-mask-check.mjs holds for this picture — including
the two of them (`rightSleeve`, `hipRight`) that land off the garment in the photograph itself;
PROBES_MISPLACED is where such a probe is listed, with the point it should have.
"""
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter1d, median_filter
import numpy as np, os

SRC = 'art/menu/hero_tunnel_wall.png'
OUT = 'public/menu'
# where the overlay and the edge crops go. Point MENU_KIT_DEBUG anywhere; if the directory does
# not exist the script simply writes no pictures, so a build machine never trips over it.
DEBUG = os.environ.get('MENU_KIT_DEBUG', '')

_img = Image.open(SRC).convert('RGB')
W, H = _img.size
LUM = np.asarray(_img).astype(float).mean(2)


# ---------------------------------------------------------------- edge snapping
def _ray(p0, p1, step=0.25):
    """Bilinear luminance along a segment given in PIXELS."""
    n = max(9, int(np.hypot(p1[0] - p0[0], p1[1] - p0[1]) / step) + 1)
    t = np.linspace(0, 1, n)
    x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
    x0 = np.clip(np.floor(x).astype(int), 0, W - 2); y0 = np.clip(np.floor(y).astype(int), 0, H - 2)
    fx, fy = x - x0, y - y0
    v = (LUM[y0, x0] * (1 - fx) * (1 - fy) + LUM[y0, x0 + 1] * fx * (1 - fy)
         + LUM[y0 + 1, x0] * (1 - fx) * fy + LUM[y0 + 1, x0 + 1] * fx * fy)
    return t, v


def snap(inside, outside, sigma=1.0, frac=0.45):
    """The OUTERMOST strong luminance step on the inside->outside ray, as a fraction of it.

    Outermost, not strongest: the sleeve's lit edge reads fabric(30) -> rim(230) -> tunnel(130),
    and the boundary we want is the far side of the rim, because the rim is fabric."""
    t, v = _ray(inside, outside)
    v = gaussian_filter1d(v, sigma / 0.25)
    d = np.abs(np.gradient(v))
    if d.max() < 1e-6: return 0.5
    thr = frac * d.max()
    e = np.nonzero(d > thr)[0][-1]
    s = e
    while s - 1 >= 0 and d[s - 1] > 0.5 * thr: s -= 1
    return float(t[s + int(np.argmax(d[s:e + 1]))])


def _interp(anchors, at):
    return np.interp(at, [a for a, _ in anchors], [b for _, b in anchors])


def trace(anchors, axis, out, radius, step=0.2, med=5):
    """Walk a guessed boundary and snap every sample to the picture.

    anchors  [(walk, guessed edge)] in PERCENT; `axis` is the coordinate we WALK
             ('x' for a top/bottom curve, 'y' for a left/right one)
    out      +1 if the garment is on the low side of the edge (a bottom / right curve), -1 if
             it is on the high side (a top / left curve)
    radius   how far to look each way — a scalar, or [(walk, radius)] where it must vary.
             A radius of 0 keeps the guess: two boundaries (the sleeve hems, where the cuff
             crosses a scan line almost flat) are read off the picture by hand instead.
    Returns (walk coords, edge coords), both in percent."""
    aa = np.arange(anchors[0][0], anchors[-1][0] + 1e-9, step)
    gg = _interp(anchors, aa)
    rr = np.full(aa.shape, radius, float) if np.isscalar(radius) else _interp(radius, aa)
    ee = np.empty(aa.shape)
    for i, (a, g, r) in enumerate(zip(aa, gg, rr)):
        if r <= 0: ee[i] = g; continue
        lo, hi = g - out * r, g + out * r
        p = (lambda v: (a / 100 * W, v / 100 * H)) if axis == 'x' else (lambda v: (v / 100 * W, a / 100 * H))
        f = snap(p(lo), p(hi))
        ee[i] = lo + (hi - lo) * f
    fixed = np.isscalar(radius) and radius <= 0
    if med > 1 and not fixed: ee = median_filter(ee, med, mode='reflect')
    return aa, ee


def curve(anchors, axis, out, radius, **kw):
    """A traced boundary as a lookup over the whole picture; outside its walk it holds its ends."""
    aa, ee = trace(anchors, axis, out, radius, **kw)
    n = np.arange(W if axis == 'x' else H) / (W if axis == 'x' else H) * 100
    return np.interp(n, aa, ee), (aa, ee)


# ------------------------------------------------------------------- the traces
# Every number below is a percent of the source picture, read off a 1%-gridded zoom of it and
# then snapped by `trace`. The player stands a little left of centre: the pants' right hip is at
# 57.6%, not 58.4%, and the right sleeve ends at 62.6%, not 63.2%.

HELMET_TOP = [(45.6, 23.0), (46.0, 22.0), (46.5, 21.2), (47.0, 20.6), (47.5, 20.2), (48.0, 19.8),
              (49.0, 19.4), (50.0, 19.2), (51.0, 19.3), (52.0, 19.6), (52.5, 19.9), (53.0, 20.3),
              (53.5, 20.9), (54.0, 21.8), (54.4, 23.0)]
HELMET_RIGHT = [(21, 53.6), (22, 54.0), (23, 54.15), (24, 54.2), (25, 54.3), (26, 54.5), (27, 54.6),
                (28, 54.85), (29, 54.95), (30, 55.0), (31, 55.0), (32, 54.95), (33, 54.8), (34, 54.5),
                (34.6, 54.4)]
HELMET_LEFT = [(21, 46.4), (22, 46.1), (23, 45.8), (24, 45.6), (25, 45.35), (26, 45.1), (27, 44.9),
               (28, 44.75), (29, 44.7), (30, 44.75), (31, 44.65), (32, 44.7), (33, 44.9), (34, 45.1),
               (34.6, 45.3)]
# the shell's lower rim. Below it is the black gap over the neck — skin, and it stays out.
HELMET_BOTTOM = [(45.4, 35.4), (46.0, 34.9), (46.6, 34.5), (47.2, 34.42), (48.0, 34.45), (49.0, 34.45),
                 (50.0, 34.45), (51.0, 34.5), (52.0, 34.62), (52.8, 34.8), (53.4, 35.2), (54.0, 35.8),
                 (54.6, 36.0)]

# the jersey's top: the lit shoulder band, dipping to the collar either side of the neck
JERSEY_TOP = [(36.2, 43.6), (36.6, 43.1), (37.0, 41.6), (37.5, 40.1), (38.0, 39.0), (38.5, 38.0),
              (39.5, 38.1), (40.5, 36.9), (41.5, 37.0), (42.5, 37.45), (43.5, 36.95), (44.5, 36.7),
              (45.5, 36.4), (46.5, 36.85), (47.5, 37.15), (48.5, 37.45), (49.5, 37.55), (50.5, 37.55),
              (51.5, 37.45), (52.5, 37.15), (53.5, 36.9), (54.5, 36.4), (55.5, 37.3), (56.5, 37.0),
              (57.5, 36.85), (58.5, 37.3), (59.5, 38.0), (60.5, 38.9), (61.5, 40.2), (62.0, 41.2),
              (62.6, 43.0)]
JERSEY_TOP_R = [(36.2, 1.4), (37.4, 1.4), (37.8, 0.8), (44, 0.8), (45.2, 0.6), (55.0, 0.6),
                (56.0, 0.8), (61.0, 0.8), (61.6, 1.4), (62.6, 1.4)]

# the left boundary: sleeve, then the cuff crossing onto the arm, then the arm's inner line
JERSEY_LEFT = [(38.5, 38.0), (39, 37.6), (40, 37.0), (41, 36.6), (42, 36.45), (43, 36.35), (44, 36.3),
               (45, 36.2), (46, 36.05), (47, 35.95), (48, 35.85), (49, 35.9), (50, 36.15),
               (50.4, 36.4), (50.6, 36.9), (51.0, 37.7), (51.4, 38.4), (51.8, 39.0), (52.2, 39.5),
               (52.6, 39.95), (53.0, 40.35), (53.5, 40.62), (54, 40.8), (55, 41.0), (56, 41.1),
               (57, 41.15), (58, 41.2), (59, 41.25), (60, 41.3), (61, 41.45), (62, 41.65), (63, 41.8), (64, 41.9),
               (65, 42.1), (66, 42.35), (67, 42.4), (68, 42.1), (69, 42.3), (70, 42.5), (71, 42.3),
               (72, 42.15), (73, 42.0), (74, 41.9)]
JERSEY_LEFT_R = [(38.5, 0.9), (49.6, 0.9), (50.0, 0), (60.4, 0), (60.8, 0.7), (74, 0.7)]
JERSEY_RIGHT = [(38.5, 60.2), (39, 60.8), (40, 61.5), (41, 62.0), (42, 62.2), (43, 62.4), (44, 62.55),
                (45, 62.6), (46, 62.7), (47, 62.75), (48, 62.8), (49, 62.75), (50, 62.6), (50.4, 62.3),
                (50.6, 61.6), (50.9, 60.6), (51.3, 59.6), (51.7, 58.6), (52.1, 57.95), (52.6, 57.55),
                (53.2, 57.48), (54, 57.45), (55, 57.42), (56, 57.38), (57, 57.35), (58, 57.3),
                (59, 57.28), (60, 57.24), (61, 56.9), (62, 56.85), (63, 56.8), (64, 56.75), (65, 56.7), (66, 56.6),
                (67, 56.6), (68, 56.6), (69, 56.5), (70, 56.7), (71, 56.7), (72, 56.7), (73, 56.85),
                (74, 57.0)]
JERSEY_RIGHT_R = [(38.5, 0.9), (49.6, 0.9), (50.0, 0), (60.4, 0), (60.8, 0.7), (74, 0.7)]

# one waist for both garments: the jersey stops here, the pants start here
WAIST = [(41.4, 74.4), (42, 74.15), (43, 73.9), (44, 73.8), (46, 73.75), (48, 73.75), (50, 73.75),
         (52, 73.8), (54, 73.7), (55, 73.65), (56, 73.7), (56.8, 73.9), (57.4, 74.2)]

PANTS_LEFT = [(74, 41.85), (75, 42.25), (76, 42.15), (77, 41.9), (78, 41.6), (79, 41.45), (80, 41.25),
              (81, 41.12), (82, 40.98), (83, 40.88), (84, 40.86), (86, 40.95), (88, 40.86),
              (90, 40.9), (92, 40.7), (94, 40.6), (96, 40.6), (98, 40.62), (100, 40.7)]
PANTS_RIGHT = [(74, 57.0), (75, 57.0), (76, 56.8), (77, 56.85), (78, 56.95), (79, 57.1), (80, 57.2),
               (82, 57.45), (84, 57.65), (86, 57.75), (88, 57.85), (90, 57.95), (92, 58.05),
               (94, 58.15), (96, 58.28), (98, 58.3), (100, 58.3)]


# --------------------------------------------------------------- building masks
YY, XX = np.mgrid[0:H, 0:W]
XP, YP = XX / W * 100, YY / H * 100


def between(low_y, high_y, low_x, high_x):
    """The pixels inside a row span AND between a top and a bottom curve (percent lookups)."""
    return (YP >= low_y[XX]) & (YP <= high_y[XX]) & (XP >= low_x[YY]) & (XP <= high_x[YY])


def build():
    py = 100.0 / H                           # one source pixel of height, in percent
    h_top, t_ht = curve(HELMET_TOP, 'x', -1, 1.0)
    h_bot, t_hb = curve(HELMET_BOTTOM, 'x', +1, 0.55)
    h_lft, t_hl = curve(HELMET_LEFT, 'y', -1, 0.7)
    h_rgt, t_hr = curve(HELMET_RIGHT, 'y', +1, 0.7)
    j_top, t_jt = curve(JERSEY_TOP, 'x', -1, JERSEY_TOP_R)
    j_lft, t_jl = curve(JERSEY_LEFT, 'y', -1, JERSEY_LEFT_R)
    j_rgt, t_jr = curve(JERSEY_RIGHT, 'y', +1, JERSEY_RIGHT_R)
    waist, t_w = curve(WAIST, 'x', +1, 0.5)
    p_lft, t_pl = curve(PANTS_LEFT, 'y', -1, 0.4)
    p_rgt, t_pr = curve(PANTS_RIGHT, 'y', +1, 0.5)

    # the helmet and the jersey are bounded above and below; the pants run off the frame
    helmet = between(h_top, h_bot, h_lft, h_rgt)
    jersey = between(j_top, waist + py, j_lft, j_rgt)
    pants = between(waist - py, np.full(W, 101.0), p_lft, p_rgt)
    traces = dict(helmet_top=t_ht, helmet_bottom=t_hb, helmet_left=t_hl, helmet_right=t_hr,
                  jersey_top=t_jt, jersey_left=t_jl, jersey_right=t_jr, waist=t_w,
                  pants_left=t_pl, pants_right=t_pr)
    return helmet, jersey, pants, traces


def finish(mask, out, blur=0.9, trim=0.12):
    """Half the source resolution, RGB zero, alpha anti-aliased — and no fringe past the outline.
    BOX, not LANCZOS: a 2x box average of a hard mask IS the pixel's coverage, with none of the
    ringing a windowed-sinc leaves outside the shape. `trim` then lifts the blur's outer tail off
    zero-alpha ground, so the ramp is spent within four source pixels of the traced line."""
    size = (W // 2, H // 2)
    m = Image.fromarray((mask * 255).astype('uint8'), 'L').resize(size, Image.BOX)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(m).astype(float) / 255
    a = np.clip((a - trim) / (1 - trim), 0, 1)
    rgba = Image.new('RGBA', size, (0, 0, 0, 0))
    rgba.putalpha(Image.fromarray((a * 255 + 0.5).astype('uint8'), 'L'))
    rgba.save(out, 'WEBP', quality=80, method=6)
    return np.asarray(rgba.getchannel('A'))


# ------------------------------------------------------------------ the debugger
def dbg_overlay(masks, path, scale=1.0):
    base = np.asarray(_img).astype(float)
    for m, c in masks:
        a = 0.75 * m[:, :, None]
        base = base * (1 - a) + np.array(c, float)[None, None, :] * a
    im = Image.fromarray(base.astype('uint8'))
    if scale != 1: im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    im.save(path)


def dbg_zoom(masks, box, path, zoom):
    base = np.asarray(_img).astype(float)
    for m, c in masks:
        a = 0.32 * m[:, :, None]
        base = base * (1 - a) + np.array(c, float)[None, None, :] * a
        edge = m & ~np.pad(m, 1)[2:, 1:-1] | m & ~np.pad(m, 1)[:-2, 1:-1] | \
               m & ~np.pad(m, 1)[1:-1, 2:] | m & ~np.pad(m, 1)[1:-1, :-2]
        base[edge] = c
    x0, y0, x1, y1 = box
    b = (int(x0 / 100 * W), int(y0 / 100 * H), int(x1 / 100 * W), int(y1 / 100 * H))
    c = Image.fromarray(base.astype('uint8')).crop(b)
    c = c.resize((int(c.width * zoom), int(c.height * zoom)), Image.NEAREST)
    d = ImageDraw.Draw(c)
    g = x0
    while g <= x1 + 1e-9:
        p = (g / 100 * W - b[0]) * zoom; d.line([(p, 0), (p, c.height)], fill=(0, 255, 0))
        d.text((p + 2, 2), f'{g:g}', fill=(0, 255, 0)); g += 1
    g = y0
    while g <= y1 + 1e-9:
        p = (g / 100 * H - b[1]) * zoom; d.line([(0, p), (c.width, p)], fill=(255, 0, 255))
        d.text((2, p + 2), f'{g:g}', fill=(255, 0, 255)); g += 1
    c.save(path)


ZOOMS = [('helmet_top', (44, 17, 57, 26), 6), ('helmet_rims', (43, 23, 57, 38), 6),
         ('collar', (43, 33, 58, 42), 6), ('shoulder_left', (34, 35, 45, 45), 6),
         ('shoulder_right', (55, 35, 66, 45), 6), ('cuff_left', (34, 45, 44, 57), 6),
         ('cuff_right', (55, 45, 65, 57), 6), ('torso_left', (38, 55, 46, 75), 5),
         ('torso_right', (53, 55, 61, 75), 5), ('waist', (39, 69, 60, 79), 4),
         ('hip_left', (37, 76, 46, 92), 5), ('hip_right', (53, 76, 62, 92), 5),
         ('legs_bottom', (38, 90, 61, 100), 4)]

# the check's probe points (scripts/menu-mask-check.mjs, PROBES.hero_tunnel), in percent
PROBES_ON = {'chest': ('p', 50, 45), 'leftSleeve': ('p', 36.6, 44), 'rightSleeve': ('p', 61.8, 44),
             'leftHem': ('p', 37.4, 49.5), 'rightHem': ('p', 62.2, 49), 'helmet': ('s', 50, 25),
             'helmetRimRight': ('s', 54.4, 29), 'helmetRimLeft': ('s', 45.8, 28), 'seat': ('s', 50, 85),
             'hipLeft': ('s', 41.6, 84), 'hipRight': ('s', 56.9, 84)}
PROBES_OFF = {'leftOfSleeve': (33.4, 44), 'rightOfSleeve': (66.6, 44), 'leftArm': (35, 82),
              'rightArm': (65, 82), 'aboveHelmet': (50, 15), 'wall': (27, 60), 'slogan': (86, 30)}
# v106 moved three of the check's `on` points onto the garment this script measured: the player
# stands left of centre, so the symmetric partner of a good left-hand point overshot — at y=44 the
# right sleeve's lit edge ends at x=62.6 (63.2 was blurred stadium), at y=84 the right hip ends at
# x=57.6 (58.4 was the lit tunnel floor), and the old helmetRimRight sat on the clip's blurred
# edge. If a probe ever drifts off the garment again, list it here with the point that is on it:
PROBES_MISPLACED = {}
# the check's own bars: an `on` point must read >= 0.6 in its mask and <= 0.15 in the other,
# an `off` point <= 0.08 in both
ON_BAR, CROSS_BAR, OFF_BAR = 153, 38, 20


def main():
    os.makedirs(OUT, exist_ok=True)
    helmet, jersey, pants, traces = build()
    secondary, primary = helmet | pants, jersey
    ap = finish(primary, f'{OUT}/hero_mask_p.webp')
    as_ = finish(secondary, f'{OUT}/hero_mask_s.webp')

    kit = primary | secondary
    area = W * H
    print('hero kit: jersey %.2f%%  helmet %.2f%%  pants %.2f%%  of the picture'
          % (100 * jersey.sum() / area, 100 * helmet.sum() / area, 100 * pants.sum() / area))
    print('          the two masks overlap on %d source px (the shared waist line)'
          % (primary & secondary).sum())

    # 1. the anti-aliasing ramp, measured in SOURCE pixels out from the traced line, and the
    #    guarantee it rests on: past four pixels there is no alpha at all, anywhere.
    out_d = distance_transform_edt(~kit)
    for name, a in (('hero_mask_p', ap), ('hero_mask_s', as_)):
        full = np.asarray(Image.fromarray(a).resize((W, H), Image.NEAREST)).astype(int)
        ramp = ' '.join('%d-%dpx:%d' % (lo, hi, full[(out_d >= lo) & (out_d < hi)].max())
                        for lo, hi in [(1, 2), (2, 3), (3, 4), (4, 6)])
        worst = int(full[out_d >= 4].max())
        print('%-12s coverage %5.2f%% of the mask   fringe outside the trace  %s   beyond 4px: %d'
              % (name, 100 * (a > 127).sum() / a.size, ramp, worst))
        assert worst == 0, f'{name} bleeds past four source pixels of the traced kit (alpha {worst})'

    # 2. the check's own probe points, read straight off the shipped alpha at its own thresholds
    def at(a, x, y): return int(a[min(a.shape[0] - 1, round(y / 100 * a.shape[0])),
                                 min(a.shape[1] - 1, round(x / 100 * a.shape[1]))])
    bad = []
    for name, (which, x, y) in PROBES_ON.items():
        mine, other = (ap, as_) if which == 'p' else (as_, ap)
        v, o = at(mine, x, y), at(other, x, y)
        ok = v >= ON_BAR and o <= CROSS_BAR
        if not ok: bad.append(name)
        print('  on  %-16s _%s = %3d   other = %3d%s' % (name, which, v, o,
              '' if ok else '   <-- the point is OFF the garment in the picture'))
    for name, (x, y) in PROBES_OFF.items():
        v = max(at(ap, x, y), at(as_, x, y))
        print('  off %-16s max = %3d%s' % (name, v, '' if v <= OFF_BAR else '   <-- BLEED'))
        assert v <= OFF_BAR, f'off-probe {name} is masked (alpha {v})'
    for name, (x, y) in PROBES_MISPLACED.items():
        which = PROBES_ON[name][0]
        v = at(ap if which == 'p' else as_, x, y)
        print('  fix %-16s _%s = %3d   at [%s, %s] — where that probe belongs' % (name, which, v, x, y))
        assert v >= ON_BAR, f'the replacement point for {name} is not inside the mask either'
    unlisted = [b for b in bad if b not in PROBES_MISPLACED]
    assert not unlisted, 'probe(s) %s are off the mask and not listed in PROBES_MISPLACED' % ', '.join(unlisted)
    if bad: print('  NOTE: probe(s) %s sit off the real garment; see PROBES_MISPLACED.' % ', '.join(bad))

    if os.path.isdir(DEBUG):
        cols = [(255, 40, 40), (40, 120, 255)]
        layers = [(primary, cols[0]), (secondary, cols[1])]
        dbg_overlay(layers, f'{DEBUG}/hero_final_overlay.png')
        for name, box, z in ZOOMS:
            dbg_zoom(layers, box, f'{DEBUG}/hero_edge_{name}.png', z)
        print('debug: %s/hero_final_overlay.png + %d edge crops' % (DEBUG, len(ZOOMS)))


if __name__ == '__main__':
    main()
