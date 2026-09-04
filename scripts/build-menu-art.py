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


# ---- silhouette masks: the team tint is confined to the kit ----------------
# Each photograph gets two alpha masks cut from its own pixels: _p (the jersey, worn in
# the primary colour) and _s (helmet and pants, the secondary). A hand-placed polygon
# says roughly where each garment is; inside it the pixels are keyed so skin, and the
# lit background between arm and torso, stay out. Percent coordinates refer to the
# original art. To re-place a garment, draw a 5% grid over the picture and edit here.

def poly_mask(size, polys_pct):
    w, h = size
    m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    for poly in polys_pct:
        d.polygon([(x / 100 * w, y / 100 * h) for x, y in poly], fill=255)
    return np.asarray(m) > 0

def chans(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    mx, mn = a.max(2), a.min(2)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0), a.mean(2)
def neutral(im, sat_max, lum_min, lum_max):
    sat, lum = chans(im)
    return (sat < sat_max) & (lum > lum_min) & (lum < lum_max)
def cloth(im, skin_sat=0.36, skin_lum=150):
    # fabric: anything that is not skin (warm and darker than the lit pads)
    sat, lum = chans(im)
    return ~((sat > skin_sat) & (lum < skin_lum))

def finish(mask_bool, size, blur, out):
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close pinholes
    m = m.resize(size, Image.LANCZOS).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(blur))
    rgba = Image.new('RGBA', size, (0, 0, 0, 0)); rgba.putalpha(m)
    rgba.save(out, 'WEBP', quality=80, method=6)
    return m

# ---------------- hero ----------------
hero = Image.open('art/menu/hero_tunnel_wall.png').convert('RGB'); W, H = hero.size
HELMET = [[(45,27),(46,22.5),(49,20),(52,20),(55,22.5),(56,28),(55,34),(52,36),(48,36),(45,33)]]
JERSEY = [[(38,39.5),(42.5,37),(47,36),(53,36),(57.5,37),(62,39.5),(62.8,44),(61.8,49),(59.8,51),(58.2,58),(57,72),(55.2,74),(44.5,74),(42.2,72),(41,58),(40,51),(38.2,49),(37.2,44)]]
PANTS  = [[(42.5,73.5),(57.5,73.5),(59.5,85),(58.5,100),(41.5,100),(40.5,85)]]
body = cloth(hero, 0.5, 120)
primary   = poly_mask((W,H), JERSEY) & body
secondary = (poly_mask((W,H), HELMET) & neutral(hero, 0.5, 14, 175)) | (poly_mask((W,H), PANTS) & body)   # lum cap keeps the lit stadium out of the helmet
S = (W // 4, H // 4)
finish(primary, S, 0.8, 'public/menu/hero_mask_p.webp'); finish(secondary, S, 0.8, 'public/menu/hero_mask_s.webp')

# ---------------- continue card ----------------
cont = Image.open('art/menu/card_continue.png').convert('RGB'); W, H = cont.size
HELMET = [[(69,30),(70,24.5),(73.5,20),(77.5,18.5),(81.5,21),(83,27),(82.5,33.5),(78.5,37),(72,36.5),(69.5,33)]]
JERSEY = [[(63.5,43),(66.5,39.5),(72,37.5),(80,37.5),(86.5,39.5),(90.5,43),(90.5,51.5),(87.8,54),(86.8,62),(85.8,75),(83,77),(70.5,77),(67.8,75),(66.8,62),(65.8,54),(63.5,51.5)]]
PANTS  = [[(67.5,77),(85.5,77),(87.5,88),(87,100),(66.5,100),(65.5,88)]]
body = cloth(cont, 0.45, 120)
primary   = poly_mask((W,H), JERSEY) & body
secondary = (poly_mask((W,H), HELMET) & neutral(cont, 0.3, 30, 255)) | (poly_mask((W,H), PANTS) & body)
S = (W // 4, H // 4)
finish(primary, S, 0.8, 'cont_mask_p.tmp.webp'); finish(secondary, S, 0.8, 'cont_mask_s.tmp.webp')
import os; os.replace('cont_mask_p.tmp.webp','public/menu/card_continue_mask_p.webp'); os.replace('cont_mask_s.tmp.webp','public/menu/card_continue_mask_s.webp')

# ---------------- portrait ----------------
por = Image.open('public/menu/portrait_helmet.webp').convert('RGB'); W, H = por.size
shell = neutral(por, 0.35, 48, 255)
finish(shell, (W // 2, H // 2), 1.0, 'public/menu/portrait_helmet_mask_s.webp')


for f in ['hero_mask_p','hero_mask_s','card_continue_mask_p','card_continue_mask_s','portrait_helmet_mask_s']:
    report.append((f + '.webp', 'mask', os.path.getsize(f'{OUT}/{f}.webp')))

total = sum(s for _, _, s in report)
for n, size, s in report: print(f'{n:26s} {str(size):12s} {s // 1024:4d} KB')
print(f'{len(report)} files, {total // 1024} KB total')
