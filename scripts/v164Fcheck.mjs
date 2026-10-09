// Dev check: v164 F THE JUMBOTRON SAYS IT + THE SLOW DIAL · v164 G THE BIG PLAY HAS A DANCE · v164 H THE MOVES READ
// (src/05-field-renderer.js, src/07-career-app.js). On a live game:
//   F: `jumboSayV164F` prints the line (and a sub-line) on the stadium's big screen (mode "msg", the feed camera
//      hidden, the tag 📣), and hands the screen back after its time; a v95 badge (SACK, TOUCHDOWN…) is said there
//      instead of drawn over the field (no `.rib-badge-v95` node, the badge log marks it `jumbo`); a toast on the live
//      view goes there too; with the screen out of frame the line still goes on the screen (v175 B: the ribbon is gone); Settings › LIVE
//      GAME › "Messages on the jumbotron" OFF draws the badges over the field again; the 🐢 slider is gone (v193 W),
//      `setSlowV164F(30)` still runs the loop at 0.30× (frames keep coming), the clock floor is `slowMinV164F`
//   G: `danceV164G(you, "sack")` fires the v161 A body (or the drawn celebrate cycle) after its delay — once a play,
//      never on a man on the ground; the table picks by position; TU v164Gdance 0 does nothing
//   H: the juke / stiff-arm / hurdle sequences take their TU frame times; a synthetic `swim` / `shed` event plays the
//      arm-over on the rusher and staggers the blocker (`__V164H` counts); two paired linemen in the block pose rock
//      into each other (`body.x` ≠ 0, `_shoveV164H`); TU v164Hmoves 0 leaves both still
//   v172: pins TU v172jumbo 0 — this measures the BOWL's screen; the hung big board is jumbocheck's
//   node scripts/v164Fcheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0, speedGateV151A: 0, v172jumbo: 0 }); setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(() => { window.__readPos = 'LB' })
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
  await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }).catch(() => {})
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
const live = await waitLive(page, 90000)
ok(live, 'the live field is up')
await page.waitForFunction(() => window.__V92 && window.__V92.on && window.__gridironScene.markers.length >= 20, null, { timeout: 60000 }).catch(() => {})
// ---- F: the screen says it
const say = await page.evaluate(async () => { const sc = window.__gridironScene, ST = sc.stadium
  const before = { mode: ST.mode, cam: ST.cam && ST.cam.visible }
  const r = sc.jumboSayV164F('HELLO STADIUM', { sub: 'a sub-line', kind: 'result', ms: 700 })   // v175: a kind with no drawn badge (a sack's line is its art now — screenpancheck)
  const up = { r, mode: ST.mode, t: ST.msgT && ST.msgT.visible && ST.msgT.text, s: ST.msgS && ST.msgS.visible && ST.msgS.text, cam: ST.cam && ST.cam.visible, tag: ST.tag && ST.tag.text, inRect: ST.msgT && ST.msgT.x > ST.rect.x && ST.msgT.x < ST.rect.x + ST.rect.w && ST.msgT.y > ST.rect.y && ST.msgT.y < ST.rect.y + ST.rect.h, fits: ST.msgT && ST.msgT.width <= ST.rect.w, col: ST.msgT && ST.msgT.style.color }
  await new Promise(r => setTimeout(r, 200)); const mid = { cam: ST.cam && ST.cam.visible, mode: ST.mode }
  await new Promise(r => setTimeout(r, 900)); const after = { mode: ST.mode, t: ST.msgT && ST.msgT.visible, tag: ST.tag && ST.tag.text, F: window.__V164F && { said: window.__V164F.said, fell: window.__V164F.fell } }
  return { before, up, mid, after } })
console.log('say:', JSON.stringify(say))
ok(say.up.r && say.up.mode === 'msg' && say.up.t === 'HELLO STADIUM' && say.up.s === 'A SUB-LINE' && say.up.inRect && say.up.fits && /📣/.test(say.up.tag), 'jumboSayV164F prints the line and its sub-line inside the panel, in the kind\'s colour, the tag says 📣', say.up)
ok(!say.mid.cam && say.mid.mode === 'msg', 'the feed camera stands down while the message is up', say.mid)
ok(say.after.mode !== 'msg' && !say.after.t && /LIVE|REPLAY/.test(say.after.tag), 'and the screen goes back to the feed after its time', say.after)
// a badge is said on the screen, not drawn over the field
const badge = await page.evaluate(async () => { const sc = window.__gridironScene, B = window.__BADGE_V95
  const r = B.show('sack', { sub: '-7 YDS', x: 300, y: 220, scene: sc, token: 'chk:' + Date.now(), force: true })
  await new Promise(r => setTimeout(r, 120))
  return { r, dom: document.querySelectorAll('.rib-badge-v95, .rib-hud-v95').length, mode: sc.stadium.mode, text: sc.stadium.msgT && sc.stadium.msgT.text, last: window.__V164F.last, said: window.__V164F.said } })
