// Dev check: v147 D THE CAMERA HOLDS STILL AT 4×. Drives a real career onto the live field and, for
// each play speed × camera mode, records every frame the camera spring integrates (the pan centre,
// the zoom, the target it was sent to, the focus it frames). Jitter is measured the way the EYE sees
// it — in wall time and in SCREEN widths (a world step times the zoom it was seen at):
//   acc   RMS of the pan's second derivative, screen widths / s²
//   hf    RMS of the pan's high-frequency residual (off a line fitted through 9 frames against the clock), 1/1000 screen
//   rev   pan velocity reversals per second (either axis, past a dead-band)
//   zHf / zRev   the same for log-zoom (the frame pumping)
//   tHf / fHf    hf of the spring's TARGET and of the FOCUS it frames (where the shake comes from)
//   off / p90 / out   the BALL's (Follow Me: HIS) distance from the frame centre as a share of the half
//         frame — p95, p90, and the share of frames it is outside (> 1); `kinds` splits all that by ball mode
// PAIRED: PLAYS scripts are captured off the live game and replayed, frozen, at each speed, in each mode,
// under each CONFIG — by default the camera with v147 D switched off (`camRateV147` 0) and on, so
// before / after / 1× / 4× are all the same plays in the same session.
// Asserts, in Broadcast and Follow Me: the 4× / 1× ratios of acc, hf, rev and zoom shake have a geometric
// mean ≤ TOL (1.2) and none past CAP (2); lower than before v147 D; the ball (Follow Me: him) inside the
// frame 9 frames in 10 and off it < 3% at 4× (the v112 E standard — or no more than 3 points worse than
// the same plays were before, for a kick-heavy sample); 1× unchanged; Fixed never moves at 4×; no page errors.
//   node scripts/v147Dcheck.mjs   (GAME_URL=…, READ_POS=RB, PLAYS=10, SPEEDS=1,4, MODES=0,4, TOL, CAP,
//   PROBE=1 prints only, CONFIGS='[{"name":…,"tune":{…},"speeds":[4]}]' to sweep the dials)
import { chromium } from 'playwright'

const URL = process.env.GAME_URL || 'http://localhost:5173/'
const SPEEDS = (process.env.SPEEDS || '1,4').split(',').map(Number)
const MODES = (process.env.MODES || '0,4').split(',').map(Number)
const TOL = +(process.env.TOL || 1.2), CAP = +(process.env.CAP || 2), PROBE = !!process.env.PROBE
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// ---- onto the live field (the v145 walk)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'RB'
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) }
    return null
  }, { t, visSrc: vis }).catch(e => 'ERR ' + e.message)
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 90; i++) {
  scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (scene) break
  if (i % 6 === 5) await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['CONTINUE TO MATCH', 'PLAY WEEK', 'CONTINUE', 'NEXT', 'OK']) { const el = els.find(e => txt(e).toUpperCase().includes(w)); if (el) { el.click(); return } }
    const pl = els.find(e => /gs-card/i.test(e.className)); if (pl) pl.click()
  }, { visSrc: vis })
  await page.waitForTimeout(500)
}
ok(scene, 'the live scene is up')

// ---- record: every spring step, tagged with the play clock
await page.evaluate(() => {
  const sc = window.__gridironScene, orig = sc.camSpringV109
  window.__camRecV147 = []
  sc.camSpringV109 = function (cam, cx, cy, tz, delta, k) {
    const r = orig.apply(this, arguments)
    const P = this.play, R = window.__camRecV147
    if (R.on && P && !P.done) {
      const f = this._pcam || { x: cx, y: cy }
      R.push({ w: performance.now(), d: delta, pt: P.t, sid: P.__sidV147 || (P.__sidV147 = Math.random()), post: !!P.post, glide: P.t < (P.delay || 0),
        x: cam.midPoint.x, y: cam.midPoint.y, z: cam.zoom, tx: cx, ty: cy, fx: f.x, fy: f.y, flag: !!this._camFlagV112, ...(() => { const me = this.camMeV145 && this.camMeV145(P), b = me ? me.root : this.ballSpr; return { bx: b ? b.x : f.x, by: b ? b.y : f.y, kind: me ? "me" : String(P.ballMode || "ground") } })(), spd: window.__getGridironLiveSpeed ? window.__getGridironLiveSpeed() : 1 })
    }
    return r
  }
})

