#!/usr/bin/env node
// v149 B — ONE COMMAND RUNS THE AREA.
//
//   node scripts/run-checks.mjs <suite|check...> [--jobs N] [--base-port 5400] [--json]
//                               [--retry-flaky] [--since <git-ref>] [--timeout <sec>]
//                               [--out <dir>] [--record-known] [--report <dir>] [--list] [--dry]
//
// Suites and checks live in scripts/checks.json; failures that are already failing on main live in
// scripts/known-failures.json. Each job gets its OWN vite server on a free port (or every job shares
// $GAME_URL when it is set) and every check launches its own throwaway Chromium profile, so nothing
// — port, localStorage, service worker — is shared between two checks running side by side.
// Each check's whole output goes to <out>/<check>.log; the table says PASS / KNOWN / NEW / FLAKY /
// INFO / TIMEOUT, and the exit code is 1 only when something NEW failed. docs/CHECKS.md has the rest.
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import http from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'checks.json'), 'utf8'))
const KNOWN_FILE = path.join(HERE, 'known-failures.json')
const KNOWN = fs.existsSync(KNOWN_FILE) ? JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')) : { failures: [] }

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2)
const opt = { jobs: Math.max(1, Math.min(4, os.cpus().length)), basePort: 5400, json: false, retry: false, since: null, timeout: 0, out: null, record: false, list: false, dry: false }
const targets = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], v = () => argv[++i]
  if (a === '--jobs' || a === '-j') opt.jobs = Math.max(1, +v() || 1)
  else if (a === '--base-port') opt.basePort = +v()
  else if (a === '--json') opt.json = true
  else if (a === '--retry-flaky') opt.retry = true
  else if (a === '--since') opt.since = v()
  else if (a === '--timeout') opt.timeout = +v()
  else if (a === '--out') opt.out = v()
  else if (a === '--record-known') opt.record = true
  else if (a === '--list') opt.list = true
  else if (a === '--dry') opt.dry = true
  else if (a === '--report') opt.report = v()
  else if (a === '-h' || a === '--help') { usage(); process.exit(0) }
  else if (a.startsWith('-')) { console.error('unknown flag ' + a); usage(); process.exit(2) }
  else targets.push(a)
}
function usage () {
  console.log(`usage: node scripts/run-checks.mjs <suite|check...> [--jobs N] [--base-port 5400] [--json]
         [--retry-flaky] [--since <git-ref>] [--timeout <sec>] [--out <dir>] [--record-known] [--report <dir>] [--list] [--dry]
  suites: ${Object.keys(allSuites()).join(', ')}`)
}
function allSuites () {
  const s = { ...MANIFEST.suites }
  s.full = { desc: 'every check in the manifest', checks: Object.keys(MANIFEST.checks) }
  s.fast = { desc: 'every check not marked slow', checks: Object.keys(MANIFEST.checks).filter(n => !MANIFEST.checks[n].slow) }
  return s
}
const SUITES = allSuites()

if (opt.list) {
  for (const [k, s] of Object.entries(SUITES)) console.log(`${k.padEnd(14)} ${String(s.checks.length).padStart(3)}  ${s.desc}`)
  process.exit(0)
}

