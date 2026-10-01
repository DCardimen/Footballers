// v165 D check: THE DEFENSE HAS A COORDINATOR. Loads the engine without the image payloads (no dev server) and asserts:
//   FieldSim plays the call, on paired seeds (the readcheck roster, `__FieldSim.run` / `.pass` with `opts.dcV165D`):
//     1. a run key stops a straight run (lower YPC than no key);
//     2. and pays for it against play action (higher PA YPA than no key) — tendencies feed the coordinator, mixing beats him;
//     3. a called blitz is a hot read for a QB who sees it: the window a sharp QB throws into opens against it and a dull
//        one's closes (the scan's separation, by call — YPA is too noisy for a difference of differences), and the sharp
//        one gains on it;
//   simGameV2 calls it (`window.__V165Dlog`):
//     4. third-and-long draws more blitzes than first down;
//     5. a run-heavy offense gets keyed: the defense's run key in the second half sits well above zero at the UFF,
//        and a Pee Wee coordinator keys it far less;
//     6. a you-back who carries the offense gets keyed (keyYou > 0 late);
//     7. the kill switch (v165Ddc 0) makes no calls;
//     8. v165 E: a sharp you-QB audibles at the line (the hot read off a blitz, play action into a run key) and a dull one
//        barely does; v165Eaud 0 makes none;
//     9. v165 G: the play-by-play says when the coordinator's call decided a play;
//    10. v165 J: the coordinator calls a shell (man behind a blitz, zone on third-and-long), and a sharp QB throws to the
//        route that beats it more than a dull one does.
// Usage: node scripts/dccheck.mjs   (snaps per FieldSim cell via DC_N, default 220; games per career cell via GAMES, default 4)
import { gameScripts } from './lib/layout.mjs'
import { launch } from './lib/env.mjs'
const runtime = gameScripts(['inline:0', 'inline:1', 'inline:2', 'src/03-splash.js', 'src/04-engine.js', 'src/07-career-app.js'])
  .map(s => s.replace(/data:image\/[^;"']+;base64,[A-Za-z0-9+/=]+/g, 'data:image/png;base64,'))
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.setContent(`<!doctype html><html><body><div id="splash"><div class="splash-title"><b></b></div></div><div id="app"><span id="prestigeCount"></span><span id="ppCount"></span><div id="screen"></div><div id="dock"></div></div><div id="pwaStatus"></div><div id="toast"></div><div id="cinemaFlash"></div><div id="momentBanner"></div></body></html>`)
for (const s of runtime) await page.addScriptTag({ content: s })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.__FieldSim)
const N = Math.max(80, Number(process.env.DC_N || 220)), GAMES = Math.max(2, Number(process.env.GAMES || 4))
const out = await page.evaluate(({ N, GAMES }) => {
  let seed = 0
  const reseed = s => { seed = s; Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let v = Math.imul(seed ^ seed >>> 15, 1 | seed); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 } }
  window.RIB_TUNE = window.RIB_TUNE || {}
  const st = window.__getGridironState(); st.prestige = 0; st.tree = {}; st._tempStatBuffsV25 = null; window.__youTempBuffsV25 = null
  // ---- FieldSim cells (the readcheck roster) ----
  const POS_OFF = ['WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'OL', 'OL', 'QB', 'RB', 'WR'], POS_DEF = ['CB', 'CB', 'S', 'S', 'LB', 'LB', 'LB', 'DL', 'DL', 'DL', 'DL']
  const SK = ['speed', 'quickness', 'acceleration', 'burst', 'strength', 'blocking', 'tackling', 'coverage', 'agility', 'awareness', 'catching', 'jumping', 'throwing', 'vision', 'stamina', 'grit', 'discipline', 'ballControl']
  const player = (pos, i, side, over) => {
    const a = Object.fromEntries(SK.map(k => [k, side === 'off' ? 58 : 57]))
    if (pos === 'QB') Object.assign(a, { throwing: 69, awareness: 65, vision: 64, agility: 55, speed: 52 })
    if (pos === 'RB') Object.assign(a, { speed: 68, acceleration: 70, burst: 69, agility: 72, quickness: 70, vision: 64, ballControl: 64 })
    if (pos === 'WR') Object.assign(a, { speed: 67, acceleration: 65, agility: 66, quickness: 65, catching: 63, jumping: 62 })
    if (pos === 'OL') Object.assign(a, { blocking: 65, strength: 67, speed: 43, agility: 44 })
    if (pos === 'CB') Object.assign(a, { coverage: 62, speed: 66, agility: 63, quickness: 62, awareness: 56 })
    if (pos === 'LB') Object.assign(a, { tackling: 62, awareness: 57, discipline: 56, strength: 63, speed: 57 })
    if (pos === 'DL') Object.assign(a, { strength: 66, tackling: 62, quickness: 56, speed: 50 })
    Object.assign(a, (over && over[pos]) || {})
    return { id: side + '-' + pos + '-' + i, pos, attrs: a, body: { height: 73 } }
  }
  const att = (p, k) => Number(p && p.attrs && p.attrs[k] != null ? p.attrs[k] : 55)
  const dc = (runKey, blitz) => ({ runKey, keyYou: 0, blitzP: 0, iq: 1, blitz: !!blitz })
  const FS = window.__FieldSim; st.player = { level: 4, pos: 'LB', name: 'P', attrs: {} }
  const cell = (kind, s0, opts, over) => {
    reseed(s0); let y = 0, n = 0
    for (let i = 0; i < N; i++) {
      const off = POS_OFF.map((p, j) => player(p, j, 'off', over)), def = POS_DEF.map((p, j) => player(p, j, 'def'))
      const r = kind === 'run'
        ? FS.run(true, { off }, { def }, off[9], att, 'inside', Object.assign({ down: 1, toGo: 10, fieldPos: 40 }, opts))
        : FS.pass(true, { off }, { def }, off[8], off[0], def[0], att, 'dropback', Object.assign({ down: 1, toGo: 10, fieldPos: 40 }, opts))
      if (!r) continue
      n++; y += Number(r.yards) || 0
    }
    return +(y / Math.max(1, n)).toFixed(2)
  }
  const res = { fs: {}, game: {} }
  const fs = res.fs, SEEDS = [0xC0FFEE, 0xBEEF, 0xD00D]
  const pool = (kind, opts, over) => +(SEEDS.reduce((s, sd) => s + cell(kind, sd, opts, over), 0) / SEEDS.length).toFixed(2)
  const sepOf = (opts, over) => { const V = window.__V165B; V.dcSepB = V.dcSepN = V.dcSepNB = V.dcSepNN = 0; pool('pass', opts, over)
    return +((opts.dcV165D.blitz ? V.dcSepB / Math.max(1, V.dcSepNB) : V.dcSepN / Math.max(1, V.dcSepNN))).toFixed(3) }
  fs.runNoKey = pool('run', { dcV165D: dc(0) }); fs.runKey = pool('run', { dcV165D: dc(0.8) })
  fs.paNoKey = pool('pass', { pa: true, dcV165D: dc(0) }); fs.paKey = pool('pass', { pa: true, dcV165D: dc(0.8) })
  const dull = { QB: { awareness: 35 } }, sharp = { QB: { awareness: 95 } }
  fs.dullNo = pool('pass', { dcV165D: dc(0, false) }, dull); fs.dullBlitz = pool('pass', { dcV165D: dc(0, true) }, dull)
  fs.sharpNo = pool('pass', { dcV165D: dc(0, false) }, sharp); fs.sharpBlitz = pool('pass', { dcV165D: dc(0, true) }, sharp)
  fs.sepPaNoKey = sepOf({ pa: true, dcV165D: dc(0) }); fs.sepPaKey = sepOf({ pa: true, dcV165D: dc(0.8) })   // v166: the window, not the YPA
  fs.sepDullNo = sepOf({ dcV165D: dc(0, false) }, dull); fs.sepDullBlitz = sepOf({ dcV165D: dc(0, true) }, dull)
  fs.sepSharpNo = sepOf({ dcV165D: dc(0, false) }, sharp); fs.sepSharpBlitz = sepOf({ dcV165D: dc(0, true) }, sharp)
  // v165 J: the shell — the mean fit of the route the QB threw to, and what it pays
  const fitOf = (shell, over) => { const V = window.__V165B; V.shellN = V.shellFit = 0; const ypa = pool('pass', { dcV165D: Object.assign(dc(0, false), { shell }) }, over)
    return { fit: +(V.shellFit / Math.max(1, V.shellN)).toFixed(3), ypa } }
  fs.shell = {}
  for (const sh of ['man', 'cover2', 'cover3']) fs.shell[sh] = { dull: fitOf(sh, dull), sharp: fitOf(sh, sharp) }
  // ---- simGameV2 cells ----
  const names = ['speed', 'acceleration', 'quickness', 'agility', 'strength', 'catching', 'throwing', 'tackling', 'blocking', 'awareness', 'vision', 'grit', 'stamina', 'jumping', 'ballControl', 'discipline', 'injuryResist']
  const flat = v => Object.fromEntries(names.map(k => [k, v]))
  const games = (level, pos, attrs, bias, on) => {
    window.RIB_TUNE.v165Ddc = on; st.player = { level, pos, name: 'P', attrs }; window.__gameScriptBiasV23 = bias; window.__V165Dlog = []
    let calls = 0, notes = 0
    const NOTE = /The blitz got home\.|They were sitting on the run\.|The play fake burned a defense keyed on the run\.|Hot read beats the blitz\.|They're keying on YOU\./
    for (let g = 0; g < GAMES; g++) { reseed(4000 + g); const r = window.__simGameV2(9 + g, pos); calls += window.__V165D.calls
      notes += (r.plays || []).filter(p => NOTE.test(String(p.desc || ''))).length }
    const log = window.__V165Dlog; window.__V165Dlog = null; window.__gameScriptBiasV23 = null; window.RIB_TUNE.v165Ddc = 1
    return { log, calls, notes }
  }
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0
  const late = (log, def) => log.filter(e => e.def === def && e.n >= 16)
  const uff = games(7, 'RB', flat(320), 0.12, 1), kid = games(0, 'RB', flat(320), 0.12, 1)
  const all = uff.log.concat(kid.log)
  const shellLog = uff.log.concat(kid.log).filter(e => e.shell)
  const manRate = f => { const a = shellLog.filter(f); return +(a.filter(e => e.shell === 'man').length / Math.max(1, a.length)).toFixed(3) }
  res.game = {
    manBlitz: manRate(e => e.blitz), manNoBlitz: manRate(e => !e.blitz), manLong: manRate(e => !e.blitz && e.down >= 3 && e.toGo >= 7),
    shells: [...new Set(shellLog.map(e => e.shell))].sort().join(','),
    blitz3rd: +mean(all.filter(e => e.down >= 3 && e.toGo >= 7).map(e => e.blitz ? 1 : 0)).toFixed(3),
    blitz1st: +mean(all.filter(e => e.down === 1).map(e => e.blitz ? 1 : 0)).toFixed(3),
    keyUff: +mean(late(uff.log, 'them').map(e => e.runKey)).toFixed(3),
    keyKid: +mean(late(kid.log, 'them').map(e => e.runKey)).toFixed(3),
    youUff: +mean(late(uff.log, 'them').map(e => e.keyYou)).toFixed(3),
    snaps: uff.log.length + kid.log.length,
    offCalls: games(7, 'RB', flat(320), 0.12, 0).calls,
    // the policy itself, off the last game's coordinator (deterministic): third-and-long against first down, a sharp QB against a dull one
    pol3rd: +window.__V165D.plan('us', 3, 9, 55).blitzP.toFixed(3), pol1st: +window.__V165D.plan('us', 1, 10, 55).blitzP.toFixed(3),
    polSharpQb: +window.__V165D.plan('us', 3, 9, 95).blitzP.toFixed(3),
    notes: uff.notes, notesKid: kid.notes
  }
  // v165 E: the audible — a you-QB at the UFF with a 120 mind against a 600 mind, and the switch off
  const qbMind = m => Object.assign(flat(300), { awareness: m, vision: m, discipline: m })
  const aud = (log) => log.filter(e => e.audible && e.us)
  const dullQ = games(7, 'QB', qbMind(120), null, 1), sharpQ = games(7, 'QB', qbMind(600), null, 1)
  window.RIB_TUNE.v165Eaud = 0; const offQ = games(7, 'QB', qbMind(600), null, 1); delete window.RIB_TUNE.v165Eaud
  res.game.audDull = aud(dullQ.log).length; res.game.audSharp = aud(sharpQ.log).length
  res.game.audHot = aud(sharpQ.log).filter(e => e.audible === 'hot').length; res.game.audPa = aud(sharpQ.log).filter(e => e.audible === 'pa').length
  res.game.audOff = aud(offQ.log).length
  return res
}, { N, GAMES })
await browser.close()
const checks = []
const ok = (name, pass) => checks.push({ name, pass: !!pass })
const F = out.fs, G = out.game
ok(`a run key stops a straight run (${F.runNoKey} -> ${F.runKey} YPC)`, F.runKey < F.runNoKey - 0.2)
// v166: PA YPA is a noisy difference (every engine change since moved it ±1.5 — 13.9 -> 12.5 on one build, the reverse on
// the next); what the run key gives play action is the WINDOW the passer throws into, measured on the chosen read
ok(`and pays for it against play action: the window opens (separation ${F.sepPaNoKey} -> ${F.sepPaKey}; PA YPA ${F.paNoKey} -> ${F.paKey})`, F.sepPaKey > F.sepPaNoKey + 0.3)
ok(`a called blitz is a hot read for a QB who sees it: the window he throws into opens (sep ${F.sepSharpNo} -> ${F.sepSharpBlitz}) and closes on one who does not (${F.sepDullNo} -> ${F.sepDullBlitz})`, F.sepSharpBlitz > F.sepSharpNo + 0.2 && F.sepDullBlitz < F.sepDullNo)
ok(`and against the blitz the sharp one makes it pay where the dull one cannot (${F.sharpBlitz} vs ${F.dullBlitz} YPA against it; ${F.sharpNo} / ${F.dullNo} without)`, F.sharpBlitz > F.dullBlitz + 1.5)
ok(`third-and-long calls more pressure than first down, and less against a sharp QB (policy ${G.pol3rd} vs ${G.pol1st}, ${G.polSharpQb} against a 95; called ${G.blitz3rd} vs ${G.blitz1st} over ${G.snaps} snaps)`, G.pol3rd > G.pol1st + 0.1 && G.polSharpQb < G.pol3rd && G.blitz3rd > G.blitz1st)
ok(`a run-heavy offense gets keyed at the UFF (second-half run key ${G.keyUff})`, G.keyUff >= 0.2)
ok(`a Pee Wee coordinator keys it far less (${G.keyKid} vs ${G.keyUff})`, G.keyKid < G.keyUff * 0.5)
ok(`a back who carries the offense gets keyed (keyYou ${G.youUff})`, G.youUff > 0.05)
ok(`kill switch: no calls (${G.offCalls})`, G.offCalls === 0)
const SH = F.shell
ok(`v165 J: the coordinator calls a shell — man behind a blitz, zone on third-and-long (${G.shells}; man ${G.manBlitz} blitzing, ${G.manNoBlitz} not, ${G.manLong} on 3rd-and-long)`, G.shells === 'cover2,cover3,man' && G.manBlitz > G.manNoBlitz + 0.15 && G.manLong < G.manNoBlitz)
ok(`a sharp QB reads the shell and throws to the route that beats it (fit sharp/dull: man ${SH.man.sharp.fit}/${SH.man.dull.fit}, cover 2 ${SH.cover2.sharp.fit}/${SH.cover2.dull.fit}, cover 3 ${SH.cover3.sharp.fit}/${SH.cover3.dull.fit})`, ['man', 'cover2', 'cover3'].every(k => SH[k].sharp.fit >= SH[k].dull.fit - 0.02) && ['man', 'cover2', 'cover3'].reduce((d, k) => d + SH[k].sharp.fit - SH[k].dull.fit, 0) / 3 >= 0.05)
// (cover 3 is the near-tie: its soft spots are short — curls, flats — and on 1st-and-10 a passer still prices the sticks)
ok(`a sharp you-QB audibles at the line and a dull one barely does (${G.audSharp} vs ${G.audDull} in ${GAMES} games; ${G.audHot} hot reads, ${G.audPa} play actions)`, G.audSharp >= 4 && G.audSharp >= 3 * Math.max(1, G.audDull) && G.audHot > 0)
ok(`v165 G: the booth says when the call decided the play (${G.notes} notes in ${GAMES} UFF games, ${G.notesKid} at Pee Wee)`, G.notes >= 4 && G.notes <= GAMES * 25)
ok(`the audible's kill switch (v165Eaud 0): none (${G.audOff})`, G.audOff === 0)
ok('no page errors', errs.length === 0)
for (const c of checks) console.log((c.pass ? 'ok   ' : 'FAIL ') + c.name)
const fails = checks.filter(c => !c.pass).length
console.log(JSON.stringify({ pass: checks.length - fails, fail: fails, pageErrors: errs.length, fs: F, game: G, errs: errs.slice(0, 2) }))
process.exit(fails ? 1 : 0)
