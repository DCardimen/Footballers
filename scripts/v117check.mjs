// Dev check (v117 ONE MAN, ONE SLOT): nobody takes the field twice on the same snap, and the
// you-player is not nailed to one alignment inside his position group.
//
// The bug this guards: `take()` drew from a position pool without removing what it had already
// handed out, so one roster player could fill two slots at once. The you-player is placed first
// and was left in the very pool the later slots at his position draw from, so he was fielded as
// two or three linebackers on more than half his defensive snaps — and every stop those extra
// copies made was credited to him, off a team-mate's alignment.
//
// Usage: npm run dev, then: node scripts/v117check.mjs   (POS=LB GAMES=25 to vary)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { const s=window.__getGridironState&&window.__getGridironState(); if (s) s.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({t, visSrc}) => { const vis = eval(visSrc)
    const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis); let el
    if (t==='ARCH') el = els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()))
    else el = els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)))
    if(el)el.click() }, {t, visSrc:vis})
  await page.waitForTimeout(450)
}
const POS = process.env.POS || 'LB'
const LONG = { LB:'LB Linebacker', CB:'CB Cornerback', S:'S Safety', DL:'DL Defensive Line', RB:'RB Running Back', WR:'WR Wide Receiver', QB:'QB Quarterback' }[POS] || 'LB Linebacker'
for (const s of ["START NEW CAREER","ARCH",LONG,"PLAY 8-GAME SEASON","Balanced Program","CONFIRM TRAINING"]) await click(s)

const res = await page.evaluate(({ POS, GAMES }) => {
  const FS = window.__FieldSim, problems = []
  let snaps = 0, youSnaps = 0, dupAny = 0, dupYou = 0, dupMax = 0
  const youSlots = {}, tackleBySlot = {}
  let namedOnYouSnaps = 0, youNamed = 0

  const wrap = (name) => { const orig = FS[name].bind(FS)
    FS[name] = function (...a) { const r = orig(...a)
      const q = FS._Q, last = q && q.length ? q[q.length - 1] : null
      if (!(r && last && last.log && last.log.actors)) return r
      const acts = last.log.actors
      snaps++
      // one man, one slot: a roster player may hold at most one marker on a snap. The log
      // carries no roster identity, so the you-player (the one man we can name from here)
      // is the probe — he is also the man the old draw doubled.
      const yous = acts.filter(x => x.you)
      if (yous.length > 1) { dupAny++; dupYou++; dupMax = Math.max(dupMax, yous.length) }
      const youDef = yous.filter(x => x.side === 'def')
      if (youDef.length === 1) { youSnaps++
        youSlots[youDef[0].id] = (youSlots[youDef[0].id] || 0) + 1
        const ev = (last.log.events || []).filter(e => e.type === 'tackle').pop()
        if (ev && ev.tackler) { const ac = acts.find(x => x.id === ev.tackler)
          if (ac && ac.side === 'def') { namedOnYouSnaps++
            tackleBySlot[ac.id] = (tackleBySlot[ac.id] || 0) + 1
            if (ac.you) youNamed++ } } }
      // the formation still fields eleven a side, at the labels it asks for
      if (acts.filter(x => x.side === 'off').length !== 11 || acts.filter(x => x.side === 'def').length !== 11)
        problems.push('formation is not eleven a side')
      return r } }
  wrap('run'); wrap('pass')
  for (let g = 0; g < GAMES; g++) window.__simGameV2(55 + (g % 20), POS)

  // he must see more than one alignment inside his position group across a season's worth of
  // snaps — pinned to one, he inherits that slot's share of the work for his whole career
  const alignments = Object.keys(youSlots).length
  if (dupYou) problems.push(`you-player fielded twice on ${dupYou} snaps (max ${dupMax})`)
  if (youSnaps > 200 && alignments < 2) problems.push(`you-player never leaves slot ${Object.keys(youSlots)[0]}`)
  return { snaps, youSnaps, dupYou, dupMax, alignments, youSlots, tackleBySlot,
    youShareOfNamed: +(youNamed / Math.max(1, namedOnYouSnaps)).toFixed(3), problems }
}, { POS, GAMES: Number(process.env.GAMES || 30) })

console.log(JSON.stringify(res, null, 2))
console.log('page errors:', errs.length ? errs : 'none')
await browser.close()
process.exit(res.problems.length || errs.length ? 1 : 0)
