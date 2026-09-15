// Dev check: v115 THE FILM AT BOTH DOORS — the live game's loader plays the title sting too.
//
// Door two is not door one, and the differences are the whole point:
//   1. it plays the FILM over .field-wrap, not the v94 chase, and out of the cache — door one
//      asked for that exact URL at boot, so this mount adds no request;
//   2. it starts AT v116's SEAM — the point the film loops back to, where the wordmark has
//      finished landing — so a door that may only be open for a second and a half shows a
//      finished picture on its first frame rather than a second of near-black;
//   3. it does NOT wait for the film. The door opens on the scene standing and the first play
//      being built; holding it for the whole 14.5s sting would put twelve seconds in front of
//      every game. The film runs for as long as the loader lives, looping at the seam like
//      door one's, and the loader leaves on top of it wherever round it is;
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
  // the boot splash now runs a 14.5s film and sits at z-index 10050 over everything: clicking
  // before it leaves just hits the curtain, so wait it out rather than walking into it
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
  await page.waitForTimeout(800)
  // only count film requests made AFTER boot — door one's fetch is not door two's problem
  page.on('request', r => { if (/rib_film_v116\.(mp4|webm)/.test(r.url())) filmReqs.push(r.url().split('/').pop()) })
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
    bar: el.querySelector('.rib-liveload-bar-v94') ? getComputedStyle(el.querySelector('.rib-liveload-bar-v94')).display : 'absent',
    fit: v ? getComputedStyle(v).objectFit : null,
    box: (() => { const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height) })(),
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
  ok(!!seen && /rib_film_v116\.(mp4|webm)(#.*)?$/.test(seen.src || ''), 'playing the same file door one played', seen && seen.src)
  ok(filmReqs.length === 0, 'straight out of the cache — no new request for it', filmReqs.join(' ') || 'none')
  const seam = await page.evaluate(() => (window.__V114 && window.__V114.loopFrom) || 0)
  ok(seam > 0, 'v116 names a seam, and door two reads it from there', seam + 's')
  ok(!!seen && seen.t >= seam - 0.15, 'it starts AT the seam, so the first frame shown is the finished wordmark',
    seen && `${seen.t.toFixed(2)}s (seam ${seam}s)`)
  ok(!!seen && seen.loop === false, 'the element is not natively looping — v116 does the rewind by hand, to the seam',
    seen && `loop=${seen.loop}`)
  ok(!!seen && /vs/i.test(seen.cap || ''), 'the matchup is still named over it', seen && seen.cap)
  ok(!!seen && seen.fit === 'contain', 'the whole frame is shown — not cropped into the wordmark', seen && `object-fit: ${seen.fit}`)
  ok(!!seen && seen.bar === 'none', 'and the loading bar is gone from over it', seen && `bar display: ${seen.bar}`)
  // letterboxed, the picture is vertically centred — so the caption has to be clear of it, or it
  // sits straight on the wordmark
  const clear = await page.evaluate(() => { const el = document.querySelector('.rib-liveload-v94')
    const v = el.querySelector('.rib-liveload-film-v115'), c = el.querySelector('.rib-liveload-cap-v94')
    if (!v || !c) return null
    const b = el.getBoundingClientRect(), cr = c.getBoundingClientRect()
    // where the letterboxed picture actually sits inside the box
    const ar = (v.videoWidth || 16) / (v.videoHeight || 9)
    const pw = Math.min(b.width, b.height * ar), ph = pw / ar
    const top = b.top + (b.height - ph) / 2, bot = top + ph
    return { capTop: Math.round(cr.top), capBot: Math.round(cr.bottom), picTop: Math.round(top), picBot: Math.round(bot), boxBot: Math.round(b.bottom) } })
  ok(!!clear && clear.capTop >= clear.picBot - 2, 'the matchup sits clear of the picture, not on the wordmark',
    clear && `caption ${clear.capTop}-${clear.capBot}, picture ${clear.picTop}-${clear.picBot}`)

  // the hand-off, read off the CSS contract rather than raced against a 640ms window: a probe
  // wearing the same classes the loader wears on its way out must be pushing through, not dimming
  const out = await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'rib-liveload-v94 film gone'
    d.innerHTML = '<video class="rib-liveload-film-v115"></video><div class="rib-liveload-cap-v94"><b>X</b><span>Y</span></div>'
    const host = document.querySelector('.field-wrap') || document.body; host.appendChild(d)
    const v = d.querySelector('video'), c = d.querySelector('.rib-liveload-cap-v94')
    const r = { film: getComputedStyle(v).transform, filmOp: getComputedStyle(v).opacity,
      cap: getComputedStyle(c).transform, capOp: getComputedStyle(c).opacity,
      layer: getComputedStyle(d).transitionDuration, layerDelay: getComputedStyle(d).transitionDelay }
    d.remove(); return r
  })
  const scale = (t) => { const m = (t || '').match(/matrix\(([-\d.]+)/); return m ? +m[1] : 1 }
  ok(scale(out.film) > 1.02 && out.filmOp === '1', 'on the way out the film pushes THROUGH — it swells and keeps its face',
    `scale ${scale(out.film).toFixed(3)}, opacity ${out.filmOp}`)
  ok(out.capOp === '0' && /matrix/.test(out.cap), 'the caption drops away ahead of it', out.cap)
  ok(/0\.12s|120ms/.test(out.layer || '') === false && parseFloat(out.layerDelay) >= 0.1,
    'and the layer itself goes LAST, so the wordmark is the last thing off the screen',
    `layer fades over ${out.layer} after ${out.layerDelay}`)
  try { await page.locator('.rib-liveload-v94').screenshot({ path: '_v115_live.png' }) } catch (e) { await page.screenshot({ path: '_v115_live.png' }) }

  await dismiss()
  const t1 = Date.now(); let gone = false, sceneUp = false, sawGone = false, shots = 0, exitHadFilm = false
  for (let i = 0; i < 260; i++) {
    const r = await page.evaluate(() => { const el = document.querySelector('.rib-liveload-v94')
      return { gone: !el, leaving: !!(el && el.classList.contains('gone')), scene: !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length) } })
    sceneUp = sceneUp || r.scene; sawGone = sawGone || r.leaving
    if (r.leaving && process.env.V115_SHOTS && shots < 2) { await page.screenshot({ path: '_v115_exit_' + shots + '.png' }); shots++ }
    if (r.leaving && !exitHadFilm) exitHadFilm = await page.evaluate(() => { const e = document.querySelector('.rib-liveload-v94'); const v = e && e.querySelector('.rib-liveload-film-v115')
      return !!(v && v.isConnected && getComputedStyle(v).opacity !== '0') })
    if (r.gone) { gone = true; if (process.env.V115_SHOTS) await page.screenshot({ path: '_v115_exit_done.png' }); break }; await page.waitForTimeout(50)
  }
  const openMs = Date.now() - t1
  ok(gone, 'the door still opens on the scene, not on the film', openMs + 'ms')
  ok(sceneUp, 'the broadcast came up under it')
  ok(gone && openMs < 7700, 'and it did NOT wait out the 14.5s sting', openMs + 'ms')
  ok(sawGone, 'the loader played that exit rather than being cut', sawGone ? 'saw .gone before it was removed' : 'never observed .gone')
  ok(exitHadFilm, 'and the film was still ON SCREEN through it, not yanked before the animation',
    exitHadFilm ? 'video still mounted and visible while leaving' : 'the layer faded empty')
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
