
/* v15.13: consecutive-play football recovery + pregame top-five screen */
(function(){
'use strict';
const finite=n=>Number.isFinite(Number(n));
const getState=()=>{try{return window.__GRIDIRON_AUDIT__?.getState?.()||window.S||null}catch(e){return null}};
function safeDestroy(obj){try{if(obj&&obj.active!==false&&!obj.destroyed)obj.destroy()}catch(e){}}
function objectValid(obj){return !!(obj&&obj.scene&&obj.active!==false&&!obj.destroyed&&finite(obj.x)&&finite(obj.y));}
function playBallFrame(scene){
  const play=scene?.play, script=play?.script;
  if(!play||!script||!Array.isArray(script.ball)||script.ball.length===0)return null;
  const elapsed=Math.max(0,(Number(play.t)||0)-(Number(play.delay)||0));
  const duration=Math.max(0,Number(script.duration)||0);
  const t=Math.min(duration,elapsed), frame=t/33;
  const i=Math.min(Math.floor(frame),script.ball.length-1),j=Math.min(i+1,script.ball.length-1),mix=frame-Math.floor(frame);
  const a=script.ball[i],b=script.ball[j];
  if(!a||!b||![a.x,a.y,a.h,b.x,b.y,b.h].every(finite))return null;
  return{x:Number(a.x)+(Number(b.x)-Number(a.x))*mix,y:Number(a.y)+(Number(b.y)-Number(a.y))*mix,h:Number(a.h)+(Number(b.h)-Number(a.h))*mix};
}
function recreateBall(scene,force){
  if(!scene?.sys?.isActive?.())return false;
  const frame=playBallFrame(scene); if(!frame)return false;
  let projected;
  try{projected=typeof PJ==='function'?PJ(frame.x,frame.y):{x:frame.x,y:frame.y,s:1}}catch(e){projected={x:frame.x,y:frame.y,s:1}}
  if(!projected||![projected.x,projected.y,projected.s].every(finite))return false;
  if(force||!objectValid(scene.ballSpr)){
    safeDestroy(scene.ballSpr); scene.ballSpr=null;
    try{scene.ballSpr=window.__RIB20_createFootball?window.__RIB20_createFootball(scene,projected.x,projected.y):scene.add.image(projected.x,projected.y,'spr_ball').setScale(.43*Math.max(.45,projected.s||1),.25*Math.max(.45,projected.s||1)).setDepth(9)}catch(e){console.warn('[v15.13 ball recreate]',e);return false}
  }
  if(force||!objectValid(scene.ballShad)){
    safeDestroy(scene.ballShad);scene.ballShad=null;
    try{scene.ballShad=scene.add.ellipse(projected.x,projected.y+4,16,6,0x000000,.35).setDepth(3.5)}catch(e){}
  }
  if(scene.play){scene.play._pbx=null;scene.play._pby=null;scene.play.lastBallDot=0;scene.play.__ballRecoveriesV1513=(scene.play.__ballRecoveriesV1513||0)+1}
  scene.ballSpr.setVisible(true).setAlpha(1).setRotation(0);
  return true;
}
function installBallGuard(){
  if(typeof Ot!=='function'||!Ot.prototype||Ot.prototype.__ballGuardV1513)return false;
  const p=Ot.prototype, oldAnimate=p.animatePlay, oldUpdate=p.update, oldStop=p.softStop, oldComplete=p.complete;
  if(typeof oldAnimate!=='function'||typeof oldUpdate!=='function')return false;
  if(typeof oldStop==='function')p.softStop=function(){const stale=[this.ballSpr,this.ballShad];this.ballSpr=null;this.ballShad=null;try{return oldStop.apply(this,arguments)}finally{stale.forEach(safeDestroy);if(this.play){this.play._pbx=null;this.play._pby=null;this.play.lastBallDot=0}}};
  p.animatePlay=function(){safeDestroy(this.ballSpr);safeDestroy(this.ballShad);this.ballSpr=null;this.ballShad=null;const out=oldAnimate.apply(this,arguments);if(this.play){this.play._pbx=null;this.play._pby=null;this.play.lastBallDot=0;this.play.__tokenV1513=(Date.now()+Math.random()).toString(36)}recreateBall(this,false);return out};
  p.update=function(){
    if(this.play&&!this.play.done&&!objectValid(this.ballSpr))recreateBall(this,true);
    let out;try{out=oldUpdate.apply(this,arguments)}catch(err){if(this.play&&!this.play.done&&recreateBall(this,true)){try{return oldUpdate.apply(this,arguments)}catch(e){}}throw err}
    if(this.play&&!this.play.done){
      const bad=!objectValid(this.ballSpr)||!finite(this.ballSpr?.rotation)||Math.abs(Number(this.ballSpr?.x)||0)>5000||Math.abs(Number(this.ballSpr?.y)||0)>5000;
      if(bad)recreateBall(this,true);
      if(objectValid(this.ballSpr)){if(!finite(this.ballSpr.rotation))this.ballSpr.setRotation(0);this.ballSpr.setVisible(true).setAlpha(1)}
    }
    return out;
  };
  if(typeof oldComplete==='function')p.complete=function(){if(this.play){this.play._pbx=null;this.play._pby=null;this.play.lastBallDot=0}return oldComplete.apply(this,arguments)};
  p.__ballGuardV1513=true;return true;
}
installBallGuard();[0,250,1000,2500].forEach(ms=>setTimeout(installBallGuard,ms));

function currentWeek(){const p=getState()?.player;return p?.weekResults?.find?.(w=>!w.played)||null}
function userRoster(){const p=getState()?.player;if(!p)return[];
  // generate + persist the team roster here if it isn't set yet, using the same
  // state the pregame reads (an earlier ensureUserRoster used a different state
  // accessor and never populated it, so the pregame fell back to placeholders).
  if((!p.teamRosterV158||!p.teamRosterV158.length)&&window.__GRIDIRON_GENERATE_ROSTER_V157){
    try{const target=Math.round(Number(p.teamOvr||p.teamRating||p.schoolRating)||([18,30,42,54,66,78,86,90][p.level||0]||55));
      const pack=window.__GRIDIRON_GENERATE_ROSTER_V157(target,(p.seasonSeed||1)+(p.level||0)*1009);
      if(pack&&pack.players&&pack.players.length){try{if(typeof ensureMeta==='function')ensureMeta(pack.players,(p.seasonSeed||1));}catch(e){}p.teamRosterV158=pack.players;}
    }catch(e){}
  }
  return p.teamRosterV158||p.rosterV157||p.roster||[]}
function opponentRoster(w){const p=getState()?.player;if(!w||!p)return[];try{if(!w.opponentV11&&typeof rt==='function')w.opponentV11=rt(w.opp,p.level,w.week||1,p.seasonSeed,w.playoff?w.roundIdx:void 0)}catch(e){}const t=w.opponentV11||{};let r=t.rosterV157||t.roster;
  // v17: the pregame team must MATCH the actual opponent you play next — generate the
  // opponent's roster at its real rating and persist it on the week's opponent object,
  // so the players shown are the same strength you face in the sim (not a random overall).
  // v20: the opponent's displayed roster is generated on the sim's own per-level
  // scale, offset by how far above/below level-average their scouted rating sits
  // (the exact term the engine uses as oppBoost) — no more random-looking OVRs.
  const _anchor=[18,30,42,54,66,78,86,90][p.level||0]||55;
  const _rel=Math.max(-15,Math.min(15,Math.round((Number(t.rating||w.oppRating)||45+(p.level||0)*5.5)-(45+(p.level||0)*5.5))));
  const _oppTarget=Math.max(2,Math.round(_anchor+_rel));
  if((!r||!r.length||w._oppRosterScaleV20!==_oppTarget)&&window.__GRIDIRON_GENERATE_ROSTER_V157){try{const pack=window.__GRIDIRON_GENERATE_ROSTER_V157(_oppTarget,(p.seasonSeed||1)+(w.week||1)*733+(p.level||0)*17+(w.playoff?5000:0));if(pack&&pack.players&&pack.players.length){try{if(typeof ensureMeta==='function')ensureMeta(pack.players,(p.seasonSeed||1));}catch(e){}t.rosterV157=pack.players;r=pack.players;w._oppRosterScaleV20=_oppTarget;}}catch(e){}}
  return r||[]}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalize(p,i){return{name:p?.name||`Player ${i+1}`,pos:p?.pos||p?.position||'ATH',ovr:Math.round(Number(p?.ovr??p?.overall??p?.rating??0)||0)}}
function topFive(roster){return (Array.isArray(roster)?roster:[]).map(normalize).sort((a,b)=>b.ovr-a.ovr||a.pos.localeCompare(b.pos)).slice(0,5)}
function fallbackFive(ovr,seed){
  // generate a real roster at the given team OVR and take its top 5 (real names +
  // realistic ratings) rather than generic "Team Captain" placeholders.
  try{if(window.__GRIDIRON_GENERATE_ROSTER_V157){
    const pack=window.__GRIDIRON_GENERATE_ROSTER_V157(Math.round(Number(ovr||17)),Number(seed||1));
    if(pack&&pack.players&&pack.players.length){try{if(typeof ensureMeta==='function')ensureMeta(pack.players,Number(seed||1));}catch(e){}return topFive(pack.players);}
  }}catch(e){}
  const positions=['QB','EDGE','CB','WR','LT'],names=['Team Captain','Impact Defender','Shutdown Corner','Primary Target','Blindside Anchor'];return positions.map((pos,i)=>({name:names[i],pos,ovr:Math.max(1,Math.round(Number(ovr||17)+(4-i)*.8+(((seed||1)+i*7)%3-1)))}))}
function rows(players){return players.map((p,i)=>`<div class="pregame-player-v1513"><span class="pregame-rank-v1513">${i+1}</span><span><b>${esc(p.name)}</b><small>${esc(p.pos)}</small></span><span class="pregame-ovr-v1513">${p.ovr}<small> OVR</small></span></div>`).join('')}
let pending=null,originalChoose=null;
function closePregame(){document.getElementById('pregameV1513')?.remove();pending=null;try{window.__V146&&window.__V146.stop()}catch(e){}}
function continuePregame(){const q=pending;document.getElementById('pregameV1513')?.remove();pending=null;try{window.__V146&&window.__V146.stop()}catch(e){}try{const V=window.__PREGAME_V51;V&&V.commit&&V.commit()}catch(e){}/* v135: the held plan roll lands here, seen or skipped */if(q&&typeof originalChoose==='function')return originalChoose.apply(q.ctx,q.args)}
// v17: gather the player's active / temporary modifiers to surface pregame, so you
// know exactly what buffs (and debuffs) you carry into the upcoming matchup.

function pregameTempStats(pl,wk){
  const out=[]; if(!pl) return out;
  (pl._tempStatBuffsV25||[]).forEach(b=>{const a=b.max?10:b.amt;out.push({l:(a<0?'Setback':'Boost')+' (this game)',v:(a>0?'+'+a+' ':a+' ')+((window.__statLabelV25&&window.__statLabelV25(b.stat))||b.stat),good:a>=0});});
  if(pl.momentum103!=null&&Math.abs(pl.momentum103-50)>=3) out.push({l:'Momentum',v:Math.round(pl.momentum103)+'/100',good:pl.momentum103>=50});
  if(pl.composure103!=null&&Math.abs(pl.composure103-50)>=3) out.push({l:'Composure',v:Math.round(pl.composure103)+'/100',good:pl.composure103>=50});
  if(pl.coachTrust!=null&&Math.abs(pl.coachTrust-50)>=4) out.push({l:'Coach Trust',v:Math.round(pl.coachTrust)+'/100',good:pl.coachTrust>=50});
  if(pl.snapShare!=null) out.push({l:'Snap Share',v:Math.round(pl.snapShare*100)+'%',good:pl.snapShare>=.4});
  if(wk&&wk.injured) out.push({l:'Health',v:'Nagging injury',good:false});
  // v18: fatigue / injury wear — the −10% penalty is shown before you feel it
  const cv=pl.conditionV11;
  if(cv){
    if(cv.injury) out.push({l:'Injury',v:cv.injury.seasonEnding?cv.injury.name+' · OUT (SEASON)':cv.injury.name+(cv.injury.weeksRemaining>0?' · out '+cv.injury.weeksRemaining+' wk':''),good:false});
    if((cv.fatigue||0)>=70) out.push({l:'Fatigue',v:Math.round(cv.fatigue)+'/100 · HIGH',good:false});
    else if((cv.fatigue||0)>=45) out.push({l:'Fatigue',v:Math.round(cv.fatigue)+'/100',good:false});
    if(window.__isWornV18&&window.__isWornV18(pl)) out.push({l:'Worn Down',v:'−10% ALL stats',good:false});
  }
  const sc=pl.statCeilV17; if(sc){ for(const k in sc){ if(sc[k]>1) out.push({l:'Max '+String(k).slice(0,3).toUpperCase(),v:'▲ +'+Math.round((sc[k]-1)*100)+'% cap',good:true}); } }
  return out;
}
window.pregameTempStats=pregameTempStats;

function tempStatsPanel(pl,wk){
  const ts=pregameTempStats(pl,wk); if(!ts.length) return '';
  return `<div style="margin:12px 14px 4px;padding:10px 12px;border:1px solid rgba(240,187,69,.32);border-radius:10px;background:rgba(240,187,69,.06)">
    <div style="font:700 11px Oswald,sans-serif;letter-spacing:1px;color:var(--gold);margin-bottom:7px">⚡ ACTIVE / TEMPORARY STATS</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${ts.map(s=>`<span style="display:inline-flex;gap:5px;align-items:center;font:600 11px Barlow Condensed,sans-serif;padding:3px 8px;border-radius:14px;background:${s.good?'rgba(107,191,89,.14)':'rgba(224,100,90,.14)'};border:1px solid ${s.good?'rgba(107,191,89,.4)':'rgba(224,100,90,.4)'}"><span style="color:var(--chalk-dim)">${esc(s.l)}</span><b style="color:${s.good?'#8fe0a0':'#e8938b'}">${esc(s.v)}</b></span>`).join('')}</div>
  </div>`;
}
/* ===== v23 PREGAME GAME PLAN — you scout the opponent's weak unit and pitch a
 * play-mix to your coordinator. He adopts it in proportion to your standing
 * (coach trust + recent form + the Field General prestige node), and the adopted
 * pass/run lean is fed into the game's per-play passP so your read actually bends
 * the script. The impact bar shows exactly how much of your suggestion took. ===== */
function gsUnitAvg(r,ps){const a=(Array.isArray(r)?r:[]).map(normalize).filter(p=>ps.includes(p.pos));return a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:null}
function gsScenariosV23(oursR,theirsR){
  const theirAvg=rosterAvg(theirsR,50);
  const secD=gsUnitAvg(theirsR,['CB','S']), frontD=gsUnitAvg(theirsR,['DL','LB','EDGE','DT']);
  const ourPass=gsUnitAvg(oursR,['QB','WR','TE']), ourRun=gsUnitAvg(oursR,['RB','OL','LT','LG','C','RG','RT']);
  const secWeak=theirAvg-(secD==null?theirAvg:secD), frontWeak=theirAvg-(frontD==null?theirAvg:frontD);
  const airPass=Math.max(.6,Math.min(.75,.62+Math.max(0,secWeak)*.02+(ourPass&&secD?Math.max(0,ourPass-secD)*.006:0)));
  const groundPass=Math.max(.25,Math.min(.42,.4-Math.max(0,frontWeak)*.02-(ourRun&&frontD?Math.max(0,ourRun-frontD)*.006:0)));
  const air={key:'air',icon:'🎯',name:'Air It Out',pass:airPass,
    why:secD!=null?`Their secondary grades ${Math.round(secD)} — ${secWeak>=3?'a soft spot to attack through the air':'stout, but you can test them deep'}.`:'Spread them out and throw.'};
  const ground={key:'ground',icon:'🐗',name:'Pound the Rock',pass:groundPass,
    why:frontD!=null?`Their front seven grades ${Math.round(frontD)} — ${frontWeak>=3?'you can run right at them':'physical, but you can wear them down'}.`:'Line up and run it.'};
  const balanced={key:'bal',icon:'⚖️',name:'Stay Balanced',pass:.54,why:'Keep them honest — take what the defense gives you.'};
  if(secWeak>=3&&secWeak>=frontWeak) air.edge=true; else if(frontWeak>=3) ground.edge=true;
  return [air,ground,balanced];
}
function gsAdoptV23(pl,wk){
  const trust=pl&&pl.coachTrust!=null?pl.coachTrust:50;
  let form=50; try{const w=(pl&&pl.weekResults||[]).filter(x=>x&&x.played&&x.perf!=null);
    if(w.length) form=w.reduce((s,x)=>s+x.perf,0)/w.length; else if(pl&&pl.perf) form=pl.perf;}catch(e){}
  let fgLvl=0; try{const s=getState(); fgLvl=(s&&s.tree&&s.tree.fieldGeneral)||0;}catch(e){}
  return Math.max(.04,Math.min(1,.12+(trust-50)/120+(form-55)/220+fgLvl*.18));
}
function gsFinalPass(scnPass,adopt){return .5+(scnPass-.5)*(0.35+adopt*0.5);}
function gsImpactHTML(scn,adopt){
  if(!scn) return `<div class="gs-impact-empty">Pick a plan above to pitch it to your coordinator. Your <b>coach trust</b>, recent form and <b>Field General</b> prestige decide how much he runs with it.</div>`;
  const finalPass=gsFinalPass(scn.pass,adopt), took=Math.round(adopt*100);
  return `<div class="gs-impact-row"><span>You called <b>${Math.round(scn.pass*100)}% pass</b></span><span>Coach bought in <b>${took}%</b></span></div>
    <div class="gs-field"><div class="gs-field-fill" style="width:${Math.round(finalPass*100)}%"></div></div>
    <div class="gs-field-lab">GAME SCRIPT · ~${Math.round(finalPass*100)}% PASS · ${Math.round((1-finalPass)*100)}% RUN</div>
    <div class="gs-impact-note">${took>=70?'He’s all-in on your read.':took>=40?'He’ll lean your way when the down lets him.':'He hears you out but keeps mostly his own script.'} <span style="color:var(--chalk-dim)">Raise adoption in Prestige → Field General.</span></div>`;
}
let gsStateV23=null;
/* ===== v111 THE PREGAME DECISION — how much of this game is yours =====
 * This screen used to ask the player which way to throw. He never picked the
 * playbook — the coordinator does, and he always did — so the coordinator now
 * adopts the scouted plan on his own and it reads back as one line (nothing about
 * the play-mix model changes: gsScenariosV23 → gsFinalPass → _gameScriptV23 →
 * __gameScriptBiasV23 is exactly the road it always took, and the impact bar still
 * says how much of it he bought). What the player decides in its place is the one
 * thing that was ever his: HOW MUCH OF THE GAME HE TAKES. Five steps from limited
 * to every snap, each pricing what it buys — his share of the team's snaps, his
 * share of the touches — against what it costs: the wear it adds, the chance he
 * gets hurt in THIS game, and the games that is expected to cost. Every number is
 * read live from window.__V111.forecast(player, week, key), and the multipliers it
 * itemises are shown as chips, so a semifinal against a good team visibly costs
 * more than a week-three game against nobody. Under it, the focus: three
 * position-shaped picks, one stat at ×1.2 for this game only, exactly one live at
 * a time. Neither control blocks anything — no pick at all means "normal" and no
 * focus, which is the game precisely as it was. The model is agent A's; every call
 * into it is guarded and falls back to the neutral stub below. ===== */
const V111_KEYS=["limited","reduced","normal","heavy","everysnap"];
const V111_STEP={
  limited:{s:"LIMITED",n:"Limited",d:"Spot snaps only. You watch most of this one and the body keeps nearly everything."},
  reduced:{s:"REDUCED",n:"Reduced",d:"A lighter rotation — you come off on the long drives and stay fresh for next week."},
  normal:{s:"NORMAL",n:"Normal",d:"The starter's week — every snap your unit takes, your ordinary share of the ball."},
  heavy:{s:"HEAVY",n:"Heavy",d:"The same snaps, more football. The coordinator starts looking for you, and the body notices."},
  everysnap:{s:"EVERY",n:"Every Snap",d:"They ride you until the wheels come off. The biggest numbers on the sheet — and the bill for them."}};
const V111_FOCUS_BOOK={
  QB:[["cannon","🎯","throwing","Let It Rip","Drive the ball — velocity and the shot down the field."],
      ["escape","🌀","agility","Escape Artist","Slide the pocket and make the first man miss."],
      ["general","🧠","awareness","Field General","See it early — the read comes a beat sooner."]],
  RB:[["truck","🐗","strength","Run Angry","Trucking and big hits — punish the first man there."],
      ["shifty","🌀","agility","Make Him Miss","Shiftiness — the cut inside the hole."],
      ["burst","🚀","acceleration","Hit The Gas","Quickness through the crease before it shuts."]],
  WR:[["hands","🧤","catching","Catch Everything","Hands and ball tracking through contact."],
      ["cuts","🌀","agility","Sharp Cuts","Shiftiness at the break — get off the press clean."],
      ["top","💨","speed","Take The Top Off","Pure speed — run past the last man."]],
  TE:[["seal","🧱","blocking","Seal The Edge","Blocking — be the reason the run gets out."],
      ["hands","🧤","catching","Safety Valve","Hands in traffic when the pocket breaks."],
      ["power","💪","strength","Move People","Power at the point of contact."]],
  OL:[["anchor","🧱","blocking","Anchor The Pocket","Blocking — nobody comes through you today."],
      ["drive","💪","strength","Drive Block","Power at the point of contact — move the pile."],
      ["calls","🧠","awareness","Make The Calls","See the stunt before it comes."]],
  DL:[["bull","💪","strength","Bull Rush","Power at the point of contact — walk him backwards."],
      ["jump","⚡","quickness","Jump The Snap","First-step explosion off the ball."],
      ["wrap","🛡️","tackling","Wrap Him Up","Trucking hits and a tackle that sticks."]],
  LB:[["thump","🛡️","tackling","Thump","Big hits — bring him down where he stands."],
      ["read","🧠","awareness","Read And React","Diagnose it before the back gets there."],
      ["run","💨","speed","Run The Alley","Speed sideline to sideline."]],
  CB:[["stick","💨","speed","Stay On His Hip","Speed — run with anybody on the field."],
      ["mirror","🌀","agility","Mirror Him","Shiftiness at the break point."],
      ["ball","🧤","catching","Play The Ball","Hands at the catch point — take it away."]],
  S:[["hammer","🛡️","tackling","The Hammer","Big hits over the middle."],
     ["deep","🧠","awareness","Center Field","See the quarterback's eyes and beat the throw."],
     ["range","💨","speed","Sideline Range","Speed to the far hash."]],
  K:[["ice","🧊","discipline","Ice In The Veins","No mental errors, no wasted swing."],
     ["leg","💪","strength","More Leg","Power through the ball."],
     ["clutch","🔥","grit","Kick It Late","The one that matters comes late."]],
  ATH:[["fast","💨","speed","Pure Speed","Straight-line burst above everything else."],
       ["power","💪","strength","Pure Power","Power at the point of contact."],
       ["shifty","🌀","agility","Pure Shiftiness","Cuts, jukes, change of direction."]]};
function v111PosKeyV111(pos){const p=String(pos||"ATH").toUpperCase();
  if(V111_FOCUS_BOOK[p])return p;
  if(/^(LT|LG|C|RG|RT|OT|OG|OL)$/.test(p))return "OL";
  if(/^(DT|DE|EDGE|NT)$/.test(p))return "DL";
  if(/^(FS|SS|SAF)$/.test(p))return "S";
  if(/^(MLB|OLB|ILB)$/.test(p))return "LB";
  if(/^(P|K|PK)$/.test(p))return "K";
  if(/^(FB|HB)$/.test(p))return "RB";
  return "ATH";}
// The neutral stub. It stands in ONLY while agent A's window.__V111 is absent, and
// it is shaped to the same contract so the screen reads the same either way.
const V111_STUB={
  KEYS:V111_KEYS.slice(),
  usage(pl,wk){const k=v111KeyV111(wk),base=Math.max(.06,Math.min(.98,(pl&&pl.snapShare!=null?pl.snapShare:.6)));
    const m={limited:TU("v111bShareLimited",.45),reduced:TU("v111bShareReduced",.74),normal:1,heavy:TU("v111bShareHeavy",1.24),everysnap:TU("v111bShareEvery",1.6)}[k]||1;
    const t={limited:TU("v111bTouchLimited",.7),reduced:TU("v111bTouchReduced",.87),normal:1,heavy:TU("v111bTouchHeavy",1.18),everysnap:TU("v111bTouchEvery",1.34)}[k]||1;
    return {key:k,share:Math.max(.05,Math.min(1,base*m)),touchMul:t,label:V111_STEP[k].n,desc:V111_STEP[k].d};},
  forecast(pl,wk,key){const k=V111_KEYS.indexOf(key)>=0?key:"normal";
    const lm={limited:TU("v111bLoadLimited",.48),reduced:TU("v111bLoadReduced",.74),normal:1,heavy:TU("v111bLoadHeavy",1.36),everysnap:TU("v111bLoadEvery",1.74)}[k];
    const dur=(pl&&pl.attrs&&pl.attrs.injuryResist)||50,durMul=Math.max(.7,Math.min(1.5,TU("v111bDurAt0",1.35)-dur/TU("v111bDurSpan",140)));
    const lvl=(pl&&pl.level)||0,anchor=45+lvl*5.5,oppR=(wk&&wk.opponentV11&&wk.opponentV11.rating)||anchor;
    const oppMul=Math.max(.8,Math.min(1.45,1+(oppR-anchor)/TU("v111bOppSpan",60)));
    const rnd=String((wk&&wk.round)||"").toLowerCase(),imp=String((wk&&wk.opponentV11&&wk.opponentV11.importance)||"").toLowerCase();
    const stakes=(imp==="championship"||/final(?!$)|championship|title/.test(rnd))?TU("v111bStakesFinal",1.4)
      :(wk&&wk.playoff)?TU("v111bStakesPlayoff",1.22)
      :(wk&&wk.opponentV11&&wk.opponentV11.rivalry)?TU("v111bStakesRival",1.1):1;
    const fat=(pl&&pl.conditionV11&&pl.conditionV11.fatigue)||0,wearMul=1+fat/TU("v111bWearSpan",220);
    const load=TU("v111bLoadBase",11)*lm*durMul*oppMul*stakes;
    const injPct=Math.max(.5,Math.min(72,TU("v111bRiskBase",8)*lm*durMul*oppMul*stakes*wearMul));
    return {load:load,fatigueAfter:Math.max(0,Math.min(100,fat+load)),injPct:injPct,
      gamesMissed:injPct/100*TU("injExpMissed",.92),
      statCut:-(load*TU("v111bCutPerLoad",.11)),
      parts:[{label:"Durability "+Math.round(dur),mul:durMul},{label:"Opponent "+Math.round(oppR),mul:oppMul},
        {label:stakes>1.3?"Title game":stakes>1.15?"Playoff":stakes>1?"Rivalry":"Regular season",mul:stakes},
        {label:"Already worn "+Math.round(fat),mul:wearMul}],
      stakes:stakes,oppMul:oppMul,durMul:durMul};},
  charge(){return {load:0,fatigueAfter:0,lingering:[]}},
  focusFor(pos){return (V111_FOCUS_BOOK[v111PosKeyV111(pos)]||V111_FOCUS_BOOK.ATH)
    .map(r=>({key:r[0],icon:r[1],stat:r[2],name:r[3],desc:r[4],mul:TU("v111FocusMul",1.2)}));},
  buffFor(wk){const f=v111FocusRowV111(null,wk);return f?{stat:f.stat,mul:f.mul}:null;}};
function v111ModelV111(){const M=window.__V111;return (M&&typeof M==="object")?M:null;}
function v111KeyV111(wk){const k=wk&&wk.usageV111;return V111_KEYS.indexOf(k)>=0?k:"normal";}
function v111UsageV111(pl,wk){const M=v111ModelV111();
  if(M&&typeof M.usage==="function"){try{const u=M.usage(pl,wk);if(u&&typeof u==="object")return u}catch(e){}}
  return V111_STUB.usage(pl,wk);}
function v111ForecastV111(pl,wk,key){const M=v111ModelV111();
  if(M&&typeof M.forecast==="function"){try{const f=M.forecast(pl,wk,key);if(f&&typeof f==="object")return f}catch(e){}}
  return V111_STUB.forecast(pl,wk,key);}
function v111FocusListV111(pos){const M=v111ModelV111();
  if(M&&typeof M.focusFor==="function"){try{const l=M.focusFor(pos);if(Array.isArray(l)&&l.length===3)return l}catch(e){}}
  return V111_STUB.focusFor(pos);}
function v111FocusRowV111(pl,wk){const k=wk&&wk.focusV111;if(!k)return null;
  const pos=(pl&&pl.pos)||(gsStateV23&&gsStateV23.pl&&gsStateV23.pl.pos)||"ATH";
  return v111FocusListV111(pos).find(f=>f&&f.key===k)||null;}
const v111Pct=v=>Math.round((Number(v)||0)*100)+"%";
const v111Sig=v=>{const n=Number(v)||0;return (n>0?"+":"")+(Math.abs(n)>=10?Math.round(n):Math.round(n*10)/10)};
function v111LedgerHTML(pl,wk,key){
  const u=v111UsageV111(pl,wk),f=v111ForecastV111(pl,wk,key);
  const cut=Number(f.statCut)||0,miss=Number(f.gamesMissed)||0;
  // The ladder does NOT buy snaps all the way up — at NORMAL he is already on the field for every
  // snap his unit takes, and there is nothing above that to sell him. What the top half buys is
  // the BALL, and it is paid for in body. Say so, so the reading of the two rows is never a guess.
  const share=Number(u.share)||0,tm=Number(u.touchMul)||1;
  const note=share>=.999
    ?(tm>1?`Every snap is already yours — from here it is the ball that moves, not the snap count.`
          :`Every snap your unit takes, and your ordinary share of the ball.`)
    :(window.__V120&&window.__V120.askOver&&window.__V120.askOver(key))?`You asked above your share: the coach gives you ${Math.round(share*100)}% of the unit's snaps for now — from here it is the ball that moves, and the asking costs body.`
    :`You watch ${Math.round((1-share)*100)}% of your unit's snaps from the sideline.`;
  const buy=`<div class="v111-row"><span>Team snaps</span><b style="color:#8fe0a0">${v111Pct(u.share)}</b></div>`
    +`<div class="v111-row"><span>Touch share</span><b style="color:#8fe0a0">×${(Math.round(tm*100)/100).toFixed(2)}</b></div>`
    +`<div class="v111-row"><span>Role</span><b>${esc(u.label||V111_STEP[key].n)}</b></div>`
    +`<div class="v111-note">${note}</div>`;
  // below NORMAL the bill is NEGATIVE — the week pays load back — so the wear row is signed and
  // wears the colour of its sign rather than always reading like damage
  const wear=Number(f.load)||0;
  const cost=`<div class="v111-row"><span>Wear</span><b style="color:${wear>.05?"#e8938b":wear<-.05?"#8fe0a0":"var(--chalk)"}">${v111Sig(wear)}</b></div>`
    +`<div class="v111-row"><span>Injury</span><b style="color:${f.injPct>=24?"#e8938b":f.injPct<=12?"#8fe0a0":"var(--gold)"}">${Math.round(Number(f.injPct)||0)}%</b></div>`
    +`<div class="v111-row"><span>Games out</span><b>${(Math.round(miss*10)/10).toFixed(1)}</b></div>`
    +(Math.abs(cut)>=.05?`<div class="v111-row"><span>Next game</span><b style="color:${cut<0?"#e8938b":"#8fe0a0"}">${v111Sig(cut)}</b></div>`:``)
    +fatigueRowsV120(f);
  return `<div class="v111-col buy"><h4>WHAT IT BUYS</h4>${buy}</div><div class="v111-col cost"><h4>WHAT IT COSTS</h4>${cost}</div>${v171HardHTML(pl,wk)}`;
}
/* v171 D: the rung is also how hard he plays — and an aggressive man gets more out of going hard */
function v171HardHTML(pl,wk){const M=window.__V111;if(!M||typeof M.intensity!=="function")return"";let I=null;try{I=M.intensity(pl,wk)}catch(e){}if(!I)return"";
  const tag=I.pct>0?"RECKLESS":I.pct<0?"PLAYING IT SAFE":"STEADY",col=I.pct>0?"#ff9b5a":I.pct<0?"#8ec3ee":"var(--chalk)",a=Math.abs(I.pct),c=Math.round(a*8)/10;
  const line=I.pct>0?`<b style="color:#8fe0a0">+${a}%</b> strength, speed, burst, tackling, blocking, grit · <b style="color:#e8938b">−${c}%</b> discipline, −${Math.round(a*5)/10}% ball security`
    :I.pct<0?`<b style="color:#e8938b">−${a}%</b> to the hard-play stats · <b style="color:#8fe0a0">+${c}%</b> discipline, +${Math.round(a*5)/10}% ball security`:"Your ordinary game — nothing extra, nothing held back.";
  const ag=I.mult>1.02?`🔥 Your aggression turns going hard into ×${I.mult.toFixed(2)}`:I.mult<0.98?`🧊 Composed: going hard only pays ×${I.mult.toFixed(2)}`:"";
  return`<div class="v171-hard"><h4>HOW HARD YOU PLAY · <b style="color:${col}">${tag}</b></h4><div class="v171-hl">${line}</div>${ag?`<div class="v171-ag">${ag}</div>`:""}</div>`}
/* v120: what the fatigue does to him — before this game and after it, and what that many points of
 * fatigue take off (or add to) every attribute, read off the same slope the sim plays on */
function fatigueRowsV120(f){
  const now=Math.round(Number(f.fatigueNow)||0),after=Math.round(Number(f.fatigueAfter!=null?f.fatigueAfter:now)||0);
  const M=window.__fatigueMulV120;if(typeof M!=="function")return ``;
  const pct=x=>{const p=Math.round((M(x,false)-1)*100);return (p>0?"+":"")+p+"%"};
  const col=(a,b)=>b>a?"#e8938b":b<a?"#8fe0a0":"var(--chalk)";
  return `<div class="v111-row v120-fat"><span>Fatigue</span><b style="color:${col(now,after)}">${now} → ${after}</b></div>`
    +`<div class="v111-row v120-fat"><span>Every stat</span><b style="color:${M(after,false)<.995?"#e8938b":M(after,false)>1.005?"#8fe0a0":"var(--chalk)"}">${pct(now)} → ${pct(after)}</b></div>`;
}
function v111PartsHTML(pl,wk,key){
  const f=v111ForecastV111(pl,wk,key),parts=Array.isArray(f.parts)?f.parts:[];
  if(!parts.length) return '';
  return parts.filter(p=>p&&p.label!=null).map(p=>{const m=Number(p.mul);
    const txt=Number.isFinite(m)?"×"+(Math.round(m*100)/100).toFixed(2):"";
    return `<span class="v111-chip${Number.isFinite(m)&&m<1?' easy':''}">${esc(p.label)}${txt?` <b>${txt}</b>`:''}</span>`}).join('')
    +`<span class="v111-chip easy">fatigue after <b>${Math.round(Number(f.fatigueAfter)||0)}</b></span>`;
}
function v111StepsHTML(key){
  const i=Math.max(0,V111_KEYS.indexOf(key));
  return V111_KEYS.map((k,j)=>`<button class="v111-step${j===i?' on':j<i?' lit':''}" data-key="${k}" id="v111Step_${k}" onclick="__v111PickUsageV111('${k}')" title="${esc(V111_STEP[k].d)}"><i></i><b>${V111_STEP[k].s}</b></button>`).join('');
}
function v111FocusHTML(pl,wk){
  const sel=wk&&wk.focusV111||null;
  return v111FocusListV111(pl&&pl.pos).map(f=>`<button class="gs-card-v23 v111-focus${f.key===sel?' gs-sel':''}" data-key="${esc(f.key)}" id="v111Focus_${esc(f.key)}" onclick="__v111PickFocusV111('${esc(f.key)}')">
    <div class="gs-card-top"><span class="gs-ico">${f.icon||'🎯'}</span><b>${esc(f.name||f.key)}</b><span class="v111-mul${f.tier?' t-'+esc(f.tier.toLowerCase()):''}">×${(Math.round((Number(f.mul)||1.2)*100)/100).toFixed(2)} ${esc(((window.__statLabelV25&&window.__statLabelV25(f.stat))||f.stat||'').toUpperCase())}${f.tier==='HOT'?' 🔥':f.tier==='OFF'?' ⚠️':''}</span></div>
    <div class="gs-why">${esc(f.desc||'')}</div></button>`).join('');
}
function v111PlanHTML(){
  const S=gsStateV23;if(!S||!S.auto)return '';
  return `<b>Coordinator's plan:</b> ${esc(S.auto.name)} · ${Math.round(S.auto.pass*100)}% pass${S.auto.edge?' · scouted edge':''}`;
}
function v111RenderV111(){
  const S=gsStateV23;if(!S)return;
  const key=v111KeyV111(S.wk);
  const st=document.getElementById('v111Steps'); if(st) st.innerHTML=v111StepsHTML(key);
  const de=document.getElementById('v111Desc'); if(de) de.textContent=V111_STEP[key].d;
  const lg=document.getElementById('v111Ledger'); if(lg) lg.innerHTML=v111LedgerHTML(S.pl,S.wk,key);
  const pa=document.getElementById('v111Parts'); if(pa) pa.innerHTML=v111PartsHTML(S.pl,S.wk,key);
  document.querySelectorAll('.v111-focus').forEach(c=>c.classList.toggle('gs-sel',c.getAttribute('data-key')===(S.wk&&S.wk.focusV111)));
}
window.__v111PickUsageV111=function(key){
  const S=gsStateV23;if(!S||V111_KEYS.indexOf(key)<0)return;
  if(S.wk) S.wk.usageV111=key; else S.stray.usageV111=key;
  v111RenderV111();
};
window.__v111PickFocusV111=function(key){
  const S=gsStateV23;if(!S)return;
  const list=v111FocusListV111(S.pl&&S.pl.pos),row=list.find(f=>f&&f.key===key);if(!row)return;
  const w=S.wk||S.stray;
  w.focusV111=(w.focusV111===key)?null:key;   // exactly one, and picking it again clears it
  v111RenderV111();
  try{const el=document.getElementById('preStatsV25');
    if(el&&window.pregamePlayerStatsV25&&S.pl) el.outerHTML=window.pregamePlayerStatsV25(S.pl);}catch(e){}
};
function gsSectionV23(oursR,theirsR,pl,wk){
  if(!document.getElementById('gsStyleV23')) document.head.insertAdjacentHTML('beforeend',`<style id="gsStyleV23">
    .gs-wrap-v23{margin:12px 14px 4px;padding:10px 12px;border:1px solid rgba(120,180,255,.32);border-radius:10px;background:rgba(120,170,255,.06)}
    .gs-head{font:700 11px Oswald,sans-serif;letter-spacing:1px;color:#8fb7ff;margin-bottom:8px}
    .gs-head small{display:block;font:400 10px system-ui;color:var(--chalk-dim);letter-spacing:0;margin-top:2px}
    .gs-cards{display:flex;flex-direction:column;gap:6px}
    .gs-card-v23{text-align:left;width:100%;cursor:pointer;background:rgba(20,30,48,.7);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px 10px;transition:border-color .12s,background .12s}
    .gs-card-v23:hover{border-color:rgba(143,183,255,.55)}
    .gs-card-v23.gs-sel{border-color:#8fb7ff;background:rgba(120,170,255,.16);box-shadow:0 0 0 1px #8fb7ff inset}
    .gs-card-top{display:flex;align-items:center;gap:7px;font:700 13px Oswald,sans-serif;color:#eaf1ff}
    .gs-ico{font-size:15px}
    .gs-edge{margin-left:auto;font:800 9px Oswald;letter-spacing:1px;color:#0b1119;background:var(--gold);border-radius:10px;padding:2px 7px}
    .gs-mix{font:700 11px Barlow Condensed,sans-serif;color:#8fb7ff;margin:3px 0 2px}
    .gs-why{font:400 11px system-ui;color:var(--chalk-dim);line-height:1.3}
    .gs-impact{margin-top:9px}
    .gs-impact-empty{font:400 11px system-ui;color:var(--chalk-dim);line-height:1.35}
    .gs-impact-row{display:flex;justify-content:space-between;font:600 11px Barlow Condensed,sans-serif;color:#cdd8e8;margin-bottom:5px}
    .gs-field{position:relative;height:16px;border-radius:8px;overflow:hidden;background:linear-gradient(90deg,rgba(107,191,89,.25),rgba(107,191,89,.1) 40%,rgba(120,170,255,.1) 60%,rgba(120,170,255,.3));border:1px solid rgba(255,255,255,.12)}
    .gs-field-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#5a8fd6,#8fb7ff);opacity:.55;transition:width .35s cubic-bezier(.2,.9,.3,1)}
    .gs-field-lab{font:700 9px Oswald;letter-spacing:1px;color:#8fb7ff;text-align:center;margin-top:3px}
    .gs-impact-note{font:400 10px system-ui;color:#cdd8e8;margin-top:5px;line-height:1.3}
    /* v111: the involvement ladder and the focus picker */
    .v111-wrap{border-color:rgba(240,187,69,.34);background:rgba(240,187,69,.05)}
    .v111-wrap .gs-head{color:var(--gold)}
    .v111-steps{display:flex;gap:4px;margin-bottom:7px}
    .v111-step{flex:1 1 0;min-width:0;cursor:pointer;background:rgba(20,30,48,.7);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 2px 5px;text-align:center;transition:border-color .12s,background .12s}
    .v111-step:hover{border-color:rgba(240,187,69,.55)}
    .v111-step i{display:block;height:4px;border-radius:3px;background:rgba(255,255,255,.14);margin:0 4px 5px}
    .v111-step b{display:block;font:800 8.5px Oswald,sans-serif;letter-spacing:.5px;color:var(--chalk-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v111-step.lit i{background:rgba(240,187,69,.45)}
    .v111-step.on{border-color:var(--gold);background:rgba(240,187,69,.16);box-shadow:0 0 0 1px var(--gold) inset}
    .v111-step.on i{background:var(--gold)}
    .v111-step.on b{color:var(--gold)}
    .v111-desc{font:400 11px system-ui;color:var(--chalk-dim);line-height:1.3;margin-bottom:8px}
    .v111-ledger{display:flex;gap:7px;flex-wrap:wrap}
    .v171-hard{flex:1 1 100%;border:1px solid rgba(255,155,90,.35);border-radius:8px;padding:6px 9px;background:rgba(255,155,90,.06)}
    .v171-hard h4{margin:0 0 3px;font:700 11px Oswald,sans-serif;letter-spacing:1.2px;color:var(--chalk-dim)}
    .v171-hl{font:600 12.5px Barlow Condensed,sans-serif;color:var(--chalk);line-height:1.35}
    .v171-ag{margin-top:3px;font:600 12px Barlow Condensed,sans-serif;color:#ffd66b}
    .v111-col{flex:1 1 132px;min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 8px;background:rgba(20,30,48,.55)}
    .v111-col h4{margin:0 0 4px;font:800 8.5px Oswald,sans-serif;letter-spacing:1px}
    .v111-col.buy h4{color:#8fe0a0}
    .v111-col.cost h4{color:#e8938b}
    .v111-row{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font:600 11px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.5}
    .v111-row b{font:700 12px Oswald,sans-serif;color:var(--chalk);white-space:nowrap}
    .v111-note{font:400 9.5px system-ui;color:var(--chalk-dim);line-height:1.3;margin-top:4px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px}
    .v111-parts{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
    .v111-chip{font:600 10px Barlow Condensed,sans-serif;color:var(--chalk-dim);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:2px 7px;background:rgba(20,30,48,.6);white-space:nowrap}
    .v111-chip b{color:#e8938b;font:700 10px Oswald,sans-serif}
    .v111-chip.easy b{color:#8fe0a0}
    .v111-plan{margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.09);font:400 11px system-ui;color:var(--chalk-dim);line-height:1.35}
    .v111-plan b{color:#8fb7ff}
    .v111-focus-wrap{border-color:rgba(107,191,89,.3);background:rgba(107,191,89,.05)}
    .v111-focus-wrap .gs-head{color:#8fe0a0}
    .v111-mul{margin-left:auto;font:800 9px Oswald;letter-spacing:.5px;color:#0b1119;background:#8fe0a0;border-radius:10px;padding:2px 6px;white-space:nowrap}
    .v111-mul.t-hot{background:linear-gradient(90deg,#ffd66b,#ff9b5a)}.v111-mul.t-flat{background:#9aa6b2}.v111-mul.t-off{background:#e8938b}
    .gs-card-v23.v111-focus .gs-card-top b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gs-card-v23.v111-focus:hover{border-color:rgba(143,224,160,.55)}
    .gs-card-v23.v111-focus.gs-sel{border-color:#8fe0a0;background:rgba(107,191,89,.16);box-shadow:0 0 0 1px #8fe0a0 inset}
  </style>`);
  const scn=gsScenariosV23(oursR,theirsR), adopt=gsAdoptV23(pl,wk);
  // v111: the coordinator no longer waits to be pitched at — he adopts the plan the
  // scouting report favours (the scouted edge, else balanced) the moment the screen
  // opens, so passP, the impact bar and everything downstream see exactly what they
  // always saw. The player's own decision is the ladder underneath.
  const auto=scn.find(s=>s.edge)||scn.find(s=>s.key==='bal')||scn[0];
  gsStateV23={scn,adopt,pl,wk,auto,stray:{}};
  if(pl) pl._gameScriptV23={gsPass:gsFinalPass(auto.pass,adopt),name:auto.name,adopt:adopt};
  return gsUsageBlockV23()+gsFocusBlockV23()+gsPlanBlockV23();
}
/* v112 D: the same three blocks, each addressable on its own so the wizard can put ONE decision
 * on one page. Every id, class and number inside them is untouched — gsSectionV23 still hands
 * back all three in the old order for any caller that wants the single long column. */
function gsUsageBlockV23(){const S=gsStateV23;if(!S)return'';const pl=S.pl,wk=S.wk,key=v111KeyV111(wk);
  return `<div class="gs-wrap-v23 v111-wrap" id="v111Wrap"><div class="gs-head">🏈 YOUR INVOLVEMENT<small>How much of this game do you carry? NORMAL is the share of snaps the coach trusts you with — it climbs as his trust does. Below it you come off the field and the body keeps what it saves. Above it you ask him for more: he gives what he trusts you with, the ball comes your way, and the asking costs body.</small></div>
    <div class="v111-steps" id="v111Steps">${v111StepsHTML(key)}</div>
    <div class="v111-desc" id="v111Desc">${esc(V111_STEP[key].d)}</div>
    <div class="v111-ledger" id="v111Ledger">${v111LedgerHTML(pl,wk,key)}</div>
    <div class="v111-parts" id="v111Parts">${v111PartsHTML(pl,wk,key)}</div></div>`;
}
function gsFocusBlockV23(){const S=gsStateV23;if(!S)return'';
  return `<div class="gs-wrap-v23 v111-focus-wrap" id="v111FocusWrap"><div class="gs-head">🎯 GAME FOCUS<small>Sharpen one thing for this game only — ×${(Math.round(TU("v111FocusMul",1.2)*100)/100).toFixed(1)} on the stat you pick. One at a time; tap it again to drop it.</small></div>
    <div class="gs-cards" id="v111FocusCards">${v111FocusHTML(S.pl,S.wk)}</div></div>`;
}
function gsPlanBlockV23(){const S=gsStateV23;if(!S)return'';
  return `<div class="gs-wrap-v23 v111-plan-wrap" id="v111PlanWrap"><div class="gs-head">📋 THE COORDINATOR'S PLAN<small>He has already read the scouting report and picked his mix. Nothing here needs you — the bar says how much of the scouted edge he actually runs with.</small></div>
    <div class="v111-plan" id="v111Plan">${v111PlanHTML()}</div>
    <div class="gs-impact" id="gsImpactV23">${gsImpactHTML(S.auto,S.adopt)}</div></div>`;
}
// v111: the cards are the coordinator's business now, but the pitch entry point is
// kept so anything that still calls it behaves exactly as it did.
window.__gsPickV23=function(idx){
  const S=gsStateV23; if(!S) return; const scn=S.scn[idx]; if(!scn) return;
  document.querySelectorAll('.gs-card-v23:not(.v111-focus)').forEach((c,i)=>c.classList.toggle('gs-sel',i===idx));
  const imp=document.getElementById('gsImpactV23'); if(imp) imp.innerHTML=gsImpactHTML(scn,S.adopt);
  if(S.pl) S.pl._gameScriptV23={gsPass:gsFinalPass(scn.pass,S.adopt),name:scn.name,adopt:S.adopt};
};
window.__V111_UI={KEYS:V111_KEYS.slice(),STEP:V111_STEP,
  model:v111ModelV111,stub:V111_STUB,
  week:()=>gsStateV23&&(gsStateV23.wk||gsStateV23.stray)||null,
  key:()=>v111KeyV111(gsStateV23&&gsStateV23.wk),
  focus:()=>{const S=gsStateV23,w=S&&(S.wk||S.stray);return (w&&w.focusV111)||null},
  focusFor:v111FocusListV111,focusRow:v111FocusRowV111,
  usage:(pl,wk)=>v111UsageV111(pl||(gsStateV23&&gsStateV23.pl),wk||(gsStateV23&&gsStateV23.wk)),
  forecast:(k,pl,wk)=>v111ForecastV111(pl||(gsStateV23&&gsStateV23.pl),wk||(gsStateV23&&gsStateV23.wk),k||v111KeyV111(gsStateV23&&gsStateV23.wk)),
  plan:()=>gsStateV23&&gsStateV23.auto||null,
  player:()=>gsStateV23&&gsStateV23.pl||null,
  script:()=>{const S=gsStateV23;return S&&S.pl&&S.pl._gameScriptV23||null},
  pickUsage:k=>window.__v111PickUsageV111(k),pickFocus:k=>window.__v111PickFocusV111(k),
  render:v111RenderV111};
/* ===== v112 THE PREGAME, ONE DECISION AT A TIME =====
 * The pregame screen said everything it had to say at once: the scouting report, the stat
 * sheet, the involvement ladder with its two cost panels and its driver chips, the
 * coordinator's line, the impact bar and three focus cards, stacked into one column three
 * phone-screens long. Every one of those is worth reading and none of them was read, because
 * the thumb was already on its way to the button at the bottom.
 *
 * So the same screen is now a four-page wizard, one decision to a page, and nothing else on
 * that page competing for the answer:
 *   1. YOUR INVOLVEMENT - the five-step ladder, what it buys against what it costs, and the
 *      chips that price this particular week.
 *   2. YOUR FOCUS - the three position cards at x1.2. One tap, or none.
 *   3. THE SCOUT AND THE PLAN - the opponent read and the mix the coordinator has settled on.
 *      Informational: it asks nothing and NEXT is always live.
 *   4. THE IMPACT - the involvement, the focus, the body's swing, the wear this week bills and
 *      any lingering cut, all stated in one panel, and under it the stat sheet showing the
 *      EFFECTIVE numbers he actually carries onto the field. Then the button into the game.
 *
 * Nothing about the model moved. The blocks on pages 1-3 are gsUsageBlockV23 /
 * gsFocusBlockV23 / gsPlanBlockV23 - the very markup the long column used, with every id and
 * handler intact - so week.usageV111, week.focusV111, _gameScriptV23 and __gameScriptBiasV23
 * are written exactly as before, and every number on page 4 is read back through
 * window.__V111.forecast(...) the same guarded way the ladder reads it.
 *
 * The player is never trapped: the defaults (normal, no focus) are the game precisely as it
 * was, BACK walks the pages in reverse and off the screen entirely from page 1, and
 * CONTINUE TO MATCH is on every page - the skip strip on 1-3, the primary button on 4 - so a
 * man on his tenth season is one tap from the field. ===== */
const V112_PAGES_D=[
  {id:"v112Page1",kick:"YOUR INVOLVEMENT",title:"How much of this game is yours?",sub:"Five steps, from spot snaps to every snap. Pick one."},
  {id:"v112Page2",kick:"YOUR FOCUS",title:"Sharpen one thing",sub:"One stat, this game only — how much each card sharpens rolls fresh every week, and sometimes the drill goes sideways. Pick one, or none."},
  {id:"v112Page3",kick:"THE SCOUT & THE PLAN",title:"Who you are playing",sub:"The read on them, and the mix your coordinator has settled on. Nothing here needs an answer."},
  /* v193 B: your team — the two elevens and what the prestige gives each man; only with `v193B` on (`when`) */
  {id:"v112PageTeam",kick:"YOUR TEAM",title:"Who lines up, and what your prestige gives them",sub:"Your eleven on offense and your eleven on defense — every man's rating this game, and what your tree, your Locker Room and your plan put on him. You are in there too.",when:()=>{try{return v193OnD()}catch(e){return!1}}},
  {id:"v112Page4",kick:"THE IMPACT",title:"What you take onto the field",sub:"Your involvement, your focus, the body and the bill — all of it, applied."},
  /* v135: the wheel's own page. See `v135MountD` — the plan was rolled and held the moment the
   * staff's deck appeared; this page only spins it, and then names the final stat. */
  /* v146 D: in choice mode (the default) it is the plan BOARD — the player picks; the wheel copy stays for `planWheelV146` 1 */
  {id:"v112Page5",get kick(){return v146OnD()?"THE GAME PLAN":"THE WHEEL"},title:"How are you playing this one?",
    get sub(){return v146OnD()?"Make the call against this team, then pick how you play it. Every card says what it does, what it risks and what it pays.":"The staff drew up the plans. The wheel picks the one you run — your instincts load it — and the roll says whether it comes off."}},
  /* v136 A: a rivalry game gets one more spin — the approach to the rival, off the wheel, on its own
   * page after the plan (`when` keeps it off every other week) — and the sheet is the LAST page. */
  {id:"v112Page6",kick:"RIVALRY WEEK",title:"How do you play the rival?",sub:"Five approaches. The wheel picks yours — your personality loads it, and a locked one is off the wheel. It counts from this game on.",when:()=>{try{return rivalPageV136()}catch(e){return!1}}},
  {id:"v112Page7",kick:"YOUR SHEET",title:"What you carry onto the field",get sub(){return v146OnD()?"Every number below is the one you play with — the focus, the body and the week, all applied. The plan's roll lands at kickoff.":"Every number below is the one you play with — the focus, the body, the wheel and the week, all applied. Then kickoff."}}];
function v112ActiveD(){return V112_PAGES_D.filter(p=>!p.when||p.when())}
function v112NextLabelD(i){const AP=v112ActiveD(),N=AP[i+1];if(!N)return"CONTINUE TO MATCH";if(N.id==="v112PageTeam")return"YOUR TEAM ›";if(N.id==="v112Page5")return v146OnD()?"THE GAME PLAN ›":"SPIN THE WHEEL ›";if(N.id==="v112Page6")return"RIVALRY WEEK ›";if(N.id==="v112Page7")return"YOUR SHEET ›";return"NEXT ›"}
let v112PageD=0;
function v112DotsD(i){return v112ActiveD().map((p,j)=>`<i class="${j===i?"on":j<i?"lit":""}" data-i="${j}" onclick="__v112GoD(${j})" title="${esc(p.kick)}"></i>`).join("")}
function v112ShowPageD(i){
  const AP=v112ActiveD(),n=AP.length; i=Math.max(0,Math.min(n-1,i|0)); v112PageD=i; const P=AP[i],last=i===n-1;
  V112_PAGES_D.forEach(p=>{const el=document.getElementById(p.id); if(el) el.hidden=(p.id!==P.id)});
  const set=(id,txt)=>{const el=document.getElementById(id); if(el) el.textContent=txt};
  set("v112Kick",`STEP ${i+1} OF ${n} · ${P.kick}`); set("v112Title",P.title); set("v112Sub",P.sub);
  const d=document.getElementById("v112Dots"); if(d) d.innerHTML=v112DotsD(i);
  const nx=document.getElementById("v112Next"); if(nx){nx.disabled=false;nx.innerHTML=v112NextLabelD(i);nx.className=last?"btn v112-go":"btn"}
  const bk=document.getElementById("v112Back"); if(bk) bk.innerHTML=i?"‹ BACK":"‹ LEAVE";
  const sk=document.getElementById("v112Skip"); if(sk) sk.hidden=last;
  if(P.id==="v112Page5") v135MountD(); else v135ParkD();
  if(P.id==="v112Page6") v136MountRivalD(); else v136ParkRivalD();
  if(P.id==="v112PageTeam"){try{v193TeamD()}catch(e){}}   // v193 B
  if(P.id==="v112Page4"||last) v112RenderFinalD();
  else if(P.id!=="v112Page5"&&P.id!=="v112Page6"){try{v111RenderV111()}catch(e){}}
  try{const pj=document.getElementById("v146Proj");if(pj)pj.hidden=(P.id==="v112Page4"||P.id==="v112PageTeam");v146ProjD();v146FullD();v193ScoreRenderD()}catch(e){}   // v146 D: the projection follows every page (v193 B: the score with it; the team page has its own room)
  const sc=document.getElementById("pregameV1513"); if(sc) sc.scrollTop=0;
}
window.__v112GoD=function(i){v112ShowPageD(i)};
window.__v112NextD=function(){if(v112PageD>=v112ActiveD().length-1){window.continuePregameV1513&&window.continuePregameV1513();return}v112ShowPageD(v112PageD+1)};   // v136: the last ACTIVE page is the way in
window.__v112BackD=function(){if(v112PageD<=0){window.closePregameV1513&&window.closePregameV1513();return}v112ShowPageD(v112PageD-1)};
window.__v112SkipD=function(){window.continuePregameV1513&&window.continuePregameV1513()};
/* The final page, stated in one panel: everything the week has done to the man before a snap is
 * played. Read live, through the same guarded accessors the ladder uses, every time the page is
 * entered - so a choice changed on page 1 or 2 is already in these numbers when he gets here. */
function v112ImpactHTMLD(){
  const S=gsStateV23; if(!S) return "";
  const pl=S.pl,wk=S.wk,key=v111KeyV111(wk);
  const u=v111UsageV111(pl,wk),fc=v111ForecastV111(pl,wk,key),foc=v111FocusRowV111(pl,wk);
  const lab=k=>(window.__statLabelV25&&window.__statLabelV25(k))||k;
  const body=(window.__v112BodySwingD&&window.__v112BodySwingD(pl))||null;
  let ling=[]; try{const W=(window.__V111&&window.__V111.wear)?window.__V111.wear(pl):(pl&&pl._wearV111);
    ling=(((W&&W.lingering)||[]).filter(b=>b&&b.stat&&(b.games|0)>0))}catch(e){ling=[]}
  const cut=Number(fc.statCut)||0,wear=Number(fc.load)||0,inj=Math.round(Number(fc.injPct)||0),miss=Number(fc.gamesMissed)||0;
  const row=(k,v,c)=>`<div class="v112-imp-row"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  const swing=body?body.pct:null;
  return `<div class="v112-imp" id="v112ImpD"><h4>📈 THE IMPACT ON NEXT GAME</h4>`
    +row("Involvement",`${esc(u.label||V111_STEP[key].n)} · ${v111Pct(u.share)} snaps · ×${(Math.round((Number(u.touchMul)||1)*100)/100).toFixed(2)} ball`)
    +row("Game focus",foc?`${esc(foc.name||foc.key)} · ×${(Math.round((Number(foc.mul)||1.2)*100)/100).toFixed(2)} ${esc(lab(foc.stat))}`:"None — nothing sharpened",foc?"#8fe0a0":"var(--chalk-dim)")
    +(swing!=null?row("Body",`${swing>0?"+"+swing:swing||0}% to every attribute`,swing>0?"#8fe0a0":swing<0?"#e8938b":"var(--chalk)"):"")
    +(ling.length?row("Lingering",ling.map(b=>`${esc(lab(b.stat))} ${b.mul!=null?"×"+(Math.round(Number(b.mul)*100)/100).toFixed(2):v111Sig(b.amt)} (${b.games|0}g)`).join(", "),"#e8938b"):"")
    +row("Wear this game",v111Sig(wear),wear>.05?"#e8938b":wear<-.05?"#8fe0a0":"var(--chalk)")
    +row("Injury at this load",inj+"%",inj>=24?"#e8938b":inj<=12?"#8fe0a0":"var(--gold)")
    +row("Games it costs",(Math.round(miss*10)/10).toFixed(1))
    +(Math.abs(cut)>=.05?row("Carried into next week",v111Sig(cut),cut<0?"#e8938b":"#8fe0a0"):"")
    +(function(){try{const r=window.__V112_C&&window.__V112_C.ledger&&window.__V112_C.ledger();
      if(!r||!r.active)return"";
      return row("Starting over",`−${r.pct}% to EVERY attribute— until you are promoted`,"#e8938b")}catch(e){return""}})()
    +`<div class="v112-imp-note">The sheet below is what you actually carry onto the field — the focus multiplier, the body's swing and any lingering cut are already in those numbers.</div></div>`;
}
function v112RenderFinalD(){
  const S=gsStateV23; if(!S) return;
  const im=document.getElementById("v112Impact"); if(im) im.innerHTML=v112ImpactHTMLD();
  const su=document.getElementById("v136Summary"); if(su){try{su.innerHTML=v136SummaryHTMLD()}catch(e){su.innerHTML=""}}
  try{const el=document.getElementById("preStatsV25");
    if(el&&window.pregamePlayerStatsV25&&S.pl) el.outerHTML=window.pregamePlayerStatsV25(S.pl)}catch(e){}
}
function v112StyleD(){ if(document.getElementById("v112StyleDEl")) return;
  document.head.insertAdjacentHTML("beforeend",`<style id="v112StyleDEl">
  .v112-page[hidden]{display:none!important}
  .v112-top{text-align:center;padding:6px 2px 4px}
  .v112-kick{font:700 10px Oswald,sans-serif;letter-spacing:2.4px;color:var(--gold)}
  .v112-title{font:700 25px Oswald,sans-serif;line-height:1.08;margin-top:6px}
  .v112-sub{font:400 12.5px system-ui;color:var(--chalk-dim);margin-top:7px;line-height:1.4}
  .v112-fix{font:600 11px Barlow Condensed,sans-serif;letter-spacing:.7px;color:var(--chalk-dim);margin-top:9px}
  .v112-fix b{color:var(--chalk)}
  .v112-dots{display:flex;justify-content:center;gap:7px;margin:12px 0 2px}
  .v112-dots i{width:38px;max-width:20vw;height:6px;border-radius:3px;background:rgba(255,255,255,.14);cursor:pointer;transition:background .15s}
  .v112-dots i.lit{background:rgba(240,187,69,.5)}
  .v112-dots i.on{background:var(--gold)}
  .v112-page>.gs-wrap-v23{margin-left:0;margin-right:0}
  .v112-fold{margin-top:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden}
  .v112-fold>summary{list-style:none;cursor:pointer;padding:13px 12px;font:700 11px Oswald,sans-serif;letter-spacing:1.3px;color:var(--chalk-dim)}
  .v112-fold>summary::-webkit-details-marker{display:none}
  .v112-fold>summary:after{content:"▾";float:right;color:var(--gold)}
  .v112-fold[open]>summary{border-bottom:1px solid var(--line);color:var(--chalk)}
  .v112-fold[open]>summary:after{content:"▴"}
  .v112-fold .pregame-lists-v1513{padding:10px}
  .v112-flush>div{margin-left:0!important;margin-right:0!important}
  .v112-page .v111-steps{gap:5px}
  .v112-page .v111-step{padding:13px 3px 11px;border-radius:10px}
  .v112-page .v111-step i{height:5px;margin:0 5px 7px}
  .v112-page .v111-step b{font-size:9.5px}
  .v112-page .v111-desc{font-size:12.5px;line-height:1.4;margin-bottom:10px}
  .v112-page .v111-row{font-size:12px}
  .v112-page .v111-col{padding:8px 10px}
  /* the upgrade shop's .buy button (border:none, gold shadow, nowrap) leaks onto WHAT IT BUYS,
     which carries the same class name. It is a panel, not a button — say so louder than .buy does. */
  .v112-page .v111-col.buy{white-space:normal;box-shadow:none;cursor:default;font:inherit;letter-spacing:normal;color:inherit}
  .v112-page .gs-cards{gap:10px}
  .v112-page .gs-card-v23.v111-focus{padding:14px 12px;border-radius:12px}
  .v112-page .gs-card-v23.v111-focus .gs-card-top{font-size:14.5px}
  .v112-page .gs-card-v23.v111-focus .gs-why{font-size:12px;margin-top:5px}
  .v112-imp{margin:0 0 12px;padding:11px 12px;border:1px solid rgba(240,187,69,.34);border-radius:10px;background:rgba(240,187,69,.05)}
  .v112-imp h4{margin:0 0 7px;font:700 11px Oswald,sans-serif;letter-spacing:1.4px;color:var(--gold)}
  .v112-imp-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font:600 12px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.6;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  .v112-imp-row:last-of-type{border-bottom:0}
  .v112-imp-row b{font:700 13px Oswald,sans-serif;color:var(--chalk);text-align:right;min-width:0}
  .v112-imp-note{font:400 10.5px system-ui;color:var(--chalk-dim);line-height:1.35;margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:7px}
  .v112-nav{display:flex;gap:9px;margin-top:16px}
  .v112-nav .btn{margin:0;flex:1 1 0;min-width:0;min-height:52px;font-size:15px}
  .v112-nav .btn.secondary{flex:0 0 36%;max-width:none}
  .v112-nav .btn.v112-go{box-shadow:0 0 0 1px rgba(240,187,69,.5) inset}
  .v112-skip{display:block;width:100%;margin-top:9px;min-height:44px;padding:6px 8px;background:transparent;border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:var(--chalk-dim);font:700 11px Oswald,sans-serif;letter-spacing:1.6px;cursor:pointer}
  .v112-skip small{display:block;font:400 10px system-ui;letter-spacing:0;margin-top:3px;opacity:.75}
  .v112-skip:hover{border-color:var(--gold);color:var(--gold)}
  .v112-skip[hidden]{display:none!important}
  /* v135: the wheel on its page — the same card the overlay drew, sat in the flow, with the roll
     pop-up still fixed over the viewport */
  #v135Wheel [data-inline="1"],#v136Rival [data-inline="1"]{margin:0 0 12px}
  #v135Wheel [data-inline="1"]>div,#v136Rival [data-inline="1"]>div{max-width:none;padding:13px}
  .v135-none{padding:14px;border:1px dashed rgba(255,255,255,.2);border-radius:10px;text-align:center;font:600 13px Barlow Condensed,sans-serif;color:var(--chalk-dim);margin-bottom:12px}
  .v112-nav .btn:disabled{opacity:.55;pointer-events:none}
  @media(min-width:560px){.v112-title{font-size:30px}.v112-page .v111-step b{font-size:11px}}
  </style>`);
}
function v112ShellD(a){
  v112StyleD(); v146StyleD(); v193StyleD(); const n=V112_PAGES_D.length;
  return `<div class="pregame-v1513 v112-wiz-d" id="pregameV1513"><div class="pregame-panel-v1513">
    <div class="v112-top"><div class="v112-kick" id="v112Kick">STEP 1 OF ${n}</div>
      <div class="v112-title" id="v112Title">—</div><div class="v112-sub" id="v112Sub">—</div>
      <div class="v112-fix">${esc(a.fix)} · <b>${esc(a.ourName)}</b> vs <b>${esc(a.theirName)}</b></div>
      <div class="v112-dots" id="v112Dots">${v112DotsD(0)}</div></div>
    <div class="v112-page" id="v112Page1">${gsUsageBlockV23()}</div>
    <div class="v112-page" id="v112Page2" hidden>${gsFocusBlockV23()}</div>
    <div class="v112-page" id="v112Page3" hidden>${a.scout}${gsPlanBlockV23()}</div>
    <div class="v112-page" id="v112PageTeam" hidden><div id="v193Team"></div></div>
    <div class="v112-page" id="v112Page4" hidden><div id="v112Impact"></div><div id="v146Full"></div></div>
    <div class="v112-page" id="v112Page5" hidden><div id="v171Calls"></div><div id="v135Wheel"></div><div id="v135Final"></div></div>
    <div class="v112-page" id="v112Page6" hidden><div id="v136Rival"></div><div id="v136RivalOut"></div></div>
    <div class="v112-page" id="v112Page7" hidden><div id="v136Summary"></div><div class="v112-flush">${a.temp?`<details class="v112-fold v146-temp"><summary>⚡ ACTIVE / TEMPORARY STATS</summary>${a.temp}</details>`:""}${a.stats}</div></div>
    <div class="v146-proj" id="v146Proj"></div>
    <div class="v112-nav"><button class="btn secondary" id="v112Back" onclick="__v112BackD()">‹ LEAVE</button><button class="btn" id="v112Next" onclick="__v112NextD()">NEXT ›</button></div>
    <button class="v112-skip" id="v112Skip" onclick="__v112SkipD()">CONTINUE TO MATCH<small>skip the rest — your picks stand</small></button>
  </div></div>`;
}
window.__V112_D={PAGES:V112_PAGES_D,page:()=>v112PageD,go:i=>v112ShowPageD(typeof i==="string"?v112ActiveD().findIndex(x=>x.id===i):i),   /* v193 B: a page id as well as an index — the YOUR TEAM page moved every index after page 3 */
  next:()=>window.__v112NextD(),back:()=>window.__v112BackD(),skip:()=>window.__v112SkipD(),
  impact:v112ImpactHTMLD,render:v112RenderFinalD,
  state:()=>{const S=gsStateV23;if(!S)return null;const pl=S.pl,wk=S.wk,key=v111KeyV111(wk);
    return {page:v112PageD,key,usage:v111UsageV111(pl,wk),forecast:v111ForecastV111(pl,wk,key),
      focus:v111FocusRowV111(pl,wk),body:(window.__v112BodySwingD&&window.__v112BodySwingD(pl))||null,
      weekUsage:(S.wk||S.stray).usageV111,weekFocus:(S.wk||S.stray).focusV111,
      gsPass:pl&&pl._gameScriptV23?pl._gameScriptV23.gsPass:null}}};
/* ===== v135 THE WHEEL SPINS ON THE FIFTH PAGE (the page itself) =====
 * The game-plan wheel used to spin over the season screen the moment PLAY WEEK was tapped, before
 * this wizard opened — the one decision the player meets every week, with no page of its own. The
 * v51 block now rolls and HOLDS the decision (`__PREGAME_V51.hold()`) and opens the wizard; this
 * page spins it: a midseason crossroads first if one is queued on the player (`_crossroadsV135`),
 * then the plan, both mounted INTO the page through `spinWheel`'s host mode. The NEXT button waits
 * while a wheel is in the air, and once the roll is in the page names the final stat — the plan,
 * the band, and every stat it moves as before → after on the effective sheet, with the sheet
 * itself under it. BACK off this page mid-spin parks the wheel (it respins to the same pick — the
 * roll is held, not re-rolled); a skip from an earlier page commits the held roll unseen. */
let v135DoneD=false,v135BeforeD=null;
function v135EffD(pl){try{const E=window.__V85&&window.__V85.effAttrs?window.__V85.effAttrs(pl):null;return E&&E.eff?E.eff:null}catch(e){return null}}
function v135NextD(state){const nx=document.getElementById("v112Next"),sk=document.getElementById("v112Skip"); if(!nx)return;
  const last=v112PageD>=v112ActiveD().length-1;
  if(state==="wait"){nx.disabled=true;nx.innerHTML="THE WHEEL IS SPINNING…";nx.className="btn";if(sk)sk.hidden=true}   // v136: the skip strip goes too — no way to the field while a wheel is in the air
  else{nx.disabled=false;nx.innerHTML=v112NextLabelD(v112PageD);nx.className=last?"btn v112-go":"btn";if(sk)sk.hidden=last}}
function v135ParkD(){   // leaving the wheel page with a wheel still in the air: take it down, it respins on return
  const host=document.getElementById("v135Wheel"); if(!host||v135DoneD)return;
  if(host.querySelector("#growthV42")){host.innerHTML="";const fin=document.getElementById("v135Final");if(fin)fin.innerHTML=""}}
function v135MountD(){
  const host=document.getElementById("v135Wheel"); if(!host)return;
  const V=window.__PREGAME_V51,G=window.__GROWTH_V42,h=V&&V.hold?V.hold():null;
  const S=gsStateV23,pl=(h&&h.pl)||(S&&S.pl)||null;
  try{if(pl&&pl._crossroadsV135&&window.__V147A&&window.__V147A.pro(pl)){window.__V147A.note(pl,"crossroads",pl._crossroadsV135.title||"MIDSEASON CROSSROADS","skipped — no story wheels at this level");delete pl._crossroadsV135}}catch(e){}   // v147 A: no midseason crossroads in the UFF and above
  if(v146OnD()){   // v146 D: the board, not the wheel — only a queued crossroads still spins, first
    const q=pl&&pl._crossroadsV135;
    if(q&&q.ctx&&G&&G.showWheelIn&&!document.getElementById("growthV42")){
      host.innerHTML="";const fin=document.getElementById("v135Final");if(fin)fin.innerHTML="";v135NextD("wait");
      const ok=G.showWheelIn(host,pl,q.ctx,q.title||"MIDSEASON CROSSROADS",()=>{delete pl._crossroadsV135;host.innerHTML="";v146BoardD();v135DoneD=true;v135NextD("go")});
      if(ok){try{window.__V135.crossroads++}catch(e){}return}delete pl._crossroadsV135}
    if(host.querySelector("#growthV42"))return;
    v146BoardD();v135DoneD=true;v135NextD("go");return}
  if(v135DoneD){v135FinalD();v135NextD("go");return}                       // spun on this visit already: still standing
  if(!pl||!G||!G.spinWheel||(!h&&!(pl&&pl._crossroadsV135))){
    host.innerHTML=`<div class="v135-none">No wheel this week — the plan is set.</div>`;
    v135DoneD=true;v135FinalD();v135NextD("go");return}
  if(document.getElementById("growthV42"))return;                          // another wheel is up somewhere
  host.innerHTML="";const fin=document.getElementById("v135Final");if(fin)fin.innerHTML="";
  v135BeforeD=v135EffD(pl); v135NextD("wait");
  const finish=()=>{v135DoneD=true;v135FinalD();v135NextD("go");try{window.__V135.spins++}catch(e){}};
  const plan=()=>{
    if(!h){finish();return}
    const ok=G.spinWheel(Object.assign(V.cfg(),{host,onDone:()=>{V.apply();finish()}}));
    if(!ok){V.apply();finish()}};
  const q=pl._crossroadsV135;
  if(q&&q.ctx&&G.showWheelIn){                                             // the queued crossroads spins first, then the plan
    const ok=G.showWheelIn(host,pl,q.ctx,q.title||"MIDSEASON CROSSROADS",()=>{delete pl._crossroadsV135;host.innerHTML="";setTimeout(plan,60)});
    if(!ok){delete pl._crossroadsV135;plan()}
    else try{window.__V135.crossroads++}catch(e){}
  } else plan();
}
function v135FinalD(){
  const fin=document.getElementById("v135Final"); if(!fin)return;
  if(v146OnD()){v146BoardD();return}   // v146 D: the card for the chosen plan is this page's final word
  const V=window.__PREGAME_V51,h=V&&V.hold?V.hold():null,S=gsStateV23,pl=(h&&h.pl)||(S&&S.pl)||null;
  if(!pl){fin.innerHTML="";return}
  const lab=k=>(window.__statLabelV25&&window.__statLabelV25(k))||k,d=h&&h.d,eff=v135EffD(pl),before=v135BeforeD||{};
  const row=(k,v,c)=>`<div class="v112-imp-row"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  const bandC=b=>b==="green"?"#8fe0a0":b==="red"?"#e8938b":"#cfd6a8";
  let body="";
  if(d){
    body+=row("The plan",`${esc(d.win.name)}${d.win.scout?" · SCOUT PICK":""}`);
    body+=row("The roll",d.band==="green"?"IT CLICKS":d.band==="neutral"?"IT'LL DO":"IT BACKFIRES",bandC(d.band));
    if(d.stats&&d.stats.length&&d.band!=="neutral"){
      d.stats.forEach(k=>{const a=before[k],b=eff&&eff[k];
        body+=row(esc(lab(k)),`${a!=null&&b!=null?`${Math.round(a)} → ${Math.round(b)}`:""} <small style="font-weight:400;color:var(--chalk-dim)">rolled ${d.out.sign>0?"+":"−"}${d.out.amt}</small>`,d.out.sign>0?"#8fe0a0":"#e8938b")})}
    else body+=row("Swing","None — no stat moves this game","var(--chalk-dim)");
  } else body+=row("The plan","The scout's pick stands");
  fin.innerHTML=`<div class="v112-imp v135-imp" id="v135ImpD"><h4>🎡 WHAT THE WHEEL DID</h4>${body}<div class="v112-imp-note">This game only. Your sheet on the last page already carries it.</div></div>`;
}
/* ===== v136 A THE RIVAL IS SPUN ON GAME WEEK (the page) =====
 * On a rivalry game the wizard has one more page after the plan wheel: the five approaches to the
 * rival on the same wheel, locked ones left off, landing on the pick `__V136_A.decide` rolled — and
 * then the approach's own effects, stated the way the event card states them. An approach already
 * decided (the page revisited, or a save from before this) is shown, not respun. The sheet page is
 * always last, and `v136SummaryHTMLD` heads it with the week, settled. */
let v136RivalDoneD=false;
const V136_RIV_COL=["#7d1a20","#10456e","#5e4a0a","#28571a","#3a2668"];
function rivalPageV136(){const S=gsStateV23;return!!(S&&S.wk&&S.wk.rivalV128&&S.pl&&S.pl.eventChoice&&S.pl.eventChoice.rivalV128&&TU("rivalSpinOnWeekV136",1)&&!(window.__V147A&&window.__V147A.pro(S.pl)))}   /* v147 A: in the UFF and above the rival's approach is decided off screen (rivalResolveV136 in ca()), no page */
function v136ParkRivalD(){const host=document.getElementById("v136Rival");if(!host||v136RivalDoneD)return;if(host.querySelector("#growthV42")){host.innerHTML="";const out=document.getElementById("v136RivalOut");if(out)out.innerHTML=""}}
function v136RivalOutD(pick,how){const out=document.getElementById("v136RivalOut");if(!out)return;const A=window.__V136_A,S=gsStateV23,pl=S&&S.pl;const say=(A&&A.say&&pl)?A.say(pick.eff||{},pl):[],vr=A&&A.variance?A.variance(pick.eff||{}):null;
  const row=(k,v,c)=>`<div class="v112-imp-row"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  out.innerHTML=`<div class="v112-imp v136-imp" id="v136RivalImpD"><h4>⚔️ THE APPROACH</h4>${row("Rivalry week",esc(pick.label||"—"))}${row("Decided by",how==="wheel"?"the wheel":how==="auto"?"the wheel, off screen":how==="skip"?"the wheel, skipped past":"you, at the season's start","var(--chalk-dim)")}${say.map(x=>`<div class="v112-imp-row"><span>${x}</span></div>`).join("")}${vr?row("Variance",`<span style="color:${vr.col}">${vr.band}</span>`):""}<div class="v112-imp-note">${vr?vr.line+" ":""}Counts from this game on.</div></div>`}
function v136MountRivalD(){
  const host=document.getElementById("v136Rival"); if(!host)return;
  const A=window.__V136_A,G=window.__GROWTH_V42,S=gsStateV23,pl=S&&S.pl; if(!A||!pl)return;
  const ec=pl.eventChoice||{};
  if(!A.pending(pl)){host.innerHTML=`<div class="v135-none">The approach is set: <b>${esc(ec.chosenV136||"decided at the season's start")}</b></div>`;v136RivalOutD({label:ec.chosenV136||"The approach",eff:ec},ec.howV136||"season");v136RivalDoneD=true;v135NextD("go");return}
  if(v136RivalDoneD||host.querySelector("#growthV42")||document.getElementById("growthV42"))return;
  const d=A.decide(pl);
  const settle=(how)=>{A.apply(pl,d.pick,how);v136RivalDoneD=true;v136RivalOutD(d.pick,how);v135NextD("go");try{window.__V136_A.spins++}catch(e){}};
  if(!d){host.innerHTML=`<div class="v135-none">No approach is open to you this week.</div>`;v136RivalDoneD=true;v135NextD("go");return}
  if(!G||!G.spinWheel||d.deck.open.length<2){host.innerHTML=`<div class="v135-none">Only one approach is open: <b>${esc(d.pick.label)}</b></div>`;settle("auto");return}
  host.innerHTML="";const out=document.getElementById("v136RivalOut");if(out)out.innerHTML="";
  v135NextD("wait");
  const strip=x=>String(x||"").replace(/<[^>]+>/g,"");
  const ok=G.spinWheel({host,title:"RIVALRY WEEK · HOW DO YOU PLAY IT?",
    sub:d.deck.all.length>d.deck.open.length?`${d.deck.all.length-d.deck.open.length} locked — off the wheel. Your personality loads the rest.`:"Your personality loads the wheel.",
    opts:d.deck.open.map((c,k)=>({key:"riv"+c.i,icon:"⚔️",name:c.label,col:V136_RIV_COL[c.i%V136_RIV_COL.length],w:c.w,
      line1:(A.say(c.eff,pl)||[]).slice(0,2).map(strip).join(" · ")||"steady",line2:"VARIANCE "+A.variance(c.eff).band,line2col:A.variance(c.eff).col})),
    pick:d.idx,turns:(pl.weekResults||[]).length,
    result:{band:"neutral",headline:`<span class="gv64-head" style="font-size:15px;margin:0">⚔️ <span>${esc(d.pick.label)}</span></span>`,story:"This is how you play the rival.",lines:(A.say(d.pick.eff,pl)||[]).join(" · ")||"no swing",dur:"FROM THIS GAME ON"},
    onDone:()=>settle("wheel")});
  if(!ok)settle("auto");
}
function v136SummaryHTMLD(){const S=gsStateV23;if(!S)return"";const pl=S.pl,wk=S.wk;const V=window.__PREGAME_V51,h=V&&V.hold?V.hold():null,d=h&&h.d;
  const row=(k,v,c)=>`<div class="v112-imp-row"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  const bandC=b=>b==="green"?"#8fe0a0":b==="red"?"#e8938b":"#cfd6a8";
  let out=`<div class="v112-imp v136-sum" id="v136SumD"><h4>📋 THE WEEK, SETTLED</h4>`;
  if(d&&v146OnD()){const b=window.__PREGAME_V51.band&&window.__PREGAME_V51.band(d.win.id),R=v193RevealedD();   // v146 D · v193 B: a revealed roll is named
    out+=row("Game plan",`${esc(d.win.name)} · <small style="font-weight:400;color:var(--chalk-dim)">you chose it · ${R?`<span style="color:${bandC(R.band)}">rolled: ${R.say}</span> — ${esc(R.lines)}`:`${b?`${Math.round(b.g*100)}% clicks, ${Math.round(b.r*100)}% backfires — `:""}rolls at kickoff`}</small>`)}
  else out+=d?row("Game plan",`${esc(d.win.name)} · <span style="color:${bandC(d.band)}">${d.band==="green"?"IT CLICKS":d.band==="neutral"?"IT'LL DO":"IT BACKFIRES"}</span>${h.applied?"":" · unspun"}`):row("Game plan","the scout's pick","var(--chalk-dim)");
  try{if(wk&&wk.rivalV128&&pl&&pl.eventChoice&&pl.eventChoice.rivalV128){const ec=pl.eventChoice;out+=row("Rivalry week",ec.pendingV136?"spun on the way out":esc(ec.chosenV136||"the approach from the season's start"),ec.pendingV136?"var(--chalk-dim)":"#c9b8ff")}}catch(e){}
  out+=`<div class="v112-imp-note">${v146OnD()?"The sheet below is what you actually carry onto the field — the focus multiplier, the body's swing and any lingering cut are already in those numbers; the plan's roll and swing land at kickoff.":"The sheet below is what you actually carry onto the field — the focus multiplier, the body's swing, the wheel's swing and any lingering cut are already in those numbers."}</div></div>`;return out}
window.__V136_PAGES={active:()=>v112ActiveD().map(p=>p.id),rival:()=>{try{return rivalPageV136()}catch(e){return!1}},rivalDone:()=>v136RivalDoneD,mountRival:v136MountRivalD,summary:v136SummaryHTMLD};
window.__V135={spins:0,crossroads:0,done:()=>v135DoneD,before:()=>v135BeforeD,mount:v135MountD,final:v135FinalD,
  hold:()=>{const V=window.__PREGAME_V51;return V&&V.hold?V.hold():null}};
/* ===== v146 D THE PLAN IS YOURS, AND THE NUMBERS SAY WHAT IT COSTS (the pages) =====
 * Page 5 is the plan BOARD in choice mode (`__PREGAME_V51.choice()`, i.e. `TU("planWheelV146",0)`):
 * every plan the staff offered as a tile carrying its own variance, and under the grid the card for
 * the one that is lit — what it does to the rating, the scouting matchup, the roll's odds and the
 * stats a click or a backfire moves, the fate roll, the form swing, the injury, the fatigue, what it
 * leaves behind — every figure read from the code that applies it (`__V146.facts`, the v51 block's
 * `band`). A tap is the choice (`__PREGAME_V51.pick`), and the pregame's pending plan follows it, so
 * the game that is booked is the plan on the card, once. A queued midseason crossroads still spins
 * first. `v146ProjD` is the projection strip on every page (the box score this game should produce,
 * its 80% band, and VARIANCE), and page 4 carries it in full. It re-draws on every choice and on
 * every headless game the engine finishes (`__V146.onSample`). */
function v146OnD(){const V=window.__PREGAME_V51;return!!(V&&V.choice&&V.choice())}
function v146HeldD(){const V=window.__PREGAME_V51;return V&&V.hold?V.hold():null}
function v146PlanIdD(){const h=v146HeldD();return h&&h.d&&h.d.win?h.d.win.id:null}
function v146NumD(v){if(v==null||!isFinite(v))return"—";return v>=9.95?String(Math.round(v)):(Math.round(v*10)/10).toFixed(1)}
function v146StateD(planId){const S=gsStateV23,w=S&&(S.wk||S.stray)||{},V=window.__PREGAME_V51,id=planId||v146PlanIdD();
  return{usage:w.usageV111||"normal",focus:w.focusV111||null,plan:id,band:(id&&V&&V.band)?V.band(id):null}}
function v146ProjectD(planId){try{return window.__V146?window.__V146.project(v146StateD(planId)):null}catch(e){return null}}
function v146VarColD(p){return p==null?"var(--chalk-dim)":p>=75?"#e8938b":p>=50?"var(--gold)":"#8fe0a0"}
const V146_VAR_LINE="Variance is how far above or below the projection this game can land: the engine's own bounce, thinner the more snaps you take, plus your plan's swing.";
/* the strip: the headline and the rest of the box score, each with its 80% band */
function v146ProjD(){const el=document.getElementById("v146Proj");if(!el)return;const P=v146ProjectD();
  if(!P){el.innerHTML="";return}
  const H=P.head,plan=P.plan,rows=P.rows.filter(r=>r.mean!=null&&(r.head||r.mean>=.05));
  if(!P.ready){el.innerHTML=`<div class="v146-ph"><b>📊 PROJECTING</b><span>playing this week in the engine · ${P.n}/${P.N}</span></div>`;return}
  const R=v193RevealedD(),pre=v193PreProjD(),dl=r=>v193RowDeltaD(pre,r),gd=P.grade&&pre&&pre.grade?v193SigD(P.grade.mean-pre.grade.mean,false):"";   // v193 B: ▲/▼ against the pre-roll projection
  el.innerHTML=`<div class="v146-ph"><b>📊 PROJECTED</b><span>${plan?esc((plan.icon||"")+" "+plan.name):""}</span>${R?`<i class="v193-rolled ${R.band}">🎲 ${R.say}</i>`:""}${H&&H.pct!=null?`<em style="color:${v146VarColD(H.pct)}">VARIANCE ±${H.pct}%</em>`:""}</div>
    <div class="v146-pr">${rows.slice(0,5).map(r=>`<span class="${r.head?"hd":""}"><b>${v146NumD(r.mean)}${dl(r)}</b><small>${esc(r.label)}</small><i>${Math.round(r.lo)}–${Math.round(r.hi)}</i></span>`).join("")||`<span><b>${P.grade?Math.round(P.grade.mean):"—"}${gd}</b><small>Grade</small><i>${P.grade?Math.round(P.grade.lo)+"–"+Math.round(P.grade.hi):""}</i></span>`}</div>`}
/* page 4: the same projection, whole — with the grade and what the variance is made of */
function v146FullD(){const el=document.getElementById("v146Full");if(!el)return;const P=v146ProjectD();if(!P){el.innerHTML="";return}
  const row=(k,v,c)=>`<div class="v112-imp-row"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  if(!P.ready){el.innerHTML=`<div class="v112-imp v146-full"><h4>📊 PROJECTED BOX SCORE</h4><div class="v112-imp-note">Playing this week in the engine — ${P.n} of ${P.N} games in.</div></div>`;return}
  const H=P.head,pre=v193PreProjD(),dl=r=>v193RowDeltaD(pre,r),gd=P.grade&&pre&&pre.grade?v193SigD(P.grade.mean-pre.grade.mean,false):"";   // v193 B
  el.innerHTML=`<div class="v112-imp v146-full" id="v146FullD"><h4>📊 PROJECTED BOX SCORE · 80% RANGE</h4>${P.rows.filter(r=>r.mean!=null&&(r.head||r.mean>=.05)).map(r=>row(esc(r.label),`${v146NumD(r.mean)}${dl(r)} <small class="v146-rg">${Math.round(r.lo)}–${Math.round(r.hi)}</small>`)).join("")}
    ${P.grade?row("Game grade",`${Math.round(P.grade.mean)}${gd} <small class="v146-rg">${Math.round(P.grade.lo)}–${Math.round(P.grade.hi)}</small>`):""}
    ${H&&H.pct!=null?row("Variance",`±${H.pct}% <small class="v146-rg">engine ±${H.sim}% · plan ±${H.plan}%</small>`,v146VarColD(H.pct)):""}
    <div class="v112-imp-note">${V146_VAR_LINE} Projected if he stays on the field — an injury in this game books it as a DNP. (${P.n} games of this week, run in the real engine.)</div></div>`}
/* page 5: the board */
/* v171 A: a tile says what THIS plan does — its game rating and its own swing — not the engine's variance, which is the same number on every tile */
/* v193 B: a tile is shaded by its click odds (`odds-g` / `odds-y` / `odds-r`), prints them, and the best odds on the board get a badge */
function v146TileD(id,on,f,b,x){x=x||{};const rs=f&&f.ratingShift!=null?f.ratingShift:null,sw=f&&f.formPts!=null?f.formPts:null,col=rs==null?"var(--chalk-dim)":rs>0.05?"#8fe0a0":rs<-0.05?"#e8938b":"var(--chalk)";
  const oc=v193OddsClassD(b),pct=v193OnD()?v193OddsPctD(b):null,badge=b&&b.scout&&x.best?"SCOUT · BEST ODDS":x.best?"BEST ODDS":b&&b.scout?"SCOUT":"";
  return`<button class="v146-tile${on?" on":""}${oc}${x.locked?" locked":""}" data-plan="${esc(id)}"${pct!=null?` data-odds="${pct}"`:""} onclick="__v146PickD('${esc(id)}')"><i>${esc(f.icon||"📋")}</i><b>${esc(f.name)}</b><em style="color:${col}">${rs==null?"—":(rs>0?"+":rs<0?"−":"±")+Math.abs(Math.round(rs*10)/10).toFixed(1)}</em><u>${sw!=null?"swing ±"+(Math.round(sw*10)/10).toFixed(1):""}</u>${pct!=null?`<small class="v193-odds">${b.fixed?(b.band==="green"?"🎲 CLICKS":b.band==="red"?"🎲 BACKFIRES":"🎲 IT'LL DO"):pct+"% clicks"}</small>`:""}${badge?`<s${x.best&&!(b&&b.scout)?' class="best"':""}>${badge}</s>`:""}</button>`}
function v146CardD(id){const X=window.__V146,f=X&&X.facts(null,id),V=window.__PREGAME_V51,b=V&&V.band?V.band(id):null;if(!f)return"";
  const P=v146ProjectD(id),H=P&&P.head,lab=k=>(window.__statLabelV25&&window.__statLabelV25(k))||k,sg=(v,d)=>(v>0?"+":v<0?"−":"±")+Math.abs(Math.round(v*(d||1))/(d||1));
  const row=(k,v,c)=>`<div class="v146-r"><span>${k}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  const mt=f.counter?`counters them ${sg(f.match)}`:f.trap?`they punish it ${sg(f.match)}`:f.match?`${sg(f.match)}`:"neutral";
  let h=`<div class="v146-hd"><span>${esc(f.icon||"📋")}</span><div><b>${esc(f.name)}${b&&b.scout?` <s>SCOUT PICK</s>`:""}</b><small>${esc(f.desc)}</small></div></div>${v193WhyD(id)}<div class="v146-g">`;   // v193 B: why the odds lit another plan
  h+=row("Game rating",`${sg(f.ratingShift,10)} <small>plan ${sg(f.perf)}, matchup: ${esc(mt)}${f.rep>=2?` · ${f.rep} wks running`:""}</small>`,f.ratingShift>0?"#8fe0a0":f.ratingShift<0?"#e8938b":"");
  {const tl=v171TeamLiftD(f);if(tl!=null)h+=row("Team",`${tl>0?"+":tl<0?"−":"±"}${Math.abs(tl).toFixed(1)}% <small>to every teammate's ratings in this game</small>`,tl>0?"#8fe0a0":tl<0?"#e8938b":"")}   // v171 A: the rating reaches the team
  if(b){if(b.fixed)h+=row("The roll",`<span style="color:${b.band==="green"?"#8fe0a0":b.band==="red"?"#e8938b":"#cfd6a8"}">🎲 ROLLED — ${b.band==="green"?"IT CLICKS":b.band==="red"?"IT BACKFIRES":"IT'LL DO"}</span> <small>(it was ${Math.round(b.oddsG*100)}% / ${Math.round(b.oddsR*100)}%)</small>`);   // v193 B: revealed on this page
    else h+=row("The roll",`<span style="color:#8fe0a0">${Math.round(b.g*100)}% clicks</span> · <span style="color:#e8938b">${Math.round(b.r*100)}% backfires</span>`);
    h+=row("Clicks / backfires",`+3–5 ${b.statsG.map(k=>esc(lab(k))).join(", ")} · −3–4 ${b.statsR.map(k=>esc(lab(k))).join(", ")}`)}
  /* v192 A: the fate buff is a percent of the attribute (it may pass the cap) — the points it is today in brackets */
  const fPct=f.fate&&f.fate.pct!=null,fP=v=>(Math.abs(v-Math.round(v))<0.05?Math.round(v):(+v).toFixed(1))+"%";
  h+=row("Fate roll",f.fate?(fPct?`${Math.round(f.fate.odds*100)}% for +${fP(f.fate.pct)} ${esc(f.fate.name)} (+${f.fate.amount})${f.fate.hedge?` (miss: +${fP(f.fate.hedgePct||0)}, +${f.fate.hedge})`:""}`:`${Math.round(f.fate.odds*100)}% for +${f.fate.amount} ${esc(f.fate.name)}${f.fate.hedge?` (miss: +${f.fate.hedge})`:""}`):"none on this plan",f.fate?"":"var(--chalk-dim)");
  h+=row("Form swing",`±${(Math.round(f.formPts*10)/10).toFixed(1)} to every attribute · grade ±${Math.round(f.gradeSwing)}`);
  h+=row("Body",`injury ${f.pInj!=null?Math.round(f.pInj*100)+"%":"—"}${f.injBase!=null?` <small>(${Math.round(f.injBase*100)}% × plan ${(Math.round(f.injMul*100)/100).toFixed(2)})</small>`:""} · fatigue +${f.fatigue}`,f.inj>.04?"#e8938b":f.inj<0?"#8fe0a0":"");
  h+=row("After the game",[f.trust&&`trust ${sg(f.trust)}`,f.comp&&`composure ${sg(f.comp)}`,f.mom&&`momentum ${sg(f.mom)}`,f.snap&&`snaps ${sg(f.snap*100)}%`].filter(Boolean).join(" · ")||"nothing carries");
  h+=`</div><div class="v146-var"><b style="color:${v146VarColD(H&&H.pct)}">VARIANCE ${H&&H.pct!=null?"±"+H.pct+"%":"…"}</b><span>${H&&H.pct!=null?`engine ±${H.sim}% · this plan ±${H.plan}%. `:""}How far above or below the projection this game can land.</span></div>`;
  return h}
function v146BoardD(){v171CallsD();const host=document.getElementById("v135Wheel"),fin=document.getElementById("v135Final");if(!host)return;const h=v146HeldD();
  if(!h||!h.plans){host.innerHTML=`<div class="v135-none">The plan is set — the scout's pick.</div>`;if(fin)fin.innerHTML="";return}
  const id=v146PlanIdD(),X=window.__V146,V=window.__PREGAME_V51,best=v193BestD(h.plans),locked=!!v193RevealedD();   // v193 B: the best odds on the board, and a revealed roll locks every tile
  host.innerHTML=`<div class="v146-board" id="v146Plan"><div class="v171-sub">📋 YOUR GAME PLAN <small>how you play it</small></div>${v193ScoreSlotD("v193Score5")}<div class="v146-tiles">${h.plans.map(p=>{const f=X&&X.facts(null,p.id)||{icon:p.icon,name:p.name};return v146TileD(p.id,p.id===id,f,V&&V.band?V.band(p.id):null,{best:p.id===best,locked})}).join("")}</div></div>`;
  if(fin)fin.innerHTML=`<div class="v146-card" id="v146Card">${v146CardD(id)}</div>${v193RollBlockD()}`;
  v193ScoreRenderD()}
window.__v146PickD=function(id){const V=window.__PREGAME_V51;if(!V||!V.pick)return;if(!V.pick(id))return;v146BoardD();v146ProjD()};
function v146RenderAllD(){if(!document.getElementById("pregameV1513"))return;v146ProjD();v146FullD();v193ScoreRenderD();if(v146OnD()&&document.getElementById("v146Plan")){
  v171CallsD(true);
  const c=document.getElementById("v146Card");if(c)c.innerHTML=v146CardD(v146PlanIdD())}}
try{window.__V146&&window.__V146.onSample(()=>v146RenderAllD())}catch(e){}
(function(){const U=window.__v111PickUsageV111,Fo=window.__v111PickFocusV111;
  window.__v111PickUsageV111=function(k){U&&U(k);v146RenderAllD()};window.__v111PickFocusV111=function(k){Fo&&Fo(k);v146RenderAllD()}})();
/* ===== v193 B THE PLAN SHOWS ITS ODDS (the pages) =====
 * Three things the owner asked for. (1) THE ODDS ARE VISIBLE: every tile on the plan board is shaded by its click
 * odds (`odds-g` ≥ `planGreenV193`, `odds-r` at `planRedV193` backfires or under 25% clicks, `odds-y` between) and
 * prints them; the best odds on the board wear BEST ODDS beside the scout's SCOUT. The default pick is modified by
 * them in `17` (`defaultPickV146`): a scout's plan that is not green gives way to the greenest plan within
 * `planGreenGapV193` perf of it, and the card says why (`v193WhyD`). (2) ROLL BEFORE KICKOFF: under the plan card,
 * 🎲 ROLL THE PLAN (`rollPlanNowV193`) reveals the held outcome for the SELECTED plan — the same dice `holdPlanV135`
 * drew, nothing re-rolled — with a short dice spin, then the result line. From then on the pick is LOCKED (the tiles
 * dim, `pickPlanV146` refuses), the band is FIXED (`bandForV146`), so the strip, the full box score, the plan card
 * and the projected score all redraw against the pre-roll projection (`v193PreD`, ▲/▼ per stat and on the grade);
 * `commitHeldV135` still applies the swing once at kickoff, without the toast. (3) THE PROJECTED SCORE: `__V146.score`
 * (07) is shown on page 3 beside the WIN CHANCE and on page 5 above the tiles — PROJECTED 27–21 — and tweens to its
 * new numbers after the roll. (4) YOUR TEAM is a page of its own after the scout (`v112PageTeam`, `v193TeamD`): the
 * two elevens from the same preview page 3 draws (`__previewMatchupV22`, now with each man's Locker Room +1s and the
 * team nodes' lift in OVR points), chips for what the prestige and the plan give each man, the you-player marked
 * with what he carries, and a header from `teamQualityV192B` — the team without → with the prestige. Kill switch
 * `TU("v193B", 1)`: 0 = no shading or default change, no roll button, no score, no team page. `window.__V193B`;
 * `v193Bcheck`. */
let v193PvD=null,v193PreD=null;   // page 3's roster preview (the team page lists the same men) · the projection before the roll
function v193TU(k,d){try{return window.TU?window.TU(k,d):d}catch(e){return d}}
function v193OnD(){return !!v193TU("v193B",1)}   // the board-only parts (tiles, the roll) already live inside choice mode; the score and the team page show with the wheel too
function v193RevealedD(){try{const V=window.__PREGAME_V51;return V&&V.revealed?V.revealed():null}catch(e){return null}}
function v193OddsClassD(b){if(!b||!v193OnD())return"";const G=v193TU("planGreenV193",.4),R=v193TU("planRedV193",.35),g=b.oddsG!=null?b.oddsG:b.g,r=b.oddsR!=null?b.oddsR:b.r;return(r>=R||g<.25)?" odds-r":g>=G?" odds-g":" odds-y"}
function v193OddsPctD(b){if(!b)return null;const g=b.oddsG!=null?b.oddsG:b.g;return Math.round(g*100)}
function v193BestD(plans){const V=window.__PREGAME_V51;if(!V||!V.band||!v193OnD()||!plans)return null;let best=null;
  plans.forEach(p=>{const b=V.band(p.id);if(!b)return;const g=b.oddsG!=null?b.oddsG:b.g;if(!best||g>best.g)best={id:p.id,g}});return best?best.id:null}
function v193ScoreD(planId){try{return v193OnD()&&window.__V146&&window.__V146.score?window.__V146.score(v146StateD(planId)):null}catch(e){return null}}
function v193ScoreSlotD(id){return v193OnD()?`<div class="v193-score" id="${id}"></div>`:""}
function v193SigD(d,dec){if(d==null||!isFinite(d)||Math.abs(d)<.05)return"";const n=dec?(Math.round(Math.abs(d)*10)/10).toFixed(1):Math.round(Math.abs(d));return`<u class="v193-d ${d>0?"up":"dn"}">${d>0?"▲":"▼"}${n}</u>`}
/* the pre-roll projection, only while the revealed plan is the one on the board */
function v193PreProjD(){const R=v193RevealedD();return R&&v193PreD&&v193PreD.proj&&v193PreD.id===R.id&&R.id===v146PlanIdD()?v193PreD.proj:null}
function v193RowDeltaD(pre,r){if(!pre||!pre.rows||!r||r.mean==null)return"";const q=pre.rows.find(x=>x.k===r.k);return q&&q.mean!=null?v193SigD(r.mean-q.mean,true):""}
function v193ScoreHtmlD(S,pre){if(!S)return"";const d=pre&&pre.us!=null?S.us-pre.us:null;
  return`<span class="l">PROJECTED</span><b><span data-n="${S.usR}">${S.usR}</span>–<span data-n="${S.themR}">${S.themR}</span></b>${v193SigD(d,true)}<small>${S.ready?`${S.n} games in the engine`:"off the matchup"}${S.lift?` · plan ${S.lift>0?"+":"−"}${(Math.round(Math.abs(S.lift)*10)/10).toFixed(1)}`:""}${S.fixed?` · rolled ${S.roll>0?"+":S.roll<0?"−":"±"}${Math.abs(S.roll)}`:""}</small>`}
function v193ScoreNumsD(){const el=document.getElementById("v193Score5")||document.getElementById("v193Score3"),n=el?[...el.querySelectorAll("[data-n]")].map(x=>+x.dataset.n):[];return n.length===2?n:null}
function v193ScoreRenderD(from){if(!v193OnD())return;const id=v146PlanIdD(),S=v193ScoreD(id),R=v193RevealedD(),pre=R&&v193PreD&&v193PreD.id===R.id?v193PreD.score:null;
  if(v193HOnD())return v193HRenderD(from,id,S,R,pre);   // v193 H: the ± on it, the plan's shift named, and a number that ticks instead of jumping
  ["v193Score3","v193Score5"].forEach(i=>{const el=document.getElementById(i);if(!el)return;el.innerHTML=v193ScoreHtmlD(S,pre);el.classList.toggle("rolled",!!(S&&S.fixed));if(from)v193TweenD(el,from)})}
/* ===== v193 H THE ODDS DECIDE THE DEFAULT, THE SCORE SAYS HOW SURE (the pages) =====
 * The projected score is a read off ~10 sample games, so it now says how sure it is: PROJECTED 15–12 ±4, the ± the
 * standard error of the margin over the samples (`__V146.score(...).pm`, 07's `projScoreSureV193H`), "early read"
 * under `projScoreEarlyNV193H` (6) games. After ROLL THE PLAN the shift is named for what it is — the plan's own,
 * deterministic click / backfire (`S.roll − pre.roll`): `▲ plan +3` / `▼ plan −3`, the arrow only when it is a point
 * or more (`plan ±0` otherwise); the team lift in the small print reads "team lift" so the two never blur. While the
 * background sampler fills, the number on screen changes at most every `projScoreTickMsV193H` (800) ms and tweens
 * there (`v193HRenderD`; a plan tap or the roll redraws at once). The default pick's half lives in 17 (`defaultPickV146`).
 * Kill switch `TU("v193H", 1)`. `window.__V193H`; `v193Bcheck`. */
let v193HShowD=null,v193HTimerD=0,v193HStampD=0;   // the score on screen {key, S, pre, at, stamp} · the pending tick
function v193HOnD(){return v193OnD()&&!!v193TU("v193H",1)}
function v193HDeltaD(S,pre){if(!S||!S.fixed||!pre||pre.roll==null)return"";const d=Math.round(S.roll-pre.roll);
  return Math.abs(d)>=1?`<u class="v193-d ${d>0?"up":"dn"}" id="v193Plan">${d>0?"▲":"▼"} plan ${d>0?"+":"−"}${Math.abs(d)}</u>`:`<u class="v193-d" id="v193Plan">plan ±0</u>`}
function v193HHtmlD(S,pre){if(!S)return"";const lift=S.lift?` · team lift ${S.lift>0?"+":"−"}${(Math.round(Math.abs(S.lift)*10)/10).toFixed(1)}`:"";
  const src=S.ready?(S.early?`early read · ${S.n} games`:`${S.n} games in the engine`):"early read · off the matchup";
  return`<span class="l">PROJECTED</span><b><span data-n="${S.usR}">${S.usR}</span>–<span data-n="${S.themR}">${S.themR}</span></b>${S.pm!=null?`<em class="v193-pm">±${S.pm}</em>`:""}${v193HDeltaD(S,pre)}<small>${src}${lift}${S.fixed?` · rolled ${S.roll>0?"+":S.roll<0?"−":"±"}${Math.abs(S.roll)}`:""}</small>`}
function v193HRenderD(from,id,S,R,pre){const h=v146HeldD(),key=[id||"",R?R.id+":"+R.band:"",(h&&h.key)||""].join("|"),now=Date.now(),tick=v193TU("projScoreTickMsV193H",800),L=v193HShowD;
  let show=null,tw=from||null;
  if(L&&L.key===key&&!from){
    if(now-L.at<tick){show=L;if(!v193HTimerD)v193HTimerD=setTimeout(()=>{v193HTimerD=0;try{v193ScoreRenderD()}catch(e){}},tick-(now-L.at)+10)}   // too soon: the numbers on screen stand until the tick
    else{const moved=!!(L.S&&S&&(L.S.usR!==S.usR||L.S.themR!==S.themR));show={key,S,pre,at:moved?now:L.at,stamp:++v193HStampD};if(moved)tw=[L.S.usR,L.S.themR]}}
  else show={key,S,pre,at:now,stamp:++v193HStampD};
  v193HShowD=show;
  ["v193Score3","v193Score5"].forEach(i=>{const el=document.getElementById(i);if(!el)return;if(el.dataset.v193h===String(show.stamp)&&el.innerHTML)return;   // already showing it (a tween may be running)
    el.innerHTML=v193HHtmlD(show.S,show.pre);el.dataset.v193h=String(show.stamp);el.classList.toggle("rolled",!!(show.S&&show.S.fixed));if(tw&&show!==L)v193TweenD(el,tw)})}
window.__V193H={on:v193HOnD,render:v193ScoreRenderD,shown:()=>v193HShowD,html:v193HHtmlD,why:id=>v193WhyD(id)};
function v193TweenD(el,from){const to=[...el.querySelectorAll("[data-n]")];if(to.length!==2)return;const t0=performance.now(),ms=v193TU("scoreTweenMsV193",500);
  const step=()=>{const k=Math.min(1,(performance.now()-t0)/ms);to.forEach((x,i)=>{x.textContent=Math.round(from[i]+(+x.dataset.n-from[i])*k)});if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
function v193WhyD(id){if(!v193OnD())return"";const V=window.__PREGAME_V51,o=V&&V.oddsPick?V.oddsPick():null;if(!o||!o.modified)return"";if(id!==o.pick&&id!==o.scout)return"";
  const nm=k=>{const h=v146HeldD(),p=h&&h.plans?h.plans.find(x=>x.id===k):null;return p?p.name:k};
  return`<div class="v193-why" id="v193Why">🔭 Scout says <b>${esc(nm(o.scout))}</b> (${Math.round(o.scoutG*100)}% clicks) · 🎲 odds say <b>${esc(nm(o.pick))}</b> (${Math.round(o.pickG*100)}%)${id===o.pick?" — lit for you. Pick anything.":""}</div>`}
function v193RollBlockD(){if(!v193OnD())return"";const h=v146HeldD();if(!h||!h.dice||h.applied)return"";const R=v193RevealedD();
  if(!R)return`<div class="v193-rollwrap" id="v193RollWrap"><button type="button" class="btn v193-roll" id="v193Roll" onclick="rollPlanNowV193()">🎲 ROLL THE PLAN</button><small>See now whether it comes off — the projection moves, and the pick is locked. Or leave it: it rolls at kickoff.</small></div>`;
  return v193OutD(R)}
function v193OutD(R){const c=R.band==="green"?"g":R.band==="red"?"r":"n";
  return`<div class="v193-out ${c}" id="v193Out"><i class="v193-die">🎲</i><div><b>${esc(R.icon||"📋")} ${esc(R.name)} — ${R.say}</b><small>${esc(R.story||"")} <em>${esc(R.lines)}</em></small><span>Rolled. The pick is locked — it stands at kickoff.</span></div></div>`}
function rollPlanNowV193(){const V=window.__PREGAME_V51;if(!V||!V.reveal||!v193OnD()||v193RevealedD())return;
  const id=v146PlanIdD();v193PreD={id,proj:v146ProjectD(id),score:v193ScoreD(id),nums:v193ScoreNumsD()};
  const R=V.reveal();if(!R)return;
  const wrap=document.getElementById("v193RollWrap");
  if(wrap){wrap.outerHTML=`<div class="v193-out rolling" id="v193Out"><i class="v193-die spin">🎲</i><div><b>ROLLING…</b></div></div>`;setTimeout(v193AfterRollD,v193TU("rollMsV193",450))}
  else v193AfterRollD()}
function v193AfterRollD(){if(!document.getElementById("pregameV1513"))return;const from=(v193PreD&&v193PreD.nums)||null;v146BoardD();const o=document.getElementById("v193Out");if(o)o.classList.add("land");v146ProjD();v146FullD();v193ScoreRenderD(from)}
window.rollPlanNowV193=rollPlanNowV193;
/* the team page: the two elevens, what the prestige gives each man, and the you-player with what he carries */
function v193TeamD(){const el=document.getElementById("v193Team");if(!el)return;if(!v193OnD()){el.innerHTML="";return}
  const S=gsStateV23,pl=S&&S.pl,wk=S&&(S.wk||S.stray);if(!pl){el.innerHTML="";return}
  const pv=v193PvD||((window.__previewMatchupV22&&pl.pos)?window.__previewMatchupV22(pl.pos,wk&&wk.perf):null);
  let Q=null;try{Q=window.__V192B&&window.__V192B.team?window.__V192B.team():null}catch(e){Q=null}
  const id=v146PlanIdD(),f=id&&window.__V146&&window.__V146.facts?window.__V146.facts(null,id):null,tl=f?v171TeamLiftD(f):null;
  let foc=null;try{foc=v111FocusRowV111(pl,wk)}catch(e){}
  const lab=k=>(window.__statLabelV25&&window.__statLabelV25(k))||k,ts=(window.pregameTempStats?window.pregameTempStats(pl,wk):[]).filter(t=>/Boost|Setback/.test(t.l||""));
  const sg=n=>(n>0?"+":n<0?"−":"±")+Math.abs(n),n1=n=>(Math.round(n*10)/10).toFixed(1).replace(/\.0$/,"");
  const head=Q?`<div class="v193-th" id="v193TeamHead"><b>Your prestige lifts this team from ${Q.base} → ${Q.full}</b><small>team nodes ${sg(Q.lift)}${Q.liftPct?` (+${n1(Q.liftPct)}% on every teammate)`:""} · Locker Room ${sg(Q.locker)}${Q.lockerLv?` (${Q.lockerLv} levels of +1s)`:""} · legacy share ${sg(Q.share)}</small></div>`:"";
  const nudge=(!Q||(Q.lift<=0&&Q.locker<=0))?`<div class="v193-nudge" id="v193Nudge">Team nodes and the Locker Room in the Prestige tree raise these men — every level shows up here.</div>`:"";
  if(!pv||!pv.us||!pv.us.players){el.innerHTML=head+nudge+`<div class="v135-none">The roster is drawn at kickoff.</div>`;return}
  const chip=(t,c)=>`<i class="${c||""}">${t}</i>`;
  const man=m=>{const chips=[];
    if(m.you){chips.push(chip("YOU","you"));if(foc)chips.push(chip(`×${(Math.round((Number(foc.mul)||1.2)*100)/100).toFixed(2)} ${esc(lab(foc.stat))} focus`,"g"));if(f)chips.push(chip(`${esc(f.icon||"📋")} ${esc(f.name)}`,"p"));ts.slice(0,3).forEach(t=>chips.push(chip(esc(t.v),t.good?"g":"r")))}
    else{if(m.locker)chips.push(chip(`+${m.locker} Locker Room`,"g"));if(m.lift)chips.push(chip(`+${n1(m.lift)} team nodes`,"g"));if(tl)chips.push(chip(`${tl>0?"+":"−"}${n1(Math.abs(tl))}% plan`,tl>0?"g":"r"));if(m.star)chips.push(chip("⭐ STAR","s"));if(m.weak)chips.push(chip("WEAK LINK","r"))}
    return`<div class="v193-man${m.you?" you":""}" data-pos="${esc(m.pos)}"><span class="num">#${m.num!=null?m.num:"—"}</span><span class="pos">${esc(m.pos)}</span><span class="nm">${esc(m.name)}</span><span class="ovr">${m.ovr}</span><span class="chips">${chips.join("")}</span></div>`};
  const off=pv.us.players.filter(m=>m.off),def=pv.us.players.filter(m=>!m.off);
  el.innerHTML=head+nudge+`<div class="v193-roster" id="v193Roster"><h5>OFFENSE · ${pv.us.ovr} TEAM OVR</h5>${off.map(man).join("")}<h5>DEFENSE</h5>${def.map(man).join("")}</div>
    <div class="v112-imp-note">OVR is each man's rating this game, the Locker Room's +1s already in it. Team nodes lift every teammate by the percent shown; the plan's lift lands at kickoff with the roll.</div>`}
window.__V193B={on:v193OnD,score:id=>v193ScoreD(id),odds:id=>{const V=window.__PREGAME_V51;return V&&V.band?V.band(id):null},reveal:rollPlanNowV193,revealed:v193RevealedD,locked:()=>!!v193RevealedD(),
  pick:()=>{const V=window.__PREGAME_V51;return V&&V.oddsPick?V.oddsPick():null},pre:()=>v193PreD,team:v193TeamD,best:()=>{const h=v146HeldD();return h&&h.plans?v193BestD(h.plans):null}};
function v193StyleD(){if(document.getElementById("v193StyleEl"))return;document.head.insertAdjacentHTML("beforeend",`<style id="v193StyleEl">
  .v146-tile.odds-g{border-left:3px solid #8fe0a0;background:linear-gradient(100deg,rgba(143,224,160,.18),rgba(255,255,255,.04) 70%)}
  .v146-tile.odds-y{border-left:3px solid var(--gold);background:linear-gradient(100deg,rgba(240,187,69,.15),rgba(255,255,255,.04) 70%)}
  .v146-tile.odds-r{border-left:3px solid #e8938b;background:linear-gradient(100deg,rgba(232,147,139,.18),rgba(255,255,255,.04) 70%)}
  .v146-tile.on.odds-g,.v146-tile.on.odds-y,.v146-tile.on.odds-r{background:rgba(240,187,69,.14)}
  .v146-tile .v193-odds{display:block;font:700 10px Oswald,sans-serif;letter-spacing:.5px;line-height:12px;margin-top:2px;color:var(--chalk-dim)}
  .v146-tile.odds-g .v193-odds{color:#8fe0a0}.v146-tile.odds-y .v193-odds{color:var(--gold)}.v146-tile.odds-r .v193-odds{color:#e8938b}
  .v146-tile s.best{background:#8fe0a0}
  .v146-tile s{white-space:nowrap}   /* v193 B: "SCOUT · BEST ODDS" stays one line over the tile, never over the plan's name */
  .v146-tile.locked{opacity:.42;cursor:default}.v146-tile.locked.on{opacity:1}
  .v193-score{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0 0 6px;padding:5px 9px;border:1px solid rgba(143,224,160,.3);border-radius:8px;background:rgba(143,224,160,.06)}
  .v193-score:empty{display:none}
  .v193-score .l{font:700 9.5px Oswald,sans-serif;letter-spacing:1.4px;color:#8fe0a0}
  .v193-score b{font:700 18px Oswald,sans-serif;color:var(--chalk);letter-spacing:.5px;line-height:1}
  .v193-score small{font:600 10.5px Barlow Condensed,sans-serif;color:var(--chalk-dim);flex:1;min-width:0;text-align:right}
  .v193-score.rolled{border-color:rgba(240,187,69,.5)}
  .odds-head-v20 .v193-score{flex:1 1 100%;margin:6px 0 0}
  .v193-d{font:700 10px Oswald,sans-serif;text-decoration:none;margin-left:3px;vertical-align:middle}
  .v193-d.up{color:#8fe0a0}.v193-d.dn{color:#e8938b}
  .v193-score .v193-pm{font:600 11px Oswald,sans-serif;font-style:normal;color:var(--chalk-dim);letter-spacing:.3px}   /* v193 H: how sure */
  .v193-score .v193-d{white-space:nowrap}
  .v146-pr b .v193-d{font-size:9px;vertical-align:top}
  .v193-rolled{font:700 10px Oswald,sans-serif;font-style:normal;letter-spacing:.8px;white-space:nowrap}
  .v193-rolled.green{color:#8fe0a0}.v193-rolled.red{color:#e8938b}.v193-rolled.neutral{color:#cfd6a8}
  .v193-why{margin-top:5px;padding:5px 8px;border-radius:7px;background:rgba(143,224,160,.1);border:1px solid rgba(143,224,160,.3);font:600 11.5px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.3}
  .v193-why b{color:var(--chalk)}
  .v193-rollwrap{margin-top:8px;text-align:center}
  .v193-rollwrap .btn.v193-roll{width:100%;margin:0;min-height:46px;font-size:15px;letter-spacing:1.5px;box-shadow:0 0 0 1px rgba(240,187,69,.5) inset}
  .v193-rollwrap small{display:block;margin-top:5px;font:400 10.5px system-ui;color:var(--chalk-dim);line-height:1.3}
  .v193-out{display:flex;gap:9px;align-items:flex-start;margin-top:8px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04)}
  .v193-out.g{border-color:rgba(143,224,160,.6);background:rgba(143,224,160,.1)}
  .v193-out.r{border-color:rgba(232,147,139,.6);background:rgba(232,147,139,.1)}
  .v193-out.n{border-color:rgba(207,214,168,.5);background:rgba(207,214,168,.07)}
  .v193-out .v193-die{font-style:normal;font-size:26px;line-height:1;flex:0 0 30px;text-align:center}
  .v193-out .v193-die.spin{animation:v193spin .45s linear infinite}
  .v193-out.land{animation:v193land .25s ease-out}
  .v193-out>div{flex:1;min-width:0}
  .v193-out b{display:block;font:700 14px Oswald,sans-serif;letter-spacing:.3px;color:var(--chalk)}
  .v193-out.g b{color:#8fe0a0}.v193-out.r b{color:#e8938b}.v193-out.n b{color:#cfd6a8}
  .v193-out small{display:block;margin-top:2px;font:400 11.5px system-ui;color:var(--chalk-dim);line-height:1.3}
  .v193-out small em{font-style:normal;color:var(--chalk);font-weight:600}
  .v193-out span{display:block;margin-top:3px;font:700 9.5px Oswald,sans-serif;letter-spacing:1px;color:var(--gold)}
  @keyframes v193spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes v193land{from{transform:scale(.92);opacity:.4}to{transform:scale(1);opacity:1}}
  .v193-th{padding:8px 11px;border:1px solid rgba(240,187,69,.34);border-radius:10px;background:rgba(240,187,69,.05);margin-bottom:6px}
  .v193-th b{display:block;font:700 13.5px Oswald,sans-serif;color:var(--chalk)}
  .v193-th small{display:block;margin-top:2px;font:600 11px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.3}
  .v193-nudge{margin-bottom:6px;padding:6px 9px;border:1px dashed rgba(255,255,255,.22);border-radius:8px;font:600 11px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.3}
  .v193-roster{max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.03);padding:2px 8px;-webkit-overflow-scrolling:touch}
  .v193-roster h5{margin:5px 0 3px;font:700 10px Oswald,sans-serif;letter-spacing:1.4px;color:var(--gold)}
  .v193-man{display:grid;grid-template-columns:30px 26px minmax(0,1fr) 30px;grid-template-areas:"num pos nm ovr" "num pos chips ovr";align-items:center;gap:0 5px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06);font:600 12px Barlow Condensed,sans-serif;color:var(--chalk)}
  .v193-man:last-child{border-bottom:0}
  .v193-man.you{background:rgba(240,187,69,.1);margin:0 -8px;padding:4px 8px;border-radius:7px}
  .v193-man .num{grid-area:num;color:var(--chalk-dim);font-size:11px}
  .v193-man .pos{grid-area:pos;color:var(--chalk-dim);font-size:11px}
  .v193-man .nm{grid-area:nm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .v193-man .ovr{grid-area:ovr;text-align:right;font:700 14px Oswald,sans-serif}
  .v193-man .chips{grid-area:chips;display:flex;flex-wrap:wrap;gap:3px;min-width:0}
  .v193-man .chips:empty{display:none}
  .v193-man .chips i{font:700 9.5px Barlow Condensed,sans-serif;font-style:normal;letter-spacing:.3px;padding:0 5px;border-radius:5px;background:rgba(255,255,255,.08);color:var(--chalk-dim);white-space:nowrap}
  .v193-man .chips i.g{background:rgba(143,224,160,.16);color:#8fe0a0}.v193-man .chips i.r{background:rgba(232,147,139,.16);color:#e8938b}
  .v193-man .chips i.you{background:var(--gold);color:#111}.v193-man .chips i.p,.v193-man .chips i.s{background:rgba(240,187,69,.18);color:var(--gold)}
  </style>`)}
/* ===== v171 A THE MATCHUP CALL (the page) =====
 * Page 5 opens on the opponent's face — their star, their weak link, the unit to fear and the one to attack —
 * and the calls the staff will let him make against it (`__V171.offer`): how many are open is his SAY (coach
 * trust, chemistry, Field General — the meter says so), the rest show locked. Every card says what it does, the
 * risk, how far it swings the game, the units it lifts, the line it is judged on and what it pays or costs; once
 * the projection has played this week with the call, how often it came off. A tap is the call (`__V171.pick`);
 * "Coach's script" is no call. The plan board sits under it as before, its tiles now naming each plan's own
 * rating and swing. */
function v171OfferD(){try{return window.__V171?window.__V171.offer():null}catch(e){return null}}
function v171TeamLiftD(f){if(!f||!window.__V171)return null;const K=(window.RIB_TUNE&&window.RIB_TUNE.planTeamKV171!=null)?window.RIB_TUNE.planTeamKV171:.004;if(window.RIB_TUNE&&window.RIB_TUNE.v171===0)return null;
  return Math.max(-4,Math.min(5,((f.perf||0)+(f.match||0))*K*100))}
const V171_RISK=["","LOW RISK","MEDIUM RISK","HIGH RISK"];
function v171ProjD(id){try{const S=window.__V146&&window.__V146.samples?window.__V146.samples():[];const c=S.filter(x=>x&&x.call&&x.call.id===id);if(!c.length)return"";
  const ok=c.filter(x=>x.call.ok).length;return`<div class="v171-proj">📊 In the projection it came off in <b>${ok} of ${c.length}</b> games</div>`}catch(e){return""}}
function v171CardD(c,on){const sg=v=>(v>0?"+":v<0?"−":"±")+Math.abs(v);
  return`<button type="button" class="v171-c r${c.risk}${on?" on":""}${c.locked?" locked":""}" data-call="${esc(c.id)}"${c.locked?" disabled":""} onclick="__v171PickD('${esc(c.id)}')">
    <i>${c.locked?"🔒":esc(c.icon)}</i><div class="v171-cb"><b>${esc(c.name)} <s>${c.side==="D"?"DEFENSE":"OFFENSE"}</s></b>
    ${c.locked?`<small>Locked — earn more say with the coach and the locker room.</small>`:`<small>${esc(c.pitch)}</small>
    <div class="v171-tags"><span class="rk">${V171_RISK[c.risk]}</span><span>SWING ×${c.varMult.toFixed(2)}</span>${c.edgePct>0?`<span class="up">+${c.edgePct}% ${esc(c.edge.join(" & "))}</span>`:""}</div>
    <div class="v171-goal"><b>WIN IF</b> ${esc(c.goal)}</div>
    <div class="v171-pay"><span class="ok">✓ trust ${sg(c.ok.trust)} · hype ${sg(c.ok.hype)} · chem ${sg(c.ok.chem)}</span><span class="no">✗ trust ${sg(c.no.trust)}${c.no.hype?` · hype ${sg(c.no.hype)}`:""}${c.no.chem?` · chem ${sg(c.no.chem)}`:""}</span></div>${on?v171ProjD(c.id):""}`}</div></button>`}
function v171CallsD(soft){const el=document.getElementById("v171Calls");if(!el)return;const O=v171OfferD();if(!O){el.innerHTML="";return}
  if(soft){const on=el.querySelector(".v171-c.on");if(on){const pj=on.querySelector(".v171-proj"),h=v171ProjD(O.chosen);if(pj)pj.outerHTML=h||"";else if(h)on.querySelector(".v171-cb").insertAdjacentHTML("beforeend",h)}return}
  const I=O.I,unit={OL:"offensive line",DL:"defensive line",LB:"linebackers",SEC:"secondary",REC:"receivers",RB:"backfield",QB:"quarterback"},open=O.calls.filter(c=>!c.locked),locked=O.calls.length-open.length;
  el.innerHTML=`<div class="v171-mc" id="v171Board"><div class="v171-sub">🧠 THE MATCHUP CALL <small>${open.length} of ${O.calls.length} open${locked?` · ${locked} locked`:""}</small></div>
    <div class="v171-face"><span class="st">⭐ ${esc(I.star.tier)} ${esc(I.star.pos)} <b>#${I.star.num} ${esc(I.star.name)}</b></span><span class="wk">🎯 WEAK ${esc(I.weak.pos)} <b>#${I.weak.num} ${esc(I.weak.name)}</b></span><span class="sg">💪 ${esc(unit[I.strong.unit])} +${Math.round(I.strong.pct*100)}%</span><span class="sf">🩹 ${esc(unit[I.soft.unit])} −${Math.round(I.soft.pct*100)}%</span></div>
    <div class="v171-say"><span>YOUR SAY</span><div><i style="width:${Math.round(O.say*100)}%"></i></div><b>${Math.round(O.say*100)}%</b></div>
    <div class="v171-saynote">Coach trust, team chemistry and Field General decide how many calls you get and how hard the staff runs them (×${O.str.toFixed(2)}).</div>
    <div class="v171-list">${O.calls.filter(c=>!c.locked).map(c=>v171CardD(c,c.id===O.chosen)).join("")}
    <button type="button" class="v171-c coach${!O.chosen?" on":""}" data-call="" onclick="__v171PickD('')"><i>📋</i><div class="v171-cb"><b>Coach's script</b><small>No call — the staff plays it straight. Nothing riding on it either way.</small></div></button>
    ${O.calls.filter(c=>c.locked).map(c=>v171CardD(c,false)).join("")}</div></div>`}
window.__v171PickD=function(id){if(!window.__V171||!window.__V171.pick(id||null))return;v171CallsD();try{v146ProjD();v146FullD()}catch(e){}};
function v146StyleD(){if(document.getElementById("v146StyleEl"))return;document.head.insertAdjacentHTML("beforeend",`<style id="v146StyleEl">
  .v146-proj{margin-top:10px;padding:8px 10px;border:1px solid rgba(143,224,160,.3);border-radius:10px;background:rgba(143,224,160,.05)}
  .v146-proj:empty{display:none}
  .v146-ph{display:flex;align-items:baseline;gap:8px;font:700 10px Oswald,sans-serif;letter-spacing:1.3px;color:#8fe0a0}
  .v146-ph span{flex:1;min-width:0;font:600 11px Barlow Condensed,sans-serif;letter-spacing:.3px;color:var(--chalk-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .v146-ph em{font:700 11px Oswald,sans-serif;font-style:normal;letter-spacing:.8px}
  .v146-pr{display:flex;gap:4px;margin-top:5px}
  .v146-pr span{flex:1 1 0;min-width:0;text-align:center;padding:3px 1px;border-radius:7px;background:rgba(255,255,255,.04)}
  .v146-pr span.hd{background:rgba(143,224,160,.12)}
  .v146-pr b{display:block;font:700 16px Oswald,sans-serif;line-height:1.1;color:var(--chalk)}
  .v146-pr small{display:block;font:600 9.5px Barlow Condensed,sans-serif;color:var(--chalk-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .v146-pr i{display:block;font:600 9.5px Barlow Condensed,sans-serif;font-style:normal;color:#8fe0a0;opacity:.85}
  .v146-rg{font:600 10.5px Barlow Condensed,sans-serif;color:var(--chalk-dim);margin-left:4px}
  .v146-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px}
  .v171-sub{display:flex;align-items:baseline;gap:8px;margin:2px 0 6px;font:700 12px Oswald,sans-serif;letter-spacing:1.4px;color:var(--gold)}
  .v171-sub small{font:600 12px Barlow Condensed,sans-serif;letter-spacing:.3px;color:var(--chalk-dim)}
  .v171-mc{margin-bottom:12px}
  .v171-face{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:7px}
  .v171-face span{padding:5px 7px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--line);font:600 12px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.25;min-width:0}
  .v171-face span b{display:block;color:var(--chalk);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .v171-face .st{border-color:rgba(240,187,69,.5)}.v171-face .wk{border-color:rgba(143,224,160,.4)}
  .v171-face .sg{color:#e8938b}.v171-face .sf{color:#8fe0a0}
  .v171-say{display:flex;align-items:center;gap:8px;font:700 11px Oswald,sans-serif;letter-spacing:1px;color:var(--chalk-dim)}
  .v171-say div{flex:1;height:7px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}
  .v171-say i{display:block;height:100%;background:linear-gradient(90deg,#8ec3ee,var(--gold))}
  .v171-say b{color:var(--gold);font-size:13px}
  .v171-saynote{font:400 12px system-ui;color:var(--chalk-dim);margin:3px 0 7px;line-height:1.3}
  .v171-list{display:flex;flex-direction:column;gap:6px}
  .v171-c{display:flex;gap:9px;align-items:flex-start;text-align:left;width:100%;padding:8px 10px;border-radius:11px;border:1px solid var(--line);background:rgba(255,255,255,.035);color:var(--chalk);cursor:pointer}
  .v171-c>i{font-style:normal;font-size:22px;line-height:1.1;flex:0 0 26px;text-align:center}
  .v171-cb{flex:1;min-width:0}
  .v171-cb>b{display:block;font:700 15px Oswald,sans-serif;letter-spacing:.3px}
  .v171-cb>b s{text-decoration:none;font:700 10px Oswald,sans-serif;letter-spacing:1px;color:var(--chalk-dim);margin-left:4px}
  .v171-cb>small{display:block;font:400 12.5px system-ui;color:var(--chalk-dim);line-height:1.3;margin-top:2px}
  .v171-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .v171-tags span{font:700 11px Barlow Condensed,sans-serif;letter-spacing:.4px;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.07);color:var(--chalk)}
  .v171-c.r1 .rk{background:rgba(143,224,160,.18);color:#8fe0a0}.v171-c.r2 .rk{background:rgba(240,187,69,.18);color:var(--gold)}.v171-c.r3 .rk{background:rgba(232,147,139,.2);color:#e8938b}
  .v171-tags .up{color:#8ec3ee}
  .v171-goal{margin-top:5px;font:600 13px Barlow Condensed,sans-serif;color:var(--chalk)}
  .v171-goal b{color:var(--gold);letter-spacing:.8px;margin-right:3px}
  .v171-pay{display:flex;flex-wrap:wrap;gap:3px 10px;margin-top:3px;font:600 12px Barlow Condensed,sans-serif}
  .v171-pay .ok{color:#8fe0a0}.v171-pay .no{color:#e8938b}
  .v171-proj{margin-top:5px;font:600 12px Barlow Condensed,sans-serif;color:#8ec3ee}
  .v171-c.on{border-color:var(--gold);background:rgba(240,187,69,.12);box-shadow:0 0 0 1px var(--gold) inset}
  .v171-c.coach{padding:7px 10px}
  .v171-c.locked{opacity:.45;cursor:default}
  body:has(#pregameV1513) .mz158-chip{top:env(safe-area-inset-top,0px)!important;left:50%!important;right:auto!important;transform:translateX(-50%);font-size:8px!important;padding:2px 7px 3px!important;border-radius:0 0 8px 8px!important}
  .v146-tile{position:relative;min-width:0;padding:6px 2px 5px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--chalk);cursor:pointer;text-align:center}
  .v146-tile i{display:block;font-style:normal;font-size:19px;line-height:1.1}
  .v146-tile b{display:flex;align-items:center;justify-content:center;font:700 12.5px Barlow Condensed,sans-serif;line-height:1.1;min-height:28px;margin-top:2px;padding:0 3px}
  .v146-tile em{display:block;font:700 14px Oswald,sans-serif;font-style:normal;margin-top:2px}
  .v146-tile u{display:block;text-decoration:none;font:600 11px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:13px}
  .v146-tile s{position:absolute;top:-6px;left:50%;transform:translateX(-50%);text-decoration:none;font:700 7.5px Oswald,sans-serif;letter-spacing:.8px;background:var(--gold);color:#111;border-radius:6px;padding:0 4px}
  .v146-tile.on{border-color:var(--gold);background:rgba(240,187,69,.14);box-shadow:0 0 0 1px var(--gold) inset}
  .v146-card{margin-top:8px;padding:9px 10px;border:1px solid rgba(240,187,69,.34);border-radius:10px;background:rgba(240,187,69,.05)}
  .v146-hd{display:flex;gap:8px;align-items:flex-start}
  .v146-hd>span{font-size:24px;line-height:1}
  .v146-hd b{display:block;font:700 14px Oswald,sans-serif;color:var(--chalk)}
  .v146-hd b s{text-decoration:none;font:700 9px Oswald,sans-serif;letter-spacing:.8px;color:var(--gold)}
  .v146-hd small{display:block;font:400 11px system-ui;color:var(--chalk-dim);line-height:1.3;margin-top:2px}
  .v146-g{margin-top:6px}
  .v146-r{display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.06);font:600 11px Barlow Condensed,sans-serif;color:var(--chalk-dim);line-height:1.35}
  .v146-r span{flex:0 0 auto}
  .v146-r b{font:600 11.5px Barlow Condensed,sans-serif;color:var(--chalk);text-align:right;min-width:0}
  .v146-r b small{color:var(--chalk-dim);font-weight:400}
  .v146-var{margin-top:6px;display:flex;gap:8px;align-items:baseline}
  .v146-var b{font:700 13px Oswald,sans-serif;letter-spacing:.8px;white-space:nowrap}
  .v146-var span{font:400 10.5px system-ui;color:var(--chalk-dim);line-height:1.3}
  /* v146 D: every page of the wizard on one phone screen (400x860), the buttons at the bottom */
  .v112-wiz-d.pregame-v1513{padding-top:calc(env(safe-area-inset-top) + 8px);padding-bottom:calc(env(safe-area-inset-bottom) + 8px)}
  .v112-wiz-d .v112-top{padding:2px 2px 0}
  .v112-wiz-d .v112-title{font-size:22px;margin-top:3px}
  .v112-wiz-d .v112-sub{font-size:11.5px;margin-top:4px;line-height:1.3}
  .v112-wiz-d .v112-fix{margin-top:5px}
  .v112-wiz-d .v112-dots{margin:7px 0 4px}
  .v112-wiz-d .v112-nav{margin-top:10px}
  .v112-wiz-d .v112-nav .btn{min-height:48px}
  .v112-wiz-d .v112-skip{min-height:38px;margin-top:6px;padding:4px 8px}
  .v112-wiz-d .v112-imp{margin-bottom:8px;padding:8px 11px}
  .v112-wiz-d .v112-imp-row{line-height:1.3;padding:2px 0}
  .v112-wiz-d .v112-imp-note{margin-top:5px;padding-top:5px;font-size:10px}
  .v112-wiz-d .pregame-match-v1513{margin:4px 0 8px}
  .v112-wiz-d .pregame-team-v1513{padding:7px 6px}
  .v112-wiz-d .pregame-emblem-v44{width:34px;height:34px;margin-bottom:4px}
  .v112-wiz-d .pregame-odds-v20{margin:0 0 6px;padding:9px 11px}
  .v112-wiz-d .odds-big-v20{font-size:28px}
  .v112-wiz-d .odds-bar-v20{margin:7px 0}
  .v112-wiz-d .odds-notes-v20 div{font-size:11px;padding:3px 8px}
  .v112-wiz-d .v112-fold{margin-top:6px}
  .v112-wiz-d .v112-fold>summary{padding:9px 12px}
  .v112-wiz-d #v112Page3 .gs-wrap-v23{margin-top:8px}
  .v112-wiz-d #preStatsV25{margin:6px 0 2px!important;padding:8px 10px!important}
  .v112-wiz-d #preStatsV25>div:nth-child(2){display:none}
  .v112-wiz-d #preStatsV25>div[style*="display:flex"]{margin:0!important}
  .v112-wiz-d #preStatsV25>div[style*="display:flex"]>span>span{display:inline!important;margin-left:4px}
  .v112-wiz-d #preStatsV25>div[style*="display:flex"]>span:nth-of-type(2){min-width:92px!important}
  .v112-wiz-d .v146-temp>summary{color:var(--gold)}
  .v112-wiz-d .v146-temp>div{margin:8px!important}
  </style>`)}
// v20: full-roster average on the shared scale (falls back to the level anchor)
function rosterAvg(roster,fb){const a=(Array.isArray(roster)?roster:[]).map(normalize).filter(p=>p.ovr>0);return a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:fb}
// v20: unit-by-unit comparison → 2-3 plain-language lines about how this game
// is likely to play out, from the actual roster composition on both sides.
function matchupNotes(oursR,theirsR,player){
  const UNITS=[['QB',['QB'],'they attack through the air — expect shootout tempo','you win the quarterback duel — lean on the pass'],
    ['playmakers',['RB','WR','TE'],'their skill guys can break any play open — gang-tackle or bleed','your playmakers win their one-on-ones — feed them'],
    ['offensive line',['OL','LT','LG','C','RG','RT'],'their line should control the trenches — expect them to grind the clock','your front lives in their backfield — stack the box and tee off'],
    ['front seven',['DL','LB','EDGE','DT'],'their front seven closes fast — quick throws or die','their front is soft — run right at them'],
    ['secondary',['CB','S'],'their secondary blankets receivers — tough sledding through the air','their secondary leaks — throw on them early and often']];
  const avg=(r,ps)=>{const a=(Array.isArray(r)?r:[]).map(normalize).filter(p=>ps.includes(p.pos));return a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:null};
  const notes=[];
  UNITS.forEach(([name,ps,badTxt,goodTxt])=>{
    const u=avg(oursR,ps),t=avg(theirsR,ps);if(u==null||t==null)return;
    const d=t-u;
    if(d>=3)notes.push({d:Math.abs(d),good:false,txt:`Their ${name} (${Math.round(t)}) outrates yours (${Math.round(u)}) — ${badTxt}.`});
    else if(d<=-3)notes.push({d:Math.abs(d),good:true,txt:`Your ${name} edge (${Math.round(u)} vs ${Math.round(t)}) — ${goodTxt}.`});
  });
  notes.sort((a,b)=>b.d-a.d);
  const out=notes.slice(0,3);
  if(!out.length)out.push({good:true,txt:'Even matchup across the board — execution and the bounce of the ball decide this one.'});
  if(player&&player._tempStatBuffsV25&&player._tempStatBuffsV25.length)out.push({good:true,txt:`Temporary edge this game: ${player._tempStatBuffsV25.map(b=>{const a=b.max?10:b.amt;return(a>0?'+':'')+a+' '+(window.__statLabelV25?window.__statLabelV25(b.stat):b.stat)}).join(', ')}.`});
  return out;
}
function showPregame(ctx,args){
  const state=getState(),player=state?.player,week=currentWeek(),opp=week?.opponentV11||{};
  const anchor=[18,30,42,54,66,78,86,90][player?.level||0]||55;
  // v22.2: build the matchup from the SAME roster builder the game uses (Wr), so
  // the team OVRs + top-5 shown MATCH the opponent you actually play. Falls back
  // to the old scouting-scale roster only if the preview hook is unavailable.
  const pv=(window.__previewMatchupV22&&player&&player.pos)?window.__previewMatchupV22(player.pos, week&&week.perf):null;
  v193PvD=pv;   // v193 B: the team page lists the same men page 3 previews
  let oursR,theirsR,ourOvr,theirOvr;
  if(pv){ oursR=pv.us.players; theirsR=pv.opp.players; ourOvr=pv.us.ovr; theirOvr=pv.opp.ovr; }
  else { oursR=userRoster(); theirsR=opponentRoster(week); ourOvr=rosterAvg(oursR,anchor); theirOvr=rosterAvg(theirsR,anchor); }
  let ours=topFive(oursR),theirs=topFive(theirsR);
  if(ours.length<5)ours=fallbackFive(ourOvr,player?.seasonSeed||1);if(theirs.length<5)theirs=fallbackFive(theirOvr,(player?.seasonSeed||1)+31);
  const ourName=player?.schoolName||player?.teamName||player?.school||'YOUR TEAM',theirName=opp.name||opp.team||week?.opp||'OPPONENT';
  const pregameEmblemV44=(us,nm)=>{const L=window.TEAM_LOGOS_V44;if(!L)return '';const tc=window.__GRIDIRON_TEAM_CUSTOM__||{};const li=us?(tc.logo!=null?tc.logo:L.forName(tc.teamName||nm)):L.forName(nm);return li==null?'':`<span class="pregame-emblem-v44 emblem-v44" title="${L.name(li)}" style="${L.css(li)}"></span>`};
  // win % is derived from the SAME OVRs shown, so the number and the rosters agree
  const gap=(ourOvr||0)-(theirOvr||0);
  const winClamped=Math.max(5,Math.min(95,Math.round(50+gap*2.4)));
  const lab=winClamped>=70?'Heavy Favorite':winClamped>=57?'Favored':winClamped>45?'Toss-Up':winClamped>=30?'Underdog':'Heavy Underdog';
  const notes=matchupNotes(oursR,theirsR,player);
  pending={ctx,args};document.getElementById('pregameV1513')?.remove();v135DoneD=false;v135BeforeD=null;v136RivalDoneD=false;
  // v112 D: gsSectionV23 is still the thing that prepares gsStateV23, the coordinator's adopted
  // plan (_gameScriptV23) and the shared stylesheet — the wizard just places its three blocks on
  // three different pages instead of stacking them in one column.
  gsSectionV23(oursR,theirsR,player,week);
  const scoutHTML=`<div class="pregame-match-v1513"><div class="pregame-team-v1513">${pregameEmblemV44(true,ourName)}<b>${esc(ourName)}</b><small>${Math.round(ourOvr)} TEAM OVR</small></div><div class="pregame-vs-v1513">VS</div><div class="pregame-team-v1513 away">${pregameEmblemV44(false,theirName)}<b>${esc(theirName)}</b><small>${Math.round(theirOvr)} TEAM OVR</small></div></div><div class="pregame-odds-v20"><div class="odds-head-v20"><div class="odds-big-v20" style="color:${winClamped>=57?'#7fe0a0':winClamped>45?'var(--gold)':'#ff9a9a'}">${winClamped}%<small>WIN CHANCE</small></div><div class="odds-lab-v20"><b>${esc(lab)}</b><small>${Math.round(ourOvr)} vs ${Math.round(theirOvr)} team OVR${week?.playoff?' · playoff':''}</small></div>${v193ScoreSlotD('v193Score3')}</div><div class="odds-bar-v20"><i style="width:${winClamped}%"></i></div><div class="odds-notes-v20">${notes.map(n=>`<div class="${n.good?'g':'b'}">${n.good?'▲':'▼'} ${esc(n.txt)}</div>`).join('')}</div></div><details class="v112-fold"><summary>PLAYERS TO WATCH · top five from each roster</summary><div class="pregame-lists-v1513"><div class="pregame-card-v1513"><h3>${esc(ourName)} · TOP 5</h3>${rows(ours)}</div><div class="pregame-card-v1513"><h3>${esc(theirName)} · TOP 5</h3>${rows(theirs)}</div></div></details>`;
  const fix=(week?.playoff?(week.round||'Playoff'):'WEEK '+(week?.week||'—'));
  document.body.insertAdjacentHTML('beforeend',v112ShellD({fix,ourName,theirName,scout:scoutHTML,
    temp:tempStatsPanel(player,week),stats:pregamePlayerStatsV25(player)}));
  v112ShowPageD(0);
  try{window.__V146&&window.__V146.start()}catch(e){}   // v146 D: the week is played headless behind the pages
}
function installPregame(){
  const fn=window.chooseGamePlanV11;
  if(typeof fn!=='function'||fn.__pregameV1514)return false;
  originalChoose=fn;
  const wrapped=function(){if(window.__silentSimV85)return originalChoose.apply(this,arguments);/* v85: a simmed week books straight through */showPregame(this,[...arguments]);return null};
  wrapped.__pregameV1514=true;wrapped.__originalV1514=fn;
  window.chooseGamePlanV11=wrapped;
  return true;
}
[0,250,1000,2500].forEach(ms=>setTimeout(installPregame,ms));
window.closePregameV1513=closePregame;window.continuePregameV1513=continuePregame;
window.__pregamePickV146=function(id){if(pending&&pending.args&&id)pending.args[0]=id};   /* v146 D: the plan tapped on page 5 is the plan the week is booked with */
window.__GRIDIRON_BALL_DIAGNOSTIC_V1513=()=>{let sc=null;try{sc=window.__gridironScene||window.game?.scene?.getScenes?.(true)?.find?.(x=>x instanceof Ot)||null}catch(e){}return{scene:!!sc,playing:!!sc?.play,ball:!!sc?.ballSpr,ballValid:objectValid(sc?.ballSpr),x:sc?.ballSpr?.x??null,y:sc?.ballSpr?.y??null,rotation:sc?.ballSpr?.rotation??null,recoveries:sc?.play?.__ballRecoveriesV1513||0}};
window.__GRIDIRON_BUILD__='15.14-wired-pregame-ball-lifecycle';
window.__GRIDIRON_FEATURES__=Object.assign({},window.__GRIDIRON_FEATURES__||{},{consecutiveBallRecoveryV1513:true,pregameTopFiveV1513:true,pregameHookV1514:'chooseGamePlanV11',ballLifecycleV1514:true});
})();
