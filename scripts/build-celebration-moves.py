#!/usr/bin/env python3
"""v177 I — TEN NEW CELEBRATIONS: the drawn bodies of the ten super celebrations, DERIVED from the owner's three drawn
sheets (art/celebrations/flex.png, backflip.png, spike.png — the ones v161 A cuts with build-celebration-sheets.py).

Nothing here is hand-painted into the output: every frame is one of the owner's drawn frames, cut by the SAME code
(this imports build-celebration-sheets.py: `cut_sheet`, `frame_rgba`, the skin / ball masks, `normalize`, `kit_ready`,
`downscale`, `helm_auto`, `trim`, `pack`), then RE-POSED at the source resolution by a short list of operations, then
taken down to the field's scale exactly as v161 A's frames are (so it recolours, takes his skin tone and his helmet the
same way at runtime):

  mirror            flip the frame (an alternate step, the other arm)
  rot  deg          turn the whole body about its centre of mass (a lean, the robot's stiff tilt, lying down at 90)
  foot side dy dx   lift one foot: the shin and shoe below the knee (the bottom 26% of the body, on that side of the
                    feet's middle) move up / across — a heel off the grass (moonwalk), a heel kicked back (the griddy)
  wave amp phase    the worm: each column of a LYING body rides a sine (a hump that travels head to toe)
  ball  dx dy       the game ball (cut from the spike sheet's loose ball) laid against the frame: the nap's pillow
  squash sy         a breath (the sleeper's chest), about the ground line

Each frame's manifest entry is v161 A's (a 1x rect `r`, its FOOT anchor `ax, ay` — the lowest body row and the middle
of the feet — the centre of mass `cx, cy`, the helmet ellipse `helm` relative to the anchor, carried through the
operations; the 2x rect `r2` and anchors `a2`) plus `hands`: the white gloves' centres (1x, anchor-relative), which the
runtime uses to hold a prop (the laser sword, the bow, the phone ring). The runtime (src/28 `v177 I`) reads the
manifest; nothing is baked into src/.

  pip install pillow numpy scipy
  python3 scripts/build-celebration-moves.py            # writes public/celebrations/cel_v177i*
  python3 scripts/build-celebration-moves.py --proof    # also art/celebrations-proof/moves.png (every frame on a ground line)
"""
import importlib.util, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('celsheets', os.path.join(HERE, 'build-celebration-sheets.py'))
CS = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(CS)
ROOT, OUT, PROOF = CS.ROOT, CS.OUT, CS.PROOF
STAND_PX, SCALES = CS.STAND_PX, CS.SCALES
PAD = 90

