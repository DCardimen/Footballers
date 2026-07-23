// v42 growth-decision entertainment probe: Monte-Carlo the outcome generator
// across personalities/positions/prestige and report the fun curve — outcome
// mix, magnitudes, durations, permanents, story variety. Run with dev server up.
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
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
if (errors.length || rep.goodPct < 40 || rep.goodPct > 75 || rep.magnitude.min < 3 || rep.magnitude.max > 10) process.exitCode = 1
await browser.close()