// ---------------------------------------------------------------- selection
const why = {}
function addSuite (name, reason) {
  const s = SUITES[name]; if (!s) return false
  for (const c of s.checks) if (!why[c]) why[c] = reason || name
  return true
}
function addCheck (name, reason) {
  const n = name.replace(/^scripts\//, '').replace(/\.mjs$/, '')
  if (!MANIFEST.checks[n]) return false
  if (!why[n]) why[n] = reason || 'named'
  return true
}
for (const t of targets) {
  if (!addSuite(t) && !addCheck(t)) { console.error(`no suite or check called "${t}" — --list shows the suites`); process.exit(2) }
}
if (opt.since) sinceSelect(opt.since)
if (opt.report) reportFrom(opt.report)   // never returns
if (!Object.keys(why).length) { usage(); process.exit(2) }

function globRe (g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$')
}
// --since: changed files → suites. A changed check runs itself; a file glob in a suite pulls the
// suite; a changed source file (index.html, or whatever it is split into) is read hunk by hunk: the
// nearest /* ===== vNN ... ===== banner above each hunk, any banner inside it, and every vNN tag in
// the changed lines are matched against each suite's `anchors`. Nothing matched → smoke.
function sinceSelect (ref) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
  // `--since main` compares main with the WORKING TREE (committed or not, plus untracked files);
  // `--since A..B` compares two commits and ignores the working tree.
  const range = ref.includes('..') ? ref.split(/\.\.\.?/) : null
  const refs = range ? [range[0], range[1] || 'HEAD'] : [ref]
  const files = [...new Set(git('diff', '--name-only', ...refs).split('\n').concat(range ? [] : git('ls-files', '--others', '--exclude-standard').split('\n')).filter(Boolean))]
  const readAt = f => { if (!range) return fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : null; try { return git('show', `${refs[1]}:${f}`) } catch (e) { return null } }
  const picked = []
  const suiteAnchors = Object.entries(MANIFEST.suites).map(([k, s]) => [k, (s.anchors || []).map(a => a.toLowerCase())])
  const tagHit = (tags, texts) => {
    const hits = new Map()   // suite → the anchor that pulled it
    for (const [k, anchors] of suiteAnchors) for (const a of anchors) {
      if (hits.has(k)) break
      const isTag = /^v\d+(\.\d+)?( [a-f]\d?)?$/.test(a)
      if (isTag) { if (tags.has(a) || (!/ /.test(a) && [...tags].some(t => t.split(' ')[0] === a))) hits.set(k, a) }
      else if (texts.some(t => t.toLowerCase().includes(a))) hits.set(k, a)
    }
    return hits
  }
  for (const f of files) {
    const base = path.basename(f).replace(/\.mjs$/, '')
    if (f.startsWith('scripts/') && MANIFEST.checks[base]) { addCheck(base, 'changed ' + f); picked.push(f + ' → ' + base); continue }
    let hit = false
    for (const [k, s] of Object.entries(MANIFEST.suites)) if ((s.files || []).some(g => globRe(g).test(f))) { addSuite(k, 'changed ' + f); picked.push(f + ' → ' + k); hit = true }
    if (hit) continue
    // the harness itself, the server config, the dependencies: anything could move — smoke
    if (/^(scripts\/lib\/|scripts\/run-checks\.mjs$|vite\.config\.|package(-lock)?\.json$)/.test(f)) { addSuite('smoke', 'changed ' + f); picked.push(f + ' → smoke'); continue }
    if (!/\.(html|js|mjs|css)$/.test(f) || f.startsWith('scripts/')) continue
    const text = readAt(f); if (text == null) continue
    // source file: for each changed line, the changed SEGMENT (common prefix/suffix trimmed off
    // against the line it replaced — the career block is one-liners thousands of characters long),
    // the nearest banner before that segment, and the vNN tags / fooV123 identifiers inside it.
    const lines = text.split('\n')
    // a banner `/* ===== v147 D THE ... =====` or a local marker `// v147 D: ...` / `/* v146 A ...`
    const BAN = /(?:\/\*+|\/\/)[ \t]*(?:=+[ \t]*)?(v\d{2,3}(?:\.\d+)?\b[^=*\n]{0,90})/g
    const banners = []   // [lineIdx, title]
    lines.forEach((l, i) => { for (const m of l.matchAll(BAN)) banners.push([i, m[1].trim()]) })
    let diff = ''
    try { diff = git('diff', '-U0', ...refs, '--', f) } catch (e) {}
    const untracked = !range && !diff && !git('ls-files', '--', f).trim()
    const tags = new Set(), texts = []
    const tagsOf = s => { for (const m of s.matchAll(/\bv(\d{2,3})(\.\d+)?(?: ([A-F]\d?)\b)?/g)) tags.add(('v' + m[1] + (m[2] || '') + (m[3] ? ' ' + m[3] : '')).toLowerCase()); for (const m of s.matchAll(/[a-z]V(\d{2,3})([A-F])?\b/g)) tags.add(('v' + m[1] + (m[2] ? ' ' + m[2] : '')).toLowerCase()) }
    const bannerAbove = at => { let b = null; for (const x of banners) { if (x[0] < at) b = x; else break } return b }
    const seg = (at, before, after) => {
      let p = 0, q = 0
      if (before != null) {
        while (p < before.length && p < after.length && before[p] === after[p]) p++
        while (q < before.length - p && q < after.length - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++
      }
      const piece = after.slice(Math.max(0, p - 150), Math.min(after.length, after.length - q + 150))
      tagsOf(piece)
      for (const m of piece.matchAll(BAN)) texts.push(m[1])
      const inLine = [...after.slice(0, p).matchAll(BAN)].pop()
      const b = inLine ? [at, inLine[1]] : bannerAbove(at)
      if (b) { tagsOf(b[1]); texts.push(b[1]) }
    }
    if (untracked) for (const [, t] of banners) { tagsOf(t); texts.push(t) }
    const dl = diff.split('\n')
    for (let i = 0; i < dl.length; i++) {
      const h = dl[i].match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/); if (!h) continue
      const minus = [], plus = []
      let j = i + 1
      for (; j < dl.length && !dl[j].startsWith('@@'); j++) { if (dl[j][0] === '-') minus.push(dl[j].slice(1)); else if (dl[j][0] === '+') plus.push(dl[j].slice(1)) }
      const at = +h[1] - 1
      plus.forEach((l, k) => seg(at + k, k < minus.length ? minus[k] : null, l))
      if (!plus.length) { const b = bannerAbove(at + 1); if (b) { tagsOf(b[1]); texts.push(b[1]) } for (const m of minus) tagsOf(m.slice(0, 400)) }
      i = j - 1
    }
    const hits = tagHit(tags, texts)
    for (const k of hits.keys()) addSuite(k, "changed " + f)
    if (hits.size) { picked.push(`${f} → ${[...hits].map(([k, a]) => `${k} (${a})`).join(", ")}`); if (/index\.html$/.test(f)) addCheck("bootviewcheck", "changed " + f) }
  }
  if (!Object.keys(why).length) { addSuite('smoke', 'nothing mapped — smoke'); picked.push('(nothing mapped — running smoke)') }
  if (!opt.json) { console.log(`--since ${ref}: ${files.length} changed file(s)`); for (const p of picked) console.log('  ' + p) }
}