# the ten bodies: [frame name, base (sheet, k), [operations]] — read with the runtime's timelines (src/28 PLAN_V177I)
MOVES = {
    'moonwalk': [
        ['stance', ('flex', 0), []],
        ['left heel up', ('flex', 0), [('foot', 'L', 0.075, 0.02)]],
        ['right heel up', ('flex', 0), [('foot', 'R', 0.075, -0.02)]],
        ['lean, left heel', ('flex', 11), [('foot', 'L', 0.08, 0.02), ('rot', -5)]],
        ['lean, right heel', ('flex', 11), [('foot', 'R', 0.08, -0.02), ('rot', -5)]],
        ['the point', ('flex', 8), []],
        ['on his toes', ('flex', 8), [('foot', 'L', 0.05, 0.0), ('foot', 'R', 0.05, 0.0)]],
    ],
    'worm': [
        ['crouch', ('backflip', 1), []],
        ['hands down', ('backflip', 10), []],
        ['worm 0', ('flex', 11), [('rot', 90), ('wave', 0.07, 0)]],
        ['worm 1', ('flex', 11), [('rot', 90), ('wave', 0.07, 60)]],
        ['worm 2', ('flex', 11), [('rot', 90), ('wave', 0.07, 120)]],
        ['worm 3', ('flex', 11), [('rot', 90), ('wave', 0.07, 180)]],
        ['worm 4', ('flex', 11), [('rot', 90), ('wave', 0.07, 240)]],
        ['worm 5', ('flex', 11), [('rot', 90), ('wave', 0.07, 300)]],
        ['push up', ('backflip', 10), []],
        ['arms up', ('backflip', 11), []],
    ],
    'leap': [
        ['crouch', ('backflip', 1), []],
        ['deep crouch', ('backflip', 2), []],
        ['launch', ('backflip', 3), []],
        ['reach', ('backflip', 11), [('rot', -8)]],
        ['in the crowd', ('flex', 1), []],
        ['landing', ('backflip', 9), []],
        ['double flex', ('flex', 6), []],
    ],
    'quake': [
        ['ball in hand', ('spike', 0), []],
        ['ball up', ('spike', 1), []],
        ['wind-up', ('spike', 2), []],
        ['leap', ('spike', 3), []],
        ['SLAM', ('spike', 4), []],
        ['follow-through', ('spike', 5), []],
        ['double flex', ('spike', 7), []],
        ['chest pound', ('spike', 8), []],
        ['flex', ('spike', 9), []],
    ],
    'griddy': [
        ['fists up', ('flex', 1), []],
        ['left heel', ('flex', 1), [('foot', 'L', 0.17, 0.05)]],
        ['right heel', ('flex', 1), [('mirror',), ('foot', 'R', 0.17, -0.05)]],
        ['swing, left heel', ('flex', 2), [('foot', 'L', 0.15, 0.05)]],
        ['swing, right heel', ('flex', 2), [('mirror',), ('foot', 'R', 0.15, -0.05)]],
        ['double flex', ('flex', 9), []],
    ],
    'archer': [
        ['stance', ('flex', 0), []],
        ['nock', ('flex', 2), []],
        ['draw', ('flex', 7), []],
        ['full draw', ('flex', 7), [('rot', -6)]],
        ['release', ('flex', 8), []],
        ['double flex', ('flex', 9), []],
    ],
    'robot': [
        ['stance', ('flex', 0), [('rot', 0)]],
        ['arms in', ('flex', 1), []],
        ['arms out', ('flex', 3), []],
        ['left arm', ('flex', 2), []],
        ['right arm', ('flex', 2), [('mirror',)]],
        ['wide', ('flex', 6), []],
        ['rest', ('flex', 11), []],
    ],
    'nap': [
        ['rest', ('flex', 11), []],
        ['crouch', ('backflip', 1), []],
        ['hands down', ('backflip', 10), []],
        ['asleep', ('flex', 11), [('rot', 90), ('ball', 0.1, -0.02)]],
        ['asleep, breath in', ('flex', 11), [('rot', 90), ('squash', 1.06), ('ball', 0.1, -0.02)]],
        ['waking', ('backflip', 10), []],
        ['arms up', ('backflip', 11), []],
    ],
    'phone': [
        ['ball in hand', ('spike', 0), []],
        ['on the phone', ('spike', 1), []],
        ['chatting', ('spike', 1), [('rot', 5)]],
        ['laughing', ('spike', 1), [('rot', -4)]],
        ['hang up', ('spike', 0), []],
        ['the bow', ('spike', 10), []],
    ],
    'saber': [
        ['stance', ('flex', 0), []],
        ['two-hand grip', ('flex', 1), []],
        ['overhead', ('flex', 8), []],
        ['guard', ('flex', 7), []],
        ['lunge', ('flex', 5), [('rot', 6)]],
        ['victory', ('flex', 9), []],
    ],
}


class Fr:
    """a frame at the SOURCE resolution on a padded canvas: rgba, the body mask, the soft (dirt) mask, the skin, the
    helmet's centre (source px) and whether a ball prop was laid in"""
    pass


