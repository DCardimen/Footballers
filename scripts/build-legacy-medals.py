#!/usr/bin/env python3
"""v152 A — the 500 Legacy Rank medals, cut from art/legacy/sheet-*.png and put in PRESTIGE order.

The five sheets were drawn 1-500 in ten-medal rows, but the drawn order is not a prestige order: the
401-500 sheet opens with plain compass stars that look like rank 60, the 301-400 sheet repeats the
201-300 motifs with one more crown, and inside a row the 201-400 sheets run gold -> silver -> bronze.
So the art is re-organised here, not shipped as drawn:

  * each drawn ROW is a MOTIF (one crest drawn ten times, bronze to crowned) — 50 motifs, named, and
    graded by what their silhouette says (TIERS below, ten grades of five): plain shapes -> shields and
    laurels -> wings -> crowns and gems -> spikes, spires, mythic beasts;
  * inside a motif the metal climbs one ladder: bronze, silver, gold, the four enamels, then the three
    crowned / onyx / ice / ornate capstones (`LADDER_CD` fixes the 201-400 rows, drawn gold-first);
  * the 500 ranks are then ONE continuous climb, not fifty little ones (the owner: "I don't like going from
    big and beautiful medals to bronze and silver" / "first 100 bronze and silver mostly, no bronze or
    silver medals in the top 300"). Each medal's METAL is read off its pixels (`metal()`: no gold in the
    frame and mostly bronze-hued = bronze, otherwise silver — ice, and a silver frame under a gold crown, included). Every bronze and silver medal
    (~180) goes in ranks 1-200 — bronze first, then silver — topped up with the plainest golds; ranks
    201-500 hold none (asserted). Inside each half the order is a prestige score (`score()`): the motif's
    grade, the rung on the metal ladder and the size of the silhouette;
  * the drawn 1 is Rank 1 and the drawn 500 is Rank 500 and nothing else.

Each medal is cut from the dark ground (alpha from the distance to the sheet's ground colour, solid inside
the silhouette, holes filled so an onyx face stays opaque, the drop shadow kept as a soft ramp), placed on
a fixed 152px cell at the SHEET's scale — never re-fitted, so a later crest really is bigger on screen — and
written as five 10x10 atlases (100 ranks each; a rookie loads one file) plus one 48px atlas of all 500 for
the collection book. Rewrites the RIB_LEGACY_MEDALS_V152 block in src/31-legacy.js.

  pip install pillow numpy scipy
  python3 scripts/build-legacy-medals.py            # writes public/legacy/, the JS block
  python3 scripts/build-legacy-medals.py --proof    # also art/legacy-proof/ranks.png (every rank, labelled)
  python3 scripts/build-legacy-medals.py --proof --order-only   # just the proof (tuning the order)
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'art/legacy')
OUT = os.path.join(ROOT, 'public/legacy')
JS = os.path.join(ROOT, 'src/31-legacy.js')
CELL, MINI, QUALITY = 152, 48, 86

# sheet -> the top y of each row's number labels (the medals sit between one label row and the next)
SHEETS = [
    ('sheet-001-100.png', [104, 225, 347, 470, 592, 712, 846, 958, 1080, 1217]),
    ('sheet-101-200.png', [96, 222, 347, 468, 594, 704, 829, 945, 1071, 1217]),
    ('sheet-201-300.png', [104, 225, 349, 471, 592, 717, 836, 957, 1080, 1217]),
    ('sheet-301-400.png', [102, 225, 350, 472, 592, 718, 837, 958, 1082, 1219]),
    ('sheet-401-500.png', [105, 227, 332, 447, 566, 681, 800, 917, 1038, 1206]),
]

# The ten tiers (the essay's names), five families each, lowest first. A family is named by the drawn
# number of its first medal. The comment is why it sits where it does.
TIERS = [
    ('ROOKIE', [(1, 'Recruit Star'), (11, 'Pigskin Coin'), (51, 'Compass'), (21, 'Hex Shield'), (61, 'Service Ribbon')]),
    # flat shapes, one colour; the ribbon medals are the first thing that hangs
    ('ESTABLISHED', [(31, 'Helmet Hex'), (41, 'Goal Line'), (401, 'North Star'), (71, 'Winged Ball'), (81, 'Trophy Shield')]),
    # shields, laurels and the football motifs; 401's plain compass stars were drawn as rank 401
    ('ELITE', [(101, 'Winged Star'), (151, 'Flight Crest'), (421, 'Aegis Wing'), (111, 'Laurel Ball'), (91, 'Crown Jewel')]),
    # the wings arrive, then the first cut gems (91-100)
    ('SUPERSTAR', [(141, 'Three Stars'), (121, 'Laurel Helmet'), (131, 'Uprights'), (161, 'Silverware'), (171, 'Winged Gem')]),
    # every capstone crowned
    ('LEGENDARY', [(181, 'Royal Crown'), (411, 'Crowned Ball'), (431, 'Laurel Star'), (441, 'Gridiron Helm'), (191, 'Crown Gem')]),
    # crowns from the first sub-rank, heavy laurel rings
    ('HALL OF FAME', [(201, 'Star Wing'), (211, 'Laurel Wing'), (221, 'War Helm'), (231, 'Crowned Uprights'), (261, 'Starburst')]),
    # laurel-wings, spikes (261's star points break the round silhouette)
    ('ICON', [(241, 'Grand Trophy'), (251, 'Diamond Star'), (451, 'Golden Uprights'), (301, 'Icon Wing'), (311, 'Icon Ball')]),
    # crowned emblems in the premium metals
    ('ALL-TIME GREAT', [(321, 'Iron Helm'), (331, 'Monument Posts'), (341, 'Dynasty Cup'), (361, 'Eagle'), (371, 'Lion')]),
    # the mythic beasts
    ('IMMORTAL', [(281, 'Crown of Spires'), (351, 'Immortal Star'), (271, 'Crystal Crest'), (381, 'Diamond Throne'), (461, 'Eternal Cup')]),
    # spires, crystal, the gem trophies
    ('MYTHIC', [(291, 'Orb of Legends'), (481, 'Gem Citadel'), (471, 'Orbit'), (391, 'Sovereign Orb'), (491, 'The Legacy')]),
    # the biggest silhouettes on the sheets; 491-500 are drawn a size larger than anything else
]
# the 201-400 rows run gold, silver, bronze, red, blue, green, purple, onyx, ice, ornate: put the metal first
LADDER_CD = [3, 2, 1, 5, 6, 4, 7, 8, 9, 10]
LADDER = list(range(1, 11))


def cut_all():
    """{drawn number: RGBA 152x152}"""
    got = {}
    for si, (name, labels) in enumerate(SHEETS):
        a = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(float)
        bg = np.median(a.reshape(-1, 3), 0)
        top = 0
        for r, label_top in enumerate(labels):
            band = a[top:label_top - 1]
            H, W, _ = band.shape
            d = np.abs(band - bg).max(2)
            m = d > 24
            colp = m.sum(0)
            bounds = [0] + [int(round(W * (c + 1) / 10)) for c in range(9)] + [W]
            for b in range(1, 10):  # snap each cell boundary to the emptiest column near it
                lo = bounds[b] - 14
                bounds[b] = lo + int(np.argmin(colp[lo:bounds[b] + 14]))
            for c in range(10):
                cm = np.zeros_like(m)
                cm[:, bounds[c]:bounds[c + 1]] = m[:, bounds[c]:bounds[c + 1]]
                lab, n = nd.label(cm)
                sizes = nd.sum(cm, lab, range(1, n + 1))
                big = lab == int(np.argmax(sizes)) + 1
                ids = set(np.unique(lab[nd.binary_dilation(big, iterations=6) & cm])) - {0}
                keep = np.isin(lab, list(ids))
                # fill the holes the silhouette encloses (an onyx face), never the ground a neighbour walls in
                hl, hn = nd.label(nd.binary_fill_holes(keep) & ~keep)
                for h in range(1, hn + 1):
                    hy, hx = np.nonzero(hl == h)
                    if hx.min() <= bounds[c] + 2 or hx.max() >= bounds[c + 1] - 3 or hy.min() <= 1 or hy.max() >= H - 2:
                        continue
                    keep |= hl == h
                ys, xs = np.nonzero(keep)
                cy, cx = (ys.min() + ys.max() + 1) // 2, (xs.min() + xs.max() + 1) // 2
                inner = nd.binary_erosion(keep, iterations=2)
                ramp = np.clip((d - 7) / 23, 0, 1)
                al = np.where(inner, 1.0, np.where(keep, ramp, 0))
                al = nd.gaussian_filter(al, 0.5) * nd.binary_dilation(keep, iterations=1)
                rgb = np.where(al[..., None] > 0.02, bg + (band - bg) / np.maximum(al[..., None], 0.25), 0)
                rgba = np.dstack([np.clip(rgb, 0, 255), np.clip(al * 255, 0, 255)]).astype('uint8')
                canvas = np.zeros((CELL, CELL, 4), 'uint8')
                sy, sx = cy - CELL // 2, cx - CELL // 2
                y0, y1, x0, x1 = max(0, sy), min(H, sy + CELL), max(0, sx), min(W, sx + CELL)
                canvas[y0 - sy:y1 - sy, x0 - sx:x1 - sx] = rgba[y0:y1, x0:x1]
                got[si * 100 + r * 10 + c + 1] = Image.fromarray(canvas, 'RGBA')
            top = label_top + 16
    return got


def glow_of(im):
    """The medal's accent: the mean of its most saturated opaque pixels (the enamel / gem), as hex."""
    a = np.asarray(im).astype(float)
    op = a[..., 3] > 200
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(float)
    s = hsv[..., 1] * op
    if op.sum() < 20:
        return '#e8c86a'
    thr = np.percentile(s[op], 80)
    pick = op & (s >= thr)
    c = a[..., :3][pick].mean(0)
    c = np.clip(c * (235 / max(c.max(), 1)), 0, 255)  # brighten to a glow
    return '#%02x%02x%02x' % tuple(int(v) for v in c)