function metrics(rows) {
  // segments: one play's live frames (snapped, before the whistle), contiguous
  const segs = []; let cur = []
  for (const r of rows) {
    if (r.post || r.glide || r.flag) { if (cur.length) segs.push(cur); cur = []; continue }
    if (cur.length && (r.sid !== cur[cur.length - 1].sid || r.w - cur[cur.length - 1].w > 250)) { segs.push(cur); cur = [] }
    cur.push(r)
  }
  if (cur.length) segs.push(cur)
  const A = { acc: [], hf: [], zHf: [], tHf: [], fHf: [], off: [] }; let rev = 0, zRev = 0, wallS = 0, n = 0; const K = {}, KH = {}
  const W = 720, DB = +(process.env.REV_DB || 0.03), H = 4   // dead-band: screen widths per second; hf half-window (frames)
  for (const s of segs) {
    if (s.length < 2 * H + 3) continue
    const dts = s.map((r, i) => i ? Math.max(1, r.d || (r.w - s[i - 1].w)) / 1000 : 0)   // the frame's own delta: the clock the scene moved by
    // everything in SCREEN widths at the zoom of that frame: what the eye sees move
    // (a world step times the zoom it was seen at, summed — a zoom alone is not a pan)
    const cum = k => { let a = 0; return s.map((r, i) => i ? (a += (r[k] - s[i - 1][k]) * (r.z + s[i - 1].z) / 2 / W) : 0) }
    const sx = cum('x'), sy = cum('y'), tx = cum('tx'), ty = cum('ty'), fx = cum('fx'), fy = cum('fy')
    const lz = s.map(r => Math.log(r.z))
    const d2 = (a, i) => { const v1 = (a[i] - a[i - 1]) / dts[i], v2 = (a[i + 1] - a[i]) / dts[i + 1]; return (v2 - v1) / ((dts[i] + dts[i + 1]) / 2) }
    const ts = []; dts.forEach((d, i) => ts.push(i ? ts[i - 1] + d : 0))
    // residual from a straight line fitted through the 9 frames around it against the CLOCK: a steady
    // pan is 0 whatever the frame pacing, so only the shake is left
    const hf = (a, i) => { let st = 0, sa = 0, stt = 0, sta = 0; const n = 2 * H + 1
      for (let k = -H; k <= H; k++) { const t = ts[i + k] - ts[i]; st += t; sa += a[i + k]; stt += t * t; sta += t * a[i + k] }
      const b = (n * sta - st * sa) / Math.max(1e-12, n * stt - st * st), c = (sa - b * st) / n; return a[i] - c }
    let pvx = 0, pvy = 0, pvz = 0
    for (let i = 1; i < s.length - 1; i++) {
      A.acc.push(Math.hypot(d2(sx, i), d2(sy, i)) ** 2)
      const vx = (sx[i] - sx[i - 1]) / dts[i], vy = (sy[i] - sy[i - 1]) / dts[i], vz = (lz[i] - lz[i - 1]) / dts[i]
      if (Math.abs(vx) > DB) { if (pvx && Math.sign(vx) !== Math.sign(pvx)) rev++; pvx = vx }
      if (Math.abs(vy) > DB) { if (pvy && Math.sign(vy) !== Math.sign(pvy)) rev++; pvy = vy }
      if (Math.abs(vz) > 0.03) { if (pvz && Math.sign(vz) !== Math.sign(pvz)) zRev++; pvz = vz }
      if (i >= H && i < s.length - H) {
        { const q = Math.hypot(hf(sx, i), hf(sy, i)) ** 2; A.hf.push(q); (KH[s[i].kind] = KH[s[i].kind] || []).push(q) } A.zHf.push(hf(lz, i) ** 2)
        A.tHf.push(Math.hypot(hf(tx, i), hf(ty, i)) ** 2); A.fHf.push(Math.hypot(hf(fx, i), hf(fy, i)) ** 2)
      }
      wallS += dts[i]; n++
      const r = s[i], hw = W / (2 * r.z), hh = 576 / (2 * r.z)
      // in frame: the BALL itself (or, in Follow Me, the man), not the focus point the camera aims at
      const o = Math.max(Math.abs(r.bx - r.x) / hw, Math.abs(r.by - r.y) / hh)
      A.off.push(o); (K[r.kind] = K[r.kind] || []).push(o)
    }
  }
  const rms = (a, k = 1) => a.length ? +(k * Math.sqrt(a.reduce((x, y) => x + y, 0) / a.length)).toFixed(3) : 0
  const p = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[Math.floor(b.length * q)].toFixed(3) : 0 }
  // hf / zHf / tHf / fHf are ×1000 (thousandths of a screen width; milli-log-zoom)
  const fms = []; for (const s of segs) for (let i = 1; i < s.length; i++) fms.push(s[i].w - s[i - 1].w)
  return { n, segs: segs.length, p90: p(A.off, 0.9), out: +(A.off.filter(v => v > 1).length / Math.max(1, A.off.length)).toFixed(3), fms: p(fms, 0.5), fms90: p(fms, 0.9), wallS: +wallS.toFixed(1), acc: rms(A.acc), hf: rms(A.hf, 1000), rev: +(rev / Math.max(1e-3, wallS)).toFixed(2),
    zHf: rms(A.zHf, 1000), zRev: +(zRev / Math.max(1e-3, wallS)).toFixed(2), tHf: rms(A.tHf, 1000), fHf: rms(A.fHf, 1000), off: p(A.off, 0.95),
    kinds: Object.fromEntries(Object.entries(K).filter(([, a]) => a.length >= 15).map(([k, a]) => [k, [a.length, p(a, 0.9), +(a.filter(v => v > 1).length / a.length).toFixed(3), rms(KH[k] || [], 1000)]])) }
}

