#!/usr/bin/env python3
"""v137 THE VAULT — cut the Prestige Vault sprites out of the concept sheets.

    python3 scripts/build-vault-art.py            # writes public/vault/ + the manifest
    python3 scripts/build-vault-art.py --proof    # ...and art/vault-proof/*.png to LOOK at

The sixteen sheets in art/ are flat RGB concept renders: baked black panels, hairline gold
frames, captions, bloom. None of them is a sprite sheet in the usable sense. This script is
the pipeline between them and public/vault/:

    identify the cell -> crop generously -> vaultcut.cut() -> trim -> standardise -> WebP

and it writes public/vault/manifest.json, which is the only thing the renderer reads: every
sprite's source sheet, source rectangle, output size, anchor and purpose.

Two things it deliberately does NOT do, both documented in docs/PRESTIGE-VAULT.md:

  * It does not cut the 12-frame spin rows. Measured, those rows are not a monotonic
    rotation - the cell widths run 56,46,38,23,17,20,55,54,50,52,54,64 px, so the sequence
    pops at the sixth frame and never narrows again. A coin spinning about an axis is
    exactly scaleX = |cos t|, so the renderer spins the FACE and BACK sprites procedurally
    and blends the EDGE sprite through the crossing. Exact geometry, no seam, 4 sprites
    instead of 48.

  * It does not ship the baked banner lettering. At native resolution the empty-room cell's
    banners read "NISCIPLIHE / PROGKESS / PRESTIOS / IMMORTALITY" - the word PRESTIGE is
    misspelled in the artwork. clean_banners() paints the lettering out; v137 drew the four
    words over the cloth in the game's own face, v193 K leaves the banners plain.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vaultcut import cut, trim, checker, contact_sheet, alpha_report

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'vault')
PROOF = os.path.join(ROOT, 'art', 'vault-proof')

SHEETS = {
    'coins':  'art/file_00000000ef3c81f5b4940437f75da9be.png',   # MASTER COIN LIBRARY
    'env':    'art/file_00000000ae1881f59ff290cfe8c7c66e.png',   # ENVIRONMENT ASSET SHEET
    'door':   'art/file_00000000bb7081f5a6a3d23c877af9c0.png',   # VAULT DOOR ASSET SHEET
    'ui':     'art/file_00000000fef081f5a6a6b67d04b903ec.png',   # VAULT UI (core states)
    'vfx':    'art/file_00000000b6fc81f5a98bc4581b9e6dd1.png',   # VFX ASSET SHEET
    'hero':   'art/file_00000000cb8c81f5bb0a46afbf1556cc.png',   # the composition target
}
DEN = ['bronze', 'silver', 'gold', 'blue']
PANEL = lambda i: 14 + 360 * i          # master-coin-library panel origins, pitch 360

# cell, (x0,y0,x1,y1) relative to the denomination panel, + the cut's parameters
COIN_CELLS = {
    'face':    ((12, 182, 172, 352),  dict(bg=110, open_px=3, shrink=1)),
    'back':    ((180, 182, 344, 352), dict(bg=110, open_px=3, shrink=1)),
    'hero':    ((152, 366, 306, 500), dict(bg=110, open_px=3, shrink=1)),
    'flat':    ((8, 520, 156, 624),   dict(bg=110, open_px=3, shrink=1)),
    'edge':    ((42, 372, 122, 500),  dict(bg=70,  open_px=2, shrink=0, feather=0.9)),
    'stack_s': ((2, 640, 88, 744),    dict(bg=95,  open_px=3, shrink=1, close_px=15)),
    'stack_m': ((94, 636, 202, 744),  dict(bg=95,  open_px=3, shrink=1, close_px=15)),
    'stack_l': ((212, 630, 328, 744), dict(bg=95,  open_px=3, shrink=1, close_px=21)),
}

# absolute cells on the other sheets
ENV_CELLS = {
    'room':        ((22, 146, 524, 634),   None),          # EMPTY VAULT BACKGROUND (opaque)
    'floor_plate': ((20, 674, 362, 970),   None),          # FLOOR PLATE (CENTER)   (opaque)
    'arch':        ((544, 158, 782, 394),  dict(bg=60, open_px=3, shrink=1)),
    'beam_l':      ((1110, 452, 1182, 640), dict(bg=40, open_px=2, shrink=0, feather=2.0)),
    'beam_r':      ((1168, 452, 1294, 640), dict(bg=40, open_px=2, shrink=0, feather=2.0)),
}
DOOR_CELLS = {
    'door_closed':  ((736, 132, 1000, 410), dict(bg=60, open_px=3, shrink=1)),   # angled, closed
    'door_open':    ((1186, 132, 1440, 410), dict(bg=60, open_px=3, shrink=1)),  # angled, open
    'door_front':   ((34, 128, 256, 400),   dict(bg=60, open_px=3, shrink=1)),   # front, closed
    'door_rim':     ((14, 486, 202, 690),   dict(bg=55, open_px=3, shrink=1)),
    'door_wheel':   ((1030, 490, 1198, 670), dict(bg=55, open_px=3, shrink=1)),
    'door_bolt':    ((338, 486, 430, 640),  dict(bg=55, open_px=2, shrink=0)),
}
CORE_CELLS = {
    'core_idle':     ((20, 92, 292, 402),   dict(bg=55, open_px=3, shrink=1)),
    'core_hover':    ((288, 92, 560, 402),  dict(bg=55, open_px=3, shrink=1)),
    'core_charged':  ((862, 92, 1140, 402), dict(bg=55, open_px=3, shrink=1)),
    'core_complete': ((1146, 92, 1436, 402), dict(bg=55, open_px=3, shrink=1)),
}
VFX_CELLS = {
    'burst_gold': ((1088, 376, 1198, 544), dict(bg=40, open_px=2, shrink=0, feather=1.6)),
    'burst_blue': ((1200, 376, 1308, 544), dict(bg=40, open_px=2, shrink=0, feather=1.6)),
    'burst_mix':  ((1310, 376, 1424, 544), dict(bg=40, open_px=2, shrink=0, feather=1.6)),
}


def padded(im, n=10):
    """Lay the crop on a black margin. _border_flood starts at the border, so an object
    that TOUCHES the border is walked into and eaten; the pad guarantees it never does."""
    out = Image.new('RGB', (im.width + 2 * n, im.height + 2 * n), (0, 0, 0))
    out.paste(im, (n, n))
    return out


def cut_ex(im, bg=110, open_px=3, close_px=0, shrink=1, feather=1.1):
    """cut() plus an optional CLOSING, which the coin stacks need: the shadow band between
    two coins is as dark as the sheet's background and runs clear out to the gutter, so the
    border flood walks straight into the object through it. Closing seals a channel thinner
    than close_px before the fill runs."""
    im = padded(im)
    if not close_px:
        return cut(im, bg=bg, open_px=open_px, shrink=shrink, feather=feather)
    from scipy import ndimage as ndi
    from vaultcut import _border_flood, _largest
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = rgb.max(axis=2)
    fg = ndi.binary_closing(~_border_flood(lum < bg), np.ones((close_px, close_px)))
    if open_px:
        core = ndi.binary_opening(fg, np.ones((open_px, open_px)))
        if core.any():
            lab, n = ndi.label(fg, structure=np.ones((3, 3)))
            keep = set(int(v) for v in np.unique(lab[core]) if v)
            fg = np.isin(lab, list(keep))
    fg = ndi.binary_fill_holes(_largest(fg))
    a = Image.fromarray((fg * 255).astype(np.uint8), 'L')
    if shrink:
        a = a.filter(ImageFilter.MinFilter(shrink * 2 + 1))
    a = a.filter(ImageFilter.GaussianBlur(feather))
    an = np.clip((np.asarray(a).astype(np.float32) / 255.0 - 0.32) / 0.40, 0, 1)
    return Image.fromarray(np.dstack([rgb, an * 255]).astype(np.uint8), 'RGBA')


def clean_banners(room):
    """Paint the garbled lettering off the room's two banners.

    The artwork's left banner reads NISCIPLIHE / PROGKESS / PRESTIOS / IMMORTALITY and the
    right one BIGGER / PLAYEDS / BRIGHTER / TOMGRROW - PRESTIGE is misspelled in the art.
    The CROWNS are artwork, not text, and stay.

    v193 K: the banners are left PLAIN now (the renderer no longer draws words over them), so
    the patch has to be invisible on its own. v137 filled the glyphs with the per-column 30th
    percentile of the box, which left a barcode of vertical streaks and a visible box edge
    once nothing covered it. The fill is a HARMONIC inpaint instead: only the glyph pixels
    (and their glow) are unknown, every other pixel of the cloth is kept, and the unknown ones
    relax to the smooth surface that meets the surrounding cloth on every side (Jacobi
    iterations of the Laplace equation, seeded from the old percentile fill). A smooth fill
    on a dark, softly-lit banner reads as cloth; a faint deterministic grain at the cloth's
    own amplitude keeps it from looking airbrushed. Blurring the patch was tried in v137
    (a lighter bar where the text was) and so was interpolating from outside rows (it smears
    the crowns) - both are what the masked relaxation avoids."""
    a = np.asarray(room.convert('RGB')).astype(np.float32)
    out = a.copy()
    rng = np.random.RandomState(193)                       # the grain is the same every build
    # (x0,y0,x1,y1) of the LETTERING only, in room-cell coordinates. v193 K: drawn tight round
    # the glyphs, inside the banner's cloth - v137's boxes reached over the gold piping and the
    # pillar beside the left banner, and the mask ate a stretch of both.
    for (x0, y0, x1, y1) in [(68, 104, 116, 166), (392, 121, 436, 169)]:
        m = 3                                              # a margin of known cloth round the box
        X0, Y0, X1, Y1 = x0 - m, y0 - m, x1 + m, y1 + m
        patch = a[Y0:Y1, X0:X1].copy()
        inner = np.zeros(patch.shape[:2], bool); inner[m:-m, m:-m] = True
        lum, warm = patch.max(axis=2), patch[..., 0] - patch[..., 2]
        ink = (((lum > 46) & (warm > 6)) & inner).astype(np.uint8) * 255
        ink = np.asarray(Image.fromarray(ink, 'L').filter(ImageFilter.MaxFilter(7))).astype(np.float32) / 255.0
        unknown = (ink > 0.5) & inner
        # seed: the old per-column low percentile, then relax the unknown pixels
        cloth = np.percentile(patch[m:-m, m:-m], 30, axis=0)
        f = patch.copy()
        f[m:-m, m:-m][unknown[m:-m, m:-m]] = np.broadcast_to(cloth[None], (y1 - y0, x1 - x0, 3))[unknown[m:-m, m:-m]]
        for _ in range(1500):
            avg = 0.25 * (np.roll(f, 1, 0) + np.roll(f, -1, 0) + np.roll(f, 1, 1) + np.roll(f, -1, 1))
            f[unknown] = avg[unknown]
        # the cloth's own grain, measured on the known cloth of the box
        known = inner & ~unknown
        sd = float(np.std(patch[known] - np.asarray(Image.fromarray(np.clip(patch, 0, 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[known])) if known.any() else 0.0
        grain = rng.normal(0, 1, patch.shape[:2]).astype(np.float32)
        grain = np.asarray(Image.fromarray(np.clip(grain * 40 + 128, 0, 255).astype(np.uint8), 'L')
                           .filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) - 128
        grain = grain / (grain.std() + 1e-6) * min(sd, 3.0) * 0.45
        f[unknown] += grain[unknown][:, None]
        # a feathered edge so the seam of the mask itself never shows
        soft = np.asarray(Image.fromarray((unknown * 255).astype(np.uint8), 'L')
                          .filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[..., None] / 255.0
        out[Y0:Y1, X0:X1] = patch * (1 - soft) + f * soft
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def upscale(im, factor, sharpen=True):
    """Lanczos + a restrained unsharp. The room cell is 506x512 and has to fill a phone, so
    it IS an upscale; it is a dark, hazy, softly-lit room, which is the one subject that
    survives one. The renderer draws every crisp element (light bloom, the banner words, the
    floor sweep, every coin) over it at device resolution."""
    w, h = int(im.width * factor), int(im.height * factor)
    up = im.resize((w, h), Image.LANCZOS)
    if sharpen:
        up = up.filter(ImageFilter.UnsharpMask(radius=2.2, percent=58, threshold=3))
    return up


def save(img, name, manifest, sheet, box, purpose, anchor='center', quality=92, lossless=False):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.webp')
    img.save(path, 'WEBP', quality=quality, lossless=lossless, method=6)
    rep = alpha_report(img) if img.mode == 'RGBA' else dict(w=img.width, h=img.height)
    manifest['sprites'][name] = dict(file='vault/' + name + '.webp', sheet=sheet,
                                     src=list(box) if box else None, purpose=purpose,
                                     anchor=anchor, bytes=os.path.getsize(path), **rep)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--proof', action='store_true', help='also write art/vault-proof/*.png')
    args = ap.parse_args()
    # a cell dropped from the tables must not linger in public/ from an earlier build
    if os.path.isdir(OUT):
        for f in os.listdir(OUT):
            if f.endswith('.webp') or f == 'manifest.json':
                os.remove(os.path.join(OUT, f))
    os.makedirs(OUT, exist_ok=True)
    if args.proof:
        os.makedirs(PROOF, exist_ok=True)
    man = dict(version='v137', note='Built by scripts/build-vault-art.py from the art/ concept sheets.',
               denominations=dict(bronze=1, silver=1000, gold=1000000, blue=1000000000),
               sheets=SHEETS, sprites={})
    proofs = {}

    # ---------- coins ----------
    im = Image.open(os.path.join(ROOT, SHEETS['coins'])).convert('RGB')
    shots = []
    for i, d in enumerate(DEN):
        for cell, (rel, kw) in COIN_CELLS.items():
            box = (PANEL(i) + rel[0], rel[1], PANEL(i) + rel[2], rel[3])
            s = trim(cut_ex(im.crop(box), **kw))
            save(s, f'coin_{d}_{cell}', man, 'coins', box,
                 {'face': 'coin seen flat-on: UI, and a coin lying face-up in the hoard',
                  'back': 'the reverse; the far half of a procedural spin',
                  'hero': 'the 3/4 tilt: the workhorse in the hoard and in flight',
                  'flat': 'the shallow ellipse: a coin lying on the floor',
                  'edge': 'seen on edge: buried coins, and the crossing of a spin',
                  'stack_s': 'a 5-coin stack module inside the hoard',
                  'stack_m': 'a 25-coin stack module inside the hoard',
                  'stack_l': 'a 100-coin stack module inside the hoard'}[cell])
            shots.append((f'{d}_{cell}', s))
    proofs['coins'] = shots

    # ---------- environment ----------
    im = Image.open(os.path.join(ROOT, SHEETS['env'])).convert('RGB')
    shots = []
    for name, (box, kw) in ENV_CELLS.items():
        crop = im.crop(box)
        if kw is None:
            if name == 'room':
                crop = upscale(clean_banners(crop), 2.6)
                save(crop, 'room', man, 'env', box,
                     'the empty vault: the scene\'s foundation. Banner lettering painted out '
                     '(the artwork misspells PRESTIGE); since v193 K the banners stay plain.',
                     anchor='cover', quality=88)
            else:
                crop = upscale(crop, 2.2)
                save(crop, name, man, 'env', box, 'the centre floor plate, drawn under the hoard',
                     anchor='cover', quality=88)
            shots.append((name, crop.convert('RGBA')))
        else:
            s = trim(cut_ex(crop, **kw))
            save(s, name, man, 'env', box,
                 {'arch': 'the rear circular arch, behind the core',
                  'beam_l': 'a spotlight cone', 'beam_r': 'a spotlight cone'}[name],
                 quality=90)
            shots.append((name, s))
    proofs['env'] = shots

    # ---------- door ----------
    im = Image.open(os.path.join(ROOT, SHEETS['door'])).convert('RGB')
    shots = []
    for name, (box, kw) in DOOR_CELLS.items():
        s = trim(cut_ex(im.crop(box), **kw))
        save(s, name, man, 'door', box, 'vault door part: ' + name.replace('door_', ''))
        shots.append((name, s))
    proofs['door'] = shots

    # ---------- core + vfx ----------
    im = Image.open(os.path.join(ROOT, SHEETS['ui'])).convert('RGB')
    shots = []
    for name, (box, kw) in CORE_CELLS.items():
        s = trim(cut_ex(im.crop(box), **kw))
        save(s, name, man, 'ui', box, 'the upgrade receiver, state: ' + name.replace('core_', ''))
        shots.append((name, s))
    im = Image.open(os.path.join(ROOT, SHEETS['vfx'])).convert('RGB')
    for name, (box, kw) in VFX_CELLS.items():
        s = trim(cut_ex(im.crop(box), **kw))
        save(s, name, man, 'vfx', box, 'effect: ' + name)
        shots.append((name, s))
    proofs['core_vfx'] = shots

    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(man, f, indent=1)
    total = sum(s['bytes'] for s in man['sprites'].values())
    print(f'{len(man["sprites"])} sprites -> public/vault/  ({total/1024:.0f} KB)')

    if args.proof:
        for k, shots in proofs.items():
            p = os.path.join(PROOF, f'{k}.png')
            contact_sheet(shots, cols=8 if k == 'coins' else 5, cell=150).save(p)
            print('proof', p)


if __name__ == '__main__':
    main()