// ---------------------------------------------------------------- run plan
const names = Object.keys(why)
const est = n => MANIFEST.checks[n].runtimeSec || 90
names.sort((a, b) => est(b) - est(a))   // longest first: the slow tail starts early
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = path.resolve(opt.out || path.join(os.tmpdir(), 'gridiron-checks', stamp))
const jobs = Math.min(opt.jobs, names.length)
const serial = names.reduce((s, n) => s + est(n), 0)
if (!opt.json) console.log(`${names.length} check(s), ${jobs} job(s), est. ${fmt(serial)} serial → logs in ${OUT}`)
if (opt.dry) { for (const n of names) console.log(`  ${n.padEnd(24)} ~${fmt(est(n))}  (${why[n]})`); process.exit(0) }
fs.mkdirSync(OUT, { recursive: true })

function fmt (s) { s = Math.round(s); return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s` }

// ---------------------------------------------------------------- servers
function portFree (p) {
  return new Promise(r => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(p, () => s.close(() => r(true))) })
}
function get (url, ms = 90000) {
  return new Promise(r => { const q = http.get(url, res => { res.resume(); r(res.statusCode) }); q.on('error', () => r(0)); q.setTimeout(ms, () => { q.destroy(); r(0) }) })
}
function listening (port) {   // the cheap health check: the process is up and the port takes a connection
  return new Promise(r => { const s = net.connect(port, 'localhost'); s.once('connect', () => { s.destroy(); r(true) }); s.once('error', () => r(false)); s.setTimeout(5000, () => { s.destroy(); r(false) }) })
}
const servers = []
async function startServer (from) {
  for (let p = from; p < from + 200; p++) {
    if (servers.some(s => s.port === p) || !(await portFree(p))) continue
    const log = fs.openSync(path.join(OUT, `_server_${p}.log`), 'a')
    fs.writeSync(log, `\n==== ${new Date().toISOString()} start on :${p}\n`)
    const ch = spawn(process.execPath, [path.join(HERE, 'lib', 'serve.mjs'), String(p)], { cwd: ROOT, stdio: ['ignore', log, log], detached: true })
    ch.on('exit', (code, sig) => { try { fs.writeSync(log, `==== ${new Date().toISOString()} exit code=${code} signal=${sig}\n`) } catch (e) {} })
    const s = { port: p, url: `http://localhost:${p}/`, proc: ch }
    servers.push(s)
    const t0 = Date.now()
    while (Date.now() - t0 < 180000) {   // the first page is a full html transform: seconds on a loaded box
      if (ch.exitCode !== null) break
      if (await get(s.url) === 200) return s
      await new Promise(r => setTimeout(r, 300))
    }
    try { process.kill(-ch.pid, 'SIGKILL') } catch (e) {}
    servers.splice(servers.indexOf(s), 1)
  }
  throw new Error('could not start a vite server from port ' + from)
}
function stopServers () { for (const s of servers) try { process.kill(-s.proc.pid, 'SIGTERM') } catch (e) {} }
process.on('exit', stopServers)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServers(); for (const c of live) try { process.kill(-c.pid, 'SIGKILL') } catch (e) {} ; process.exit(130) })

