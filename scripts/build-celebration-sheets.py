#!/usr/bin/env python3
"""v161 A — THEY CELEBRATE LIKE THEY MEAN IT: the three touchdown celebrations, cut from art/celebrations/*.png.

The owner uploaded three 4x3 sheets (1448x1086, a flat light-grey ground with soft drop shadows): FLEX, BACKFLIP and
BALL SPIKE, twelve frames each, read left to right, top to bottom. This cuts them into the field's pixel scale and
registers every frame on the GROUND so the renderer (src/28 `v161 A`) can animate them without jitter:

  * the ground is fitted, not assumed: a quadratic surface through the sheet's clearly-grey pixels (the sheets carry a
    faint vignette), so the distance to it is the figure's alpha;
  * FIGURE pixels (the black outline, the kit, the ball) are solid; the drawn DIRT and speed lines are kept as a soft
    alpha ramp (un-blended off the grey), and the drop SHADOW is dropped — the game draws its own, which shrinks and
    fades with his height (a baked shadow would ride up with him on a backflip);
  * the frames are found by their blobs (the art is on no fixed grid): the twelve big bodies sorted into rows and
    columns, every other pixel given to the nearest body (a Voronoi of the bodies, so a loose ball or a speck of dirt
    lands in its own frame);
  * FOOT ANCHOR: a grounded frame stands on its own feet — the ground contact is the lowest body row, its x the middle of
    the extent of the bottom 22% of the figure (the legs) (between both feet), so a stance's feet stay put from frame to frame; an AIRBORNE
    frame (declared below) keeps its TRUE height over its row's ground line (the median of the grounded frames' feet in
    that row) and is placed by its centre of mass, offset by the row's average lean (`lift` in the manifest);
  * every frame's centre of mass (`cx`, `cy`: the body's alpha centroid) — the backflip rotates about it;
  * the drawn ROTATION of each backflip frame (`rot`, degrees, clockwise on screen, hand-read off the art) so the
    runtime can spin the sprite continuously between the drawn frames;
  * the HELMET (`helm`: an ellipse, hand-placed on each frame at the sheet's scale — the helmet is upside down on half
    the backflip, so it cannot be found from the top rows the way the field's `helmMaskV158A` does) for an equipped
    helmet's shell and stripe;
  * the SPIKE's ball leaves his hand on frame 6: it is cut out of frames 6+ and written as its own sprite (`ball`), and
    the runtime bounces it; `ballFrom` is where it lies on frame 5 (anchor-relative), so it does not pop.

The colours go through the SAME rules as build-field-art.py (the field's recolour keys on them): the drawn gold is pulled
to hue 46 (`normalize`, skin / ball / dirt left out), dark navy and gold shadows are lifted above the recolour's L=38
outline floor (`kit_ready`), then BOX-downscaled, unsharpened and alpha-thresholded (figure) / alpha-stepped (dirt).

Outputs (public/celebrations/): cel_v161a_1x.png (the field: a stance ~44 px tall, like the 48 px field cells),
cel_v161a_2x.png (the Locker preview, and the field's crisp path at half scale), cel_v161a_skin_{1,2}x.png (the skin on
the same rects — the runtime paints his own tone there), cel_v161a.json (the manifest: per frame the 1x rect `r` and
anchors, the 2x rect `r2` and anchors `a2`, the helmet relative to the foot anchor). The JS reads the manifest at runtime; nothing is baked
into src/.

  pip install pillow numpy scipy
  python3 scripts/build-celebration-sheets.py            # writes public/celebrations/
  python3 scripts/build-celebration-sheets.py --proof    # also art/celebrations-proof/ (frames on a ground line + a recolour)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'art/celebrations')
OUT = os.path.join(ROOT, 'public/celebrations')
PROOF = os.path.join(ROOT, 'art/celebrations-proof')
STAND_PX = 44            # a stance at 1x, the height the field build scales its cells to (build-field-art.py sheet_scale 44)
SCALES = (1, 2)

# per sheet: which frames are AIRBORNE (feet off the ground in the art), the drawn rotation of each frame (deg,
# clockwise on screen — a backflip goes head-back, which the art draws as the head swinging right and down), and the
# helmet on each frame (centre x, centre y, radius, in SOURCE pixels relative to the frame's body box; hand-placed off
# the zoomed proof). `names` label the proof and the manifest.
SHEETS = {
    'flex': {
        'names': ['stance', 'fists up', 'one-arm flex', 'double flex', 'stomp', 'flex left', 'double flex wide', 'quarter turn',
                  'fist pump', 'double flex', 'double flex', 'rest'],
        'air': [],
        'rot': [0] * 12,
    },
    'backflip': {
        'names': ['stance', 'crouch', 'deep crouch', 'launch', 'tuck', 'inverted tuck', 'inverted', 'past inverted',
                  'landing', 'deep landing', 'hands down', 'arms up'],
        'air': [3, 4, 5, 6, 7, 8],
        'rot': [0, 0, 0, 0, 35, 135, 180, 250, 345, 0, 0, 0],
        # the art draws the tuck with the head up-LEFT and the past-inverted frame with the head RIGHT — against the
        # spin the other frames draw (head right, then down); mirrored, the six air frames turn one way round
        'flip': [4, 7],
        # the helmet where it is NOT on top (1x px in the frame's own rect: cx, cy, rx, ry), read off the zoomed proof
        'helm': {5: [28.5, 28.5, 7, 6.5], 6: [16.5, 42, 7.5, 6.5], 7: [8.5, 18.5, 8, 8]},
    },
    'spike': {
        'names': ['ball in hand', 'ball up', 'wind-up', 'leap', 'SPIKE', 'follow-through', 'the bounce', 'double flex',
                  'chest pound', 'flex', 'bow', 'rest'],
        'air': [3],
        'rot': [0] * 12,
        'ball_from': 6,     # the ball is its own sprite from this frame on
    },
}


def fit_ground(a):
    """the sheet's grey as a quadratic surface through its clearly-grey pixels (a faint vignette)"""
    H, W, _ = a.shape
    g0 = np.median(a.reshape(-1, 3), 0)
    m = np.abs(a - g0).max(2) < 10
    yy, xx = np.mgrid[0:H, 0:W]
    X, Y = xx / W, yy / H
    B = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], -1)
    bg = np.zeros_like(a)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(B[m], a[..., c][m], rcond=None)
        bg[..., c] = B @ coef
    return bg