console.log('badge:', JSON.stringify(badge))
ok(badge.r && badge.dom === 0 && (badge.mode === 'msg' && /SACK/.test(badge.text || '') || (badge.last && /SACK/.test(badge.last.text))), 'a v95 badge is said on the jumbotron (or the slim ribbon when the screen is out of frame) — never drawn over the field', badge)
// a toast on the live view
const toast = await page.evaluate(async () => { const F0 = window.__V164F.said + window.__V164F.fell; window.__ribToast ? window.__ribToast('A LIVE TOAST') : null; const st = window.__getGridironState(); const sc = window.__gridironScene
  // through the career app's own showToast (the bare function is not exported; the live SKIP refusal calls it)
  await new Promise(r => setTimeout(r, 100)); return { n: window.__V164F.said + window.__V164F.fell - F0, last: window.__V164F.last && window.__V164F.last.text, domToast: document.getElementById('toast').classList.contains('show') } })
console.log('toast:', JSON.stringify(toast))
ok(toast.n >= 1 && /LIVE TOAST/.test(toast.last || ''), 'a toast on the live view is said on the screen', toast)
// the screen out of frame: the slim ribbon
const fell = await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main, F = window.__V164F; const x0 = c.scrollX, y0 = c.scrollY, z0 = c.zoom
  c.setZoom(3); c.centerOn(360, 1900); await new Promise(r => setTimeout(r, 60)); const f0 = F.fell, s0 = F.said
  const r = sc.jumboSayV164F('FAR AWAY', { ms: 300 }); const out = { r, fell: F.fell - f0, said: F.said - s0, ribbon: sc.children.list.filter(o => o.type === 'Text' && o.text === 'FAR AWAY' && o.depth === 25).length, onScreen: !!(sc.stadium.msgT && sc.stadium.msgT.visible && sc.stadium.msgT.text === 'FAR AWAY') }
  c.setZoom(z0); c.setScroll(x0, y0); return out })
ok(fell.r && fell.fell === 1 && fell.ribbon === 0 && fell.onScreen, 'with the screen out of frame the line still goes on the screen — no slim ribbon over the picture (v175 B)', fell)
// the setting OFF: the badge is drawn over the field again
const off = await page.evaluate(async () => { const st = window.__getGridironState(); st.settings.jumboMsgV164F = false; const sc = window.__gridironScene, B = window.__BADGE_V95
  const on = sc.jumboOnV164F(); B.show('sack', { sub: '-3 YDS', x: 300, y: 220, scene: sc, token: 'chk2:' + Date.now(), force: true }); await new Promise(r => setTimeout(r, 700))
  const dom = document.querySelectorAll('.rib-badge-v95').length; st.settings.jumboMsgV164F = true; return { on, dom, row: !!document.querySelector('.toggle-row') } })
ok(!off.on && off.dom >= 1, 'Settings › "Messages on the jumbotron" OFF draws the badge over the field again', off)
// ---- F: the slow dial — v193 W took it off the HUD (slow motion is automatic on big plays; its amount is a Settings
// row, v193Wcheck); the renderer still runs below ½× when asked (setSlowV164F), the clock floor is slowMinV164F
const slow = await page.evaluate(async () => { const sc = window.__gridironScene, dial = document.querySelector('.slow-dial-v164f')
  window.setSlowV164F(30); const f0 = sc.game.loop.frame; await new Promise(r => setTimeout(r, 1500)); const frames = sc.game.loop.frame - f0
  const out = { dial: !!dial, speed: window.__getGridironLiveSpeed(), frames }
  window.setSpeed(2); out.after = { speed: window.__getGridironLiveSpeed() }; return out })
console.log('slow:', JSON.stringify(slow))
ok(!slow.dial, 'v193 W: the 🐢 slider is gone from the live HUD', slow)
ok(slow.speed === 0.3 && slow.frames > 20, 'setSlowV164F still runs the loop at 0.30× and the frames keep coming', slow)
ok(slow.after && slow.after.speed === 2, 'a speed button sets the speed back', slow.after)
// ---- G: the dance
const dance = await page.evaluate(async () => { const sc = window.__gridironScene; let me = sc.markers.find(m => m && m.team === 'you'); if (!sc.play) return { me: !!me, play: !!sc.play }
  // he may be off the field this snap: borrow a linebacker for the test (the dance reads `team === "you"` alone)
  let borrowed = null; if (!me) { me = sc.markers[15]; borrowed = me.team; me.team = 'you' }
  const P = sc.play; P._danceV164G = null; me.forceState = null; me._groundT = 0
  const r1 = sc.danceV164G(me, 'sack', { ms: 30 }); const r2 = sc.danceV164G(me, 'pick', { ms: 30 })
  await new Promise(r => setTimeout(r, 400))
  const G = window.__V164G, body = !!(me.__v161a && me.__v161a.alive), cyc = me.forceState === 'celebrateSeq', last = Object.assign({}, G.last)
  // a man on the ground does not dance
  const other = sc.markers.find(m => m && m.team !== 'you' && m !== me); P._danceV164G = null; other.forceState = 'down'; const r3 = sc.danceV164G(other, 'tfl', { ms: 30 }); await new Promise(r => setTimeout(r, 120)); const sk = G.skipped
  other.forceState = null; if (borrowed) me.team = borrowed
  return { r1, r2, fired: G.fired, body, cyc, last, r3, skippedDown: sk >= 1 && G.last && G.last.why === 'down', borrowed: !!borrowed } })
