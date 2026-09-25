// Dev check: v112 A THE CHASE IS ALWAYS READY — the loading animation is warmed at boot and
// every loading scene after the first starts from memory.
//
// What it proves, in a real browser, on a genuinely cold profile (a fresh chromium launch is a
// fresh disk cache):
//   1. THE WARM. The v91 field sheet is requested in the first breath of the head — before the
//      stylesheets, long before v94's own <script> runs — and v94 ADOPTS that request instead of
//      issuing its own. The whole session makes exactly two requests for the sheet.
//   2. THE FIRST FRAME. Cold, the splash chase paints its first frame inside a tight budget of
//      navigation, and inside a tighter one of the v94 engine script executing.
//   3. THE CELLS. Every cell the chase can draw is cut and recoloured once, the moment the sheet
//      lands, into module scope — so no mount ever does that work again.
//   4. A SECOND SCENE. The live game's loader (the loading scene the player actually sees over and
//      over) mounts with the sheet already decoded (`cached`), starts inside a frame, and adds ZERO
//      network requests — counted with a request listener over the whole session.
//   5. IT ACTUALLY MOVES. The canvas is sampled twice: the pixels change, and the mount's own frame
//      counter climbs.
//   6. THE DOORS ARE UNCHANGED. __splashDoneV94() still opens the splash, the splash still holds
//      its minimum and still leaves, and __LIVELOAD_V94.whenClear still fires for the sim.
//   7. THE OLD PATH STILL WORKS. ?noWarmV112 puts the cold path back: still two requests, still a
//      chase, still a door.
//
//   GAME_URL=http://localhost:5201/index.html node scripts/v112Acheck.mjs
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { CHROME, gameUrl } from './lib/env.mjs'

// v114 put the title film on the boot splash, so the SPLASH assertions below — the ones that
// watch the chase paint its first frame and keep drawing — boot ?noFilmV114. What v112 A warms
// is the v91 sheet, and the sheet still feeds the chase on that fallback and, more to the point,
// door two: the live game's loader, which is the loading scene a player actually sees over and
// over, and which v114 does not touch. The warm itself is measured on the unmodified page.
const URL = gameUrl('index.html')
const CHASE_URL = URL + (URL.includes('?') ? '&' : '?') + 'noFilmV114'
const EXE = CHROME
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// the budgets, and why they are these numbers.
// The chase cannot paint before the engine script that owns it has run, so the honest budget is
// measured from there: DOOR_MS is how long the splash door may take from asking for a chase to
// painting one — with the sheet already decoded and every cell already cut that is a size() and a
// draw(), and it measured 52-107ms on this machine. COLD_MS is the absolute wall from navigation
// on a local server: the parser reaches v94 around 90-230ms and every byte of the sheet has landed
// before it does, so 700ms is a 3x margin over the ~180-225ms measured — it fails loudly if the
// warm ever stops being a warm. A second scene has nothing left to do at all: MOUNT_MS.
/* v150 B: the budgets are the quiet-machine numbers, and on a quiet machine they are applied exactly. When the suite runs at
 * --jobs 3-4 beside other work (1-minute load 15-45 on 4 cores) the same cold path takes several times as long because it
 * is waiting for a core; the budget then stretches by the load per core (scripts/lib/load.mjs — 1 when load <= cores, and
 * printed beside every budget). COLD_MS / DOOR_MS / MOUNT_MS pin a budget exactly; LOAD_SCALE=1 forces the strict ones. */
import { loadScale } from './lib/load.mjs'
const LS = loadScale()
const COLD_MS = Number(process.env.COLD_MS || Math.round(700 * LS))
const DOOR_MS = Number(process.env.DOOR_MS || Math.round(250 * LS))
const MOUNT_MS = Number(process.env.MOUNT_MS || Math.round(150 * LS))
console.log('load scale', LS, '→ budgets', { COLD_MS, DOOR_MS, MOUNT_MS })

const canvasMoved = (sel) => {   // sample the drawn pixels, not the element's existence
  const cv = document.querySelector(sel); if (!cv || !cv.width) return null
  const x = cv.getContext('2d'); if (!x) return null
  const d = x.getImageData(0, 0, cv.width, cv.height).data
  let sum = 0, ink = 0
  for (let i = 0; i < d.length; i += 64) { sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 2147483647; if (d[i + 3] > 20) ink++ }
  return { sum, ink }
}

async function fresh(opts = {}) {
  const browser = await chromium.launch({ executablePath: EXE })
  const ctx = await browser.newContext({ viewport: { width: opts.wide ? 520 : 420, height: 900 } })
  const page = await ctx.newPage()
  const errs = [], reqs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  page.on('request', r => { if (/rib_field_v91\.(png|json)/.test(r.url())) reqs.push(r.url().split('/').pop()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  return { browser, page, errs, reqs }
}
const A = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__V112_A || null)))