// ---------------------------------------------------------------- one check
const live = new Set()
const SCRUB = ['SPLASH_URL', 'MENU_URL', 'SIDE_URL', 'MENU_INTEGRATION_URL', 'DECLARE_URL', 'URL', 'BASE_URL']
function runOne (name, server, attempt) {
  const meta = MANIFEST.checks[name]
  const logFile = path.join(OUT, `${name}${attempt ? '.retry' : ''}.log`)
  const env = { ...process.env, ...(meta.env || {}) }
  for (const k of SCRUB) delete env[k]
  if (server) { env.GAME_URL = server.url; env.PORT = String(server.port) }
  const args = (meta.args || []).map(a => a.replace('{LOGDIR}', OUT))
  const limit = (opt.timeout || meta.timeoutSec || Math.max(300, (meta.runtimeSec || 120) * 3)) * 1000
  return new Promise(resolve => {
    const t0 = Date.now()
    const fd = fs.openSync(logFile, 'w')
    const ch = spawn(process.execPath, [path.join(ROOT, meta.file), ...args], { cwd: ROOT, env, stdio: ['ignore', fd, fd], detached: true })
    live.add(ch)
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-ch.pid, 'SIGKILL') } catch (e) {} }, limit)
    ch.on('close', (code, sig) => {
      if (code === null) code = 128   // killed by a signal (the timeout, or the OOM killer): never a pass
      clearTimeout(timer); live.delete(ch); fs.closeSync(fd)
      try { process.kill(-ch.pid, 'SIGKILL') } catch (e) {}   // any orphaned chromium
      const text = fs.readFileSync(logFile, 'utf8')
      resolve({ name, code, timedOut, secs: (Date.now() - t0) / 1000, log: logFile, ...parse(text, code), port: server && server.port })
    })
  })
}

