// v149 A — THE FILE BECOMES A FOLDER: the one place that knows how index.html is split.
//
// The game used to be ONE index.html. Since v149 A the big inline <script>/<style> blocks live in
// src/ as classic files, loaded by <script src> / <link> tags at exactly the positions the inline
// blocks stood (docs/LAYOUT.md is the map), the Phaser bundle is src/vendor/phaser.min.js, and the
// ten baked base64 sheets are plain files in public/.
//
// Tools that read the game's TEXT (pure-Node engine loaders, regex checks, block-index checks)
// should not care: `readGameHtml()` returns index.html with every src/ file put back inline, so it
// is the old monolith, block for block (same <script> count, same order, same indices) — only the
// data URLs are not re-baked unless you ask for them (`{ bake: true }`). scripts/layoutcheck.mjs
// proves that reconstruction is byte-identical to the pre-split file.
//
// Tools that WRITE generated code into the game (the spritekit bakes, build-*-art.py) should find
// their marker with `findLayoutFile(needle)` and write that file.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// The Phaser bundle and the bridge shared one IIFE; the bundle's last statement handed Phaser to
// the bridge as `const mt=Mt(Lt);`. The vendored file ends by publishing that value on ONE global
// (not `window.Phaser`: nothing ever saw a Phaser global, and v1520's gear overlay has a bare
// `Phaser.Geom` path that must keep behaving exactly as it did), and the bridge reads it back.
export const PHASER_GLOBAL = '__RIB_PHASER_V149'
export const PHASER_FILE = 'src/vendor/phaser.min.js'
export const PHASER_HEAD = '(function(){"use strict";\n'
export const PHASER_TAIL = `\nwindow.${PHASER_GLOBAL}=Mt(Lt);})();\n`
export const BRIDGE_TAKE = `const mt=window.${PHASER_GLOBAL};`
export const BRIDGE_ORIG = 'const mt=Mt(Lt);'

// The sheets that were baked into the bridge as data URLs. Every one of them is now a file under
// public/, asked for through window.__RIB_ASSET (v101) like every other sheet.
export const DATA_ASSETS = [
  { global: '__RIB_LOGOS_V44', file: 'rib_logos_v44.png', mime: 'image/png' },
  { global: '__RIB_FIELD', file: 'rib_field_base.jpg', mime: 'image/jpeg' },
  { global: '__RIB_ATLAS', file: 'rib_atlas_base.png', mime: 'image/png' },
  { global: '__RIB_ATLAS_V22', file: 'rib_atlas_v22.png', mime: 'image/png' },
  { global: '__RIB_REFS_V49', file: 'rib_refs_v49.png', mime: 'image/png' },
  { global: '__RIB_WHEEL_V50', file: 'rib_wheel_v50.png', mime: 'image/png' },
  { global: '__RIB_CROWD_V57', file: 'rib_crowd_v57.png', mime: 'image/png' },
  { global: '__RIB_PLAN_V66', file: 'rib_plan_v66.png', mime: 'image/png' },
  { global: '__RIB_SKILL_V64', file: 'rib_skill_v64.png', mime: 'image/png' },
  { global: '__RIB_SIDE_V78', file: 'rib_side_v78.png', mime: 'image/png' },
]
export const assetLine = (a) => `window.${a.global} = window.__RIB_ASSET("${a.file}");`