def hsl(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); L = (mx + mn) / 2; d = np.maximum(mx - mn, 1e-6)
    sat = (mx - mn) / np.maximum(mx, 1)
    hue = np.where(mx == r, (60 * ((g - b) / d) + 360) % 360, np.where(mx == g, 60 * ((b - r) / d) + 120, 60 * ((r - g) / d) + 240))
    return hue, sat, L, mx, mn


def skin_mask(a):
    """build-field-art.py `skin_mask` (v151 D): warm, saturated, redder than the pants, never the ball's brown"""
    al = a[..., 3]; r, g = a[..., 0], a[..., 1]
    hue, sat, L, mx, mn = hsl(a)
    warm = (al > 24) & (sat > .3) & (hue >= 8) & (hue < 46) & (L >= 22) & ~(g < r * 0.47)
    sk = warm & ((hue < 31.0) | ((hue < 34) & (L < 58)))
    f = nd.uniform_filter(sk.astype(float), 3); w = nd.uniform_filter(warm.astype(float), 3)
    return warm & (f >= w * 0.5) & (f > 0)


def ball_mask(a):
    """build-field-art.py `ball_mask` (v118): the football's brown, laces and outline bridged"""
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    brown = (al > 24) & (r >= 70) & (r <= 185) & (g < r * 0.47) & (g > b * 1.15) & (b <= 22)
    return nd.binary_dilation(brown, iterations=3) & (al > 24)


