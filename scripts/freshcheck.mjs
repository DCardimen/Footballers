// Dev check: v106.1 — THE PAGE KNOWS WHEN IT IS STALE. GitHub Pages lets a browser keep index.html
// for ten minutes, and every menu file and kit mask is stamped by that page, so a deploy used to be
// invisible until a hard refresh. This assembles the real Pages site (scripts/assemble-pages.mjs)
// as build A, serves it from a throwaway static server with Pages-like caching headers, and proves:
//   * page A over a site that says A: the menu mounts, the probe reads "fresh", no reload;
//   * page A over a site whose rib-build.json says B (a deploy the browser has not seen): the page
//     reloads exactly ONCE and then, still being served A, settles ("gave-up") — no loop;
//   * a page with no build meta (vite dev, a file: build) never asks;
//   * ?stayStale holds the reload so the state can be looked at.
//   node scripts/freshcheck.mjs        (no dev server needed)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

const site = fs.mkdtempSync(path.join(os.tmpdir(), 'rib-fresh-'))
execFileSync('node', ['scripts/assemble-pages.mjs', site], { env: { ...process.env, RIB_BUILD_VERSION: 'buildA' }, stdio: 'pipe' })
const indexA = fs.readFileSync(path.join(site, 'index.html'), 'utf8')
ok(indexA.includes('<meta name="rib-build" content="buildA">'), 'the assembled page carries the build it was published with')

// a static server with GitHub Pages' caching (max-age=600) that counts what the browser asks for
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const served = { version: 'buildA', stripMeta: false, hits: {} }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'
  served.hits[p] = (served.hits[p] || 0) + 1
  if (p === '/rib-build.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=600' }); return res.end(JSON.stringify({ version: served.version })) }
  const f = path.join(site, p); if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end() }
  let body = fs.readFileSync(f)
  if (p === '/index.html' && served.stripMeta) body = Buffer.from(body.toString().replace(/<meta name="rib-build"[^>]*>/, ''))
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'max-age=600' }); res.end(body)
})
await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL_ = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })

async function visit(label, { version, stripMeta = false, query = '' }) {
  served.version = version; served.stripMeta = stripMeta; served.hits = {}
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } }); const page = await ctx.newPage()
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++ })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL_ + query, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  // the probe answers within a round trip; a reload lands as a second navigation
  await page.waitForFunction(() => window.__RIB_FRESH_V106 && !/^(idle|asked|reloading)$/.test(window.__RIB_FRESH_V106.state), null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const st = await page.evaluate(() => ({ ...window.__RIB_FRESH_V106, menu: !!document.querySelector('#rib-main-menu-v2 .rib9-shell'), stamp: (document.querySelector('meta[name="rib-menu-build"]') || {}).content || '' }))
  await ctx.close()
  console.log(`   ${label}: state=${st.state} mine=${st.mine} served=${st.served} navs=${navs} index hits=${served.hits['/index.html'] || 0} json hits=${served.hits['/rib-build.json'] || 0} errors=${errs.length}`)
  return { ...st, navs, hits: served.hits, errs }
}

// 1. the site is the page's own build
let r = await visit('same build', { version: 'buildA' })
ok(r.state === 'fresh' && r.navs === 1 && r.hits['/index.html'] === 1, 'page A over a site that says A: the probe reads fresh and nothing reloads', `state ${r.state}, ${r.navs} navigation(s)`)
ok(r.menu && r.errs.length === 0, 'and the menu is mounted with no page errors')
// 2. the site has moved on: one reload, then settle
r = await visit('newer site', { version: 'buildB' })
ok(r.navs === 2 && r.hits['/index.html'] === 3, 'page A over a site that says B: the page reloads exactly once (the fresh page is fetched into the cache first, so the index is asked three times: load, fetch, reload)', `${r.navs} navigations, index asked ${r.hits['/index.html']} time(s)`)
ok(r.state === 'gave-up', 'still handed page A after the reload, it settles instead of looping', `state ${r.state}`)
ok(r.hits['/rib-build.json'] === 2, 'the build file was read past the cache on both loads', `${r.hits['/rib-build.json']} reads`)
ok(r.menu && r.errs.length === 0, 'the menu is mounted after the reload with no page errors')
// 3. no meta (vite dev, a file: build): never asks
r = await visit('no meta', { version: 'buildB', stripMeta: true })
ok(r.state === 'skipped' && r.navs === 1 && !r.hits['/rib-build.json'], 'a page without the build meta never asks and never reloads', `state ${r.state}`)
// 4. the look: ?stayStale holds the reload
r = await visit('held', { version: 'buildB', query: '?stayStale' })
ok(r.state === 'held' && r.navs === 1, '?stayStale holds the reload with the verdict readable on window.__RIB_FRESH_V106', `state ${r.state}`)

console.log(JSON.stringify({ pass, fail }))
await browser.close(); server.close(); fs.rmSync(site, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
