// Dev check: v115 THE FILM AT BOTH DOORS — the live game's loader plays the title sting too.
//
// Door two is not door one, and the differences are the whole point:
//   1. it plays the FILM over .field-wrap, not the v94 chase, and out of the cache — door one
//      asked for that exact URL at boot, so this mount adds no request;
//   2. it starts PAST the lead-in, so a door that may only be open for a second and a half shows
//      a picture on its first frame rather than a second of near-black;
//   3. it does NOT wait for the film. The door opens on the scene standing and the first play
//      being built; holding it for the whole 7.7s sting would put six seconds in front of every
//      game. The film simply plays for as long as the loader lives, and does not loop;
//   4. the matchup and the bar are still on top of it, and still say what they said;
//   5. ?noFilmV114 — and any browser where door one could not play the film — gets the v94 chase,
//      unchanged. That is splashcheck's case 4, which now boots with the flag.
//
//   node scripts/v115check.mjs
import { chromium } from 'playwright'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.SPLASH_URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })

const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`

async function intoGame(q = '') {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } })
  const page = await ctx.newPage(); const errs = [], filmReqs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL + q, { waitUntil: 'networkidle', timeout: 60000 })
  // the boot splash now runs a 7.7s film and sits at z-index 10050 over everything: clicking
  // before it leaves just hits the curtain, so wait it out rather than walking into it
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
  await page.waitForTimeout(800)
  // only count film requests made AFTER boot — door one's fetch is not door two's problem
  page.on('request', r => { if (/rib_splash_v114\.(mp4|webm)/.test(r.url())) filmReqs.push(r.url().split('/').pop()) })
  async function step(t) {
    let r = null
    try {
      r = await page.evaluate(({ t, visSrc }) => {
        const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
        const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
        let el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
          : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
        if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null
      }, { t, visSrc: vis })
    } catch (e) { r = 'ERR ' + e.message }
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
    return r
  }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON',
    'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^continue$/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!hit) break; await page.waitForTimeout(700) } }
  await dismiss()
  for (let i = 0, clicked = null; i < 60 && !clicked; i++) {
    clicked = await page.evaluate((visSrc) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const m = els.find(e => /Continue to Match/i.test(e.textContent || '')); if (m) { m.click(); return 'match' }
      const c = els.find(e => /^continue$/i.test((e.textContent || '').trim())); if (c) c.click(); return null }, vis)
    if (!clicked) await page.waitForTimeout(300)
  }
  return { page, ctx, errs, filmReqs, dismiss }
}

const loader = () => { const el = document.querySelector('.rib-liveload-v94'); if (!el) return null
  const v = el.querySelector('.rib-liveload-film-v115'), cv = el.querySelector('canvas')
  return { film: el.classList.contains('film'), chase: el.classList.contains('chase'), inWrap: !!el.closest('.field-wrap'),
    cap: (el.querySelector('.rib-liveload-cap-v94 b') || {}).textContent, sub: (el.querySelector('.rib-liveload-cap-v94 span') || {}).textContent,
    bar: !!el.querySelector('.rib-liveload-bar-v94 i'),
    t: v ? v.currentTime : -1, dur: v ? v.duration : -1, paused: v ? v.paused : null, loop: v ? v.loop : null,
    src: v ? (v.currentSrc || '').split('/').pop() : null, shown: v ? getComputedStyle(v).opacity : null,
    cvShown: cv ? getComputedStyle(cv).display : null, shows: window.__LIVELOAD_V94.shows } }

/* The click-through into a live game is the flaky part of this check, not the film: the pregame
 * wizard and the story rolls vary, and a walk that never reaches the field would otherwise report
 * ten false failures. So reaching the loader is its own assertion, retried once, and everything
 * below it only runs once we are actually there. */
async function reachLoader(q) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const g = await intoGame(q)
    let seen = null
    // settle on the film if it is coming — breaking on whichever class lands first would report
    // the chase mounting for a beat as the final answer
    for (let i = 0; i < 60; i++) { const r = await g.page.evaluate(loader); if (r) seen = r; if (r && r.film) break; await g.page.waitForTimeout(100) }
    if (seen) return { ...g, seen }
    console.log('   (the walk did not reach the live game; retrying)')
    await g.page.context().close()
  }
  return null
}

// ---- the film at door two
{
  const got = await reachLoader()
  ok(!!got, 'the walk reaches a live game and the loader mounts')
  if (!got) { console.log(JSON.stringify({ pass, fail })); await browser.close(); process.exit(1) }
  const { page, errs, filmReqs, dismiss, seen } = got
  ok(!!seen && seen.inWrap, 'the loader still mounts over the field', seen && JSON.stringify({ film: seen.film, chase: seen.chase }))
  ok(!!seen && seen.film && seen.shown !== '0', 'and it is the FILM, not the chase', seen && `film=${seen.film} chase=${seen.chase} opacity=${seen.shown}`)
  ok(!!seen && seen.cvShown === 'none', 'the chase canvas is put away', seen && `canvas display=${seen.cvShown}`)
  ok(!!seen && /rib_splash_v114\.(mp4|webm)(#.*)?$/.test(seen.src || ''), 'playing the same file door one played', seen && seen.src)
  ok(filmReqs.length === 0, 'straight out of the cache — no new request for it', filmReqs.join(' ') || 'none')
  ok(!!seen && seen.t > 0.8, 'it starts past the black lead-in, so the first frame shown is a picture', seen && seen.t.toFixed(2) + 's')
  ok(!!seen && seen.loop === false, 'it does not loop', seen && `loop=${seen.loop}`)
  ok(!!seen && /vs/i.test(seen.cap || ''), 'the matchup is still named over it', seen && seen.cap)
  ok(!!seen && seen.bar, 'and the bar is still there')
  try { await page.locator('.rib-liveload-v94').screenshot({ path: '_v115_live.png' }) } catch (e) { await page.screenshot({ path: '_v115_live.png' }) }

  await dismiss()
  const t1 = Date.now(); let gone = false, sceneUp = false
  for (let i = 0; i < 140; i++) {
    const r = await page.evaluate(() => ({ gone: !document.querySelector('.rib-liveload-v94'), scene: !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) }))
    sceneUp = sceneUp || r.scene; if (r.gone) { gone = true; break }; await page.waitForTimeout(100)
  }
  const openMs = Date.now() - t1
  ok(gone, 'the door still opens on the scene, not on the film', openMs + 'ms')
  ok(sceneUp, 'the broadcast came up under it')
  ok(gone && openMs < 7700, 'and it did NOT wait out the 7.7s sting', openMs + 'ms')
  const after = await page.evaluate(() => ({ el: !!document.querySelector('.rib-liveload-v94'), vids: document.querySelectorAll('.rib-liveload-film-v115').length }))
  ok(!after.el && after.vids === 0, 'the loader and its video are gone, no decoder left running', JSON.stringify(after))
  const again = await page.evaluate(() => window.__LIVELOAD_V94.shows)
  ok(again === 1, 'it showed once for the game', again)
  console.log('page errors (film):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}

// ---- the fallback: no film at door one means no film at door two either
{
  const got = await reachLoader('?noFilmV114')
  ok(!!got, '?noFilmV114: the walk reaches a live game')
  if (!got) { console.log(JSON.stringify({ pass, fail })); await browser.close(); process.exit(1) }
  const { page, errs, seen } = got
  ok(!!seen && seen.chase && !seen.film, '?noFilmV114: the v94 chase has door two, exactly as before', seen && `chase=${seen.chase} film=${seen.film}`)
  ok(!!seen && seen.cvShown !== 'none', 'its canvas is the thing on screen', seen && `canvas display=${seen.cvShown}`)
  let gone = false
  for (let i = 0; i < 140; i++) { gone = await page.evaluate(() => !document.querySelector('.rib-liveload-v94')); if (gone) break; await page.waitForTimeout(100) }
  ok(gone, 'and the door still opens')
  console.log('page errors (no film):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}

console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