// ---- 1-3, 5, 6: the cold boot
let liveNote = ''
{
  const { browser, page, errs, reqs } = await fresh({ wide: true })
  await page.goto(CHASE_URL, { waitUntil: 'commit', timeout: 60000 })
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => window.__V112_A && window.__V112_A.firstFrameMs != null)) break; await page.waitForTimeout(25) }
  const a = await A(page)
  const net = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /rib_field_v91\.png/.test(r.name)).map(r => ({ s: Math.round(r.startTime), e: Math.round(r.responseEnd) }))[0])

  ok(!!a && a.warm === true, 'the head warmed the sheet', a && ('warm at ' + a.warmMs + 'ms'))
  ok(a && a.adopted === true, 'v94 adopted the warm instead of fetching again', a && ('engine ran at ' + a.engineMs + 'ms'))
  ok(net && net.s < a.engineMs, 'the sheet was on the wire before the v94 script ran', 'png sent @' + net.s + 'ms vs engine @' + a.engineMs + 'ms')
  // the decode CALLBACK can only be dispatched when the main thread lets it, and the inline bundle
  // below takes the main thread for a second — so the invariant the warm actually owns is the wire:
  // every byte of the sheet is in the browser before v94 asks for it
  ok(net && net.e <= a.engineMs, 'every byte of the sheet had landed before the v94 script ran', net && ('png done @' + net.e + 'ms vs engine @' + a.engineMs + 'ms'))
  ok(reqs.length === 2, 'exactly two requests for the sheet so far', reqs.join(' '))
  ok(a && a.firstFrameMs != null && a.firstFrameMs <= COLD_MS, 'COLD: the first animated frame is painted inside the budget', a && (a.firstFrameMs + 'ms <= ' + COLD_MS + 'ms'))
  const m0 = a && a.mounts[0]
  ok(m0 && m0.tag === 'splash' && m0.ms <= DOOR_MS, 'the splash door paints within the budget of opening', m0 && (m0.ms + 'ms <= ' + DOOR_MS + 'ms'))

  // it actually moves: the pixels change and the mount's own frames climb
  const p0 = await page.evaluate(canvasMoved, '#splashChase')
  await page.waitForTimeout(500)
  const p1 = await page.evaluate(canvasMoved, '#splashChase')
  ok(p0 && p1 && p0.ink > 0 && p1.ink > 0 && p0.sum !== p1.sum, 'the splash canvas is drawn and the picture changes', p0 && (p0.sum + ' -> ' + p1.sum))
  // the loop runs at frame rate once the boot compile lets go of the main thread (the megabytes of
  // inline bundle below are one long task the chase cannot outrun — see the stall printed after)
  let grew = 0
  for (let i = 0; i < 20; i++) {
    const b0 = await page.evaluate(() => window.__V112_A.mounts[0].frames)
    await page.waitForTimeout(500)
    const b1 = await page.evaluate(() => window.__V112_A.mounts[0].frames)
    grew = b1 - b0; if (grew > 15 / LS) break
    if (await page.evaluate(() => !document.getElementById('splash'))) break
  }
  ok(grew > 15 / LS, 'the mount keeps drawing frames at rate', grew + ' frames in 0.5s (> ' + (15 / LS).toFixed(1) + ' at load scale ' + LS + ')')
  const a1 = await A(page)
  ok(a1 && a1.cells >= 100, 'every cell the chase can draw is cut and recoloured once, up front', a1 && (a1.cells + ' cells, the run cycle in ' + a1.cellsMs + 'ms and the rest by ' + a1.cellsAllMs + 'ms'))
  console.log('     boot stall (the inline bundle compiling, not the chase):', a1.mounts[0].maxGapMs + 'ms at ' + a1.mounts[0].maxGapAt + 'ms')

  // the door is the old door
  ok(await page.evaluate(() => typeof window.__splashDoneV94 === 'function'), '__splashDoneV94 is still the door')
  let gone = false, goneAt = 0
  const t0 = Date.now()
  for (let i = 0; i < 160; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) { goneAt = Date.now() - t0; break } await page.waitForTimeout(100) }
  ok(gone, 'the splash still leaves', goneAt + 'ms after the sample began')
  ok(await page.evaluate(() => !!document.querySelector('#screen') && document.querySelector('#screen').innerHTML.length > 200), 'the app is rendered behind it')

  // the engine's OWN cost for a later scene, measured on an idle main thread: a third chase, asked
  // for and painting, with no fetch, no decode and no recolour left to do
  const synth = await page.evaluate(async () => {
    const cv = document.createElement('canvas')
    cv.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:200px'
    document.body.appendChild(cv)
    const t0 = performance.now()
    const c = window.__CHASE_V94.make(cv, { minMs: 100, captions: false }).start()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const out = { ms: Math.round(performance.now() - t0), frames: c.frames, ready: window.__CHASE_V94.ready }
    c.stop(); cv.remove(); return out
  })
  ok(synth.ready && synth.frames >= 1 && synth.ms <= MOUNT_MS, 'a later scene is a synchronous start: asked for and drawn inside the budget', synth.frames + ' frame(s) in ' + synth.ms + 'ms <= ' + MOUNT_MS + 'ms')
  ok(reqs.length === 2, 'and it still added no request for the sheet', 'session total: ' + reqs.length)


  // ---- 4: the SECOND loading scene, in the same session — the live game's loader
  const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
  async function step(t) {
    let r = null
    try {
      r = await page.evaluate(({ t, visSrc }) => {
        const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
        const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
        let el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
        if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) }
        return null
      }, { t, visSrc: vis })
    } catch (e) { r = 'ERR ' + e.message }
    console.log('  >>', t, '->', r)
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
  }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^continue$/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); if (b) { b.click(); return true } return false }); if (!hit) break; await page.waitForTimeout(700) } }
  await dismiss()
  let clicked = null
  for (let i = 0; i < 60 && !clicked; i++) {
    clicked = await page.evaluate((visSrc) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      const m = els.find(e => /Continue to Match/i.test(e.textContent || '')); if (m) { m.click(); return 'match' }
      const c = els.find(e => /^continue$/i.test((e.textContent || '').trim())); if (c) c.click(); return null
    }, vis)
    if (!clicked) await page.waitForTimeout(300)
  }
  console.log('  >> Continue to Match ->', clicked)
  // v132: door two draws no canvas any more — the loader is the sting's still with the film over it.
  // The v112 A record for this mount is stamped by the first PICTURE (still or film), so `firstFrame`
  // still answers "how long until the player saw something"; the motion is the film's own playhead.
  let live = null, lp0 = null, lp1 = null
  const picture = () => { const el = document.querySelector('.rib-liveload-v94'); if (!el) return null; const v = el.querySelector('video')
    return { still: el.classList.contains('still'), playing: el.classList.contains('playing'), layout: el.classList.contains('film'), canvas: !!el.querySelector('canvas'), t: v ? v.currentTime : -1, sum: v ? Math.round(v.currentTime * 1000) : (el.classList.contains('still') ? 1 : 0) } }
  // v150 B: wait for door two on game state for up to 60s, not 6 — the Phaser bundle compiles before it mounts, and at load
  // 30+ that alone outlasted the old poll (the mount was never seen and every door-two assertion failed with it)
  for (let i = 0, w0 = Date.now(); Date.now() - w0 < 60000; i++) {
    live = await page.evaluate(() => { const a = window.__V112_A; return a ? a.mounts.filter(m => m.tag === 'live')[0] || null : null })
    if (live && live.firstFrame != null) { lp0 = await page.evaluate(picture); break }
    await page.waitForTimeout(100)
  }
  for (let i = 0; i < 12 && lp0; i++) {   // sample it again while it is still up
    await page.waitForTimeout(250)
    lp1 = await page.evaluate(picture)
    if (!lp1 || lp1.sum !== lp0.sum) break
  }
  const cleared = await page.evaluate(() => new Promise(res => { const L = window.__LIVELOAD_V94; if (!L) return res('no loader'); const t = Date.now(); L.whenClear(() => res(Date.now() - t)) }))
  const after = await A(page)

  liveNote = JSON.stringify(live)
  ok(!!live, 'a SECOND loading scene mounted in the same session', liveNote)
  ok(live && live.cached === true, 'it found the sheet already decoded in memory', live && ('cached=' + live.cached))
  ok(live && live.reqsBefore === 2 && reqs.length === 2, 'it added ZERO network requests for the sheet', 'session total: ' + reqs.length + ' (' + reqs.join(' ') + ')')
  ok(live && live.firstFrame != null, 'it had a picture up with nothing left to load (v132: the sting\'s still, then the film)', live && (live.ms + 'ms from the door opening'))
  ok(lp0 && lp0.layout && !lp0.canvas, 'and that picture is the film loader, with no chase canvas built at this door', JSON.stringify(lp0))
  ok(lp0 && lp1 ? (lp1.playing ? lp0.sum !== lp1.sum : lp1.still) : true, 'its picture is alive (the playhead moves) or the still is holding it', lp0 && lp1 ? JSON.stringify({ a: lp0.sum, b: lp1.sum, playing: lp1.playing, still: lp1.still }) : 'loader already gone when sampled')
  ok(typeof cleared === 'number', '__LIVELOAD_V94.whenClear still opens for the sim', cleared + 'ms')
  // how long that mount then went WITHOUT a frame is not the chase's to answer: the career app
  // builds the scene and the first play on the same thread the moment the loader is up. Reported,
  // not asserted — the number to watch, and the next thing worth fixing, in someone else's region.
  const liveFinal = after.mounts.filter(m => m.tag === 'live')[0]
  console.log('     live loader: ' + (liveFinal ? liveFinal.frames + ' frames, starved ' + liveFinal.maxGapMs + 'ms by the scene + first-play build' : 'gone'))


  const real = errs.filter(e => !/favicon|manifest/i.test(e))
  console.log('page errors (cold + live):', real.length ? real.slice(0, 6).join('\n') : 'NONE'); if (real.length) fail++
  await browser.close()
}

