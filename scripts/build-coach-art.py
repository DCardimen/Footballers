"""v119: cut the coach — the tutorial's talking head — from the three uploaded sheets.

Each sheet is five rows by two columns of the same man: the LEFT column mouth closed, the RIGHT
column mouth open, one pose per row. The pose grid is fixed (the sheets are 793x1983, five rows of
~397px, two columns of ~397px) because on one sheet three rows touch and an alpha-band split merges
them. The closed mouth is cropped to its alpha and scaled to one height; the open mouth is the SAME
drawing with only the MOUTH pasted over from the open-mouth cell: the two cells were drawn twice and
differ everywhere — the arm, the clipboard, the brow, the tilt of the head — so flipping between
them twitched the whole man, and pasting the whole head made the head snap between two faces. Now
the open cell's mouth (the dark interior with its teeth and lips, found inside the face) is lifted
as a feathered blob and hung from the closed drawing's own mouth line (the smile stroke under the
nose — erased first, the jaw dropping below it), so nothing but the mouth moves, the open mouth is over
the closed one in every pose, and it never climbs toward the nose. Written as public/coach/<pose>_{a,b}.webp — `a` the closed
mouth, `b` the open one — so a line of dialogue can flip between the two while it types. `SHEETS`
below names each row; the tutorial script (public/rib-menu-coach.js) refers to poses by these
names. It also writes coach_pairs.png beside the sheets — look at it. python3 scripts/build-coach-art.py"""
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as _nd
def components(mask):
    lab, n = _nd.label(mask, structure=np.ones((3, 3), int)); return lab, n

def face_box(arr):
    """the face: the skin blob under the cap (not a raised hand beside the head)"""
    a = arr.astype(int); R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    ys, xs = np.nonzero(A > 10); top = ys.min(); H0 = ys.max() - top
    navy = (A > 10) & (B > R + 15) & (B < 150) & (R < 100); cap = navy[top:top + int(H0 * 0.12)]; cx = np.nonzero(cap)[1].mean()
    skin = (A > 10) & (R > 140) & (G > 80) & (B < 150) & (R > G + 20) & (G > B + 8); skin[top + int(H0 * 0.48):] = False
    lab, n = components(skin); best = None
    for i in range(1, n + 1):   # the biggest skin blob under the cap's centre (the gold stripe passes for skin too, so size decides)
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 400 or abs(xx.mean() - cx) > H0 * 0.16 or yy.min() > top + H0 * 0.3: continue
        if best is None or len(yy) > best[0]: best = (len(yy), (int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))
    return best[1]
def dark_blobs(arr, fb):
    a = arr.astype(int); lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11; dark = (a[..., 3] > 10) & (lum < 85)
    x0, y0, x1, y1 = fb; sub = dark[y0:y1, x0:x1]; lab, n = components(sub); fw, fh = x1 - x0, y1 - y0; out = []
    for i in range(1, n + 1):
        m = lab == i; yy, xx = np.nonzero(m); bx0, bx1, by0, by1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        if bx0 <= 2 or by0 <= 2 or bx1 >= fw - 2 or by1 >= fh - 2: continue    # the face outline, the cap, the mic
        if (by0 + by1) / 2 < fh * 0.5: continue                              # the eyes and the brows
        out.append((len(yy), (bx1 - bx0, by1 - by0), (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1), m))
    return out, fw, fh