def base_frames():
    """every drawn frame of the three sheets, processed exactly as v161 A processes them (normalize, kit_ready), with
    its helmet centre at the source resolution"""
    out, K1 = {}, None
    cuts, scale_src = {}, []
    for name in CS.SHEETS:
        c = CS.cut_sheet(name); cuts[name] = c
        lab, order = c[7], c[5]
        ys, _ = np.nonzero(lab == order[0]); scale_src.append(ys.max() - ys.min() + 1)
    K1 = STAND_PX / float(np.median(scale_src))     # the same one factor as v161 A
    ball = None
    for name, spec in CS.SHEETS.items():
        raw, bg, core, soft, owner, order, rows, lab, dist = cuts[name]
        for k, b in enumerate(order):
            a, (ox, oy), mainb, softm = CS.frame_rgba(raw, bg, core, soft, owner, b, lab)
            if k in spec.get('flip', []):
                a = a[:, ::-1].copy(); mainb = mainb[:, ::-1].copy(); softm = softm[:, ::-1].copy()
            if spec.get('ball_from') is not None and k >= spec['ball_from']:
                bm = CS.ball_mask(a) & (a[..., 3] > 0)
                blab, bn = nd.label(bm)
                if bn:
                    bs = nd.sum(bm, blab, range(1, bn + 1)); bi = int(np.argmax(bs)) + 1
                    if bs[bi - 1] > 600:
                        bb = nd.binary_dilation(blab == bi, iterations=4) & (a[..., 3] > 0)
                        loose = bb & ~nd.binary_erosion(mainb & ~bb, iterations=1)
                        if loose.sum() > 400:
                            yy, xx = np.nonzero(loose)
                            if ball is None and k == spec['ball_from']:
                                sl = (slice(yy.min(), yy.max() + 1), slice(xx.min(), xx.max() + 1))
                                ball = (a[sl] * loose[sl][..., None]).copy()
                            a[loose] = 0; mainb = mainb & ~loose
            skin = CS.skin_mask(a); bmask = CS.ball_mask(a)
            protect = skin | bmask | softm | ~mainb
            a = CS.kit_ready(CS.normalize(a, protect))
            # the helmet's centre: v161 A's (hand-placed on the upside-down backflip frames, found on the rest)
            arr = CS.downscale(a, K1, softm); arr_t, tx, ty = CS.trim(arr)
            hm = spec.get('helm', {}).get(k) or CS.helm_auto(arr_t)
            helm = ((hm[0] + tx) / K1, (hm[1] + ty) / K1)
            out[(name, k)] = dict(a=a, mainb=mainb, soft=softm, skin=skin & mainb & ~bmask, helm=helm)
    # the loose ball, normalised like the frames (it keeps its own leather colour: the ball is protected)
    return out, K1, ball


def padded(src):
    f = Fr()
    H, W = src['a'].shape[:2]
    S = max(H, W) + 2 * PAD
    oy, ox = (S - H) // 2, (S - W) // 2
    f.a = np.zeros((S, S, 4)); f.a[oy:oy + H, ox:ox + W] = src['a']
    for key in ('mainb', 'soft', 'skin'):
        m = np.zeros((S, S), bool); m[oy:oy + H, ox:ox + W] = src[key]; setattr(f, key, m)
    f.helm = (src['helm'][0] + ox, src['helm'][1] + oy)
    return f


def body_box(f):
    ys, xs = np.nonzero(f.mainb & (f.a[..., 3] > 0))
    return ys.min(), ys.max(), xs.min(), xs.max()


def com(f):
    ys, xs = np.nonzero(f.mainb)
    return xs.mean(), ys.mean()


def op_mirror(f):
    S = f.a.shape[1]
    f.a = f.a[:, ::-1].copy()
    for key in ('mainb', 'soft', 'skin'): setattr(f, key, getattr(f, key)[:, ::-1].copy())
    f.helm = (S - 1 - f.helm[0], f.helm[1])


def op_rot(f, deg):
    """turn the body about its centre of mass, clockwise on screen (nearest: the pixel art stays hard-edged)"""
    if not deg: return
    cx, cy = com(f)
    def rimg(arr, mode):
        im = Image.fromarray(arr)
        return np.asarray(im.rotate(-deg, resample=mode, center=(cx, cy)))
    rgba = np.clip(f.a, 0, 255).astype('uint8')
    f.a = np.stack([rimg(rgba[..., c], Image.NEAREST) for c in range(4)], -1).astype(float)
    for key in ('mainb', 'soft', 'skin'):
        setattr(f, key, rimg((getattr(f, key) * 255).astype('uint8'), Image.NEAREST) > 127)
    th = np.radians(deg); hx, hy = f.helm[0] - cx, f.helm[1] - cy
    f.helm = (cx + hx * np.cos(th) - hy * np.sin(th), cy + hx * np.sin(th) + hy * np.cos(th))