def normalize(a, protect):
    """build-field-art.py `normalize_palette`: the drawn gold (hue 24-46) rebuilt at hue 46 with its own chroma and floor,
    so ribRecolor's gold band (33-62) takes it for the pants; `protect` (skin, ball, dirt) keeps its own colour"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hue, sat, L, mx, mn = hsl(a)
    gold = (a[..., 3] > 0) & (hue >= 24) & (hue < 46) & (sat > 0.3) & (L >= 40) & ~protect
    C = mx - mn; X = C * (1 - abs(((46 / 60) % 2) - 1))
    out = a.copy()
    out[..., 0] = np.where(gold, C + mn, r); out[..., 1] = np.where(gold, X + mn, g); out[..., 2] = np.where(gold, mn, b)
    return out


def kit_ready(a):
    """build-field-art.py `kit_ready`: dark navy / gold shading lifted to the recolour's L=38 outline floor"""
    rgb = a[..., :3]; al = a[..., 3]
    hue, sat, L, mx, mn = hsl(a)
    navy = (hue >= 190) & (hue <= 265) & (sat > 0.15) & (L < 40) & (L > 14) & (al > 40)
    gold = (hue >= 30) & (hue <= 62) & (sat > 0.3) & (L <= 60) & (L > 20) & (al > 40)
    k = np.ones_like(L); k[navy] = 41 / np.maximum(L[navy], 1); k[gold] = 63 / np.maximum(L[gold], 1)
    out = a.copy(); out[..., :3] = np.clip(rgb * k[..., None], 0, 255)
    return out


def cut_sheet(name):
    raw = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGB')).astype(float)
    bg = fit_ground(raw)
    diff = raw - bg
    dm = np.abs(diff).max(2); dl = diff.mean(2)
    chroma = raw.max(2) - raw.min(2)
    shadow = (chroma < 20) & (dl < -6) & (dl > -52) & (dm < 60)
    strong = ((dm > 48) | ((chroma > 28) & (dm > 20))) & ~shadow
    core = nd.binary_closing(strong, iterations=1)
    core = nd.binary_fill_holes(core)
    lab, n = nd.label(core, structure=np.ones((3, 3)))
    sizes = nd.sum(core, lab, range(1, n + 1))
    bodies = [i + 1 for i, s in enumerate(sizes) if s > 3000]
    assert len(bodies) == 12, (name, len(bodies))
    cent = {i: nd.center_of_mass(lab == i) for i in bodies}
    byy = sorted(bodies, key=lambda i: cent[i][0])
    rows = [sorted(byy[r * 4:(r + 1) * 4], key=lambda i: cent[i][1]) for r in range(3)]
    order = [i for r in rows for i in r]                               # the reading order: frame k = order[k]
    # every pixel belongs to the nearest body (a Voronoi of the bodies)
    bodym = np.isin(lab, bodies)
    _, (iy, ix) = nd.distance_transform_edt(~bodym, return_indices=True)
    owner = lab[iy, ix]
    dist = nd.distance_transform_edt(~bodym)
    # soft art: the drawn dirt and speed lines (chromatic, near a body); the shadow and the grey are not
    soft = (~core) & (~shadow) & (dm > 14) & (chroma > 12) & (dist < 70)
    return raw, bg, core, soft, owner, order, rows, lab, dist


def frame_rgba(raw, bg, core, soft, owner, body, lab, pad=6):
    ys, xs = np.nonzero((owner == body) & (core | soft))
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad + 1, ys.min() - pad, ys.max() + pad + 1
    sl = (slice(y0, y1), slice(x0, x1))
    own = owner[sl] == body
    a = np.zeros((y1 - y0, x1 - x0, 4))
    al = np.where(core[sl] & own, 1.0, 0.0)
    d = np.sqrt(((raw[sl] - bg[sl]) ** 2).sum(2))
    sa = np.clip((d - 14) / 60, 0, 1) * (soft[sl] & own)
    al = np.maximum(al, sa)
    rgb = raw[sl].copy()
    semi = (al > 0) & (al < 1)
    rgb[semi] = np.clip(bg[sl][semi] + (raw[sl][semi] - bg[sl][semi]) / np.maximum(al[semi][:, None], 0.25), 0, 255)   # un-blend the grey
    a[..., :3] = rgb; a[..., 3] = al * 255
    mainb = (lab[sl] == body)
    return a, (x0, y0), mainb, (soft[sl] & own)


