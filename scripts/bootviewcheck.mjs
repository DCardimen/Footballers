// Dev check (v140 THE BOOT CANNOT TAKE THE REST OF THE FILE WITH IT).
//
// The career app restores the saved view and DRAWS it from the top level of its own script block,
// hundreds of lines above the end of it. So a screen that throws while being restored does not just
// fail to draw — it aborts the rest of that block, and everything still to be assigned down there
// (`window.__GRIDIRON_AUDIT__`, the v137 vault glue, the patch layer) never exists. The game dies on
// the splash, and because the save still holds that view it dies there on EVERY reload, for good.
//
// That is exactly how a save sitting on either career-end screen bricked from v137 to v139: `ms`
// and `no` put `vaultPayBtnV137(e)` in their markup, and it was a `window.x = …` assignment 600
// lines BELOW them, so it did not exist yet. "ERROR: Uncaught ReferenceError: vaultPayBtnV137 is
// not defined", on the splash, forever.
//
// Asserts, for every view a save can hold: the page comes back with no page error, the audit hook
// exists (so the block ran to the end), the vault glue is callable, and the app is on a screen you
// can play from. Also asserts the two shapes of the fix directly — the glue is HOISTED, and a boot
// render that throws is caught and retried rather than taking the file down.
//
//   node scripts/bootviewcheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { pageSource } from './lib/layout.mjs'   // v149 A: the served page + the src/ files it names
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const U = (q) => url + (url.includes('?') ? '&' : '?') + 'stayStale' + (q || '')

// every view the app persists, plus the two career-end screens that did the bricking (v146 B: and
// `club`, the DFL offers screen — with no offers in the save it must fall back to the hub)
const VIEWS = ['hub', 'season', 'training', 'shop', 'result', 'gameover', 'win', 'settings', 'live', 'event', 'life', 'sim', 'highscore', 'daily', 'club']
// `highscore` and `daily` are the arcade screens; they draw off their own state, which a seeded
// career save does not carry, so they legitimately come back empty here. The invariant that matters
// for every view is the one above them: the block ran to the end and the page is not dead.
const MUST_DRAW = VIEWS.filter(v => v !== 'highscore' && v !== 'daily')

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message || String(e)))
await page.addInitScript(() => { Error.stackTraceLimit = 60 })
await page.goto(U(), { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(2500)

ok(await page.evaluate(() => typeof window.__GRIDIRON_AUDIT__ === 'object' && !!window.__GRIDIRON_AUDIT__), 'a cold boot runs the career block all the way to the audit hook')

// the fix, shape 1: the vault glue a rendered screen calls is a HOISTED declaration, not an
// assignment that a boot-time render can outrun
const src = await page.evaluate(pageSource)
ok(/function vaultPayBtnV137\s*\(/.test(src), 'vaultPayBtnV137 is a function DECLARATION — a screen drawn at boot cannot outrun it')
ok(!/window\.vaultPayBtnV137\s*=\s*(e|\()/.test(src), '…and is not defined by a bare assignment any more')
// the fix, shape 2: every top-level boot render is guarded
ok(!/(^|[;}])\s*mc\(\)\s*;/.test(src) && /safeBootV140\(/.test(src), 'the boot renders go through safeBootV140, which catches and retries instead of aborting the block')
const guards = (src.match(/safeBootV140\(function/g) || []).length
ok(guards >= 3, 'all three top-level boot renders are guarded', `${guards} guarded`)

const bad = [], dead = []
for (const view of VIEWS) {
  const p = await ctx.newPage()
  const e2 = []
  p.on('pageerror', e => e2.push(e.message || String(e)))
  await p.addInitScript(() => { Error.stackTraceLimit = 60 })
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 40000 })
  await p.waitForTimeout(2200)
  // write a real save on that view, through the game's own storage, then come back to it cold
  const seeded = await p.evaluate((v) => {
    try {
      const A = window.__GRIDIRON_AUDIT__, S = A.getState()
      S.player = A.newPlayer(); S.player.pos = 'RB'; S.player.level = 4; S.player.totalSeasons = 6
      S.player.career = [{ level: 'Varsity', ovr: 40, age: 18 }]
      S.view = v
      window.GridironStorage.save(S)
      return true
    } catch (err) { return String(err) }
  }, view)
  e2.length = 0
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 40000 })
  await p.waitForTimeout(3500)
  const st = await p.evaluate(() => ({
    audit: typeof window.__GRIDIRON_AUDIT__, glue: typeof window.vaultPayBtnV137,
    view: (() => { try { return String(window.__GRIDIRON_AUDIT__.getState().view || '') } catch (e) { return '' } })(),
    alive: !!(document.getElementById('screen') && document.getElementById('screen').innerText.trim().length > 8) || !!document.getElementById('rib-main-menu-v2'),
    splash: (() => { const b = document.querySelector('#splash .splash-title b'); return b ? (b.textContent || '') : '' })(),
  }))
  const whole = seeded === true && !e2.length && st.audit === 'object' && st.glue === 'function' && !/^ERROR/.test(st.splash)
  if (!whole) bad.push(`${view}: ${JSON.stringify({ seeded, errs: e2.slice(0, 1), ...st })}`)
  if (whole && MUST_DRAW.indexOf(view) >= 0 && !st.alive) dead.push(`${view}: drew nothing`)
  await p.close()
}
ok(!bad.length, `a save on any of the ${VIEWS.length} views comes back whole — no page error, the block run to its end, the vault glue callable`, bad.length ? '\n  ' + bad.join('\n  ') : `${VIEWS.length} views`)
ok(!dead.length, `and every one of the ${MUST_DRAW.length} career views lands on a screen you can use`, dead.length ? '\n  ' + dead.join('\n  ') : `${MUST_DRAW.length} views`)

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
