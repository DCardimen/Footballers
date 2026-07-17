// Dev check: measure how player stat gaps drive missed tackles. Prints the single
// one-on-one juke probability across matchups and per-play evasion rates for
// controlled superstar/scrub rosters. Usage: npm run dev, then: node scripts/jukecheck.mjs
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)
const out = await page.evaluate(() => {
  const FS = window.__FieldSim
  const KEYS = ['speed','acceleration','agility','strength','tackling','awareness','burst','quickness','vision','grit','discipline','blocking','coverage','catching','jumping','throwing','stamina','ballControl']
  const mk = (pos, base, over={}) => { const a={}; KEYS.forEach(k=>a[k]=base); Object.assign(a,over); return {pos, attrs:a} }
  const POS_OFF = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"]
  const POS_DEF = ["CB","CB","S","S","LB","LB","LB","DL","DL","DL","DL"]
  const roster = (list, base) => list.map(p => mk(p, base))
  const att = (p,n) => (p&&p.attrs&&p.attrs[n])!=null ? p.attrs[n] : 50
  // single one-on-one juke probability straight from the shipped formula
  const whiffP = (agi,quick,tkl,open) => { const elus=agi*0.55+quick*0.45;
    return +Math.max(0.02, Math.min(0.80, 0.12 + (elus-tkl)*0.008 + (open?0.14:0))).toFixed(2) }
  function perPlay(offBase, defBase, rbOver, N=600) {
    const off = roster(POS_OFF, offBase), def = roster(POS_DEF, defBase)
    const K = mk("RB", offBase, rbOver); off[9] = K
    let plays=0, whiffPlays=0, evadePlays=0, yards=0
    for (let i=0;i<N;i++){ const r = FS.run(true, {off}, {def}, K, att)
      const ev = FS._Q[FS._Q.length-1].log.events
      const w = ev.filter(e=>e.type==='tackleWhiff').length
      const evd = ev.filter(e=>['tackleWhiff','brokenTackle','stiffarm'].includes(e.type)).length
      plays++; if(w>0)whiffPlays++; if(evd>0)evadePlays++; yards += r? r.yards : 0 }
    return { jukePlay:+(whiffPlays/plays*100).toFixed(0), beatDefPlay:+(evadePlays/plays*100).toFixed(0), avgYds:+(yards/plays).toFixed(1) }
  }
  return {
    single_juke: {
      even_open: whiffP(55,55,55,true), even_traffic: whiffP(55,55,55,false),
      good_vs_avg_open: whiffP(72,72,52,true),
      star_vs_weak_open: whiffP(93,93,48,true),
      generational_vs_scrub_open: whiffP(99,99,29,true),
      scrub_vs_elite_open: whiffP(38,38,90,true),
    },
    per_play: {
      superstar_vs_scrubD: perPlay(55, 40, {agility:95,quickness:95,strength:88,burst:92,speed:92}),
      even: perPlay(55, 55, {}),
      superstar_vs_eliteD: perPlay(55, 88, {agility:95,quickness:95,strength:88,burst:92,speed:92}),
      scrub_vs_eliteD: perPlay(48, 88, {agility:38,quickness:38,strength:42,burst:40,speed:45}),
    }
  }
})
console.log(JSON.stringify(out, null, 2))
await b.close()
