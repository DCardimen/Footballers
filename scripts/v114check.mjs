// Dev check: v114 THE SPLASH IS A FILM — the boot splash plays the title sting.
//
// The claims worth gating, in the order they have to be true:
//   0. the shipped file is a LOADING screen asset: `moov` before `mdat` (+faststart), or the
//      browser cannot show a frame until the last byte lands, and there is no point to any of
//      the rest of this. Read off the bytes, no browser involved.
//   1. it is asked for in the head's first breath (rel=preload) and by the document's own
//      <source>s, so the fetch starts before nine megabytes of page have been parsed.
//   2. it claims the stage: #splash.film, the v94 canvas put away, a first frame on screen.
//   3. it PLAYS: the playhead advances.
//   4. v116: it LOOPS. The end of the film is a seek back to the seam (6.5s, where the wordmark
//      has landed), not a stop — and it keeps playing from there, round after round, for as long
//      as the loading lasts. It never goes back to the black at zero.
//   5. the bar means something: determinate, monotonic, and 1 by the time the curtain drops.
//   6. the splash leaves with the menu behind it, once the intro has landed.
//   7. it can never strand the boot: ?noFilmV114 hands the stage back to the v94 chase.
//   8. prefers-reduced-motion: the film, stopped — its last frame as a still, nothing playing.
//
//   node scripts/v114check.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { GAME_URL } from './lib/env.mjs'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.SPLASH_URL || GAME_URL

// ---- 0. the asset itself: faststart, off the bytes
{
  const buf = readFileSync('public/rib_film_v116.mp4')
  const moov = buf.indexOf('moov'), mdat = buf.indexOf('mdat')
  ok(moov > 0 && mdat > 0 && moov < mdat,
    'the mp4 is +faststart — moov lands before mdat, so playback starts on the first bytes',
    `moov@${moov} mdat@${mdat}`)
  const mb = buf.length / 1048576
  ok(mb < 2, 'and it is small enough to BE the loading screen', mb.toFixed(2) + ' MB')
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })

