#!/usr/bin/env python3
"""v149 D — which art files say where they came from.

Scans every tracked image/video for embedded provenance: a C2PA manifest (the Content Credentials standard
that OpenAI, Adobe, Google and others embed) and the IPTC digital-source type `trainedAlgorithmicMedia`
(= "created by a generative model"), plus the file names that record a tool ("ChatGPT", `file_000000…` —
the name ChatGPT gives a downloaded image). Writes docs/ART-PROVENANCE.md: the evidence per file and what
the shipped files in public/ are cut from. It reads bytes only; it does not judge ownership.

  python3 scripts/art-provenance.py
"""
import os, subprocess, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXT = ('.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mov', '.gif')
MARKS = [(b'c2pa', 'C2PA manifest'), (b'trainedAlgorithmicMedia', 'IPTC: trainedAlgorithmicMedia'), (b'OpenAI', '"OpenAI" in the manifest'),
         (b'Midjourney', 'Midjourney'), (b'SynthID', 'SynthID'), (b'Adobe Firefly', 'Adobe Firefly'), (b'Stable Diffusion', 'Stable Diffusion')]
# where each shipped folder / sheet is cut from (the build-*.py / build-*.mjs scripts)
DERIVED = [
    ('public/menu/*.webp', 'art/menu/*.png', 'scripts/build-menu-art.py'),
    ('public/coach/*.webp', 'art/coach/coach_sheet_*_v119.png', 'scripts/build-coach-art.py'),
    ('public/badges/*.webp', 'art/badges/sheet-*.png', 'scripts/build-badge-art.mjs'),
    ('public/rib_field_v91.png', 'art/field/*.png', 'scripts/build-field-art.mjs / .py'),
    ('public/rib_lights_v92.png', 'art/field/lights.png', 'scripts/build-stadium-art.mjs'),
    ('public/rib_side_v78.png, rib_crowd_v57.png, rib_refs_v49.png, rib_wheel_v50.png, rib_skill_v64.png, rib_plan_v66.png', 'art/source/*pixel art.png', 'the spritekit bake_*.mjs'),
    ('public/rib_logos_v44.png', 'art/football-logo-sheet-*.png', 'the v44 emblem bake'),
    ('public/vault/*.webp', 'art/Prestige/*', 'scripts/build-vault-art.py'),
    ('public/rib_film_v116.{mp4,webm,jpg} and the app icons', 'art/splash/rib_loop_master_v116.mp4', 'scripts/build-splash-film.mjs, scripts/build-app-icons.py'),
]


def main():
    files = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True).stdout.split('\n')
    files = [f for f in files if f.lower().endswith(EXT)]
    rows, by_dir = [], collections.Counter()
    for f in files:
        b = open(os.path.join(ROOT, f), 'rb').read()
        hits = [label for m, label in MARKS if m in b]
        name = os.path.basename(f)
        if 'ChatGPT' in name: hits.append('file name says ChatGPT')
        if name.startswith('file_0000'): hits.append('ChatGPT download name')
        if hits:
            rows.append((f, len(b), hits)); by_dir[os.path.dirname(f) or '(repo root)'] += 1
    out = ['# Art provenance (generated — `python3 scripts/art-provenance.py`)', '',
           f'{len(rows)} of {len(files)} tracked image/video files carry an embedded AI-generation record or a tool name. '
           'A C2PA manifest with `trainedAlgorithmicMedia` is the generator itself stating the picture was produced by a '
           'generative model; OpenAI embeds one in every ChatGPT / DALL·E image. Files in `public/` are re-encoded cuts '
           '(the build scripts strip metadata), so they carry no record of their own — they inherit it from their source.', '',
           '**docs/COMMERCIAL.md says "all art produced by the owner". The owner must confirm, per group below, how the art '
           'was made and that they hold the rights to ship it** (docs/APP-STORE.md §7).', '',
           '## By folder', '', '| folder | files with a record |', '|---|---|']
    out += [f'| `{d}` | {n} |' for d, n in sorted(by_dir.items())]
    out += ['', '## What ships, and what it is cut from', '', '| shipped | source | cut by |', '|---|---|---|']
    out += [f'| `{a}` | `{b}` | {c} |' for a, b, c in DERIVED]
    out += ['', '## Every file', '', '| file | size | evidence |', '|---|---|---|']
    out += [f'| `{f}` | {n // 1024} KB | {", ".join(h)} |' for f, n, h in rows]
    open(os.path.join(ROOT, 'docs', 'ART-PROVENANCE.md'), 'w').write('\n'.join(out) + '\n')
    print(f'{len(rows)}/{len(files)} files with a record → docs/ART-PROVENANCE.md')


if __name__ == '__main__':
    main()