def op_foot(f, side, dy, dx):
    """one foot off the grass: the body below the knee on that side of the feet's middle moves up (dy) and across (dx),
    both as a fraction of the body's height"""
    y0, y1, x0, x1 = body_box(f); h = y1 - y0 + 1
    op = f.a[..., 3] > 0
    yy, xx = np.mgrid[0:f.a.shape[0], 0:f.a.shape[1]]
    band = (yy >= y1 - max(3, h * 0.22)) & op & f.mainb
    bx = xx[band]; mid = (bx.min() + bx.max()) / 2
    reg = op & (yy >= y0 + h * 0.74) & ((xx < mid) if side == 'L' else (xx >= mid))
    DY, DX = int(round(dy * h)), int(round(dx * h))
    def move(arr):
        part = np.where(reg[..., None] if arr.ndim == 3 else reg, arr, 0)
        rest = np.where(reg[..., None] if arr.ndim == 3 else reg, 0, arr)
        part = np.roll(np.roll(part, -DY, 0), DX, 1)
        if arr.ndim == 3:
            over = part[..., 3] > 0
            rest[over] = part[over]
            return rest
        return rest | part
    f.a = move(f.a)
    for key in ('mainb', 'soft', 'skin'): setattr(f, key, move(getattr(f, key)))


def op_wave(f, amp, phase):
    """the worm: each column of a lying body rides one sine (its hump), amp a fraction of the body's length"""
    y0, y1, x0, x1 = body_box(f); L = x1 - x0 + 1
    A = amp * L
    for x in range(x0, x1 + 1):
        u = (x - x0) / L
        s = int(round(-A * max(0.0, np.sin(2 * np.pi * u * 1.0 + np.radians(phase)))))
        if s:
            f.a[:, x] = np.roll(f.a[:, x], s, 0)
            for key in ('mainb', 'soft', 'skin'): getattr(f, key)[:, x] = np.roll(getattr(f, key)[:, x], s, 0)
    hx = int(round(min(max(f.helm[0], x0), x1)))
    u = (hx - x0) / L
    f.helm = (f.helm[0], f.helm[1] - A * max(0.0, np.sin(2 * np.pi * u + np.radians(phase))))


def op_squash(f, sy):
    """a breath: the body grows taller about its ground line (sy > 1)"""
    y0, y1, x0, x1 = body_box(f)
    S = f.a.shape[0]
    def sq(arr, mode):
        im = Image.fromarray(arr)
        return np.asarray(im.transform(im.size, Image.AFFINE, (1, 0, 0, 0, 1 / sy, y1 * (1 - 1 / sy)), resample=mode))
    rgba = np.clip(f.a, 0, 255).astype('uint8')
    f.a = np.stack([sq(rgba[..., c], Image.NEAREST) for c in range(4)], -1).astype(float)
    for key in ('mainb', 'soft', 'skin'): setattr(f, key, sq((getattr(f, key) * 255).astype('uint8'), Image.NEAREST) > 127)
    f.helm = (f.helm[0], y1 - (y1 - f.helm[1]) * sy)


def op_ball(f, ball, dx, dy):
    """the game ball laid under his helmet (the sleeper's pillow): it sits on the grass under the helmet's centre"""
    y0, y1, x0, x1 = body_box(f); h = y1 - y0 + 1
    bh, bw = ball.shape[:2]
    cx = int(round(f.helm[0] + dx * h - bw / 2)); top = int(round(y1 + 1 - bh + dy * h))
    # the ball goes UNDER the body: only where the body is not
    reg = f.a[top:top + bh, cx:cx + bw]
    under = (reg[..., 3] == 0) & (ball[..., 3] > 0)
    reg[under] = ball[under]
    f.mainb[top:top + bh, cx:cx + bw] |= under
    f.helm = (f.helm[0], f.helm[1] - 0.0)


