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

def skinless(im, chroma_max, lum_max):
    # v104: skin in this light is a dull brown (chroma 15..45) and the kit is neutral (3..9), so
    # chroma alone separates them; no luminance cap, because a highlight on the fabric is fabric
    a = np.asarray(im.convert('RGB')).astype(float)
    chroma = a.max(2) - a.min(2); lum = a.mean(2)
    return ~((chroma > chroma_max) & (lum < lum_max))

def assert_no_bleed(paths, player, label):
    # the guarantee the kit rests on: outside the traced body, every mask is fully transparent.
    # The body polygon is dilated by a few pixels so the check is about the background, not
    # about a vertex placed on the outline itself.
    body = Image.fromarray((player * 255).astype('uint8'), 'L').filter(ImageFilter.MaxFilter(7))
    outside = np.asarray(body) == 0
    for path in paths:
        a = np.asarray(Image.open(path).convert('RGBA').getchannel('A').resize(body.size, Image.BILINEAR))
        worst = int(a[outside].max()) if outside.any() else 0
        report.append((os.path.basename(path), f'bleed max {worst}/255', 0))
        assert worst <= 8, f'{label}: {path} bleeds outside the player (alpha {worst})'

def fill_holes(mask_bool):
    # any pocket the garment encloses is garment: a shadowed fold is not a window. The picture's
    # edge is NOT a wall, though — the gap between two legs that runs off the bottom of the frame
    # is open air, so the flood runs in a one-pixel margin around the frame (v104).
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    outside = Image.new('L', (m.width + 2, m.height + 2), 0); outside.paste(m, (1, 1))
    ImageDraw.floodfill(outside, (0, 0), 128)
    o = np.asarray(outside)[1:-1, 1:-1]
    return mask_bool | (o == 0)

def finish(mask_bool, size, blur, out, erode=3):
    m = Image.fromarray((mask_bool * 255).astype('uint8'), 'L')
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close pinholes
    m = m.resize(size, Image.LANCZOS)
    if erode >= 3: m = m.filter(ImageFilter.MinFilter(erode))   # v104: a traced outline needs no pull-in
    m = m.filter(ImageFilter.GaussianBlur(blur))
    rgba = Image.new('RGBA', size, (0, 0, 0, 0)); rgba.putalpha(m)
    rgba.save(out, 'WEBP', quality=80, method=6)
    return m

