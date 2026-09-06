"""Cut the v95 callout badges (public/badges/<name>.webp) from the three sheets in art/badges/.

The sheets are AI-drawn on a near-black ground with glows that fade into it, so there is no
alpha to cut on. Each pixel's alpha is recovered from how far it sits from the ground colour
(a screen-style unpremultiply: the glow keeps its colour, the ground goes to 0), then the
badges are found as connected blobs, named by their position on the sheet (the layout below
is the order the sheets were drawn in), trimmed, and written one file per badge so the live
field only fetches the ones it shows. Also rewrites the RIB_BADGES_V95 block in index.html
(name -> [w, h] of the file) and paints a labelled contact sheet to /tmp/badges_v95_preview.png.
  python3 scripts/build-badge-art.py"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json, re, os

SRC = 'art/badges'; OUT = 'public/badges'; MAX_W = 480
# sheet -> rows of badge names, left to right, top to bottom
LAYOUT = {
    'sheet-plays':  [['intercepted', 'fumble'], ['flag', 'bigplay', 'breakaway'], ['sack', 'bighit']],
    'sheet-downs':  [['firstdown', 'fourthdown'], ['goalline', 'missed']],
    'sheet-scores': [['touchdown', 'turnover'], ['fieldgoal', 'gamechanger']],
}

def key_out(im):
    """Alpha from distance to the ground colour. Full alpha past KNEE, a straight ramp below
    it so the glows fade instead of cutting; then un-blend the colour so a half-covered pixel
    keeps the badge's own colour rather than a darkened one."""
    a = np.asarray(im.convert('RGB')).astype(float)
    edge = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    dist = np.abs(a - bg).max(2)
    NOISE, KNEE = 9.0, 70.0
    al = np.clip((dist - NOISE) / (KNEE - NOISE), 0, 1)
    rgb = np.where(al[..., None] > 0, bg + (a - bg) / np.maximum(al[..., None], 1e-3), 0)
    out = np.dstack([np.clip(rgb, 0, 255), al * 255]).astype('uint8')
    return Image.fromarray(out, 'RGBA'), bg

def components(mask):
    H, W = mask.shape; lab = np.zeros((H, W), dtype=np.int32); n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n
        while stack:
            y, x = stack.pop()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; stack.append((yy, xx))
    return lab, n

def find_badges(im, want):
    """Blobs on a heavily dilated solid mask (so the debris around a badge joins it), the big
    ones kept, sorted into rows by centre y then by x. Must come out to the layout's count."""
    al = np.asarray(im.getchannel('A'))
    solid = Image.fromarray(((al > 160) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(15))
    lab, n = components(np.asarray(solid) > 0)
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 4000: continue
        boxes.append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1])
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        for r in rows:
            if abs(r['cy'] - cy) < 140: r['b'].append(b); break
        else: rows.append({'cy': cy, 'b': [b]})
    rows.sort(key=lambda r: r['cy'])
    for r in rows: r['b'].sort(key=lambda b: b[0])
    # two badges whose streaks touch (BIG PLAY's rays into BREAKAWAY's trail) come out as one
    # blob: split the widest box of a short row at its thinnest column until the count fits
    for r, names in zip(rows, want):
        while len(r['b']) < len(names):
            b = max(r['b'], key=lambda q: q[2] - q[0]); r['b'].remove(b)
            prof = (al[b[1]:b[3], b[0]:b[2]] > 160).sum(0); w = b[2] - b[0]
            lo, hi = int(w * 0.3), int(w * 0.7); cut = b[0] + lo + int(np.argmin(prof[lo:hi]))
            r['b'] += [[b[0], b[1], cut, b[3]], [cut, b[1], b[2], b[3]]]
            r['b'].sort(key=lambda q: q[0])
    got = [len(r['b']) for r in rows]; need = [len(r) for r in want]
    if got != need: raise SystemExit(f'badge layout mismatch: found rows {got}, layout says {need}')
    return [r['b'] for r in rows]

def trim(im, box):
    """Tight crop on the soft alpha (the glow counts), padded a little so the pop animation
    never clips a highlight."""
    crop = im.crop(tuple(box)); al = np.asarray(crop.getchannel('A'))
    ys, xs = np.nonzero(al > 12)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    pad = 6; x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(crop.width, x1 + pad); y1 = min(crop.height, y1 + pad)
    return crop.crop((x0, y0, x1, y1))

os.makedirs(OUT, exist_ok=True); meta = {}; tiles = []
for sheet, rows in LAYOUT.items():
    im, bg = key_out(Image.open(f'{SRC}/{sheet}.png'))
    found = find_badges(im, rows)
    for names, boxes in zip(rows, found):
        for name, box in zip(names, boxes):
            b = trim(im, box)
            if b.width > MAX_W: b = b.resize((MAX_W, max(1, round(b.height * MAX_W / b.width))), Image.LANCZOS)
            b.save(f'{OUT}/{name}.webp', 'WEBP', quality=74, method=4)
            meta[name] = [b.width, b.height]; tiles.append((name, b))
    print(f'{sheet}: ground {bg.astype(int).tolist()}, {sum(len(r) for r in rows)} badges')

# the renderer reads the manifest inline
html = open('index.html').read()
blk = 'const RIB_BADGES_V95 = ' + json.dumps(meta, separators=(',', ':')) + ';'
pat = re.compile(r'/\* RIB_BADGES_V95_BEGIN \*/.*?/\* RIB_BADGES_V95_END \*/', re.S)
if pat.search(html): html = pat.sub('/* RIB_BADGES_V95_BEGIN */ ' + blk + ' /* RIB_BADGES_V95_END */', html); open('index.html', 'w').write(html)
else: print('NOTE: no RIB_BADGES_V95 marker in index.html yet; manifest not written')
json.dump(meta, open(f'{OUT}/manifest.json', 'w'), separators=(',', ':'))

# labelled contact sheet
COLS = 4; cw, ch = MAX_W // 2 + 12, 220
pv = Image.new('RGBA', (COLS * cw, ((len(tiles) + COLS - 1) // COLS) * ch), (40, 40, 48, 255)); d = ImageDraw.Draw(pv)
for i, (name, b) in enumerate(tiles):
    t = b.copy(); t.thumbnail((cw - 12, ch - 30))
    x, y = (i % COLS) * cw + 6, (i // COLS) * ch + 6
    pv.alpha_composite(t, (x, y)); d.text((x, y + ch - 24), f'{name} {b.width}x{b.height}', fill=(255, 255, 0, 255))
pv.convert('RGB').save('/tmp/badges_v95_preview.png')
total = sum(os.path.getsize(f'{OUT}/{n}.webp') for n in meta)
print(f'{len(meta)} badges, {total // 1024} KB total -> {OUT}/')
