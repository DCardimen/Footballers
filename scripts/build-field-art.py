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

def slice_sheet(name, min_px=60, row_tol=None, merge_small=0):
    im = Image.open(f'{SRC}/{name}.png').convert('RGBA'); a = np.asarray(im.getchannel('A')); m = a > 24
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

def cell_of(im, box, scale, baseline=46, center=None):
    """One 48x48 cell: the sprite scaled by the sheet's factor, feet on the baseline, centred."""
    crop = im.crop(tuple(box)); w, h = crop.size
    if not center: crop = kit_ready(crop)   # players, not the ball
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    if tw > CELL - 2 or th > CELL - 2:   # a wide or tall pose still fits the cell
        k = min((CELL - 2) / tw, (CELL - 2) / th); tw, th = max(1, round(tw * k)), max(1, round(th * k))
    spr = crop.resize((tw, th), Image.LANCZOS)
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
sc = sheet_scale(rows, 42, lambda b: True)
for ri, dd in DIR.items():
    r = rows[ri]
    for i in range(8): CELLS[f'run_{dd}{i}'] = cell_of(im, r[i], sc)
    CELLS[f'plant_{dd}'] = cell_of(im, r[8], sc); CELLS[f'cut_{dd}'] = cell_of(im, r[9], sc)
    CELLS[f'dive_{dd}'] = cell_of(im, r[10], sc); CELLS[f'fall_{dd}'] = cell_of(im, r[11], sc)
    CELLS[f'idle_{dd}'] = cell_of(im, r[8], sc)

# ---- reactions: 4 facings x (pump, stomp, arms up, arms wide, knee, crouch, walk, walk) ----
im, rows = slice_sheet('reactions')
assert len(rows) == 4 and all(len(r) == 8 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows, 42, lambda b: (b[3]-b[1]) > (b[2]-b[0]) * 0.9)
for ri, dd in enumerate(['dn', 'dr', 'ur', 'up']):
    r = rows[ri]
    for i in range(4): CELLS[f'celebrate_{dd}{i}'] = cell_of(im, r[i], sc)
    CELLS[f'hurt_{dd}0'] = cell_of(im, r[4], sc); CELLS[f'hurt_{dd}1'] = cell_of(im, r[5], sc)
    CELLS[f'walk_{dd}0'] = cell_of(im, r[6], sc); CELLS[f'walk_{dd}1'] = cell_of(im, r[7], sc)

# ---- getup: 4 facings, the flat frame sits in its own row band ---------------------------
im, rows = slice_sheet('getup', row_tol=140)
assert len(rows) == 4 and all(len(r) == 8 for r in rows), [len(r) for r in rows]
sc = sheet_scale(rows, 42, lambda b: (b[3]-b[1]) > 150)
for ri, dd in enumerate(['dn', 'dr', 'ur', 'up']):
    for i in range(8): CELLS[f'getup_{dd}{i}'] = cell_of(im, rows[ri][i], sc)

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
sc = sheet_scale(rows, 42, lambda b: (b[3]-b[1]) > 100)
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

# ---- pack -------------------------------------------------------------------------------
names = sorted(CELLS); rowsN = (len(names) + COLS - 1) // COLS
atlas = Image.new('RGBA', (COLS * CELL, rowsN * CELL), (0, 0, 0, 0)); meta = {}
for i, nm in enumerate(names):
    c, r = i % COLS, i // COLS; atlas.alpha_composite(CELLS[nm], (c * CELL, r * CELL)); meta[nm] = [c, r]
atlas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save('public/rib_field_v91.png', optimize=True)
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