# ---------------- hero ----------------
# v104: traced on the real outline at 1% (the same probe points as the card, in
# scripts/menu-mask-check.mjs). The tunnel light is warm enough that lit fabric is as chromatic as
# skin (the right sleeve reads chroma 91, the arm 57), so the pixel keys that cut skin here were
# cutting the whole lit right side — sleeve, hip and the helmet's rim. The polygons carry it alone.
hero = Image.open('art/menu/hero_tunnel_wall.png').convert('RGB'); W, H = hero.size
HELMET = [[(50,18.6),(51.5,18.9),(52.8,20),(54,22),(54.8,24),(55.3,26),(55.5,28.5),(55.4,31),(55.1,33),(54.7,35),(54.2,36.5),(52,36.9),(48,36.9),(45.8,36.5),(45.2,34.5),(44.8,32),(44.7,29),(44.9,26),(45.4,23.5),(46.4,21.3),(47.6,19.8),(48.8,19)]]
JERSEY = [[(37.6,40.4),(38.6,39.5),(40,38.4),(42,37.6),(44,37.1),(46,37.2),(47.2,38.3),(50,38.6),(52.8,38.3),(54,37.2),(56,37.3),(58,38),(60,39.3),(61.4,40.3),(62.7,41.6),(63.5,44),(63.7,46),(63.5,48),(63,50),(62.4,51),(60,51.4),(58.5,51.2),(58.1,53),(58.2,58),(58.4,64),(58.4,70),(58.2,73.2),(41.7,73.2),(41.6,70),(41.5,64),(41.6,58),(41.6,53),(41.3,51.4),(39,51),(36.4,50.4),(35.7,49.5),(35.3,47.5),(35.3,45.5),(35.7,43.2),(36.4,41.8)]]
PANTS  = [[(41.6,73),(58.2,73),(58.6,75),(59,78),(59.1,81),(59.1,84),(58.9,87),(58.7,90),(58.4,93),(58.1,96),(57.9,100.5),(41.9,100.5),(41.8,96),(41.6,92),(41.4,89),(41.1,86),(41,83),(40.9,80),(41,77.5),(41.3,75)]]
BODY   = [[(45.5,26),(46.3,21),(49,19.3),(52,19.3),(54.6,21.5),(55.2,27),(54.8,33.5),(57,36.4),(60.5,37.6),(62.6,42.4),(63.2,45),(63,49),(65.2,56),(66.2,62),(66.5,68),(66.2,74),(65.6,80),(65.2,86),(65.6,92),(63.8,96),(61,95),(60.2,90),(60.2,100),(40,100),(39.6,90),(38.6,95),(36.2,96),(34.4,92),(34.8,86),(34.2,80),(33.5,74),(33.3,68),(33.7,62),(34.9,56),(36.4,49),(36.2,41),(39.5,37.6),(43,36.4),(45.2,33.5),(45,27)]]
garments = Image.fromarray((poly_mask((W,H), HELMET + JERSEY + PANTS) * 255).astype('uint8'), 'L').filter(ImageFilter.MaxFilter(9))
player = poly_mask((W,H), BODY) | (np.asarray(garments) > 0)
primary   = fill_holes(poly_mask((W,H), JERSEY))
secondary = fill_holes(poly_mask((W,H), HELMET)) | fill_holes(poly_mask((W,H), PANTS))
S = (W // 2, H // 2)
finish(primary, S, 0.9, 'public/menu/hero_mask_p.webp', erode=1); finish(secondary, S, 0.9, 'public/menu/hero_mask_s.webp', erode=1)
assert_no_bleed(['public/menu/hero_mask_p.webp', 'public/menu/hero_mask_s.webp'], player, 'hero')

# ---------------- continue card ----------------
cont = Image.open('art/menu/card_continue.png').convert('RGB'); W, H = cont.size
# v104: the kit is traced on the real outline, at 1%, off a gridded zoom of the picture (see
# scripts/menu-mask-check.mjs for the probe points that hold it there). The old boxes ran the
# pants 3% wide of the hips on both sides, so the secondary colour landed on the crowd beside
# him, and the highlight key-outs (`bright`, the helmet's lum cap) dropped the sleeve hems and the
# shell's lit rim, so those stayed grey. Now the polygons keep the background out and a chroma
# key keeps the skin out; a highlight on the fabric is fabric.
HELMET = [[(77.4,18.2),(79.8,18.5),(82.3,19.9),(84.1,22),(85.1,24),(85.6,26.5),(85.6,29),(85.4,31),(85.0,32.8),(84.2,34.4),(82.6,35.8),(79.8,36.7),(76,36.8),(73.3,37.4),(71.3,37.2),(69.7,35.5),(69.5,31),(69.7,27.5),(70.6,25.5),(71.7,23.5),(72.8,21.8),(74.5,20),(75.9,19)]]
JERSEY = [[(66.2,39.6),(69.5,38.5),(73,38.2),(74.5,39.2),(76.5,39.7),(78.5,39.2),(80.5,38.2),(84,38.5),(87.2,39.6),(89.3,40.8),(90.6,42),(91.4,44),(91.6,46.5),(91.3,48.5),(90.7,50.6),(89.5,51.6),(87.2,52.3),(86.4,54.5),(86.4,58),(86.7,64),(87,70),(86.9,74.6),(68.4,74.6),(68.3,70),(68.5,64),(68.9,58),(69.2,54.5),(68.6,52.3),(65.5,51.5),(64,50.4),(63.4,48.8),(63,46.2),(63.2,43.8),(63.8,41.8),(64.8,40.4)]]
PANTS  = [[(68.6,74.6),(86.8,74.6),(87.3,78),(87.8,81),(88.0,84),(87.9,87),(87.5,90),(87.2,94),(86.9,98),(86.8,100.5),(78.6,100.5),(78.3,96),(77.3,92.6),(76.4,96),(76.0,100.5),(69.1,100.5),(68.9,96),(68.6,92.5),(68.1,89),(67.6,86),(67.6,83),(67.9,80),(68.3,77.5)]]
BODY   = [[(76,17.2),(80.5,17.6),(84,19.6),(86.4,23.5),(86.8,28.5),(86.2,33),(85,35.8),(87.5,39),(90.5,41.5),(92,46),(91.5,51),(92.5,56),(93.5,64),(93.8,72),(93.6,80),(93.8,88),(94.2,94),(93.8,100),(60.6,100),(60.4,94),(60.8,88),(60.6,80),(60.4,72),(60.8,64),(61.8,56),(63,51),(62.6,46),(63.4,41.5),(66,39.5),(70,38.5),(68.8,36.5),(68.5,31),(68.8,26),(70,22),(72.6,19.2)]]
# the no-bleed guard is the traced body, and never tighter than the garments themselves: each
# garment polygon, grown by half a percent, is part of the player by definition
garments = Image.fromarray((poly_mask((W,H), HELMET + JERSEY + PANTS) * 255).astype('uint8'), 'L').filter(ImageFilter.MaxFilter(9))
player = poly_mask((W,H), BODY) | (np.asarray(garments) > 0)
body = skinless(cont, 13, 170) & player
primary   = fill_holes(poly_mask((W,H), JERSEY) & body)
secondary = fill_holes(poly_mask((W,H), HELMET) & neutral(cont, 0.3, 6, 246) & player) | fill_holes(poly_mask((W,H), PANTS) & body)   # the cap keeps the floodlight beside the shell out
S = (W // 2, H // 2)
finish(primary, S, 0.9, 'cont_mask_p.tmp.webp', erode=1); finish(secondary, S, 0.9, 'cont_mask_s.tmp.webp', erode=1)
assert_no_bleed(['cont_mask_p.tmp.webp', 'cont_mask_s.tmp.webp'], player, 'continue')
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