# the rungs of the metal ladder, as the medal is named ("Lion · Ruby")
GRADES = ['Bronze', 'Silver', 'Gold', 'Sapphire', 'Emerald', 'Ruby', 'Amethyst']
CAPS_ABE = ['Platinum', 'Crowned', 'Paragon']
CAPS_CD = ['Onyx', 'Diamond', 'Paragon']
# the prestige score: the motif's grade, the metal rung, the silhouette's size (in standard deviations)
RUNG_VALUE = [0, 1.2, 2.6, 3.0, 3.2, 3.4, 3.6, 4.8, 5.6, 6.6]
W_GRADE, W_RUNG, W_SIZE = 1.0, 0.8, 1.3
LOW_N = 200                               # ranks 1-200: every bronze and silver medal, then the plainest golds
METAL_BIAS = {'bronze': 0.0, 'silver': 4.0, 'gold': 8.0}   # inside the low half: bronze, then silver, then gold


def score(grade, rung, size_z):
    return W_GRADE * grade + W_RUNG * RUNG_VALUE[rung] + W_SIZE * size_z


def metal(im):
    """'bronze' / 'silver' / 'gold' (gold covers the enamels on a gold frame) from the opaque pixels' hues."""
    a = np.asarray(im)
    op = a[..., 3] > 200
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(float)
    h, sat, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    n = max(1, op.sum())
    gold = (op & (h >= 36) & (h <= 58) & (sat > 0.45) & (v > 0.45)).sum() / n
    silver = (op & (sat < 0.18) & (v > 0.35)).sum() / n
    if gold >= 0.02 and not ((silver >= 0.2 and silver > 2.5 * gold) or (silver >= 0.18 and silver > 3 * gold)):   # a silver frame under a small gold crown is silver
        return 'gold'
    bronze = (op & (h >= 12) & (h < 36) & (sat > 0.35) & (v > 0.25)).sum() / n
    return 'bronze' if bronze > 0.3 else 'silver'