// ---------------------------------------------------------------- parse
// Normalises the house styles: `ok   x` / `FAIL x` lines, `PASS  x`, `✗ x`, `>> step -> MISS`,
// a JSON line with {pass, fail, pageErrors|errors}, `N passed, M failed`, `N/M passed`,
// `VERDICT: PASS|FAIL [...]`, and the page-error line in all its spellings.
function parse (text, code) {
  const lines = text.split('\n')
  let pass = 0, fail = 0, jp = null, jf = null, pageErrors = 0, verdict = null
  const failing = [], misses = [], verdictItems = []
  let pageErrorLines = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], l = raw.trim()
    let m
    // a closing summary — `FAILED (4): a | b`, `FAILED: a, b` — lists the FAIL lines again: not new assertions
    if ((m = l.match(/^FAILED(?:\s*\(\d+\))?:\s*(.+)$/))) { verdict = 'FAIL'; verdictItems.push(...m[1].split(/\s+\|\s+|,\s+(?=[a-z])/).map(s => s.trim()).filter(Boolean)); continue }
    if (/^ALL (?:CHECKS )?PASSED\b/i.test(l)) { verdict = verdict || 'PASS'; continue }
    if ((m = l.match(/^[\w.-]{1,24}:\s*(PASS|FAIL)$/))) { verdict = m[1]; continue }   // `v111A: PASS`
    if ((m = l.match(/^(?:✅|❌)\s.*\b(PASS|FAIL)(?:ED)?\s*$/))) { verdict = m[1]; continue }   // `✅ DAILY CHECK PASS`
    if (/^PAGEERROR:/.test(l)) { pageErrorLines++; continue }
    if ((m = l.match(/^(?:ok|OK|PASS|✓|✔)(?::|\s+)(\S.*)$/))) { pass++; continue }
    if ((m = l.match(/^(?:FAIL|FAILED|✗|✘)(?::|\s+)(\S.*)$/))) { fail++; failing.push(m[1].trim()); continue }
    if ((m = l.match(/^>>\s*(.+?)\s*->\s*MISS\b/))) { misses.push(m[1]); continue }
    if ((m = l.match(/^VERDICT:?\s*(PASS|FAIL)\b\s*(.*)$/i))) {
      verdict = m[1].toUpperCase()
      if (verdict === 'FAIL' && m[2]) { try { const a = JSON.parse(m[2]); if (Array.isArray(a)) for (const x of a) verdictItems.push(String(x)) } catch (e) {} }
      continue
    }
    if (l.startsWith('{') && l.endsWith('}')) {
      try {
        const o = JSON.parse(l)
        if (typeof o.pass === 'number' && typeof o.fail === 'number') { jp = o.pass; jf = o.fail }
        const pe = typeof o.pageErrors === 'number' ? o.pageErrors : typeof o.errors === 'number' ? o.errors : null
        if (pe != null && (typeof o.pass === 'number' || 'pageErrors' in o)) pageErrors = Math.max(pageErrors, pe)
      } catch (e) {}
      continue
    }
    if ((m = l.match(/^(\d+) (?:passed|ok), (\d+) failed/))) { jp = +m[1]; jf = +m[2]; continue }
    if ((m = l.match(/^(\d+)\/(\d+) passed/))) { jp = +m[1]; jf = +m[2] - +m[1]; continue }
    if (/^no (?:js )?page ?errors\b/i.test(l)) continue
    if ((m = l.match(/^(?:js )?page ?errors?(?:\s*\([^)]*\))?:?\s*(.*)$/i)) || (m = l.match(/^(?:js )?pageerrors:?\s*(.*)$/i)) || (m = l.match(/^ERRORS:\s*(.*)$/))) {
      const rest = m[1].trim()
      if (/^(none|0|\[\]|\{\})$/i.test(rest)) continue
      if ((m = rest.match(/^(\d+)\b/))) { pageErrors = Math.max(pageErrors, +m[1]); continue }   // `0`, `0 []`
      // a list follows, on this line or the next few
      let n = rest ? 1 : 0
      if (!rest) for (let j = i + 1; j < lines.length && lines[j].trim() && !/^(ok|FAIL|PASS|\{|VERDICT)/.test(lines[j].trim()); j++) n++
      pageErrors = Math.max(pageErrors, n)
    }
  }
  // a pretty-printed JSON report (`{` … `}` at column 0) carrying `fails: [...]` and/or `pass: bool`
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== '{') continue
    let j = i + 1; while (j < lines.length && lines[j] !== '}') j++
    if (j >= lines.length) break
    try {
      const o = JSON.parse(lines.slice(i, j + 1).join('\n'))
      const arr = Array.isArray(o.fails) ? o.fails : Array.isArray(o.failures) ? o.failures : null
      if (arr) { for (const x of arr) verdictItems.push(typeof x === 'string' ? x : JSON.stringify(x)); if (arr.length) verdict = 'FAIL'; else verdict = verdict || 'PASS' }
      if (typeof o.pass === 'boolean') verdict = o.pass ? (verdict || 'PASS') : 'FAIL'
      if (typeof o.fails === 'number' && o.fails > 0) verdict = 'FAIL'
      if (typeof o.violations === 'number') { if (o.violations > 0) { verdict = 'FAIL'; verdictItems.push('violations: ' + o.violations) } else verdict = verdict || 'PASS' }   // creditcheck
      if (typeof o.pass === 'number' && typeof o.fail === 'number') { jp = o.pass; jf = o.fail }
      if (typeof o.pageErrors === 'number') pageErrors = Math.max(pageErrors, o.pageErrors)
    } catch (e) {}
    i = j
  }
  pageErrors = Math.max(pageErrors, pageErrorLines)
  if (jp != null) pass = Math.max(pass, jp)
  if (jf != null) fail = Math.max(fail, jf)
  if (!failing.length) failing.push(...verdictItems)
  const tail = lines.filter(l => l.trim()).slice(-6)
  // the line that says what threw, for a script that died rather than failed an assertion
  const crash = lines.map(l => l.trim()).find(l => /^(?:[\w.]+: )?(?:\w*Error|Exception)\b|^Error:|failed:/.test(l) && !/^at /.test(l)) || null
  return { pass, fail, pageErrors, verdict, failing, misses, tail, crash }
}

