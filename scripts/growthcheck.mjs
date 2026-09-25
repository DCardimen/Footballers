// v42 growth-decision entertainment probe: Monte-Carlo the outcome generator
// across personalities/positions/prestige and report the fun curve — outcome
// mix, magnitudes, durations, permanents, story variety. Run with dev server up.
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(gameUrl('index.html'), { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction(() => !!window.__GROWTH_V42, null, { timeout: 20000 })
const rep = await page.evaluate(() => {
  const outs = window.__GROWTH_V42.simulate(600)
  const n = outs.length
  const pct = x => Math.round(x / n * 100)
  const good = outs.filter(o => o.sign > 0)
  const dur = { g5: 0, season: 0, multi: 0, perm: 0 }
  outs.forEach(o => { if (o.permanent) dur.perm++; else if (o.tier.games) dur.g5++; else if (o.tier.seasons) dur.multi++; else dur.season++ })
  const amts = outs.map(o => o.amt)
  const stories = new Set(outs.map(o => o.story.slice(0, 40)))
  const cards = {}; outs.forEach(o => cards[o.card] = (cards[o.card] || 0) + 1)
  const tiers = {}; outs.forEach(o => tiers[o._tier] = (tiers[o._tier] || 0) + 1)
  const bands = {}; outs.forEach(o => bands[o.band] = (bands[o.band] || 0) + 1)
  const names = new Set(); outs.forEach(o => o._names.forEach(x => names.add(x)))
  const statCounts = outs.map(o => o.stats.length)
  return {
    n, goodPct: pct(good.length),
    durations: { fiveGames: pct(dur.g5), fullSeason: pct(dur.season), multiSeason: pct(dur.multi), permanent: pct(dur.perm) },
    magnitude: { min: Math.min(...amts), max: Math.max(...amts), avg: +(amts.reduce((a, b) => a + b) / n).toFixed(1) },
    // v150 B: by band — the neutral outcome is a deliberately small nudge (see below)
    magByBand: Object.fromEntries(['green', 'neutral', 'red'].map(b => { const a = outs.filter(o => o.band === b).map(o => o.amt); return [b, a.length ? { n: a.length, min: Math.min(...a), max: Math.max(...a) } : null] })),
    statsPerOutcome: { min: Math.min(...statCounts), max: Math.max(...statCounts) },
    cardMix: cards, tierMix: tiers, bandMix: bands, optionNameVariety: names.size, storyVariety: stories.size,
    offCharacterPct: pct(outs.filter(o => o.fit < .3).length),
    prestigeEffect: {
      lowPrestigeMultiSeasonNeg: pct(outs.filter(o => o.sign < 0 && o.tier.seasons).length),
    },
  }
})
console.log(JSON.stringify(rep, null, 1))
console.log('page errors:', JSON.stringify(errors))
/* v150 B: the probe had no assertion lines (only an exit code), so the runner could only say "exit 1". It prints them now.
 * And the magnitude floor was a flat 3 for every outcome, but the NEUTRAL band ("It helped... some") is by design a
 * smaller nudge: `amt = Math.max(2, Math.round(amt * .45))` (the v42 roll, beside `bandOdds`), so a LIGHT option that
 * lands neutral is +2 — the min of 2 the baseline saw on every run is the game doing what it says. Green and red keep the
 * 3..10 band (red is floored at 3, green is the option's own 3..10), neutral is 2..10. */
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const B = rep.magByBand
ok(rep.goodPct >= 40 && rep.goodPct <= 75, 'the good outcomes are 40-75% of the rolls', rep.goodPct + '%')
ok(B.green && B.green.min >= 3 && B.green.max <= 10 && B.red && B.red.min >= 3 && B.red.max <= 10, 'a hit or a backfire moves 3..10 points', JSON.stringify({ green: B.green, red: B.red }))
ok(!B.neutral || (B.neutral.min >= 2 && B.neutral.max <= 10), 'a neutral roll is a smaller nudge, never under 2', JSON.stringify(B.neutral))
ok(rep.magnitude.max <= 10, 'nothing past 10', String(rep.magnitude.max))
ok(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | ') || 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (fail || errors.length) process.exitCode = 1
await browser.close()
