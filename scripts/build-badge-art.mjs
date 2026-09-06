#!/usr/bin/env node
/* Cuts the v95 callout badges from the sheets in art/badges/ into public/badges/ and
 * regenerates RIB_BADGES_V95 in index.html. Run after changing any sheet:
 *   node scripts/build-badge-art.mjs */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const r = spawnSync('python3', [path.join(here, 'build-badge-art.py')], { stdio: 'inherit' })
process.exit(r.status ?? 1)