// ---- 7: the old cold path still works
{
  const { browser, page, errs, reqs } = await fresh()
  await page.goto(URL + '?noWarmV112&noFilmV114', { waitUntil: 'commit', timeout: 60000 })
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => window.__V112_A && window.__V112_A.firstFrameMs != null)) break; await page.waitForTimeout(25) }
  const a = await A(page)
  ok(a && a.warm === false && a.adopted === false, '?noWarmV112: v94 falls back to its own fetch', a && ('adopted=' + a.adopted))
  ok(reqs.length === 2, '?noWarmV112: still exactly two requests', reqs.join(' '))
  ok(a && a.firstFrameMs != null, '?noWarmV112: the chase still runs', a && (a.firstFrameMs + 'ms'))
  let gone = false
  for (let i = 0; i < 160; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) break; await page.waitForTimeout(100) }
  ok(gone, '?noWarmV112: the door still opens')
  const real = errs.filter(e => !/favicon|manifest/i.test(e))
  console.log('page errors (noWarm):', real.length ? real.slice(0, 6).join('\n') : 'NONE'); if (real.length) fail++
  await browser.close()
}

// ---- the sheet never lands: the football stands in, the door is unchanged
{
  const { browser, page, errs } = await fresh()
  await page.route(/rib_field_v91\.(png|json)/, r => r.abort())
  await page.goto(CHASE_URL, { waitUntil: 'commit', timeout: 60000 })
  await page.waitForTimeout(900)
  const fb = await page.evaluate(() => { const s = document.getElementById('splash'); return s ? { chase: s.classList.contains('chase'), ball: getComputedStyle(document.querySelector('.splash-ball')).display } : null })
  ok(fb && !fb.chase && fb.ball !== 'none', 'no sheet: the football stands in', JSON.stringify(fb))
  let gone = false
  for (let i = 0; i < 120; i++) { gone = await page.evaluate(() => !document.getElementById('splash')); if (gone) break; await page.waitForTimeout(100) }
  ok(gone, 'no sheet: the splash still leaves')
  const real = errs.filter(e => !/rib_field_v91|ERR_FAILED|favicon|manifest/i.test(e))
  console.log('page errors (no sheet):', real.length ? real.slice(0, 6).join('\n') : 'NONE'); if (real.length) fail++
  await browser.close()
}

