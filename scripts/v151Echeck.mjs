// Dev check (v151 E THE BAND PLAYS) — the music, the sound settings, the quick mute.
//
//   1. the anthem is served and decodes; the loop is spliced (no hole at the wrap, where the raw file has one);
//   2. where the browser refuses autoplay, nothing plays before a gesture (no running context, no source) — even
//      after the idle fetch; v152 A.2: where it allows it (the native shell, a trusted site), the band starts on load;
//   3. after a real key press the music is playing (a running context, one source, signal on its analyser),
//      and it loops past the track's end without stopping;
//   4. the Settings › SOUND tab fits 400x860 with no page scroll; its toggles and sliders take effect at once
//      and persist across a reload (music on/off, music volume, effects volume, the save's `sound`, the coach's voice);
//   5. MUTE ALL (the top bar's quick mute) silences the music, every other context's effects bus and the coach;
//   6. another context sounding ducks the music (a dip, not a stop);
//   7. a hidden tab pauses (the context suspends) and the return resumes from the same place;
//   8. one instance: several view changes and a second copy of the script leave one source and one API;
//   9. no page errors.
//
//   node scripts/v151Echeck.mjs            (GAME_URL=http://localhost:5500/ to point it at another server)
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noGrowV132'
const b = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await b.newContext({ viewport: { width: 400, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message || e)))
await page.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove() }, 60)
})
const st = () => page.evaluate(() => window.RIB_MUSIC.state())
const wait = ms => page.waitForTimeout(ms)
async function until (fn, ms = 8000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true } catch { return false } }
async function load () {
  await page.goto(U, { waitUntil: 'load', timeout: 40000 })
  await page.waitForFunction(() => !!window.RIB_MUSIC && !!window.__GRIDIRON_AUDIT__, null, { timeout: 30000 })
}
const gesture = () => page.keyboard.press('Shift')   // a trusted keydown: a user activation that clicks nothing

// ------------------------------------------------------------------------------ 1. served
const head = await page.request.get(gameUrl('public/audio/brass_anthem.m4a'))
ok(head.ok() && (await head.body()).length > 2e6, 'the anthem is served', { status: head.status(), type: head.headers()['content-type'] })
const mp3 = await page.request.get(gameUrl('public/audio/brass_anthem.mp3'))
ok(mp3.ok(), 'the mp3 fallback is served', { status: mp3.status() })

// ------------------------------------------------------------------------------ 2. nothing before a gesture
await load()
await wait(4200)   // past the idle fetch
let s = await st()
// v152 A.2: the context is made at load to ASK whether it may run; refused, it waits suspended and nothing sounds
ok(s.state !== 'playing' && (s.ctx == null || s.ctx === 'suspended') && s.started === 0 && s.decks === 0 && s.auto === 'refused', 'the browser refused autoplay: nothing plays before a gesture (the context waits suspended)', { state: s.state, ctx: s.ctx, started: s.started, decks: s.decks, auto: s.auto })
ok(s.fetched && s.blobBytes > 2e6 && !s.decoded, 'the file is fetched once the page is idle (compressed, not decoded)', { fetched: s.fetched, blobBytes: s.blobBytes, decoded: s.decoded })

