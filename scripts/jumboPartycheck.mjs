// Dev check: v177 C THE BOARD THROWS A PARTY (src/05-field-renderer.js, the drawn bodies from src/28-cosmetics.js `v177 C`).
//   After v175's pan lands on the stadium screen and the moment's badge has shown, a touchdown or a key defensive play
//   (sack, interception, turnover, big hit) hands the panel to a celebration: the man who made it plays one of the three
//   drawn bodies ON the board (his kit; HIS moment: his equipped celebration's plan and callout), clipped to the panel, and
//   fireworks and pyro go off behind and beside the screen.
//   1. THE REAL PATH: with every play panning (the v175 chance at 1) and the party allowed on a plain scoreboard pan, a
//      whistle arms it, the post holds longer, and it starts only once the camera is on the screen, after the badge's beat.
//   2. ON THE BOARD: the body is drawn inside the panel, masked to it, the badge has given way, the screen's feed is off;
//      rockets, bursts, flame jets and fireballs go up; the sky layer sits BEHIND the screen and the bowl, above the turf.
//   3. HIS touchdown with an equipped celebration: his kit, the item's callout as the caption; a SACK by another man: a stock
//      body, "SACK" on the caption; reduced motion (TU partyCalmV177C 1): one calm pose, no pyro, three gentle bursts.
//   4. It ends (its own course or the snap) and hands the screen back; TU v177Cparty 0: no party on the same pans. No page errors.
//   GAME_URL=http://localhost:5173/ node scripts/jumboPartycheck.mjs     (screenshots: scripts/_jumboParty_*.png)
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (tune, tag) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0 }, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V170, null, { timeout: 40000 })
  await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'WR'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
    for (const k in pl.attrs) pl.attrs[k] = 60; A.startSeasonGames(); window.go('season')
  })
  await p.waitForTimeout(400)
  await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
  await p.evaluate(() => window.__v112SkipD())
  await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && window.__gridironScene.stadium && window.__gridironScene.stadium.rect, null, { timeout: 60000 }).catch(() => null)
  // the drawn bodies decode on their own clock
  await p.evaluate(async () => { const BC = window.RIB_COSMETICS && window.RIB_COSMETICS.boardCel; if (!BC) return; BC.load(); await new Promise((r) => { const t0 = Date.now(); const w = () => (BC.ready() || Date.now() - t0 > 10000) ? r() : setTimeout(w, 100); w() }) })
  return { ctx, p }
}
const shot = async (p, name) => { try { const box = await p.evaluate(() => { const r = window.__gridironScene.game.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }); await p.screenshot({ path: `scripts/_jumboParty_${name}.png`, clip: box }) } catch (e) {} }
const ALL_PANS = { screenPanChanceV175: 1, screenPanGapV175: 0, partyKindsV177C: ['touchdown', 'turnover', 'intercepted', 'sack', 'bighit', 'scoreboard'] }

