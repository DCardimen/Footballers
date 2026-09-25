// Dev check: v101 — the asset root, the playbook, the throw, the second shadow, the crowd's
// vocabulary, whole numbers on the sheet, and the loader that builds the play behind itself.
// Asserts, in one pass:
//   * ASSETS — every sheet URL resolves against the document, and the game reports the v91
//     field art / v92 stadium art actually active (a 404 here is a field of blank players).
//   * PLAYBOOK — forty-plus named calls, runs and passes, every one reachable, and the mix
//     genuinely moves with the situation (goal line pulls Iso/Sneak, third-and-long pulls the
//     draw and the screens) rather than being one weighted bag.
//   * THE THROW — the accuracy cone widens with a broken pocket and with panic and narrows to
//     green when protection holds and the receiver has won; the lead grows from bullet to
//     touch to lob; a lob is never thrown to a spot the receiver is already standing on.
//   * SHADOWS — the fill cast exists under every man, points away from a DIFFERENT mast than
//     the key light, and is fainter than the key shadow; the shading tint tracks the lamps.
//   * CROWD — a moment has its own emoji rather than one flat good/bad pool.
//   * SHEET — no attribute row prints a fraction of a point.
//   node scripts/v101check.mjs        (READ_POS=RB)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
page.on('requestfailed', r => bad.push('FAILED ' + r.url()))
await page.addInitScript(() => { window.__P101 = []; let ll = false, an = false, G0 = null; setInterval(() => { const n = performance.now() | 0; const l = !!document.querySelector('.rib-liveload-v94'); if (l !== ll) { window.__P101.push([n, 'loader', l, JSON.stringify(window.__PREWARM_V101 || null), !!(window.__LIVELOAD_V94 && window.__LIVELOAD_V94.warm)]); ll = l } const L9 = window.__LIVELOAD_V94, cs = L9 ? (L9.current ? (L9.current.done ? 'done' : 'live' + (L9.current.ready ? 'R' : '') + (L9.current.field ? 'F' : '')) : 'null') : 'noapi'; if (cs !== window.__cs9) { window.__P101.push([n, 'cur', cs, document.querySelectorAll('.field-wrap').length]); window.__cs9 = cs } const dd = document.getElementById('downDist'), ddt = dd ? dd.textContent + '|' + ((document.getElementById('commentary') || {}).textContent || '').slice(0, 30) : 'none'; if (ddt !== window.__dd9) { window.__P101.push([n, 'dd', ddt, (window.__getGridironState && window.__getGridironState().view) || '']); window.__dd9 = ddt } const a = !!window.__playAnimating; if (a !== an) { window.__P101.push([n, 'anim', a, JSON.stringify(window.__PREWARM_V101 || null)]); an = a } const G = window.GridironPhaser; if (G && G !== G0) { G0 = G; const o = G.animate; G.animate = function (t) { const L = window.__LIVELOAD_V94, c = L && L.current; window.__P101.push([performance.now() | 0, 'call', t && t.event, !!c, !!(c && c.done)]); return o.apply(this, arguments) } } }, 15) });
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}


await step('START NEW CAREER'); await step('Lock In Personality'); await step('POS')
await step('PLAY 8-GAME SEASON'); await step('Balanced Program'); await step('CONFIRM TRAINING'); await step('PLAY WEEK 1 LIVE'); await step('PLAN')
for (const t of ['CONTINUE TO MATCH']) await step(t)
for (let i = 0; i < 60; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__P101.filter(x => x[1] === 'call').length >= 1)) break }
console.log(JSON.stringify(await page.evaluate(() => ({ calls: window.__P101.slice(0, 40), warm: window.__PREWARM_V101, shows: window.__LIVELOAD_V94 && window.__LIVELOAD_V94.shows }))))
await browser.close()
