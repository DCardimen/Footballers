"""Cut the v92 stadium sheet (public/rib_lights_v92.png) from art/field/lights.png.

The lights sheet is two rows of six floodlight towers: row 0 has the head turned to the
left, row 1 to the right, and the six frames of a row are the same tower with its lamps
flaring differently, so a slow cycle through them reads as the lamps breathing. Sprites are
found by their alpha with the v91 slicer, scaled by ONE factor for the sheet, and packed on a
fixed grid (six columns, two rows) so the renderer can address them as a Phaser sprite sheet.
Rewrites the RIB_META_V92 block in index.html."""
from PIL import Image, ImageFilter
import numpy as np, json, re
src = open('scripts/build-field-art.py').read().split('# ---- run8')[0]
ns = {}; exec(src, ns)                       # the slicer (components, slice_sheet), nothing else runs
CW, CH = 128, 160                            # one tower per cell, feet on the cell's floor
im, rows = ns['slice_sheet']('lights', min_px=200)
assert len(rows) == 2 and all(len(r) == 6 for r in rows), [len(r) for r in rows]
hs = [b[3] - b[1] for r in rows for b in r]; sc = (CH - 4) / float(max(hs))
sheet = Image.new('RGBA', (CW * 6, CH * 2), (0, 0, 0, 0))
for ri, r in enumerate(rows):
    for ci, b in enumerate(r):
        crop = im.crop(tuple(b)); w, h = crop.size
        tw, th = max(1, round(w * sc)), max(1, round(h * sc))
        if tw > CW - 2: k = (CW - 2) / tw; tw, th = round(tw * k), round(th * k)
        spr = crop.resize((tw, th), Image.BOX).filter(ImageFilter.UnsharpMask(radius=1.0, percent=90, threshold=2))
        # the mast is pixel art, the beam is a glow: harden only the opaque body, keep the soft light
        a = np.asarray(spr.getchannel('A')).astype(int); a = np.where(a > 200, 255, a); spr.putalpha(Image.fromarray(a.astype('uint8')))
        sheet.alpha_composite(spr, ((ci * CW) + (CW - tw) // 2, ri * CH + (CH - 2 - th)))
# a palette PNG: the glow's soft alpha survives 255 colours and the file drops from ~430KB to ~100KB
sheet.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save('public/rib_lights_v92.png', optimize=True)
meta = {'cell': [CW, CH], 'cols': 6, 'rows': 2, 'faces': {'left': 0, 'right': 1}, 'frames': 6}
html = open('index.html').read()
block = '/* RIB_META_V92_BEGIN */ const RIB_META_V92 = ' + json.dumps(meta, separators=(',', ':')) + '; /* RIB_META_V92_END */'
if 'RIB_META_V92_BEGIN' in html:
    html = re.sub(r'/\* RIB_META_V92_BEGIN \*/.*?/\* RIB_META_V92_END \*/', lambda m: block, html, count=1, flags=re.S)
    open('index.html', 'w').write(html)
else: print('index.html has no RIB_META_V92 markers yet — paste this line:\n' + block)
print('lights: 12 towers ->', sheet.size, 'scale %.3f' % sc)