function knownFor (name) {
  // checks.json's `flaky` list is documentation (what has been seen flipping); only this file excuses
  return (KNOWN.failures || []).filter(k => k.check === name || k.check === '*').map(k => ({ ...k, re: new RegExp(k.pattern) }))
}
function judge (r) {
  const items = r.failing.slice()
  if (r.fail > r.failing.length) items.push(`${r.fail - r.failing.length} failure(s) counted with no assertion line`)
  if (r.pageErrors) items.push(`page errors: ${r.pageErrors}`)
  if (r.verdict === 'FAIL' && !items.length) items.push('VERDICT: FAIL')
  if (r.timedOut) items.push(`TIMEOUT after ${fmt(r.secs)}`)
  else if (r.code && !items.length) items.push(`exit ${r.code}: ${(r.crash || r.tail.slice(-2).join(" | ")).slice(0, 300)}`)
  const bad = items.length > 0
  const known = knownFor(r.name)
  const fresh = [], old = []
  for (const it of items) { const k = known.find(k => k.re.test(it)); (k ? old : fresh).push(k ? { item: it, note: k.note } : it) }
  const gone = known.filter(k => !k.flaky && !items.some(it => k.re.test(it))).map(k => k.pattern)
  let status
  if (r.timedOut) status = fresh.length ? 'TIMEOUT' : 'KNOWN'
  else if (!bad) status = (r.pass || r.verdict === 'PASS') ? 'PASS' : 'INFO'
  else status = fresh.length ? 'NEW' : 'KNOWN'
  return { ...r, status, newFails: fresh, knownFails: old, knownGone: bad || r.pass ? gone : [] }
}