async function boot(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, reducedMotion: opts.rm ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage(); const errs = [], media = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  page.on('request', r => { if (/rib_film_v116/.test(r.url())) media.push({ f: r.url().split('/').pop(), at: Date.now() }) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  // a warm-up load absorbs the one full reload vite sends the first client after index.html changed
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(1200); errs.length = 0; media.length = 0
  const t0 = Date.now()
  await page.goto(URL + (opts.q || ''), { waitUntil: 'commit', timeout: 30000 })
  return { page, ctx, errs, media, t0 }
}
const film = () => { const V = window.__V114, v = document.getElementById('splashFilm'), sp = document.getElementById('splash')
  return V ? { on: V.on, settled: V.settled, failed: V.failed, ended: V.ended, played: V.played, codec: V.codec,
    landed: V.landed, loops: V.loops, loopFrom: V.loopFrom,
    prog: V.progress, firstFrameMs: V.firstFrameMs, t: v ? v.currentTime : -1, dur: v ? v.duration : -1,
    paused: v ? v.paused : null, loop: v ? v.loop : null, poster: v ? v.getAttribute('poster') : null,
    film: sp ? sp.classList.contains('film') : 'gone', chase: sp ? sp.classList.contains('chase') : 'gone',
    canvas: sp ? getComputedStyle(document.getElementById('splashChase')).display : 'gone',
    fill: sp ? getComputedStyle(sp.querySelector('.splash-loader b')).transform : null } : null }
const scaleX = t => { if (!t || t === 'none') return t === 'none' ? 1 : 0; const m = t.match(/matrix\(([-\d.]+)/); return m ? +m[1] : 0 }
// "the download was called off" is a NETWORK state, not a currentSrc string: with a warm cache
// the element can latch currentSrc before stopLoad() runs, and load() does not always clear it.
// networkState 0 is NETWORK_EMPTY — nothing is loading — and no <source> children means nothing
// can start again. The cold case below proves the stronger claim: no bytes at all.
const settled = async (page, ms = 3000) => {
  let last = null
  for (let i = 0; i < ms / 100; i++) {
    last = await page.evaluate(() => { const v = document.getElementById('splashFilm'); return v ? { src: v.currentSrc || '', kids: v.children.length, net: v.networkState, preload: v.preload } : 'splash gone' })
    if (last === 'splash gone' || (last.kids === 0 && last.net === 0)) break
    await page.waitForTimeout(100)
  }
  return last
}
const quiet = r => r === 'splash gone' || (r && r.kids === 0 && r.net === 0)
const desc = r => r === 'splash gone' ? 'the splash had already left' : r ? `networkState=${r.net} sources=${r.kids} preload=${r.preload}` : 'no element'

/* A genuinely cold context — no warm-up load, so the film is not in the cache. The claim being
 * measured is narrower than "no request": the <source>s are in the document precisely so the
 * preload scanner starts the fetch before any script runs, which means a path that then refuses
 * the film cannot promise zero bytes — it can only promise it CALLS THE FETCH OFF. So what is
 * counted here is requests that FINISHED: an aborted transfer fails, a completed one does not. */
async function coldFetch(opts) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, reducedMotion: opts.rm ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage(); const started = [], finished = []
  const film = u => /rib_film_v116\.(mp4|webm)/.test(u)
  page.on('request', r => { if (film(r.url())) started.push(r.url().split('/').pop()) })
  page.on('requestfinished', r => { if (film(r.url())) finished.push(r.url().split('/').pop()) })
  await page.goto(URL + (opts.q || ''), { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(2500)
  await ctx.close()
  return { started, finished }
}

// ---- 1-6. the normal boot
{
  const { page, errs, media, t0 } = await boot()
  const head = await page.evaluate(() => ({
    preload: !!document.querySelector('link[rel=preload][as=video][href*=rib_film_v116]'),
    src: (document.getElementById('splashFilm') || {}).getAttribute ? document.getElementById('splashFilm').getAttribute('src') : null,
    inBody: document.getElementById('splash') === document.body.firstElementChild,
  }))
  ok(/rib_film_v116\.(mp4|webm)$/.test(head.src || ''), 'the picker set one source, beside the element', head.src)
  ok(head.inBody, 'and the splash is the first thing in the body, so that happens early')
  ok(!head.preload, 'with no <link rel=preload> — that fetch could not be called back on the paths that refuse the film')

  let s = null
  for (let i = 0; i < 90; i++) { s = await page.evaluate(film); if (s && s.settled) break; await page.waitForTimeout(100) }
  ok(s && s.on && !s.failed, 'the film claims the stage', s && `${s.codec} · first frame ${s.firstFrameMs}ms after boot`)
  ok(s && s.film && s.canvas === 'none', 'the v94 canvas is put away while it plays', s && `film=${s.film} canvas=${s.canvas}`)
  const src = await page.evaluate(() => document.getElementById('splashFilm').currentSrc || '')
  ok(/rib_film_v116\.(mp4|webm)$/.test(src), 'and it is playing a shipped file', src.split('/').pop())
  console.log('   (film requests this boot:', media.map(m => m.f).join(' ') || 'served from cache', ')')

  const t1 = await page.evaluate(() => document.getElementById('splashFilm').currentTime)
  await page.waitForTimeout(900)
  const t2 = await page.evaluate(() => document.getElementById('splashFilm').currentTime)
  ok(t2 > t1 + 0.4, 'it plays', `${t1.toFixed(2)}s -> ${t2.toFixed(2)}s`)
  await page.screenshot({ path: '_v114_playing.png' })

  // the bar: sampled all the way through, it only ever goes forward
  const bar = [scaleX(s && s.fill)]
  let landed = null
  for (let i = 0; i < 140; i++) {
    const r = await page.evaluate(film); if (!r) break
    bar.push(scaleX(r.fill)); if (r.landed) { landed = r; break }
    await page.waitForTimeout(100)
  }
  ok(!!landed, 'the intro lands on the wordmark — the seam the loop runs back to',
    landed && `${landed.t.toFixed(2)}s of ${landed.dur.toFixed(2)}s (seam ${landed.loopFrom}s)`)
  ok(!!landed && landed.loop === false, 'and the element is not natively looping — a native loop rewinds to the black',
    landed && `loop=${landed.loop}`)
  await page.screenshot({ path: '_v114_landed.png' })

  const drops = bar.filter((v, i) => i && v < bar[i - 1] - 0.001).length
  ok(drops === 0, 'the loading bar never goes backwards', bar.length + ' samples, ' + drops + ' drops')
  ok(bar[bar.length - 1] > 0.9, 'and it is full by the time the intro has landed', bar[bar.length - 1].toFixed(3))
  ok(bar.some(v => v > 0.15 && v < 0.85), 'it is a real fill, not a two-state flag',
    bar.filter((v, i) => i % 8 === 0).map(v => v.toFixed(2)).join(' '))

  let gone = false, goneAt = 0
  for (let i = 0; i < 80; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break } await page.waitForTimeout(100) }
  ok(gone, 'the splash leaves', goneAt + 'ms after boot')
  ok(goneAt > 3000, 'and not before the streak has finished landing', goneAt + 'ms')
  const menu = await page.evaluate(() => !!document.querySelector('#screen') && document.querySelector('#screen').innerHTML.length > 200)
  ok(menu, 'with the app rendered behind it')
  console.log('page errors (film):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}

// ---- 6b. v116 THE FILM LOOPS: held open, the film runs its length and goes back to the seam
{
  // the app's own knock is deferred, so the splash stays up past the end of the film and the
  // loop can be watched happening. Nothing else takes the splash down — the only path to
  // finish() on the film door is this knock — so this is a clean way to hold the curtain.
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(() => {
    let real = null
    Object.defineProperty(window, '__splashDoneV94', { configurable: true,
      get() { return real ? function () { setTimeout(real, 20000); return true } : undefined },
      set(v) { real = v } })
  })
  await page.goto(URL, { waitUntil: 'commit', timeout: 60000 })

  // watch the playhead all the way to the end and round again
  const trail = []
  let looped = null
  for (let i = 0; i < 300; i++) {
    const r = await page.evaluate(film)                 // null until the v114 block has run: keep waiting
    if (r && r.played) trail.push(+r.t.toFixed(2))
    if (r && r.loops >= 1) { looped = r; break }
    await page.waitForTimeout(100)
  }
  ok(!!looped, 'the film reaches its end and goes round again', looped && `loops=${looped.loops} after ${looped.dur.toFixed(2)}s`)
  const lo = looped ? looped.loopFrom : 6.5
  ok(!!looped && looped.t >= lo - 0.1 && looped.t < lo + 2.5,
    'it comes back to the SEAM, not to the black at zero', looped && `back at ${looped.t.toFixed(2)}s (seam ${lo}s)`)
  ok(!!looped && looped.paused === false, 'and it keeps playing through the seam', looped && `paused=${looped.paused}`)
  const now = () => page.evaluate(() => { const v = document.getElementById('splashFilm'); return v ? v.currentTime : -1 })
  const a = await now()
  await page.waitForTimeout(900)
  const b = await now()
  ok(b > a + 0.4, 'the second time round plays like the first', `${a.toFixed(2)}s -> ${b.toFixed(2)}s`)
  ok(trail.length > 2 && Math.min(...trail) < 1.5,
    'the loop is a TAIL — the first pass did show the whole film, lead-in and all',
    `first pass from ${Math.min(...trail).toFixed(2)}s`)
  const after = []
  for (let i = 0; i < 16; i++) { after.push(await now()); await page.waitForTimeout(100) }
  ok(Math.min(...after) >= lo - 0.2, 'and from here it never drops back to the black',
    `min ${Math.min(...after).toFixed(2)}s over ${after.length} samples`)
  await page.screenshot({ path: '_v116_loop.png' })
  console.log('page errors (loop):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await ctx.close()
}

// ---- 7. the film can never strand the boot
{
  const { page, errs, media, t0 } = await boot({ q: '?noFilmV114' })
  await page.waitForTimeout(1200)
  const s = await page.evaluate(film)
  ok(s && !s.on && s.failed, 'the film stands down when it is told to', s && `on=${s.on}`)
  ok(s && s.chase === true, 'and the v94 chase takes the stage back', s && `chase=${s.chase}`)
  const off = await settled(page)
  ok(quiet(off), 'and the download is called off, not just ignored', desc(off))
  let gone = false, goneAt = 0
  for (let i = 0; i < 90; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break } await page.waitForTimeout(100) }
  ok(gone, 'and the splash still leaves', goneAt + 'ms')
  console.log('page errors (no film):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}

// ---- 8. prefers-reduced-motion: the film, stopped
{
  const { page, errs, t0 } = await boot({ rm: true })
  await page.waitForTimeout(900)
  const s = await page.evaluate(film)
  ok(s && s.on && s.film, 'reduced motion: the film still owns the stage', s && `film=${s.film}`)
  ok(s && s.paused === true && s.t === 0, 'but nothing plays', s && `paused=${s.paused} t=${s.t}`)
  ok(s && /rib_film_v116\.jpg/.test(s.poster || ''), 'it shows the last frame as a still', s && s.poster)
  const rmSrc = await settled(page)
  ok(quiet(rmSrc), 'and nothing is left loading', desc(rmSrc))
  await page.screenshot({ path: '_v114_rm.png' })
  let gone = false, goneAt = 0
  for (let i = 0; i < 90; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break } await page.waitForTimeout(100) }
  ok(gone, 'reduced motion: the splash leaves promptly', goneAt + 'ms')
  console.log('page errors (reduced):', errs.length ? errs.slice(0, 6).join('\n') : 'NONE'); if (errs.length) fail++
  await page.context().close()
}

// ---- 9. cold: the paths that will not play the film do not pay for the whole of it
{
  const a = await coldFetch({ q: '?noFilmV114' })
  ok(a.finished.length === 0, 'cold + ?noFilmV114: the film transfer is called off, never completed',
    `started ${a.started.join(' ') || 'nothing'} · finished ${a.finished.join(' ') || 'nothing'}`)
  const b = await coldFetch({ rm: true })
  ok(b.finished.length === 0, 'cold + reduced motion: the film transfer is called off, never completed',
    `started ${b.started.join(' ') || 'nothing'} · finished ${b.finished.join(' ') || 'nothing'}`)
}

console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
