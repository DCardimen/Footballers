import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
await p.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await p.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#rib-main-menu-v2 .rib9-shell'); await p.waitForTimeout(800)
const click = async (t) => { await p.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els=[...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el=els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t))); if(el){el.scrollIntoView({block:'center'});el.click()} }, { t, visSrc: vis }); await p.waitForTimeout(650) }
await click('START NEW CAREER')
for (let i=0;i<8;i++){ const done=await p.evaluate(({visSrc})=>{const vis=eval(visSrc);const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis);const txt=e=>(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()
  for(const w of ['START YOUR LEGACY','Lock In Personality']){const b=els.find(e=>txt(e).includes(w));if(b){b.click();return false}}
  const c=els.find(e=>e.classList.contains('pos-card')||/^[A-Z]{1,2} /.test(txt(e)));if(c){c.click();return false} return true},{visSrc:vis}); await p.waitForTimeout(420); if(done)break }
await click('PLAY 8-GAME SEASON'); await click('Balanced Program')
await p.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('menu') }); await p.waitForTimeout(1500)
const snap = async (label) => { const s = await p.evaluate(() => { const m = document.querySelector('#rib-main-menu-v2'); const d = window.__RIB_MENU_DATA_V89(); const t = [...m.querySelectorAll('.rib9-tint')]
  return { colors: d.team.colors, tc: !!window.__GRIDIRON_TEAM_CUSTOM__ && window.__GRIDIRON_TEAM_CUSTOM__.col, tints: t.length, sizes: t.slice(0,2).map(e => getComputedStyle(e).maskSize || getComputedStyle(e).webkitMaskSize), logo: !!m.querySelector('.rib9-helmet-logo'), hasCareer: !m.classList.contains('rib-no-career') } }); console.log(label, JSON.stringify(s)) }
await snap('before reload:')
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('#rib-main-menu-v2 .rib9-shell'); await p.waitForTimeout(600)
await snap('right after reload:')
await p.waitForTimeout(2500)
await snap('2.5s after reload:')
await p.screenshot({ path: process.env.OUT || 'reload.png' })
await b.close()