console.log('dance:', JSON.stringify(dance))
ok(dance.r1 && !dance.r2 && dance.fired >= 1 && (dance.body || dance.cyc) && dance.last && dance.last.kind === 'sack' && dance.last.pos === 'LB' && dance.last.name === 'backflip', 'his sack dance fires once a play (the second ask is refused): an LB backflips — the v161 A body (or the drawn cycle) is alive', dance)
ok(dance.r3 && dance.skippedDown, 'a man on the ground does not dance', { r3: dance.r3, skippedDown: dance.skippedDown })
// ---- H: the moves
const moves = await page.evaluate(async () => { const sc = window.__gridironScene, ms = sc.markers; const rusher = ms[18], blocker = ms[5]; if (!rusher || !blocker) return null
  sc.pairUp(18, 5); blocker.forceState = null; rusher.forceState = null; window.RIB_TUNE.jukeFrameMsV164H = 123
  const H0 = Object.assign({}, window.__V164H || {})
  sc.fireEvent({ type: 'swim', who: 'def7', x: rusher.sx, y: rusher.sy }, sc.play)
  const swim = { rusher: rusher.forceState, paired: rusher._pair, blockerLean: blocker._lean, stumble: !!blocker._stumbleV109 || !!blocker._stumV109 || blocker.forceState }
  sc.pairUp(18, 5); rusher.forceState = null; blocker.forceState = null
  sc.fireEvent({ type: 'shed', who: 'def7', x: rusher.sx, y: rusher.sy }, sc.play)
  const shed = { rusher: rusher.forceState, blockerLean: blocker._lean, leanSrc: blocker._leanSrc }
  // the grind: two paired linemen in the block pose
  const a = ms[3], b = ms[19]; b.sx = a.sx + 8; b.sy = a.sy + 2; sc.placeMarker(b, b.sx, b.sy, 16); sc.pairUp(3, 19); a.isLine = true; b.isLine = true; a.forceState = null; b.forceState = null; a.sSm = 5; b.sSm = 5
  const xs = []; for (let i = 0; i < 6; i++) { a.tms += 90; sc.placeMarker(a, a.sx + 0.2, a.sy, 90); xs.push(+a.body.x.toFixed(2)) }
  const grind = { xs, shove: a._shoveV164H, lean: a._lean, leanSrc: a._leanSrc }
  // the kill switch: still
  window.RIB_TUNE.v164Hmoves = 0; for (let i = 0; i < 3; i++) { a.tms += 90; sc.placeMarker(a, a.sx, a.sy, 90) } const still = { x: a.body.x, shove: a._shoveV164H }; delete window.RIB_TUNE.v164Hmoves
  sc.unpair(3); sc.unpair(18)
  return { H0, H: window.__V164H, swim, shed, grind, still } })
console.log('moves:', JSON.stringify(moves))
ok(moves && moves.H.swims - (moves.H0.swims || 0) === 1 && moves.swim.rusher === 'stiffSeq' && moves.swim.paired == null, 'a swim plays the arm-over on the rusher and unpairs him', moves && moves.swim)
ok(moves && moves.H.sheds - (moves.H0.sheds || 0) === 1 && moves.shed.rusher === 'stiffSeq' && /shed|stumble/.test(moves.shed.leanSrc || '') && Math.abs(moves.shed.blockerLean) > 0.1, 'a shed is the same rip with the blocker shoved, staggered and left leaning', moves && moves.shed)
ok(moves && moves.grind.shove === 1 && moves.grind.xs.some(x => Math.abs(x) > 0.3) && moves.grind.leanSrc === 'shove', 'two paired linemen in the block pose rock into each other (body.x moves, a lean into the drive)', moves && moves.grind)
ok(moves && moves.still.x === 0 && !moves.still.shove, 'TU v164Hmoves 0: they stand still again', moves && moves.still)
const seq = await page.evaluate(() => { const sc = window.__gridironScene, m = sc.markers[9]; m.forceState = 'jukeSeq'; m.seqT = m.tms; const t0 = m.tex; m.tms += 200; sc.placeMarker(m, m.sx, m.sy, 16); const t1 = m.tex; m.forceState = null; return { t1, frame: t1 && t1.match(/juke(\d)/) ? +t1.match(/juke(\d)/)[1] : null } })
ok(seq.frame === 1, 'the juke sequence runs at its TU frame time (200 ms at 123 ms a frame → frame 1, not frame 3)', seq)
ok(!errs.length, 'no page errors', errs.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
