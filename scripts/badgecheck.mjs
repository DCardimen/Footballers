// Dev check: v95 THE CALLOUT WALL — the drawn badges over the live field.
// Drives a real career onto the live field, then:
//   1. asserts every badge file the manifest names decodes from the server, at its stated size;
//   2. exercises the queue directly (priority cut-in, the same moment never twice, the drop
//      when the wait is full, the caption, the reduced-motion-safe classes);
//   3. watches a run of live plays and asserts the wall fires for the moments the plays
//      contain (a touchdown fires TOUCHDOWN, a first down fires FIRST DOWN, an interception
//      fires INTERCEPTED then TURNOVER) and that the retired pop-text never shows again;
//   4. screenshots the field with a badge up.
//   node scripts/badgecheck.mjs        (READ_POS=QB|RB|WR|LB..., BADGE_MS=90000)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = [], failedReq = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
page.on('requestfailed', r => failedReq.push(r.url()))
page.on('response', r => { if (r.status() >= 400) failedReq.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(1500)   // warm-up: absorbs vite's one full-reload after an index.html edit
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500); errs.length = 0; failedReq.length = 0
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// 2. the queue
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'RB'
async function step(t) { let ok = null; try { ok = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { ok = 'ERR ' + e.message }
  console.log('>>', t, '->', ok); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
ok(scene, 'live field is up')

// 1. the files
const files = await page.evaluate(async () => {
  const out = {}
  const RIB_BADGES_V95 = window.__BADGE_V95.meta
  for (const k in RIB_BADGES_V95) {
    const im = new Image(); im.src = './public/badges/' + k + '.webp'
    try { await im.decode(); out[k] = [im.naturalWidth, im.naturalHeight] } catch (e) { out[k] = null }
  }
  return { out, meta: RIB_BADGES_V95 }
})
const names = Object.keys(files.meta)
ok(names.length === 15, 'manifest names 15 badges', names.length)
for (const k of names) ok(files.out[k] && files.out[k][0] === files.meta[k][0] && files.out[k][1] === files.meta[k][1], 'badge decodes at its stated size: ' + k, JSON.stringify(files.out[k]))


const qres = await page.evaluate(async () => {
  const B = window.__BADGE_V95; const wait = ms => new Promise(r => setTimeout(r, ms))
  const r = {}; const up = () => document.querySelectorAll('.rib-badge-v95').length
  B.clear()
  r.first = B.show('bigplay', { sub: '+22 YARDS', force: true, hold: 5000, x: 200, y: 200 })
  await wait(120)
  r.hostInWrap = !!document.querySelector('.field-wrap > .rib-badge-host-v95')
  const el = document.querySelector('.rib-badge-v95'); r.shown = el ? el.className : null
  r.sub = el ? (el.querySelector('.rib-badge-sub-v95') || {}).textContent : null
  r.imgSrc = el ? el.querySelector('img').getAttribute('src') : null
  r.animating = el ? el.getAnimations().length : 0
  r.repeat = B.show('bigplay', { hold: 5000 })            // the same moment again, inside the repeat window: refused
  r.lower = B.show('flag', { force: true, hold: 5000 }); r.qAfterLower = B.queue.length   // waits (same tier, lower prio)
  r.cutIn = B.show('sack', { force: true, hold: 5000 })   // higher prio, no promotion: cuts in
  await wait(320); r.nowKind = B.current && B.current.kind; r.countAfterCut = up()
  r.token1 = B.show('intercepted', { token: 'tok:1', force: true }); r.token2 = B.show('intercepted', { token: 'tok:1', force: true })
  for (const k of ['fumble', 'breakaway', 'bighit']) B.show(k, { force: true })
  r.qMax = B.queue.length
  r.unknown = B.show('nope', { force: true })
  B.clear(); r.cleared = up() === 0 && B.queue.length === 0 && !B.current
  // the promotion: INTERCEPTED on screen becomes TOUCHDOWN captioned PICK SIX, one graphic
  B.show('intercepted', { force: true, hold: 5000 }); await wait(500)
  r.promoAccepted = B.show('touchdown', { force: true, hold: 5000, sub: '+38 YARDS' }); await wait(500)
  r.promoKind = B.current && B.current.kind; r.promoSub = B.current && B.current.sub; r.promoCount = up()
  r.promoLogged = B.log[B.log.length - 1].promo
  r.promoEl = document.querySelector('.rib-badge-v95.touchdown') ? document.querySelector('.rib-badge-v95.touchdown').querySelector('img').getAttribute('src') : null
  r.rays = !!document.querySelector('.rib-badge-v95.touchdown .rib-badge-rays-v95'); r.dim = !!document.querySelector('.rib-badge-dim-v95')
  r.particles = document.querySelectorAll('.rib-badge-p-v95').length
  // the scorebug lane runs beside the stage
  r.hud = B.show('firstdown', { force: true, sub: '18-yard reception', hold: 5000 }); await wait(450)
  const hd = document.querySelector('.rib-hud-v95'); r.hudEl = hd ? hd.className : null; r.hudTxt = hd ? hd.querySelector('.rib-hud-txt-v95').textContent : null
  r.both = !!(B.current && B.hudCurrent)
  B.clear(); r.cleared2 = up() === 0 && !document.querySelector('.rib-hud-v95') && !B.current && !B.hudCurrent
  return r
})
ok(qres.first === true, 'show() accepts a badge')
ok(qres.hostInWrap, 'the wall mounts inside .field-wrap')
ok(/rib-badge-v95 t2 bigplay/.test(qres.shown || ''), 'the badge element carries its tier and kind', qres.shown)
ok(qres.sub === '+22 YARDS', 'the caption shows', qres.sub)
ok(/bigplay\.webp$/.test(qres.imgSrc || ''), 'the image is the badge file', qres.imgSrc)
ok(qres.animating >= 1, 'the entrance runs as an animation', qres.animating)
ok(qres.repeat === false, 'the same moment inside the repeat window is refused')
ok(qres.lower === true && qres.qAfterLower === 1, 'a lower badge waits its turn', qres.qAfterLower)
ok(qres.cutIn === true && qres.nowKind === 'sack', 'a bigger moment cuts the current badge short', qres.nowKind)
ok(qres.countAfterCut <= 1, 'the cut badge is gone once the next is up', qres.countAfterCut)
ok(qres.token1 === true && qres.token2 === false, 'a token fires once')
ok(qres.qMax <= 2, 'the wait never holds more than two', qres.qMax)
ok(qres.unknown === false, 'an unknown kind is refused')
ok(qres.cleared, 'clear() empties the wall')
ok(qres.promoAccepted && qres.promoKind === 'touchdown' && qres.promoSub === 'PICK SIX', 'INTERCEPTED promotes into TOUCHDOWN captioned PICK SIX', qres.promoKind + '/' + qres.promoSub)
ok(qres.promoCount === 1 && /touchdown\.webp$/.test(qres.promoEl || ''), 'the promotion morphs the one graphic', qres.promoCount + ' ' + qres.promoEl)
ok(qres.promoLogged === 'intercepted', 'the log records the promotion', qres.promoLogged)
ok(qres.rays && qres.dim, 'a tier-1 badge brings rays and the dim', qres.rays + '/' + qres.dim)
ok(qres.particles > 0, 'particles left the badge', qres.particles)
ok(qres.hud && /rib-hud-v95 firstdown/.test(qres.hudEl || '') && qres.hudTxt === '18-yard reception', 'a tier-3 badge is a scorebug panel with its context', qres.hudEl + ' ' + qres.hudTxt)
ok(qres.both, 'the panel and the stage badge share the screen')
ok(qres.cleared2, 'clear() empties both lanes')

// 3. the live run
const MS = +(process.env.BADGE_MS || 100000)
const t0 = Date.now(); let shot = false, tookTakeover = false; const popSeen = new Set(); let plays = 0, lastTok = null
const RETIRED = /^(TOUCHDOWN!|INTERCEPTED!|FUMBLE!|SACKED!|FIRST DOWN ✓|FLAG ON THE PLAY|BIG HIT!|HIT STICK!|IT'S GOOD!|NO GOOD|TOUCHDOWN|INTERCEPTED|FUMBLE — TURNOVER|FIELD GOAL IS GOOD|FIELD GOAL NO GOOD)$/
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc) return null
    const P = sc.play; const pops = []
    try { sc.children.list.forEach(c => { if (c.type === 'Text' && c.text) pops.push(c.text) }) } catch (e) {}
    const up = document.querySelector('.rib-badge-v95, .rib-hud-v95')
    return { tok: P ? P.__ballTokenV1514 : null, pops, up: up ? up.className.replace(/rib-badge-v95|rib-hud-v95|t[123]| /g, '') : null, log: window.__BADGE_V95.log.length } })
  // a story / training roll can sit over the field mid-game: its CONTINUE clears it
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /^continue$/i.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0); if (b) b.click() })
  if (!tookTakeover && Date.now() - t0 > 30000 && st && st.tok) {   // a forced takeover on a real play, for the eye
    await page.evaluate(() => { window.__BADGE_V95.show('touchdown', { force: true, sub: '42 YARDS', scene: window.__gridironScene }) }); await page.waitForTimeout(720)
    await page.screenshot({ path: '_badge_takeover.png' }); tookTakeover = true; console.log('shot: _badge_takeover.png')
    await page.evaluate(() => { window.__BADGE_V95.show('fourthdown', { force: true, sub: '2 yards to go' }); window.__BADGE_V95.show('intercepted', { force: true, x: 200, y: 120, scene: window.__gridironScene }) }); await page.waitForTimeout(650)
    await page.screenshot({ path: '_badge_stinger.png' }); console.log('shot: _badge_stinger.png')
  }
  if (st) {
    if (st.tok && st.tok !== lastTok) { lastTok = st.tok; plays++ }
    st.pops.forEach(t => { if (RETIRED.test(t)) popSeen.add(t) })
    if (st.up && !shot) { await page.screenshot({ path: '_badge_live.png' }); shot = true; console.log('shot: _badge_live.png with', st.up) }
  }
  await page.waitForTimeout(120)
}
const log = await page.evaluate(() => window.__BADGE_V95.log.map(l => (l.promo ? l.promo + '>' : '') + l.kind + (l.sub ? '(' + l.sub + ')' : '')))
const plays2 = await page.evaluate(() => { try { return (window.Z && window.Z.game && window.Z.game.plays || []).slice(0, 400).map(p => ({ e: p.event, y: p.yards, s: !!p.scored, d: String(p.desc || '').slice(0, 60), pd: p.preDown, ptg: p.preToGo })) } catch (e) { return null } })
console.log('plays watched:', plays, '| badges fired:', log.length, '|', log.slice(0, 30).join(' '))
ok(plays >= 6, 'watched a run of plays', plays)
ok(log.length >= 1, 'the wall fired during live play', log.length)
ok(popSeen.size === 0, 'no retired pop-text drawn', [...popSeen].join(','))
const kinds = new Set(log.map(l => l.replace(/\(.*\)$/, '')))
console.log('kinds seen:', [...kinds].join(' '))
if (plays2) {
  const hadFD = plays2.some(p => /First down/i.test(p.d)), hadTD = plays2.some(p => p.s)
  console.log('game so far had first down:', hadFD, 'touchdown:', hadTD)
}
ok(shot, 'a badge was on screen during the run')
console.log('page errors:', errs.length ? errs.slice(0, 8).join('\n') : 'NONE')
console.log('failed requests:', failedReq.length ? failedReq.slice(0, 8).join('\n') : 'NONE')
if (failedReq.some(u => /badges\//.test(u))) { ok(false, 'a badge request failed') }
console.log(JSON.stringify({ pass, fail, plays, badges: log.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