// ------------------------------------------------------------------------------ 3. a gesture starts it; it loops
await gesture()
const playing = await until(() => { const s = window.RIB_MUSIC.state(); return s.state === 'playing' && s.ctx === 'running' && s.playingDecks === 1 && s.position > 0.3 }, 15000)
s = await st()
ok(playing && s.mode === 'stream' && s.decks === 2 && !s.decoded, 'after a key press the music is playing — streamed, two decks, nothing decoded', { state: s.state, ctx: s.ctx, mode: s.mode, kind: s.kind, decks: s.decks, playing: s.playingDecks, pos: s.position })
await wait(2600)
s = await st()
ok(s.level > 0.005 && s.fade > 0.5, 'it fades in and there is signal on the music bus', { level: s.level, fade: s.fade, gain: s.gain })
const L = await page.evaluate(() => window.RIB_MUSIC.loopInfo())
ok(L && Math.abs(L.duration - 153.57) < 0.5 && L.loopEnd < L.duration && L.loopStart > 0.1, 'the track streams at its length, with the loop points inside it', L)
// the wrap, heard on the music bus: RMS every ~8 ms across the swap
const seam = await page.evaluate(async () => {
  const M = window.RIB_MUSIC, L = M.loopInfo()
  M._seek(L.loopEnd - 1.4)
  const t0 = performance.now(), log = []
  await new Promise(res => { const id = setInterval(() => { log.push([performance.now() - t0, M._rms()]); if (performance.now() - t0 > 2600) { clearInterval(id); res() } }, 8) })
  const s = M.state(), sw = s.swaps[s.swaps.length - 1]
  const at = sw ? sw.at - (Date.now() - performance.now()) - t0 : null
  const win = log.filter(([t]) => at != null && t > at - 200 && t < at + 400).map(x => x[1])
  const all = log.filter(([t]) => t > 300).map(x => x[1]).sort((a, b) => a - b), med = all[Math.floor(all.length / 2)]
  // 24 ms moving mean: the smallest over the swap window
  let minMean = 1; for (let i = 0; i + 3 <= win.length; i++) minMean = Math.min(minMean, (win[i] + win[i + 1] + win[i + 2]) / 3)
  return { swap: sw, samples: win.length, minMean: +minMean.toFixed(4), median: +(med || 0).toFixed(4), loops: s.loops, playingDecks: s.playingDecks, state: s.state, loopEnd: L.loopEnd }
})
ok(seam.swap && Math.abs(seam.swap.out - seam.loopEnd) < 0.12 && Math.abs(seam.swap.in - 0.161) < 0.03, 'the crossfade lands at the loop point: the old deck at LOOP_END, the new one at its first attack', seam.swap)
ok(seam.samples > 10 && seam.minMean > 0.3 * seam.median && seam.minMean > 0.01, 'no hole at the wrap: the level through the crossfade never drops out', { minMean: seam.minMean, median: seam.median, samples: seam.samples })
await wait(600)
s = await st()
ok(s.state === 'playing' && s.loops >= 1 && s.level > 0.005 && s.playingDecks === 1 && s.position < 5, 'it loops past the end without stopping (one deck playing again)', { loops: s.loops, position: s.position, level: s.level, playing: s.playingDecks })

// ------------------------------------------------------------------------------ 6. the duck
const ducked = await page.evaluate(async () => {
  const AC = window.AudioContext || window.webkitAudioContext, c = new AC(); await c.resume()
  const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(window.RIB_MUSIC.sfxOut(c)); o.start()
  let seen = false
  for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 100)); const s = window.RIB_MUSIC.state(); if (s.ducking) seen = true }
  o.stop(); window.__ducktest = c
  await new Promise(r => setTimeout(r, 1500))
  const after = window.RIB_MUSIC.state()
  return { seen, afterDucking: after.ducking, playing: after.state, buses: after.buses }
})
ok(ducked.seen && !ducked.afterDucking && ducked.playing === 'playing', 'another sound ducks the music and it comes back (a dip, not a stop)', ducked)
const coachBus = await page.evaluate(async () => {
  const b0 = window.RIB_MUSIC.state().buses, C = window.__RIB_COACH
  if (C && C.voice) { C.voice.setEnabled(false); C.voice.setEnabled(true) }
  await new Promise(r => setTimeout(r, 200))
  return { before: b0, after: window.RIB_MUSIC.state().buses, coach: !!(C && C.voice) }
})
ok(coachBus.coach && coachBus.after === coachBus.before + 1, "the coach's voice opts into the effects bus", coachBus)

// ------------------------------------------------------------------------------ 7. hidden tab
const hid = await page.evaluate(async () => {
  const setVis = v => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) }
  const before = window.RIB_MUSIC.state().position
  setVis('hidden'); await new Promise(r => setTimeout(r, 900))
  const h = window.RIB_MUSIC.state()
  await new Promise(r => setTimeout(r, 800))
  const h2 = window.RIB_MUSIC.state().position
  setVis('visible'); await new Promise(r => setTimeout(r, 1200))
  const v = window.RIB_MUSIC.state()
  return { before, hidden: { state: h.state, ctx: h.ctx, playing: h.playingDecks, held: +(h2 - h.position).toFixed(3) }, back: { state: v.state, ctx: v.ctx, position: v.position, playing: v.playingDecks } }
})
ok(hid.hidden.state === 'paused' && hid.hidden.ctx === 'suspended' && hid.hidden.playing === 0 && Math.abs(hid.hidden.held) < 0.05, 'a hidden tab pauses (decks paused, the context suspended, the place held)', hid.hidden)
ok(hid.back.state === 'playing' && hid.back.ctx === 'running' && hid.back.playing === 1 && hid.back.position >= hid.before, 'the return resumes from the same place', { ...hid.back, before: hid.before })

