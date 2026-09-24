
/* ===== v16.6 STORY-ARC WHEEL — decisions are rolled, not chosen =====
 * When a story-arc / pre-game decision popup appears, the player no longer picks.
 * Each option gets a personality-weighted % and a "wheel of fortune" arrow sweeps
 * the options and lands on one (weighted random). Aggressive/brash builds rarely
 * land on the safe option — but it stays possible (every option keeps a floor).
 * Works by intercepting the existing decision UI and firing its own handlers.
 */
(function(){
  "use strict";
  const st = ()=>{ try{ return window.__getGridironState && window.__getGridironState(); }catch(e){ return null; } };
  const persona = ()=>{ const s=st(); return (s&&s.player&&s.player.personaV13) || null; };
  const BOLD=/\b(own|confront|call\s?out|go\s?all|all-?out|aggress|risk|gamble|demand|challenge|attack|fight|bold|swing|dominat|force|push|expose|blast|fire\s?back|double\s?down|prove|refuse|clap\s?back|stand\s?up|take\s?over|silence)\b/i;
  const SAFE=/\b(apolog|defer|humble|keep\s?quiet|play\s?it\s?safe|safe|patient|trust\s?the\s?process|listen|accept|team-?first|support|quiet|calm|steady|conservat|protect|back\s?down|comply|follow|lay\s?low|stay\s?the\s?course|buy\s?in|do\s?the\s?work|earn)\b/i;

  function boldness(txt, risk){
    let b=0.5; const T=(txt||'')+' '+(risk||'');
    (T.match(BOLD)&&(b+=0.28)); (T.match(SAFE)&&(b-=0.28));
    if(/high|reckless|bold|aggress/i.test(risk||'')) b+=0.18;
    if(/low|safe|steady|moderate-?low|conservat/i.test(risk||'')) b-=0.14;
    return Math.max(0,Math.min(1,b));
  }
  // -1 = wants safe, +1 = wants bold
  function pref(){
    const p=persona(); if(!p) return 0;
    const g=k=>((p[k]??5)-5)/5;
    let v = g('aggression')*1.0 + g('confidence')*0.8 - g('eq')*0.7 - g('coachability')*0.6 - g('loyalty')*0.35 - g('longterm')*0.25;
    return Math.max(-1,Math.min(1, v/1.6));
  }
  function weights(bolds){
    const pr=pref();
    const w = bolds.map(b=>{
      // alignment in [0,1]: bold option + bold pref -> high; floor keeps it possible
      const align = (1 + pr*(2*b-1))/2;      // 0..1
      return 0.12 + 0.88*Math.pow(align, 1.6);
    });
    const s=w.reduce((a,c)=>a+c,0)||1; return w.map(x=>x/s);
  }
  function pick(probs){ let r=Math.random(), a=0; for(let i=0;i<probs.length;i++){ a+=probs[i]; if(r<=a) return i; } return probs.length-1; }

  // v20: which slider actually tipped this roll? Mirror pref()'s weights, signed
  // toward the direction the wheel landed, and name the strongest contributor.
  const PREF_W={aggression:[1.0,'Aggression'],confidence:[0.8,'Confidence'],eq:[-0.7,'Composure'],coachability:[-0.6,'Coachability'],loyalty:[-0.35,'Loyalty'],longterm:[-0.25,'Long-Term Focus']};
  function drivingTrait(bold){
    const p=persona(); if(!p) return null;
    const dir=bold>=0.5?1:-1; let best=null,bv=0;
    for(const k in PREF_W){ const c=((p[k]??5)-5)*PREF_W[k][0]*dir;
      if(c>bv){bv=c;best={name:PREF_W[k][1],val:p[k]??5};} }
    return bv>=0.5?best:null;
  }
  // v23: the roll now resolves to a SINGLE-GAME outcome driven by the kid's
  // character (coach trust). Good kids stack reliable small edges; problem
  // children risk a real off-field incident that costs stats AND trust.
  function showRollPopup(panel, optName, bold, next, chosen, incident, negTrust, buffs){
    try{
      document.getElementById('rollPopV20')?.remove();
      const tr=drivingTrait(bold);
      const isPlan=!!panel.querySelector('[onclick*="chooseGamePlanV11"]');
      const kicker=isPlan?'PREGAME ROLL':'STORY ROLL';
      const fx=[];
      const _bt=(buffs||[]).map(b=>{const a=b.max?10:b.amt;return(a>0?'+':'')+a+' '+(window.__statLabelV25?window.__statLabelV25(b.stat):b.stat)}).join(', ');
      if(incident){
        const why=`His <b>character</b> got the better of him — a disciplined kid never lets this happen.`;
        fx.push(`<span class="rollfx dn">▼ ${incident.e} — ${_bt||(next+"% stats")} this game</span>`);
        if(negTrust) fx.push(`<span class="rollfx dn">▼ ${negTrust} coach trust</span>`);
        document.body.insertAdjacentHTML('beforeend',
          `<div class="roll-pop-v20" id="rollPopV20" onclick="this.remove()">
            <div class="roll-pop-card" style="border-color:rgba(255,120,120,.6)">
              <div class="roll-pop-kick" style="color:#ff9a9a">⚠️ OFF-FIELD · ${incident.t.toUpperCase()}</div>
              <div class="roll-pop-name">${optName}</div>
              <div class="roll-pop-why">${why}</div>
              <div class="roll-pop-fx">${fx.join('')}</div>
              <div class="roll-pop-hint">tap to dismiss</div>
            </div></div>`);
      } else {
        const why=tr?`Your <b>${tr.name} ${tr.val}</b> tipped the wheel toward this call.`
                    :'A neutral personality — this one was pure dice.';
        if(_bt) fx.push(`<span class="rollfx up">▲ ${_bt} — this game only</span>`);
        else fx.push(`<span class="rollfx">a clean, quiet week — no swing this game</span>`);
        if(bold>=0.66) fx.push('<span class="rollfx dn">▼ bold call — higher bust risk if the game goes sideways</span>');
        document.body.insertAdjacentHTML('beforeend',
          `<div class="roll-pop-v20" id="rollPopV20" onclick="this.remove()">
            <div class="roll-pop-card">
              <div class="roll-pop-kick">🎲 ${kicker} · LANDED</div>
              <div class="roll-pop-name">${optName}</div>
              <div class="roll-pop-why">${why}</div>
              <div class="roll-pop-fx">${fx.join('')}</div>
              <div class="roll-pop-hint">tap to dismiss</div>
            </div></div>`);
      }
      const _ds=window.__DECIDE_SPEED_V50; const _w=(ms,fn)=>_ds?_ds.wait(ms,fn):setTimeout(fn,ms);
      _w(4200,()=>{const el=document.getElementById('rollPopV20'); if(el){el.classList.add('bye'); setTimeout(()=>el.remove(),450);} });
    }catch(e){}
  }

  const seen = new WeakSet();
  function processPanel(panel){
    if(!panel || seen.has(panel)) return;
    const btns = [...panel.querySelectorAll('.decision-choice, .pos-card[onclick*="chooseEvent"], button[onclick*="resolveStoryChoice"], button[onclick*="chooseEvent"], [onclick*="chooseGamePlanV11"]')];
    if(btns.length<2) return;
    if(btns.some(b=>b.classList.contains('wheel-opt-v13'))) { seen.add(panel); return; }   // already handled via another container
    seen.add(panel);
    // gather boldness + weights
    const bolds = btns.map(b=>{ const risk=b.querySelector('.decision-risk')?.textContent||''; return boldness(b.textContent||'', risk); });
    const probs = weights(bolds);
    const chosen = pick(probs);
    // badge each option with its % and block manual clicks during the spin
    btns.forEach((b,i)=>{
      b.classList.add('wheel-opt-v13');
      b.style.pointerEvents='none';
      const pctEl=document.createElement('span'); pctEl.className='wheel-pct-v13';
      pctEl.textContent=Math.round(probs[i]*100)+'%';
      b.appendChild(pctEl);
    });
    // header note
    const head=panel.querySelector('.decision-kicker')||panel.firstElementChild;
    if(head){ const tag=document.createElement('div'); tag.className='wheel-note-v13'; tag.textContent='🎡 Rolling on your personality…'; head.parentNode.insertBefore(tag, head.nextSibling); }
    // spin: sweep the highlight, decelerating, land on `chosen` — snappy & quick
    let idx=0, ticks=0;
    const total = btns.length*2 + chosen + 4; // fewer sweeps → faster resolve
    const stepTo = k => { btns.forEach(b=>b.classList.remove('wheel-live-v13')); btns[k%btns.length].classList.add('wheel-live-v13'); };
    const DS = window.__DECIDE_SPEED_V50 || { wait:(ms,fn)=>setTimeout(fn,ms), arm(){return this}, disarm(){return this} };
    function tick(){
      stepTo(idx); idx++; ticks++;
      if(ticks>=total){ land(); return; }
      const remain=total-ticks;
      const delay = 34 + Math.max(0, (7-remain))*24; // fast sweep, brief decelerate at the end
      DS.wait(delay, tick);                          // v50: a tap shortens what has not fired yet
    }
    function land(){
      btns.forEach(b=>b.classList.remove('wheel-live-v13'));
      const win=btns[chosen]; win.classList.add('wheel-win-v13');
      // v23: the auto-picked choice resolves into a SINGLE-GAME outcome that
      // depends on the kid's CHARACTER (coach trust), not a flat generic buff.
      // Good kids stack reliable, modest, VARIED positives. Problem children (low
      // trust / high clash) risk a real off-field INCIDENT — out late, late to
      // practice, told off a coach, blew off film — that costs stats AND coach
      // trust. Bolder picks widen both tails. The rest-of-season boost is gone.
      try{
        const s=st(), pl=s&&s.player;
        if(pl){
          const bold=bolds[chosen];                              // 0..1
          const optName=(win.querySelector('b')?.textContent||'Your call').replace(/\s+/g,' ').trim();
          const trust=pl.coachTrust!=null?pl.coachTrust:50;      // 5..100, higher = better kid
          const good=Math.max(0,Math.min(1,(trust-20)/70));      // 0 at trust≤20, 1 at trust≥90
          // chance a low-character kid does something dumb this week — rises as
          // trust falls and the pick gets bolder; a disciplined kid ~never does.
          const incidentChance=Math.max(0,Math.min(.72,(1-good)*.6+bold*.16-0.04));
          let next=0, incident=null, negTrust=0;
          if(Math.random()<incidentChance){
            const INC=[
              {t:"Out too late",e:"showed up heavy-legged"},
              {t:"Late to practice",e:"benched a series, coaches fuming"},
              {t:"Told off a coach",e:"in the doghouse this week"},
              {t:"Blew off film",e:"a step slow reading it"},
              {t:"Ran his mouth",e:"the locker room tightened up"}];
            incident=INC[Math.floor(Math.random()*INC.length)];
            next=-(Math.round(4+(1-good)*7+bold*3));             // −4..−14% ALL stats this game
            negTrust=-(2+Math.round((1-good)*4+bold*2));         // −2..−8 coach trust
            pl.coachTrust=Math.max(5,Math.min(100,trust+negTrust));
          } else {
            // clean week — a MODEST, VARIED single-game edge (prepared/good kids a
            // touch more), small enough that it isn't the same number every time.
            next=Math.round(1+bold*4+good*3+(optName.length%3));  // ~1..10, varies by pick
          }
          // v25: retire the "+X% ALL stats" edge — grant 1-2 VARIED named-stat buffs
          // for a SINGLE game. Incidents dock one stat; positive edges stay modest.
          pl._nextGameBoost=0;
          pl._tempStatBuffsV25 = (window.__mkTempBuffsV25 ? window.__mkTempBuffsV25(pl, incident?-1:1, bold, good) : []);
          const _buffTxt = pl._tempStatBuffsV25.map(b=>{const a=b.max?10:b.amt;return(a>0?'+':'')+a+' '+window.__statLabelV25(b.stat)}).join(' · ') || (next+'%');
          try{ window.I && window.I(); }catch(e){}
          const tg=panel.querySelector('.wheel-note-v13');
          if(tg) tg.textContent = incident ? ('⚠️ '+incident.t+' — '+_buffTxt) : ('🎡 '+optName+' · '+_buffTxt);
          showRollPopup(panel, optName, bold, next, chosen, incident, negTrust, pl._tempStatBuffsV25);
        }
      }catch(e){}
      const tag=panel.querySelector('.wheel-note-v13'); if(tag&&!/next game/.test(tag.textContent)) tag.textContent='🎡 Landed: '+(win.querySelector('b')?.textContent||'your call');
      DS.wait(360, ()=>{
        // fire the option's real handler
        const oc = win.getAttribute('onclick');
        win.style.pointerEvents='';
        DS.disarm();
        try{ if(oc){ (new Function(oc)).call(win); } else { win.click(); } }
        catch(e){ try{ win.click(); }catch(_){} }
      });
    }
    // v50: the whole panel is a speed-up target while the sweep runs
    try{ DS.arm(panel, panel.querySelector('.wheel-note-v13')); }catch(e){}
    DS.wait(180, tick);
  }

  function scan(){
    document.querySelectorAll('.decision-panel, .story-overlay-v11, .decision-overlay, .gameplan-overlay').forEach(p=>{
      if(p.id==='pgOverlayV13') return;                 // that's the post-game grade card, not a decision
      if(p.querySelector('.decision-choice, [onclick*="resolveStoryChoice"], [onclick*="chooseEvent"]')) processPanel(p);
    });
    // old single-shot event screen renders choices as .pos-card into #screen
    const scr=document.getElementById('screen');
    if(scr && scr.querySelector('.pos-card[onclick*="chooseEvent"]') && !seen.has(scr)) processPanel(scr);
    // v17: pregame GAME PLANS are intra-game options too — auto-roll them on personality
  }
  const mo=new MutationObserver(()=>{ try{ scan(); }catch(e){} });
  try{ mo.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  setInterval(()=>{ try{ scan(); }catch(e){} }, 500);
})();
