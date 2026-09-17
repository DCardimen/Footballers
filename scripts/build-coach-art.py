"""v119: cut the coach — the tutorial's talking head — from the three uploaded sheets.

Each sheet is five rows by two columns of the same man: the LEFT column mouth closed, the RIGHT
column mouth open, one pose per row. The pose grid is fixed (the sheets are 793x1983, five rows of
~397px, two columns of ~397px) because on one sheet three rows touch and an alpha-band split merges
them. The closed mouth is cropped to its alpha and scaled to one height; the open mouth is the SAME
drawing with only the head pasted over from the open-mouth cell (the two drawings differ by a few
pixels everywhere, and flipping between them twitched the whole man), cropped to the same box.
Written as public/coach/<pose>_{a,b}.webp — `a` the closed mouth, `b` the open one — so a line of
dialogue can flip between the two while it types and nothing but the face moves. `COACH_POSES` below names each row; the tutorial script
(public/rib-menu-coach.js) refers to poses by these names.  python3 scripts/build-coach-art.py"""
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as _nd
def components(mask):
    lab, n = _nd.label(mask, structure=np.ones((3, 3), int)); return lab, n

SHEETS = [
    ('art/coach/coach_sheet_1_v119.png', ['whoa', 'thinkcap', 'armscrossed', 'clipboard', 'relaxed']),
    ('art/coach/coach_sheet_2_v119.png', ['firedup', 'listen', 'shrug', 'flex', 'stop']),
    ('art/coach/coach_sheet_3_v119.png', ['welcome', 'tip', 'point', 'thumbsup', 'open']),
]
H = 360   # output height in px: the coach is drawn at ~260 css px on a phone, 2x for a sharp edge
OUT = 'public/coach'; os.makedirs(OUT, exist_ok=True); meta = {}
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
                # THE JITTER: the two drawings of a pose differ by a few pixels everywhere (an arm, a
                # foot, the clipboard), so flipping between them made the whole man twitch. The open
                # mouth is the closed drawing with only the HEAD pasted over from the open one — the
                # helmet's own box (the navy touching the top of the man, widened a little) down to
                # the chin — so the body is one drawing and only the face moves.
                ba = np.asarray(base).astype(int); navy = (ba[..., 3] > 10) & (ba[..., 2] > ba[..., 0] + 15) & (ba[..., 2] < 150) & (ba[..., 0] < 100)
                H0 = abox[3] - abox[1]; hrows = navy[abox[1]:abox[1] + int(H0 * 0.32)]; ys2, xs2 = np.nonzero(hrows)
                hx0, hx1 = int(xs2.min()) - int(H0 * 0.03), int(xs2.max()) + 1 + int(H0 * 0.03); hy1 = abox[1] + int(H0 * 0.40)
                merged = np.asarray(base).copy(); ob = np.asarray(cell)
                merged[abox[1]:hy1, max(0, hx0):hx1] = ob[abox[1]:hy1, max(0, hx0):hx1]
                cell = Image.fromarray(merged, 'RGBA')
            crop = cell.crop(abox)   # the SAME box for both mouths, so nothing shifts between them
            if name == 'welcome' and suffix == 'a':   # the menu tile: his head, square, off the welcome pose
                hw = crop.width; head = crop.crop((hw // 2 - crop.height // 6, 0, hw // 2 + crop.height // 6, crop.height // 3))
                head.resize((128, 128), Image.LANCZOS).save(f'{OUT}/tile.webp', quality=88, method=6)
            k = H / crop.height; out = crop.resize((max(1, round(crop.width * k)), H), Image.LANCZOS)
            out.save(f'{OUT}/{name}_{suffix}.webp', quality=88, method=6)
            meta[f'{name}_{suffix}'] = [out.width, out.height]
json.dump(meta, open(f'{OUT}/coach.json', 'w'), separators=(',', ':'))
print(len(meta), 'cells ->', OUT, '·', sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)) // 1024, 'KB')