// ------------------------------------------------------------------------------ 8. one instance
const one = await page.evaluate(async () => {
  const api = window.RIB_MUSIC
  for (const v of ['settings', 'menu', 'settings', 'menu']) { try { window.go(v) } catch (e) {} await new Promise(r => setTimeout(r, 350)) }
  const sc = document.createElement('script'); sc.src = './src/30-music.js?again=1'; document.body.appendChild(sc)
  await new Promise(r => { sc.onload = r; sc.onerror = r })
  const s = window.RIB_MUSIC.state()
  return { same: window.RIB_MUSIC === api, started: s.started, decks: s.decks, playing: s.playingDecks, state: s.state, audioEls: document.querySelectorAll('audio').length }
})
ok(one.same && one.started === 1 && one.decks === 2 && one.playing === 1 && one.state === 'playing', 'one instance across view changes and a second copy of the script', one)

// ------------------------------------------------------------------------------ 4. Settings › SOUND
await page.evaluate(() => { document.getElementById('splash')?.remove(); window.go('settings') })
await wait(600)
await page.evaluate(() => { const t = [...document.querySelectorAll('.hubv75-tabs button, .hubv75-tabs [data-k], .hubv75-tabs > *')].find(b => /SOUND/.test(b.textContent)); t && t.click() })
await wait(500)
const fit = await page.evaluate(() => {
  const card = document.getElementById('soundCardV151E'), r = card && card.getBoundingClientRect()
  const dock = document.getElementById('dock'), tabs = document.querySelector('.hubv75-tabs')
  const bottomLimit = Math.min(innerHeight, tabs && getComputedStyle(tabs).position === 'fixed' ? tabs.getBoundingClientRect().top : innerHeight, dock && dock.offsetHeight ? dock.getBoundingClientRect().top : innerHeight)
  const se = document.scrollingElement
  const tabsTxt = tabs ? [...tabs.children].map(x => x.textContent.trim()).join('|') : ''
  const tabsOver = tabs ? tabs.scrollWidth > tabs.clientWidth + 1 : null
  return { visible: !!(r && r.height), top: r && Math.round(r.top), bottom: r && Math.round(r.bottom), bottomLimit: Math.round(bottomLimit), pageScroll: se.scrollHeight - se.clientHeight, docW: se.scrollWidth - se.clientWidth, tabsTxt, tabsOver }
})
await page.screenshot({ path: 'scripts/_v151E_sound.png' })
ok(fit.visible && fit.bottom <= fit.bottomLimit && fit.top >= 0 && fit.pageScroll <= 0 && fit.docW <= 0, 'Settings › SOUND fits 400x860 with no page scroll', fit)
ok(/SOUND/.test(fit.tabsTxt) && !fit.tabsOver, 'the SOUND tab sits in the Settings tab strip without overflowing', { tabs: fit.tabsTxt })