// ---------------------------------------------------------------- go
const results = []
const t0 = Date.now()
const useShared = !!process.env.GAME_URL
const queue = names.slice()
let done = 0
async function worker (w) {
  let server = null
  while (queue.length) {
    const name = queue.shift()
    const meta = MANIFEST.checks[name]
    // a server that died under us (killed from outside, or vite closed itself) is restarted before
    // the next check, and a check that could not reach it is re-run once — that is not a flake
    const ensure = async () => {
      if (!meta.needsServer) return null
      if (useShared) return server || (server = { url: process.env.GAME_URL, port: +(new URL(process.env.GAME_URL).port || 80), shared: true })
      if (server && server.proc.exitCode === null && await listening(server.port)) return server
      if (server) { if (!opt.json) console.log(`  (the server on :${server.port} is gone — starting another)`); try { process.kill(-server.proc.pid, 'SIGKILL') } catch (e) {} servers.splice(servers.indexOf(server), 1) }
      return (server = await startServer(opt.basePort + w * 3))
    }
    const unreachable = r => r.code && /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE/.test(fs.readFileSync(r.log, 'utf8'))
    let r = judge(await runOne(name, await ensure(), 0))
    if (meta.needsServer && !useShared && unreachable(r)) r = { ...judge(await runOne(name, await ensure(), 0)), infraRetry: true }
    if (opt.retry && (r.status === 'NEW' || r.status === 'TIMEOUT')) {
      const r2 = judge(await runOne(name, await ensure(), 1))
      const retry = { exit: r2.code, status: r2.status, newFails: r2.newFails, log: r2.log, secs: r2.secs }
      if (r2.status === 'PASS' || r2.status === 'KNOWN' || r2.status === 'INFO') r = { ...r2, status: 'FLAKY', firstTry: { newFails: r.newFails, log: r.log, exit: r.code }, retry, secs: r.secs + r2.secs }
      else r = { ...r, retry, secs: r.secs + r2.secs }
    }
    results.push(r)
    try { fs.writeFileSync(path.join(OUT, name + '.result.json'), JSON.stringify(slim(r), null, 1)) } catch (e) {}
    done++
    if (!opt.json) console.log(`[${String(done).padStart(3)}/${names.length}] ${badge(r.status)} ${name.padEnd(24)} ${fmt(r.secs).padStart(6)}  ${counts(r)}`)
  }
}
function slim (r) { return { name: r.name, status: r.status, secs: Math.round(r.secs), pass: r.pass, fail: r.fail, pageErrors: r.pageErrors, exit: r.code, timedOut: r.timedOut, newFails: r.newFails, knownFails: r.knownFails, knownGone: r.knownGone, misses: r.misses, log: r.log, why: why[r.name], firstTry: r.firstTry, retry: r.retry, port: r.port } }
function badge (s) { return ({ PASS: 'PASS   ', KNOWN: 'KNOWN  ', NEW: 'NEW    ', FLAKY: 'FLAKY  ', INFO: 'INFO   ', TIMEOUT: 'TIMEOUT' })[s] || s }
function counts (r) { return `${r.pass} ok / ${r.fail} fail${r.pageErrors ? ` / ${r.pageErrors} page err` : ''}${r.misses.length ? ` / ${r.misses.length} nav miss` : ''}${r.code ? ` / exit ${r.code}` : ''}` }

await Promise.all(Array.from({ length: jobs }, (_, w) => worker(w)))
stopServers()
finish(results, (Date.now() - t0) / 1000, jobs, OUT)

// --report <dir>: re-judge a finished (or half-finished) run's logs against the current parser and
// known-failures.json, without running anything. Handy while editing the baseline.
function reportFrom (dir) {
  dir = path.resolve(dir)
  const sum = fs.existsSync(path.join(dir, 'summary.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')) : { results: [] }
  const meta = {}
  for (const r of sum.results) meta[r.name] = r
  for (const f of fs.readdirSync(dir)) if (/\.result\.json$/.test(f)) { const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); meta[r.name] = r }
  const out = []
  for (const f of fs.readdirSync(dir).filter(f => /^[^_.][^.]*\.log$/.test(f))) {
    const name = f.slice(0, -4), m = meta[name] || { exit: 0, secs: 0 }   // no result yet (a run still going): judge the text alone
    const code = m.firstTry ? (m.firstTry.exit ?? 1) : (m.exit ?? m.code ?? 0)
    let r = judge({ name, code, timedOut: !!m.timedOut || m.status === "TIMEOUT", secs: m.secs || 0, log: path.join(dir, f), ...parse(fs.readFileSync(path.join(dir, f), 'utf8'), code) })
    const rf = path.join(dir, name + '.retry.log')
    if (fs.existsSync(rf) && (r.status === 'NEW' || r.status === 'TIMEOUT')) {
      const c2 = m.retry ? m.retry.exit : (m.status === 'FLAKY' ? 0 : code)
      const r2 = judge({ name, code: c2, timedOut: false, secs: 0, log: rf, ...parse(fs.readFileSync(rf, 'utf8'), c2) })
      if (['PASS', 'KNOWN', 'INFO'].includes(r2.status)) r = { ...r2, secs: r.secs, status: 'FLAKY', firstTry: { newFails: r.newFails, log: r.log } }
    }
    out.push(r)
  }
  finish(out, sum.wallSec || 0, sum.jobs || 0, dir)
}

