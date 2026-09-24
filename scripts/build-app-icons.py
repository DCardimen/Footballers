#!/usr/bin/env python3
"""v149 D IT INSTALLS — the app icons, cut from the game's own crest.

The crest is the one the title film lands on (RUNNING IT BACK over a football, blue swooshes):
`public/rib_film_v116.jpg` is that film's last frame (cut by scripts/build-splash-film.mjs), so the
icon a player taps is the picture the game opens on. Pillow only (no numpy, no ffmpeg).

Writes
  public/icon-192.png, icon-512.png              manifest "any" (full bleed, no transparency)
  public/icon-maskable-192.png, -512.png         manifest "maskable" (crest inside the 80% circle)
  public/apple-touch-icon.png (180), apple-touch-icon-167.png, -152.png   iOS home screen
  public/favicon-32.png                          the tab
  public/icon-1024.png                           App Store / Play listing icon (RGB, no alpha)
  resources/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png
                                                 the @capacitor/assets inputs (npx @capacitor/assets generate)
  resources/store/play-feature-1024x500.png      Google Play feature graphic
  art/icons/icons_proof.png                      every size side by side, to LOOK at

  python3 scripts/build-app-icons.py            (then run scripts/v149Dcheck.mjs)

The crop box below was measured on the 960x540 still; if the film is re-cut, re-measure it and look
at the proof. PLACEHOLDER-FREE but NOT YET APPROVED: the owner signs off on the icon (docs/APP-STORE.md).
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'public', 'rib_film_v116.jpg')
CREST_BOX = (100, 108, 870, 418)       # x0, y0, x1, y1 on the 960x540 still: swoosh tip to swoosh tip
GROUND = (7, 11, 18)                   # #070b12 — the manifest's background_color, the splash's ground


def feather_mask(size, pad):
    """An ellipse-ish soft mask so the crest's own sky melts into the background (no rectangle)."""
    w, h = size
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((pad, pad, w - pad, h - pad), radius=min(w, h) // 2 - pad, fill=255)
    return m.filter(ImageFilter.GaussianBlur(pad * 0.9))


def backdrop(still, n):
    """The film's own night sky, blurred into a square: the crest's glow stays, the edges fall off dark."""
    s = n / still.height
    big = still.resize((round(still.width * s), n), Image.LANCZOS)
    x = (big.width - n) // 2
    sq = big.crop((x, 0, x + n, n)).filter(ImageFilter.GaussianBlur(n * 0.045))
    sq = ImageEnhance.Brightness(sq).enhance(0.45)
    # a vignette toward the ground colour
    vig = Image.new('L', (n, n), 0)
    ImageDraw.Draw(vig).ellipse((-n * 0.25, -n * 0.2, n * 1.25, n * 1.2), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(n * 0.12))
    return Image.composite(sq, Image.new('RGB', (n, n), GROUND), vig)


def crest(still):
    return still.crop(CREST_BOX)


def compose(still, n, width_frac, bg=None, y_off=0.0):
    """The crest `width_frac` of the square wide, centred (nudged by y_off of n), over `bg`."""
    base = (bg.copy() if bg is not None else backdrop(still, n)).convert('RGBA')
    c = crest(still)
    w = round(n * width_frac)
    h = round(c.height * w / c.width)
    c = c.resize((w, h), Image.LANCZOS).convert('RGBA')
    c.putalpha(feather_mask((w, h), max(2, round(w * 0.035))))
    base.alpha_composite(c, ((n - w) // 2, (n - h) // 2 + round(n * y_off)))
    return base


def save(img, rel, rgb=True):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (img.convert('RGB') if rgb else img).save(path, optimize=True)
    return path


def main():
    still = Image.open(SRC).convert('RGB')
    master_any = compose(still, 1024, 0.94)          # "any": the crest nearly edge to edge
    master_mask = compose(still, 1024, 0.76)         # maskable: fits inside the 80% safe circle
    master_apple = compose(still, 1024, 0.90)        # iOS rounds the corners itself (~22%), keep the tips in

    out = []
    for n in (192, 512):
        out.append(save(master_any.resize((n, n), Image.LANCZOS), f'public/icon-{n}.png'))
        out.append(save(master_mask.resize((n, n), Image.LANCZOS), f'public/icon-maskable-{n}.png'))
    out.append(save(master_apple.resize((180, 180), Image.LANCZOS), 'public/apple-touch-icon.png'))
    for n in (167, 152):
        out.append(save(master_apple.resize((n, n), Image.LANCZOS), f'public/apple-touch-icon-{n}.png'))
    out.append(save(master_any.resize((32, 32), Image.LANCZOS), 'public/favicon-32.png'))
    out.append(save(master_apple, 'public/icon-1024.png'))                 # stores: RGB, no alpha

    # @capacitor/assets inputs
    out.append(save(master_apple, 'resources/icon-only.png'))
    fg = compose(still, 1024, 0.62, bg=Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)))   # adaptive icon foreground: inner 66%
    out.append(save(fg, 'resources/icon-foreground.png', rgb=False))
    out.append(save(backdrop(still, 1024), 'resources/icon-background.png'))
    splash = compose(still, 2732, 0.42, bg=Image.new('RGB', (2732, 2732), GROUND))
    out.append(save(splash, 'resources/splash.png'))
    out.append(save(splash, 'resources/splash-dark.png'))

    # Play feature graphic 1024x500: the still itself, cover-cropped
    s = 1024 / still.width
    fgph = still.resize((1024, round(still.height * s)), Image.LANCZOS)
    y = (fgph.height - 500) // 2
    out.append(save(fgph.crop((0, y, 1024, y + 500)), 'resources/store/play-feature-1024x500.png'))

    # the proof: every size at 1:1, plus the maskable one under a circle mask
    sizes = [('any 512', 'public/icon-512.png'), ('maskable 512', 'public/icon-maskable-512.png'),
             ('apple 180', 'public/apple-touch-icon.png'), ('any 192', 'public/icon-192.png'), ('fav 32', 'public/favicon-32.png')]
    W = 20 + sum(Image.open(os.path.join(ROOT, p)).width + 20 for _, p in sizes) + 532
    proof = Image.new('RGB', (W, 560), (40, 40, 40))
    x = 20
    for _, p in sizes:
        im = Image.open(os.path.join(ROOT, p))
        proof.paste(im, (x, 20)); x += im.width + 20
    circ = Image.new('L', (512, 512), 0); ImageDraw.Draw(circ).ellipse((0, 0, 511, 511), fill=255)
    proof.paste(Image.open(os.path.join(ROOT, 'public/icon-maskable-512.png')), (x, 20), circ)
    out.append(save(proof, 'art/icons/icons_proof.png'))
    for p in out:
        print('wrote', os.path.relpath(p, ROOT), Image.open(p).size, f'{os.path.getsize(p) // 1024}KB')


if __name__ == '__main__':
    main()