// the controls take effect at once
const eff = await page.evaluate(async () => {
  const q = id => document.getElementById(id), sl = (id, v) => { const e = q(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }
  sl('sndVolV151E', 0.3); await new Promise(r => setTimeout(r, 400))
  const L = window.RIB_MUSIC.loopInfo(), a = window.RIB_MUSIC.state()
  sl('sndSfxV151E', 0.4); await new Promise(r => setTimeout(r, 300))
  const b = window.RIB_MUSIC.state()
  q('sndMusicV151E').click(); await new Promise(r => setTimeout(r, 900))
  const c = window.RIB_MUSIC.state()
  q('sndSfxOnV151E').click(); await new Promise(r => setTimeout(r, 300))
  q('sndVoiceV151E').click(); await new Promise(r => setTimeout(r, 300))
  const sound = window.__GRIDIRON_AUDIT__.getState().settings.sound, voice = localStorage.getItem('rib.coachVoice.v119')
  return { gain: a.gain, want: +(0.3 * L.norm).toFixed(4), volLabel: q('sndVolV151E_val') && q('sndVolV151E_val').textContent, sfxGains: b.sfxGains, dctx: window.__ducktest && window.__ducktest.state, off: { state: c.state, ctx: c.ctx, enabled: c.enabled, playing: c.playingDecks }, sound, voice }
})
ok(Math.abs(eff.gain - eff.want) < 0.02 && eff.volLabel === '30%', 'the music volume takes effect at once', { gain: eff.gain, want: eff.want, label: eff.volLabel })
ok(eff.sfxGains.length > 0 && eff.sfxGains.every(g => Math.abs(g - 0.4) < 0.02), 'the effects volume sets every other context\'s bus', { sfxGains: eff.sfxGains, dctx: eff.dctx })
ok(eff.off.state === 'off' && eff.off.ctx === 'suspended' && !eff.off.enabled && eff.off.playing === 0, 'music off stops it at once (and suspends the context)', eff.off)
ok(eff.sound === false && eff.voice === 'off', 'the SFX switch writes the save\'s `sound`, the voice switch writes rib.coachVoice.v119', { sound: eff.sound, voice: eff.voice })

// persist across a reload
await load()
const per = await page.evaluate(() => ({ p: window.RIB_MUSIC.prefs(), sound: window.__GRIDIRON_AUDIT__.getState().settings.sound, voice: localStorage.getItem('rib.coachVoice.v119') }))
ok(per.p.music === false && per.p.vol === 0.3 && per.p.sfxVol === 0.4 && per.sound === false && per.voice === 'off', 'the settings persist across a reload', per)
await gesture(); await wait(1500)
s = await st()
ok(s.state !== 'playing' && s.started === 0 && s.decks === 0, 'with music off a gesture starts nothing', { state: s.state, started: s.started, decks: s.decks })
// restore and turn music back on through the card
await page.evaluate(async () => { document.getElementById('splash')?.remove(); window.go('settings'); await new Promise(r => setTimeout(r, 400)); document.getElementById('sndMusicV151E').click(); document.getElementById('sndSfxOnV151E').click(); document.getElementById('sndVoiceV151E').click() })
const back = await until(() => window.RIB_MUSIC.state().state === 'playing' && window.RIB_MUSIC.state().ctx === 'running', 15000)
ok(back, 'turning music back on starts it', await st())

// ------------------------------------------------------------------------------ 5. MUTE ALL from the top bar
const mute = await page.evaluate(async () => {
  // a coach-like voice and an effect, each in its own context, connected before the mute
  const AC = window.AudioContext || window.webkitAudioContext
  const c1 = new AC(), c2 = new AC(); await c1.resume(); await c2.resume()
  const g1 = c1.createGain(); g1.connect(window.RIB_MUSIC.sfxOut(c1)); const g2 = c2.createGain(); g2.connect(window.RIB_MUSIC.sfxOut(c2))
  const btn = document.getElementById('muteV151E'); const shown = !!(btn && btn.offsetWidth && btn.querySelector('svg'))
  btn.click(); await new Promise(r => setTimeout(r, 900))
  const a = window.RIB_MUSIC.state(), card = document.getElementById('sndMuteV151E')
  const res = { shown, muteAll: a.muteAll, state: a.state, ctx: a.ctx, playing: a.playingDecks, sfxGains: a.sfxGains, pressed: btn.getAttribute('aria-pressed'), cardSwitch: !!(card && card.querySelector('.switch.on')), voiceKey: localStorage.getItem('rib.coachVoice.v119') }
  btn.click(); await new Promise(r => setTimeout(r, 1500))
  const b = window.RIB_MUSIC.state(); res.after = { state: b.state, ctx: b.ctx, sfxGains: b.sfxGains, muteAll: b.muteAll }
  return res
})
ok(mute.shown && mute.muteAll && mute.pressed === 'true' && mute.cardSwitch, 'the quick mute is in the top bar and flips MUTE ALL (the card follows)', { shown: mute.shown, pressed: mute.pressed, card: mute.cardSwitch })
ok(mute.state !== 'playing' && mute.ctx === 'suspended' && mute.playing === 0 && mute.sfxGains.every(g => g === 0) && mute.voiceKey !== 'off', 'mute all silences the music, every effects bus and the coach (his own switch untouched)', { state: mute.state, ctx: mute.ctx, sfxGains: mute.sfxGains, voiceKey: mute.voiceKey })
ok(mute.after.state === 'playing' && !mute.after.muteAll && mute.after.sfxGains.every(g => g > 0.3), 'unmuting brings it all back', mute.after)

// the main menu's quick mute
await page.evaluate(() => window.go('menu'))
const menuBtn = await until(() => { const b = document.querySelector('#rib-main-menu-v2 .rib9-topbar .mute-v151e'); return b && b.offsetWidth > 0 }, 5000)
ok(menuBtn, 'the main menu carries the quick mute in its top bar')
await page.screenshot({ path: 'scripts/_v151E_menu.png' })

// ------------------------------------------------------------------------------ v152 A.2: the band plays on arrival
// a browser that allows autoplay (as the native shell's web views do): no tap, and the anthem is playing
{
  const b2 = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] })
  const p2 = await (await b2.newContext({ viewport: { width: 400, height: 860 } })).newPage()
  p2.on('pageerror', (e) => errs.push(String(e && e.message || e)))
  await p2.goto(U, { waitUntil: 'domcontentloaded' })
  const on = await p2.waitForFunction(() => { const s = window.RIB_MUSIC && window.RIB_MUSIC.state(); return s && s.state === 'playing' && s.ctx === 'running' && s.playingDecks === 1 && s.position > 0.3 && s }, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null)
  ok(!!on && on.auto === 'web' && on.gestured, 'where autoplay is allowed the anthem starts on load — no tap', on && { state: on.state, ctx: on.ctx, auto: on.auto, pos: on.position })
  await b2.close()
}

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close()
process.exit(fail || errs.length ? 1 : 0)
