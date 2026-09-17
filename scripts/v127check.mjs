// Dev check (v127 DOOR TWO CAN LOAD ITS OWN FILM): the live game's loader plays the sting
// even when the boot splash never parked one.
//
// v115 made door two borrow the element door one loaded — one decoded film a session, no second
// request. Taking it is the FAST path, but it was the ONLY path: with nothing parked (the splash
// left before the film played, an earlier game still holding it, a reload putting a fresh document
// in front of a warm HTTP cache) door two fell silently back to the v94 chase for the rest of the
// session. That is the "the video isn't playing on the live loader" case.
//
// Asserts, with the park deliberately emptied before the field is reached:
//   * door two still shows the FILM, not the chase, and it built the element itself
//   * it gets the picture up fast, and starts at v116's seam like the borrowed one does
//   * the file comes out of the cache it is already in — the request is served, not re-downloaded
//   * on the way out the film it built is PARKED, so the next game takes the fast path
//   * and with the film off for a real reason (?noFilmV114) nothing is built and the chase runs
import { chromium } from 'playwright'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.SPLASH_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`

const loader = () => { const el = document.querySelector('.rib-liveload-v94'); if (!el) return null
  const v = el.querySelector('.rib-liveload-film-v115')
  const A = window.__LIVELOAD_V94 || {}
  return { film: el.classList.contains('film'), chase: el.classList.contains('chase'),
    t: v ? v.currentTime : -1, paused: v ? v.paused : null, loop: v ? v.loop : null,
    src: v ? (v.currentSrc || v.src || '').split('/').pop() : null,
    shown: v ? getComputedStyle(v).opacity : null,
    filmMs: A.lastFilmMs, own: A.lastFilmOwn, parked: !!(window.__V114 && window.__V114.parked),
    seam: (window.__V114 || {}).loopFrom } }

async function intoGame(q = '', beforeField) {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } })
  const page = await ctx.newPage(); const errs = [], filmReqs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL + q, { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
  await page.waitForTimeout(800)
  if (beforeField) await page.evaluate(beforeField)
  page.on('request', r => { if (/rib_film_v116\.(mp4|webm)/.test(r.url())) filmReqs.push(r.url().split('/').pop()) })
  async function step(t) {
    try {
      await page.evaluate(({ t, visSrc }) => {
        const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
        const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
        const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
          : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
        if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
      }, { t, visSrc: vis })
    } catch (e) {}
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
  }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON',
    'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  for (let i = 0; i < 4; i++) { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^continue$/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!hit) break; await page.waitForTimeout(700) }
  for (let i = 0, clicked = null; i < 60 && !clicked; i++) {
    clicked = await page.evaluate((visSrc) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const m = els.find(e => /Continue to Match/i.test(e.textContent || '')); if (m) { m.click(); return 'match' }
      const c = els.find(e => /^continue$/i.test((e.textContent || '').trim())); if (c) c.click(); return null }, vis)
    if (!clicked) await page.waitForTimeout(300)
  }
  return { page, ctx, errs, filmReqs }
}
async function reachLoader(q, before) {
  for (let a = 0; a < 2; a++) {
    const g = await intoGame(q, before)
    let seen = null
    for (let i = 0; i < 60; i++) { const r = await g.page.evaluate(loader); if (r) seen = r; if (r && r.film) break; await g.page.waitForTimeout(100) }
    // the .film class starts a .28s opacity transition: read it again once that has settled,
    // or the picture is reported at whatever fraction the fade happened to be on
    if (seen && seen.film) { await g.page.waitForTimeout(420); const r2 = await g.page.evaluate(loader); if (r2) seen = r2 }
    if (seen) return { ...g, seen }
    console.log('   (the walk did not reach the live game; retrying)')
    await g.ctx.close()
  }
  return null
}

// ---- 1. nothing parked: door two has to build its own ----
const EMPTY = () => { try { window.__V114.parked = null } catch (e) {} }
const A = await reachLoader('', EMPTY)
ok(!!A, 'the walk reaches a live game with the park emptied')
if (A) {
  console.log('door two (nothing parked):', JSON.stringify(A.seen))
  ok(A.seen.film && !A.seen.chase, 'door two still plays the FILM, not the chase', `film=${A.seen.film} chase=${A.seen.chase}`)
  ok(A.seen.own === true, 'and it built that element itself, because there was none to borrow', `own=${A.seen.own}`)
  ok(A.seen.shown === '1', 'the picture is actually on screen', `opacity=${A.seen.shown}`)
  ok(A.seen.filmMs != null && A.seen.filmMs < 2600, 'it gets the picture up inside its audition', `${A.seen.filmMs}ms`)
  ok(A.seen.t >= A.seen.seam - .05, 'and starts at v116’s seam, like the borrowed one', `${A.seen.t?.toFixed(2)}s (seam ${A.seen.seam}s)`)
  ok(A.seen.loop === false, 'still not natively looping — v116 rewinds to the seam by hand', `loop=${A.seen.loop}`)
  ok(/rib_film_v116\.(mp4|webm)/.test(A.seen.src || ''), 'playing the same file door one played', A.seen.src)
  // served from the cache it is already in: at most one request, and a 200-from-cache is fine
  ok(A.filmReqs.length <= 1, 'and it costs at most one request, into a cache door one already filled', JSON.stringify(A.filmReqs))
  // on the way out it is parked, so the NEXT game takes the fast path
  await A.page.waitForTimeout(2500)
  for (let i = 0; i < 80; i++) { const gone = await A.page.evaluate(() => !document.querySelector('.rib-liveload-v94')); if (gone) break; await A.page.waitForTimeout(150) }
  await A.page.waitForTimeout(600)
  const parked = await A.page.evaluate(() => ({ parked: !!(window.__V114 && window.__V114.parked), vids: document.querySelectorAll('video').length }))
  console.log('after the door closed:', JSON.stringify(parked))
  ok(parked.parked === true, 'the film it built is PARKED on the way out — the next game gets the fast path', JSON.stringify(parked))
  ok(parked.vids === 0, 'and nothing is left mounted and decoding', `videos=${parked.vids}`)
  ok(A.errs.length === 0, 'no page errors', A.errs.join(' | ') || 'none')
  await A.ctx.close()
}

// ---- 2. the film is off for a real reason: build nothing ----
const B = await reachLoader('?noFilmV114', EMPTY)
ok(!!B, '?noFilmV114: the walk reaches a live game')
if (B) {
  console.log('door two (film off):', JSON.stringify(B.seen))
  ok(!B.seen.film, 'with the film switched off, door two builds nothing and the v94 chase runs', `film=${B.seen.film} chase=${B.seen.chase}`)
  ok(B.filmReqs.length === 0, 'and it asks for no film at all', JSON.stringify(B.filmReqs))
  await B.ctx.close()
}

console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