function finish (results, wall, jobs, OUT) {
  results.sort((a, b) => a.name.localeCompare(b.name))
  const tally = {}; for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1
  const summary = { out: OUT, wallSec: Math.round(wall), serialSec: Math.round(results.reduce((s, r) => s + r.secs, 0)), jobs, tally, results: results.map(slim) }
  fs.writeFileSync(path.join(OUT, opt.report ? 'report.json' : 'summary.json'), JSON.stringify(summary, null, 1))

  if (opt.record) {
    const today = new Date().toISOString().slice(0, 10)
    let added = 0
    for (const r of results) for (const it of r.newFails) {
      if (/^TIMEOUT|^exit \d/.test(it) || r.status === 'FLAKY') continue
      // the label only — the evidence after the two-space gap moves run to run
      const label = it.split(/\s{2,}/)[0].slice(0, 160)
      KNOWN.failures.push({ check: r.name, pattern: '^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), note: 'recorded by run-checks --record-known — say why', since: today })
      added++
    }
    fs.writeFileSync(KNOWN_FILE, JSON.stringify(KNOWN, null, 1) + '\n')
    if (!opt.json) console.log(`recorded ${added} failure(s) into scripts/known-failures.json — edit the notes`)
  }

  if (opt.json) console.log(JSON.stringify(summary, null, 1))
  else {
    console.log(`\n${'check'.padEnd(24)} ${'status'.padEnd(7)} ${'time'.padStart(6)}  result`)
    for (const r of results) console.log(`${r.name.padEnd(24)} ${badge(r.status)} ${fmt(r.secs).padStart(6)}  ${counts(r)}`)
    for (const r of results) {
      if (r.newFails.length && r.status !== 'FLAKY') { console.log(`\nNEW  ${r.name}  (${r.log})`); for (const f of r.newFails.slice(0, 12)) console.log('     ✗ ' + f.slice(0, 240)); if (r.newFails.length > 12) console.log(`     … ${r.newFails.length - 12} more`); if ((MANIFEST.checks[r.name] || {}).loadSensitive) console.log('     (load-sensitive: it failed under load in the baseline and passed on a quieter rerun — run it alone before believing this)') }
      if (r.status === 'FLAKY') { console.log(`\nFLAKY ${r.name}  first try failed, the retry passed:`); for (const f of r.firstTry.newFails.slice(0, 6)) console.log('     ~ ' + f.slice(0, 240)) }
      if (r.knownFails.length) { console.log(`\nKNOWN ${r.name}`); for (const f of r.knownFails) console.log(`     · ${f.item.slice(0, 200)}${f.note ? '  — ' + f.note : ''}`) }
      if (r.knownGone.length) { console.log(`\nFIXED? ${r.name}: known failure(s) not seen this run — prune scripts/known-failures.json if it stays gone:`); for (const g of r.knownGone) console.log('     + ' + g) }
    }
    console.log(`\n${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')} — wall ${fmt(wall)} (${fmt(summary.serialSec)} of check time on ${jobs} job(s)); logs + summary in ${OUT}`)
  }
  process.exit(results.some(r => r.status === 'NEW' || r.status === 'TIMEOUT') ? 1 : 0)
}
