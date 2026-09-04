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
def cloth(im, skin_chroma=55, skin_lum=150, bright=None, bright_below=None):
    # fabric: anything that is not skin. Skin is strongly chromatic (max-min of RGB) at any
    # brightness; grey fabric stays low-chroma even in warm shadow, where a ratio-based
    # saturation would blow up. `bright` keys out the lit background, but only below the
    # row `bright_below` (the pads above it are lit too, and must stay).
    a = np.asarray(im.convert('RGB')).astype(float)
    chroma = a.max(2) - a.min(2); lum = a.mean(2)
    keep = ~((chroma > skin_chroma) & (lum < skin_lum))
    if bright is not None:
        rows = np.arange(a.shape[0])[:, None] >= (bright_below or 0) / 100 * a.shape[0]
        keep &= ~((lum > bright) & rows)
    return keep

def fill_holes(mask_bool):
    # any pocket the garment encloses is garment: a shadowed fold is not a window
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    outside = m.copy(); ImageDraw.floodfill(outside, (0, 0), 128)
    o = np.asarray(outside)
    return mask_bool | (o == 0)

def finish(mask_bool, size, blur, out):
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close pinholes
    m = m.resize(size, Image.LANCZOS).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(blur))
    rgba = Image.new('RGBA', size, (0, 0, 0, 0)); rgba.putalpha(m)
    rgba.save(out, 'WEBP', quality=80, method=6)
    return m

# ---------------- hero ----------------
hero = Image.open('art/menu/hero_tunnel_wall.png').convert('RGB'); W, H = hero.size
HELMET = [[(45,27),(46,22.5),(49,20),(52,20),(54.8,22.5),(55.6,28),(54.8,33.5),(52,36),(48,36),(45,33)]]
JERSEY = [[(36.3,41),(37.3,39.5),(39.5,37.6),(43,36.4),(46,35.8),(50,35.6),(54,35.8),(57,36.4),(60.5,37.6),(62.2,39.8),(62.6,42.4),(63.2,45),(62.8,48.3),(61.8,50.6),(60.6,51.2),(60.2,54),(59.5,58),(58.9,63),(58.5,68),(58.4,72),(58.1,74.3),(42.4,74.3),(42,72),(41.4,68),(41.2,63),(41.3,58),(40.5,54),(40,51.2),(37.8,51),(36.4,49),(36,45)]]
PANTS  = [[(42.4,73.8),(58.3,73.8),(59.2,78),(59.1,84),(59.2,90),(59.0,100),(42,100),(41,90),(40.8,84),(41.2,78)]]
PADS   = [[(36.2,41),(37.3,39.3),(39.5,37.6),(43.5,36.5),(44.5,40),(42.5,48),(40.5,51),(37.8,51),(36.4,49),(36,45)],
          [(56.5,36.5),(60.5,37.6),(62.2,39.8),(62.6,42.4),(63.2,45),(62.8,48.3),(61.8,50.6),(60,51.2),(58,48),(56,40)]]
BODY   = [[(45.5,26),(46.3,21),(49,19.3),(52,19.3),(54.8,21.5),(55.6,27),(55,33.5),(57,36.4),(60.5,37.6),(62.6,42.4),(63.2,45),(63,49),(65.2,56),(66.2,62),(66.5,68),(66.2,74),(65.6,80),(65.2,86),(65.6,92),(63.8,96),(61,95),(60.2,90),(60.2,100),(40,100),(39.6,90),(38.6,95),(36.2,96),(34.4,92),(34.8,86),(34.2,80),(33.5,74),(33.3,68),(33.7,62),(34.9,56),(36.4,49),(36.2,41),(39.5,37.6),(43,36.4),(45.2,33.5),(45,27)]]
player = poly_mask((W,H), BODY)
body = cloth(hero, 55, 150, bright=135, bright_below=52) & player
primary   = fill_holes((poly_mask((W,H), JERSEY) & body) | (poly_mask((W,H), PADS) & player))
secondary = (poly_mask((W,H), HELMET) & neutral(hero, 0.5, 14, 175) & player) | fill_holes(poly_mask((W,H), PANTS) & body)   # lum cap keeps the lit stadium out of the helmet
S = (W // 2, H // 2)
finish(primary, S, 1.0, 'public/menu/hero_mask_p.webp'); finish(secondary, S, 0.8, 'public/menu/hero_mask_s.webp')

# ---------------- continue card ----------------
cont = Image.open('art/menu/card_continue.png').convert('RGB'); W, H = cont.size
HELMET = [[(72.5,31),(72.5,25),(74.5,21),(77.5,19.2),(80.5,19.6),(82.6,22.5),(83.4,27),(82.8,32.5),(80.5,35.5),(76,36.2),(73.5,34.5)]]
JERSEY = [[(63.2,44),(64.2,41.5),(66.5,39.6),(70,38.2),(74,37.6),(78,37.4),(82,37.6),(86,38.6),(89,40.5),(91,43),(91.6,46.5),(91,49.5),(89.2,51),(88.6,54),(87.6,62),(86.2,70),(85,76.8),(68.4,76.8),(68.2,70),(67.5,62),(67,54),(65.6,51),(63.8,49),(63,46.5)]]
PANTS  = [[(68.5,77),(84.6,77),(85.4,82),(85.6,88),(85.6,100),(67.4,100),(67.6,88),(68.2,82)]]
BODY   = [[(72.5,31),(72.5,25),(74.5,21),(77.5,19.2),(80.5,19.6),(82.6,22.5),(83.4,27),(82.8,32.5),(86,38.6),(89,40.5),(91.2,46.5),(91.6,52),(93,58),(93.6,64),(93.4,70),(92.6,76),(92,82),(91.8,86),(93.2,90),(92.4,96),(89.4,96),(88.2,90),(87,86),(86,100),(67,100),(66,86),(64.8,90),(63.6,96),(60.4,96),(59.8,90),(61.2,86),(61,80),(60.4,74),(60.2,68),(60.6,62),(61.5,56),(63,49),(63.2,44),(64.2,41.5),(66.5,39.6),(70,38.2),(74,37.6),(73.5,34.5)]]
player = poly_mask((W,H), BODY)
body = cloth(cont, 55, 150, bright=228, bright_below=54) & player
primary   = fill_holes(poly_mask((W,H), JERSEY) & body)
secondary = (poly_mask((W,H), HELMET) & neutral(cont, 0.3, 30, 218) & player) | fill_holes(poly_mask((W,H), PANTS) & body)   # lum cap keeps the floodlight out of the shell
S = (W // 2, H // 2)
finish(primary, S, 1.0, 'cont_mask_p.tmp.webp'); finish(secondary, S, 0.8, 'cont_mask_s.tmp.webp')
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
