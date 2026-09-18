#!/usr/bin/env python3
"""v134 THE MAN IN THE PICTURE -- cut the growth screen's figure at native resolution.

The growth screen draws the sheet's front-facing idle man (getup.png, row 0, cell 4 -- the same cell
build-field-art.py cuts into the 48px atlas as `idle_dn`). This cuts that one cell at its native
109x185, palette-normalised exactly as the atlas is (so ribRecolor's gold band takes the pants), and
pads it into a 128x200 box with the feet three rows off the floor: public/grow/idle_dn_hi.png.
The renderer (growDrawHiV134) recolours it into the team's kit at draw time.

    python3 scripts/build-grow-art.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'art/field/getup.png'; OUT = 'public/grow/idle_dn_hi.png'; W, H = 128, 200

def normalize_palette(im):
    a = np.asarray(im).astype(float); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); L = (mx + mn) / 2
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0); d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, (60 * ((g - b) / d) + 360) % 360, np.where(mx == g, 60 * ((b - r) / d) + 120, 60 * ((r - g) / d) + 240))
    gold = (al > 0) & (hue >= 24) & (hue < 46) & (sat > 0.3) & (L >= 40)
    C = (mx - mn); X = C * (1 - abs(((46 / 60) % 2) - 1)); mval = mn
    nr, ng, nb = C + mval, X + mval, mval
    out = a.copy(); out[..., 0] = np.where(gold, nr, r); out[..., 1] = np.where(gold, ng, g); out[..., 2] = np.where(gold, nb, b)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'), 'RGBA')

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im = normalize_palette(Image.open(SRC).convert('RGBA'))
    a = np.asarray(im.getchannel('A')); m = a > 24
    md = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    lab, n = ndimage.label(md); boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 60: continue
        sub = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; yy, xx = np.nonzero(sub)
        boxes.append([int(xs.min() + xx.min()), int(ys.min() + yy.min()), int(xs.min() + xx.max() + 1), int(ys.min() + yy.max() + 1)])
    boxes.sort(key=lambda b: ((b[1] + b[3]) / 2, b[0])); rows = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        for r in rows:
            if abs(r['cy'] - cy) < 140: r['b'].append(b); r['cy'] = np.mean([(q[1] + q[3]) / 2 for q in r['b']]); break
        else: rows.append({'cy': cy, 'b': [b]})
    rows.sort(key=lambda r: r['cy'])
    for r in rows: r['b'].sort(key=lambda b: b[0])
    assert len(rows) == 4 and all(len(r['b']) == 8 for r in rows), [len(r['b']) for r in rows]
    cell = im.crop(tuple(rows[0]['b'][4]))
    cw, ch = cell.size; sc = min((W - 8) / cw, (H - 6) / ch)
    cell = cell.resize((round(cw * sc), round(ch * sc)), Image.LANCZOS)
    box = Image.new('RGBA', (W, H), (0, 0, 0, 0)); box.paste(cell, ((W - cell.size[0]) // 2, H - 3 - cell.size[1]), cell)
    box.save(OUT, optimize=True)
    print(f'{OUT}: cell {cw}x{ch} -> {box.size}, ink rows {H - 3 - cell.size[1]}..{H - 3}')

if __name__ == '__main__':
    main()