def apply(f, ops, ball):
    for o in ops:
        if o[0] == 'mirror': op_mirror(f)
        elif o[0] == 'rot': op_rot(f, o[1])
        elif o[0] == 'foot': op_foot(f, o[1], o[2], o[3])
        elif o[0] == 'wave': op_wave(f, o[1], o[2])
        elif o[0] == 'squash': op_squash(f, o[1])
        elif o[0] == 'ball': op_ball(f, ball, o[1], o[2])
    return f


def hands_of(arr):
    """the white gloves on a 1x frame: blobs of near-white above the bottom quarter (the shoes are white too)"""
    rgb = arr[..., :3].astype(float); al = arr[..., 3]
    mx, mn = rgb.max(2), rgb.min(2)
    wht = (al > 0) & (mn > 175) & (mx - mn < 40)
    ys, xs = np.nonzero(al > 0)
    if not len(ys): return []
    y0, y1 = ys.min(), ys.max()
    lab, n = nd.label(wht)
    out = []
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 3: continue
        cy = yy.mean()
        if cy > y0 + (y1 - y0) * 0.72: continue
        out.append((float(xx.mean()), float(cy), len(yy)))
    out.sort(key=lambda h: -h[2])
    return [(h[0], h[1]) for h in out[:2]]


def main():
    proof = '--proof' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    base, K1, ball = base_frames()
    manifest = {'v': '177I', 'stand': STAND_PX, 'k1': round(K1, 5), 'scales': list(SCALES), 'anims': {}}
    by_scale = {s: [] for s in SCALES}
    for name, frames in MOVES.items():
        anim = {'n': len(frames), 'names': [fr[0] for fr in frames], 'frames': []}
        for k, (label, src, ops) in enumerate(frames):
            f = apply(padded(base[src]), ops, ball)
            # the feet: the body's own lowest row and the middle of the bottom band, never the drawn dirt
            hu, sa, _, _, _ = CS.hsl(f.a)
            dirt = (hu >= 5) & (hu < 44) & (sa > 0.12) & ~f.skin & ~f.mainb
            ys, xs = np.nonzero(f.mainb & (f.a[..., 3] > 0) & ~dirt)
            fy = ys.max(); h = ys.max() - ys.min() + 1
            bot = ys >= fy - max(3, h * 0.22)
            footx = (xs[bot].min() + xs[bot].max()) / 2
            cmx, cmy = com(f)
            fr = {'k': k, 'name': label}
            for s in SCALES:
                kk = K1 * s
                arr = CS.downscale(f.a, kk, f.soft)
                arr_t, tx, ty = CS.trim(arr)
                sk = np.asarray(Image.fromarray((f.skin * 255).astype('uint8')).resize(arr.shape[1::-1], Image.BOX)).astype(float) > 127
                sk_t = (sk & (arr[..., 3] > 0))[ty:ty + arr_t.shape[0], tx:tx + arr_t.shape[1]]
                ax = footx * kk - tx; ay = (fy + 0.5) * kk - ty
                cx = cmx * kk - tx; cy = cmy * kk - ty
                by_scale[s].append((f'{name}{k}', arr_t, sk_t))
                if s == 1:
                    hx, hy = f.helm[0] * kk - tx, f.helm[1] * kk - ty
                    fr['helm'] = [round(hx - ax, 2), round(hy - ay, 2), 7.6, 6.4]
                    fr['hands'] = [[round(px - ax, 2), round(py - ay, 2)] for px, py in hands_of(arr_t)]
                    fr.update({'ax': round(ax, 2), 'ay': round(ay, 2), 'cx': round(cx, 2), 'cy': round(cy, 2)})
                else:
                    fr['a%d' % s] = [round(ax, 2), round(ay, 2), round(cx, 2), round(cy, 2)]
            anim['frames'].append(fr)
        manifest['anims'][name] = anim
    # the ball as its own sprite (the quake's planted ball, the phone, the nap's pillow on the Locker)
    if ball is not None:
        for s in SCALES:
            barr = CS.downscale(ball, K1 * s, np.zeros(ball.shape[:2], bool)); bt, _, _ = CS.trim(barr)
            by_scale[s].append(('ball', bt, np.zeros(bt.shape[:2], bool)))
    for s in SCALES:
        img, rects = CS.pack([(k_, a_) for k_, a_, _ in by_scale[s]], 512 * s)
        Image.fromarray(img, 'RGBA').save(os.path.join(OUT, f'cel_v177i_{s}x.png'), optimize=True)
        skm = np.zeros(img.shape[:2], np.uint8)
        for k_, _, m_ in by_scale[s]:
            rx, ry, w, h = rects[k_]; skm[ry:ry + h, rx:rx + w] = m_ * 255
        Image.fromarray(skm, 'L').save(os.path.join(OUT, f'cel_v177i_skin_{s}x.png'), optimize=True)
        key = 'r' if s == 1 else 'r%d' % s
        for name, anim in manifest['anims'].items():
            for fr in anim['frames']: fr[key] = list(rects[f'{name}{fr["k"]}'])
        if 'ball' in rects: manifest['ball' if s == 1 else 'ball%d' % s] = list(rects['ball'])
        manifest['atlas%d' % s] = [img.shape[1], img.shape[0]]
    json.dump(manifest, open(os.path.join(OUT, 'cel_v177i.json'), 'w'), separators=(',', ':'))
    print('public/celebrations/: cel_v177i_1x.png, cel_v177i_2x.png, cel_v177i.json  (%d bodies, %d frames, k1 %.4f)' % (
        len(manifest['anims']), sum(a['n'] for a in manifest['anims'].values()), K1))
    if proof: write_proof(manifest)