// ---- 8: the one thing a canvas on the main thread cannot do — keep moving while the main thread
// is jammed. The boot compile and the first play's build each take the thread for a second or more
// (see the stalls printed above), so the loader's own bar was moved onto the compositor. A
// screencast is produced by the compositor: if nothing is animating off the main thread, no new
// pictures arrive at all.
{
  const { browser, page, errs } = await fresh()
  await page.goto(CHASE_URL, { waitUntil: 'commit', timeout: 60000 })
  for (let i = 0; i < 300; i++) { if (await page.evaluate(() => window.__V112_A && window.__V112_A.firstFrameMs != null)) break; await page.waitForTimeout(20) }
  await page.waitForTimeout(2000)   // let the boot compile go, so the only jam is the one we make
  const cdp = await page.context().newCDPSession(page)
  const seen = []
  cdp.on('Page.screencastFrame', async f => { seen.push(createHash('md5').update(f.data).digest('hex')); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch (e) {} })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 })
  await page.waitForTimeout(400)
  const mark = seen.length
  page.evaluate(() => { const end = Date.now() + 1200; while (Date.now() < end) { } }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  const distinct = new Set(seen.slice(mark)).size
  await cdp.send('Page.stopScreencast').catch(() => {})
  ok(distinct > 10, 'the loader bar keeps sweeping while the main thread is jammed for 1.2s', distinct + ' distinct composited pictures (margin-left gave 4)')
  const real = errs.filter(e => !/favicon|manifest/i.test(e))
  console.log('page errors (jam):', real.length ? real.slice(0, 6).join('\n') : 'NONE'); if (real.length) fail++
  await browser.close()
}

console.log(JSON.stringify({ pass, fail }))
process.exit(fail ? 1 : 0)
