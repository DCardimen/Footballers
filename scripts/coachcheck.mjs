// Dev check: v119 — THE COACH. Drives a real browser at a phone width and proves:
//   * the dev-check boot (welcome cards removed without a click) never meets him;
//   * the switch is on the menu, reads ON on a fresh install, and tapping it opens the MENU stop over
//     the dimmed menu; the coach TALKS (his picture flips between the closed and open mouth while a
//     line types, in a variable pattern, and a muddle of pitched blips plays letter by letter; VOICE
//     mutes it), the open-mouth drawing is the closed one with only the head changed (no jitter);
//   * NEXT and the keyboard move the lines, a spotlight lands on the element the line names, nothing
//     scrolls sideways at 400px; GOT IT closes a stop and leaves the switch ON; SKIP / Escape switch
//     it OFF, the switch is remembered across a reload, and switching it back ON starts over;
//   * THE WALK: he pops in once on each screen of a first week — the personality roll, the position
//     pick, the hub, the wheel (over the training board, off PLAY SEASON), the training board, the
//     season screen, the pregame, the weekly-plan wheel (v135: on the pregame's fifth page), the broadcast, the post-game
//     card and the season screen after the game — in that order, never twice, and the last stop
//     switches him off;
//   * on a REAL first visit the game's welcome cards show above the menu (v119 lifted them from under
//     it), and clicked through they hand to the coach; `?coachTour` starts him on the first menu mount;
//   * THE SEASON DEBRIEF (v122): it is not part of the walk — it fires on the season report card even
//     with the tour switched off, builds its lines from that season's own numbers, says the record,
//     three or four notes (fatigue, luck, expectations, rank and the next level) and what to work on,
//     is said once a season, and its SKIP silences the debrief without touching the tour switch;
//   * every league string on the menu, in the guide and in his lines says DFL, never the real one.
//   node scripts/coachcheck.mjs      (GAME_URL, SHOTS=/tmp/coach writes screenshots, READ_POS=RB)
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://127.0.0.1:5173/index.html'
// v106.1 reloads the page once when the baked build stamp has moved on. That is correct in a
// browser and fatal in a check — a rebake between runs destroys the execution context mid-walk —
// so every boot here pins `?stayStale`; freshcheck.mjs is what proves the reload itself.
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale'].concat(q).join('&')
const shots = process.env.SHOTS || ''
const POS = process.env.READ_POS || 'RB'
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const errors = []
const newPage = async (opts = {}) => {
  const context = await browser.newContext({ viewport: { width: opts.w || 400, height: opts.h || 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  if (!opts.realFirstVisit) await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  return { page, context }
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}_${name}.png` }) }
const menuUp = async (page) => { await page.waitForSelector('#rib-main-menu-v2 .rib9-tiles', { timeout: 30000 }); await page.waitForTimeout(600) }
const H = (page) => page.evaluate(() => { const C = window.__RIB_COACH; return C ? { open: C.isOpen, enabled: C.enabled, stop: C.stop, line: C.line, typing: C.typing, flips: C.flips, spot: C.spot, auto: C.auto, openedBy: C.openedBy || null, openedStop: C.openedStop || null, closedBy: C.closedBy || null, opens: C.opens || 0, stops: C.stops.length, lines: C.stops.reduce((n, c) => n + c.lines, 0), estimateMin: C.estimateMs() / 60000, seen: C.seen, current: C.currentStop(), last: C.last || null } : null })
// wait for a stop to open on its screen, then read it
const waitStop = async (page, id, ms = 12000) => { await page.waitForFunction((id) => { const C = window.__RIB_COACH; return C && C.isOpen && C.stop === id && !!document.querySelector('#rib-coach-v119.rib-coach-ready') }, id, { timeout: ms }).catch(() => null); await page.waitForTimeout(250); return H(page) }
// the player reads it and taps through: every NEXT, then GOT IT / DONE
const dismiss = async (page) => { await page.evaluate(() => { const C = window.__RIB_COACH; let n = 0; while (C.isOpen && n++ < 12) C.next() }); await page.waitForTimeout(300); return H(page) }
// a visible button by its text (the first-week flow), like the other checks
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const step = async (page, t, wait = 900) => {
  const r = await page.evaluate(({ t, visSrc, POS }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter((e) => !e.closest('#rib-coach-v119')); const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find((e) => new RegExp('^' + POS + '\\b').test(txt(e))) || els.find((e) => e.classList.contains('pos-card'))) : els.find((e) => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis, POS }).catch((e) => 'ERR ' + e.message)
  await page.waitForTimeout(wait); return r
}

// ================= 1. the dev-check boot, the switch, the menu stop, the mouth, the voice =================
{
  const { page, context } = await newPage()
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  await page.waitForTimeout(1500)
  let h = await H(page)
  ok(!!h, 'the coach module is loaded on the menu', h && `${h.stops} stops · ${h.lines} lines`)
  ok(h && !h.open, 'the dev-check boot (welcome cards removed without a click) never starts him on its own')
  const tile = await page.evaluate(() => { const t = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]'); return t ? { on: t.getAttribute('aria-checked'), role: t.getAttribute('role'), label: (t.querySelector('b') || {}).textContent, face: (t.querySelector('small') || {}).textContent, img: !!t.querySelector('img') } : null })
  ok(tile && tile.role === 'switch' && tile.on === 'true' && /COACH'S TOUR/.test(tile.label) && /^ON\b/.test(tile.face) && tile.img, "the COACH'S TOUR switch is on the menu and reads ON on a fresh install", JSON.stringify(tile))
  ok(h && h.stops === 16 && h.lines >= 30 && h.lines <= 64 && h.estimateMin >= 1.5 && h.estimateMin <= 6, 'sixteen stops (fifteen written — the prestige tree and the skill sheet each their own — plus the season debrief it builds) — a couple of minutes of talk over a week, not a lecture', h && `${h.estimateMin.toFixed(1)} min · ${h.lines} lines`)
  // his lines are short and plain: almost no numbers (the guide has those), no line over two sentences' worth, and the
  // things a rookie must hear — fatigue means fewer snaps, each position wants its own skills, prestige is what you keep
  const lineFacts = await page.evaluate(() => fetch([...document.scripts].map((x) => x.src).find((u) => /rib-menu-coach/.test(u))).then((r) => r.text()).then((src) => { const m = src.match(/t: "([^"]+)"/g) || []; const all = m.join(' ')
    return { n: m.length, longest: Math.max(...m.map((x) => x.length)), withNumber: m.filter((x) => /\d/.test(x)).length, fatigue: /fatigued.*fewer snaps|fewer snaps.*recover/i.test(all), skills: /position wants different skills/i.test(all) && /mix of skills/i.test(all), prestige: (all.match(/prestige/gi) || []).length, howto: /HOW TO PLAY on the main menu/.test(all) && /AI plays/.test(all), team: /your team/.test(all) && /colours/.test(all), taps: (src.match(/tap: true/g) || []).length } }))
  ok(lineFacts.n >= 30 && lineFacts.longest <= 170 && lineFacts.withNumber <= 4 && lineFacts.fatigue && lineFacts.skills && lineFacts.prestige >= 3 && lineFacts.howto && lineFacts.team && lineFacts.taps >= 8, 'his lines are short and plain — almost no math; the fatigue, skill-mix, prestige, team and HOW TO PLAY points are said, and eight lines point at a tap', JSON.stringify(lineFacts))
  await shot(page, 'menu')
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 8000 })
  await page.waitForTimeout(300)
  h = await H(page)
  ok(h && h.open && h.stop === 'menu' && h.line === 0 && h.openedBy === 'tile', 'tapping the switch opens the MENU stop', JSON.stringify({ stop: h && h.stop, by: h && h.openedBy }))
  const layer = await page.evaluate(() => {
    const root = document.getElementById('rib-coach-v119'), menu = document.getElementById('rib-main-menu-v2')
    const dim = root && root.querySelector('.rib-coach-dim'), man = root && root.querySelector('[data-c-man]'), bub = root && root.querySelector('[data-c-bubble]')
    const bg = dim && !dim.hidden ? getComputedStyle(dim).backgroundColor : null
    const z = root ? +getComputedStyle(root).zIndex : 0, mz = menu ? +getComputedStyle(menu).zIndex : 0
    const mr = man ? man.getBoundingClientRect() : null, br = bub ? bub.getBoundingClientRect() : null
    return { menuStill: !!menu && menu.isConnected, dim: !!bg && /rgba\(/.test(bg), above: z > mz, man: mr && { w: Math.round(mr.width), h: Math.round(mr.height), bottom: Math.round(mr.bottom) }, bubble: br && { w: Math.round(br.width), top: Math.round(br.top), bottom: Math.round(br.bottom) }, overlap: mr && br ? br.bottom <= mr.top + Math.round(mr.height * 0.35) : null, vw: innerWidth, vh: innerHeight }
  })
  ok(layer.menuStill && layer.dim && layer.above, 'he dims the page and stands above the menu, which is still there behind him', JSON.stringify({ dim: layer.dim, above: layer.above }))
  ok(layer.man && layer.man.h >= 200 && layer.man.h <= 360 && layer.man.bottom <= layer.vh + 2, 'the coach stands at the bottom of a phone screen at a readable size', JSON.stringify(layer.man))
  ok(layer.bubble && layer.bubble.w >= 300 && layer.bubble.w <= 400 && layer.overlap, 'his bubble sits over his shoulder, not on his face', JSON.stringify(layer.bubble))
  // the mouth: sample the picture while the first line types
  const srcs = new Set(); const t0 = Date.now()
  while (Date.now() - t0 < 1400) { srcs.add(await page.evaluate(() => (document.querySelector('#rib-coach-v119 [data-c-man]') || {}).getAttribute?.('src') || '')); await page.waitForTimeout(40) }
  h = await H(page)
  ok(srcs.size >= 2 && [...srcs].some((s) => /_a\.webp/.test(s)) && [...srcs].some((s) => /_b\.webp/.test(s)) && h.flips >= 2, 'the coach talks — his mouth flips between the closed and open drawing while the line types', `${srcs.size} pictures · ${h.flips} flips`)
  const typed = await page.evaluate(() => (document.querySelector('#rib-coach-v119 [data-c-text]') || {}).textContent || '')
  ok(typed.length > 10 && /Coach/.test(typed), 'the line types out on the bubble', JSON.stringify(typed.slice(0, 50)))
  // the two drawings of a pose are the same picture below the head: nothing but the face moves
  const still = await page.evaluate(async () => {
    const pose = document.getElementById('rib-coach-v119').dataset.pose
    const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = s })
    const a = await load('./public/coach/' + pose + '_a.webp'), b = await load('./public/coach/' + pose + '_b.webp'); if (!a || !b) return null
    const same = a.width === b.width && a.height === b.height; if (!same) return { pose, same }
    const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height; const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(a, 0, 0); const A = cx.getImageData(0, 0, a.width, a.height).data; cx.clearRect(0, 0, a.width, a.height); cx.drawImage(b, 0, 0); const B = cx.getImageData(0, 0, a.width, a.height).data
    // the silhouette below the head is IDENTICAL; the colour may carry a few pixels of lossy-webp noise (two
    // encodes of one drawing), nowhere near a moved line
    // the pixels that really differ (past lossy-webp noise) sit in ONE small box low in the head: the mouth. The eyes, the
    // brow, the cap, the arms and the body are the same picture
    let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, alphaDiff = 0
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) { const i = (y * a.width + x) * 4; const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (d > 90 && A[i + 3] > 200 && B[i + 3] > 200) { n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y } if (Math.abs(A[i + 3] - B[i + 3]) > 40) alphaDiff++ }
    return { pose, same, w: a.width, h: a.height, n, box: [minX, minY, maxX - minX + 1, maxY - minY + 1], boxFrac: +(((maxX - minX + 1) * (maxY - minY + 1)) / (a.width * a.height)).toFixed(3), lowInHead: minY > a.height * 0.15 && maxY < a.height * 0.4, alphaDiff }
  })
  ok(still && still.same && still.n > 100 && still.boxFrac < 0.06 && still.lowInHead && still.alphaDiff === 0, 'only the MOUTH differs between the two drawings — a small box low in the head; the eyes, the head and the body hold still', JSON.stringify(still))
  // the mouth is not a metronome, and the voice muddles along with the letters
  const mouth = await page.evaluate(() => { const L = window.__RIB_COACH.voice.mouthLog; return { n: L.length, distinct: new Set(L).size, min: Math.min(...L), max: Math.max(...L) } })
  ok(mouth.n >= 8 && mouth.distinct >= 6 && mouth.max - mouth.min >= 60, 'the mouth moves in a variable pattern — no two beats the same, a real spread', JSON.stringify(mouth))
  const v1 = await page.evaluate(() => ({ on: window.__RIB_COACH.voice.enabled, blips: window.__RIB_COACH.voice.blips, state: window.__RIB_COACH.voice.state }))
  ok(v1.on && v1.blips >= 8 && !!v1.state, 'the coach has a voice — a muddle of blips scheduled letter by letter through WebAudio', JSON.stringify(v1))
  await page.click('#rib-coach-v119 [data-c-voice]'); const b0 = await page.evaluate(() => window.__RIB_COACH.voice.blips); await page.waitForTimeout(700)
  const v2 = await page.evaluate(() => ({ on: window.__RIB_COACH.voice.enabled, blips: window.__RIB_COACH.voice.blips, stored: localStorage.getItem(window.__RIB_COACH.voice.key) }))
  ok(!v2.on && v2.blips === b0 && v2.stored === 'off', 'VOICE mutes him and remembers', JSON.stringify(v2))
  // v133: a mood on every line, a brash voice for the barked ones, and quips for the laugh
  await page.click('#rib-coach-v119 [data-c-voice]'); await page.waitForTimeout(200)
  const mood = await page.evaluate(() => { const C = window.__RIB_COACH
    const brash = C.moodOf({ p: 'firedup', t: 'Now go get hit.' }), bang = C.moodOf({ p: 'clipboard', t: 'Move!' }), calm = C.moodOf({ p: 'relaxed', t: "I'll see you after." }), plain = C.moodOf({ p: 'clipboard', t: 'The card. Your grade, your stats.' })
    const root = document.getElementById('rib-coach-v119')
    return { brash, bang, calm, plain, now: C.mood, attr: root && root.dataset.mood, quips: C.quips.length, nfl: C.quips.filter(q => /\bNFL\b/i.test(q)).length } })
  ok(mood.brash === 'brash' && mood.bang === 'brash' && mood.calm === 'calm' && mood.plain === 'plain', 'a line has a mood: brash on a barked pose or an exclamation, calm on the soft poses, plain otherwise', JSON.stringify(mood))
  ok(mood.now && mood.attr === mood.now, 'the line on screen carries its mood on the root', JSON.stringify({ now: mood.now, attr: mood.attr }))
  ok(mood.quips >= 36 && mood.nfl === 0, 'he has a pool of quips, and none of them say the wrong league', `${mood.quips} quips`)
  const q1 = await page.evaluate(() => { const C = window.__RIB_COACH; const b0 = C.voice.blips; const t = C.quip(); const el = document.querySelector('#rib-coach-v119 [data-c-quip]'); return { t, shown: !!el && !el.hidden && el.textContent === t, n: C.quipsShown, last: C.lastQuipText, b0 } })
  await page.waitForTimeout(900)
  const q2 = await page.evaluate(() => ({ blips: window.__RIB_COACH.voice.blips, moods: window.__RIB_COACH.voice.moods }))
  ok(q1.t && q1.shown && q1.n >= 1 && q1.last === q1.t, 'a quip lands on the bubble as a tag, and the hook records it', JSON.stringify({ t: q1.t, shown: q1.shown }))
  ok(q2.blips > q1.b0 && (q2.moods.brash || 0) > 0, 'and it is barked in the brash voice', JSON.stringify(q2.moods))
  await page.click('#rib-coach-v119 [data-c-voice]')
  await shot(page, 'menu-stop')
  await page.click('#rib-coach-v119 [data-c-next]')
  await page.waitForTimeout(700)
  h = await H(page)
  const spotTile = await page.evaluate(() => { const spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), dim = document.querySelector('#rib-coach-v119 .rib-coach-dim'), target = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]')
    const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, tr = target ? target.getBoundingClientRect() : null
    return { shown: !!sr, dimHidden: !!dim && dim.hidden, inside: !!(sr && tr && sr.left <= tr.left + 1 && sr.top <= tr.top + 1 && sr.right >= tr.right - 1 && sr.bottom >= tr.bottom - 1), onScreen: !!(sr && sr.top >= 0 && sr.bottom <= innerHeight) } })
  ok(h.stop === 'menu' && h.line === 1 && h.spot === 'coach' && spotTile.shown && spotTile.dimHidden && spotTile.inside && spotTile.onScreen, "NEXT moves to the next line, and its spotlight cuts the dim over the COACH'S TOUR tile", JSON.stringify({ line: h.line, ...spotTile }))
  // the PRESTIGE line lights the TRAINING tile; the last line of the stop lights the CAREER tile, and the button reads GOT IT
  await page.evaluate(() => { const C = window.__RIB_COACH; let n = 0; while (C.line < 3 && n++ < 10) C.next() })
  await page.waitForTimeout(700)
  // the cut-out eases onto its target; give it up to two seconds to arrive before reading it
  await page.waitForFunction(() => { const spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), t = document.querySelector('#rib-main-menu-v2 [data-rib-action="prestige"]'); if (!spot || spot.hidden || !t) return false; const s = spot.getBoundingClientRect(), r = t.getBoundingClientRect(); return s.left <= r.left + 2 && s.top <= r.top + 2 && s.right >= r.right - 2 && s.bottom >= r.bottom - 2 }, null, { timeout: 2500 }).catch(() => null)
  const spotPres = await page.evaluate(() => { const spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), target = document.querySelector('#rib-main-menu-v2 [data-rib-action="prestige"]'); const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, tr = target ? target.getBoundingClientRect() : null
    return { line: window.__RIB_COACH.line, key: window.__RIB_COACH.spot, shown: !!sr, inside: !!(sr && tr && sr.left <= tr.left + 2 && sr.top <= tr.top + 2 && sr.right >= tr.right - 2 && sr.bottom >= tr.bottom - 2), onScreen: !!(sr && sr.top >= 0 && sr.bottom <= innerHeight), sr: sr && [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)], tr: tr && [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)] } })
  ok(spotPres.key === 'honors' && spotPres.shown && spotPres.inside && spotPres.onScreen, 'the PRESTIGE line lights the HONORS chip — where the tree lives (v134: not the TRAINING tile, which is the skill sheet)', JSON.stringify(spotPres))
  await page.evaluate(() => { const C = window.__RIB_COACH; let n = 0; while (C.line < 4 && n++ < 10) C.next() })
  await page.waitForTimeout(700)
  const spot = await page.evaluate(() => {
    const C = window.__RIB_COACH, spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), dim = document.querySelector('#rib-coach-v119 .rib-coach-dim')
    const target = document.querySelector('#rib-main-menu-v2 [data-rib-action="prestige"]'), nextBtn = document.querySelector('#rib-coach-v119 [data-c-next]')
    const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, tr = target ? target.getBoundingClientRect() : null
    const inside = sr && tr && sr.left <= tr.left + 1 && sr.top <= tr.top + 1 && sr.right >= tr.right - 1 && sr.bottom >= tr.bottom - 1
    const onScreen = sr && sr.top >= 0 && sr.bottom <= innerHeight
    const tap = document.querySelector('#rib-coach-v119 [data-c-tap]'), tapr = tap && !tap.hidden ? tap.getBoundingClientRect() : null
    const tapNear = !!(tapr && tr && Math.abs((tapr.left + tapr.width / 2) - (tr.left + tr.width / 2)) < tr.width / 2 && (Math.abs(tapr.bottom - tr.top) < 40 || Math.abs(tapr.top - tr.bottom) < 40))
    return { stop: C.stop, line: C.line, spot: C.spot, shown: !!sr, dimHidden: !!dim && dim.hidden, inside: !!inside, onScreen: !!onScreen, next: nextBtn && nextBtn.textContent, tapShown: !!tapr, tapNear, tapPulse: !!spot && spot.classList.contains('tap'), sr: sr && [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)], tr: tr && [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)] }
  })
  ok(spot.tapShown && spot.tapNear && spot.tapPulse, 'a line that wants a tap puts the TAP HERE hand over the thing and pulses the cut-out gold', JSON.stringify({ tapShown: spot.tapShown, tapNear: spot.tapNear, pulse: spot.tapPulse }))
  ok(spot.stop === 'menu' && spot.line === 4 && spot.shown && spot.dimHidden && spot.inside && spot.onScreen && /GOT IT/.test(spot.next || ''), "the menu stop's last line lights the HONORS chip — he sends you to the prestige tree first — and the button reads GOT IT", JSON.stringify(spot))
  await shot(page, 'spotlight')
  const wide = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
  ok(wide <= 400, 'nothing scrolls sideways at 400px with the coach open', wide + 'px')
  // keyboard: the left arrow goes back a line, the right finishes the line or moves on
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150)
  const backed = await H(page)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150)
  const fwd = await H(page)
  ok(backed.line === 3 && fwd.line === 4, 'the arrows walk the lines', `${backed.line} -> ${fwd.line}`)
  // GOT IT closes the stop, marks it seen, and leaves the switch ON for the next screen
  await page.click('#rib-coach-v119 [data-c-next]'); await page.waitForTimeout(400)
  h = await H(page)
  const tileOn = await page.evaluate(() => (document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]') || {}).getAttribute?.('aria-checked'))
  ok(!h.open && h.closedBy === 'gotit' && h.enabled && tileOn === 'true' && h.seen.includes('menu') && h.current === null, 'GOT IT sends him off, the stop is remembered as seen, and the switch stays ON for the next screen', JSON.stringify({ closedBy: h.closedBy, enabled: h.enabled, seen: h.seen, current: h.current }))
  // an ON switch tapped while he is idle: OFF; tapped again: ON, the walk starts over
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]'); await page.waitForTimeout(300)
  const off = await H(page)
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 8000 }).catch(() => null)
  const on = await H(page)
  ok(!off.open && !off.enabled && on.open && on.enabled && on.stop === 'menu' && on.seen.length === 0, 'the switch: ON and idle → OFF; OFF → ON, and the walk starts over from the menu', JSON.stringify({ off: off.enabled, on: on.enabled, stop: on.stop, seen: on.seen }))
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  h = await H(page)
  const tile2 = await page.evaluate(() => (document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]') || {}).getAttribute?.('aria-checked'))
  const stored = await page.evaluate((k) => localStorage.getItem(k), await page.evaluate(() => window.__RIB_COACH.key))
  ok(!h.open && h.closedBy === 'skip' && !h.enabled && tile2 === 'false' && stored === 'off', 'Escape skips him and switches it OFF, and the switch remembers', JSON.stringify({ tile: tile2, stored }))
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page)
  const tile3 = await page.evaluate(() => (document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]') || {}).getAttribute?.('aria-checked'))
  ok(tile3 === 'false', 'after a reload the switch still reads OFF')
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 8000 })
  h = await H(page)
  ok(h.open && h.enabled && h.stop === 'menu', 'switching it back ON replays from the menu stop')
  await page.evaluate(() => window.__RIB_COACH.skip()); await page.waitForTimeout(200)
  h = await H(page)
  ok(!h.open && !h.enabled, 'SKIP closes him and switches it OFF again')
  // ?coachTour starts him on the first mount
  await page.goto(U('coachTour'), { waitUntil: 'networkidle', timeout: 30000 }); await menuUp(page)
  await page.waitForSelector('#rib-coach-v119', { timeout: 8000 }).catch(() => null)
  h = await H(page)
  ok(h && h.open && h.openedBy === 'query' && h.enabled, '?coachTour switches it ON and starts him on the first menu mount', h && JSON.stringify({ open: h.open, by: h.openedBy, enabled: h.enabled }))
  await context.close()
}

// ================= 2. the walk: one stop per screen of a first week, in order, never twice =================
{
  const { page, context } = await newPage()
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(800)
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  let h = await waitStop(page, 'menu')
  ok(h && h.open && h.stop === 'menu', 'the walk begins on the menu', h && `${h.stop} by ${h.openedBy}`)
  const order = [h && h.stop]
  const expect = async (id, what, extra) => {
    const s = await waitStop(page, id, (extra && extra.ms) || 12000)
    order.push(s && s.stop)
    ok(s && s.open && s.stop === id && s.openedBy === 'page', `${what}: he pops in with the ${id.toUpperCase()} stop`, JSON.stringify({ stop: s && s.stop, by: s && s.openedBy, current: s && s.current, view: await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } }) }))
    if (extra && extra.spot) { await page.waitForTimeout(500); const sp = await page.evaluate(() => { const spot = document.querySelector('#rib-coach-v119 [data-c-spot]'); const r = spot && !spot.hidden ? spot.getBoundingClientRect() : null; return { key: window.__RIB_COACH.spot, shown: !!r, onScreen: !!(r && r.bottom > 40 && r.top < innerHeight - 40 && r.width > 20) } }); ok(sp.key === extra.spot && sp.shown && sp.onScreen, `  …and lights ${extra.spot} on that screen`, JSON.stringify(sp)) }
    if (shots) await shot(page, 'stop-' + id)
    return s
  }
  await dismiss(page)
  // v134: the tree first. The chip opens the shop, the PRESTIGE stop walks it, BACK returns to the menu, and CAREER is its own stop
  await page.evaluate(() => { const c = document.querySelector('.prestige-chip'); c && c.click() }); await page.waitForTimeout(700)
  await expect('prestige', 'the prestige tree, off the HONORS chip')
  await page.evaluate(() => { const C = window.__RIB_COACH; C.next(); C.next() }); await page.waitForTimeout(500)
  { const sp = await page.evaluate(() => { const spot = document.querySelector('#rib-coach-v119 [data-c-spot]'); const r = spot && !spot.hidden ? spot.getBoundingClientRect() : null; return { key: window.__RIB_COACH.spot, shown: !!r, onScreen: !!(r && r.bottom > 40 && r.top < innerHeight - 40 && r.width > 20) } }); ok(sp.key === 'branches' && sp.shown && sp.onScreen, '  …and its third line lights the branch strip', JSON.stringify(sp)) }
  await dismiss(page)
  await step(page, 'BACK', 900)   // the dock's ghost button; innerText is upper-cased by the CSS
  await expect('career', 'back on the menu: the CAREER tap', { spot: 'career' }); await dismiss(page)
  await step(page, 'START NEW CAREER'); await expect('persona', 'the personality roll'); await dismiss(page)
  await step(page, 'Lock In Personality'); await expect('position', 'the position pick'); await dismiss(page)
  await step(page, 'POS'); await expect('hub', 'the hub'); await dismiss(page)
  await step(page, 'PLAY 8-GAME SEASON')
  const wheel = await expect('wheel', 'the season-commitment wheel, over the training board')
  // the wheel spins itself and rolls the fit; CONTINUE arrives with the roll — the last line's cut-out waits for it
  await page.waitForFunction(() => { const g = document.getElementById('gv42go'); return g && g.style.display !== 'none' && g.getBoundingClientRect().height > 0 }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => { const C = window.__RIB_COACH, S = C.stops.find((x) => x.id === C.stop), last = (S ? S.lines : 1) - 1; let n = 0; while (C.isOpen && C.line < last && n++ < 6) C.next() }); await page.waitForTimeout(700)
  const contSpot = await page.evaluate(() => { const C = window.__RIB_COACH, spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), g = document.getElementById('gv42go'); const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, gr = g ? g.getBoundingClientRect() : null
    return { line: C.line, key: C.spot, shown: !!sr, over: !!(sr && gr && sr.left <= gr.left + 1 && sr.right >= gr.right - 1 && sr.top <= gr.top + 1 && sr.bottom >= gr.bottom - 1) } })
  ok(wheel && wheel.stop === 'wheel' && contSpot.key === 'cont' && contSpot.shown && contSpot.over, "the wheel stop's last line lights CONTINUE once the roll is in", JSON.stringify(contSpot))
  await dismiss(page)
  await page.click('#gv42go'); await page.waitForTimeout(600)
  await expect('training', 'the training board (the wheel gone)'); await dismiss(page)
  await step(page, 'CONFIRM TRAINING'); await expect('season', 'the season screen', { spot: 'body' }); await dismiss(page)
  await step(page, 'PLAY WEEK 1 LIVE')
  // v135: PLAY WEEK opens the wizard straight away — no wheel over the season screen first — and the
  // plan wheel spins on the wizard's FIFTH page, so the pregame stop comes before the plan stop
  await page.waitForSelector('#pregameV1513', { timeout: 15000 }).catch(() => null)
  ok(await page.evaluate(() => !document.getElementById('growthV42')), 'PLAY WEEK opens the pregame with no wheel spun over the season screen (v135)')
  await expect('pregame', 'the pregame wizard'); await dismiss(page)
  for (let p = 0; p < 4; p++) { const n = await step(page, p === 3 ? 'SPIN THE WHEEL' : 'NEXT', 700); if (!n) break }
  const plan = await expect('plan', 'the weekly-plan wheel, on the fifth page')
  ok(await page.evaluate(() => !!document.querySelector('#v112Page5 #growthV42')), '  …and the wheel he talks over is the one inside the wizard')
  await page.waitForFunction(() => { const g = document.getElementById('gv42go'); return g && g.style.display !== 'none' && g.getBoundingClientRect().height > 0 }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => { const C = window.__RIB_COACH, S = C.stops.find((x) => x.id === C.stop), last = (S ? S.lines : 1) - 1; let n = 0; while (C.isOpen && C.line < last && n++ < 6) C.next() }); await page.waitForTimeout(700)
  const planSpot = await page.evaluate(() => { const C = window.__RIB_COACH, spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), g = document.getElementById('gv42go'); const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, gr = g ? g.getBoundingClientRect() : null
    return { line: C.line, key: C.spot, shown: !!sr, over: !!(sr && gr && sr.left <= gr.left + 1 && sr.right >= gr.right - 1 && sr.top <= gr.top + 1 && sr.bottom >= gr.bottom - 1) } })
  ok(plan && plan.stop === 'plan' && planSpot.key === 'cont' && planSpot.shown && planSpot.over, "the plan stop's last line lights CONTINUE once the plan is rolled", JSON.stringify(planSpot))
  await dismiss(page)
  await page.click('#gv42go'); await page.waitForTimeout(600)
  await step(page, 'CONTINUE TO MATCH', 1500)
  await expect('live', 'the broadcast', { ms: 60000 }); await dismiss(page)
  // run the game out at the fastest speed, clicking through any sheet over the field (never the post-game card)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.speed-btn[data-spd]')].sort((x, y) => parseFloat(y.dataset.spd) - parseFloat(x.dataset.spd))[0]; if (b) b.click() })
  const tGame = Date.now(); let reopened = 0
  while (Date.now() - tGame < 300000) {
    const s = await page.evaluate(() => { const pg = document.getElementById('pgOverlayV13'); if (pg && pg.getBoundingClientRect().height > 0) return 'pg'; if (window.__RIB_COACH.isOpen) return 'coach'
      const b = [...document.querySelectorAll('button')].find((x) => /^\s*CONTINUE\s*$/i.test(x.innerText || '') && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119') && !x.closest('#pgOverlayV13')); if (b) { b.click(); return 'sheet' } return null })
    if (s === 'pg') break
    if (s === 'coach') reopened++
    await page.waitForTimeout(600)
  }
  ok(reopened === 0, 'he does not come back during the game once the live stop is read', `${reopened} reopenings`)
  await expect('result', 'the post-game card', { ms: 60000 }); await dismiss(page)
  await page.evaluate(() => { const el = document.getElementById('pgOverlayV13'); const b = el && [...el.querySelectorAll('button')].find((x) => /CONTINUE|NEXT|CLOSE/i.test(x.innerText || '')); if (b) b.click() })
  const rec = await expect('recovery', 'the season screen after the game', { ms: 15000, spot: 'body' })
  await page.evaluate(() => { const C = window.__RIB_COACH, S = C.stops.find((x) => x.id === C.stop), last = (S ? S.lines : 1) - 1; let n = 0; while (C.isOpen && C.line < last && n++ < 6) C.next() }); await page.waitForTimeout(400)
  const doneBtn = await page.evaluate(() => (document.querySelector('#rib-coach-v119 [data-c-next]') || {}).textContent || '')
  ok(rec && rec.stop === 'recovery' && /DONE/.test(doneBtn), "the last stop's button reads DONE", JSON.stringify(doneBtn))
  await shot(page, 'recovery')
  h = await dismiss(page)
  const storedEnd = await page.evaluate((k) => localStorage.getItem(k), await page.evaluate(() => window.__RIB_COACH.key))
  ok(!h.open && h.closedBy === 'done' && !h.enabled && storedEnd === 'off', 'DONE ends the walk and switches him OFF, remembered', JSON.stringify({ closedBy: h.closedBy, enabled: h.enabled, stored: storedEnd }))
  const want = ['menu', 'prestige', 'career', 'persona', 'position', 'hub', 'wheel', 'training', 'season', 'pregame', 'plan', 'live', 'result', 'recovery']
  ok(JSON.stringify(order) === JSON.stringify(want) && h.opens === want.length && h.seen.length === want.length, 'fourteen stops of the week, one per screen, in the order a first week meets them — the tree before the player — none twice', JSON.stringify({ order, opens: h.opens }))
  // and off, the season screen stays quiet
  await page.waitForTimeout(2500)
  const quiet = await H(page)
  ok(!quiet.open, 'switched off, he stays off')
  // v134: the skill-point sheet (TRAINING on the menu, view `upgrade`) gets its OWN stop -- about skills, never prestige --
  // and the prestige tree (view `shop`) keeps the PRESTIGE stop. He used to say the prestige lines on the skill sheet.
  await page.evaluate(() => { window.__RIB_COACH.resetSeen(); window.__RIB_COACH.setEnabled(true); window.go('upgrade') })
  const sk = await waitStop(page, 'skills')
  const skText = await page.evaluate(() => { const C = window.__RIB_COACH; const S0 = C.stops.find((x) => x.id === 'skills'); return S0 ? S0.lines : 0 })
  ok(sk && sk.open && sk.stop === 'skills' && sk.openedBy === 'page', 'the skill-point sheet (TRAINING on the menu) gets a SKILLS stop — points, KEY stats, the soft cap, DONE', JSON.stringify({ stop: sk && sk.stop, lines: skText, view: await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } }) }))
  const skillsSaysPrestige = await page.evaluate(() => /prestige/i.test(document.querySelector('#rib-coach-v119 [data-c-text]')?.textContent || ''))
  ok(!skillsSaysPrestige, 'and on the skill sheet he never talks prestige')
  await shot(page, 'stop-skills')
  await page.evaluate(() => { window.__RIB_COACH.close('check'); window.go('shop') })
  const pres = await waitStop(page, 'prestige')
  ok(pres && pres.open && pres.stop === 'prestige' && pres.openedBy === 'page', 'the prestige tree (the HONORS chip, view shop) gets the PRESTIGE stop — PP vs Honors, the branches, the Apex shelf', JSON.stringify({ stop: pres && pres.stop, view: await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } }) }))
  await shot(page, 'stop-prestige')
  await context.close()
}

// ================= 3. a real first visit: the welcome cards, then the coach =================
{
  const { page, context } = await newPage({ realFirstVisit: true })
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  const cards = await page.waitForSelector('.onboard', { timeout: 15000 }).catch(() => null)
  const stack = await page.evaluate(() => { const c = document.querySelector('.onboard'), m = document.getElementById('rib-main-menu-v2'); return c && m ? { cards: +getComputedStyle(c).zIndex, menu: +getComputedStyle(m).zIndex } : null })
  ok(!!cards && stack && stack.cards > stack.menu, "the game's own welcome cards show on a first visit, ABOVE the menu overlay (they were buried under it)", JSON.stringify(stack))
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  const early = await H(page)
  ok(early && !early.open, 'he waits while the cards are up')
  let clicks = 0
  for (let i = 0; i < 3 && cards; i++) { const b = await page.$('.onboard #onNext'); if (!b) break; await b.click({ timeout: 8000 }); clicks++; await page.waitForTimeout(350) }
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 10000 }).catch(() => null)
  const h = await H(page)
  ok(clicks === 3 && h && h.open && h.openedBy === 'welcome' && h.stop === 'menu', 'clicked through, the cards hand straight to the coach on the menu', JSON.stringify({ clicks, open: h && h.open, by: h && h.openedBy }))
  await shot(page, 'firstvisit')
  // cut short (the page reloaded mid-stop), the switch is still ON and the menu stop plays again
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page)
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 30000 }).catch(() => null)
  const again = await H(page)
  ok(again && again.open && again.openedBy === 'page' && again.stop === 'menu', 'a stop cut short by a reload plays again at the next visit', JSON.stringify({ open: again && again.open, by: again && again.openedBy, stop: again && again.stop }))
  await page.evaluate(() => window.__RIB_COACH.skip())
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page); await page.waitForTimeout(6000)
  const done = await H(page)
  ok(done && !done.open && !done.enabled, 'once skipped, a later visit does not start him on its own', JSON.stringify({ open: done && done.open, enabled: done && done.enabled }))
  await context.close()
}

// ================= 4. the season debrief: he reads the year back, tour or no tour =================
{
  const { page, context } = await newPage({ w: 420, h: 900 })
  // the tour switched OFF on purpose: a season report card is its own occasion and still gets him
  await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} })
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 40000 }).catch(() => null)
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(page, t)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(250) }
  await step(page, 'CONFIRM TRAINING')
  // the capture has to happen in front of the roll, so prove it sees the week rows first
  await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(1500)
  const cap = await page.evaluate(() => { const D = window.__DEBRIEF_V122; return D ? D.cap() : null })
  ok(cap && cap.games >= 4 && cap.fatKick.length === cap.games && cap.perf.length === cap.games && cap.rolls >= 1,
    'the week rows are read BEFORE the roll clears them — ratings, fatigue at each kickoff, the plan rolls', cap && JSON.stringify({ games: cap.games, fatMean: cap.fatMean, rolls: cap.rolls, injured: cap.injured }))
  // drive the season out through the game's own entry points rather than hunting for buttons: a
  // story card or a decision sheet can sit in front of the dock for a beat and swallow the click
  for (let i = 0; i < 30; i++) {
    const v = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
    if (v === 'result') break
    await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(500)
    // simRemainingWeeks skips PLAYOFF weeks, so a team that qualified would stall here forever:
    // resolve whatever is left through the engine's own week resolver, exactly as v111Acheck does
    await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player
      for (const w of (p.weekResults || [])) { if (!w || w.played) continue
        try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {}
        w.played = true; w.won = !!(w.us > w.them) } }); await page.waitForTimeout(300)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*(CONTINUE|OK|CLOSE|NEXT)\s*$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119')); if (b) b.click() })
    await page.waitForTimeout(400)
    await page.evaluate(() => { try { window.finishSeasonGames && window.finishSeasonGames() } catch (e) {} }); await page.waitForTimeout(700)
  }
  const view = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
  ok(view === 'result', 'a season was played to the report card', String(view))
  // THE REPORT CARD IS ONE CARD: the depth chart used to be injected INSIDE the 112px grade ring
  const lay = await page.evaluate(() => {
    const sc = document.getElementById('screen'), dc = sc && sc.querySelector('.depth-card')
    const ring = sc && sc.querySelector('.grade-ring'), grade = sc && sc.querySelector('.season-grade')
    let overlaps = 0, prev = null, boxes = []
    for (const el of sc.children) { const r = el.getBoundingClientRect(); if (prev != null && r.top < prev - 1) overlaps++; prev = r.bottom
      boxes.push(String(el.className).slice(0, 22) + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
    return { depthTop: !!(dc && dc.parentElement === sc), depthInRing: !!(dc && ring && ring.contains(dc)),
      ringKids: ring ? ring.children.length : -1, ringHasGradeOnly: !!(ring && grade && ring.children.length === 1),
      overlaps, n: sc.children.length, boxes: boxes.slice(0, 6) }
  })
  ok(lay.depthTop && !lay.depthInRing && lay.ringHasGradeOnly, 'the report card is ONE card — the depth chart is its own sibling, and the grade ring holds nothing but the grade', JSON.stringify(lay))
  ok(lay.overlaps === 0, 'nothing on the report screen overlaps the card above it', JSON.stringify({ overlaps: lay.overlaps, n: lay.n }))
  await shot(page, 'season-result')
  // v132: the offseason body screen opens over the report card first, and the coach waits at the door
  // until it is dismissed — so prove it is up, then hand over to the report card the way a player would
  const grow = await page.evaluate(() => { const G = window.__GROW_V132; return G ? { open: G.open, el: !!document.getElementById('growV132'), age: G.last && G.last.age, prev: G.last && G.last.prev } : null })
  ok(grow && grow.open && grow.el && grow.age === grow.prev + 1, 'v132: the offseason body screen is up over the report card, a year older', JSON.stringify(grow))
  const heldOff = await H(page)
  ok(!(heldOff && heldOff.open), 'and the coach waits at its door rather than talking over it', JSON.stringify({ open: heldOff && heldOff.open }))
  await page.evaluate(() => { const b = document.querySelector('#growV132 [data-gw-go]'); if (b) b.click(); else window.__GROW_V132.close() }); await page.waitForTimeout(600)
  // and the coach reads the year back
  const d = await waitStop(page, 'debrief', 15000)
  ok(d && d.open && d.stop === 'debrief' && d.openedBy === 'season', 'the coach pops in on the report card with the season debrief, though the tour is OFF', JSON.stringify({ stop: d && d.stop, by: d && d.openedBy, enabled: d && d.enabled }))
  const brief = await page.evaluate(() => { const C = window.__RIB_COACH, D = window.__DEBRIEF_V122
    const L = C.debrief.lines() || [], all = L.map(x => x.t).join(' ')
    const b = D.get() || {}
    return { n: L.length, all, kinds: (b.notes || []).map(x => x.k), head: b.head, focus: b.focus && b.focus.program,
      rank: !!b.rank, chance: b.chance, crumb: (document.querySelector('#rib-coach-v119 [data-c-crumb]') || {}).textContent,
      skip: (document.querySelector('#rib-coach-v119 [data-c-skip]') || {}).textContent,
      record: b.record, grade: b.grade, dyn: L.every(x => x.t && x.t.length > 8) } })
  ok(brief.n >= 5 && brief.n <= 8 && brief.dyn, 'he says six or seven lines, all built from this season', JSON.stringify({ n: brief.n }))
  ok(brief.head && brief.record && brief.all.includes(brief.record), 'he opens with the record and the grade', JSON.stringify(brief.head))
  ok(brief.kinds.length >= 4 && ['fatigue', 'luck', 'expect', 'track'].filter(k => brief.kinds.includes(k)).length >= 3,
    'the notes cover the ground asked for — fatigue, the rolls, expectations, the ladder', JSON.stringify(brief.kinds))
  ok(/call-up[^.]*reads about \d+%/.test(brief.all) && /the bar is \d+/i.test(brief.all) && brief.kinds.includes('track'),
    'he always says where you stand against the level bar and what the call-up reads', JSON.stringify((brief.all.match(/[^.]*call-up[^.]*\./) || [brief.all.slice(0, 140)])[0]))
  ok(!!brief.focus && brief.all.includes(brief.focus), 'he names what to work on next season', JSON.stringify(brief.focus))
  ok(/SEASON \d/.test(brief.crumb || '') && /^SKIP\s*×?$/.test((brief.skip || '').replace(/\s+/g, ' ').trim()), 'the debrief wears its own chrome — a season crumb, not a step of the walk', JSON.stringify({ crumb: brief.crumb, skip: brief.skip }))
  await shot(page, 'debrief')
  // read once a season, and the tour switch is untouched by it
  const after = await dismiss(page)
  const post = await page.evaluate(() => ({ seen: window.__DEBRIEF_V122.lastSeen(), due: !!window.__RIB_COACH.debrief.due(), tour: localStorage.getItem('rib.coachTour.v119'), off: window.__RIB_COACH.debrief.off }))
  ok(!after.open && !post.due && post.tour === 'off' && !post.off, 'DONE marks the season read — it does not come round twice, and it never touched the tour switch', JSON.stringify(post))
  // v136 B: the COACH'S SUMMARY button on the report card, and its AUTO switch — separate from the tour
  const sum = await page.evaluate(() => { const row = document.querySelector('.coach-sum-v136'), btn = document.querySelector('.coach-sum-btn-v136'); return { row: !!row, btn: !!btn && !btn.disabled, auto: window.__V136_B.auto(), tour: localStorage.getItem('rib.coachTour.v119') } })
  ok(sum.row && sum.btn && sum.auto && sum.tour === 'off', "the report card carries a COACH'S SUMMARY button with AUTO on, while the tour is OFF (v136)", JSON.stringify(sum))
  await page.click('.coach-sum-btn-v136'); await page.waitForTimeout(900)
  const again = await H(page)
  ok(again && again.open && again.stop === 'debrief' && again.openedBy === 'button', 'the button brings the debrief back on demand, after it was already read', JSON.stringify({ open: again && again.open, stop: again && again.stop, by: again && again.openedBy }))
  await dismiss(page)
  await page.evaluate(() => window.__V136_B.setAuto(false)); await page.waitForTimeout(200)
  const off = await page.evaluate(() => ({ auto: window.__V136_B.auto(), off: window.__RIB_COACH.debrief.off, due: !!window.__RIB_COACH.debrief.due(), tour: localStorage.getItem('rib.coachTour.v119'), desc: (document.querySelector('.coach-sum-auto-v136 .toggle-desc') || {}).textContent, btn: !!document.querySelector('.coach-sum-btn-v136') }))
  ok(!off.auto && off.off && !off.due && off.tour === 'off' && /button/.test(off.desc || '') && off.btn, 'AUTO off: he will not pop in by himself, the button stays, and the tour switch is untouched', JSON.stringify(off))
  await page.evaluate(() => window.__V136_B.setAuto(true))
  await context.close()
}

// ================= 4. the league is the DFL, everywhere the player reads =================
{
  const { page, context } = await newPage()
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 30000 }); await menuUp(page)
  await page.click('#rib-main-menu-v2 [data-rib-action="howto"]'); await page.waitForSelector('#rib-howto-v111', { timeout: 8000 })
  await page.evaluate(() => window.__RIB_HOWTO.sections.forEach((id) => window.__RIB_HOWTO.toggle(id, true)))
  const txt = await page.evaluate(() => (document.getElementById('rib-howto-v111').textContent + ' ' + document.getElementById('rib-main-menu-v2').textContent + ' ' + JSON.stringify(window.__RIB_COACH.stops)))
  const coachText = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.src).find((u) => /rib-menu-coach/.test(u)); return fetch(s).then((r) => r.text()) })
  const bad = (txt + coachText).match(/\bNFL\b|Pro Bowl/g) || []
  ok(bad.length === 0 && /\bDFL\b/.test(txt), 'the guide, the menu and the coach say DFL — the real league name is gone', bad.length ? bad.slice(0, 4).join(',') : 'DFL present, NFL absent')
  await context.close()
}

console.log(JSON.stringify({ pass, fail, errors: errors.length }))
console.log('page errors:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