// <script ...attrs src="./src/x.js" vite-ignore></script>   (attrs first, so the original tag is attrs alone)
const SCRIPT_TAG = /<script([^>]*?) src="\.\/(src\/[^"?]+\.js)(?:\?[^"]*)?"(?: vite-ignore)?><\/script>/g
// <link rel="stylesheet" href="./src/styles/x.css" vite-ignore>; written straight after a </style>
// it is the TAIL of that style element (the @import that must stay relative to the page)
const LINK_TAG = /(<\/style>)?<link rel="stylesheet" href="\.\/(src\/[^"?]+\.css)(?:\?[^"]*)?"(?: vite-ignore)?>/g

function makeReader({ root = ROOT, gitRef } = {}) {
  if (gitRef) return (rel) => execFileSync('git', ['show', `${gitRef}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return (rel) => fs.readFileSync(path.resolve(root, rel), 'utf8')
}
const readBinary = (root, gitRef, rel) => gitRef
  ? execFileSync('git', ['show', `${gitRef}:${rel}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.resolve(root, rel))

// The Phaser bundle as it stood inside the old block (no wrapper).
export function phaserBundle(read = makeReader()) {
  const v = read(PHASER_FILE)
  const i = v.indexOf(PHASER_HEAD), j = v.lastIndexOf(PHASER_TAIL)
  if (i < 0 || j < 0) throw new Error(`${PHASER_FILE} lost its wrapper`)
  return v.slice(i + PHASER_HEAD.length, j)
}

/** index.html with every src/ file put back inline: the pre-v149 monolith, block for block. */
export function inlineLayout(html, opts = {}) {
  const read = opts.read || makeReader(opts)
  let bundle = null
  let out = html.replace(SCRIPT_TAG, (all, attrs, rel) => {
    if (rel === PHASER_FILE) { bundle = phaserBundle(read); return '\u0000PHASER\u0000' }
    let body = read(rel)
    if (body.includes(BRIDGE_TAKE)) {
      if (bundle == null) bundle = phaserBundle(read)
      body = body.replace(BRIDGE_TAKE, () => bundle + BRIDGE_ORIG)
    }
    return `<script${attrs}>${body}</script>`
  })
  out = out.replace(/\u0000PHASER\u0000/g, '')
  out = out.replace(LINK_TAG, (all, closeStyle, rel) => closeStyle ? read(rel) + '</style>' : `<style>${read(rel)}</style>`)
  if (opts.bake) {
    const root = opts.root || ROOT
    for (const a of DATA_ASSETS) {
      const b64 = readBinary(root, opts.gitRef, 'public/' + a.file).toString('base64')
      out = out.replace(assetLine(a), () => `window.${a.global} = "data:${a.mime};base64,${b64}";`)
    }
  }
  return out
}

/** The game's text as one string (the old index.html). `{ gitRef }` reads a commit instead of the tree. */
export function readGameHtml(opts = {}) {
  const read = makeReader(opts)
  return inlineLayout(read('index.html'), { ...opts, read })
}

/** The bodies of every <script> element, in the old block order (block 4 = engine, 7 = career app). */
export function scriptBlocks(opts = {}) {
  return [...readGameHtml(opts).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
}

/** Every file the page is made of that a person edits: index.html, then src/ in load order. */
export function layoutFiles(root = ROOT) {
  const html = fs.readFileSync(path.resolve(root, 'index.html'), 'utf8')
  const files = ['index.html']
  for (const m of html.matchAll(/(?:src|href)="\.\/(src\/[^"?]+)(?:\?[^"]*)?"/g)) files.push(m[1])
  return files
}

/** The one file (index.html or a src/ file) that contains `needle`; throws if none or several. */
export function findLayoutFile(needle, root = ROOT) {
  const hits = layoutFiles(root).filter((f) => fs.readFileSync(path.resolve(root, f), 'utf8').includes(needle))
  if (hits.length !== 1) throw new Error(`"${needle}" is in ${hits.length} layout files (${hits.join(', ') || 'none'})`)
  return path.resolve(root, hits[0])
}

/** Deploy-time cache stamps: every ./src/ reference gets ?v=<content hash> (GitHub Pages caches
 *  for ten minutes; v106.1 reloads a stale index once, and the files it names must not be stale). */
export function stampLayoutRefs(html, root = ROOT) {
  return html.replace(/((?:src|href)=")\.\/(src\/[^"?]+)(?:\?[^"]*)?"/g, (all, pre, rel) => {
    const h = crypto.createHash('sha1').update(fs.readFileSync(path.resolve(root, rel))).digest('hex').slice(0, 10)
    return `${pre}./${rel}?v=${h}"`
  })
}

/** The spritekit bakes since v149 A: a sheet is no longer inlined — public/<file> IS the asset, asked
 *  for through __RIB_ASSET — so a bake only checks that wiring and refreshes the sheet's inline
 *  cellmap (`const <meta> = {...};`) in whichever layout file holds it. */
export function bakeSheet({ global, meta, cellmap }, root = ROOT) {
  const a = DATA_ASSETS.find((x) => x.global === global)
  if (!a) throw new Error(`${global} is not a known sheet (scripts/lib/layout.mjs DATA_ASSETS)`)
  if (!fs.existsSync(path.resolve(root, 'public', a.file))) throw new Error(`public/${a.file} is missing`)
  const wired = findLayoutFile(assetLine(a), root)
  console.log(`${global} is public/${a.file}, asked for in ${path.relative(root, wired)}`)
  if (!meta) return
  const file = findLayoutFile(`const ${meta} = {`, root)
  const map = fs.readFileSync(path.resolve(root, cellmap), 'utf8').trim()
  const re = new RegExp(`const ${meta} = \\{.*?\\};`)
  const text = fs.readFileSync(file, 'utf8')
  if (!re.test(text)) throw new Error(`${meta} not found in ${path.relative(root, file)}`)
  fs.writeFileSync(file, text.replace(re, () => `const ${meta} = ${map};`))
  console.log(`refreshed ${meta} (${Object.keys(JSON.parse(map)).length} cells) in ${path.relative(root, file)}`)
}

/** Code that has leaked into the page's MARKUP (outside every <script>/<style> element). Until
 *  v149 A a bad bake had left 16.8KB of HTML-mangled Phaser source — `</h.length;e++)if(r.
 *  hasownproperty(…` — between a </script> and a <style>; the parser swallowed it as stray end tags,
 *  so it rendered nothing and nobody saw it. Returns the offending snippets (empty = clean). */
export function strayCodeInPage(html) {
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  const hits = []
  for (const re of [/hasownproperty/gi, /p\.exports\s*=/g, /\.addfile\(/gi, /<\/[^>\s]*[;(){}][^>]*>/g]) {
    for (const m of markup.matchAll(re)) { hits.push(markup.slice(Math.max(0, m.index - 20), m.index + 40)); if (hits.length > 5) return hits }
  }
  return hits
}

/** For `page.evaluate(pageSource)`: the SERVED page's text plus every ./src/ file it names, in
 *  order — what `fetch(location.pathname)` used to return on its own when the game was one file.
 *  (Runs in the browser: it must not close over anything in this module.) */
export async function pageSource() {
  const h = await fetch(location.pathname, { cache: 'no-store' }).then((r) => r.text())
  const rels = [...h.matchAll(/(?:src|href)="\.\/(src\/[^"?]+)/g)].map((m) => m[1])
  const parts = await Promise.all(rels.map((rel) => fetch(new URL(rel, location.href), { cache: 'no-store' }).then((r) => r.text()).catch(() => '')))
  return [h, ...parts].join('\n')
}

/** Script sources BY NAME, for the checks that inject the game into a blank page: 'inline:N' is the
 *  Nth inline <script> still in index.html (0 = the v112 A warm, 1 = the v114 film picker, 2 = error
 *  surfacing + __RIB_ASSET), anything else a path such as 'src/04-engine.js'. */
export function gameScripts(names, root = ROOT) {
  const html = fs.readFileSync(path.resolve(root, 'index.html'), 'utf8')
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  return names.map((n) => {
    const m = /^inline:(\d+)$/.exec(n)
    if (m) { if (inline[+m[1]] == null) throw new Error(`index.html has no inline script ${n}`); return inline[+m[1]] }
    return fs.readFileSync(path.resolve(root, n), 'utf8')
  })
}
