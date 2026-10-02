// Dev check: v175 THE CAMERA FINDS THE SCREEN (src/05-field-renderer.js).
//   The stadium's screen is back in its own spot (v172's hung board is off by default); a big moment's DRAWN BADGE (the
//   v95 art) plays on that screen; at the whistle the camera pans up onto the screen (slowly, while the men settle),
//   holds it, and the next snap takes the camera back. With the chance forced to every play: a pan happens within a few
//   plays, the screen is in the frame while it holds, and the snap releases it. A forced TOUCHDOWN on the screen is the
//   badge art (not Oswald text) and wants a pan; a FLAG shows its art but does not, and no ribbon is drawn. TU v175pan 0: no pans even at
//   chance 1. No page errors.  GAME_URL=http://localhost:5173/ node scripts/screenpancheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (tune, tag) => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune || {})
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
  return { ctx, p }
}

{
  const { ctx, p } = await open({ screenPanChanceV175: 1, screenPanGapV175: 0 }, 'on')
  const base = await p.evaluate(() => { const sc = window.__gridironScene, ST = sc && sc.stadium; return { live: window.S.view, board: !!(sc && sc.bigBoardUpV172 && sc.bigBoardUpV172()), screen: !!(ST && ST.rect && ST.frame && ST.frame.visible) } })
  ok(base.live === 'live' && base.screen, 'the live game is up with the stadium screen in its own spot', base)
  ok(!base.board, "v172's hung board is off by default (the screen stays where it is)", base)
  // watch plays until a pan has held for a while, then until a snap releases it
  let held = null, released = false
  for (let i = 0; i < 120 && !(held && released); i++) {
    const st = await p.evaluate(() => { const sc = window.__gridironScene, V = window.__V175 || {}; return { pan: !!(sc && sc._panV175), t: sc && sc._panV175 ? sc._panV175.t : 0, pans: V.pans || 0, inFrame: !!V.inFrame, frames: V.frames || 0 } })
    if (st.pan && st.t > 1800 && !held) held = st
    if (held && !st.pan) released = true
    await p.waitForTimeout(300)
  }
  ok(!!held, 'with the chance at every play, the camera pans to the screen and holds it', held)
  ok(held && held.inFrame, 'while it holds, the whole screen is in the frame', held)
  ok(released, 'and the next snap takes the camera back')
  // a touchdown on the screen: the drawn badge, and it wants a pan; a flag shows its art but does not
  await p.waitForTimeout(400)
  const TD = await p.evaluate(async () => {
    const sc = window.__gridironScene; sc.badgeLoadAllV175()
    await new Promise((r) => { const t0 = Date.now(); const w = () => (sc.textures.exists('rib_badge_v175_touchdown') && sc.textures.exists('rib_badge_v175_flag')) || Date.now() - t0 > 8000 ? r() : setTimeout(w, 100); w() })
    sc._panWantV175 = null
    sc.jumboSayV164F('TOUCHDOWN!', { kind: 'touchdown', sub: '42 YARDS', ms: 3000 })
    const ST = sc.stadium, img = ST.msgImg
    const td = { img: !!(img && img.visible), key: img && img.texture && img.texture.key, text: !!(ST.msgT && ST.msgT.visible), sub: ST.msgS && ST.msgS.visible ? ST.msgS.text : null, want: !!sc._panWantV175 }
    sc._panWantV175 = null; sc._artLockV175 = null
    const ribbons0 = sc.children.list.filter((o) => o.depth === 24 && o.type === 'Rectangle').length
    sc.jumboSayV164F('FLAG!', { kind: 'flag', sub: 'HOLDING', ms: 1500 })
    const onScreen = !!(window.__V164F && window.__V164F.last && window.__V164F.last.on)   // out of the frame a non-panning line takes the ribbon
    const sk = { onScreen, key: ST.msgImg && ST.msgImg.visible ? ST.msgImg.texture.key : null, want: !!sc._panWantV175, ribbons: sc.children.list.filter((o) => o.depth === 24 && o.type === 'Rectangle').length - ribbons0 }
    return { td, sk, art: (window.__V175 || {}).art }
  })
  ok(TD.td.img && TD.td.key === 'rib_badge_v175_touchdown' && !TD.td.text && /42 YARDS/.test(TD.td.sub || ''), 'a TOUCHDOWN on the screen is the drawn badge (not text), with its sub-line under it', TD.td)
  ok(TD.td.want, '…and a touchdown wants the camera on the screen', TD.td)
  ok(!TD.sk.want && TD.sk.key === 'rib_badge_v175_flag', 'a FLAG shows its own art on the screen (in the frame or not) and does not pan', TD.sk)
  ok(TD.sk.ribbons === 0, 'no slim ribbon is drawn over the picture any more', TD.sk)
  await ctx.close()
}

{
  const { ctx, p } = await open({ screenPanChanceV175: 1, screenPanGapV175: 0, v175pan: 0 }, 'off')
  await p.waitForTimeout(25000)
  const OFF = await p.evaluate(() => ({ live: window.S.view, pans: (window.__V175 || {}).pans || 0 }))
  ok(OFF.live === 'live' && OFF.pans === 0, 'TU v175pan 0: no pans, even at a chance of every play', OFF)
  await ctx.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
