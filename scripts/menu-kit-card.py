"""v106 THE KIT ON THE CONTINUE CARD — cut the two team-colour masks for the main menu's
continue-card photograph straight off the picture's own edges.

    python3 scripts/menu-kit-card.py            (from the repo root)

Writes public/menu/card_continue_mask_p.webp (PRIMARY = the jersey) and
card_continue_mask_s.webp (SECONDARY = helmet + pants), RGBA at half the source
resolution, RGB zero, alpha = the garment, softened by a 0.9px blur — the same shape the
menu's mask layer expects (see finish() in scripts/build-menu-art.py).

HOW THE OUTLINE IS FOUND.  The kit is neutral grey; the arms, the crowd, the sky and the
grass all carry colour, so RELATIVE CHROMA ((max-min)/luma) separates garment from
everything else far better than luminance does — the player is lit hard from the left, so
the same jersey runs from 167 down to 45 across his back while the bokeh behind him sits
at 40-110.  That map alone is not a mask (the gloves are neutral too, the arms wear
neutral specular rims, and the crowd has neutral patches), so it is used the way a camera
uses a rangefinder: a hand-placed PRIOR says where each boundary runs to within a few
pixels, and every boundary point is then SNAPPED to the strongest neutral/chromatic step
within a short search along its own normal, median-filtered and smoothed.  The result is
an explicit closed outline per garment, so nothing that is not inside a traced outline can
ever be tinted.

Coordinates in the prior tables are PERCENT of the source picture, the same grid
scripts/menu-mask-check.mjs probes on.  To re-place a boundary, read a zoom of the
picture, edit the control points, and re-run: the snap does the last two pixels.

The run prints its own report: coverage, the no-bleed guard, and every probe in
menu-mask-check.  Seven of that check's probes had been placed against the OLD masks and
sat off the real garment; v106 moved them, and the script asserts on every one.
"""
import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

SRC = 'art/menu/card_continue.png'
OUT = 'public/menu'
# where the review pictures go: the overlay and one zoomed crop per edge. Set MENU_KIT_DEBUG
# to move them; if the folder does not exist the pass is simply skipped.
DEBUG = os.environ.get('MENU_KIT_DEBUG', '')

src = Image.open(SRC).convert('RGB')
W, H = src.size
rgb = np.asarray(src).astype(np.float32)

# ---------------------------------------------------------------- the feature the snap reads
_b = cv2.GaussianBlur(rgb, (0, 0), 1.0)
_lum = _b.mean(2)
_rel = (_b.max(2) - _b.min(2)) / np.maximum(_lum, 12.0)
NEUT = np.clip(1.0 - _rel / 0.35, 0.0, 1.0)     # 1 = neutral (kit), 0 = coloured (skin, crowd, grass)


def px(pt):
    return pt[0] / 100.0 * W, pt[1] / 100.0 * H


def _interp(ctrl, t):
    """ctrl = [(t0, v0), ...] in percent, t = sample positions in percent. Linear."""
    ct = np.array([c[0] for c in ctrl], dtype=float)
    cv_ = np.array([c[1] for c in ctrl], dtype=float)
    if ct[0] > ct[-1]:                      # a table may run either way along its own axis
        ct, cv_ = ct[::-1], cv_[::-1]
    return np.interp(t, ct, cv_)