def write_proof(cuts, order):
    pdir = os.path.join(ROOT, 'art/legacy-proof')
    os.makedirs(pdir, exist_ok=True)
    S = 76
    img = Image.new('RGB', (S * 20, (S + 12) * 25 + 30), (24, 28, 34))
    dr = ImageDraw.Draw(img)
    for k in range(500):
        x, y = (k % 20) * S, (k // 20) * (S + 12) + 30
        m = cuts[order[k]].resize((S, S), Image.LANCZOS)
        img.paste(m, (x, y), m)
        dr.text((x + 26, y + S), str(k + 1), fill=(200, 200, 200))
    img.save(os.path.join(pdir, 'ranks.png'))
    print('proof: art/legacy-proof/ranks.png')


def main():
    proof = '--proof' in sys.argv
    cuts = cut_all()
    area = {k: float((np.asarray(im)[..., 3] > 128).sum()) for k, im in cuts.items()}
    mu, sd = np.mean(list(area.values())), np.std(list(area.values()))
    motifs, meta = [], {}
    for ti, (tname, fams) in enumerate(TIERS):
        for start, fname in fams:
            cd = 201 <= start <= 400
            ladder = LADDER_CD if cd else LADDER
            mi = len(motifs)
            motifs.append({'name': fname, 'grade': ti, 'drawn': start})
            for rung, k in enumerate(ladder):
                d = start + k - 1
                mt = metal(cuts[d])
                word = GRADES[rung] if rung < 7 else (CAPS_CD if cd else CAPS_ABE)[rung - 7]
                if mt == 'bronze':
                    word = 'Bronze'
                elif mt == 'silver' and rung < 7:
                    word = 'Silver'
                elif mt == 'gold' and rung < 2:
                    word = 'Gold'
                z = (area[d] - mu) / sd
                meta[d] = {'motif': mi, 'rung': rung, 'word': word, 'metal': mt, 'score': score(ti, rung, z), 'low': ti + W_SIZE * z}
    pool = [d for d in meta if d not in (1, 500)]
    low = [d for d in pool if meta[d]['metal'] != 'gold']
    golds = sorted((d for d in pool if meta[d]['metal'] == 'gold'), key=lambda d: (meta[d]['score'], d))
    assert len(low) <= LOW_N - 1, 'more bronze / silver medals than the low half holds: %d' % len(low)
    low += golds[:LOW_N - 1 - len(low)]
    high = [d for d in golds if d not in low]
    low.sort(key=lambda d: (METAL_BIAS[meta[d]['metal']] + meta[d]['low'], d))
    high.sort(key=lambda d: (meta[d]['score'], d))
    order = [1] + low + high + [500]
    assert len(order) == 500 and sorted(order) == list(range(1, 501)), 'every drawn medal exactly once'
    assert all(meta[d]['metal'] == 'gold' for d in order[LOW_N:]), 'no bronze or silver medal above Rank 200'
    print('bronze %d, silver %d, gold in the low half %d' % tuple(sum(1 for d in order[:LOW_N] if meta[d]['metal'] == m) for m in ('bronze', 'silver', 'gold')))
    tiers = [{'name': t[0], 'from': i * 50 + 1, 'to': i * 50 + 50} for i, t in enumerate(TIERS)]
    names = [motifs[meta[d]['motif']]['name'] + ' · ' + meta[d]['word'] for d in order]
    names[-1] = 'Ultimate Legacy'
    families = [{'name': m['name'], 'tier': m['grade'], 'drawn': m['drawn']} for m in motifs]
    if proof:
        write_proof(cuts, order)
        if '--order-only' in sys.argv:
            return
    os.makedirs(OUT, exist_ok=True)
    glows, sheets = [], []
    for s in range(5):
        atlas = Image.new('RGBA', (CELL * 10, CELL * 10), (0, 0, 0, 0))
        for k in range(100):
            im = cuts[order[s * 100 + k]]
            atlas.alpha_composite(im, ((k % 10) * CELL, (k // 10) * CELL))
            glows.append(glow_of(im))
        f = 'legacy/medals_%d.webp' % (s + 1)
        atlas.save(os.path.join(ROOT, 'public', f), 'WEBP', quality=QUALITY, method=6)
        sheets.append(f)
    mini = Image.new('RGBA', (MINI * 25, MINI * 20), (0, 0, 0, 0))
    for k in range(500):
        mini.alpha_composite(cuts[order[k]].resize((MINI, MINI), Image.LANCZOS), ((k % 25) * MINI, (k // 25) * MINI))
    mini.save(os.path.join(OUT, 'medals_mini.webp'), 'WEBP', quality=78, method=4)
    data = {'cell': CELL, 'cols': 10, 'mini': MINI, 'miniCols': 25, 'sheets': sheets, 'miniSheet': 'legacy/medals_mini.webp',
            'tiers': tiers, 'motifs': families, 'drawn': order, 'names': names,
            'motif': [meta[d]['motif'] for d in order], 'glow': glows}
    json.dump(data, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
    block = ('/* RIB_LEGACY_MEDALS_V152 — generated by scripts/build-legacy-medals.py (edit the script, not this block) */\n'
             '  var MEDALS = ' + json.dumps(data, separators=(',', ':')) + ';\n'
             '  /* end RIB_LEGACY_MEDALS_V152 */')
    src = open(JS).read()
    new = re.sub(r'/\* RIB_LEGACY_MEDALS_V152 .*?/\* end RIB_LEGACY_MEDALS_V152 \*/', lambda _: block, src, flags=re.S)
    assert new != src or block in src, 'the RIB_LEGACY_MEDALS_V152 block is missing from src/31-legacy.js'
    open(JS, 'w').write(new)
    for f in sheets + ['legacy/medals_mini.webp']:
        print(f, os.path.getsize(os.path.join(ROOT, 'public', f)) // 1024, 'KB')


if __name__ == '__main__':
    main()