def open_mouth(base, ob, name):
    """the closed drawing with the open cell's mouth set on it: the closed mouth's strokes are erased
    under a skin fill first, then the open mouth (a feathered blob) is centred on where they were,
    and the result is checked — no stroke of the closed mouth may survive (a coach with two mouths)"""
    fa, fo = face_box(base), face_box(ob)
    # the closed mouth: every thin wide dark stroke in the lower half of the face near the widest one
    # (a smile is one stroke; a frown or a set jaw is the lip line AND the lower-lip shadow under it)
    blobs, fw, fh = dark_blobs(base, fa); cand = [b for b in blobs if b[1][0] >= fw * 0.18 and b[1][1] <= b[1][0]]
    if not cand: raise SystemExit(name + ': closed mouth not found')
    anchor = max(cand, key=lambda b: b[1][0]); ay = (anchor[2][1] + anchor[2][3]) / 2
    strokes = [b for b in cand if abs((b[2][1] + b[2][3]) / 2 - ay) <= fh * 0.2 and b[2][2] > anchor[2][0] and b[2][0] < anchor[2][2]]
    ux0, uy0 = min(b[2][0] for b in strokes), min(b[2][1] for b in strokes); ux1, uy1 = max(b[2][2] for b in strokes), max(b[2][3] for b in strokes)
    mx, my = (ux0 + ux1) / 2, (uy0 + uy1) / 2
    closed = np.zeros(base.shape[:2], bool)
    for b in strokes: closed[fa[1]:fa[3], fa[0]:fa[2]] |= b[3]
    out = base.astype(float).copy(); H_, W_ = base.shape[:2]
    # erase them: a skin fill sampled from the ring around the strokes, feathered, so the open mouth
    # never has to cover a line it was not drawn over
    box = np.zeros_like(closed); box[uy0:uy1, ux0:ux1] = True; erase = _nd.binary_dilation(box, iterations=2)
    ring = _nd.binary_dilation(box, iterations=6) & ~_nd.binary_dilation(box, iterations=3)
    a_ = base.astype(int); skin = (a_[..., 3] > 10) & (a_[..., 0] > 140) & (a_[..., 1] > 80) & (a_[..., 2] < 150) & (a_[..., 0] > a_[..., 1] + 20) & (a_[..., 1] > a_[..., 2] + 8)
    src = base[ring & skin][:, :3]; fill = np.median(src, axis=0) if len(src) else np.array([228, 160, 100])
    ek = np.clip(_nd.distance_transform_edt(erase) / 2.0, 0, 1)
    for y, x in zip(*np.nonzero(erase)): out[y, x, :3] = out[y, x, :3] * (1 - ek[y, x]) + fill * ek[y, x]
    # the open mouth: the biggest dark blob in the lower half of the open cell's face (the interior with its lips)
    blobs, fw2, fh2 = dark_blobs(ob, fo); cand = [b for b in blobs if b[1][0] >= fw2 * 0.2 and b[1][1] >= 4]
    if not cand: raise SystemExit(name + ': open mouth not found')
    big = max(cand, key=lambda b: b[0]); m = np.zeros(ob.shape[:2], bool); m[fo[1]:fo[3], fo[0]:fo[2]] = big[3]
    m = _nd.binary_fill_holes(m); m = _nd.binary_dilation(m, iterations=3)
    # feathered: 3px in from the blob's edge ramps to full; the ring of skin around it blends into the closed face
    inside = _nd.distance_transform_edt(m); alpha = np.clip(inside / 3.0, 0, 1)
    yy, xx = np.nonzero(m); ox0, oy0 = xx.min(), yy.min(); ox = (xx.min() + xx.max()) / 2
    lip = np.nonzero(big[3])[0].min() + fo[1]              # the open mouth's upper lip (the undilated blob's top row)
    # the upper lip stays where the closed mouth line was and the JAW DROPS: the open mouth hangs from the
    # closed line instead of rising over it toward the nose
    dx, dy = int(round(mx - ox)), int(round(uy0 - lip))
    patch = ob.astype(float); placed = np.zeros_like(closed)
    for y in range(oy0, yy.max() + 1):
        ty = y + dy
        if ty < 0 or ty >= H_: continue
        for x in range(ox0, xx.max() + 1):
            tx = x + dx; k = alpha[y, x]
            if k <= 0 or tx < 0 or tx >= W_ or ob[y, x, 3] < 10: continue
            out[ty, tx] = out[ty, tx] * (1 - k) + patch[y, x] * k
            if k >= 1: placed[ty, tx] = True
    res = np.clip(out, 0, 255).astype(np.uint8)
    # the double-mouth check: no pixel of the closed strokes may still be dark outside the open mouth
    r_ = res.astype(int); lum = r_[..., 0] * .3 + r_[..., 1] * .59 + r_[..., 2] * .11
    left = int((closed & ~placed & (lum < 85)).sum())
    if left > 3: raise SystemExit(f'{name}: {left} px of the closed mouth survive beside the open one — a double mouth')
    print(f'   {name:12s} closed strokes {len(strokes)} at {(ux0, uy0, ux1, uy1)} → open mouth {big[2]} hung from the line; survivors {left}')
    return res