def downscale(a, k, soft_mask):
    """BOX to the target scale, unsharpen, then pixel-art alpha: the figure hard-edged, the dirt in quarter steps"""
    H, W = a.shape[:2]
    tw, th = max(1, round(W * k)), max(1, round(H * k))
    pre = a.copy(); pre[..., :3] *= (pre[..., 3:4] / 255)           # premultiply for the box filter
    im = Image.fromarray(np.clip(pre, 0, 255).astype('uint8'), 'RGBA').resize((tw, th), Image.BOX)
    sm = np.asarray(Image.fromarray((soft_mask * 255).astype('uint8')).resize((tw, th), Image.BOX)).astype(float) / 255
    o = np.asarray(im).astype(float)
    al = o[..., 3] / 255
    rgb = np.where(al[..., None] > 0.01, o[..., :3] / np.maximum(al[..., None], 1e-3), 0)
    sharp = np.asarray(Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'), 'RGB').filter(ImageFilter.UnsharpMask(radius=1.0, percent=120, threshold=1))).astype(float)
    fig = sm < 0.5
    out = np.zeros((th, tw, 4))
    out[..., :3] = sharp
    hard = np.where(al > 0.46, 255, 0)
    step = np.round(np.clip(al * 1.15, 0, 1) * 4) / 4 * 255
    out[..., 3] = np.where(fig, hard, np.where(al > 0.1, np.maximum(step, 64), 0))
    return out


def helm_auto(arr):
    """an upright frame's helmet: the dome of navy / gold under the first navy row (fists and a raised ball sit above
    it and are not navy), centred on its own span, the field helmet's size (~15 x 12 px at 1x)"""
    hue, sat, L, mx, mn = hsl(arr.astype(float))
    op = arr[..., 3] > 0
    navy = op & (hue >= 190) & (hue <= 265) & (sat > 0.15)
    kit = navy | (op & (hue >= 33) & (hue <= 62) & (sat > 0.3))
    runs = []   # per row: the longest run of kit pixels holding >= 4 navy (an arm's sleeve, a fist or the ball are narrower)
    for y in range(kit.shape[0]):
        best, x = None, 0
        while x < kit.shape[1]:
            if kit[y, x]:
                x0 = x
                while x < kit.shape[1] and kit[y, x]: x += 1
                if x - x0 >= 7 and navy[y, x0:x].sum() >= 4 and (best is None or x - x0 > best[1] - best[0]): best = (x0, x)
            else: x += 1
        runs.append(best)
    top = next(y for y, r in enumerate(runs) if r)
    span = [r for r in runs[top:top + 4] if r]
    cx = (min(r[0] for r in span) + max(r[1] for r in span)) / 2
    return [round(float(cx), 1), round(float(top + 6.2), 1), 7.6, 6.4]


def trim(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], xs.min(), ys.min()


def pack(items, width):
    """shelf-pack [(key, array)] into one atlas; returns the image and key -> (x, y, w, h)"""
    x = y = rowh = 0; rects = {}
    for key, arr in items:
        h, w = arr.shape[:2]
        if x + w > width: x = 0; y += rowh + 1; rowh = 0
        rects[key] = (x, y, w, h); x += w + 1; rowh = max(rowh, h)
    img = np.zeros((y + rowh, width, 4), np.uint8)
    for key, arr in items:
        rx, ry, w, h = rects[key]; img[ry:ry + h, rx:rx + w] = np.clip(arr, 0, 255).astype('uint8')
    return img, rects


def ribrecolor_py(arr, p1, p2):
    """src/05 `ribRecolor`, for the proof: navy -> primary, gold -> secondary, luminance kept"""
    a = arr.astype(float).copy(); hue, sat, L, mx, mn = hsl(a)
    lit = (a[..., 3] >= 20) & (L >= 38)
    navy = lit & (hue >= 190) & (hue <= 265) & (sat > 0.15)
    gold = lit & (hue >= 33) & (hue <= 62) & (sat > 0.3) & (L > 60)
    for m, base, ref in ((navy, p1, 95.0), (gold, p2, 165.0)):
        sc = np.clip(L / ref, 0.25, 1.75)
        for c in range(3): a[..., c] = np.where(m, np.minimum(255, base[c] * sc), a[..., c])
    return a


def main():
    proof = '--proof' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    cuts, scale_src = {}, []
    for name in SHEETS:
        raw, bg, core, soft, owner, order, rows, lab, dist = cut_sheet(name)
        cuts[name] = (raw, bg, core, soft, owner, order, rows, lab)
        b0 = order[0]; ys, _ = np.nonzero(lab == b0); scale_src.append(ys.max() - ys.min() + 1)
    K1 = STAND_PX / float(np.median(scale_src))                      # ONE factor for all three sheets: 1x px per source px
    manifest = {'v': '161A', 'stand': STAND_PX, 'k1': round(K1, 5), 'scales': list(SCALES), 'anims': {}}
    frames_by_scale = {s: [] for s in SCALES}
    for name, spec in SHEETS.items():
        raw, bg, core, soft, owner, order, rows, lab = cuts[name]
        air = set(spec['air'])
        # ground line per row: the median feet of its grounded frames (a row of airborne frames borrows the sheet's
        # median offset of feet below the row's bodies — the backflip's middle row has none standing)
        feet = {}
        for k, b in enumerate(order):
            ys, xs = np.nonzero(lab == b); feet[k] = ys.max()
        ground = {}
        for r in range(3):
            ks = [r * 4 + c for c in range(4) if (r * 4 + c) not in air]
            ground[r] = float(np.median([feet[k] for k in ks])) if ks else None
        FR = []
        for k, b in enumerate(order):
            r = k // 4
            a, (ox, oy), mainb, softm = frame_rgba(raw, bg, core, soft, owner, b, lab)
            if k in spec.get('flip', []):   # mirrored about the frame box's own centre (the anchors are read after)
                a = a[:, ::-1].copy(); mainb = mainb[:, ::-1].copy(); softm = softm[:, ::-1].copy()
            ball = None
            if spec.get('ball_from') is not None and k >= spec['ball_from']:
                bm = ball_mask(a) & (a[..., 3] > 0)
                blab, bn = nd.label(bm)
                if bn:
                    bs = nd.sum(bm, blab, range(1, bn + 1)); bi = int(np.argmax(bs)) + 1
                    if bs[bi - 1] > 600:
                        # the loose ball: its blob, grown over its outline, and never the body's main blob
                        bb = nd.binary_dilation(blab == bi, iterations=4) & (a[..., 3] > 0)
                        loose = bb & ~nd.binary_erosion(mainb & ~bb, iterations=1)
                        if loose.sum() > 400:
                            yy, xx = np.nonzero(loose)
                            ball = (a[yy.min():yy.max() + 1, xx.min():xx.max() + 1] * loose[yy.min():yy.max() + 1, xx.min():xx.max() + 1, None], (xx.mean() + ox, yy.mean() + oy))
                            a[loose] = 0
            skin = skin_mask(a); bmask = ball_mask(a)
            protect = skin | bmask | softm | ~mainb
            a = normalize(a, protect)
            a = kit_ready(a)
            # the feet: the body's own pixels, never the drawn dirt / ball that the blob swallowed (warm and not skin; the
            # pants were pulled to hue 46 above, so they are not 'warm' any more)
            hu, sa, _, _, _ = hsl(a)
            dirt = (hu >= 5) & (hu < 44) & (sa > 0.12) & ~skin
            ys, xs = np.nonzero(mainb & (a[..., 3] > 0) & ~dirt)
            fy = ys.max()                                             # the lowest body row
            h = ys.max() - ys.min() + 1
            bot = (ys >= fy - max(3, h * 0.22))
            footx = (xs[bot].min() + xs[bot].max()) / 2              # between the feet (the extent of the bottom band)
            wy, wx = np.nonzero(mainb)
            com = (wx.mean(), wy.mean())
            FR.append({'k': k, 'a': a, 'o': (ox, oy), 'soft': softm, 'skin': skin & mainb & ~bmask, 'fy': fy + oy, 'footx': footx + ox, 'com': (com[0] + ox, com[1] + oy),
                       'air': k in air, 'ball': ball, 'row': r, 'h': h})
        # the row lean: grounded frames' (foot x - com x), carried onto the airborne frames' placement
        lean = {}
        for r in range(3):
            g = [f['footx'] - f['com'][0] for f in FR if f['row'] == r and not f['air']]
            allg = [f['footx'] - f['com'][0] for f in FR if not f['air']]
            lean[r] = float(np.mean(g)) if g else float(np.mean(allg))
        for f in FR:
            r = f['row']
            if f['air']:
                gl = ground[r]
                if gl is None:   # no standing frame in the row: the sheet's other rows put the ground ~this far under the body centres
                    offs = [ground[q] - np.median([g['com'][1] for g in FR if g['row'] == q]) for q in range(3) if ground[q] is not None]
                    gl = np.median([g['com'][1] for g in FR if g['row'] == r]) + float(np.median(offs))
                f['gy'] = gl; f['gx'] = f['com'][0] + lean[r]
            else:
                f['gy'] = f['fy'] + 0.5; f['gx'] = f['footx']
        anim = {'n': 12, 'names': spec['names'], 'frames': []}
        for f in FR:
            fr = {'k': f['k'], 'name': spec['names'][f['k']], 'air': 1 if f['air'] else 0, 'rot': spec['rot'][f['k']]}
            for s in SCALES:
                kk = K1 * s
                arr = downscale(f['a'], kk, f['soft'])
                arr_t, tx, ty = trim(arr)
                sk = np.asarray(Image.fromarray((f['skin'] * 255).astype('uint8')).resize(arr.shape[1::-1], Image.BOX)).astype(float) > 127
                sk_t = (sk & (arr[..., 3] > 0))[ty:ty + arr_t.shape[0], tx:tx + arr_t.shape[1]]
                ox, oy = f['o']
                ax = (f['gx'] - ox) * kk - tx; ay = (f['gy'] - oy) * kk - ty
                cx = (f['com'][0] - ox) * kk - tx; cy = (f['com'][1] - oy) * kk - ty
                key = f'{name}{f["k"]}'
                frames_by_scale[s].append((key, arr_t, sk_t))
                if s == 1:
                    hx, hy, hrx, hry = spec.get('helm', {}).get(f['k']) or helm_auto(arr_t)
                    fr['helm'] = [round(hx - ax, 2), round(hy - ay, 2), hrx, hry]   # anchor-relative, 1x px (x2 at 2x)
                    fr.update({'ax': round(ax, 2), 'ay': round(ay, 2), 'cx': round(cx, 2), 'cy': round(cy, 2),
                               'lift': round(max(0.0, (f['gy'] - f['fy'])) * kk, 2) if f['air'] else 0})
                else:
                    fr['a%d' % s] = [round(ax, 2), round(ay, 2), round(cx, 2), round(cy, 2)]
                if f['ball'] is not None and s == 1:
                    bx, by = f['ball'][1]
                    fr['ball'] = [round((bx - f['gx']) * kk, 2), round((by - f['gy']) * kk, 2)]
            anim['frames'].append(fr)
        # the loose ball: one sprite (from the first frame it is loose), and where it lay on the frame before
        bf = spec.get('ball_from')
        if bf is not None:
            fb = FR[bf]
            if fb['ball'] is not None:
                for s in SCALES:
                    kk = K1 * s
                    barr = downscale(fb['ball'][0], kk, np.zeros(fb['ball'][0].shape[:2], bool))
                    bt, _, _ = trim(barr)
                    frames_by_scale[s].append((name + '_ball', bt, np.zeros(bt.shape[:2], bool)))
                prev = FR[bf - 1]; pa = prev['a']
                bm = ball_mask(pa) & (pa[..., 3] > 0)
                blab, bn = nd.label(bm)
                if bn: bm = blab == (int(np.argmax(nd.sum(bm, blab, range(1, bn + 1)))) + 1)   # the ball, not a brown fleck
                bm = bm & (pa[..., 0] > 60) & (pa[..., 1] < pa[..., 0] * 0.6)                     # its leather, not the grown outline
                yy, xx = np.nonzero(bm)
                px, py = (xx.mean() + prev['o'][0], yy.mean() + prev['o'][1]) if len(yy) else fb['ball'][1]
                anim['ballFrom'] = bf
                anim['ballStart'] = [round((px - prev['gx']) * K1, 2), round((py - prev['gy']) * K1, 2)]
                anim['ballDrawn'] = anim['frames'][bf].get('ball')
        manifest['anims'][name] = anim
    for s in SCALES:
        img, rects = pack([(k_, a_) for k_, a_, _ in frames_by_scale[s]], 512 * s)
        Image.fromarray(img, 'RGBA').save(os.path.join(OUT, f'cel_v161a_{s}x.png'), optimize=True)
        # the skin mask on the same rects (the runtime paints his own tone there, as v151 D's layer does on the field)
        skm = np.zeros(img.shape[:2], np.uint8)
        for k_, _, m_ in frames_by_scale[s]:
            rx, ry, w, h = rects[k_]; skm[ry:ry + h, rx:rx + w] = m_ * 255
        Image.fromarray(skm, 'L').save(os.path.join(OUT, f'cel_v161a_skin_{s}x.png'), optimize=True)
        if s == 1:
            for name, anim in manifest['anims'].items():
                for fr in anim['frames']:
                    fr['r'] = list(rects[f'{name}{fr["k"]}'])
                if name + '_ball' in rects: anim['ball'] = list(rects[name + '_ball'])
        else:
            for name, anim in manifest['anims'].items():
                for fr in anim['frames']:
                    fr['r%d' % s] = list(rects[f'{name}{fr["k"]}'])
                if name + '_ball' in rects: anim['ball%d' % s] = list(rects[name + '_ball'])
        manifest['atlas%d' % s] = [img.shape[1], img.shape[0]]
    json.dump(manifest, open(os.path.join(OUT, 'cel_v161a.json'), 'w'), separators=(',', ':'))
    print('public/celebrations/: cel_v161a_1x.png, cel_v161a_2x.png, cel_v161a.json  (k1 %.4f)' % K1)
    if proof: write_proof(manifest)


def write_proof(M):
    """every frame on one ground line per animation (the anchors' test), at 3x from the 1x atlas, plus the same row
    recoloured to a red / white kit through a port of ribRecolor (the kit's test)"""
    os.makedirs(PROOF, exist_ok=True)
    at = np.asarray(Image.open(os.path.join(OUT, 'cel_v161a_1x.png')).convert('RGBA'))
    Z, CW, GH = 3, 64, 84
    names = list(M['anims'])
    W = CW * 12 * Z; Hh = (GH * 2 + 14) * len(names) * Z + 20
    img = Image.new('RGB', (W, Hh), (44, 92, 52)); dr = ImageDraw.Draw(img)
    for ai, nm in enumerate(names):
        A = M['anims'][nm]
        for pass_ in range(2):
            gy = 20 + (ai * (GH * 2 + 14) + pass_ * GH + 64) * Z
            dr.line([(0, gy), (W, gy)], fill=(230, 230, 120), width=1)
            for fr in A['frames']:
                x, y, w, h = fr['r']
                arr = at[y:y + h, x:x + w].astype(float)
                if pass_: arr = ribrecolor_py(arr, (200, 40, 48), (238, 238, 238))
                sp = Image.fromarray(np.clip(arr, 0, 255).astype('uint8'), 'RGBA').resize((w * Z, h * Z), Image.NEAREST)
                cx0 = (fr['k'] * CW + CW // 2) * Z
                px = int(round(cx0 - fr['ax'] * Z)); py = int(round(gy - fr['ay'] * Z))
                img.paste(sp, (px, py), sp)
                dr.line([(cx0 - 4, gy), (cx0 + 4, gy)], fill=(255, 60, 60))
                hx, hy, hrx, hry = fr['helm']; hx += fr['ax']; hy += fr['ay']
                if pass_: dr.ellipse([px + (hx - hrx) * Z, py + (hy - hry) * Z, px + (hx + hrx) * Z, py + (hy + hry) * Z], outline=(255, 255, 0))
                cmx, cmy = px + fr['cx'] * Z, py + fr['cy'] * Z
                dr.ellipse([cmx - 2, cmy - 2, cmx + 2, cmy + 2], outline=(80, 200, 255))
                if not pass_: dr.text((cx0 - 28, gy + 4), f"{fr['k']} {fr['name'][:10]}", fill=(255, 255, 255))
            if pass_ == 0 and A.get('ball'):
                x, y, w, h = A['ball']; sp = Image.fromarray(at[y:y + h, x:x + w]).resize((w * Z, h * Z), Image.NEAREST)
                bx = (A['ballFrom'] * CW + CW // 2 + A['ballStart'][0]) * Z; by = gy + A['ballStart'][1] * Z
                dr.ellipse([bx - 3, by - 3, bx + 3, by + 3], outline=(255, 160, 0))
    img.save(os.path.join(PROOF, 'frames.png'))
    print('proof: art/celebrations-proof/frames.png')


if __name__ == '__main__':
    main()
