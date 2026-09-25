#!/usr/bin/env python3
"""v153 D THE GOAL ON THE WALL — cut the two goal trophies for the main menu's milestones card.

  art/menu/trophy_uff_champions.png           -> public/menu/trophy_goal_uff.webp
  art/menu/trophy_interstellar_champions.png  -> public/menu/trophy_goal_interstellar.webp

The owner's artwork carries its own full background (the stadium, the stars), so it is NOT cut out: it ships
whole as a 4:5 portrait and the menu frames it as a card (public/rib-menu.js `goalV153D`). The card shows it
at up to ~210 CSS px wide, so 480x600 covers a 2x phone; the budget is <= 150 KB each.

  python3 scripts/build-goal-trophies.py         (also run at the end of scripts/build-menu-art.py)
"""
from PIL import Image
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
W, H, BUDGET = 480, 600, 150 * 1024
for src, out in [('trophy_uff_champions', 'trophy_goal_uff'), ('trophy_interstellar_champions', 'trophy_goal_interstellar')]:
    im = Image.open(os.path.join(ROOT, 'art/menu', src + '.png')).convert('RGB')
    # crop to 4:5 about the centre (the source is 1122x1402, already ~4:5), then resize
    k = min(im.width / W, im.height / H)
    cw, ch = round(W * k), round(H * k)
    x0, y0 = (im.width - cw) // 2, (im.height - ch) // 2
    im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS)
    path = os.path.join(ROOT, 'public/menu', out + '.webp')
    for q in (80, 74, 68, 62):
        im.save(path, 'WEBP', quality=q, method=6)
        if os.path.getsize(path) <= BUDGET: break
    print(f'{out}.webp  {W}x{H}  q{q}  {os.path.getsize(path) // 1024} KB')
