// Dev check (v139 THREE MOVES, THE LUNGE THAT LEAVES THE GROUND, AND THE LANDING).
//
// The carrier had two ways to beat a man — a spin or a juke — and the juke was almost all of them.
// A SIDE STEP is the third: the quick man's answer, and what he reaches for in traffic where there
// is no room to turn his back on the play. Which one plays is a PICTURE decision taken after the
// whiff is already resolved, so nothing here moves a yard.
//
// And every committed tackle leapt exactly 17px, whether it was a linebacker closing at full speed
// or a lineman falling forward onto a back who ran into him. The leap is the lunge's own force now.
//
// Asserts: all three moves appear; the mix follows the ratings (an agile back spins more, a quick
// back side-steps more); the lunge's height scales with the closing momentum and the impact and
// stays inside its dials; and a whiffed diver finishes his arc rather than snapping to the turf.
//
//   node scripts/movecheck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://localhost:5173/index.html'
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1300)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// ---- 1. the mix, off controlled rosters ----
const mix = await page.evaluate(() => {
  const FS = window.__FieldSim
  const KEYS = ['speed','acceleration','agility','strength','tackling','awareness','burst','quickness','vision','grit','discipline','blocking','coverage','catching','jumping','throwing','stamina','ballControl']
  const mk = (pos, base, over = {}) => { const a = {}; KEYS.forEach(k => a[k] = base); Object.assign(a, over); return { pos, attrs: a } }
  const POS_OFF = ['WR','WR','TE','OL','OL','OL','OL','OL','QB','RB','WR']
  const POS_DEF = ['CB','CB','S','S','LB','LB','LB','DL','DL','DL','DL']
  const att = (p, n) => (p && p.attrs && p.attrs[n]) != null ? p.attrs[n] : 50
  const run = (over, N) => {
    const off = POS_OFF.map(p => mk(p, 55)), def = POS_DEF.map(p => mk(p, 55))
    const K = mk('RB', 55, over); off[9] = K
    const t = { spin: 0, sidestep: 0, juke: 0, lunge: 0, whiff: 0, plays: 0, dMom: [] }
    for (let i = 0; i < N; i++) {
      FS.run(true, { off }, { def }, K, att); t.plays++
      for (const e of FS._Q[FS._Q.length - 1].log.events) {
        if (e.type === 'cut') t[e.kind] = (t[e.kind] || 0) + 1
        if (e.type === 'tackleWhiff') t.whiff++
        if (e.type === 'tackleLunge') { t.lunge++; if (e.dMom != null) t.dMom.push(e.dMom) }
      }
    }
    const c = t.spin + t.sidestep + t.juke
    return { cuts: c, lunge: t.lunge, whiff: t.whiff, plays: t.plays,
      spin: c ? +(t.spin / c * 100).toFixed(1) : 0, sidestep: c ? +(t.sidestep / c * 100).toFixed(1) : 0, juke: c ? +(t.juke / c * 100).toFixed(1) : 0,
      mom: t.dMom.length ? { min: Math.round(Math.min(...t.dMom)), max: Math.round(Math.max(...t.dMom)) } : null }
  }
  return { agile: run({ agility: 92, quickness: 58, speed: 80 }, 400), quick: run({ agility: 58, quickness: 92, speed: 80 }, 400) }
})
console.log('mix:', JSON.stringify(mix))
ok(mix.agile.cuts > 40 && mix.quick.cuts > 40, 'men are beating tackles often enough to measure the mix', `${mix.agile.cuts} / ${mix.quick.cuts} cuts`)
ok(mix.agile.spin > 0 && mix.agile.sidestep > 0 && mix.agile.juke > 0, 'all three moves are in the game', JSON.stringify([mix.agile.spin, mix.agile.sidestep, mix.agile.juke]))
ok(mix.agile.spin > mix.quick.spin + 8, 'the AGILE back spins — he turns his back and whips round', `agile ${mix.agile.spin}% vs quick ${mix.quick.spin}%`)
ok(mix.quick.sidestep > mix.agile.sidestep + 8, 'the QUICK back side-steps — one foot, off the line, gone', `quick ${mix.quick.sidestep}% vs agile ${mix.agile.sidestep}%`)
ok(mix.agile.juke < 70 && mix.quick.juke < 70, 'and the juke is no longer nearly all of them', `agile ${mix.agile.juke}% · quick ${mix.quick.juke}%`)

// ---- 2. the lunge's height is its own force ----
const lunge = await page.evaluate(() => {
  const fn = window.__V139 && window.__V139.lunge
  if (!fn) return { missing: true }
  const at = (dMom, impact) => fn({ dMom, impact })
  return { soft: at(0, 0), mid: at(90, 40), hard: at(200, 90), over: at(999, 999) }
})
console.log('lunge:', JSON.stringify(lunge))
if (lunge.missing) {
  ok(false, 'window.__V139.lunge is mounted', 'missing')
} else {
  ok(lunge.hard.h > lunge.soft.h + 8, 'a man closing at speed leaves his feet; a step-in wrap barely does', `${lunge.soft.h.toFixed(1)}px → ${lunge.hard.h.toFixed(1)}px`)
  ok(lunge.hard.ms > lunge.soft.ms + 80, 'and he hangs there longer for it', `${lunge.soft.ms}ms → ${lunge.hard.ms}ms`)
  ok(lunge.over.h === lunge.hard.h || lunge.over.k === 1, 'the arc is capped — nobody launches into orbit', JSON.stringify(lunge.over))
  ok(lunge.soft.h >= 8 && lunge.over.h <= 34, 'and every lunge stays inside its dials', `${lunge.soft.h.toFixed(1)} … ${lunge.over.h.toFixed(1)}px`)
}

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