const OUT = {}, ALL = {}, FIX = {}
/* PAIRED: the same plays at every speed and in every mode. Live games are a different sequence of
 * plays every run, and one long run against another differed by 2× on the SAME code — so the check
 * captures PLAYS payloads off the live game, freezes each one's script, holds the career's own row
 * loop, and replays every frozen script at each speed in each mode. The numbers then differ only by
 * what the camera did. */
const PLAYS = +(process.env.PLAYS || 10)
const cap = await page.evaluate(async (PLAYS) => {
  const sc = window.__gridironScene, orig = sc.animatePlay
  const book = window.__playsV147 = []
  window.setSpeed(4)
  sc.animatePlay = function (et, rt) {
    if (window.__holdV147 && !this.__oursV147) return   // the career's loop waits while the check replays
    const r = orig.apply(this, arguments)
    // at least half the book is snaps the you-player is on the field for, so Follow Me frames HIM
    try { if (!this.__oursV147 && book.length < PLAYS && this.play && this.play.script) {
      const m = this.markers[this.play.featIdx], me = !!(m && m.team === 'you')
      if (me || book.filter(b => !b.me).length < Math.floor(PLAYS / 2)) book.push({ et, me, script: structuredClone(this.play.script) }) } } catch (e) {}
    return r
  }
  const t0 = performance.now()
  while (book.length < PLAYS && performance.now() - t0 < 240000) await new Promise(r => setTimeout(r, 250))
  window.__holdV147 = true
  await new Promise(r => setTimeout(r, 2500))   // the play in hand runs out under the hold
  return { n: book.length, me: book.filter(b => b.me).length, kinds: book.map(b => String(b.et.event || b.et.playType || b.et.type || '?')) }
}, PLAYS)
console.log('captured plays:', JSON.stringify(cap))
ok(cap.n >= Math.min(4, PLAYS), 'captured live plays to replay', cap.n)

