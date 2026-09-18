#!/usr/bin/env python3
"""v137 THE VAULT — the extraction library.

The supplied Prestige Vault artwork is CONCEPT SHEETS: flat RGB PNGs with baked black
panels, hairline gold frames, captions and glow. Nothing in them has an alpha channel.
This module turns one cell of one sheet into a real transparent sprite.

The cut, in order:

  1. FLOOD the background in from the crop's border through pixels darker than `bg`.
     Every cell sits on near-black, so the fill runs right up to the object's lit rim and
     stops. It also eats the panel's own vignette and most of the bloom halo.
  2. Take the LARGEST component of what is left, after an OPENING — the panel's hairline
     frame and the caption underline cross a generous crop and would otherwise be welded
     to the object as little nubs. Opening severs a bridge thinner than `open_px`; the
     reconstruction step puts the object's own thin parts back.
  3. FILL HOLES. A coin's shadowed interior is darker than `bg` but is not reachable from
     the border, so it survives as a hole and is filled — this is why a high `bg` can be
     used without biting into the object.
  4. FEATHER. The mask is eroded by `shrink` (the bloom fringe hugs the rim), blurred, and
     the ramp is re-sharpened so the edge is a genuine one-pixel antialias rather than a
     four-pixel fade.

`checker()` composites a result over a checkerboard. Every sprite this repo ships was
LOOKED AT that way — a simulated checkerboard proves nothing on its own, so the build
writes contact sheets to art/vault-proof/ and they are inspected before the sprites land.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

__all__ = ['cut', 'trim', 'checker', 'contact_sheet', 'alpha_report']


def _border_flood(dark):
    """Background = the dark pixels connected to the crop's border."""
    lab, n = ndi.label(dark)
    if n == 0:
        return np.zeros_like(dark)
    edge = np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])
    keep = set(int(v) for v in np.unique(edge) if v)
    return np.isin(lab, list(keep)) if keep else np.zeros_like(dark)


def _largest(mask):
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def cut(im, bg=110, open_px=3, shrink=1, feather=1.1, lo=0.32, hi=0.72):
    """One RGB crop -> one RGBA sprite. See the module docstring for the algorithm."""
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = rgb.max(axis=2)
    fg = ~_border_flood(lum < bg)
    if open_px > 0:
        core = ndi.binary_opening(fg, np.ones((open_px, open_px)))
        if core.any():
            # reconstruct: keep the component of `fg` that survived the opening, so the
            # object's own thin features come back but the severed frame line does not.
            lab, n = ndi.label(fg, structure=np.ones((3, 3)))
            keep = set(int(v) for v in np.unique(lab[core]) if v)
            fg = np.isin(lab, list(keep))
    fg = _largest(fg)
    fg = ndi.binary_fill_holes(fg)
    a = Image.fromarray((fg * 255).astype(np.uint8), 'L')
    if shrink > 0:
        a = a.filter(ImageFilter.MinFilter(int(shrink) * 2 + 1))
    if feather > 0:
        a = a.filter(ImageFilter.GaussianBlur(feather))
    an = np.asarray(a).astype(np.float32) / 255.0
    an = np.clip((an - lo) / max(hi - lo, 1e-6), 0, 1)
    return Image.fromarray(np.dstack([rgb, an * 255.0]).astype(np.uint8), 'RGBA')


def trim(img, pad=1):
    a = np.asarray(img)
    ys, xs = np.nonzero(a[:, :, 3] > 6)
    if len(ys) == 0:
        return img
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + 1 + pad)
    return img.crop((int(x0), int(y0), int(x1), int(y1)))


def alpha_report(img):
    """What a sprite's alpha actually contains — the numbers the manifest records."""
    a = np.asarray(img)[:, :, 3].astype(np.float32) / 255.0
    return dict(w=img.width, h=img.height,
                opaque=round(float((a > 0.98).mean()), 4),
                clear=round(float((a < 0.02).mean()), 4),
                edge=round(float(((a > 0.02) & (a < 0.98)).mean()), 4))


def checker(img, sq=8, light=(214, 214, 214), dark=(150, 150, 150)):
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w]
    m = (((xx // sq) + (yy // sq)) % 2).astype(bool)
    base = np.where(m[..., None], np.array(dark), np.array(light)).astype(np.uint8)
    out = Image.fromarray(base, 'RGB')
    out.paste(img, (0, 0), img)
    return out


def contact_sheet(items, cols=6, cell=190, pad=10, label_h=16):
    """items: [(name, RGBA image)] -> one PNG on a checkerboard, captions under each."""
    from PIL import ImageDraw
    rows = (len(items) + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = rows * (cell + pad + label_h) + pad
    sheet = Image.new('RGB', (W, H), (26, 26, 30))
    d = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(items):
        c, r = i % cols, i // cols
        x = pad + c * (cell + pad)
        y = pad + r * (cell + pad + label_h)
        s = min(cell / max(img.width, 1), cell / max(img.height, 1), 3.0)
        t = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)
        sheet.paste(checker(t), (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        d.text((x + 2, y + cell + 2), f'{name} {img.width}x{img.height}', fill=(190, 190, 190))
    return sheet
