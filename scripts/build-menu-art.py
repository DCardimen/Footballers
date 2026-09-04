"""Cut the shipped menu art (public/menu/*.webp) from the originals in art/menu/."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os, glob

SRC, OUT = 'art/menu', 'public/menu'
os.makedirs(OUT, exist_ok=True)
report = []

def save(im, name, quality=86):
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=quality, method=6)
    report.append((name, im.size, os.path.getsize(p)))

def edge_box(im, thresh=18, frac=0.12):
    """Where the artwork actually is: the background of these renders is smooth,
    the subject is not, so gradient energy finds the subject."""
    g = np.asarray(im.convert('L')).astype(float)
    gy, gx = np.gradient(g)
    mag = np.where(np.hypot(gx, gy) > thresh, np.hypot(gx, gy), 0)
    def span(v):
        v = v / v.max(); i = np.nonzero(v > frac)[0]; return int(i.min()), int(i.max())
    x0, x1 = span(mag.sum(0)); y0, y1 = span(mag.sum(1))
    return x0, y0, x1, y1

def alpha_box(im, cut=8):
    a = np.asarray(im.convert('RGBA').getchannel('A'))
    ys, xs = np.nonzero(a > cut)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())

# ---- trait medallions: round coins, cut to the coin ------------------------
for f in sorted(glob.glob(f'{SRC}/badge_[a-z]*.png')):
    im = Image.open(f).convert('RGB')
    x0, y0, x1, y1 = edge_box(im)
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, ((x1 - x0) + (y1 - y0)) / 4
    coin = im.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))
    S = 4
    m = Image.new('L', (coin.width * S, coin.height * S), 0)
    ImageDraw.Draw(m).ellipse((2 * S, 2 * S, coin.width * S - 2 * S, coin.height * S - 2 * S), fill=255)
    coin.putalpha(m.resize(coin.size, Image.LANCZOS))
    save(coin.resize((192, 192), Image.LANCZOS), os.path.basename(f).replace('.png', '.webp'), 90)

# ---- legacy icons and nav icons: cut to their own alpha --------------------
for f in sorted(glob.glob(f'{SRC}/legacy_*.png')) + sorted(glob.glob(f'{SRC}/icon_*.png')):
    im = Image.open(f).convert('RGBA')
    x0, y0, x1, y1 = alpha_box(im)
    im = im.crop((x0, y0, x1 + 1, y1 + 1))
    s = max(im.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    save(sq.resize((256, 256), Image.LANCZOS), os.path.basename(f).replace('.png', '.webp'), 88)

# ---- the wordmark ---------------------------------------------------------
lg = Image.open(f'{SRC}/logo_wordmark.png').convert('RGBA')
x0, y0, x1, y1 = alpha_box(lg)
lg = lg.crop((x0, y0, x1 + 1, y1 + 1))
save(lg.resize((1000, round(1000 * lg.height / lg.width)), Image.LANCZOS), 'logo_wordmark.webp', 80)

# ---- the tagline swash: erode the matting fringe, then pull the strays gold -
sw = Image.open(f'{SRC}/swash_underline.png').convert('RGBA')
x0, y0, x1, y1 = alpha_box(sw)
sw = sw.crop((x0, y0, x1 + 1, y1 + 1))
a = sw.getchannel('A').filter(ImageFilter.MinFilter(5))          # pull the edge in past the fringe
arr = np.asarray(sw.convert('RGB')).astype(float)
red = (arr[:, :, 0] > arr[:, :, 1] * 1.45) & (arr[:, :, 0] > 120)  # red/orange speckle left by the key
arr[:, :, 1] = np.where(red, np.maximum(arr[:, :, 1], arr[:, :, 0] * 0.66), arr[:, :, 1])
arr[:, :, 2] = np.where(red, np.minimum(arr[:, :, 2], arr[:, :, 1] * 0.45), arr[:, :, 2])
sw = Image.fromarray(arr.astype('uint8'), 'RGB'); sw.putalpha(a)
save(sw.resize((900, round(900 * sw.height / sw.width)), Image.LANCZOS), 'swash_underline.webp', 88)

# ---- photographs ----------------------------------------------------------
hero = Image.open(f'{SRC}/hero_tunnel_wall.png').convert('RGB')
save(hero.resize((1600, round(1600 * hero.height / hero.width)), Image.LANCZOS), 'hero_tunnel.webp', 82)

por = Image.open(f'{SRC}/portrait_helmet.png').convert('RGB')
x0, y0, x1, y1 = edge_box(por, frac=0.10)
pad = 42
b = (max(0, x0 - pad), max(0, y0 - pad), min(por.width, x1 + pad), min(por.height, y1 + pad))
c = por.crop(b); s = max(c.size)
sq = Image.new('RGB', (s, s), (4, 4, 6)); sq.paste(c, ((s - c.width) // 2, (s - c.height) // 2))
save(sq.resize((640, 640), Image.LANCZOS), 'portrait_helmet.webp', 84)

for name, w, q in [('card_continue', 1000, 82), ('card_trophy', 900, 82)]:
    im = Image.open(f'{SRC}/{name}.png').convert('RGB')
    save(im.resize((w, round(w * im.height / im.width)), Image.LANCZOS), f'{name}.webp', q)

total = sum(s for _, _, s in report)
for n, size, s in report: print(f'{n:26s} {str(size):12s} {s // 1024:4d} KB')
print(f'{len(report)} files, {total // 1024} KB total')
