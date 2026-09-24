
/* ===== v16.6 PERSONALITY SLIDERS — replaces the archetype picker =====
 * 8 personality sliders (0-10, neutral 5). 10 shift-points from neutral
 * (sum of |value-5| <= 10), each capped 0-10 so you can't dump it all into one.
 * Some sliders give a flat starting-attribute boost (aggressive/physical builds
 * read clearly higher). High aggression/brashness raises clash risk -> lower
 * coach trust & snap share; IQ/EQ/coachability/loyalty lower it. Stored on
 * o.player.personaV13 and read by the story-arc wheel to weight the roll.
 */
(function(){
  "use strict";
  // ===== v20 TWO-SIDED PERSONALITY =====
  // Neither pole is "the good one" anymore: every point away from neutral buys
  // that side's UPSIDE (stat-ceiling raises, fit, immediate production, fresh
  // legs) AND its DRAWBACK (injury risk, boom/bust variance, coach clashes,
  // stamina burn, slower starts). Prestige nodes in the Mental branch modify
  // the system: Sports Psychologist softens drawbacks, Identity Coach adds
  // slider points.
  const P = [
    {key:'aggression', name:'Aggression', lo:'Composed', hi:'Aggressive',
      hiFx:{ceil:{strength:.30,tackling:.24}, clash:1.0, inj:.05},
      loFx:{ceil:{discipline:.26,awareness:.12}, clash:-.4, vr:-.04},
      hiTxt:'▲ max STR/TKL &nbsp;▼ injury risk, coach clashes',
      loTxt:'▲ max DIS/AWR, locker-room fit &nbsp;▼ fewer explosive plays'},
    {key:'iq', name:'Football IQ', lo:'Instinctive', hi:'Cerebral',
      hiFx:{ceil:{awareness:.22,vision:.30}, clash:-.5, siq:6},
      loFx:{ceil:{burst:.20,agility:.16}, vr:.03, siq:-6},
      hiTxt:'▲ max AWR/VIS, spends stamina smartly &nbsp;▼ overthinks — fewer instinct plays',
      loTxt:'▲ max BST/AGI, plays free &nbsp;▼ burns the stamina bar at random'},
    {key:'eq', name:'Composure (EQ)', lo:'Volatile', hi:'Even-Keeled',
      hiFx:{ceil:{discipline:.28,grit:.20}, clash:-1.0, vr:-.03},
      loFx:{ceil:{burst:.12}, clash:.5, vr:.06},
      hiTxt:'▲ max DIS/GRIT, steady floor &nbsp;▼ fewer monster games',
      loTxt:'▲ real boom-game upside &nbsp;▼ real bust games, clashes'},
    {key:'longterm', name:'Long-Term Focus', lo:'Win-Now', hi:'Process',
      hiFx:{ceil:{stamina:.22}, inj:-.02, perf:-.15},
      loFx:{perf:.35, inj:.02},
      hiTxt:'▲ max STA, durable &nbsp;▼ slower early production',
      loTxt:'▲ produces NOW (+flat stats every game) &nbsp;▼ overuse injury risk, no ceiling gain'},
    {key:'workethic', name:'Work Ethic', lo:'Coasts', hi:'Relentless',
      hiFx:{ceil:{acceleration:.24,agility:.20,stamina:.16}, clash:-.5, gas:.05},
      loFx:{gas:-.05, perf:-.2, clash:.2},
      hiTxt:'▲ max ACC/AGI/STA &nbsp;▼ empties the tank faster in games',
      loTxt:'▲ fresh legs (slow stamina burn) &nbsp;▼ lower output, quiet clashes'},
    {key:'loyalty', name:'Loyalty', lo:'Me-First', hi:'Team-First',
      hiFx:{ceil:{blocking:.24,grit:.10}, clash:-.8, perf:-.1},
      loFx:{perf:.25, clash:.6},
      hiTxt:'▲ max BLK/GRIT, coaches trust you &nbsp;▼ shares the spotlight (−flat stats)',
      loTxt:'▲ hunts stats (+flat stats) &nbsp;▼ clashes, trust erodes'},
    {key:'confidence', name:'Confidence', lo:'Humble', hi:'Brash',
      hiFx:{ceil:{speed:.20,burst:.28}, clash:.6, vr:.04},
      loFx:{ceil:{awareness:.10}, clash:-.6, inj:-.02, vr:-.02},
      hiTxt:'▲ max SPD/BST, big-play hunter &nbsp;▼ boom/bust, clashes',
      loTxt:'▲ steady, coach favorite, safer body &nbsp;▼ lower athletic ceiling'},
    {key:'coachability', name:'Coachability', lo:'Stubborn', hi:'Coachable',
      hiFx:{ceil:{awareness:.16,catching:.24}, clash:-1.0, vr:-.02},
      loFx:{ceil:{grit:.22}, clash:.7, vr:.03},
      hiTxt:'▲ max AWR/CAT, more snaps &nbsp;▼ predictable — fewer wild highs',
      loTxt:'▲ max GRIT, does it his way &nbsp;▼ clashes, slower to learn'}
  ];
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const st = ()=>{ try{ return window.__getGridironState && window.__getGridironState(); }catch(e){ return null; } };
  const ATTR = {speed:'SPD',acceleration:'ACC',agility:'AGI',strength:'STR',tackling:'TKL',awareness:'AWR',vision:'VIS',discipline:'DIS',grit:'GRIT',stamina:'STA',blocking:'BLK',burst:'BST',catching:'CAT'};
  // prestige modifiers (Mental branch nodes, levels live in state.tree)
  const masteryLvl = ()=>{ const s=st(); return (s&&s.tree&&s.tree.personaMastery)||0; };
  const softMult   = ()=>Math.max(.25, 1-.15*masteryLvl());
  // v21.1: your starting personality is ROLLED, not chosen. What prestige buys
  // is ADJUSTMENT points — the further you get (+1 per prestige, plus Identity
  // Coach), the more you can bend who you rolled into who you want to be.
  const budget     = ()=>{ const s=st(); return ((s&&s.prestige)||0) + 2*((s&&s.tree&&s.tree.personaPlus)||0); };

  let persona = null;          // working copy while the overlay is open
  let rolledBase = null;       // the personality the dice gave this career
  let shown = false;

  // bell-ish roll centered on neutral: most traits land 3-7, tails are possible
  function roll1(){ return clamp(Math.round(((Math.random()+Math.random()+Math.random())/3)*10),0,10); }
  function fresh(){ const o={}; P.forEach(t=>o[t.key]=roll1()); return o; }
  const baseOf = k => (rolledBase&&rolledBase[k])??5;
  function spent(pn){ let s=0; P.forEach(t=>s+=Math.abs((pn[t.key]??5)-baseOf(t.key))); return s; }
  // which side is active + how many points deep
  function sideFx(tr, v){ const d=(v??5)-5; if(!d) return {fx:null,pts:0}; return d>0?{fx:tr.hiFx,pts:d}:{fx:tr.loFx,pts:-d}; }
  // CEILING MODEL — BOTH directions raise the MAX LEVEL of their own stats by
  // +10% per point; the season growth engine reads statCeilV17 to let those
  // stats climb past the normal potential wall.
  const CEIL_PER_PT = 0.10, CEIL_MAX = 2.0;
  function ceilMap(pn){ const m={}; P.forEach(tr=>{ const {fx,pts}=sideFx(tr,pn[tr.key]); if(!fx||!fx.ceil) return; for(const k in fx.ceil){ m[k]=(m[k]||1)+pts*CEIL_PER_PT; } }); for(const k in m){ m[k]=clamp(m[k],1,CEIL_MAX); } return m; }
  // display: percentage the MAX LEVEL of each stat is raised by
  function boosts(pn){ const m=ceilMap(pn), out={}; for(const k in m){ const pct=Math.round((m[k]-1)*100); if(pct>0) out[k]=pct; } return out; }
  function clashOf(pn){ let c=0; P.forEach(tr=>{ const {fx,pts}=sideFx(tr,pn[tr.key]); if(fx&&fx.clash) c+=fx.clash*pts; }); return c; }
  // v20 aggregate side-effects — the REAL levers the game reads. Prestige
  // (Sports Psychologist) softens only the harmful half of each dial.
  function fxOf(pn){
    const soft=softMult(); let inj=0,vr=0,perf=0,gas=0,siq=0;
    P.forEach(tr=>{ const {fx,pts}=sideFx(tr,pn[tr.key]); if(!fx) return;
      inj+=(fx.inj||0)*pts; vr+=(fx.vr||0)*pts; perf+=(fx.perf||0)*pts; gas+=(fx.gas||0)*pts; siq+=(fx.siq||0)*pts; });
    if(inj>0)inj*=soft; if(vr>0)vr*=soft; if(perf<0)perf*=soft; if(gas>0)gas*=soft;
    return { injMult:clamp(1+inj,.6,1.6), varMult:clamp(1+vr,.7,1.5),
             perfFlat:Math.round(perf*10)/10, gasBurn:clamp(1+gas,.6,1.5), sprintIQ:Math.round(siq) };
  }
  // footer chips describing the aggregate up/downsides
  function fxChips(pn){
    const fx=fxOf(pn), out=[];
    if(fx.injMult>1.01) out.push({up:false,t:'▼ +'+Math.round((fx.injMult-1)*100)+'% injury risk'});
    if(fx.injMult<0.99) out.push({up:true, t:'▲ '+Math.round((1-fx.injMult)*100)+'% fewer injuries'});
    if(fx.varMult>1.01) out.push({up:false,t:'▼ boom/bust: ±'+Math.round((fx.varMult-1)*100)+'% swingier games'});
    if(fx.varMult<0.99) out.push({up:true, t:'▲ steadier games (−'+Math.round((1-fx.varMult)*100)+'% swings)'});
    /* v101: a swing under a full point is stated in words — the sheet never prints a fraction */
    if(fx.perfFlat>=1)  out.push({up:true, t:'▲ +'+Math.round(fx.perfFlat)+' to all stats every game'});
    else if(fx.perfFlat>0) out.push({up:true, t:'▲ a nudge to all stats every game'});
    if(fx.perfFlat<=-1) out.push({up:false,t:'▼ '+Math.round(fx.perfFlat)+' to all stats every game'});
    else if(fx.perfFlat<0) out.push({up:false,t:'▼ a shade off all stats every game'});
    if(fx.gasBurn>1.01) out.push({up:false,t:'▼ +'+Math.round((fx.gasBurn-1)*100)+'% stamina burn'});
    if(fx.gasBurn<0.99) out.push({up:true, t:'▲ '+Math.round((1-fx.gasBurn)*100)+'% slower stamina burn'});
    if(fx.sprintIQ>0)   out.push({up:true, t:'▲ smart stamina timing'});
    if(fx.sprintIQ<0)   out.push({up:false,t:'▼ wastes stamina at random'});
    if(masteryLvl()>0)  out.push({up:true, t:'🧘 Sports Psychologist L'+masteryLvl()+': drawbacks −'+Math.round((1-softMult())*100)+'%'});
    return out;
  }

  // apply persona to a player — sets the ceiling multipliers (NOT the live attrs),
  // migrates any legacy immediate boost back off, and applies clash + side-effects.
  window.__personaApplyV13 = function(p){
    if(!p||!p.personaV13) return;
    const pn=p.personaV13;
    // migrate PR#14 saves: undo any immediate attr boost that was baked in
    if(p._personaBaseV13 && p.attrs){ for(const k in p._personaBaseV13){ if(p.attrs[k]!=null) p.attrs[k]=p._personaBaseV13[k]; } delete p._personaBaseV13; }
    p.statCeilV17 = ceilMap(pn);   // { stat: 1.xx } potential multipliers
    const c=clashOf(pn);
    p.coachTrust = clamp(Math.round((p.coachTrust!=null?p.coachTrust:50) - c*1.5), 5, 100);
    p.snapShare  = clamp((p.snapShare!=null?p.snapShare:0.12) - Math.max(0,c)*0.01, 0.04, 0.98);
    p._personaClashV13 = c;
    p.personaFxV20 = fxOf(pn);     // { injMult, varMult, perfFlat, gasBurn, sprintIQ }
    try{ window.__youPersonaFxV20 = p.personaFxV20; }catch(e){}
  };
  window.__personaCeilMap = ceilMap;
  // re-export the fx on load for saves that already carry a persona
  try{ const s=st(); if(s&&s.player&&s.player.personaFxV20) window.__youPersonaFxV20=s.player.personaFxV20; }catch(e){}

  function stepHTML(t, val){
    const pct = val*10;
    const gone = spent(persona);
    const base = baseOf(t.key);
    const canUp = val<10 && (val<base || gone<budget());
    const canDn = val>0 && (val>base || gone<budget());
    return `<div class="pv13-row">
      <div class="pv13-top"><span class="pv13-name">${t.name}</span><span class="pv13-val">${val!==base?`<small class="pv13-basewas">${base}→</small>`:''}${val}</span></div>
      <div class="pv13-track">
        <button class="pv13-step" ${canDn?'':'disabled'} onclick="__personaStepV13('${t.key}',-1)">–</button>
        <div class="pv13-bar"><span class="pv13-lo">${t.lo}</span><u style="left:${base*10}%" title="rolled value"></u><i style="left:${pct}%"></i><span class="pv13-hi">${t.hi}</span><b style="width:${pct}%"></b></div>
        <button class="pv13-step" ${canUp?'':'disabled'} onclick="__personaStepV13('${t.key}',1)">+</button>
      </div>
      ${val!==5?`<div class="pv13-fx">${val>5?t.hiTxt:t.loTxt}</div>`:`<div class="pv13-fx neutral">neutral — lean either way: both sides trade real upside for real cost</div>`}</div>`;
  }
  function render(){
    const wrap=document.getElementById('personaV13'); if(!wrap) return;
    const body=wrap.querySelector('.pv13-body'); const foot=wrap.querySelector('.pv13-foot');
    body.innerHTML = P.map(t=>stepHTML(t, persona[t.key]??5)).join('');
    const b=boosts(persona), c=clashOf(persona);
    const bStr = Object.keys(b).length ? Object.entries(b).map(([k,v])=>`<span class="pv13-chip up" title="Raises the MAX LEVEL this stat can be developed to">▲ +${v}% max ${ATTR[k]||k.toUpperCase()}</span>`).join('') : '<span class="pv13-muted">Neutral — no ceiling boost</span>';
    const clashTxt = c>2 ? `<span class="pv13-chip dn">clashes with coaches → less playtime</span>` : c<-2 ? `<span class="pv13-chip up">locker-room fit → more trust</span>` : '';
    const sideChips = fxChips(persona).map(x=>`<span class="pv13-chip ${x.up?'up':'dn'}">${x.t}</span>`).join('');
    const bud = budget();
    const ptsLine = bud>0
      ? `Adjustments left: <b>${bud-spent(persona)}</b> / ${bud}`
      : `<span style="color:var(--chalk-dim)">No adjustment points — you are who you rolled. <b style="color:var(--gold)">+1 per prestige</b> (and Identity Coach) to customize future careers.</span>`;
    foot.innerHTML = `<div class="pv13-pts">${ptsLine}</div>
      <div class="pv13-boosts">${bStr} ${clashTxt} ${sideChips}</div>
      <button class="pv13-lock" onclick="__personaConfirmV13()">Lock In Personality ›</button>`;
  }
  window.__personaStepV13 = function(key, dir){
    const cur = persona[key]??5, next = cur+dir, base = baseOf(key);
    if(next<0||next>10) return;
    // moving back toward your ROLLED value is always free; bending away from
    // who you rolled costs an adjustment point
    const away = Math.abs(next-base) > Math.abs(cur-base);
    if(away && spent(persona) >= budget()) return;
    persona[key]=next; render();
  };
  window.__personaConfirmV13 = function(){
    const s=st(), p=s&&s.player; if(!p){ close(); return; }
    p.personaV13 = Object.assign({}, persona);
    p.personaRolledV21 = Object.assign({}, rolledBase||persona);
    close();
    // set the origin FIRST (prodigy: unlocks position selection, re-renders, saves),
    // then apply the persona so its ceiling multipliers sit on the prestige+origin base.
    try{ if(typeof window.chooseOriginV11==='function') window.chooseOriginV11('prodigy'); }catch(e){}
    window.__personaApplyV13(p);
    try{ window.I && window.I(); }catch(e){}
  };
  function close(){ document.getElementById('personaV13')?.remove(); shown=false; persona=null; rolledBase=null; }

  function overlayHTML(){
    return `<div class="pv13-ovl" id="personaV13"><div class="pv13-panel">
      <div class="pv13-head"><div class="pv13-kick">CAREER · WHO ARE YOU</div><div class="pv13-title">🎲 Your Rolled Personality</div>
      <div class="pv13-sub">The dice decided who this kid is — the white tick on each bar is his <b>rolled value</b>. Every trait has <b>two real identities</b>: each side raises the <b>MAX LEVEL</b> of its own stats (+10%/pt) and carries its own drawback. You have <b>${budget()}</b> adjustment point${budget()===1?'':'s'} to bend the roll (<b>+1 per prestige</b> · Identity Coach +2/lvl); moving back toward the roll is free.</div></div>
      <div class="pv13-body"></div>
      <div class="pv13-foot"></div>
    </div></div>`;
  }
  function show(){
    if(document.getElementById('personaV13')) return;
    persona = fresh(); rolledBase = Object.assign({}, persona); shown=true;
    document.body.insertAdjacentHTML('beforeend', overlayHTML());
    render();
  }
  // show the slider overlay whenever the archetype picker would appear and the
  // player hasn't set a personality yet.
  function maybeShow(){
    const s=st(), p=s&&s.player;
    if(!p) return;
    if(p.personaV13){ return; }
    if(document.querySelector('.origin-choice-v11') && !document.getElementById('personaV13')) show();
  }
  const mo = new MutationObserver(()=>{ try{ maybeShow(); }catch(e){} });
  try{ mo.observe(document.body, {childList:true, subtree:true}); }catch(e){}
  setInterval(()=>{ try{ maybeShow(); }catch(e){} }, 400);
})();