{
  const { ctx, p } = await open(ALL_PANS, 'on')
  ok(await p.evaluate(() => !!(window.RIB_COSMETICS && window.RIB_COSMETICS.boardCel && window.RIB_COSMETICS.boardCel.ready())), 'the drawn bodies are loaded for the board (RIB_COSMETICS.boardCel)')
  // 1. the real path: watch plays until a party is on the board, sample it while it runs
  let atStart = null, mid = null, ended = null, sampledShot = false
  for (let i = 0; i < 200 && !(mid && ended); i++) {
    const st = await p.evaluate(() => { const sc = window.__gridironScene, V = window.__V177C || {}, V5 = window.__V175 || {}, PT = sc && sc._partyV177C
      return { s: V.state ? V.state() : null, started: V.started || 0, ended: V.ended || 0, pan: !!(sc && sc._panV175), panT: sc && sc._panV175 ? Math.round(sc._panV175.t) : 0, inFrame: !!V5.inFrame, t: PT && PT.state === 'board' ? Math.round(PT.t) : null, last: V.last, hold: sc ? sc.screenPanHoldMsV175() : 0 } })
    if (st.s && st.s.state === 'board' && !atStart) atStart = st
    if (st.s && st.s.state === 'board' && st.t > 700 && !mid) { mid = st; if (!sampledShot) { sampledShot = true; await shot(p, 'board') } }
    if (mid && st.ended >= 1 && !ended) ended = st
    await p.waitForTimeout(st.s && st.s.state === 'board' ? 120 : 250)
  }
  ok(!!atStart, 'a whistle that pans to the screen arms the party and it starts on the board', atStart && { panT: atStart.panT, inFrame: atStart.inFrame, hold: atStart.hold })
  ok(atStart && atStart.pan && atStart.panT >= 1500 && atStart.inFrame, '…only once the camera is on the screen, after the badge has had its beat (pan held ≥ 1.5 s, the screen in the frame)', atStart && { pan: atStart.pan, panT: atStart.panT, inFrame: atStart.inFrame })
  const S = mid && mid.s
  ok(S && S.body && S.body.inPanel && S.masked, 'the celebrating body is drawn inside the panel, clipped to it', S && { body: S.body, masked: S.masked })
  ok(S && !S.badge && S.mode === 'msg', 'the badge has given the panel over and the feed is off while it plays', S && { badge: S.badge, mode: S.mode })
  ok(S && S.sky && (S.sky.rockets + S.sky.sparks) > 0, 'fireworks are going up behind the screen', S && S.sky)
  ok(S && S.depths && S.depths.sky < S.depths.screen && S.depths.sky < S.depths.crowd && S.depths.sky > 1, 'the sky layer is drawn BEHIND the screen and the bowl, above the turf', S && S.depths)
  ok(S && S.depths && S.depths.body > S.depths.screen, 'the body is drawn on the screen (above its panel)', S && S.depths)
  ok(!!ended, 'the party ends (its own course or the snap)', ended && ended.last && { ended: ended.last.ended, ms: ended.last.ms })
  const fw = await p.evaluate(() => window.__V177C.fw)
  ok(fw.rockets >= 4 && fw.bursts >= 1 && fw.jets >= 1 && fw.booms >= 1, 'rockets, bursts, flame jets and fireballs all fired', fw)
  // after it ends, the screen is handed back
  await p.waitForTimeout(1500)
  const back = await p.evaluate(() => { const sc = window.__gridironScene, PT = sc._partyV177C, B = sc._pbV177C; return { party: PT ? PT.state : null, layers: B ? B.all.filter((o) => o.visible).length : 0, mode: sc.stadium.mode } })
  ok(back.party === 'board' || back.layers === 0, 'and the board layers are put away when it is over', back)
  const errs = await p.evaluate(() => (window.__V177C || {}).errs || [])
  ok(errs.length === 0, 'the party drew without an error', errs.slice(0, 3))
  // 3. forced moments on the screen: freeze the play loop, hold the camera on the board
  await p.evaluate(() => {
    const sc = window.__gridironScene; sc.partyEndV177C('test'); sc._panV175 = null
    const R = sc.stadium.rect, cam = sc.cameras.main
    sc.events.on('postupdate', () => { try { cam.setZoom(sc.camZoomFitV112(0.42 * 720 / R.w)); cam.centerOn(R.x + R.w / 2, R.y + R.h * 1.1) } catch (e) {} })
    window.RIB_TUNE.screenPanChanceV175 = 0
  })
  const youTD = await p.evaluate(async () => {
    const CO = window.RIB_COSMETICS; CO.equip('celebration', 'cel_shock')
    const it = CO.boardCel.item()
    window.__V177C.play('touchdown', { hero: { idx: -1, you: true, kit: 'you', name: 'MAN', tone: null } })
    await new Promise((r) => setTimeout(r, 900))
    return { it, st: window.__V177C.state(), last: window.__V177C.last }
  })
  await shot(p, 'you_td')
  ok(youTD.it && youTD.st.you && youTD.st.item === youTD.it.id && youTD.st.caption === youTD.it.say, 'HIS touchdown: his equipped celebration plays round him and its callout is the caption', { item: youTD.it && youTD.it.id, caption: youTD.st.caption, say: youTD.it && youTD.it.say })
  await p.waitForTimeout(3500)
  // HIS equipped v177 I body (a super celebration with a drawn routine of its own) is what the board plays
  const moon = await p.evaluate(async () => {
    const CO = window.RIB_COSMETICS, BC = CO.boardCel; CO.grant('cel_moonwalk', 'super'); const eq = CO.equip('celebration', 'cel_moonwalk')
    if (!BC.body177) return { eq, api: false }
    await new Promise((r) => { const t0 = Date.now(); const w = () => (BC.body177() || Date.now() - t0 > 10000) ? r() : setTimeout(w, 150); w() })
    window.__V177C.play('touchdown', { hero: { idx: -1, you: true, kit: 'you', name: 'MAN', tone: null } })
    await new Promise((r) => setTimeout(r, 1200))
    const st = window.__V177C.state(), last = window.__V177C.last
    CO.equip('celebration', 'cel_shock')
    return { eq, api: true, body: last.body, item: st.item, key: st.body && st.body.key, inPanel: !!(st.body && st.body.inPanel), errs: window.__V177C.errs.slice(0, 2) }
  })
  await shot(p, 'you_moonwalk')
  ok(moon.eq && moon.body === 'moonwalk' && /cel177_/.test(moon.key || '') && moon.inPanel && !moon.errs.length, 'HIS equipped v177 I body (the moonwalk) is the routine the board plays', moon)
  await p.waitForTimeout(3500)
  const sack = await p.evaluate(async () => {
    window.__V177C.play('sack', { hero: { idx: -1, you: false, kit: 'def', name: 'JONES', tone: 2 } })
    await new Promise((r) => setTimeout(r, 700))
    return window.__V177C.state()
  })
  await shot(p, 'sack')
  ok(sack.state === 'board' && !sack.you && !sack.item && /SACK/.test(sack.caption || '') && /JONES/.test(sack.caption || '') && sack.body && sack.body.inPanel, 'a SACK by another man: a stock body in his kit, his name and SACK on the caption', { caption: sack.caption, body: sack.body && sack.body.key })
  await ctx.close()
}

