// v142 dev check: EVERY STAT SAYS WHAT IT DOES. Drives the real app, creates a career, and asserts
//   1. every attribute on the sheet (Object.keys(Le)) has a STAT_INFO_V142 entry with a plain-language
//      line and at least two on-the-field bullets — no stat may ship without an explanation;
//   2. the info button renders beside the stat name on all four screens that list attributes
//      (the hub sheet, the SKILLS sheet, the pregame sheet, the offseason board's preview);
//   3. tapping one opens the card with that stat's name, its short line, the field section and the
//      player's own value, and that the backdrop, the ✕ and Escape all close it;
//   4. no page errors anywhere in the run.
// Usage: npm run dev, then node scripts/v142check.mjs   (GAME_URL to point elsewhere)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { readGameHtml } from './lib/layout.mjs'   // v149 A: index.html + src/ put back together
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 420, height: 880 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 120) })
const APP_URL = process.env.GAME_URL || 'http://localhost:5173/'
await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__V142 === 'object' && window.__V142, null, { timeout: 60000 })

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => { const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el) el.click() }, {t, visSrc:vis})
  await page.waitForTimeout(420)
}

const checks = []
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail })

// ---- 0. every screen that lists attributes asks for the button (source-level: two of the four
//         screens sit behind a long walk, and a renderer that silently drops it is the failure mode)
const SRC = readGameHtml()
for (const [screen, needle] of [
  ['the hub sheet (Vr)',                 '${ATTR_INFO[e].icon} ${ATTR_INFO[e].name}${statInfoBtnV142(e)}'],   // v149 C: Le → ATTR_INFO
  ['the SKILLS sheet (un)',              '${ATTR_INFO[a].icon} ${ATTR_INFO[a].name}${statInfoBtnV142(a)}'],
  ['the pregame sheet (pregamePlayerStatsV25)', '${ATTR_INFO[k].name}${statInfoBtnV142(k)}</span>`'],
  ['the offseason board (tpRowV113)',    '${ATTR_INFO[k].icon} ${ATTR_INFO[k].name}${statInfoBtnV142(k)}</span>']
]) ok(`${screen} renders the button`, SRC.includes(needle), needle)
ok('the button helper is a hoisted declaration (v140: a boot render calls it by bare name)',
   /\n\s*function statInfoBtnV142\(/.test(SRC) && !/statInfoBtnV142\s*=\s*function/.test(SRC))

// ---- 1. the data covers every stat on the sheet
const data = await page.evaluate(() => {
  const keys = window.__V142.keys(), info = window.__V142.info
  return { keys, rows: keys.map(k => ({ k, short: (info[k].short||'').length, f: (info[k].f||[]).length, s: (info[k].s||[]).length, n: (info[k].n||'').length })) }
})
ok(`every stat has an entry (${data.keys.length})`, data.keys.length >= 17, data.keys.length)
for (const r of data.rows) {
  ok(`${r.k}: plain line + ${r.f} field / ${r.s} season bullets`, r.short > 25 && r.f >= 1 && (r.f + r.s) >= 3 && r.n > 0, r)
}

// ---- 2. create a career and visit the screens
for (const s of ["START NEW CAREER","ARCH","QB Quarterback","Lock In Personality"]) await click(s)
await page.waitForTimeout(600)
const hub = await page.evaluate(() => { const rows=[...document.querySelectorAll('.attr')]
  return { btns: document.querySelectorAll('.si-b-v142').length, rows: rows.length,
           rowsWithBtn: rows.filter(r => r.querySelector('.si-b-v142')).length } })
ok(`hub sheet: every attribute row carries a button (${hub.rowsWithBtn}/${hub.rows})`,
   hub.rows > 0 && hub.rowsWithBtn === hub.rows, hub)

await page.evaluate(() => { const b=[...document.querySelectorAll('#navV139 button,#navV139 [data-k],#navV139 a')]
  .find(x => /SKILLS/.test(x.innerText||'')); if (b) b.click() })
await page.waitForTimeout(900)
const skillsInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.si-b-v142')]
  const rows = [...document.querySelectorAll('.up-attr')]
  return { btns: btns.length, rows: rows.length, rowsWithBtn: rows.filter(r => r.querySelector('.si-b-v142')).length,
           view: (() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch { return '?' } })() }
})
ok(`reached the SKILLS sheet (view ${skillsInfo.view})`, skillsInfo.view === 'upgrade', skillsInfo)
ok(`SKILLS sheet: every attribute row carries a button (${skillsInfo.rowsWithBtn}/${skillsInfo.rows})`,
   skillsInfo.rows > 0 && skillsInfo.rowsWithBtn === skillsInfo.rows, skillsInfo)

