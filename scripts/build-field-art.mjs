#!/usr/bin/env node
/* Cuts the v91 field atlas from the sheets in art/field/ and regenerates RIB_META_V91 in
 * index.html. Run after changing any sheet:  node scripts/build-field-art.mjs */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const r = spawnSync('python3', [path.join(here, 'build-field-art.py')], { stdio: 'inherit' })
process.exit(r.status ?? 1)