def snap(ctrl, axis, side, step=1.0, delta=9, win=5, pull=0.030, smooth=9):
    """Trace one boundary.

    ctrl  control points, percent, ordered along the boundary's own axis
    axis  'y' → the boundary is x(y), traced row by row;  'x' → y(x), column by column
    side  which way the GARMENT lies: 'L' garment is to the right of the edge (a left
          edge), 'R' garment to the left, 'T' garment below (a top edge), 'B' garment above
    delta how far, in source pixels, the snap may move off the prior
    win   how many pixels either side of a candidate the neutrality is averaged over
    pull  cost per pixel of leaving the prior — keeps a weak edge honest
    Returns [(x, y), ...] in source pixels, along the whole control range.
    """
    lo, hi = ctrl[0][0], ctrl[-1][0]
    span = (H if axis == 'y' else W) / 100.0
    n = max(2, int(round(abs(hi - lo) * span / step)))
    ts = np.linspace(lo, hi, n)
    prior = _interp(ctrl, ts)
    across = (W if axis == 'y' else H) / 100.0
    a = np.clip(np.rint(ts * span).astype(int), 0, (H if axis == 'y' else W) - 1)
    p = np.rint(prior * across).astype(int)                # the prior, in pixels
    found = p.copy()
    for i in range(len(a)):
        line = NEUT[a[i]] if axis == 'y' else NEUT[:, a[i]]
        best, bx = -1e9, p[i]
        for x in range(p[i] - delta, p[i] + delta + 1):
            if x - win < 0 or x + win + 1 >= len(line):
                continue
            if side in ('L', 'T'):
                inn = line[x + 1:x + 1 + win].mean(); out = line[x - win:x].mean()
            else:
                inn = line[x - win:x].mean(); out = line[x + 1:x + 1 + win].mean()
            s = inn - out - pull * abs(x - p[i])
            if s > best:
                best, bx = s, x
        found[i] = bx
    if smooth >= 3:
        k = smooth | 1
        pad = np.pad(found.astype(np.float32), k // 2, mode='edge')
        med = np.array([np.median(pad[i:i + k]) for i in range(len(found))])
        ker = np.ones(k) / k
        found = np.convolve(np.pad(med, k // 2, mode='edge'), ker, mode='valid')
    if axis == 'y':
        return [(float(x), float(y)) for x, y in zip(found, a)]
    return [(float(x), float(y)) for x, y in zip(a, found)]


def poly(points):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(m) > 0


def poly_pct(pts):
    return poly([px(p) for p in pts])


# ================================================================= the priors, in percent
# Every table below was read off a 1%- and 0.5%-gridded zoom of art/menu/card_continue.png.

# --- the helmet -----------------------------------------------------------------------
# the shell's left side, bottom to top: the facemask strap and its clips out to 69.1-69.5,
# then the shell itself climbing to the crown
HELM_L = [(37.8, 69.45), (37.0, 69.35), (36.0, 69.20), (35.0, 69.07), (34.0, 69.20),
          (33.0, 69.45), (32.0, 69.40), (31.0, 69.30), (30.0, 69.30), (29.0, 69.35),
          (28.5, 69.39), (28.0, 69.64), (27.5, 70.09), (27.0, 70.28), (26.5, 70.60),
          (26.0, 70.66), (25.5, 70.79), (25.0, 70.85), (24.5, 70.98), (24.0, 71.17),
          (23.5, 71.30), (23.0, 71.56), (22.5, 71.81), (22.0, 72.07), (21.5, 72.39),
          (21.0, 72.77), (20.5, 73.28), (20.0, 73.72), (19.6, 74.30)]
HELM_TOP = [(74.30, 19.60), (74.50, 19.44), (75.00, 19.24), (75.50, 19.04), (76.00, 19.04),
            (76.50, 18.84), (77.00, 18.90), (77.50, 18.94), (78.00, 19.04), (78.50, 19.24),
            (79.00, 19.44), (79.50, 19.74), (80.00, 20.10)]
HELM_R = [(20.1, 80.05), (21.0, 80.87), (22.0, 81.51), (23.0, 81.95), (24.0, 82.27),
          (25.0, 82.53), (26.0, 82.65), (27.0, 82.78), (28.0, 82.72), (29.0, 82.65),
          (30.0, 82.65), (31.0, 82.53), (32.0, 82.40), (33.0, 82.14), (34.0, 82.20),
          (35.0, 82.02), (35.5, 81.82), (35.8, 81.50), (36.0, 81.42), (36.2, 81.29),
          (36.4, 81.02), (36.6, 80.90), (37.0, 80.78), (37.4, 80.77), (37.7, 80.64),
          (37.95, 80.55)]
# the helmet's lower edge, right to left. It is not one line: the jaw strap hangs to the
# jersey on the right and the facemask does the same on the left, and BETWEEN them the
# shell's rear rim rides high over the bare NECK, which is skin and stays out of the mask.
# Under a hard shadow lift the neck reads plainly as skin from 34.55 down to the collar.
HELM_BOT = [(80.55, 37.95), (80.05, 37.90),                          # the jaw strap's foot
            (79.90, 37.00), (79.75, 36.00), (79.60, 35.20), (79.20, 34.75),
            (78.00, 34.58), (76.00, 34.52), (74.50, 34.55), (73.80, 34.70),   # over the neck
            (73.40, 35.40), (73.15, 36.50), (73.00, 37.60), (72.85, 38.00),
            (72.50, 38.00), (72.00, 38.05), (71.70, 38.20),
            (71.55, 37.55), (71.00, 37.45), (70.45, 37.28),          # the air under the strap
            (70.30, 38.30), (69.60, 38.30), (69.45, 38.05)]

# --- the body: sleeves, torso, pants --------------------------------------------------
SLEEVE_L = [(51.5, 63.78), (51.0, 63.52), (50.0, 63.39), (49.0, 63.33), (48.0, 63.33),
            (47.0, 63.39), (46.0, 63.52), (45.0, 63.65), (44.0, 63.90), (43.0, 64.22),
            (42.5, 64.29), (42.0, 64.48)]
CUFF_L = [(63.78, 51.50), (64.20, 51.80), (64.60, 51.40), (65.20, 51.10), (65.80, 51.45),
          (66.40, 51.80), (67.00, 52.10), (67.60, 52.45), (68.20, 52.60)]
BODY_L = [(52.6, 68.45), (54.0, 68.55), (55.0, 68.69), (56.0, 68.88), (57.0, 68.94),
          (58.0, 69.01), (59.0, 69.01), (60.0, 68.94), (61.0, 68.81), (62.0, 68.69),
          (63.0, 68.60), (64.0, 68.90), (65.0, 69.07), (66.0, 69.13), (67.0, 69.13),
          (68.0, 69.07), (69.0, 69.13), (70.0, 69.07), (71.0, 69.01), (72.0, 68.94),
          (73.0, 68.85), (74.0, 68.95), (75.0, 68.80), (76.0, 68.75), (77.0, 68.78),
          (78.0, 68.69), (79.0, 68.45), (80.0, 68.37), (81.0, 68.30), (82.0, 68.11),
          (83.0, 67.86), (84.0, 67.65), (85.0, 67.47), (86.0, 67.28), (87.0, 67.22),
          (88.0, 67.03), (89.0, 66.84), (90.0, 66.71), (91.0, 66.58), (92.0, 66.52),
          (93.0, 66.39), (94.0, 66.33), (95.0, 66.33), (96.0, 66.26), (97.0, 66.26),
          (98.0, 66.20), (99.0, 66.10), (100.0, 66.10)]
BODY_R = [(52.5, 89.05), (53.0, 88.58), (54.0, 87.69), (55.0, 87.31), (56.0, 87.05),
          (57.0, 86.72), (58.0, 86.35), (59.0, 86.17), (60.0, 86.06), (61.0, 85.99),
          (62.0, 85.83), (63.0, 85.65), (64.0, 85.44), (65.0, 85.19), (66.0, 85.08),
          (67.0, 85.06), (68.0, 85.10), (69.0, 85.12), (70.0, 85.16), (71.0, 85.24),
          (72.0, 85.32), (73.0, 85.37), (74.0, 85.40), (75.0, 85.40), (76.0, 85.40),
          (77.0, 85.40), (78.0, 85.42), (79.0, 85.40), (80.0, 85.37), (81.0, 85.55),
          (82.0, 85.65), (83.0, 85.78), (84.0, 85.97), (85.0, 86.10), (86.0, 86.29),
          (87.0, 86.48), (88.0, 86.54), (89.0, 86.73), (90.0, 86.86), (91.0, 86.99),
          (92.0, 87.12), (93.0, 87.18), (94.0, 87.24), (95.0, 87.31), (96.0, 87.37),
          (97.0, 87.37), (98.0, 87.37), (99.0, 87.44), (100.0, 87.46)]
CUFF_R = [(89.05, 52.45), (89.60, 52.30), (90.10, 52.00), (90.60, 51.70), (91.00, 51.30),
          (91.20, 51.05)]
SLEEVE_R = [(51.05, 91.22), (50.5, 91.38), (50.0, 91.45), (49.0, 91.45),
            (48.0, 91.42), (47.0, 91.39), (46.0, 91.33), (45.0, 91.20), (44.0, 90.94),
            (43.0, 90.75), (42.0, 90.18), (41.4, 89.73), (41.0, 89.41), (40.7, 89.20)]
# the shoulder line and the collar, left to right; under the helmet this IS the helmet's hem
SHOULDER = [(64.50, 41.97), (65.00, 41.38), (65.50, 40.78), (66.00, 40.28), (66.50, 39.88),
            (67.00, 39.48), (67.50, 39.18), (68.00, 38.98), (68.50, 38.68), (69.00, 38.38),
            (69.30, 38.42), (69.80, 38.42), (70.30, 38.40), (71.00, 38.38), (71.60, 38.35),
            (72.00, 38.15), (72.50, 38.05), (73.00, 37.85), (73.50, 37.89), (74.00, 37.69),
            (74.50, 37.85), (75.00, 37.79), (76.00, 37.79), (77.00, 37.89), (78.00, 37.89),
            (79.00, 37.89), (79.50, 37.92), (80.00, 37.92), (80.50, 37.90), (81.00, 38.10),
            (81.50, 38.15), (82.00, 38.10), (82.50, 38.00), (83.00, 38.02), (83.50, 38.15),
            (84.00, 38.40), (84.50, 38.50), (85.00, 38.55), (85.50, 38.64), (86.00, 38.72),
            (86.50, 38.90), (87.00, 39.14), (87.50, 39.45), (88.00, 39.65), (88.50, 39.95),
            (89.00, 40.35), (89.20, 40.55)]

# the jersey's own hem: where the mesh stops and the pants start
HEM = [(66.00, 79.30), (67.00, 78.86), (67.50, 78.46), (68.00, 78.27), (68.50, 78.40),
       (69.00, 78.70), (69.50, 78.86), (70.00, 78.66), (70.50, 78.46), (71.00, 78.27),
       (71.50, 77.97), (72.00, 77.87), (72.50, 77.77), (73.00, 77.67), (74.00, 77.57),
       (75.00, 77.57), (75.50, 77.57), (76.00, 77.67), (77.00, 77.77), (77.50, 77.87),
       (78.00, 77.97), (79.00, 77.97), (79.50, 77.97), (80.00, 77.87), (81.00, 77.77),
       (82.00, 77.77), (83.00, 77.87), (83.50, 77.97), (84.00, 78.17), (84.50, 78.36),
       (85.00, 78.70), (86.00, 79.10)]

# the open air between the legs — a wedge that runs off the bottom of the frame
LEGGAP = [(77.02, 93.40), (77.25, 95.00), (77.75, 97.50), (78.15, 100.60),
          (75.95, 100.60), (76.38, 97.50), (76.85, 95.00)]

# ================================================================= trace them
helm_l = snap(HELM_L, 'y', 'L', delta=7, pull=0.045, smooth=7)
helm_t = snap(HELM_TOP, 'x', 'T', delta=7, pull=0.045, smooth=7)
helm_r = snap(HELM_R, 'y', 'R', delta=7, pull=0.045, smooth=7)
helm_b = [px((x, y)) for x, y in HELM_BOT]           # a hand line: the opening under the shell

sleeve_l = snap(SLEEVE_L, 'y', 'L', delta=7, pull=0.045, smooth=7)
cuff_l = snap(CUFF_L, 'x', 'B', delta=7, pull=0.050, smooth=5)
body_l = snap(BODY_L, 'y', 'L', delta=8, pull=0.035, smooth=13)
body_r = snap(BODY_R, 'y', 'R', delta=8, pull=0.035, smooth=13)
cuff_r = snap(CUFF_R, 'x', 'B', delta=7, pull=0.050, smooth=5)
sleeve_r = snap(SLEEVE_R, 'y', 'R', delta=7, pull=0.045, smooth=7)
shoulder = snap(SHOULDER, 'x', 'T', delta=8, pull=0.040, smooth=11)

# ================================================================= assemble the outlines
BOT = H + 4.0

# each run is laid head to tail, clockwise, so the outline never crosses itself
helmet_poly = helm_l + helm_t + helm_r + helm_b
body_poly = (shoulder + sleeve_r[::-1] + cuff_r[::-1] + body_r
             + [(body_r[-1][0], BOT), (body_l[-1][0], BOT)]
             + body_l[::-1] + cuff_l[::-1] + sleeve_l)

helmet = poly(helmet_poly)
body = poly(body_poly) & ~poly_pct(LEGGAP)

# the two garments must not overlap: the shell wins where they meet
body &= ~helmet

# the jersey / pants split runs along the hem, extended past both edges of the body
hem_x = np.array([p[0] for p in HEM]) / 100.0 * W
hem_y = np.array([p[1] for p in HEM]) / 100.0 * H
cols = np.arange(W)
hem_row = np.interp(cols, hem_x, hem_y)
below = np.arange(H)[:, None] > hem_row[None, :]

jersey = body & ~below
pants = body & below

# ================================================================= write the masks
def finish(mask_bool, path, blur=0.9):
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close pinholes
    m = m.resize((W // 2, H // 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    rgba = Image.new('RGBA', m.size, (0, 0, 0, 0))
    rgba.putalpha(m)
    rgba.save(path, 'WEBP', quality=80, method=6)
    return np.asarray(m)


os.makedirs(OUT, exist_ok=True)
P_PATH = os.path.join(OUT, 'card_continue_mask_p.webp')
S_PATH = os.path.join(OUT, 'card_continue_mask_s.webp')
ap = finish(jersey, P_PATH)
as_ = finish(helmet | pants, S_PATH)

# ================================================================= the guarantees
player = (helmet | body)
grown = np.asarray(Image.fromarray((player * 255).astype('uint8'), 'L')
                   .filter(ImageFilter.MaxFilter(7))) > 0
outside = np.asarray(Image.fromarray((~grown * 255).astype('uint8'), 'L')
                     .resize((W // 2, H // 2), Image.BILINEAR)) > 250
for name, a in (('p', ap), ('s', as_)):
    worst = int(a[outside].max()) if outside.any() else 0
    assert worst <= 8, f'mask_{name} bleeds outside the traced player (alpha {worst})'
    print(f'mask_{name}: max alpha outside the player = {worst}/255')
assert not (jersey & (helmet | pants)).any(), 'the two masks overlap'

print(f'jersey  {jersey.sum():7d} px   helmet {helmet.sum():7d} px   pants {pants.sum():7d} px'
      f'   ({100.0 * player.sum() / (W * H):.1f}% of the frame is the player)')
for f in (P_PATH, S_PATH):
    print(f'{f}  {os.path.getsize(f) // 1024} KB  {Image.open(f).size}')

# ================================================================= the check's own probes
# scripts/menu-mask-check.mjs probes the shipped alpha at these points (percent of the
# picture). v106 moved seven of them onto the garment this script measures — they had been
# placed against the OLD masks, which overshot the shell into the floodlights and ran the pants
# and the jersey out over the crowd (helmetRimRight 85→82.2, helmetLowerRim 84.4→81.4,
# helmetRear (77,36) was bare neck → (78,33.6), hipRight 87.4→85.0, torsoRight 86.2→84.5,
# belt (77,76.5) was still jersey → (77,79), neck (77,38.4) was collar → (77,36.5)). Every
# probe must hold; a probe that drifts off the garment again goes in DISPUTED with its evidence.
PROBES_ON_P = {'chest': (77, 55), 'leftSleeve': (65, 46), 'rightSleeve': (89.8, 46),
               'leftHem': (64.3, 49), 'rightHem': (90.6, 49.5), 'leftShoulder': (70, 42),
               'rightShoulder': (86, 42), 'torsoLeft': (69.6, 70), 'torsoRight': (84.5, 70)}
PROBES_ON_S = {'helmet': (77, 24), 'helmetRimRight': (82.2, 27), 'helmetLowerRim': (81.4, 33),
               'helmetRear': (78, 33.6), 'helmetCage': (71, 30), 'seat': (77, 84),
               'hipLeft': (68.4, 84), 'hipRight': (85.0, 84), 'belt': (77, 79),
               'legLeft': (70, 97), 'legRight': (85, 97)}
PROBES_OFF = {'crowdLeftOfHip': (65, 82), 'crowdRightOfHip': (90.2, 82),
              'betweenLegs': (77.3, 98), 'leftOfSleeve': (58, 48), 'rightOfSleeve': (94, 46),
              'lampsByHelmet': (88, 21), 'leftArm': (65, 62), 'rightArm': (89.6, 62),
              'neck': (77, 36.5), 'leftGlove': (63.5, 94), 'rightGlove': (91.4, 94),
              'sky': (77, 12)}
DISPUTED = {}


def at(a, pt):
    return int(a[int(round(pt[1] / 100.0 * a.shape[0])), int(round(pt[0] / 100.0 * a.shape[1]))])


bad, disputed = [], []
checks = ([('on-p', n, pt, ap, as_) for n, pt in PROBES_ON_P.items()]
          + [('on-s', n, pt, as_, ap) for n, pt in PROBES_ON_S.items()]
          + [('off', n, pt, ap, as_) for n, pt in PROBES_OFF.items()])
for kind, n, pt, mine, other in checks:
    v, o = at(mine, pt), at(other, pt)
    held = (max(v, o) <= 20) if kind == 'off' else (v >= 153 and o <= 38)
    if held:
        continue
    (disputed if n in DISPUTED else bad).append(f'{kind} {n} {v}/{o} — {DISPUTED.get(n, "")}')
print(f'menu-mask-check probes: {len(checks) - len(disputed) - len(bad)} of {len(checks)} hold')
for d in disputed:
    print('  probe disputed: ' + d)
assert not bad, 'probes that should hold do not: ' + '; '.join(bad)

# ================================================================= debug pictures
if DEBUG and os.path.isdir(DEBUG):
    full_p = np.asarray(Image.fromarray(ap).resize((W, H), Image.BILINEAR)).astype(float) / 255.0
    full_s = np.asarray(Image.fromarray(as_).resize((W, H), Image.BILINEAR)).astype(float) / 255.0
    base = rgb.copy()
    ov = base.copy()
    ov[..., 0] = base[..., 0] * (1 - 0.75 * full_p) + 255 * 0.75 * full_p
    ov[..., 1] = base[..., 1] * (1 - 0.75 * full_p)
    ov[..., 2] = base[..., 2] * (1 - 0.75 * full_p)
    ov[..., 2] = ov[..., 2] * (1 - 0.75 * full_s) + 255 * 0.75 * full_s
    ov[..., 0] = ov[..., 0] * (1 - 0.75 * full_s)
    ov[..., 1] = ov[..., 1] * (1 - 0.75 * full_s)
    over = Image.fromarray(np.clip(ov, 0, 255).astype('uint8'))
    over.save(os.path.join(DEBUG, 'card_final_overlay.png'))
    crops = {
        'helmet_top': (72, 16.5, 84, 24), 'helmet_rim_right': (79, 22, 88, 36),
        'facemask': (67, 24, 75, 40), 'collar': (68, 34, 86, 43),
        'shoulder_left': (60, 37, 72, 47), 'shoulder_right': (82, 37, 94, 47),
        'cuff_left': (60, 46, 72, 57), 'cuff_right': (84, 46, 95, 57),
        'torso_left': (62, 55, 73, 72), 'torso_right': (82, 55, 93, 72),
        'waist_left': (64, 70, 76, 84), 'waist_right': (78, 70, 90, 84),
        'hip_left': (62, 78, 74, 92), 'hip_right': (82, 78, 94, 92),
        'leg_gap': (72, 88, 84, 100.1), 'leg_left': (62, 88, 74, 100.1),
        'leg_right': (82, 88, 94, 100.1),
        'helmet_bot_right': (78, 34.5, 85, 40), 'helmet_bot_left': (67.5, 34.5, 74, 40),
        'armpit_right': (83, 50, 90, 62), 'armpit_left': (62, 50, 71, 62),
        'seat': (68, 82, 88, 94),
    }
    # the same crops again as a hairline: the mask's own edge drawn over the untouched picture
    def outline(a, col):
        m = (a > 128).astype(np.uint8)
        e = cv2.dilate(m, np.ones((3, 3), np.uint8)) - cv2.erode(m, np.ones((3, 3), np.uint8))
        return e > 0
    line = base.copy()
    for a, col in ((full_p, (255, 40, 40)), (full_s, (60, 120, 255))):
        e = outline((a * 255).astype(np.uint8), col)
        for i in range(3):
            line[..., i] = np.where(e, col[i], line[..., i])
    lines = Image.fromarray(np.clip(line, 0, 255).astype('uint8'))
    zdir = os.path.join(DEBUG, 'kit')
    os.makedirs(zdir, exist_ok=True)
    for n, (x0, y0, x1, y1) in crops.items():
        b = (int(x0 / 100 * W), int(y0 / 100 * H), int(x1 / 100 * W), int(y1 / 100 * H))
        for src_im, suffix in ((over, ''), (lines, '_edge')):
            c = src_im.crop(b)
            s = max(1.0, 900.0 / c.width)
            c.resize((int(c.width * s), int(c.height * s)), Image.NEAREST) \
                .save(os.path.join(zdir, f'{n}{suffix}.png'))
    print(f'debug: {os.path.join(DEBUG, "card_final_overlay.png")} + {len(crops)} crops in {zdir}')