{
  // reduced motion (the calm switch stands in for the media query)
  const { ctx, p } = await open({ partyCalmV177C: 1, screenPanChanceV175: 0 }, 'calm')
  const calm = await p.evaluate(async () => {
    const sc = window.__gridironScene, R = sc.stadium.rect, cam = sc.cameras.main
    sc.events.on('postupdate', () => { try { cam.setZoom(sc.camZoomFitV112(0.42 * 720 / R.w)); cam.centerOn(R.x + R.w / 2, R.y + R.h * 1.1) } catch (e) {} })
    const fw0 = Object.assign({}, (window.__V177C || { fw: {} }).fw || {})
    window.__gridironScene.partyHookV177C(); const f0 = Object.assign({}, window.__V177C.fw)
    window.__V177C.play('intercepted', { hero: { idx: -1, you: false, kit: 'def', name: 'SMITH', tone: 1 } })
    const keys = new Set(); for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 100)); const s = window.__V177C.state(); if (s.body) keys.add(s.body.key) }
    await new Promise((r) => setTimeout(r, 3500))
    const f1 = window.__V177C.fw
    return { calm: window.__V177C.last.calm, keys: [...keys], rockets: f1.rockets - f0.rockets, jets: f1.jets - f0.jets, booms: f1.booms - f0.booms, flashes: f1.flashes - f0.flashes }
  })
  ok(calm.calm && calm.keys.length === 1 && calm.jets === 0 && calm.booms === 0 && calm.rockets <= 3 && calm.flashes === 0, 'reduced motion: one calm pose, no pyro, no flashes, three gentle bursts at most', calm)
  await ctx.close()
}

{
  // kill switch: the same pans, no party
  const { ctx, p } = await open(Object.assign({ v177Cparty: 0 }, ALL_PANS), 'off')
  for (let i = 0; i < 90; i++) { const n = await p.evaluate(() => (window.__V175 || {}).pans || 0); if (n >= 2) break; await p.waitForTimeout(1000) }
  await p.waitForTimeout(2500)
  const OFF = await p.evaluate(() => ({ pans: (window.__V175 || {}).pans || 0, armed: (window.__V177C || {}).armed || 0, started: (window.__V177C || {}).started || 0 }))
  ok(OFF.pans >= 1 && OFF.armed === 0 && OFF.started === 0, 'TU v177Cparty 0: the screen pans as before, no party', OFF)
  await ctx.close()
}

const pe = await (async () => errors)()
ok(pe.length === 0, 'no page errors', pe.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: pe.length }))
await browser.close()
process.exit(fail ? 1 : 0)