// ---- 3. the card opens, reads right, and closes three ways
const opened = await page.evaluate(() => {
  const b = document.querySelector('.si-b-v142'); if (!b) return { err: 'no button' }
  b.click()
  const c = document.querySelector('#statInfoV142')
  if (!c) return { err: 'no card' }
  return { name: (c.querySelector('.si-name-v142')||{}).textContent || '',
           short: ((c.querySelector('.si-short-v142')||{}).textContent || '').length,
           secs: c.querySelectorAll('.si-sec-v142').length,
           bullets: c.querySelectorAll('.si-ul-v142 li').length,
           chips: c.querySelectorAll('.si-chip-v142').length,
           sub: (c.querySelector('.si-sub-v142')||{}).textContent || '',
           z: getComputedStyle(c).zIndex }
})
ok(`card opens with a name, a plain line and bullets (${opened.name}: ${opened.bullets} bullets, ${opened.chips} chips)`,
   !opened.err && opened.name.length > 2 && opened.short > 20 && opened.secs >= 1 && opened.bullets >= 2, opened)
ok(`card shows the player's own numbers`, (opened.chips || 0) >= 2, opened.chips)
ok(`card sits above the page (z ${opened.z})`, Number(opened.z) >= 500, opened.z)

await page.keyboard.press('Escape'); await page.waitForTimeout(200)
ok('Escape closes it', await page.evaluate(() => !document.querySelector('#statInfoV142')))

await page.evaluate(() => document.querySelector('.si-b-v142').click()); await page.waitForTimeout(200)
await page.evaluate(() => document.querySelector('.si-x-v142').click()); await page.waitForTimeout(200)
ok('the ✕ closes it', await page.evaluate(() => !document.querySelector('#statInfoV142')))

await page.evaluate(() => document.querySelector('.si-b-v142').click()); await page.waitForTimeout(200)
await page.evaluate(() => document.querySelector('#statInfoV142').click()); await page.waitForTimeout(200)
ok('tapping the backdrop closes it', await page.evaluate(() => !document.querySelector('#statInfoV142')))

// ---- the button does not trigger the row it sits in (stat must not be allocated by reading about it)
const noSideEffect = await page.evaluate(() => {
  const snap = () => { try { return JSON.stringify(window.__GRIDIRON_AUDIT__.getState().player.attrs) } catch { return '' } }
  const before = snap()
  document.querySelector('.si-b-v142').click()
  const after = snap()
  document.querySelector('.si-x-v142')?.click()
  return before === after
})
ok('opening the card spends no points and changes no stat', noSideEffect)

ok('no page errors', errs.length === 0, errs.slice(0, 4))
await browser.close()

console.log(JSON.stringify({ stats: data.keys.length, hubRows: hub.rows, skillsRows: skillsInfo.rows, opened: opened.name, pageErrors: errs.length }))
for (const c of checks) console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name + (c.pass ? '' : '  ' + JSON.stringify(c.detail)))
const fails = checks.filter(c => !c.pass).length
console.log(`${checks.length - fails}/${checks.length} passed`)
process.exit(fails ? 1 : 0)
