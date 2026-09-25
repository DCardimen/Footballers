"""Cut the v91 field atlas (public/rib_field_v91.png, 48px cells) from the sheets in art/field/.

Each sheet is AI-drawn on no fixed grid, so sprites are found by their alpha, grouped into rows,
split at transparent column gaps, and named by the renderer's own vocabulary (run_dn0, cut_sd,
getup_up3, celebrate_dn0, ball_spin7 ...). Every sprite is scaled by ONE factor per sheet so a
cycle never breathes, and anchored feet-down at a fixed baseline. Also rewrites the RIB_META_V91
block in src/05-field-renderer.js (v149 A: the renderer left index.html) and paints a labelled preview to /tmp/field_v91_preview.png."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json, re, os

SRC = 'art/field'; CELL = 48; COLS = 16
CELLS = {}   # name -> PIL RGBA 48x48

def components(mask):
    H, W = mask.shape; lab = np.zeros((H, W), dtype=np.int32); n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n
        while stack:
            y, x = stack.pop()
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; stack.append((yy, xx))
    return lab, n

def skin_mask(a):
    """v151 D THE SKIN IS HIS OWN — the drawn skin (the arms, the face, a bare calf) is an orange-brown at
    hue 24-31, and the pants are an orange gold at hue 32-39. normalize_palette used to pull BOTH onto the
    atlas's gold (hue 46), so ribRecolor painted every man's arms and face in his team's SECONDARY colour
    (white pants, white arms). Skin is read off the RAW sheet here — warm, saturated, and redder than the
    pants (hue under `SKIN_HUE`, or a darker pixel just past it), a majority vote over its neighbours so a
    shadowed fold of the pants does not flip, and never the football's brown (g under .47 r) — and is left
    out of the normalisation, so it keeps its own colour and stays outside the recolour's gold band. The
    renderer tints it per player from the same mask (skinMaskV151D)."""
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); L = (mx + mn) / 2; d = np.maximum(mx - mn, 1e-6)
    sat = (mx - mn) / np.maximum(mx, 1)
    hue = np.where(mx == r, (60 * ((g - b) / d) + 360) % 360, np.where(mx == g, 60 * ((b - r) / d) + 120, 60 * ((r - g) / d) + 240))
    warm = (al > 24) & (sat > .3) & (hue >= 8) & (hue < 46) & (L >= 22) & ~(g < r * 0.47)
    sk = warm & ((hue < SKIN_HUE) | ((hue < 34) & (L < 58)))
    f = np.asarray(Image.fromarray((sk * 255).astype('uint8')).filter(ImageFilter.BoxBlur(1))).astype(float)
    w = np.asarray(Image.fromarray((warm * 255).astype('uint8')).filter(ImageFilter.BoxBlur(1))).astype(float)
    return warm & (f >= w * 0.5) & (f > 0)
SKIN_HUE = 31.0

def normalize_palette(im):
    """Pull the sheet's kit onto the base atlas's palette so ribRecolor treats it identically.
    The drawn pants are an orange gold (hue 25-35) that falls under the recolour's gold band
    (33-62), so they never took a team colour and the defence came out tan. Skin is darker and
    redder (hue < 24, L < 40) and is left alone."""
    a = np.asarray(im).astype(float); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); L = (mx + mn) / 2
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0); d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, (60 * ((g - b) / d) + 360) % 360, np.where(mx == g, 60 * ((b - r) / d) + 120, 60 * ((r - g) / d) + 240))
    gold = (al > 0) & (hue >= 24) & (hue < 46) & (sat > 0.3) & (L >= 40)
    if os.environ.get('SKIN_V151D', '1') != '0': gold &= ~skin_mask(a)   # v151 D: the skin keeps its own colour
    # rebuild the gold pixels at hue 46 with their own saturation and lightness
    C = (1 - np.abs(2 * L / 255 - 1)) * (mx - mn) / np.maximum(mx, 1) * 255 * 0 + (mx - mn)   # chroma = max-min
    X = C * (1 - np.abs(((46 / 60) % 2) - 1)); mval = mn
    nr, ng, nb = C + mval, X + mval, mval                       # hue 46 sits in the 0-60 sector: (C, X, 0)
    out = a.copy(); out[..., 0] = np.where(gold, nr, r); out[..., 1] = np.where(gold, ng, g); out[..., 2] = np.where(gold, nb, b)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'), 'RGBA')

def slice_sheet(name, min_px=60, row_tol=None, merge_small=0, drop_px=0, keep_ball=False):
    raw = Image.open(f'{SRC}/{name}.png').convert('RGBA'); im = normalize_palette(raw)
    if keep_ball:   # v118: the football stays its own brown (see ball_mask) — only the new sheets, so no old cell moves
        prot = ball_mask(np.asarray(raw).astype(int)); arr = np.asarray(im).copy(); arr[prot] = np.asarray(raw)[prot]; im = Image.fromarray(arr, 'RGBA')
    a = np.asarray(im.getchannel('A')); m = a > 24
    # v108: a ball drawn LOOSE beside the man lands inside his crop rectangle, where min_px cannot
    # reach it (min_px only decides which blobs become frames). Erase any blob under drop_px from
    # the sheet itself before the figures are found. Measured on the RAW alpha, where a loose ball
    # is 430-1740 px and the smallest figure on these sheets is 2954 — a ball still in a hand is
    # part of the man's own blob and is never touched.
    if drop_px:
        lab0, n0 = components(m); sz = np.bincount(lab0.ravel(), minlength=n0 + 1)
        kill = np.isin(lab0, np.nonzero(sz[1:] < drop_px)[0] + 1)
        arr = np.asarray(im).copy(); arr[..., 3][kill] = 0; im = Image.fromarray(arr, 'RGBA'); m = m & ~kill
    md = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    lab, n = components(md); boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < min_px: continue
        sub = m[ys.min():ys.max()+1, xs.min():xs.max()+1]; yy, xx = np.nonzero(sub)
        if not len(xx): continue
        boxes.append([int(xs.min()+xx.min()), int(ys.min()+yy.min()), int(xs.min()+xx.max()+1), int(ys.min()+yy.max()+1)])
    # small blobs (a ball above the hands, a dust puff) join the nearest big box horizontally
    if merge_small:
        big = [b for b in boxes if (b[2]-b[0]) * (b[3]-b[1]) >= merge_small]
        small = [b for b in boxes if (b[2]-b[0]) * (b[3]-b[1]) < merge_small]
        for s in small:
            cx, cy = (s[0]+s[2])/2, (s[1]+s[3])/2
            near = min(big, key=lambda b: abs((b[0]+b[2])/2 - cx) + 0.3 * abs((b[1]+b[3])/2 - cy), default=None)
            if near and abs((near[0]+near[2])/2 - cx) < 90:
                near[0] = min(near[0], s[0]); near[1] = min(near[1], s[1]); near[2] = max(near[2], s[2]); near[3] = max(near[3], s[3])
        boxes = big
    boxes.sort(key=lambda b: ((b[1]+b[3])/2, b[0])); rows = []
    for b in boxes:
        cy = (b[1]+b[3])/2
        for r in rows:
            if abs(r['cy'] - cy) < (row_tol or max(28, (b[3]-b[1]) * 0.45)):
                r['b'].append(b); r['cy'] = np.mean([(q[1]+q[3])/2 for q in r['b']]); break
        else: rows.append({'cy': cy, 'b': [b]})
    rows.sort(key=lambda r: r['cy'])
    for r in rows:
        r['b'].sort(key=lambda b: b[0]); med = np.median([b[2]-b[0] for b in r['b']]); split = []
        for b in r['b']:
            if med and b[2]-b[0] > med * 1.55:
                prof = (m[b[1]:b[3], b[0]:b[2]].sum(0) > 0).astype(int); runs = []; x = 0
                while x < len(prof):
                    if prof[x]:
                        x0 = x
                        while x < len(prof) and prof[x]: x += 1
                        runs.append((x0, x))
                    else: x += 1
                merged = []
                for a0, a1 in runs:
                    if merged and a0 - merged[-1][1] < 3: merged[-1] = (merged[-1][0], a1)
                    else: merged.append((a0, a1))
                for a0, a1 in merged:
                    if a1 - a0 < 8: continue
                    sub = m[b[1]:b[3], b[0]+a0:b[0]+a1]; yy, xx = np.nonzero(sub)
                    split.append([b[0]+a0+int(xx.min()), b[1]+int(yy.min()), b[0]+a0+int(xx.max())+1, b[1]+int(yy.max())+1])
            else: split.append(b)
        r['b'] = sorted(split, key=lambda b: b[0])
    return im, [r['b'] for r in rows]

def kit_ready(crop):
    """ribRecolor keys on hue bands and skips pixels darker than L=38 as outlines. The new art
    shades navy and gold with dark gradients that fall under that floor, which would survive
    a recolour as navy shadow on a gold jersey. Lift those shadows to the floor so they pass
    through the recolour (they come out as a darker primary, which is what a shadow should be)."""
    a = np.asarray(crop).astype(float); rgb = a[..., :3]; al = a[..., 3]
    mx = rgb.max(2); mn = rgb.min(2); L = (mx + mn) / 2; sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    d = mx - mn; r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.where(d == 0, 0, np.where(mx == r, (60 * ((g - b) / np.maximum(d, 1)) + 360) % 360, np.where(mx == g, 60 * ((b - r) / np.maximum(d, 1)) + 120, 60 * ((r - g) / np.maximum(d, 1)) + 240)))
    navy = (hue >= 190) & (hue <= 265) & (sat > 0.15) & (L < 40) & (L > 14) & (al > 40)
    gold = (hue >= 30) & (hue <= 62) & (sat > 0.3) & (L <= 60) & (L > 20) & (al > 40)
    k = np.ones_like(L); k[navy] = 41 / np.maximum(L[navy], 1); k[gold] = 63 / np.maximum(L[gold], 1)
    out = a.copy(); out[..., :3] = np.clip(rgb * k[..., None], 0, 255)
    return Image.fromarray(out.astype('uint8'), 'RGBA')

def cell_of(im, box, scale, baseline=46, center=None, mirror=False):
    """One 48x48 cell: the sprite scaled by the sheet's factor, feet on the baseline, centred.
    mirror flips the sprite first: the atlas draws its sd/dr/ur facings looking LEFT and the
    renderer mirrors them for a man moving right (m.flip = dx > 0), so art drawn the other way
    round has to be turned before it is cut."""
    crop = im.crop(tuple(box)); w, h = crop.size
    if mirror: crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    if not center: crop = kit_ready(crop)   # players, not the ball
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    if tw > CELL - 2 or th > CELL - 2:   # a wide or tall pose still fits the cell
        k = min((CELL - 2) / tw, (CELL - 2) / th); tw, th = max(1, round(tw * k)), max(1, round(th * k))
    spr = crop.resize((tw, th), Image.BOX).filter(ImageFilter.UnsharpMask(radius=1.0, percent=140, threshold=1))
    al = spr.getchannel('A').point(lambda v: 255 if v > 118 else 0); spr.putalpha(al)   # pixel-art edges: no soft fringe
    cv = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    x = (CELL - tw) // 2; y = (CELL // 2 - th // 2) if center else (baseline - th)
    cv.alpha_composite(spr, (x, max(0, y))); return cv

def sheet_scale(rows, target_h, pick=lambda b: True):
    hs = [b[3]-b[1] for r in rows for b in r if pick(b)]
    return target_h / float(np.median(hs))

def helmet_w(im, box):
    """v118: the helmet's width in a crop, in source pixels. Every sheet draws the same man at its
    own size, and the helmet is the one feature a raised arm, a wide stance or a crouch never
    changes, so it is what the QB sheets are scaled by (a figure's HEIGHT is a pose, not a size).
    The helmet is the navy that touches the top of the figure: the black outline keeps it off the
    jersey, and the gold stripe splits it in two, so it is every navy blob starting within 6% of
    the highest one, and its width is their joint box. Measured 0.34 of the standing height on all
    four sheets."""
    a = np.asarray(im.crop(tuple(box))).astype(int); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    navy = (al > 24) & (b > r + 15) & (b < 150) & (r < 100); lab, n = components(navy); H = navy.shape[0]; tops = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) >= 400: tops.append((ys.min(), xs.min(), xs.max()))
    t0 = min(t[0] for t in tops); hel = [t for t in tops if t[0] < t0 + H * 0.06]
    return int(max(t[2] for t in hel) - min(t[1] for t in hel) + 1)

def ball_mask(a):
    """v118: the football's brown — darker than skin (r 70-185) and far redder (g under .47 r, no
    blue), the laces and outline bridged. Read off
    the RAW sheet, before normalize_palette pulls the sheet's gold onto the atlas's hue (the ball's
    brown sits inside that band and would come out gold — and take the PANTS' colour in the kit
    recolour). slice_sheet keeps these pixels out of the normalisation for the same reason."""
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    brown = (al > 24) & (r >= 70) & (r <= 185) & (g < r * 0.47) & (g > b * 1.15) & (b <= 22)
    # the laces and the outline cut the ball into slivers: bridge them before the blobs are read
    grown = np.asarray(Image.fromarray((brown * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))) > 0
    return grown & (al > 24)

def ball_or_hand(im, box, drawn, mirror=False):
    """v118: where the football sits in a crop — or, on a frame that draws none, the throwing hand —
    as a fraction of the crop's width and height. Which frames draw one is DECLARED at the cut (the
    eye settles it in a second; the skin's shadow on these sheets shares the ball's brown, so colour
    alone cannot): on a drawn frame the ball is the largest brown blob plus any blob a glove split
    off it (within 40 px of the largest)."""
    crop = im.crop(tuple(box))
    if mirror: crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.asarray(crop).astype(int); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]; H, W = al.shape
    if drawn:
        ball = ball_mask(a); lab, n = components(ball); sz = np.bincount(lab.ravel(), minlength=n + 1); sz[0] = 0
        assert n and sz.max() >= 600, 'no ball found on a frame declared to draw one'
        big = int(sz.argmax()); by, bx = np.nonzero(lab == big); box0 = (bx.min(), by.min(), bx.max(), by.max()); keep = lab == big
        for i in range(1, n + 1):
            if i == big or sz[i] < 300: continue
            y2, x2 = np.nonzero(lab == i)
            if x2.min() < box0[2] + 40 and x2.max() > box0[0] - 40 and y2.min() < box0[3] + 40 and y2.max() > box0[1] - 40: keep |= lab == i
        ys, xs = np.nonzero(keep); return (xs.mean() / W, ys.mean() / H, True)
    # no ball drawn: the throwing hand — the highest glove (the arm that just threw is the one up),
    # the one on his right (his LEFT when mirrored) when both hang level; the shoes are white too,
    # so the bottom fifth is out
    white = (al > 24) & (r > 215) & (g > 215) & (b > 215)
    lab, n = components(white); sz = np.bincount(lab.ravel(), minlength=n + 1); sz[0] = 0
    gl = [(np.nonzero(lab == i)[0].mean(), np.nonzero(lab == i)[1].mean()) for i in range(1, n + 1) if sz[i] >= 60]
    gl = [(y, x) for y, x in gl if y < H * 0.9]   # the shoes sit at 0.93 of the height and below; a glove on the hip at 0.88
    top = min(y for y, x in gl); level = [(y, x) for y, x in gl if y < top + H * 0.08]
    y, x = max(level, key=lambda q: -q[1] if mirror else q[1]); return (x / W, y / H, False)

def cell_offset(im, box, scale, drawn, mirror=False, baseline=46):
    """v118: the ball's (or the hand's) position in the CUT cell, in cell pixels off its centre —
    the units HAND_V108 speaks. Mirrors the same transform cell_of applies: the crop scaled by
    `scale`, feet on the baseline, centred."""
    if isinstance(drawn, tuple): return (drawn[0], drawn[1], False)
    fx, fy, drawn = ball_or_hand(im, box, drawn, mirror); w, h = box[2] - box[0], box[3] - box[1]
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    if tw > CELL - 2 or th > CELL - 2:
        k = min((CELL - 2) / tw, (CELL - 2) / th); tw, th = max(1, round(tw * k)), max(1, round(th * k))
    x0 = (CELL - tw) // 2; y0 = max(0, baseline - th)
    return (round(x0 + fx * tw - CELL / 2, 1), round(y0 + fy * th - CELL / 2, 1), drawn)

def row_scale(boxes, target=44.0):
    """v108: the one scale a cut CYCLE takes, and the height its figure actually reaches.
    The median figure goes to `target`, unless a pose in the cycle would then be too tall or too
    wide for the cell — cell_of shrinks such a frame on its own, and a cycle that shrinks on one
    frame breathes. A throw reaches wide (the arm and the ball at the ear) and tall (the arm
    through), so the whole cycle backs off together instead."""
    hs = [b[3] - b[1] for b in boxes]; med = float(np.median(hs))
    sc = min(target / med, (CELL - 2) / max(hs), (CELL - 2) / max(b[2] - b[0] for b in boxes))
    return sc, sc * med

# ---- run8: 8 facings x (8 run + plant + cut + dive + fall) -------------------------------
im, rows = slice_sheet('run8')
assert len(rows) == 8 and all(len(r) == 12 for r in rows), [len(r) for r in rows]
DIR = {0: 'dn', 7: 'dr', 6: 'sd', 5: 'ur', 4: 'up'}   # the five right-facing rows; the renderer mirrors the rest
sc = sheet_scale(rows, 44, lambda b: True)
for ri, dd in DIR.items():
    r = rows[ri]
    for i in range(8): CELLS[f'run_{dd}{i}'] = cell_of(im, r[i], sc)
    CELLS[f'plant_{dd}'] = cell_of(im, r[8], sc); CELLS[f'cut_{dd}'] = cell_of(im, r[9], sc)
    CELLS[f'dive_{dd}'] = cell_of(im, r[10], sc); CELLS[f'fall_{dd}'] = cell_of(im, r[11], sc)

# ---- reactions: 4 facings x (pump, stomp, arms up, arms wide, knee, crouch, walk, walk) ----
im, rows = slice_sheet('reactions')
assert len(rows) == 4 and all(len(r) == 8 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows, 44, lambda b: (b[3]-b[1]) > (b[2]-b[0]) * 0.9)
for ri, dd in enumerate(['dn', 'dr', 'ur', 'up']):
    r = rows[ri]
    for i in range(4): CELLS[f'celebrate_{dd}{i}'] = cell_of(im, r[i], sc)
    CELLS[f'hurt_{dd}0'] = cell_of(im, r[4], sc); CELLS[f'hurt_{dd}1'] = cell_of(im, r[5], sc)
    CELLS[f'walk_{dd}0'] = cell_of(im, r[6], sc); CELLS[f'walk_{dd}1'] = cell_of(im, r[7], sc)

# ---- getup: 4 facings, the flat frame sits in its own row band ---------------------------
im, rows = slice_sheet('getup', row_tol=140)
assert len(rows) == 4 and all(len(r) == 8 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows, 44, lambda b: (b[3]-b[1]) > 150)
for ri, dd in enumerate(['dn', 'dr', 'ur', 'up']):
    for i in range(8): CELLS[f'getup_{dd}{i}'] = cell_of(im, rows[ri][i], sc)
    CELLS[f'idle_{dd}'] = cell_of(im, rows[ri][4], sc)      # the upright frame: a man standing, weight even
CELLS['idle_sd'] = CELLS['idle_dr']

# ---- football: a spiral at 12 angles and an end-over-end tumble at 12 ---------------------
im, rows = slice_sheet('football', min_px=400)
assert len(rows[0]) == 12 and len(rows[1]) == 12, [len(r) for r in rows]
sc = sheet_scale(rows[:2], 24)   # the procedural ball the sheet replaces is 24 wide at scale 1
BALL_ANGLES = []
for i in range(12):
    CELLS[f'ball_spin{i}'] = cell_of(im, rows[0][i], sc, center=True)
    # the nose angle of each frame, from the alpha's principal axis (so the renderer can pick the
    # frame nearest the flight heading and rotate only the remainder)
    a = np.asarray(im.crop(tuple(rows[0][i])).getchannel('A')) > 24; ys, xs = np.nonzero(a)
    xs = xs - xs.mean(); ys = ys - ys.mean(); cov = np.cov(np.vstack([xs, ys])); w, v = np.linalg.eigh(cov)
    ax = v[:, np.argmax(w)]; BALL_ANGLES.append(round(float(np.arctan2(ax[1], ax[0])), 3))
for i in range(12): CELLS[f'ball_tumble{i}'] = cell_of(im, rows[1][i], sc, center=True)

# ---- catch_throw: the three uncontested rows, four frames per facing ---------------------
im, rows = slice_sheet('catch_throw', merge_small=2600, row_tol=120)
rows = [r for r in rows if len(r) >= 12][:3]
sc = sheet_scale(rows, 44, lambda b: (b[3]-b[1]) > 100)
def groups(r):   # a row is four groups of four frames, separated by a wider gap
    gs, cur = [], [r[0]]
    for a, b in zip(r, r[1:]):
        if b[0] - a[2] > 40: gs.append(cur); cur = [b]
        else: cur.append(b)
    gs.append(cur); return gs
for ri, dd in enumerate(['dn', 'dr', 'up']):
    gs = groups(rows[ri])
    for gi, g in enumerate(gs[:4]):
        for fi, b in enumerate(g[:4]): CELLS[f'catchseq_{dd}{gi}_{fi}'] = cell_of(im, b, sc)
    # the renderer's catch frames come from the first group
    g = gs[0]
    for fi in range(min(3, len(g))): CELLS[f'catch_{dd}{fi}'] = cell_of(im, g[fi], sc)
    if len(g) > 3: CELLS[f'catchhold_{dd}'] = cell_of(im, g[3], sc)

OLD_NAMES = sorted(CELLS)   # v107: everything above is packed and quantized exactly as before (see pack)

# ---- the throw: six frames a facing, one row a sheet ------------------------------------
# All four throw sheets draw the SAME motion: 0 set, 1 grip, 2 stride, 3 the ball cocked at the
# ear (the last frame holding it), 4 THE RELEASE (the arm through, the hand empty), 5 the follow.
# The thrown ball is drawn as a loose blob beside the man — the renderer carries its own football
# to the hand (v105), so a second one would show twice. It is its own alpha component, so min_px
# drops it rather than merging it in the way catch_throw's merge_small does. Each facing takes ONE
# row and that row's own median height, so every cycle lands on the same 44px figure and none of
# them breathes. Rows are picked for a planted, right-handed, on-model throw: rows that open on a
# turned facemask-on tuck (throw_back 2-3), that cock the ball in one hand and follow through with
# the other (throw_front 1), or that lean through the frame (all of throw_quarter_b) are left out.

# throw_back — the quarterback seen from behind: the renderer's `up`. Its row ends on the release
# extension with no separate follow-through drawn, so that last frame is held for the sixth cell.
im, rows = slice_sheet('throw_back', min_px=4000)
assert len(rows) == 4 and all(len(r) == 6 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows[:1], 44)
for i, fi in enumerate([0, 1, 2, 4, 5, 5]): CELLS[f'throw_up{i}'] = cell_of(im, rows[0][fi], sc)

# throw_front — the same throw facing the camera: `dn`. Five frames drawn, so the top of the cock
# is held one frame (the beat a quarterback actually pauses on) to land the release on frame 4.
im, rows = slice_sheet('throw_front', min_px=4000)
assert len(rows) == 5 and all(len(r) == 5 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows[3:4], 44)
for i, fi in enumerate([0, 1, 2, 2, 3, 4]): CELLS[f'throw_dn{i}'] = cell_of(im, rows[3][fi], sc)

# throw_quarter_a — the rear three-quarter: the shoulders open to the throwing side. Its seven-frame
# rows carry the whole motion including the arm coming down, so frames 0-5 land the release on 4
# with nothing repeated. Cut MIRRORED: `ur` is a left-looking cell that the renderer flips for a man
# working right, like every other sd/dr/ur cell in this atlas.
im, rows = slice_sheet('throw_quarter_a', min_px=4000)
assert [len(r) for r in rows] == [6, 6, 6, 6, 7, 7], [len(r) for r in rows]
sc = sheet_scale([rows[4][:6]], 44)
for i in range(6): CELLS[f'throw_ur{i}'] = cell_of(im, rows[4][i], sc, mirror=True)

# ---- stances: the pre-snap and ready poses, every one drawn from behind (`up`) -------------
# One scale for the planted poses, so a crouch comes out shorter than a stand instead of being
# stretched to match it. The backpedal row is drawn about 9% bigger than the rest of the sheet and
# would trip the cell's fallback shrink frame by frame (a cycle that breathes), so it takes its own.
im, rows = slice_sheet('stances', min_px=4000)
assert [len(r) for r in rows] == [5, 4, 6, 6, 4], [len(r) for r in rows]
sc = sheet_scale([rows[0], rows[1], rows[2], rows[4]], 44)
CELLS['ready_up'] = cell_of(im, rows[2][0], sc)      # the defensive back's ready idle, arms loose
# rows[1][1] is the centre over the ball — not cut: the arms read wrong at 44px (the ball is under him from v105 anyway)
CELLS['stance3_up'] = cell_of(im, rows[1][0], sc)    # the lineman's stance, bent, hands down
CELLS['carry_up'] = cell_of(im, rows[4][1], sc, mirror=True)   # the ball tucked at the hip:
# mirrored, because the drawn ball sits in the man's LEFT hand and the renderer hangs its own
# football off a rear-facing right-hander's screen-right hand (the handX rule in the bridge)
scb = sheet_scale(rows[3:4], 44)
for i in range(6): CELLS[f'backpedal_up{i}'] = cell_of(im, rows[3][i], scb)
# The row 2 idles differ only in the helmet's shading, not in the body — no sway to loop — so the
# ready pose is one cell, not a cycle. art/field/throw_quarter_b.png and snap_catch_mini.png are
# deliberately not cut: see the note in docs/CHANGELOG.md.

# ---- throw_dir_a / throw_dir_b: the throw carries a DIRECTION ---------------------------
# Both sheets are 4 rows x 8 frames and every row on both is drawn from BEHIND — the helmet shows
# no facemask and the shoulders stay square, the way run8's `up` row does, never run8's `ur`, so
# nothing on either sheet feeds a three-quarter facing. What they DO carry is the side the ball
# leaves on: the torso rotates to the throwing side on the release, so the arm finishes to the
# man's RIGHT (throw_dir_a row 0) or comes across the body and finishes to his LEFT (row 1, a
# drawn cross-body throw — not row 0 mirrored). `up` is never flipped by the renderer
# (faceMarker sets m.flip = false for up and dn), so both directions have to be cut.
# The rows run: 0 set, 1 the hand up, 2 THE BALL AT THE EAR (the last frame holding it, and the
# widest pose in the row), 3 the arm out with the hand already empty, 4 THE RELEASE (the arm
# through, the ball drawn loose beside it), 5-7 recovery. Frame 3 is left out of both cycles — it
# points the wrong way for the left one and doubles the follow for the right — and a frame is held
# instead, so the release lands on cell 4 like every other cycle in the atlas.
# The loose ball is dropped at the slice (drop_px), not merged: the renderer carries its own (v105).
# Not cut: throw_dir_a row 2 (the release frame's ball is fused to the glove — one blob with the
# man, so it cannot be stripped), throw_dir_a row 3 (no ball in any windup frame: the man throws
# nothing, and his lean changes frame to frame), throw_dir_b rows 0-2 (the same right-handed throw
# as throw_dir_a row 0, drawn smaller and with a mushier read — the arm never extends, frames 3-5
# are one hand-up pose), and throw_dir_b row 3 (a throw ON THE RUN: the feet never plant, and
# there is no state for it).
im, rows = slice_sheet('throw_dir_a', min_px=4000, drop_px=4000)
assert len(rows) == 4 and all(len(r) == 8 for r in rows), [len(r) for r in rows]
gR = [rows[0][i] for i in (0, 1, 2, 2, 4, 5)]    # ... 5: the follow, the arm coming down
gL = [rows[1][i] for i in (0, 0, 1, 1, 4, 7)]    # the left cycle holds the set and the ear instead:
# its own frame 2 (the arm extended all the way back) twists the torso until v104 can only find
# FOUR rows of jersey on it and the number shrinks to 3.5 of its 6 rows — every other frame cut
# here reads 5.5 or 6. And 7, the row's own stand, closes it: its frame 5 brings the arm back to
# the RIGHT, which contradicts a ball that has just left to the left
fig = min(row_scale(gR)[1], row_scale(gL)[1])    # ONE figure height for both, so a quarterback
# does not change size when he throws the other way
# v118: throw_dir_a's two cycles are superseded by the quarterback's own sheets below — the row 1
# cycle read as a LEFT-handed throw at 44px (the arm rising on his left on the release), and the
# quarterback is a right-hander whichever way the ball goes. The slice stays as the record of the
# sheet; nothing from it is named any more.
_ = (gR, gL, fig)

# ---- exchange_quarter: the handoff and the toss, both from behind -----------------------
# 6 rows of two 5-frame groups plus 2 rows of two 4-frame groups. Despite the name every figure
# on the sheet is a rear view as well (checked against run8's up and ur rows), so these are `up`
# cells too. Two groups carry a whole exchange and the rest are throws or empty-handed strides:
#   row 0 group A (frames 0-4): under centre with the ball on the grass, then the turn, the ball
#     in the hand, and THE BALL AT ARM'S LENGTH — the handoff's exchange point. Frames 0-1 are not
#     cut: the ball they draw is on the ground between his feet (v105's centerV105 puts it there).
#   row 0 group B (frames 5-9): the same man, same scale, with the ball already gone — its frames
#     8 and 7 finish the handoff (the arm still extended but EMPTY, then the hand coming back).
#   row 6 group A (frames 0-3): the underhand pitch — the ball in both hands at the belly, the
#     wind at the hip, the swing, and the release with the ball loose off the fingers (dropped).
#     Frame 4 (group B's first) squares him up again for the follow.
# Not cut: rows 1-5 (throws, and the ball vanishes between the cock and the release), row 6 group B
# past its first frame and row 7 (a squatter, wider build than the rest of the atlas; row 7's own
# ball-to-the-LEFT handoff is the only left-handed exchange drawn anywhere and it is that build).
imq, rowsq = slice_sheet('exchange_quarter', min_px=1500, drop_px=2000)
assert [len(r) for r in rowsq] == [10, 10, 10, 10, 10, 10, 8, 8], [len(r) for r in rowsq]
hand = [rowsq[0][i] for i in (2, 3, 4, 8, 7)]    # reach, the ball in the hand, at arm's length, empty, recover
toss = [rowsq[6][i] for i in (0, 1, 2, 3, 4)]    # the ball at the belly, the wind, the swing, THE RELEASE, the follow
figx = min(row_scale(hand)[1], row_scale(toss)[1])
# v118: exchange_quarter's handoff and toss are superseded too — the reach there rose to shoulder
# height and read as a throw; the quarterback's own sheets (below) keep the ball at the hip.
_ = (hand, toss, figx)
# art/field/exchange_mini.png is deliberately not cut, for snap_catch_mini's reason and three more:
# its figures are 69-98px against 146-179 on every other sheet (the whole atlas is drawn at one
# size but this one), the column of thrown balls running down the sheet links one row's box to the
# next, several rows split into 7 frames because two figures touch, and the frames inside a cycle
# repeat instead of moving (row 0 frames 0-2 are the same drawing). Its last two rows — the only
# run-with-the-ball-tucked on any of the new sheets — are a different build again (a big head on
# short legs), so no `scramble_*` cell comes out of this one either.

# ---- v118 THE QUARTERBACK'S OWN SHEETS: the handoff, the pitch, and the throw both ways --------
# Four sheets drawn for the quarterback alone, every figure a rear view (`up`), one row apiece:
#   qb_handoff_v118 (6): the ball at the belly squared to the camera, THE TURN with the ball at the
#     hip, the ball carried out low with both hands, at arm's length in both hands, at arm's length
#     in ONE hand, and the hand empty. Frame 0 is not cut — the squared belly pose reads as a man
#     facing the camera — so the drawn cycle is the turn through the empty hand, and the frame
#     the ball leaves on (cell 3, one hand at full stretch) lands on the sim's `handoff` event.
#   qb_toss_v118 (6): the same belly frame (not cut), the turn, the wind low at the hip, the ball
#     out at hip height, THE RELEASE with the ball loose off the fingers (a separate blob, dropped
#     at the slice), and the empty hand. Cell 3 (the release) lands on the event.
#   qb_throw_right_v118 (6): the set with no ball, the ball cocked at the right shoulder, THE BALL
#     AT THE EAR, the arm out forward with the hand already open, THE RELEASE (the arm straight up,
#     the ball just off the fingers — dropped), and a follow with the torso wrenched to the throw.
#     Frame 3 cannot sit where it was drawn (an open hand before the ball has left), so the ear is
#     held for it and it closes the cycle instead — the arm coming down through the target line,
#     square to the camera. Frame 5 is not cut: its twist leaves v104 five rows of jersey for the
#     number where every other cell here gives it nine or more.
#   qb_throw_cross_v118 (2 + a ball): the cross-body throw — the release with the RIGHT arm coming
#     over and across the body, the ball leaving to his left, and the follow with that arm finishing
#     down on the left hip. The left throw is the right throw's first four cells (the same set,
#     cock and ear — he is a right-hander whichever way the ball goes) and then these two.
# Every sheet draws the man at its own size, so each is scaled by its HELMET to the atlas's
# (`HELM44`, measured on run_up0), not by a figure height that changes with the pose. The two
# throws then share one shrink and the two exchanges another, so a quarterback does not change
# size between the ball leaving right and leaving left. `cell_offset` measures where the drawing
# put the ball (or, on a frame with none, the right hand) in each cut cell and prints it: those
# numbers are HAND_V108 in src/05-field-renderer.js, and BALL_DRAWN_V108 is the `drawn` flag beside them.
# The handoff is cut a second time MIRRORED (`handoffL_up*`) for a back coming off the
# quarterback's LEFT, which v108 could only skip: the reach goes to the side the back is on. The
# pitch is not mirrored — a pitch is thrown, and he throws right-handed.
# Not cut: art/file_000000007d1881f992b4a27d1ad6d128.png (a LEFT-handed throw, the ball cocked at
# the left ear and released with the left arm) and art/Screenshot_20260916_233648_ChatGPT.jpg.
imH, rowsH = slice_sheet('qb_handoff_v118', min_px=4000, drop_px=12000, keep_ball=True)
imT, rowsT = slice_sheet('qb_toss_v118', min_px=4000, drop_px=12000, keep_ball=True)
imR, rowsR = slice_sheet('qb_throw_right_v118', min_px=4000, drop_px=12000, keep_ball=True)
imX, rowsX = slice_sheet('qb_throw_cross_v118', min_px=4000, drop_px=12000, keep_ball=True)
assert [len(r) for r in rowsH] == [6] and [len(r) for r in rowsT] == [6] and [len(r) for r in rowsR] == [6] and [len(r) for r in rowsX] == [2], \
    [[len(r) for r in q] for q in (rowsH, rowsT, rowsR, rowsX)]
# the helmet a 44px man wears, taken off the handoff sheet's upright turn (frame 1): the exchange
# lands on the atlas's 44 and every other sheet follows by its helmet
HELM44 = helmet_w(imH, rowsH[0][1]) * 44.0 / (rowsH[0][1][3] - rowsH[0][1][1])
scH = HELM44 / helmet_w(imH, rowsH[0][1]); scT = HELM44 / helmet_w(imT, rowsT[0][1])
scR = HELM44 / helmet_w(imR, rowsR[0][0]); scX = HELM44 / helmet_w(imX, rowsX[0][1])
def fit_k(parts):   # the one shrink a family takes so its tallest and widest pose still fit the cell
    k = 1.0
    for im_, boxes, sc_ in parts:
        for b in boxes: k = min(k, (CELL - 2) / ((b[3] - b[1]) * sc_), (CELL - 2) / ((b[2] - b[0]) * sc_))
    return k
hand = [rowsH[0][i] for i in (1, 2, 3, 4, 5)]; toss = [rowsT[0][i] for i in (1, 2, 3, 4, 5)]
thrR = [rowsR[0][i] for i in (0, 1, 2, 2, 4, 3)]; thrX = [rowsX[0][0], rowsX[0][1]]
# which of those cells draw a football (the eye's list; BALL_DRAWN_V108 in src/05-field-renderer.js):
# 1 the cell draws it, 0 it does not (the ball rides the throwing hand), a pair: it does not and
# there is no glove to find either — the set, hands on the hips, the ball tucked behind the right one
DRAWN = { 'handoff_up': [1, 1, 1, 1, 0], 'handoffL_up': [1, 1, 1, 1, 0], 'toss_up': [1, 1, 1, 0, 0], 'throwR_up': [(9.5, -1.0), 1, 1, 1, 0, 0], 'throwL_up': [(9.5, -1.0), 1, 1, 1, 0, 0] }
kEx = fit_k([(imH, hand, scH), (imT, toss, scT)]); kThr = fit_k([(imR, thrR, scR), (imX, thrX, scX)])
OFFS = {}
def cut(name, im_, boxes, sc_, mirror=False):
    OFFS[name] = []
    for i, b in enumerate(boxes):
        CELLS[f'{name}{i}'] = cell_of(im_, b, sc_, mirror=mirror); OFFS[name].append(cell_offset(im_, b, sc_, DRAWN[name][i], mirror))
cut('handoff_up', imH, hand, scH * kEx); cut('handoffL_up', imH, hand, scH * kEx, mirror=True); cut('toss_up', imT, toss, scT * kEx)
cut('throwR_up', imR, thrR, scR * kThr)
for i, b in enumerate(thrR[:4]): CELLS[f'throwL_up{i}'] = CELLS[f'throwR_up{i}']
OFFS['throwL_up'] = list(OFFS['throwR_up'][:4])
for i, b in enumerate(thrX): CELLS[f'throwL_up{4 + i}'] = cell_of(imX, b, scX * kThr); OFFS['throwL_up'].append(cell_offset(imX, b, scX * kThr, DRAWN['throwL_up'][4 + i]))
print('v118 helmet px on the atlas %.2f · sheet scales H %.4f T %.4f R %.4f X %.4f · shrink exchanges %.3f throws %.3f' % (HELM44, scH, scT, scR, scX, kEx, kThr))
print('v118 figure heights (cell px): handoff %s · toss %s · throwR %s · throwL %s' % (
    [round((b[3]-b[1]) * scH * kEx, 1) for b in hand], [round((b[3]-b[1]) * scT * kEx, 1) for b in toss],
    [round((b[3]-b[1]) * scR * kThr, 1) for b in thrR], [round((b[3]-b[1]) * scX * kThr, 1) for b in thrX]))
for nm, offs in OFFS.items():
    print('v118 HAND_V108 %-12s [%s]   BALL_DRAWN_V108 %s' % (nm + ':', ', '.join('[%.1f, %.1f]' % (o[0], o[1]) for o in offs), [i for i, o in enumerate(offs) if o[2]]))

# ---- pack -------------------------------------------------------------------------------
# v107: the atlas is quantized to 256 colours, and ribRecolor keys on HUE BANDS — so when the new
# cells joined the octree the old cells' colours drifted a hair and a share of every kit's navy
# and gold fell out of the bands (v91check's recolour probe dropped from 85 to 14 gold pixels on
# one run frame). The old cells are therefore packed FIRST, in their old order, and quantized on
# their own — byte-identical to the atlas that shipped before — and the new cells are mapped onto
# THAT palette and appended below, so no existing frame moves by a single value.
new_names = sorted(n for n in CELLS if n not in set(OLD_NAMES)); names = OLD_NAMES + new_names
rowsOld = (len(OLD_NAMES) + COLS - 1) // COLS; rowsN = rowsOld + (len(new_names) + COLS - 1) // COLS
old = Image.new('RGBA', (COLS * CELL, rowsOld * CELL), (0, 0, 0, 0)); meta = {}
for i, nm in enumerate(OLD_NAMES):
    c, r = i % COLS, i // COLS; old.alpha_composite(CELLS[nm], (c * CELL, r * CELL)); meta[nm] = [c, r]
oldQ = old.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
new = Image.new('RGBA', (COLS * CELL, (rowsN - rowsOld) * CELL), (0, 0, 0, 0))
for i, nm in enumerate(new_names):
    c, r = i % COLS, i // COLS; new.alpha_composite(CELLS[nm], (c * CELL, r * CELL)); meta[nm] = [c, rowsOld + r]
# PIL will only map RGB onto a palette, so the new cells' colours are matched on RGB and their
# alpha is carried across untouched; the result is written as plain RGBA (the pixels, not the
# palette, are what the renderer and the checks read).
atlas = Image.new('RGBA', (COLS * CELL, rowsN * CELL), (0, 0, 0, 0)); atlas.alpha_composite(oldQ.convert('RGBA'), (0, 0))
if new_names:
    # matched against the palette's OPAQUE entries only, so no new pixel lands on the transparent
    # colour (which would put it outside the palette file below)
    palO = oldQ.getpalette('RGBA'); opaque = [palO[i*4:i*4+3] for i in range(len(palO) // 4) if palO[i*4+3] > 0]
    palImg = Image.new('P', (1, 1)); palImg.putpalette([v for c in opaque for v in c] + list(opaque[-1]) * (256 - len(opaque)))   # padded with a real colour, never black
    newQ = new.convert('RGB').quantize(palette=palImg, dither=Image.Dither.NONE).convert('RGB')
    newQ = Image.merge('RGBA', (*newQ.split(), new.getchannel('A')))
    atlas.alpha_composite(newQ, (0, rowsOld * CELL))
# every cell's alpha is hard (cell_of thresholds it), and every colour is one of oldQ's 256, so the
# file goes out as a palette PNG with one transparent index — a third of the RGBA size. The index
# is looked up EXACTLY (PIL's own palette matching is approximate and moved kit pixels off their
# hue bands); a colour the palette does not hold falls back to the RGBA file.
rgba = np.asarray(atlas); alpha = rgba[..., 3]; pal = oldQ.getpalette('RGBA'); npal = len(pal) // 4
pkey = np.array([(pal[i*4] << 16) | (pal[i*4+1] << 8) | pal[i*4+2] for i in range(npal)]); palpha = np.array([pal[i*4+3] for i in range(npal)])
tI = next((i for i in range(npal) if palpha[i] == 0), None)
lut = {}
for i in range(npal):
    if palpha[i] > 0 and int(pkey[i]) not in lut: lut[int(pkey[i])] = i
key = (rgba[..., 0].astype(np.int64) << 16) | (rgba[..., 1].astype(np.int64) << 8) | rgba[..., 2].astype(np.int64)
op = alpha > 0; missing = [k for k in np.unique(key[op]) if int(k) not in lut]
if tI is None or missing:
    print(f'NOTE: {len(missing)} colours outside the palette — writing RGBA'); atlas.save('public/rib_field_v91.png', optimize=True)
else:
    idx = np.full(alpha.shape, tI, dtype=np.uint8); ks = np.array(sorted(lut)); vs = np.array([lut[int(k)] for k in ks])
    idx[op] = vs[np.searchsorted(ks, key[op])]
    out = Image.fromarray(idx, 'P'); out.putpalette([v for i in range(npal) for v in pal[i*4:i*4+3]])
    out.save('public/rib_field_v91.png', optimize=True, transparency=tI)
    back = np.asarray(Image.open('public/rib_field_v91.png').convert('RGBA'))
    assert np.array_equal(back[..., :3][op], rgba[..., :3][op]) and np.array_equal(back[..., 3] > 0, op), 'the palette file does not round-trip the atlas'
meta['_ballAngles'] = BALL_ANGLES
json.dump(meta, open('public/rib_field_v91.json', 'w'), separators=(',', ':'))
# the renderer reads the map inline (src/05-field-renderer.js since v149 A)
html = open('src/05-field-renderer.js').read()
blk = 'const RIB_META_V91 = ' + json.dumps(meta, separators=(',', ':')) + ';'
pat = re.compile(r'/\* RIB_META_V91_BEGIN \*/.*?/\* RIB_META_V91_END \*/', re.S)
if pat.search(html): html = pat.sub('/* RIB_META_V91_BEGIN */ ' + blk + ' /* RIB_META_V91_END */', html)
else: print('NOTE: no RIB_META_V91 marker in src/05-field-renderer.js yet; map written to public/rib_field_v91.json')
open('src/05-field-renderer.js', 'w').write(html)
# labelled preview
pv = atlas.copy(); d = ImageDraw.Draw(pv)
for nm, (c, r) in ((k, v) for k, v in meta.items() if not k.startswith('_')): d.text((c * CELL + 1, r * CELL + 1), nm[:9], fill=(255, 255, 0, 255))
bg = Image.new('RGBA', pv.size, (40, 40, 48, 255)); bg.alpha_composite(pv); bg.convert('RGB').resize((pv.width * 2, pv.height * 2), Image.NEAREST).save('/tmp/field_v91_preview.png')
print(f'{len(names)} cells, atlas {atlas.size}, {os.path.getsize("public/rib_field_v91.png")//1024} KB')
