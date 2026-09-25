// v149 D IT INSTALLS — the build step that makes an output folder an installable, offline-capable site.
//
// `writeServiceWorker(outDir, { version })` runs AFTER the folder is complete (index.html stamped, src/ and
// public/ copied): it puts <meta name="rib-sw" content="./sw.js"> into the page (src/26-platform.js registers
// the worker only when that meta is present — so `vite` dev never has one), builds the precache manifest with
// one content hash per file, and writes <outDir>/sw.js = the manifest + pwa/sw.js.
//
// Called by vite.config.js (dist/) and scripts/assemble-pages.mjs (_site/). The precache is:
//   the shell        ./ (the page), every ./src/ and ./public/ reference the page makes (as stamped, ?v=…) — REQUIRED:
//                    the worker refuses to install without them, so an offline boot is never half a game
//   the rest         every other runtime file under public/ (the sheets, the menu/coach/vault/badge art, fonts,
//                    icons) — best effort, a miss is fetched at runtime
//   never            the film encodes (a byte-range stream the worker leaves to the network; the .jpg still is in),
//                    the music's .mp3 fallback (v151 E — the .m4a IS precached, best effort, after the shell),
//                    the 1024 store icon, rib-build.json and sw.js themselves.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT } from './layout.mjs'

export const SW_META = '<meta name="rib-sw" content="./sw.js">'
const EXCLUDE = [/\.(mp4|webm|mov)$/i, /^audio\/.*\.mp3$/i /* v151 E: the music's fallback encode — fetched only where Opus-in-MP4 will not decode */, /^icon-1024\.png$/, /\.map$/, /(^|\/)\.DS_Store$/]

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, base, out)
    else out.push(path.relative(base, p).split(path.sep).join('/'))
  }
  return out
}

/** Put the registration meta into the page, idempotently. */
export function markForServiceWorker(html) {
  if (/<meta name="rib-sw" content=/.test(html)) return html
  const at = html.indexOf('<meta name="rib-menu-build"')
  if (at >= 0) return html.slice(0, at) + SW_META + html.slice(at)
  return html.replace(/<\/head>/i, SW_META + '</head>')
}

/** The precache manifest for a finished output folder: [{ url, rev, req?, bytes }]. */
export function precacheManifest(outDir, html) {
  const entries = [{ url: './', rev: sha(Buffer.from(html)), req: 1, bytes: Buffer.byteLength(html) }]
  const seen = new Set()
  for (const m of html.matchAll(/(?:src|href)="(\.\/(?:src|public)\/[^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, '&')
    if (seen.has(url)) continue
    const rel = url.slice(2).split('?')[0]
    const file = path.join(outDir, rel)
    if (!fs.existsSync(file)) continue
    seen.add(url); seen.add('./' + rel)
    const buf = fs.readFileSync(file)
    entries.push({ url, rev: sha(buf), req: 1, bytes: buf.length })
  }
  // vite build bundles the page's own <style> (and the fonts it imports) into dist/assets/<name>-<hash>.*
  for (const rel of walk(path.join(outDir, 'assets'))) {
    const buf = fs.readFileSync(path.join(outDir, 'assets', rel))
    entries.push({ url: './assets/' + rel, rev: sha(buf), req: html.includes('/assets/' + rel) ? 1 : undefined, bytes: buf.length })
  }
  for (const rel of walk(path.join(outDir, 'public'))) {
    const url = './public/' + rel
    if (seen.has(url) || EXCLUDE.some((re) => re.test(rel))) continue
    const buf = fs.readFileSync(path.join(outDir, 'public', rel))
    entries.push({ url, rev: sha(buf), bytes: buf.length })
  }
  return entries
}

export function writeServiceWorker(outDir, { version } = {}) {
  const indexPath = path.join(outDir, 'index.html')
  let html = markForServiceWorker(fs.readFileSync(indexPath, 'utf8'))
  fs.writeFileSync(indexPath, html)
  const entries = precacheManifest(outDir, html)
  const ver = version || sha(Buffer.from(entries.map((e) => e.url + '@' + e.rev).join('\n')))
  const template = fs.readFileSync(path.join(ROOT, 'pwa', 'sw.js'), 'utf8')
  const cfg = { version: ver, builtAt: new Date().toISOString(), precache: entries.map(({ url, rev, req }) => (req ? { url, rev, req } : { url, rev })) }
  fs.writeFileSync(path.join(outDir, 'sw.js'), `self.__RIB_SW = ${JSON.stringify(cfg)};\n${template}`)
  const bytes = entries.reduce((a, e) => a + e.bytes, 0)
  return { version: ver, entries: entries.length, required: entries.filter((e) => e.req).length, bytes }
}