def write_proof(M):
    """every frame on one ground line per body at 3x from the 2x atlas (anchors red, helmet yellow, hands cyan)"""
    os.makedirs(PROOF, exist_ok=True)
    at = np.asarray(Image.open(os.path.join(OUT, 'cel_v177i_2x.png')).convert('RGBA'))
    Z, CW, GH = 2, 120, 150
    names = list(M['anims']); W = CW * 10 * Z; Hh = GH * len(names) * Z
    img = Image.new('RGB', (W, Hh), (44, 92, 52)); dr = ImageDraw.Draw(img)
    for ai, nm in enumerate(names):
        A = M['anims'][nm]; gy = (ai * GH + 120) * Z
        dr.line([(0, gy), (W, gy)], fill=(230, 230, 120))
        for fr in A['frames']:
            x, y, w, h = fr['r2']
            sp = Image.fromarray(at[y:y + h, x:x + w]).resize((w * Z, h * Z), Image.NEAREST)
            cx0 = (fr['k'] * CW + CW // 2) * Z
            px = int(round(cx0 - fr['a2'][0] * Z)); py = int(round(gy - fr['a2'][1] * Z))
            img.paste(sp, (px, py), sp)
            hx, hy = fr['helm'][0] * 2 * Z + cx0, fr['helm'][1] * 2 * Z + gy
            dr.ellipse([hx - 15 * Z, hy - 13 * Z, hx + 15 * Z, hy + 13 * Z], outline=(255, 255, 0))
            for hd in fr['hands']: dr.ellipse([cx0 + hd[0] * 2 * Z - 4, gy + hd[1] * 2 * Z - 4, cx0 + hd[0] * 2 * Z + 4, gy + hd[1] * 2 * Z + 4], outline=(0, 255, 255))
            dr.line([(cx0 - 6, gy), (cx0 + 6, gy)], fill=(255, 60, 60))
            dr.text((cx0 - 50, gy + 6), f"{nm} {fr['k']} {fr['name'][:14]}", fill=(255, 255, 255))
    img.save(os.path.join(PROOF, 'moves.png'))
    print('proof: art/celebrations-proof/moves.png')


if __name__ == '__main__':
    main()
