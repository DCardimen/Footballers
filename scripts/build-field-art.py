"""Cut the v91 field atlas (public/rib_field_v91.png, 48px cells) from the sheets in art/field/.

Each sheet is AI-drawn on no fixed grid, so sprites are found by their alpha, grouped into rows,
split at transparent column gaps, and named by the renderer's own vocabulary (run_dn0, cut_sd,
getup_up3, celebrate_dn0, ball_spin7 ...). Every sprite is scaled by ONE factor per sheet so a
cycle never breathes, and anchored feet-down at a fixed baseline. Also rewrites the RIB_META_V91
block in index.html and paints a labelled preview to /tmp/field_v91_preview.png."""
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
    # rebuild the gold pixels at hue 46 with their own saturation and lightness
    C = (1 - np.abs(2 * L / 255 - 1)) * (mx - mn) / np.maximum(mx, 1) * 255 * 0 + (mx - mn)   # chroma = max-min
    X = C * (1 - np.abs(((46 / 60) % 2) - 1)); mval = mn
    nr, ng, nb = C + mval, X + mval, mval                       # hue 46 sits in the 0-60 sector: (C, X, 0)
    out = a.copy(); out[..., 0] = np.where(gold, nr, r); out[..., 1] = np.where(gold, ng, g); out[..., 2] = np.where(gold, nb, b)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'), 'RGBA')

def slice_sheet(name, min_px=60, row_tol=None, merge_small=0):
    im = normalize_palette(Image.open(f'{SRC}/{name}.png').convert('RGBA')); a = np.asarray(im.getchannel('A')); m = a > 24
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
# deliberately not cut: see the note in README's Recent changes.

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
# the renderer reads the map inline
html = open('index.html').read()
blk = 'const RIB_META_V91 = ' + json.dumps(meta, separators=(',', ':')) + ';'
pat = re.compile(r'/\* RIB_META_V91_BEGIN \*/.*?/\* RIB_META_V91_END \*/', re.S)
if pat.search(html): html = pat.sub('/* RIB_META_V91_BEGIN */ ' + blk + ' /* RIB_META_V91_END */', html)
else: print('NOTE: no RIB_META_V91 marker in index.html yet; map written to public/rib_field_v91.json')
open('index.html', 'w').write(html)
# labelled preview
pv = atlas.copy(); d = ImageDraw.Draw(pv)
for nm, (c, r) in ((k, v) for k, v in meta.items() if not k.startswith('_')): d.text((c * CELL + 1, r * CELL + 1), nm[:9], fill=(255, 255, 0, 255))
bg = Image.new('RGBA', pv.size, (40, 40, 48, 255)); bg.alpha_composite(pv); bg.convert('RGB').resize((pv.width * 2, pv.height * 2), Image.NEAREST).save('/tmp/field_v91_preview.png')
print(f'{len(names)} cells, atlas {atlas.size}, {os.path.getsize("public/rib_field_v91.png")//1024} KB')