SHEETS = [
    ('art/coach/coach_sheet_1_v119.png', ['whoa', 'thinkcap', 'armscrossed', 'clipboard', 'relaxed']),
    ('art/coach/coach_sheet_2_v119.png', ['firedup', 'listen', 'shrug', 'flex', 'stop']),
    ('art/coach/coach_sheet_3_v119.png', ['welcome', 'tip', 'point', 'thumbsup', 'open']),
]
H = 360   # output height in px: the coach is drawn at ~260 css px on a phone, 2x for a sharp edge
OUT = 'public/coach'; os.makedirs(OUT, exist_ok=True); meta = {}; PAIRS = []
for path, names in SHEETS:
    im = Image.open(path).convert('RGBA'); W, Hh = im.size; rows, cols = 5, 2
    for r, name in enumerate(names):
        for c, suffix in enumerate('ab'):
            y0, y1 = round(r * Hh / rows), round((r + 1) * Hh / rows); x0, x1 = round(c * W / cols), round((c + 1) * W / cols)
            cell = im.crop((x0, y0, x1, y1)); a = np.asarray(cell.getchannel('A')) > 10
            # three rows touch on one sheet, so a fixed cell can carry a sliver of the neighbour's
            # shoes or cap: keep the largest blob (the man) and clear the rest
            lab, n = components(a); sz = np.bincount(lab.ravel(), minlength=n + 1); sz[0] = 0
            keep = lab == int(sz.argmax()); arr = np.asarray(cell).copy(); arr[..., 3][~keep] = 0; cell = Image.fromarray(arr, 'RGBA'); a = keep
            if suffix == 'a': base = cell; abox = (int(np.nonzero(a)[1].min()), int(np.nonzero(a)[0].min()), int(np.nonzero(a)[1].max()) + 1, int(np.nonzero(a)[0].max()) + 1)
            else:
                cell = Image.fromarray(open_mouth(np.asarray(base), np.asarray(cell), name), 'RGBA')
            crop = cell.crop(abox)   # the SAME box for both mouths, so nothing shifts between them
            if name == 'welcome' and suffix == 'a':   # the menu tile: his head, square, off the welcome pose
                hw = crop.width; head = crop.crop((hw // 2 - crop.height // 6, 0, hw // 2 + crop.height // 6, crop.height // 3))
                head.resize((128, 128), Image.LANCZOS).save(f'{OUT}/tile.webp', quality=88, method=6)
            k = H / crop.height; out = crop.resize((max(1, round(crop.width * k)), H), Image.LANCZOS)
            out.save(f'{OUT}/{name}_{suffix}.webp', quality=88, method=6)
            meta[f'{name}_{suffix}'] = [out.width, out.height]
            PAIRS.append(out.crop((0, 0, out.width, out.height * 4 // 10)))
w, h = max(p.width for p in PAIRS), max(p.height for p in PAIRS); sheet = Image.new('RGBA', (w * 6, h * 5), (60, 60, 60, 255))
for i, p in enumerate(PAIRS): sheet.paste(p, ((i % 6) * w, (i // 6) * h), p)
sheet.save('art/coach/coach_pairs.png')   # every pose, closed beside open — the thing to look at after a cut
json.dump(meta, open(f'{OUT}/coach.json', 'w'), separators=(',', ':'))
print(len(meta), 'cells ->', OUT, '·', sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)) // 1024, 'KB')
