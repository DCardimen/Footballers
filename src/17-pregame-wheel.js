
/* ===== v51 PREGAME WHEEL — the game plan is ROLLED, on the same wheel =====
 * v41 deleted the plan panel and silently auto-picked the scout's pick, so the
 * decision the player meets most often — every single week — showed nothing at
 * all: no wheel, no odds, nothing to speed through. The plan is now rolled on
 * the shared v50 wheel, weighted by the same personality appetite the story
 * wheel uses, and resolved by the same fit roll.
 *
 * The deck is read off the panel the game already rendered (id, icon, colour and
 * the UPSIDE / CONTROL / RISK bars), so this stays a presentation layer — it
 * invents no plans and changes no plan maths, and if the deck cannot be parsed
 * it falls straight back to v41's silent auto-pick. */
(function(){
  "use strict";
  const ST=()=>{try{return window.__GRIDIRON_AUDIT__?.getState?.()||window.S||null}catch(e){return null}};
  const getPl=()=>{const s=ST();return s&&s.player||null};
  const G=()=>window.__GROWTH_V42;
  const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const FALLBACK_COL=["#7d1a20","#10456e","#5e4a0a","#28571a","#3a2668","#6b1a44"];

  // ---- read the deck the game just drew
  function readPlans(panel){
    return [...panel.querySelectorAll('[onclick*="chooseGamePlanV11"]')].map((b,i)=>{
      const m=(b.getAttribute("onclick")||"").match(/chooseGamePlanV11\('([^']+)'\s*,\s*(true|false)/);
      if(!m)return null;
      const bars={};
      b.querySelectorAll(".mini-rating label").forEach(l=>{
        const sp=l.querySelectorAll("span");
        if(sp.length>1)bars[sp[0].textContent.trim().toUpperCase()]=parseInt(sp[1].textContent,10)||0;
      });
      const nm=(b.querySelector("b")?.textContent||"Plan").replace(/\s*·\s*SCOUT PICK\s*$/i,"").trim();
      let col=""; try{col=(b.style.getPropertyValue("--planColor")||"").trim()}catch(e){}
      return {id:m[1],rec:m[2]==="true",
        icon:(b.querySelector(".plan-icon")?.textContent||"").trim(),
        name:nm, scout:/SCOUT PICK/i.test(b.querySelector("b")?.textContent||""),
        col:col||FALLBACK_COL[i%FALLBACK_COL.length],
        up:bars.UPSIDE==null?50:bars.UPSIDE, ctrl:bars.CONTROL==null?50:bars.CONTROL, risk:bars.RISK==null?50:bars.RISK,
        tags:[...b.querySelectorAll(".gameplan-meta span")].map(s=>s.textContent.trim()).filter(t=>!/fatigue|injur/i.test(t))};
    }).filter(Boolean);
  }
  // how bold a plan is, 0..1 — upside and risk pulling against control
  const boldOf=p=>cl(((p.up+p.risk)/2-p.ctrl)/100*.9+.5,0,1);
  // What this character WANTS. Deliberately the same appetite the v16.6 story
  // wheel computes, so the two decision surfaces can never disagree about him.
  function appetite(P){
    const g=k=>((P[k]==null?5:P[k])-5)/5;
    return cl((g("aggression")*1.0+g("confidence")*.8-g("eq")*.7-g("coachability")*.6-g("loyalty")*.35-g("longterm")*.25)/1.6,-1,1);
  }
  const TRAIT_W={aggression:1.0,confidence:.8,eq:-.7,coachability:-.6,loyalty:-.35,longterm:-.25};
  /* ===== v62 PLAN KINDS — a plan is not just how BOLD it is =====
   * Boldness was the only thing the wheel could see, and "Rest & Recover", "Film
   * Marathon", "Do the Dirty Work" and "Disciplined Execution" all sit at roughly
   * the same place on upside/control/risk — so they all drew the same wedge and
   * the wheel came out nearly flat (18/18/18/19 in the wild). Boldness is real but
   * it is one axis, and it is not the one that says a driven, hot-headed kid will
   * not sit still for a recovery day.
   *
   * So classify the plan by what it ASKS of him — read off the name and tags the
   * staff panel already rendered — and weight it with the same shape of linear
   * trait formula the growth themes use, which also means the roll pop-up can show
   * a ledger for it that adds up. Boldness stays, as the second factor. A plan
   * whose name matches nothing falls back to boldness alone, exactly as before. */
  const PLAN_KIND=[
    {id:"rest",re:/rest|recover|rehab|sleep|ice|load|maintenance|treatment|fresh|preserve|manage/i,
      w:P=>1+P.longterm*1.0+P.eq*.8+P.coachability*.6-P.aggression*.75-P.workethic*.45},
    {id:"study",re:/film|tape|study|scout|install|classroom|meeting|walk|prep|book|homework|chart|read/i,
      w:P=>1+P.iq*1.1+P.longterm*.6+P.coachability*.45-P.aggression*.3},
    {id:"grind",re:/dirty|grind|grit|physical|punish|trench|extra|iron|nasty|blue|hammer|impose|work/i,
      w:P=>1+P.workethic*1.0+P.aggression*.8-P.eq*.3-P.iq*.15},
    {id:"shine",re:/highlight|chase|spotlight|hero|showcase|swing|gamble|freelance|improvis|explode|big play|shot/i,
      w:P=>1+P.confidence*1.1+P.aggression*.8-P.coachability*.7-P.longterm*.45},
    {id:"system",re:/disciplin|execut|assignment|fundamental|control|clean|book|structure|script|protect|conservat|safe/i,
      w:P=>1+P.coachability*1.0+P.iq*.6+P.eq*.55-P.aggression*.5-P.confidence*.3},
    {id:"team",re:/team|captain|lead|rally|unit|brother|culture|communicat|trust|together|locker/i,
      w:P=>1+P.loyalty*1.0+P.eq*.6+P.coachability*.45}
  ];
  const kindOf=p=>PLAN_KIND.find(k=>k.re.test((p.name||"")+" "+((p.tags||[]).join(" "))))||null;
  // debug surface for scripts/wheelcheck.mjs: the classifier and the weighting, so
  // the check can put a named plan and a named personality in and read the wedge
  // out, instead of hoping the right deck turns up in a live career
  // the wedge floor, as the wheel applies it — exposed so the dev check measures
  // the arc that actually gets drawn rather than the raw appetite behind it
  const floorShares=ws=>{const n=ws.length,fl=cl((window.TU?window.TU("wheelWedgeFloor",.035):.035),0,1/(n+1)),
    T=ws.reduce((a,w)=>a+w,0)||1;return ws.map(w=>fl+(w/T)*(1-fl*n))};
  try{window.__PLAN_V62={kinds:PLAN_KIND.map(k=>k.id),kindOf,appetite,boldOf,floorShares,
    weigh:(P,p)=>{const g=window.__GROWTH_V42,NEU=(g&&g.NEUTRAL)||{},pr=appetite(P),b=boldOf(p),kd=kindOf(p);
      const POW=cl((window.TU?window.TU("planPersonaPow",1.7):1.7),1,4);
      const boldW=.45+.55*Math.pow(cl((1+pr*(2*b-1))/2,0,1),1.3);
      const kindW=kd?Math.pow(Math.max(.2,kd.w(P))/Math.max(.2,kd.w(NEU)),POW):1;
      return{kind:kd?kd.id:null,bold:+b.toFixed(3),w:Math.max(.04,boldW*kindW),
        jive:kd&&g&&g.jiveFrom?+g.jiveFrom(P,kd.w).jive.toFixed(3):null}}}}catch(e){}
  function drivers(P,bold){
    const dir=bold>=.5?1:-1,out=[];
    for(const k in TRAIT_W){const c=((P[k]==null?5:P[k])-5)*TRAIT_W[k]*dir;if(c>=.5)out.push({k,c})}
    return out.sort((a,b)=>b.c-a.c).slice(0,2);
  }
  /* ===== v85 THE DECISION, WITH NO WHEEL ATTACHED =====
   * Which plan his instincts pick, whether it comes off, and what that does to
   * him this game — split out of rollPlan so a simmed week (quick play, sim the
   * rest of the season) rolls the very same dice with nothing on screen. rollPlan
   * is now presentation only: it draws what decidePlan decided. */
  /* v146 D: `sel` is the plan the player CHOSE (choice mode only) and `dice` the week's held
   * uniforms for the fit roll, so switching plans on the page re-prices the roll without re-rolling it */
  function decidePlan(pl,plans,sel,dice){
    const g=G(); if(!g||!g.persona||!g.bandOdds||!g.jiveFrom)return null;
    const CH=choiceV146()&&sel!==undefined&&sel!==null, R=k=>(dice&&dice[k]!=null)?dice[k]:Math.random();
    if(!pl||!plans||plans.length<2)return null;

    const P=g.persona(pl), pr=appetite(P);
    const NEU=g.NEUTRAL||{aggression:5,iq:5,eq:5,longterm:5,workethic:5,loyalty:5,confidence:5,coachability:5};
    const POW=cl((window.TU?window.TU("planPersonaPow",1.7):1.7),1,4);
    const all=plans.map(p=>{
      const b=boldOf(p), align=(1+pr*(2*b-1))/2;
      const kd=kindOf(p);
      // how much he wants the RISK of it — floored, so boldness alone can no longer
      // crush a plan on its own and the KIND term is what separates the middle...
      const boldW=.45+.55*Math.pow(cl(align,0,1),1.3);
      // ...times how much he wants the WORK of it, sharpened so the difference is
      // an arc you can see rather than a percentage point
      const kindW=kd?Math.pow(Math.max(.2,kd.w(P))/Math.max(.2,kd.w(NEU)),POW):1;
      return Object.assign({},p,{bold:b,kind:kd,w:Math.max(.04,boldW*kindW)});
    });
    // The staff can offer ten plans, and ten wedges is an unreadable wheel. His
    // instincts shortlist: the best-fitting MAX, always keeping the scout's pick
    // so the recommendation is never quietly removed from the board. What got cut
    // is stated on the panel rather than silently dropped.
    const MAX=6;
    let opts=all, cut=0;
    if(!CH&&all.length>MAX){   // v146 D: a CHOSEN plan comes off the whole board — nothing is shortlisted away
      const keep=all.slice().sort((a,b)=>b.w-a.w).slice(0,MAX);
      if(!keep.some(o=>o.scout)){const sp=all.find(o=>o.scout);if(sp){keep[keep.length-1]=sp}}
      opts=all.filter(o=>keep.indexOf(o)>=0);            // shortlist, in the staff's order
      cut=all.length-opts.length;
    }
    // the same no-wedge-vanishes floor the growth wheel uses, applied AFTER the
    // shortlist so it cannot change who got cut
    {const n=opts.length, fl=cl((window.TU?window.TU("wheelWedgeFloor",.035):.035),0,1/(n+1)), T=opts.reduce((a,o)=>a+o.w,0)||1;
      opts=opts.map(o=>Object.assign({},o,{w:fl+(o.w/T)*(1-fl*n)}))}
    const tot=opts.reduce((s,o)=>s+o.w,0);
    let idx=0;
    if(CH)idx=Math.max(0,opts.findIndex(o=>o.id===sel));   // v146 D: the player's pick, not a draw
    else{let r=Math.random()*tot;for(let i=0;i<opts.length;i++){r-=opts[i].w;if(r<=0){idx=i;break}}}
    const win=opts[idx];

    // ---- fit roll, same system as the growth wheel: jive sets the odds, the
    // plan's own risk and the kid's form nudge them.
    // jive comes from the plan's KIND when it has one — same normalisation the
    // growth wheel uses, and it brings a per-trait ledger with it. A plan the
    // classifier does not recognise still resolves on boldness alone.
    const JF=win.kind?g.jiveFrom(P,win.kind.w):null;
    const jive=JF?JF.jive:cl(pr*(2*win.bold-1),-1,1);
    const trust=pl.coachTrust==null?50:pl.coachTrust;
    const mom=pl.momentum103==null?50:pl.momentum103, compz=pl.composure103==null?50:pl.composure103;
    const fatg=(pl.conditionV11&&pl.conditionV11.fatigue)||0;
    const nudge=cl(-(win.risk/100-.42)*.34+(trust-50)*.003+(mom-50)*.0015+(compz-50)*.0015-fatg*.003+(R("nz")-.5)*.10,-.22,.22);
    const odds=g.bandOdds(jive,nudge);
    const rr=R("rr");
    const band=rr<odds.g?"green":rr<odds.g+odds.n?"neutral":"red";

    const dv=drivers(P,win.bold).map(d=>`${(g.TRAIT_LBL&&g.TRAIT_LBL[d.k])||d.k} ${P[d.k]}`).join(" · ");
    const heavy=win.risk>=55;
    const why=`${dv?(jive>=.12?`<b>${dv}</b> — this is how you want to play.`:jive<=-.12?`<b>${dv}</b> — this is not how you want to play.`:`<b>${dv}</b> — you could take it or leave it.`):"Nothing in your personality pulls either way here."} ${nudge<=-.06?`Then ${heavy?"the risk in this plan and ":""}your current form drag${heavy?"":"s"} the odds back down.`:nudge>=.06?`Your standing and form push them further up.`:`Nothing else is moving them.`}`;

    // ---- what the band DOES: a single-game effect through the existing growth
    // pipeline, so it composes into the same array the sim already consumes.
    const pool=(g.POOLS&&(g.POOLS[pl.pos]||g.POOLS.LB))||[];
    const stats=[];
    for(let i=0;i<pool.length&&stats.length<(band==="green"?3:2);i++){
      const k=pool[(i*2+idx)%pool.length]; if(k&&stats.indexOf(k)<0)stats.push(k);
    }
    const amt=band==="green"?3+((R("am")*3)|0):band==="red"?3+((R("am")*2)|0):2;
    const out={card:"plan_"+win.id,icon:win.icon,name:win.name,band,
      sign:band==="red"?-1:1,stats,amt:band==="neutral"?1:amt,
      tier:{games:1},permanent:false,fatigue:0,ctx:"pregame",tag:"PLAN",jive,odds,nudge,
      story:band==="green"?"It came off exactly the way you drew it up."
        :band==="neutral"?"It worked well enough. Nothing special either way."
        :"The plan did not survive contact with the game."};

    return {g,all,opts,cut,idx,win,band,out,stats,jive,odds,nudge,why,JF,P,chosen:CH};
  }
  // what the band DOES: a single-game effect through the existing growth pipeline,
  // so it composes into the same array the sim already consumes
  function applyDecision(pl,d){
    try{
      if(d.stats.length&&d.band!=="neutral")d.g.applyOutcome(pl,d.out);
      pl._nextGameBoost=0;
      pl._tempStatBuffsV25=d.g.compose(pl)||null;
    }catch(e){}
  }
  // the same roll with the wheel skipped: returns what the week should record, or
  // null when the deck cannot be read (the caller falls back to the scout pick)
  function silentPlan(pl,panel){
    const plans=readPlans(panel); if(plans.length<2)return null;
    const d=choiceV146()?decidePlan(pl,plans,defaultPickV146(pl,plans),null):decidePlan(pl,plans); if(!d)return null;   // v146 D: a simmed week runs the plan he last chose
    applyDecision(pl,d);
    const LBL=(d.g&&d.g.LBL)||{};
    return {id:d.win.id,rec:!!d.win.rec,name:d.win.name,icon:d.win.icon,band:d.band,
      lines:d.stats.length&&d.band!=="neutral"?d.stats.map(k=>(d.out.sign>0?"+":"−")+d.out.amt+" "+(LBL[k]||k)).join(" · "):"no swing this game",
      odds:d.odds,cut:d.cut,offered:d.all.length,chosen:!!d.chosen};
  }
  /* ===== v135 THE WHEEL SPINS ON THE FIFTH PAGE =====
   * The plan wheel used to open the moment the staff's deck hit the page: the sweep below saw
   * the `.gameplan-overlay`, tore it out and spun over whatever was up, BEFORE the pregame
   * wizard, so the one decision surface the player meets every week arrived as an interruption
   * with no page of its own. (And the midseason crossroads fired on a timer after a game, on any
   * screen it found — see the v42 watcher, which now QUEUES it on the player.) The deck is still
   * read and the decision still rolled here, with the same dice — `holdPlanV135` rolls it ONCE
   * per week and holds it, so leaving the wizard and coming back cannot re-roll — but the wizard
   * opens straight away and its FIFTH page spins the wheel inline (`wheelCfgV135` is the
   * presentation both that page and the no-wizard fallback draw), then names the final stat.
   * `commitHeldV135` applies the swing exactly once when the wizard sends him to the field; a
   * skip from an earlier page commits the same held roll unseen. `TU("wheelOnPageV135",0)`
   * restores the overlay before the wizard. */
  let heldV135=null;
  const keyV135=(pl,plans)=>(pl.name||"")+"|"+((pl.weekResults||[]).filter(w=>w&&w.played).length)+"|"+(pl.currentWeek|0)+"|"+plans.map(p=>p.id).join(",");
  function wheelCfgV135(pl,d){
    const g=G(),LBL=(g&&g.LBL)||{};
    const {all,opts,cut,idx,win,band,out,stats,jive,odds,nudge,why,JF,P}=d;
    return {
      title:"PREGAME · HOW ARE YOU PLAYING THIS ONE?",
      sub:cut?`The staff offered ${all.length}. Your instincts shortlisted ${opts.length}.`:"The staff hands you options. Your instincts pick.",
      opts:opts.map(o=>({key:o.id,icon:o.icon,name:o.name,col:o.col,plan:o.id,w:o.w,
        line1:`UPSIDE ${o.up} · CONTROL ${o.ctrl} · RISK ${o.risk}${o.scout?"  ·  SCOUT PICK":""}`,
        line2:o.tags.slice(0,2).join(" · ")||"",
        line2col:o.scout?"#f0bb45":"#8fa2bb"})),
      pick:idx, turns:(pl.weekResults||[]).length,
      fit:{jive,odds,nudge,why,
        rows:JF?JF.rows:drivers(P,win.bold).map(d=>({key:d.k,label:(g&&g.TRAIT_LBL&&g.TRAIT_LBL[d.k])||d.k,val:P[d.k],
          pp:d.c*(jive>=0?4:2.8)})),
        rollTitle:"GAME PLAN ROLL · DOES IT COME OFF?",
        rollSub:"Positive, neutral or negative. The dice decide — your personality loads them."},
      result:{band,
        headline:`<span class="gv64-head" style="font-size:15px;margin:0">${(window.RIB_PLAN_ICO?window.RIB_PLAN_ICO(win.id,win.icon,30):win.icon+" ")}<span>${win.name} — ${band==="green"?"IT CLICKS":band==="neutral"?"IT'LL DO":"IT BACKFIRES"}</span></span>`,
        story:out.story,
        lines:stats.length?stats.map(k=>(out.sign>0?"+":"−")+out.amt+" "+(LBL[k]||k)).join(" · "):"no swing this game",
        dur:"THIS GAME"}};
  }
  function holdPlanV135(pl,plans){
    const key=keyV135(pl,plans);
    if(heldV135&&heldV135.key===key)return heldV135;
    // v146 D: choice mode holds the week's DICE with the default pick; the pick itself is the player's
    const ch=choiceV146(),dice=ch?{nz:Math.random(),rr:Math.random(),am:Math.random()}:null;
    const d=ch?decidePlan(pl,plans,defaultPickV146(pl,plans),dice):decidePlan(pl,plans); if(!d)return null;
    heldV135={key,d,pl,plans,dice,applied:false,rolledAt:Date.now()};
    return heldV135;
  }
  function applyHeldV135(){const h=heldV135;if(h&&!h.applied){applyDecision(h.pl,h.d);h.applied=true}return h}
  function commitHeldV135(){const h=applyHeldV135();heldV135=null;if(h&&h.dice)try{rollSayV146(h)}catch(e){}return h}
  /* ===== v146 D THE PLAN IS YOURS (the choice) =====
   * `TU("planWheelV146",0)` — 0, the default, is choice mode: the wizard's fifth page lays the whole
   * board out and the player taps the plan he runs; 1 restores the v135 wheel exactly. The pick is
   * remembered on the player (`planPickV146`) and is next week's default and the plan a simmed week
   * runs; with none yet it is the scout's pick. The FIT ROLL — does the plan come off — stays a roll,
   * because that is the plan's risk, but its dice are held for the week (`heldV135.dice`), so tapping
   * round the board re-prices the odds without re-rolling them, and the result is only revealed at
   * kickoff (`rollSayV146`, `week.planRollV146`). */
  function choiceV146(){return !(window.TU?window.TU("planWheelV146",0):0)}
  function defaultPickV146(pl,plans){const has=id=>id&&plans.some(p=>p.id===id);
    if(has(pl&&pl.planPickV146))return pl.planPickV146;const sp=plans.find(p=>p.scout);return sp?sp.id:(plans[0]&&plans[0].id)}
  function pickPlanV146(id){const h=heldV135;if(!h||h.applied||!h.dice||!h.plans.some(p=>p.id===id))return null;
    const d=decidePlan(h.pl,h.plans,id,h.dice);if(!d)return null;h.d=d;h.pl.planPickV146=id;
    try{window.__pregamePickV146&&window.__pregamePickV146(id)}catch(e){}return d}
  // the stats a click (3) and a backfire (2) move, in the order decidePlan walks the position's pool
  function seqStatsV146(pl,idx,n){const g=G(),pool=(g&&g.POOLS&&(g.POOLS[pl.pos]||g.POOLS.LB))||[],out=[];
    for(let i=0;i<pool.length&&out.length<n;i++){const k=pool[(i*2+idx)%pool.length];if(k&&out.indexOf(k)<0)out.push(k)}return out}
  function bandForV146(id){const h=heldV135;if(!h||!h.dice)return null;const d=decidePlan(h.pl,h.plans,id,h.dice);if(!d)return null;
    return{id,g:d.odds.g,n:d.odds.n,r:d.odds.r,statsG:seqStatsV146(h.pl,d.idx,3),statsR:seqStatsV146(h.pl,d.idx,2),jive:d.jive,why:d.why,scout:!!d.win.scout}}
  function rollSayV146(h){const d=h.d,pl=h.pl,LBL=(d.g&&d.g.LBL)||{},w=(pl.weekResults||[]).find(x=>x&&!x.played);
    const lines=d.stats.length&&d.band!=="neutral"?d.stats.map(k=>(d.out.sign>0?"+":"−")+d.out.amt+" "+(LBL[k]||k)).join(" · "):"no swing this game";
    if(w)w.planRollV146={id:d.win.id,name:d.win.name,icon:d.win.icon,band:d.band,lines};
    const t=document.getElementById("toast");if(t){t.textContent=`${d.win.icon||"📋"} ${d.win.name}: ${d.band==="green"?"IT CLICKS":d.band==="neutral"?"IT'LL DO":"IT BACKFIRES"} — ${lines}`;t.classList.add("show");clearTimeout(rollSayV146._t);rollSayV146._t=setTimeout(()=>t.classList.remove("show"),3200)}}
  const wizardUpV135=()=>{const ch=window.chooseGamePlanV11;return !!(ch&&ch.__pregameV1514)&&!window.__silentSimV85&&!!(window.TU?window.TU("wheelOnPageV135",1):1)};
  function rollPlan(panel){
    if(!panel||panel._v51done)return false;
    const g=G(); if(!g||!g.spinWheel)return false;
    const plans=readPlans(panel); if(plans.length<2)return false;
    const pl=getPl(); if(!pl)return false;
    panel._v51done=true;
    panel.remove();                       // the wheel replaces the deck, as v41 did
    const h=holdPlanV135(pl,plans);
    if(!h){panel._v51done=false;return false}
    const d=h.d;
    // v135: the wizard carries the wheel on its fifth page — hand it the held decision and open it
    if(wizardUpV135()){try{window.chooseGamePlanV11(d.win.id,d.win.rec)}catch(e){} return true}
    const okOpen=g.spinWheel(Object.assign(wheelCfgV135(pl,d),{onDone:()=>{
        commitHeldV135();
        try{window.chooseGamePlanV11&&window.chooseGamePlanV11(d.win.id,d.win.rec)}catch(e){}
      }}));
    if(!okOpen){                          // wheel busy — never strand the player pre-snap
      try{commitHeldV135();window.chooseGamePlanV11&&window.chooseGamePlanV11(d.win.id,d.win.rec)}catch(e){}
    }
    return true;
  }
  // v41 fallback: if the deck cannot be parsed or the growth module is missing,
  // take the scout pick silently rather than blocking the game.
  function autoPlan(panel){
    if(!panel||panel._v41done||panel._v51done)return;
    try{ if(rollPlan(panel))return; }catch(e){}
    panel._v41done=true;
    try{
      const card=panel.querySelector('.recommended-v11[onclick*="chooseGamePlanV11"]')||panel.querySelector('[onclick*="chooseGamePlanV11"]');
      const mm=card&&(card.getAttribute('onclick')||'').match(/chooseGamePlanV11\('([^']+)'\s*,\s*(true|false)/);
      if(!mm){panel._v41done=false;return}
      panel.remove();
      const pl=getPl();
      if(pl){
        pl._nextGameBoost=0;
        pl._tempStatBuffsV25=(window.__GROWTH_V42&&window.__GROWTH_V42.compose(pl))||null;
      }
      window.chooseGamePlanV11&&window.chooseGamePlanV11(mm[1],mm[2]==="true");
    }catch(err){}
  }
  const sweep=()=>{try{document.querySelectorAll('.gameplan-overlay').forEach(autoPlan)}catch(e){}};
  try{new MutationObserver(sweep).observe(document.body,{childList:true,subtree:true})}catch(e){}
  setInterval(sweep,400);
  window.__PREGAME_V51={readPlans,boldOf,appetite,rollPlan,decidePlan,silentPlan,hold:()=>heldV135,cfg:()=>heldV135?wheelCfgV135(heldV135.pl,heldV135.d):null,apply:applyHeldV135,commit:commitHeldV135,wizardUp:wizardUpV135,
    choice:choiceV146,pick:pickPlanV146,band:bandForV146,defaultPick:defaultPickV146};
})();