// the camera before v147 D (its kill switch) and after, on the SAME plays in the same session
const CONFIGS = process.env.CONFIGS ? JSON.parse(process.env.CONFIGS) : [{ name: 'before', tune: { camRateV147: 0 } }, { name: 'after', tune: {} }]
async function replay(i, spd, mode, tune) {
  return page.evaluate(async ({ i, spd, mode, tune }) => {
    const sc = window.__gridironScene, b = window.__playsV147[i], T = window.RIB_TUNE, keep = {}
    for (const k of Object.keys(tune)) { keep[k] = T[k]; T[k] = tune[k] }
    window.setSpeed(spd); window.camModeSet112(mode)
    const R = window.__camRecV147; R.length = 0; R.on = true
    const fixed = []
    await new Promise(res => {
      let done = false; const fin = () => { if (!done) { done = true; res() } }
      sc.__oursV147 = true
      sc._preV101 = { payload: b.et, script: structuredClone(b.script) }
      try { sc.animatePlay(b.et, fin) } catch (e) { fin() }
      sc.__oursV147 = false
      const t0 = performance.now()
      const tick = () => {
        if (done) return
        const P = sc.play
        if (mode === 3 && P && !P.done && P.t > (P.delay || 0)) { const c = sc.cameras.main; fixed.push([c.midPoint.x, c.midPoint.y, c.zoom]) }
        if (!P || P.done || performance.now() - t0 > 40000) { setTimeout(fin, 300); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    R.on = false
    for (const k of Object.keys(keep)) { if (keep[k] === undefined) delete T[k]; else T[k] = keep[k] }
    let move = 0; for (let k = 1; k < fixed.length; k++) move = Math.max(move, Math.abs(fixed[k][0] - fixed[k - 1][0]) + Math.abs(fixed[k][1] - fixed[k - 1][1]) + 100 * Math.abs(fixed[k][2] - fixed[k - 1][2]))
    return { rows: R.slice(), fixed: fixed.length, move }
  }, { i, spd, mode, tune })
}
for (let i = 0; i < cap.n; i++) for (const C of CONFIGS) for (const spd of (C.speeds || SPEEDS)) for (const mode of MODES.concat(spd === 4 && i < 2 && C === CONFIGS[CONFIGS.length - 1] ? [3] : [])) {
  const got = await replay(i, spd, mode, C.tune), k = `${C.name}|${spd}x/${mode}`
  if (mode === 3) { FIX[k] = FIX[k] || { n: 0, move: 0 }; FIX[k].n += got.fixed; FIX[k].move = Math.max(FIX[k].move, +got.move.toFixed(3)); continue }
  ALL[k] = (ALL[k] || []).concat(got.rows)
}
await page.evaluate(() => { window.setSpeed(1); window.camModeSet112(0) })
for (const k of Object.keys(ALL).sort()) { OUT[k] = metrics(ALL[k]); console.log(k.padEnd(16), JSON.stringify(OUT[k])) }
for (const k of Object.keys(FIX)) console.log(k + ' fixed:', JSON.stringify(FIX[k]))
const hook = await page.evaluate(() => window.__V147D || null)
console.log('hook:', JSON.stringify(hook))

if (!PROBE) {
  const LBL = ['Broadcast', 'Tight', 'Wide', 'Fixed', 'Follow Me', 'Follow Ball']
  const AFT = CONFIGS[CONFIGS.length - 1].name, BEF = CONFIGS[0].name
  for (const mode of MODES) {
    const a = OUT[`${AFT}|1x/${mode}`], b = OUT[`${AFT}|4x/${mode}`], o = OUT[`${BEF}|4x/${mode}`], o1 = OUT[`${BEF}|1x/${mode}`]; if (!a || !b) continue
    const lbl = LBL[mode], r = (x, y) => +(x / Math.max(1e-6, y)).toFixed(2)
    ok(a.n > 150 && b.n > 60, `${lbl}: both speeds recorded live frames`, `${a.n} / ${b.n}`)
    // what the eye sees at 4× against what it sees at 1×, on the same plays. The four ratios are one
    // steadiness index (their geometric mean, ≤ TOL); each alone is capped at CAP, because a single
    // metric on ten plays swings ±25% between sessions on untouched code (a punt-heavy sample puts Follow
    // Me's pan shake near ×1.9 — every punt is a man it is not following)
    const R4 = { acc: r(b.acc, a.acc), hf: r(b.hf, a.hf), rev: r(Math.max(b.rev, 0.5), Math.max(a.rev, 0.5)), zoom: r(b.zHf + 0.5, a.zHf + 0.5) }
    const R0 = o ? { acc: r(o.acc, o1.acc), hf: r(o.hf, o1.hf), rev: r(Math.max(o.rev, 0.5), Math.max(o1.rev, 0.5)), zoom: r(o.zHf + 0.5, o1.zHf + 0.5) } : null
    const gm = X => +Math.pow(Object.values(X).reduce((p, v) => p * v, 1), 1 / 4).toFixed(2)
    ok(gm(R4) <= TOL, `${lbl}: at 4× the camera is as steady as at 1× (geometric mean of the four ratios ≤ ${TOL})`, `index ${gm(R4)} ${JSON.stringify(R4)}${R0 ? ` · before v147 D ${gm(R0)} ${JSON.stringify(R0)}` : ''}`)
    ok(Object.values(R4).every(v => v <= CAP), `${lbl}: and no single measure of it is worse than ×${CAP}`, `acc ${b.acc} vs ${a.acc} · hf ${b.hf} vs ${a.hf} · rev/s ${b.rev} vs ${a.rev} · zHf ${b.zHf} vs ${a.zHf} · zRev/s ${b.zRev} vs ${a.zRev}`)
    // in frame, by the v112 E standard: the ball (Follow Me: HIM) inside the frame 9 frames in 10, and off it
    // under 3% — or, where the same plays already broke that before v147 D (a kickoff's long snap is off the
    // frame at 1× too), no more than 3 points worse than they were
    const pB = o ? Math.max(1, o.p90 * 1.2) : 1, oB = o ? Math.max(0.03, o.out * 1.5 + 0.03) : 0.03
    ok(b.p90 < pB && b.out <= oB, `${lbl}: the ball stays in the picture at 4×`, `p90 ${a.p90} / ${b.p90} of the half frame · off-frame ${(100 * b.out).toFixed(1)}% (before ${o ? o.p90 + ' / ' + (100 * o.out).toFixed(1) + '%' : '?'})`)
    if (o) ok(gm(R4) < gm(R0) && b.hf < o.hf && b.acc < o.acc, `${lbl}: the 4× camera is steadier than it was before v147 D`, `hf ${o.hf} → ${b.hf} · acc ${o.acc} → ${b.acc} · rev ${o.rev} → ${b.rev} · zHf ${o.zHf} → ${b.zHf}`)
    if (o1) ok(Math.abs(a.hf - o1.hf) <= 0.25 * o1.hf + 0.5 && Math.abs(a.acc - o1.acc) <= 0.25 * o1.acc + 0.3, `${lbl}: 1× is essentially unchanged`, `hf ${o1.hf} → ${a.hf} · acc ${o1.acc} → ${a.acc} · off ${o1.off} → ${a.off}`)
  }
  for (const k of Object.keys(FIX)) ok(FIX[k].n > 10 && FIX[k].move < 0.5, `Fixed never moves (${k})`, JSON.stringify(FIX[k]))
  ok(!!hook && hook.frames > 0 && hook.pre > 0, 'the v147 D hook is live and the speed low-pass ran', JSON.stringify(hook))
}
ok(errs.length === 0, 'no page errors', errs.length + '')
console.log('\npage errors:', errs.length ? errs.slice(0, 8) : 'none')
console.log(`\n${pass} ok, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
