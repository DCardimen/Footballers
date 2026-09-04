#!/usr/bin/env node
/* Derives public/menu/*.webp from the originals in art/menu/.
 * The menu ships cut-down copies, never the source files: badges and legacy
 * icons are cropped to their own artwork (a coin adrift in its glow renders
 * tiny), the swash has its matting fringe eroded, and everything is downscaled.
 * Run after dropping new art into art/menu/:  node scripts/build-menu-art.mjs */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const r = spawnSync('python3', [path.join(here, 'build-menu-art.py')], { stdio: 'inherit' })
process.exit(r.status ?? 1)
