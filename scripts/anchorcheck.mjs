#!/usr/bin/env node
// v150 D — THE MAP FITS ON A PAGE. Pure Node, no server.
//
// docs/ANCHORS.md is the anchor encyclopedia CLAUDE.md points at. Each entry is one line:
//   - `ANCHOR` / `ANCHOR` — `src/file.js` + `other/file` · what it is …
// This check proves every anchor (the backticked strings before the first " — ") still occurs in
// one of the files named between that dash and the first " · " (or anywhere in the game's source
// when the entry names none). A renamed or deleted banner fails here instead of misleading a reader.
//
// It also proves that every repo path CLAUDE.md and the agent docs name (`src/…`, `docs/…`,
// `scripts/…`, `public/…`, `pwa/…`) exists, so a moved doc or check cannot leave a dead pointer.
//
// Prints one ok/FAIL line per assertion and a final {"pass","fail","pageErrors"} JSON line.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rel = p => path.join(ROOT, p)
let pass = 0, fail = 0
const ok = (cond, label, evidence = '') => {
  if (cond) pass++; else fail++
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${evidence ? '  ' + evidence : ''}`)
}

// ---- the corpus an anchor may live in -------------------------------------------------------
function walk(dir) {
  if (!fs.existsSync(rel(dir))) return []
  return fs.readdirSync(rel(dir), { withFileTypes: true }).flatMap(d => {
    const p = path.posix.join(dir, d.name)
    if (d.isDirectory()) return d.name === 'vendor' || d.name === 'node_modules' ? [] : walk(p)
    return /\.(js|mjs|css|html|py)$/.test(d.name) ? [p] : []
  })
}
const corpusFiles = [...walk('src'), ...walk('public').filter(f => !f.includes('/', 'public/'.length)), 'index.html',
  ...fs.readdirSync(rel('scripts')).filter(f => /\.(py|mjs)$/.test(f)).map(f => 'scripts/' + f)]
const text = new Map()
const read = f => {
  if (!text.has(f)) text.set(f, fs.existsSync(rel(f)) && fs.statSync(rel(f)).isFile() ? fs.readFileSync(rel(f), 'utf8') : null)
  return text.get(f)
}

// ---- ANCHORS.md -------------------------------------------------------------------------------
const anchorsMd = read('docs/ANCHORS.md')
ok(anchorsMd != null, 'docs/ANCHORS.md exists')
const entries = (anchorsMd || '').split('\n').filter(l => l.startsWith('- `'))
ok(entries.length >= 60, 'ANCHORS.md has its entries', `${entries.length} entries`)

let anchors = 0
const missing = []
for (const line of entries) {
  const dash = line.indexOf(' — ')
  if (dash < 0) { missing.push(`no " — " in: ${line.slice(0, 80)}`); continue }
  const head = line.slice(0, dash)
  const dot = line.indexOf(' · ', dash)
  const loc = dot < 0 ? '' : line.slice(dash + 3, dot)
  const names = [...head.matchAll(/`([^`]+)`/g)].map(m => m[1])
  const files = [...loc.matchAll(/`([^`]+)`/g)].map(m => m[1]).filter(f => /[/.]/.test(f))
  for (const f of files) if (read(f) == null) missing.push(`file ${f} (named for ${names[0]}) does not exist`)
  const where = files.length ? files : corpusFiles
  for (const a of names) {
    anchors++
    if (!where.some(f => (read(f) || '').includes(a))) {
      const elsewhere = corpusFiles.filter(f => (read(f) || '').includes(a))
      missing.push(`"${a}" not in ${files.join(' + ') || 'the source'}${elsewhere.length ? ` (found in ${elsewhere.slice(0, 3).join(', ')})` : ''}`)
    }
  }
}
ok(missing.length === 0, `every anchor in ANCHORS.md occurs in the file it names`, `${anchors} anchors` +
  (missing.length ? `\n       ${missing.join('\n       ')}` : ''))

// ---- the paths the agent docs point at ------------------------------------------------------
const docs = ['CLAUDE.md', 'docs/ANCHORS.md', 'docs/AGENT-WORKFLOW.md', 'scripts/README.md', 'README.md']
const dead = []
let paths = 0
for (const d of docs) {
  const t = read(d)
  if (t == null) { dead.push(`${d} itself`); continue }
  for (const m of t.matchAll(/`((?:src|docs|scripts|public|pwa)\/[^`\s*<>{}]+?)`/g)) {
    const p = m[1].replace(/[),.:;]+$/, '').replace(/#.*$/, '')
    if (/\.\.\.|…|NN-|vNN|<|\bname\b/.test(p)) continue   // placeholders, not paths
    paths++
    if (!fs.existsSync(rel(p))) dead.push(`${d}: ${p}`)
  }
}
ok(dead.length === 0, 'every src/ docs/ scripts/ public/ path the agent docs name exists',
  `${paths} paths` + (dead.length ? `\n       ${[...new Set(dead)].join('\n       ')}` : ''))

// ---- the generated checks table is current -----------------------------------------------------
import { execFileSync } from 'node:child_process'
let stale = ''
try { execFileSync(process.execPath, [rel('scripts/checks-table.mjs'), '--check'], { encoding: 'utf8' }) }
catch (e) { stale = 'run `node scripts/checks-table.mjs` — scripts/checks.json changed since the appendix was written' }
ok(!stale, "docs/CHECKS.md's generated appendix matches scripts/checks.json", stale)

// ---- CLAUDE.md stays a page -------------------------------------------------------------------
const claude = read('CLAUDE.md') || ''
const lines = claude.split('\n').length
ok(lines <= 170, 'CLAUDE.md stays about a page', `${lines} lines, ${claude.split(/\s+/).length} words`)

console.log(JSON.stringify({ pass, fail, pageErrors: 0, anchors, entries: entries.length }))
process.exit(fail ? 1 : 0)
