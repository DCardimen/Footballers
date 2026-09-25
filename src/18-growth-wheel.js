
/* ===== v42 GROWTH DECISIONS — season commitment wheel + lasting effects =====
 * Replaces championship moments, story arcs, and the weekly pregame roll with
 * ONE system: an auto-rolled, personality-weighted commitment at season start
 * plus 2-3 seeded in-season decisions. Outcomes grant +-3..10 on 3-5 stats for
 * 5 games / a season / multiple seasons (severity + prestige decide), best
 * rolls mint small permanents (+1..3). Effects compose into the same
 * _tempStatBuffsV25 array the sim consumes, so the pregame panel shows exactly
 * what counts. Dials (frequency / luck / game-day softening) live in Settings.
 */
(function(){
  "use strict";
  const ST=()=>{try{return window.__GRIDIRON_AUDIT__?.getState?.()||window.S||null}catch(e){return null}};
  const PL=()=>{const s=ST();return s&&s.player||null};
  const SET=()=>{const s=ST();if(!s)return{};s.settings=s.settings||{};return s.settings};
  const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const POOLS={QB:["throwing","awareness","vision","acceleration","discipline"],RB:["speed","agility","acceleration","ballControl","vision"],WR:["speed","catching","agility","jumping","acceleration"],TE:["catching","blocking","strength","agility","awareness"],OL:["blocking","strength","awareness","discipline"],DL:["strength","tackling","quickness","acceleration","awareness"],LB:["tackling","awareness","speed","strength","vision"],CB:["speed","agility","jumping","awareness","quickness"],S:["tackling","speed","awareness","jumping","vision"]};
  const LBL={speed:"SPD",agility:"AGI",acceleration:"ACC",ballControl:"BCT",vision:"VIS",throwing:"THR",awareness:"AWR",catching:"CTH",blocking:"BLK",strength:"STR",tackling:"TKL",quickness:"QCK",jumping:"JMP",discipline:"DIS"};
  // v43: combinatorial option pool - THEME x NAME x INTENSITY generates ~160
  // distinct commitments. Bigger boosts appear rarer AND carry more risk.
  const THEMES=[
    {id:"iron",icon:"🏋️",names:["Dawn Patrol Lifts","Sled Work Till Dark","Old-School Iron","Strongman Saturdays"],stats:["strength","tackling"],w:p=>1+p.workethic*.9+p.aggression*.6,fat:6},
    {id:"track",icon:"💨",names:["Sprint Mechanics Rebuild","Hill Repeats at Dusk","Parachute Sprints","Summer Track Club"],stats:["speed","acceleration"],w:p=>1+p.confidence*.6+p.workethic*.6,fat:4},
    {id:"film",icon:"🎞️",names:["All-22 Deep Dives","Opponent Tendency Book","Midnight Film Sessions","Chart Every Snap"],stats:["awareness","vision"],w:p=>1+p.iq*.9+p.longterm*.5},
    {id:"hands",icon:"🧤",names:["Jugs Machine Marathons","Tennis-Ball Wall Drills","Blindfold Catch Reps","One-Hand Ladder Work"],stats:["catching","ballControl"],w:p=>1+p.workethic*.6+p.eq*.4},
    {id:"feet",icon:"🪜",names:["Ladder & Cone Hell","Barefoot Sand Work","Dance-Studio Footwork","Mirror Drill Obsession"],stats:["agility","quickness"],w:p=>1+p.confidence*.5+p.workethic*.5},
    {id:"flex",icon:"🧘",names:["Hot Yoga Block","Mobility Mornings","Breathwork & Ice Baths","Sleep-Doctor Protocol"],stats:["discipline","awareness"],w:p=>1+p.eq*.8+p.longterm*.5},
    {id:"mentor",icon:"🎓",names:["Shadow the Veterans","Coach's Office Hours","Playbook Ride-Alongs","Captain's Council Seat"],stats:["awareness","discipline"],w:p=>1+p.coachability*1.0+p.loyalty*.4},
    {id:"social",icon:"🎉",names:["Host the Team Cookouts","Community Spotlight Tour","Squad Road Trips","Locker-Room DJ Era"],stats:null,w:p=>1+(10-p.longterm)*.6+p.confidence*.7},
    {id:"plyo",icon:"🦘",names:["Plyo Box Ladders","Bounding Circuits","Dunk-Practice Nights","Broad-Jump Ladder"],stats:["jumping","acceleration"],w:p=>1+p.aggression*.6+p.confidence*.4,fat:4},
    {id:"lab",icon:"🧠",names:["Cognitive Reaction Lab","VR Rep Simulator","Chess & Playbooks","Film-Quiz League"],stats:["awareness","quickness"],w:p=>1+p.iq*.8+p.longterm*.4},
    {id:"craft",icon:"🎯",names:["Position Master Class","Technique Tune-Up","Fundamentals Bootcamp","Private Skills Guru"],stats:null,w:p=>1+p.workethic*.6+p.coachability*.6},
    {id:"edge",icon:"🔥",names:["Underground 7-on-7s","Boxing Cross-Training","Parkour Conditioning","Beach Gauntlet League"],stats:null,w:p=>1+p.aggression*.8+(10-p.eq)*.5,fat:5,risky:.08}
  ];
  const TIERS=[
    {tag:"LIGHT",p:.45,amt:[3,4],dur:r=>({games:5+((r||0)*3|0)}),risk:.16},
    {tag:"COMMITTED",p:.32,amt:[5,6],dur:r=>r<.5?{games:6+(r*6|0)%3}:{season:true},risk:.26},
    {tag:"OBSESSIVE",p:.17,amt:[7,8],dur:()=>({season:true}),risk:.38},
    {tag:"ALL-IN",p:.06,amt:[9,10],dur:r=>r<.6?{season:true}:{seasons:2},risk:.5}
  ];
  const seededRand=(pl,tag)=>{let h=2166136261>>>0;const s=String(pl&&pl.seasonSeed||1)+"|"+String((pl&&pl.seasonsPlayedTotal)||0)+"|"+tag;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return()=>{h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
  function persona(pl){const p=pl&&pl.personaV13||{};const g=k=>p[k]==null?5:+p[k];return{aggression:g("aggression"),iq:g("iq"),eq:g("eq"),longterm:g("longterm"),workethic:g("workethic"),loyalty:g("loyalty"),confidence:g("confidence"),coachability:g("coachability")}}
  function prestigeOf(pl){return cl(Number(pl&&(pl.prestigeLifetime!=null?pl.prestigeLifetime:pl.prestige))||0,0,30)}
  function dial(k,d){const v=SET()["growth_"+k];return v==null?d:+v}
  function genOptions(pl,rand,count){
    const p=persona(pl),pool=(POOLS[pl.pos]||POOLS.LB);
    const opts=[],used=new Set();
    let guard=0;
    while(opts.length<(count||5)&&guard++<90){
      const th=THEMES[(rand()*THEMES.length)|0];
      if(used.has(th.id))continue;
      let tr=rand(),tier=TIERS[0],acc=0;for(const T of TIERS){acc+=T.p;if(tr<=acc){tier=T;break}}
      const stats=[];const base=(th.stats||pool).slice();
      const n=3+(rand()*3|0);
      while(stats.length<n){const s=base.length?base:pool.filter(k=>!stats.includes(k));if(!s.length)break;const k=s.splice((rand()*s.length)|0,1)[0];if(k&&!stats.includes(k)&&LBL[k])stats.push(k)}
      if(stats.length<3)continue;
      used.add(th.id);
      const amt=tier.amt[0]+((rand()*(tier.amt[1]-tier.amt[0]+1))|0);
      const dur=tier.dur(rand());
      // v62: the wedge is the appetite RAISED TO A POWER. Raw appetite spread the
      // wheel about as evenly as chance, which made the personality sliders feel
      // decorative; the exponent is what turns "he likes this a bit more" into a
      // visibly fatter wedge and "this is not him at all" into a sliver.
      opts.push({theme:th.id,icon:th.icon,name:th.names[(rand()*th.names.length)|0],tag:tier.tag,stats,amt,dur,risk:tier.risk+(th.risky||0),fat:th.fat||0,
        w:Math.pow(Math.max(.4,th.w(p)),cl(TU("wheelPersonaPow",1.85),1,4))});
    }
    // v62: no wedge may VANISH. Sharpening the weights is the point, but a
    // character who would basically never do a thing still has to be able to see
    // it on the wheel — an arc of a couple of degrees is not an option the player
    // can read, it is a rendering artefact. Every share is lifted to a floor and
    // the rest is redistributed, so the ordering and the story are untouched.
    const n=opts.length, fl=cl(TU("wheelWedgeFloor",.035),0,1/(n+1)), T=opts.reduce((a,o)=>a+o.w,0)||1;
    for(const o of opts)o.w=fl+(o.w/T)*(1-fl*n);
    return opts;
  }
  /* ===== v50 FIT ROLL — the +/neutral/- outcome is its OWN system =====
   * The wheel decides WHAT you commit to, weighted by personality. This decides
   * whether it PAYS, and it is deliberately a separate roll: left alone it is a
   * near-even three-way split, so a character with no strong opinions is at the
   * mercy of the dice. What tilts it is JIVE — how far this theme sits from what
   * a NEUTRAL personality would want, measured with the theme's own weight
   * function, so the two systems can never disagree about who you are. A
   * relentless kid who lands on dawn lifts is living in character and cashes in;
   * the same kid landing on hot yoga is fighting himself and it shows.
   * Everything the old scalar cared about (prestige, coach trust, form, fatigue,
   * tier risk, the luck dial) survives as a bounded NUDGE — it moves the needle
   * now instead of setting it. */
  const NEUTRAL={aggression:5,iq:5,eq:5,longterm:5,workethic:5,loyalty:5,confidence:5,coachability:5};
  const TRAIT_LBL={aggression:"Aggression",iq:"Football IQ",eq:"Composure",longterm:"Long-Term Focus",workethic:"Work Ethic",loyalty:"Loyalty",confidence:"Confidence",coachability:"Coachability"};
  const NEUTRAL_W={};
  THEMES.forEach(t=>{try{NEUTRAL_W[t.id]=t.w(NEUTRAL)||1}catch(e){NEUTRAL_W[t.id]=1}});
  function jiveOf(pl,themeId){
    const th=THEMES.find(t=>t.id===themeId); if(!th) return 0;
    let mine;try{mine=th.w(persona(pl))}catch(e){return 0}
    const base=NEUTRAL_W[themeId]||1;
    // the spread a theme's weight can travel is theme-specific, so normalise by
    // its own neutral value — a 1.5x-of-neutral theme reads the same as any other
    return cl((mine/base-1)/cl(dial("jive",.85),.3,2),-1,1);
  }
  /* ===== v62 PERSONALITY GRIP — the sliders decide more, and they show their work =====
   * Two complaints, one cause. The wheel's wedges came out nearly even, and when
   * the roll went badly there was one sentence of hand-waving about why.
   *
   * Every theme weight in this file is LINEAR in the persona sliders — w = 1 + Σ
   * c·slider — which means a trait's contribution to the whole is exactly
   * w(persona) minus w(persona with that one slider put back to neutral), and
   * those contributions SUM to the difference from neutral. So the ledger below is
   * not a plausible-looking attribution: it adds up. Each row is converted to the
   * percentage points it moves the PAYS band, using the same slope bandOdds uses,
   * and the rows plus the form-and-risk nudge equal the number on the bar.
   *
   * The grip itself is TU("wheelPersonaPow"): the wedge is the weight raised to a
   * power, so a theme a character is 2x keen on is not 2x the arc but nearly 4x
   * it. A driven, hot-headed kid should almost never roll onto recovery work, and
   * before this he rolled onto it about as often as anything else. */
  function traitLedger(P,wfn){
    let mine,base;
    try{mine=wfn(P);base=wfn(NEUTRAL)}catch(e){return{rows:[],mine:1,base:1}}
    const rows=[];
    for(const k in NEUTRAL){
      const probe=Object.assign({},P);probe[k]=5;
      let d;try{d=mine-wfn(probe)}catch(e){continue}
      if(Math.abs(d)>1e-6)rows.push({key:k,label:TRAIT_LBL[k]||k,val:P[k],d});
    }
    rows.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
    return{rows,mine:mine||1,base:base||1};
  }
  // jive, and the per-trait ledger that adds up to it, from ANY linear trait
  // weight function — the growth themes and the v62 plan kinds both feed it
  function jiveFrom(P,wfn){
    const L=traitLedger(P,wfn),base=L.base||1,dl=cl(dial("jive",.85),.3,2);
    const raw=(L.mine/base-1)/dl, jive=cl(raw,-1,1);
    // when the clamp bites, scale the rows with it so they still total the jive
    const sc=Math.abs(raw)>1?1/Math.abs(raw):1, slope=(jive>=0?.40:.28)*100;
    return{jive,rows:L.rows.map(r=>({key:r.key,label:r.label,val:r.val,pp:(r.d/base/dl)*sc*slope}))};
  }
  // which sliders actually made this theme feel like home (or like a chore)
  function jiveTraits(pl,themeId){
    const th=THEMES.find(t=>t.id===themeId); if(!th) return [];
    const p=persona(pl),out=[];
    for(const k in NEUTRAL){
      const probe=Object.assign({},p); probe[k]=5;
      let with_,without;try{with_=th.w(p);without=th.w(probe)}catch(e){continue}
      const d=with_-without; if(Math.abs(d)>.25) out.push({key:k,d});
    }
    return out.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,2);
  }
  // Tier risk tilts the roll RELATIVE to the average tier, never as a flat dock:
  // uncentred it put a systematic negative on every decision, which quietly broke
  // the near-even promise for a character with no strong opinions.
  const MEAN_RISK=TIERS.reduce((a,t)=>a+t.p*t.risk,0)/TIERS.reduce((a,t)=>a+t.p,0);
  const EVEN_G=.34, EVEN_N=.33;            // the no-opinion baseline: near-even thirds
  function bandOdds(jive,nudge){
    const j=cl(jive||0,-1,1);
    let g=cl(EVEN_G+j*(j>0?.40:.28)+(nudge||0),.04,.90);
    let n=cl(EVEN_N-Math.abs(j)*.11,.10,.40);
    if(g+n>.97)n=Math.max(.03,.97-g);
    return{g,n,r:Math.max(.03,1-g-n)};
  }
  // Modifier roll: JIVE sets the split, everything else nudges it -> GREEN
  // (full, boon chance), NEUTRAL (muted), or RED (backfires).
  function rollOutcome(pl,opt,rand,ctx){
    const prest=prestigeOf(pl);
    const trust=pl.coachTrust!=null?pl.coachTrust:50;
    const mom=pl.momentum103!=null?pl.momentum103:50;
    const compz=pl.composure103!=null?pl.composure103:50;
    const fatg=pl.conditionV11&&pl.conditionV11.fatigue||0;
    const hist=pl.growthHistV42=pl.growthHistV42||[];
    const streak=hist.filter(h=>h.card===opt.theme).length;
    const lastBad=hist.length&&hist[hist.length-1].sign<0;
    const jive=jiveOf(pl,opt.theme);
    const nudge=cl(-(opt.risk-MEAN_RISK)*.42
      +prest*.006
      +(trust-50)*.003
      +(mom-50)*.0015+(compz-50)*.0015-fatg*.003
      +cl(dial("luck",0)*.06,-.12,.12)+(lastBad?.05:0)+(streak>=2?.04:0)
      +(rand()-.5)*.10, -.22,.22);
    const odds=bandOdds(jive,nudge);
    const r2=rand();
    const band=r2<odds.g?"green":r2<odds.g+odds.n?"neutral":"red";
    let amt=opt.amt,sign=1,story;
    const NEU=["It helped... some. Life kept getting in the way.","Decent reps, nothing transformative.","You did the work on the easy days only."];
    const GOOD=["It clicked. Everyone can see the difference.","Best decision of the offseason - it shows on tape.","The work compounded week after week."];
    const BAD=["It backfired - bad habits, worn body, worse tape.","You forced it and paid for it.","The plan collapsed and took your rhythm with it."];
    if(band==="green"){story=GOOD[(rand()*3)|0];if(rand()<.22+prest*.006)amt=Math.min(10,amt+1)}
    else if(band==="neutral"){amt=Math.max(2,Math.round(amt*.45));story=NEU[(rand()*3)|0]}
    else{sign=-1;amt=Math.max(3,Math.round(amt*.75));story=BAD[(rand()*3)|0]}
    let tier=Object.assign({},opt.dur);
    if(sign>0&&prest>=8&&opt.tag==="ALL-IN")tier={seasons:2};
    if(sign<0&&prest>=8&&tier.seasons)tier={season:true};
    if(sign<0&&prest>=16)tier={games:5+(rand()*3|0)};
    const permanent=band==="green"&&opt.tag!=="LIGHT"&&rand()<(.1+prest*.008);
    if(streak>=2&&band==="green")story+=" (Habit formed - it runs deeper.)";
    if(lastBad&&band==="green")story+=" (Redemption.)";
    return{card:opt.theme,icon:opt.icon,name:opt.name,band,sign,stats:opt.stats,amt,tier,permanent,story,jive,odds,nudge,jiveTraits:jiveTraits(pl,opt.theme),fatigue:opt.fat?(band==="red"?opt.fat:Math.round(opt.fat/2)):0,ctx:ctx||"season",tag:opt.tag,fit:+opt.w.toFixed(1)}
  }
  function applyOutcome(pl,out){
    pl.growthFxV42=pl.growthFxV42||[];
    const fx={label:out.icon+" "+out.name,story:out.story,sign:out.sign,stats:out.stats,amt:out.amt,permanent:!!out.permanent&&out.sign>0,gamesLeft:out.tier.games||null,seasonsLeft:out.tier.seasons?out.tier.seasons:(out.tier.season?1:null),src:out.ctx};
    if(fx.permanent){fx.amt=1+Math.round(Math.random()*2);fx.gamesLeft=null;fx.seasonsLeft=null}   // small +1..3 forever
    pl.growthFxV42.push(fx);
    (pl.growthHistV42=pl.growthHistV42||[]).push({card:out.card,sign:out.sign,week:pl.currentWeek||0});
    pl.growthHistV42=pl.growthHistV42.slice(-12);
    if(out.fatigue&&pl.conditionV11)pl.conditionV11.fatigue=cl((pl.conditionV11.fatigue||0)+out.fatigue,0,60);
    try{window.__V153B&&window.__V153B.spin(pl,out)}catch(e){}   // v153 B: team cookouts / the captain's council warm the locker room
    try{window.I&&window.I()}catch(e){}
  }
  function compose(pl){
    if(!pl||!Array.isArray(pl.growthFxV42)||!pl.growthFxV42.length)return null;
    const soften=cl(dial("soften",0),0,3);
    const sum={};
    for(const fx of pl.growthFxV42){
      let a=fx.amt*(fx.sign<0?-1:1);
      if(a<0&&soften)a=Math.round(a*(1-soften*.25));                      // Settings: soften game-day debuffs
      for(const k of fx.stats)sum[k]=(sum[k]||0)+a;
    }
    return Object.keys(sum).filter(k=>sum[k]).map(k=>({stat:k,amt:sum[k],max:false}));
  }
  function seasonKey(pl){return(pl.level||0)+"-"+(pl.seasonsAtLevel||0)+"-"+(pl.seasonSeed||0)}
  // ---- wheel overlay (auto-rolled, personality-weighted) ----
  let showing=false;
  const durTxtOf=(t,perm)=>perm?"PERMANENT":t.games?t.games+" GAMES":t.seasons?t.seasons+" SEASONS":"THIS SEASON";
  /* ===== v50 SPIN WHEEL — a real wheel, cut by the character's personality =====
   * The old roll swept a highlight down a list and printed a % on each row. This
   * draws an actual wheel where each option's WEDGE ARC is its personality
   * weight, so the odds are the picture: a relentless, brash kid sees a fat
   * "Underground 7-on-7s" wedge and a sliver of "Mobility Mornings", and a
   * cerebral one sees the same wheel inverted. Nothing about the maths changed —
   * genOptions already weighted on persona — it is just finally visible.
   * The wheel still lands on the SEEDED pick, so a career replays identically;
   * the target angle is derived from that pick rather than from where a free
   * spin happened to stop. */
  /* v50.2 WHEEL PALETTE — deep jewel bases, lifted at draw time.
   * The first pass used flat mid-tones, which went muddy under a gold rim and
   * gave the face no depth. Each theme now carries ONE deep base; the wedge is
   * filled with a radial ramp built from it (bright near the hub, near-black at
   * the rim) so the wheel reads as a dished, lacquered surface instead of a pie
   * chart. One hex per theme keeps the hues honest — every tint and shade is
   * derived, so nothing can drift out of key. */
  const WCOL={iron:"#7d2f16",track:"#10456e",film:"#3a2668",hands:"#0f5b45",feet:"#7a5010",flex:"#17505f",
    mentor:"#5e4a0a",social:"#6b1a44",plyo:"#28571a",lab:"#331f7d",craft:"#78400f",edge:"#7d1a20"};
  const wcol=id=>WCOL[id]||"#2a3646";
  // scale a hex toward white (m>1) or black (m<1); `a` optionally makes it rgba
  function wshade(hex,m,a){
    const n=parseInt(String(hex).slice(1),16);
    const r=Math.min(255,Math.round((n>>16&255)*m)),g=Math.min(255,Math.round((n>>8&255)*m)),b=Math.min(255,Math.round((n&255)*m));
    return a==null?`rgb(${r},${g},${b})`:`rgba(${r},${g},${b},${a})`;
  }
  // the legend chips read against a dark card, so they use the lifted tint
  const wtint=id=>wshade(wcol(id),1.85);
  /* ===== v64 SKILL ART — the training themes get drawn, not typed =====
   * Every training theme carried an emoji: 🏋️ 💨 🎞️ 🧤 🪜 🧘 🎓 🎉 🦘 🧠 🎯 🔥. They
   * were doing real work — they are the only thing that told two options apart at a
   * glance — but an emoji is the platform's font, not the game's art. It renders
   * differently on every device, it sits in a different colour world from everything
   * around it, and at the size the wheel draws icons it is a blob.
   *
   * Twelve isometric scenes replace them, one per theme, from the uploaded sheets
   * (scripts/spritekit/pack_skills.mjs slices, keys the ground out and packs; the
   * cells are uniform so any theme can be drawn at any size with no per-icon table).
   * They are used in all four places a theme is named: the wheel face, the option
   * list, the roll pop-up's header and the result card.
   *
   * Nine of the twelve are depicted squarely. The three that are not — lab, mentor
   * and social, none of which has a scene of its own in the set — take the nearest
   * thing it offers, which is called out where the mapping lives so it is obvious
   * what to swap when art for them turns up. Everything falls back to the emoji if
   * the sheet never decodes, so a blocked image still leaves a readable wheel. */
  const RIB_META_SKILL = {"hands":[0,0,144,144],"feet":[144,0,144,144],"iron":[288,0,144,144],"film":[432,0,144,144],"flex":[0,144,144,144],"edge":[144,144,144,144],"track":[288,144,144,144],"social":[432,144,144,144],"craft":[0,288,144,144],"plyo":[144,288,144,144],"mentor":[288,288,144,144],"lab":[432,288,144,144]};
  /* v65 — the cell keys above are the WHEEL's theme ids, because the wheel is what
   * the sheets were packed for. The offseason "Choose Your Training" board is the
   * other place a season's training is chosen, and it has its own twelve keys, so
   * it addresses the cells through this alias table rather than being renamed to
   * match. Each program is matched to the scene that actually DEPICTS it, which is
   * why two of the pairings read oddly next to their key names: the program keyed
   * `lab` is the Recovery Lab, so it takes the ice-bath scene (packed as `social`),
   * and the program keyed `grind` is The Grind, so it takes the tyre-flip scene
   * (packed as `lab`). Twelve programs onto twelve scenes, one each — no picture
   * appears twice on a board that shows every program at once. */
  const SKILL_ALIAS = {
    tp_balanced: "hands",       // ball, dumbbell and playbook — the all-round program
    tp_speed: "track",          // starting blocks on the track
    tp_weight: "iron",          // the squat rack
    tp_film: "film",            // desk, playbook, chalkboard
    tp_skills: "craft",         // throwing at the target net
    tp_hops: "plyo",            // box jumps
    tp_conditioning: "mentor",  // stopwatch-timed resisted run
    tp_grind: "lab",            // tyre flip, and the sweat to go with it
    tp_yoga: "flex",            // the mat and the foam roller
    tp_contact: "edge",         // the collision
    tp_track: "feet",           // hurdles and cones
    tp_lab: "social"            // the ice bath
  };
  const skillKey = k => SKILL_ALIAS[k] || k;
  const SART = { img: null, ready: false, failed: false };
  (function () {
    try { skillCssVar(); } catch (e) {}
    const im = new Image();
    im.onload = () => { SART.ready = true; SART.img = im; try { skillCssVar(); } catch (e) {} };
    im.onerror = () => { SART.failed = true; console.warn("[v64] skill art failed to load — the themes fall back to their emoji") };
    im.src = window.__RIB_SKILL_V64 || window.__RIB_ASSET("rib_skill_v64.png");
  })();
  const SKILL_COLS = 4, SKILL_ROWS = 3;
  let SKILL_OFF = false;
  // debug surface for scripts/wheelcheck.mjs. `off` suppresses the art everywhere it
  // is used, so the check can A/B the same canvas against itself rather than hunt
  // for the scenes by colour — which of the twelve are on the wheel, and how much
  // grass and skin each one carries, changes with every draw.
  try {
    window.__SKILL_V64 = { cells: RIB_META_SKILL, alias: SKILL_ALIAS, get ready() { return SART.ready },
      get off() { return SKILL_OFF }, set off(v) { SKILL_OFF = !!v } };
  } catch (e) {}
  /* v65 — the icon rules used to live inside the wheel overlay's own <style>, which
   * meant they existed only while the wheel was open. The offseason training board
   * is rendered by the legacy career app, in a different scope and at a different
   * time, so the rules are hoisted into one document-level sheet here and the two
   * consumers reach the markup through the exports below. */
  (function () {
    if (document.getElementById("gv64css")) return;
    const st = document.createElement("style");
    st.id = "gv64css";
    st.textContent = ".gv64-ico{flex:0 0 auto;display:block;box-sizing:border-box;background-image:var(--skillArt);background-size:400% 300%;background-repeat:no-repeat;border-radius:10px;background-color:rgba(4,9,17,.55);box-shadow:inset 0 1px 0 #ffffff14,inset 0 0 0 1px #ffffff12,0 2px 5px rgba(0,0,0,.5)}"
      + ".gv64-emo{display:flex;align-items:center;justify-content:center;font-style:normal;background-image:none}"
      + ".gv64-body{flex:1 1 auto;min-width:0}"
      + ".gv64-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}"
      + ".gv64-name{font-weight:600;letter-spacing:.2px}"
      + ".gv64-l1{font-size:11px;color:#9fd08f;margin-top:2px}"
      + ".gv64-l2{font-size:9px;letter-spacing:1.5px;margin-top:2px}";
    (document.head || document.documentElement).appendChild(st);
  })();
  // the two consumers outside this scope: the legacy career app's training board
  // draws DOM rows, and anything on a canvas can blit a cell directly.
  try { window.RIB_SKILL_ICO = (k, e, px) => skillIco(k, e, px); window.RIB_SKILL_ART = sart; } catch (e) {}
  // canvas blit: one cell, centred on (ax, ay), at `size` square
  function sart(g, key, ax, ay, size) {
    const r = !SKILL_OFF && SART.ready && RIB_META_SKILL[skillKey(key)];
    if (!r) return false;
    g.drawImage(SART.img, r[0], r[1], r[2], r[3], ax - size / 2, ay - size / 2, size, size);
    return true;
  }
  // ...and the same cell addressed from CSS, so a DOM row can show it without a
  // canvas per option. One background image on the root, positioned per theme.
  function skillCssVar() {
    const src = window.__RIB_SKILL_V64 || window.__RIB_ASSET("rib_skill_v64.png");
    document.documentElement.style.setProperty("--skillArt", 'url("' + src + '")');
  }
  function skillCell(key) {
    const r = RIB_META_SKILL[skillKey(key)];
    // v65: a CSS background does not wait on our decode the way a canvas blit does,
    // so a DOM row only falls back when the sheet has actually failed. Gating this
    // on SART.ready instead raced the training board, which can render on the same
    // tick as page load and would have shown emoji for the one frame that mattered.
    if (!r || SKILL_OFF || SART.failed) return null;
    const cx = r[0] / r[2], cy = r[1] / r[3];
    return { x: (cx / (SKILL_COLS - 1) * 100).toFixed(3) + "%", y: (cy / (SKILL_ROWS - 1) * 100).toFixed(3) + "%" };
  }
  // the markup for a theme's icon in a DOM row — art when it decoded, the emoji it
  // replaced when it did not
  function skillIco(key, emoji, px) {
    const c = skillCell(key);
    const sz = px || 44;
    if (!c) return `<i class="gv64-ico gv64-emo" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .52)}px">${emoji || ""}</i>`;
    // no padding here: the hold-off from the plate's corner radius is the atlas's own
    // 9% gutter, which has to exist anyway so a CSS background cannot sample the
    // next cell's art. Insetting again here would only shrink the scene twice.
    return `<i class="gv64-ico" style="width:${sz}px;height:${sz}px;background-position:${c.x} ${c.y}"></i>`;
  }
  /* ===== v66 PLAN ART — the weekly game plans get drawn too =====
   * v51 moved the pregame decision onto the shared wheel but left its wedges
   * carrying the platform emoji the training themes had before v64: 📋 🛡️ 🎯 ⚡ 🧊
   * 🎬 🛌 🕵️ 🎯 💪 — and two of those are literally the same glyph. This is the
   * decision the player meets EVERY week, so it is the worst surface in the game
   * for icons that do not tell the options apart.
   *
   * Ten isometric scenes replace them, one per plan in the weekly deck, drawn in
   * the same world as the v64 training scenes (scripts/spritekit/pack_plans.mjs
   * keys the ground out and packs; the cells are uniform, so any plan can be blit
   * at any size with no per-icon table). Unlike v64 there is no near-fit to call
   * out — every plan in the deck has a scene of its own and the mapping, which
   * lives in `SRC` in the packer, is one-to-one.
   *
   * The consumers are the same two v64 has: the wheel FACE (a canvas blit, `part`)
   * and the option ROWS / roll pop-up header (a CSS background, `planIco`). The
   * cells stay their own atlas rather than folding into the skill sheet because
   * plan ids and theme ids are separate namespaces — keeping the sheets apart is
   * what guarantees a training theme can never draw a plan's scene, or the reverse.
   * Everything falls back to the emoji when the sheet has not decoded. */
  const RIB_META_PLAN = {"explosive":[0,0,176,176],"recovery":[176,0,176,176],"redzone":[352,0,176,176],"enforcer":[528,0,176,176],"shadow":[0,176,176,176],"team":[176,176,176,176],"filmgrind":[352,176,176,176],"disciplined":[528,176,176,176],"feature":[0,352,176,176],"recover":[176,352,176,176]};
  const PART = { img: null, ready: false, failed: false };
  (function () {
    try { planCssVar(); } catch (e) {}
    const im = new Image();
    im.onload = () => { PART.ready = true; PART.img = im; try { planCssVar(); } catch (e) {} };
    im.onerror = () => { PART.failed = true; console.warn("[v66] plan art failed to load — the plans fall back to their emoji") };
    im.src = window.__RIB_PLAN_V66 || window.__RIB_ASSET("rib_plan_v66.png");
  })();
  const PLAN_COLS = 4, PLAN_ROWS = 3;
  let PLAN_ART_OFF = false;
  // debug surface for scripts/wheelcheck.mjs, same contract as __SKILL_V64: `off`
  // suppresses the art everywhere it is used so a check can A/B one canvas against
  // itself instead of hunting the scenes by colour.
  try {
    window.__PLAN_ART_V66 = { cells: RIB_META_PLAN, get ready() { return PART.ready },
      get off() { return PLAN_ART_OFF }, set off(v) { PLAN_ART_OFF = !!v } };
  } catch (e) {}
  // one extra rule on top of the v65 document-level sheet: the plate, the radius and
  // the 4x3 background-size are identical, only the image differs.
  (function () {
    if (document.getElementById("gv66css")) return;
    const st = document.createElement("style");
    st.id = "gv66css";
    st.textContent = ".gv66-ico{background-image:var(--planArt)}";
    (document.head || document.documentElement).appendChild(st);
  })();
  try { window.RIB_PLAN_ICO = (k, e, px) => planIco(k, e, px); window.RIB_PLAN_ART = part; } catch (e) {}
  // canvas blit: one cell, centred on (ax, ay), at `size` square
  function part(g, key, ax, ay, size) {
    const r = !PLAN_ART_OFF && PART.ready && RIB_META_PLAN[key];
    if (!r) return false;
    g.drawImage(PART.img, r[0], r[1], r[2], r[3], ax - size / 2, ay - size / 2, size, size);
    return true;
  }
  function planCssVar() {
    const src = window.__RIB_PLAN_V66 || window.__RIB_ASSET("rib_plan_v66.png");
    document.documentElement.style.setProperty("--planArt", 'url("' + src + '")');
  }
  function planCell(key) {
    const r = RIB_META_PLAN[key];
    // as in v65: a CSS background does not wait on our decode, so a DOM row only
    // falls back once the sheet has actually failed
    if (!r || PLAN_ART_OFF || PART.failed) return null;
    const cx = r[0] / r[2], cy = r[1] / r[3];
    return { x: (cx / (PLAN_COLS - 1) * 100).toFixed(3) + "%", y: (cy / (PLAN_ROWS - 1) * 100).toFixed(3) + "%" };
  }
  function planIco(key, emoji, px) {
    const c = planCell(key);
    const sz = px || 44;
    if (!c) return `<i class="gv64-ico gv64-emo" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .52)}px">${emoji || ""}</i>`;
    return `<i class="gv64-ico gv66-ico" style="width:${sz}px;height:${sz}px;background-position:${c.x} ${c.y}"></i>`;
  }
  /* v50 WHEEL ART — the drawn hardware. Unlike the player/ref atlases this one is
   * NOT a uniform cell grid (a 256px rim and a 56px icon in one grid wastes most
   * of the sheet), so the cellmap is rect-based and shelf-packed. Built by
   * scripts/spritekit/pack_wheel.mjs, inlined by bake_wheel.mjs. Every draw falls
   * back to the procedural shape it replaces, so a sheet that never decodes still
   * gives a complete, readable wheel. */
  const RIB_META_WHEEL = {"rim":[0,0,256,255,128,0],"hub":[258,0,72,72,36,0],"ptr0":[332,0,33,64,16,0],"ptr1":[367,0,63,64,19,0],"ptr2":[432,0,64,37,19,0],"ptr3":[0,257,64,62,45,0],"th_iron":[66,257,56,29,28,0],"th_track":[124,257,56,33,28,0],"th_film":[182,257,56,51,25,0],"th_hands":[240,257,56,48,26,0],"th_feet":[298,257,56,44,29,0],"th_flex":[356,257,56,44,34,0],"th_mentor":[414,257,50,56,20,0],"th_social":[0,321,56,48,26,0],"th_plyo":[58,321,52,56,27,0],"th_lab":[112,321,56,51,28,0],"th_craft":[170,321,56,53,32,0],"th_edge":[228,321,47,56,28,0],"seal_green":[277,321,55,56,27,0],"seal_neutral":[334,321,56,56,27,0],"seal_red":[392,321,55,56,27,0],"up_ball":[449,321,48,40,26,0],"dn_ball":[0,379,48,41,25,0]};
  const WART={img:null,ready:false};
  (function(){const im=new Image();
    im.onload=()=>{WART.img=im;WART.ready=true};
    im.onerror=()=>console.warn("[v50] wheel art failed to load — procedural wheel stands in");
    im.src=window.__RIB_WHEEL_V50||window.__RIB_ASSET("rib_wheel_v50.png")})();
  // Blit a named rect at a size, centred — or anchored on its recorded PIVOT,
  // which for the pointer frames is the mounting bracket. Anchoring the flapper
  // by its centre makes it jump sideways as it deflects; by its bracket it turns.
  // Returns false when the art is missing so the caller can draw its own shape.
  function wart(g,name,ax,ay,size,byPivot){
    const r=WART.ready&&RIB_META_WHEEL[name]; if(!r) return false;
    const sc=size/Math.max(r[2],r[3]),w=r[2]*sc,h=r[3]*sc;
    g.drawImage(WART.img,r[0],r[1],r[2],r[3],
      byPivot?ax-(r[4]==null?r[2]/2:r[4])*sc:ax-w/2,
      byPivot?ay-(r[5]||0)*sc:ay-h/2, w,h);
    return true;
  }
  // The flapper frames, ordered by how far they are deflected. Frames whose
  // bracket sits on the RIGHT sweep the other way and belong to a wheel turning
  // the other direction, so they are dropped rather than jammed into the ramp.
  const PTR_FRAMES=(()=>{
    const ns=["ptr0","ptr1","ptr2","ptr3"].filter(n=>{const r=RIB_META_WHEEL[n];return r&&(r[4]==null||r[4]/r[2]<=.55)});
    return ns.sort((a,b)=>(RIB_META_WHEEL[a][2]/RIB_META_WHEEL[a][3])-(RIB_META_WHEEL[b][2]/RIB_META_WHEEL[b][3]));
  })();
  // which wedge is under the pointer right now — one source of truth for the
  // icon pop, the legend highlight and the landing check
  function liveWedge(opts,tot,rot){
    const ang=((-rot)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    let acc=0;
    for(let i=0;i<opts.length;i++){const sp=opts[i].w/tot*Math.PI*2;if(ang>=acc&&ang<acc+sp)return i;acc+=sp}
    return 0;
  }
  /* ===== v61 WHEEL FINISH — dark machined metal, not fairground gold =====
   * The v50 sheet's hardware is a cast gold ring with cabochon studs, a gold
   * football boss and a matching gold spike. On this app's near-black cards it
   * reads as a prize wheel bolted onto a broadcast UI — heavy, bright, and
   * spending a third of the disc on rim instead of on the odds the wheel exists
   * to show.
   *
   * The hardware is drawn now instead of blitted: a slim graphite ring with the
   * anisotropic sweep turned metal actually has, a machined hub, and a blade
   * pointer. Two things follow. The rim is a fifth the thickness, so the FACE
   * gets the space back — Rw goes 0.74R to 0.90R and the wedges, which are the
   * whole point, are half again as large. And every bright element is now a
   * specular highlight on dark metal rather than a fill, so the wheel sits down
   * into the page instead of glowing off it.
   *
   * The wedge HUES are untouched. Each arc is its option's personality weight, so
   * the face is only re-lit, never recoloured: the ramp is pulled further toward
   * black and the colour survives as sheen on a lacquered surface.
   * scripts/wheelcheck.mjs ring-samples that face by hue at 0.30R and would catch
   * any drift. The gold set is still in the sheet — TU("wheelArtHardware",0) = 1
   * puts it back. */
  // A conic sweep is what separates turned metal from a grey ring: the highlight
  // wraps the circumference instead of running across it. Older canvases have no
  // conic gradient, hence the caller's linear fallback.
  function wconic(g,cx,cy,stops){
    if(typeof g.createConicGradient!=="function")return null;
    const cg=g.createConicGradient(-Math.PI/2,cx,cy);
    for(const s of stops)cg.addColorStop(s[0],s[1]);
    return cg;
  }
  const WSWEEP=[[0,"rgba(232,241,255,.34)"],[.07,"rgba(232,241,255,.02)"],[.19,"rgba(232,241,255,.24)"],
    [.3,"rgba(232,241,255,.01)"],[.44,"rgba(232,241,255,.1)"],[.5,"rgba(232,241,255,.4)"],
    [.57,"rgba(232,241,255,.08)"],[.7,"rgba(232,241,255,.01)"],[.81,"rgba(232,241,255,.22)"],
    [.93,"rgba(232,241,255,.02)"],[1,"rgba(232,241,255,.34)"]];
  function wsweep(g,cx,cy,r){
    const cg=wconic(g,cx,cy,WSWEEP);
    if(cg){g.fillStyle=cg}
    else{const lg=g.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
      lg.addColorStop(0,"rgba(232,241,255,.3)");lg.addColorStop(.5,"rgba(232,241,255,.02)");
      lg.addColorStop(1,"rgba(232,241,255,.22)");g.fillStyle=lg}
    g.fillRect(cx-r,cy-r,r*2,r*2);
  }
  // the ring itself: a bevelled cross-section (dark shoulder, lit crown, dark
  // shoulder) with the sweep over it, then the two machined hairlines that make
  // an edge look cut rather than drawn
  function wrim(g,cx,cy,rOut,rIn){
    g.save();
    g.beginPath();g.arc(cx,cy,rOut,0,Math.PI*2);g.arc(cx,cy,rIn,0,Math.PI*2,true);g.clip();
    // cross-section: dark shoulder, lit crown, dark shoulder. Tight stops — a soft
    // ramp across a thin ring is what makes drawn metal read as plastic.
    const bg=g.createRadialGradient(cx,cy,rIn,cx,cy,rOut);
    bg.addColorStop(0,"#04060a");bg.addColorStop(.16,"#171b22");bg.addColorStop(.38,"#2e3540");
    bg.addColorStop(.6,"#12161c");bg.addColorStop(.86,"#1f242c");bg.addColorStop(1,"#030508");
    g.fillStyle=bg;g.fillRect(cx-rOut,cy-rOut,rOut*2,rOut*2);
    // one key light across the upper left, so the ring has a light source and not
    // only a circumferential sweep. It goes down BEFORE the sweep — over it, the
    // broad ramp washes the specular lobes flat and the ring reads as plastic.
    const kl=g.createLinearGradient(cx-rOut,cy-rOut,cx+rOut*.3,cy+rOut*.5);
    kl.addColorStop(0,"rgba(255,255,255,.14)");kl.addColorStop(.45,"rgba(255,255,255,.01)");
    kl.addColorStop(1,"rgba(0,0,0,.3)");
    g.fillStyle=kl;g.fillRect(cx-rOut,cy-rOut,rOut*2,rOut*2);
    wsweep(g,cx,cy,rOut);
    // turned finish: concentric micro-lines, the tool marks a machined ring keeps
    g.strokeStyle="rgba(0,0,0,.16)";g.lineWidth=1;
    for(let rr=rIn+2;rr<rOut-1;rr+=2.5){g.beginPath();g.arc(cx,cy,rr,0,Math.PI*2);g.stroke()}
    g.restore();
    g.lineWidth=1;
    g.beginPath();g.arc(cx,cy,rIn+.75,0,Math.PI*2);g.strokeStyle="rgba(214,228,250,.42)";g.stroke();
    g.beginPath();g.arc(cx,cy,rOut-.75,0,Math.PI*2);g.strokeStyle="rgba(176,194,222,.3)";g.stroke();
    g.beginPath();g.arc(cx,cy,rIn-1,0,Math.PI*2);g.strokeStyle="rgba(0,0,0,.92)";g.lineWidth=2;g.stroke();
    g.beginPath();g.arc(cx,cy,rOut+1.5,0,Math.PI*2);g.strokeStyle="rgba(0,0,0,.5)";g.lineWidth=3;g.stroke();
  }
  function whub(g,cx,cy,r){
    g.beginPath();g.arc(cx,cy,r*1.06,0,Math.PI*2);g.fillStyle="rgba(0,0,0,.55)";g.fill();   // seat shadow
    const bg=g.createRadialGradient(cx-r*.34,cy-r*.4,r*.06,cx,cy,r);
    bg.addColorStop(0,"#454d59");bg.addColorStop(.5,"#1b2027");bg.addColorStop(1,"#070910");
    g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fillStyle=bg;g.fill();
    g.save();g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.clip();wsweep(g,cx,cy,r);g.restore();
    g.lineWidth=1;
    g.beginPath();g.arc(cx,cy,r-.5,0,Math.PI*2);g.strokeStyle="rgba(206,220,242,.30)";g.stroke();
    g.beginPath();g.arc(cx,cy,r*.46,0,Math.PI*2);g.fillStyle="#04060b";g.fill();
    g.strokeStyle="rgba(150,170,200,.26)";g.stroke();
  }
  // A blade, mounted above the rim and hanging into the face. It deflects with the
  // wheel's speed and settles upright as it stops — the drawn frames did that with
  // four gold sprites; one rotation does it with none.
  function wblade(g,cx,cy,rTop,len,defl){
    g.save();g.translate(cx,cy-rTop);g.rotate(defl);
    const w=Math.max(6,len*.4);
    g.beginPath();g.moveTo(0,len);g.lineTo(-w/2,len*.2);g.lineTo(-w*.42,-len*.3);
    g.lineTo(w*.42,-len*.3);g.lineTo(w/2,len*.2);g.closePath();
    const lg=g.createLinearGradient(-w/2,0,w/2,0);
    lg.addColorStop(0,"#dbe4f2");lg.addColorStop(.3,"#8d97a6");lg.addColorStop(.56,"#2a3038");lg.addColorStop(1,"#0b0e13");
    g.fillStyle=lg;g.fill();
    g.strokeStyle="rgba(0,0,0,.85)";g.lineWidth=1;g.stroke();
    g.beginPath();g.arc(0,-len*.14,w*.36,0,Math.PI*2);                       // the mount it pivots on
    const mb=g.createLinearGradient(-w*.36,0,w*.36,0);
    mb.addColorStop(0,"#4a5361");mb.addColorStop(.6,"#161b22");mb.addColorStop(1,"#070a0e");
    g.fillStyle=mb;g.fill();g.strokeStyle="rgba(214,228,250,.4)";g.lineWidth=1;g.stroke();
    g.restore();
  }
  function drawWheel(cv,opts,tot,rot,winIdx,landed,spd){
    const g=cv.getContext("2d"),W=cv.width,H=cv.height,cx=W/2,cy=H/2,R=Math.min(cx,cy)-4;
    // v61: the drawn ring is slim, so the face keeps almost the whole disc. The
    // gold sheet's rim is a third of the radius, hence the much smaller Rw when
    // wheelArtHardware puts it back.
    const ART=TU("wheelArtHardware",0)>0&&WART.ready&&RIB_META_WHEEL.rim;
    const Rw=ART?R*.74:R*.915;
    const live=landed?winIdx:liveWedge(opts,tot,rot);
    g.clearRect(0,0,W,H);
    // the face sits on near-black, so an un-filled gap never flashes light
    g.beginPath();g.arc(cx,cy,Rw,0,Math.PI*2);g.fillStyle="#04060b";g.fill();
    let a=-Math.PI/2+rot;
    opts.forEach((o,i)=>{
      const span=o.w/tot*Math.PI*2,dim=landed&&i!==winIdx,hot=i===live;
      const base=o.col||wcol(o.theme);
      g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,Rw,a,a+span);g.closePath();
      // radial ramp: lit near the hub, falling to near-black at the rim. The
      // live wedge burns a stop brighter rather than getting a white wash, which
      // used to grey the colour out just as it mattered most.
      // v61: the same ramp, taken down a stop. On a graphite rim the old lift read
      // as poster paint; darker, the face reads as black lacquer with the theme's
      // colour surviving as its sheen. Uniform scaling, so every hue is exactly
      // where it was — which is what the dev check ring-samples for.
      const lift=hot?(landed?1.5:1.3):1, gr=g.createRadialGradient(cx,cy,Rw*.12,cx,cy,Rw);
      gr.addColorStop(0,wshade(base,.92*lift));
      gr.addColorStop(.55,wshade(base,.54*lift));
      gr.addColorStop(1,wshade(base,dim?.12:.2*lift));
      g.fillStyle=gr;g.fill();
      if(dim){g.fillStyle="rgba(3,6,11,.6)";g.fill()}   // dim by DARKENING, never by fading to the page
      g.strokeStyle="rgba(0,0,0,.7)";g.lineWidth=1;g.stroke();
      if(hot){                                           // a clean bright edge on the live wedge
        g.beginPath();g.arc(cx,cy,Rw-1.5,a,a+span);
        g.strokeStyle=wshade(base,3.4,.92);g.lineWidth=1.5;g.stroke();
      }
      // The icon rides the wedge, upright, and only if the wedge can hold it.
      // v50.1: the wedge the pointer is over pops — the icon grows and rides
      // slightly outward, so you feel the pointer tick across the wheel instead
      // of just watching it turn.
      if(span>.34){const m=a+span/2,r=Rw*(hot?.68:.64),ix=cx+Math.cos(m)*r,iy=cy+Math.sin(m)*r;
        const sz=hot?TU("wheelIconPop",30):24;
        g.save();g.globalAlpha=dim?.6:1;
        // v64 scene art, then the old 56px theme cell, then the emoji it replaced.
        // `skill` is set only by the training wheel, so the pregame plans — whose
        // keys are plan ids, not theme ids — can never match a training scene.
        // A scene needs room to read and it needs to sit off the wedge colour, so it
        // is drawn larger than the emoji ever was and on its own soft shadow — a
        // wedge is a saturated field, and isometric art on a saturated field
        // disappears into it.
        if((!SKILL_OFF&&SART.ready&&RIB_META_SKILL[o.skill])||(!PLAN_ART_OFF&&PART.ready&&RIB_META_PLAN[o.plan])){
          const rr=sz*.86, sh=g.createRadialGradient(ix,iy+rr*.16,rr*.15,ix,iy+rr*.16,rr);
          sh.addColorStop(0,"rgba(3,6,12,.52)");sh.addColorStop(.62,"rgba(3,6,12,.3)");sh.addColorStop(1,"rgba(3,6,12,0)");
          g.fillStyle=sh;g.beginPath();g.arc(ix,iy+rr*.16,rr,0,Math.PI*2);g.fill();
        }
        if(!sart(g,o.skill,ix,iy,sz*TU("wheelSkillPx",2.19))&&!part(g,o.plan,ix,iy,sz*TU("wheelSkillPx",2.19))&&!wart(g,o.art||("th_"+o.theme),ix,iy,sz)){
          g.font=(hot?sz-6:17)+"px system-ui";g.textAlign="center";g.textBaseline="middle";g.fillText(o.icon,ix,iy)}
        g.restore();g.globalAlpha=1}
      a+=span;
    });
    // depth pass: a vignette sinks the outer edge, and a soft sheen across the
    // upper-left reads as lacquer. The sheen is clipped to the OUTER half so the
    // inner band stays a flat per-wedge colour — that band is what the dev check
    // ring-samples to prove the arcs match the personality weights.
    const vg=g.createRadialGradient(cx,cy,Rw*.4,cx,cy,Rw);
    vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.7)");
    g.beginPath();g.arc(cx,cy,Rw,0,Math.PI*2);g.fillStyle=vg;g.fill();
    g.save();
    g.beginPath();g.arc(cx,cy,Rw,0,Math.PI*2);g.arc(cx,cy,Rw*.55,0,Math.PI*2,true);g.clip();
    const sh=g.createLinearGradient(cx-Rw,cy-Rw,cx+Rw*.4,cy+Rw*.6);
    sh.addColorStop(0,"rgba(214,230,255,.1)");sh.addColorStop(.5,"rgba(214,230,255,.015)");sh.addColorStop(1,"rgba(214,230,255,0)");
    g.fillStyle=sh;g.fillRect(cx-Rw,cy-Rw,Rw*2,Rw*2);
    g.restore();
    // ---- hardware. Drawn over the wedge edges so the wheel reads as one object.
    if(ART){
      wart(g,"rim",cx,cy,R*2);
      if(!wart(g,"hub",cx,cy,Rw*.42)) whub(g,cx,cy,Rw*.2);
      const pf=PTR_FRAMES.length?PTR_FRAMES[landed?0:Math.min(PTR_FRAMES.length-1,Math.round((spd||0)*(PTR_FRAMES.length-1)))]:null;
      if(!pf||!wart(g,pf,cx,cy-R+3,R*.34,true)) wblade(g,cx,cy,Rw+(R-Rw)*.5,R*.2,0);
    } else {
      wrim(g,cx,cy,R,Rw);
      whub(g,cx,cy,Rw*.17);
      // the blade hangs from the ring into the face, and is pushed back by the
      // spin — the same deflection the gold flapper's four frames used to fake
      wblade(g,cx,cy,R*.93,R*.26,-(landed?0:Math.min(1,spd||0))*TU("wheelBladeKick",.38));
    }
  }
  /* ===== v51 SHARED SPIN — one wheel, two callers =====
   * The wheel was welded to the growth decision, so the surface the player sees
   * most — the PREGAME plan — had no wheel at all (v41 deleted its panel and
   * auto-picked in silence). This is the presentation split out: it knows about
   * wedges, spinning, the fit strip and the result card, and nothing about where
   * the options came from. `showWheel` below and the v51 pregame block both feed
   * it the same shape. */
  /* v135: a wheel can be mounted INTO a page (the pregame's fifth page) instead of over it —
   * `cfg.host` (or `inlineHostV135`, set by showWheelIn for the story wheel) puts the same
   * markup, with the same id, inside that element with no fixed backdrop; the roll pop-up still
   * covers the viewport, and its CONTINUE closes only the pop-up, leaving the landed wheel and
   * the result card standing on the page. */
  let inlineHostV135=null,retiredV136=0;
  function showWheelIn(host,pl,ctx,title,onDone){inlineHostV135=host||null;try{showWheel(pl,ctx,title,onDone)}finally{inlineHostV135=null}return !!(host&&host.querySelector("#growthV42"))}
/* ===== v139 A BEAT BEFORE THE WHEEL =====
 * The season's commitment wheel came up on its own 650ms after the season started and span
 * itself: the single roll that decides how you live the whole year happened while you were still
 * reading the training board. `cfg.gate` puts one beat in front of it — the wheel is built and
 * drawn, then hidden behind a card that asks, and the wheel starts when you say so.
 *
 * The button carries the wheel's OWN id (`gv42go`), and the gate removes itself before the roll
 * pop-up makes its own, so there is never two of it — and everything that drives this wheel by
 * tapping `#gv42go` until the overlay is gone keeps working, one extra tap at the front. */
/* ===== v139 THE LUNGE HAS A SIZE =====
 * Every committed tackle leapt exactly 17px, whether it was a linebacker closing at full speed from
 * eight yards or a lineman falling forward onto a back who ran into him. The leap is the lunge's OWN
 * force now — the closing momentum and the impact the sim already put on the event — so a hit you can
 * hear looks like one and a wrap looks like a wrap. It is a free function so a check can measure the
 * curve without standing a broadcast up. */
window.__V139 = window.__V139 || {};
window.__V139.lunge = function (e) {
  e = e || {};
  const mom = Math.max(0, Number(e.dMom) || 0), imp = Math.max(0, Number(e.impact) || 0);
  const k = Math.min(1, (mom / Math.max(1, TU("lungeMomRefV139", 150))) * .6 + (imp / Math.max(1, TU("impactShakeRef", 90))) * .4);
  const hMin = TU("lungeHMinV139", 11), hMax = TU("lungeHMaxV139", 30);
  const mMin = TU("lungeMsMinV139", 360), mMax = TU("lungeMsMaxV139", 440);   /* the old flat 400, give or take — the HEIGHT is what carries the force */
  return { h: hMin + (hMax - hMin) * k, ms: Math.round(mMin + (mMax - mMin) * k), k: +k.toFixed(3) };
};
function gateV139(root,cfg,go,DS){
  if(!cfg||!cfg.gate||!root)return false;
  const card=root.firstElementChild;if(!card)return false;
  card.style.display="none";
  root.insertAdjacentHTML("afterbegin",`<div id="gv139gate" style="max-width:440px;width:100%;background:linear-gradient(180deg,#152238,#0a111c);border:1px solid rgba(240,187,69,.45);border-radius:16px;padding:18px 15px;font-family:Oswald,sans-serif;color:#e8ecf2;text-align:center">
    <div style="font-size:10px;letter-spacing:3px;color:#f0bb45">${cfg.title||""}</div>
    <div style="font-size:21px;font-weight:700;margin:7px 0 9px;line-height:1.15">Ready to roll for your career focus?</div>
    <div style="font-size:13px;color:#c6cdd8;line-height:1.45">${cfg.gate}</div>
    <button id="gv42go" style="width:100%;margin-top:14px;padding:12px;border:0;border-radius:9px;background:linear-gradient(180deg,#ffd76f,#daa128);font:700 15px Oswald;color:#1a1206">ROLL IT \u203A</button>
  </div>`);
  const g=document.getElementById("gv139gate"),b=g&&g.querySelector("#gv42go");
  if(!g||!b){g&&g.remove();card.style.display="";return false}
  b.onclick=()=>{g.remove();card.style.display="";(DS&&DS.wait?DS.wait(250,go):setTimeout(go,250))};
  return true}
  function spinWheel(cfg){
    if(showing&&!document.getElementById("growthV42"))showing=false;   // self-heal a torn-out overlay
    if(showing||document.getElementById("growthV42"))return false;
    const opts=cfg.opts||[];if(opts.length<2)return false;
    const host=cfg.host||inlineHostV135||null;
    showing=true;
    const idx=Math.max(0,Math.min(opts.length-1,cfg.pick|0));
    const tot=opts.reduce((s,o)=>s+o.w,0)||1;
    const DS=window.__DECIDE_SPEED_V50||{wait:(ms,fn)=>setTimeout(fn,ms),ms:v=>v,arm(){return this},disarm(){return this},rate:1};
    const F=cfg.fit,R=cfg.result;
    const rows=opts.map((o,i)=>`<div class="gv42-opt" data-i="${i}" style="border-left:4px solid ${wshade(o.col||"#2a3646",1.85)}">
      ${o.skill?skillIco(o.skill,o.icon,44):o.plan?planIco(o.plan,o.icon,44):""}
      <div class="gv64-body">
        <div class="gv64-top"><b class="gv64-name">${o.skill||o.plan?"":(o.icon||"")+" "}${o.name}</b><em>${Math.round(o.w/tot*100)}%</em></div>
        ${o.line1?`<div class="gv64-l1">${o.line1}</div>`:""}
        ${o.line2?`<div class="gv64-l2" style="color:${o.line2col||"#8fa2bb"}">${o.line2}</div>`:""}
      </div></div>`).join("");
    const od=(F&&F.odds)||{g:.34,n:.33,r:.33};
    const fitHtml=F?`<div id="gv50fit" style="display:none;margin-top:10px;padding:10px;border:1px solid #ffffff1f;border-radius:10px;background:rgba(255,255,255,.03)">
        <div style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:2px;color:#f0bb45">
          <span>FIT ROLL · DOES IT SUIT YOU?</span><span id="gv50jv" style="color:${F.jive>=.12?"#6fe08a":F.jive<=-.12?"#ff8a80":"#8fa2bb"}">JIVE ${F.jive>=0?"+":"−"}${Math.abs(Math.round(F.jive*100))}</span></div>
        <div style="height:7px;border-radius:4px;margin:6px 0 4px;overflow:hidden;display:flex">
          <i style="flex:${Math.round(od.g*100)};background:#6fe08a"></i><i style="flex:${Math.round(od.n*100)};background:#8b939f"></i><i style="flex:${Math.round(od.r*100)};background:#ff8a80"></i></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#8fa2bb">
          <span style="color:#6fe08a">PAYS ${Math.round(od.g*100)}%</span><span>HALF ${Math.round(od.n*100)}%</span><span style="color:#ff8a80">BACKFIRES ${Math.round(od.r*100)}%</span></div>
        <div style="font-size:11px;color:#c6cdd8;margin-top:5px">${F.why||""}</div>
        <div style="display:flex;justify-content:space-between;font-size:9px;letter-spacing:1.5px;color:#8fa2bb;margin-top:5px;padding-top:5px;border-top:1px solid #ffffff12">
          <span>PERSONALITY FIT <b style="color:${F.jive>=0?"#6fe08a":"#ff8a80"}">${F.jive>=0?"+":"−"}${Math.abs(Math.round(F.jive*100))}</b></span>
          <span>RISK &amp; FORM <b style="color:${(F.nudge||0)>=0?"#6fe08a":"#ff8a80"}">${(F.nudge||0)>=0?"+":"−"}${Math.abs(Math.round((F.nudge||0)*100))}</b></span></div>
      </div>`:"";
    const resHtml=R?`<div id="gv42out" style="display:none;margin-top:10px;padding:11px;border-radius:10px;position:relative">
        <canvas id="gv50seal" width="46" height="46" style="position:absolute;top:9px;right:9px;width:46px;height:46px"></canvas>
        <b style="font-size:15px;display:block;padding-right:52px">${R.headline}</b>
        <div style="font-size:13px;color:#c6cdd8;margin:5px 0">${R.story||""}</div>
        <div style="font-size:13px;color:${R.band==="green"?"#6fe08a":R.band==="neutral"?"#cfd6a8":"#ff8a80"}">${R.lines||""}</div>
        ${R.dur?`<div style="font-size:10px;letter-spacing:2px;color:#f0bb45;margin-top:5px">${R.dur}</div>`:""}
      </div>`:"";
    (host||document.body).insertAdjacentHTML("beforeend",`<div id="growthV42" data-inline="${host?1:0}" style="${host?"position:relative;display:flex;justify-content:center;padding:0":"position:fixed;inset:0;z-index:960;background:rgba(3,7,13,.9);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto"}"><div style="max-width:440px;width:100%;background:linear-gradient(180deg,#152238,#0a111c);border:1px solid rgba(240,187,69,.45);border-radius:16px;padding:15px;font-family:Oswald,sans-serif;color:#e8ecf2">
      <div style="font-size:10px;letter-spacing:3px;color:#f0bb45">${cfg.title||""}</div>
      <div style="font-size:18px;font-weight:700;margin:3px 0 9px">${cfg.sub||""}</div>
      <div style="display:flex;justify-content:center"><canvas id="gv50wheel" width="268" height="268" style="width:min(268px,72vw);height:auto;touch-action:manipulation"></canvas></div>
      <div id="gv50hint" class="ds50-hint">tap to speed up ▸▸</div>
      ${fitHtml}
      <div id="gv42opts" style="margin-top:9px">${rows}</div>
      ${F?"":resHtml}
      ${F?"":`<button id="gv42go" style="display:none;width:100%;margin-top:11px;padding:11px;border:0;border-radius:9px;background:linear-gradient(180deg,#ffd76f,#daa128);font:700 15px Oswald;color:#1a1206">CONTINUE</button>`}
      <style>.gv42-opt{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #ffffff14;border-radius:10px;margin-top:6px;font-size:14px;transition:border-color .14s,background .14s,transform .14s}.gv42-opt em{font-style:normal;color:#8fa2bb;font-size:12px;font-variant-numeric:tabular-nums}
      /* .gv64-* now live in the document-level #gv64css sheet (v65) */
      .gv42-opt.on{border-color:#f0bb45;background:rgba(240,187,69,.14);transform:scale(1.02)}.gv42-opt.g{border-color:#57e07a;background:rgba(60,150,84,.2)}.gv42-opt.n{border-color:#9aa4b2;background:rgba(140,150,165,.16)}.gv42-opt.r{border-color:#ff8a80;background:rgba(150,60,60,.2)}</style>
    </div></div>`);
    try{window.__WHEEL_V50_LAST={themes:opts.map(o=>o.key||o.name),want:opts.map(o=>o.w/tot),win:idx,
      cols:opts.map(o=>o.col||wcol(o.theme))}}catch(e){}
    const root=document.getElementById("growthV42"),cv=document.getElementById("gv50wheel");
    const nodes=[...document.querySelectorAll("#growthV42 .gv42-opt")];
    DS.arm(root,document.getElementById("gv50hint"));
    let off=0;for(let i=0;i<idx;i++)off+=opts[i].w/tot*Math.PI*2;
    const target=Math.PI*2*(4+((cfg.turns||0)%2))-(off+opts[idx].w/tot*Math.PI);
    const RM=(()=>{try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}})();
    const SPIN=RM?260:2600;                  // reduced motion still lands, it just does not sweep
    let done=false,shown0=0;
    const ease=x=>1-Math.pow(1-x,3);
    function frame(now){
      if(!document.getElementById("growthV42")){done=true;showing=false;DS.disarm();return}
      shown0+=(now-(frame._last||now))*(DS.rate||1);frame._last=now;
      const k=Math.min(1,shown0/SPIN),rot=target*ease(k);
      drawWheel(cv,opts,tot,rot,idx,k>=1,Math.pow(1-k,2));
      nodes.forEach(n=>n.className="gv42-opt");
      if(k<1){nodes[liveWedge(opts,tot,rot)].classList.add("on");requestAnimationFrame(frame)}
      else if(!done){done=true;nodes[idx].classList.add("on");
        // debug surface: redraw the LANDED face exactly as it stands. The wheel is
        // static once it lands, so this lets a check A/B the same frame against
        // itself (art on vs off) instead of against a second, differently-rotated
        // draw of a different option set.
        try{window.__WHEEL_V50_LAST.redraw=()=>drawWheel(cv,opts,tot,rot,idx,true,0)}catch(e){}
        land()}
    }
    /* ===== v62 THE SECOND ROLL — does it pay, and exactly why =====
     * The wheel decides WHAT he commits to. Whether it PAYS is a separate roll and
     * always has been, but it used to resolve as a bar that quietly appeared and a
     * result card underneath it — no moment, and one sentence of hand-waving about
     * the personality behind it. It gets its own pop-up now: the three bands, a
     * needle that actually rolls across them and settles, and a LEDGER of what
     * moved the odds — every trait that pushed, in the percentage points it pushed
     * by, plus the form-and-risk line. Those rows and that line add up to the
     * number on the bar, because the weights they come from are linear (see
     * traitLedger). Tap-to-speed-up reaches it: the pop-up is a child of the
     * armed overlay, so a tap anywhere still runs the rest at 5x. */
    function openRoll(band){
      const host=document.getElementById("growthV42"); if(!host)return null;
      const win=opts[idx];
      const g0=Math.round(od.g*100),n0=Math.round(od.n*100),r0=Math.max(0,100-g0-n0);
      const led=(F&&F.rows||[]).filter(r=>Math.abs(r.pp)>=.5).slice(0,4)
        .map(r=>`<div class="gv62row"><span>${r.label} <b>${r.val}</b></span><em style="color:${r.pp>=0?"#6fe08a":"#ff8a80"}">${r.pp>=0?"+":"−"}${Math.abs(Math.round(r.pp))}</em></div>`).join("")
        ||`<div class="gv62row"><span>Nothing in your personality pulls here</span><em>0</em></div>`;
      const nud=(F&&F.nudge)||0;
      host.insertAdjacentHTML("beforeend",`<div id="gv62roll" style="position:fixed;inset:0;z-index:972;background:rgba(2,5,10,.9);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto">
        <div id="gv62card" style="max-width:420px;width:100%;background:linear-gradient(180deg,#16202f,#070c14);border:1px solid #ffffff26;border-radius:16px;padding:15px;font-family:Oswald,sans-serif;color:#e8ecf2;opacity:0;transform:scale(.93);transition:opacity .2s,transform .2s cubic-bezier(.2,1.35,.45,1)">
          <div style="font-size:10px;letter-spacing:3px;color:#f0bb45">${(F&&F.rollTitle)||"TRAINING ROLL"}</div>
          <div class="gv64-head">${win.skill?skillIco(win.skill,win.icon,38):win.plan?planIco(win.plan,win.icon,38):""}<span>${win.skill||win.plan?"":(win.icon||"")+" "}${win.name}</span></div>
          <div style="font-size:11px;color:#8fa2bb">${(F&&F.rollSub)||"Positive, neutral or negative — the dice decide, your personality loads them."}</div>
          <div style="position:relative;margin:14px 0 5px">
            <div style="height:16px;border-radius:8px;overflow:hidden;display:flex;box-shadow:inset 0 1px 3px rgba(0,0,0,.7)">
              <i style="flex:${g0};background:linear-gradient(180deg,#83efa0,#39a15c)"></i>
              <i style="flex:${n0};background:linear-gradient(180deg,#aab2bf,#666e7c)"></i>
              <i style="flex:${r0};background:linear-gradient(180deg,#ff9d95,#bd423a)"></i></div>
            <div id="gv62pin" style="position:absolute;top:-6px;left:50%;width:3px;height:28px;margin-left:-1.5px;border-radius:2px;background:#fff;box-shadow:0 0 9px rgba(255,255,255,.9)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:1px;color:#8fa2bb">
            <span style="color:#6fe08a">PAYS ${g0}%</span><span>HALF ${n0}%</span><span style="color:#ff8a80">BACKFIRES ${r0}%</span></div>
          <div style="margin-top:12px;padding-top:9px;border-top:1px solid #ffffff14">
            <div style="font-size:9px;letter-spacing:2px;color:#8fa2bb;margin-bottom:4px">WHAT IS LOADING THIS ROLL &nbsp;·&nbsp; POINTS ON "PAYS"</div>
            ${led}
            <div class="gv62row gv62sum"><span>Form, standing &amp; risk</span><em style="color:${nud>=0?"#6fe08a":"#ff8a80"}">${nud>=0?"+":"−"}${Math.abs(Math.round(nud*100))}</em></div>
          </div>
          <div id="gv62verdict" style="display:none;text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;margin-top:12px"></div>
          ${resHtml}
          <button id="gv42go" style="display:none;width:100%;margin-top:11px;padding:11px;border:0;border-radius:9px;background:linear-gradient(180deg,#ffd76f,#daa128);font:700 15px Oswald;color:#1a1206">CONTINUE</button>
          <style>.gv64-head{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:700;margin:4px 0 1px}
          .gv62row{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:#c6cdd8;padding:2px 0}.gv62row b{color:#fff}.gv62row em{font-style:normal;font-weight:700;font-size:13px;color:#8fa2bb}.gv62sum{margin-top:4px;padding-top:5px;border-top:1px dashed #ffffff14;color:#8fa2bb}</style>
        </div></div>`);
      const card=document.getElementById("gv62card");
      requestAnimationFrame(()=>{if(card){card.style.opacity="1";card.style.transform="scale(1)"}});
      // the needle: a few decelerating sweeps that converge on a point inside the
      // band that actually came up, so the roll is watched rather than announced
      const seg=band==="green"?[0,g0]:band==="neutral"?[g0,g0+n0]:[g0+n0,100];
      const tgt=Math.max(1.5,Math.min(98.5,seg[0]+(seg[1]-seg[0])*(.28+Math.random()*.44)));
      const DUR=RM?240:1450;let t=0,last=0;
      const step=(now)=>{
        const pin=document.getElementById("gv62pin"); if(!pin)return;
        t+=(now-(last||now))*(DS.rate||1);last=now;
        const k=Math.min(1,t/DUR),e=1-Math.pow(1-k,3);
        const swing=(1-e)*Math.sin(k*Math.PI*5.5)*44;
        pin.style.left=Math.max(0,Math.min(100,50+(tgt-50)*e+swing))+"%";
        if(k<1)requestAnimationFrame(step);
        else{pin.style.left=tgt+"%";revealRoll(band)}
      };
      DS.wait(300,()=>{last=0;requestAnimationFrame(step)});
      return true;
    }
    function revealRoll(band){
      const v=document.getElementById("gv62verdict");
      if(v){v.style.display="";v.textContent=band==="green"?"IT PAYS":band==="neutral"?"IT HALF-TAKES":"IT BACKFIRES";
        v.style.color=band==="green"?"#6fe08a":band==="neutral"?"#cfd6a8":"#ff8a80"}
      DS.wait(360,()=>showResult(band));
    }
    function showResult(band){
      const oc=document.getElementById("gv42out");
      if(oc){oc.style.display="";
        oc.style.border="1px solid "+(band==="green"?"#3f7d4d":band==="neutral"?"#77808d":"#7d3f3f");
        oc.style.background=band==="green"?"rgba(46,90,58,.25)":band==="neutral"?"rgba(90,96,106,.2)":"rgba(90,46,46,.25)";
        try{const sc=document.getElementById("gv50seal");
          if(sc&&!wart(sc.getContext("2d"),"seal_"+band,23,23,44))sc.style.display="none"}catch(e){}}
      const h=document.getElementById("gv50hint");if(h)h.style.display="none";
      const b=document.getElementById("gv42go");if(!b)return;
      b.style.display="";DS.disarm();
      b.onclick=()=>{
        if(host){   // v135: inline — the wheel stays standing on its page; only the roll pop-up closes
          const rp=document.getElementById("gv62roll"),oc=document.getElementById("gv42out"),ov=document.getElementById("growthV42");
          if(rp){if(oc&&ov)(ov.firstElementChild||ov).appendChild(oc);rp.remove()}else b.style.display="none";
          if(ov){ov.querySelectorAll("[id]").forEach(el=>{el.setAttribute("data-was",el.id);el.id=el.id+"Done"+(++retiredV136)});ov.id="growthV42Done"+retiredV136;ov.classList.add("gv42-done")}   // v136: the landed wheel keeps standing, but gives every id up so the NEXT wheel (a rivalry page) can mount and find its own parts
          showing=false;cfg.onDone&&cfg.onDone(idx);return}
        const ov=document.getElementById("growthV42");if(ov)ov.remove();showing=false;cfg.onDone&&cfg.onDone(idx)};
    }
    function land(){
      const el=nodes[idx],band=(R&&R.band)||"n";
      if(F)DS.wait(120,()=>{const f=document.getElementById("gv50fit");if(f)f.style.display=""});
      // v63: the landed row used to strobe red/neutral/green nine times before the
      // outcome appeared. That WAS the outcome animation, back when there was
      // nowhere else to play it — now the roll pop-up runs the needle across the
      // bands, and a colour lottery on the row underneath only spoils it twice and
      // flashes bands that never came up. The row just marks what the wheel landed
      // on; the roll is the roll.
      el.className="gv42-opt on";
      DS.wait(520,()=>{ if(F&&openRoll(band))return; el.className="gv42-opt "+band[0]; showResult(band) });
    }
    drawWheel(cv,opts,tot,0,idx,false,0);
    const startV139=()=>{frame._last=0;requestAnimationFrame(frame)};
    if(gateV139(root,cfg,startV139,DS))return true;   /* v139: he says when */
    DS.wait(350,startV139);
    return true;
  }
  function showWheel(pl,ctx,title,onDone){
    if(showing&&!document.getElementById("growthV42"))showing=false;
    if(showing||document.getElementById("growthV42"))return;
    const rand=seededRand(pl,ctx+"|"+(pl.currentWeek||0)+"|"+(pl.growthHistV42||[]).length);
    const opts=genOptions(pl,rand,5);
    if(!opts.length)return;
    const tot=opts.reduce((s,o)=>s+o.w,0);
    let pick=rand()*tot,idx=0;for(let i=0;i<opts.length;i++){pick-=opts[i].w;if(pick<=0){idx=i;break}}
    const out=rollOutcome(pl,opts[idx],rand,ctx);
    const P=persona(pl);
    const jtxt=(out.jiveTraits||[]).map(t=>`${TRAIT_LBL[t.key]||t.key} ${P[t.key]}`).join(" · ");
    const heavy=out.tag==="OBSESSIVE"||out.tag==="ALL-IN";
    const why=`${jtxt?(out.jive>=.12?`<b>${jtxt}</b> — this is who you are.`:out.jive<=-.12?`<b>${jtxt}</b> — this cuts against you.`:`<b>${jtxt}</b> — you have no strong feelings here.`):"Nothing in your personality pulls either way here."} ${out.nudge<=-.06?`Then ${heavy?`<b>${out.tag}</b> risk and `:""}your current form drag${heavy?"":"s"} the odds back down.`:out.nudge>=.06?`Your standing and form push them further up.`:`Nothing else is moving them.`}`;
    const ok=spinWheel({
      title, sub:"Your habits decide. Then fate rolls.",
      /* v139: only the SEASON commitment asks first — the weekly plan lives inside the pregame
       * wizard, which is already a page you have to press through. */
      gate: ctx==="season" ? "One roll decides what you commit to this year \u2014 your personality loads the wheel, and what it lands on rides every week of the season." : null,
      opts:opts.map(o=>({key:o.theme,skill:o.theme,icon:o.icon,name:o.name,col:wcol(o.theme),art:"th_"+o.theme,w:o.w,
        line1:`+${o.amt} ${o.stats.map(k=>LBL[k]).join(" / ")} · ${durTxtOf(o.dur)}`,
        line2:`${o.tag} · RISK ${Math.round(o.risk*100)}%`,
        line2col:o.tag==="ALL-IN"?"#ff9d5c":o.tag==="OBSESSIVE"?"#f0bb45":"#8fa2bb"})),
      pick:idx, turns:(pl.growthHistV42||[]).length,
      fit:{jive:out.jive,odds:out.odds,nudge:out.nudge,why,
        rows:jiveFrom(P,(THEMES.find(t=>t.id===out.card)||{w:()=>1}).w).rows,
        rollTitle:"TRAINING ROLL · DOES THE WORK TAKE?",
        rollSub:"Positive, neutral or negative. The dice decide — your personality loads them."},
      result:{band:out.band,
        headline:`<span class="gv64-head" style="font-size:15px;margin:0">${skillIco(out.card,out.icon,30)}<span>${out.name} — ${out.band==="green"?"IT PAYS OFF":out.band==="neutral"?"HALF MEASURES":"IT BACKFIRES"}</span></span>`,
        story:out.story,
        lines:out.stats.map(k=>(out.sign>0?"+":"−")+(out.permanent?"1-3":out.amt)+" "+(LBL[k]||k)).join(" · "),
        dur:durTxtOf(out.tier,out.permanent)},
      onDone:()=>{applyOutcome(pl,out);onDone&&onDone(out)},
    });
    if(!ok)showing=false;
  }
  // ---- hooks ----
  const _ss=window.startSeason;
  window.startSeason=function(){
    const r=_ss&&_ss.apply(this,arguments);
    try{const pl=PL();if(pl){const k=seasonKey(pl);
      // season rollover: expire / decrement season-scoped effects
      if(pl._growthSeasonK&&pl._growthSeasonK!==k&&Array.isArray(pl.growthFxV42)){
        pl.growthFxV42.forEach(fx=>{if(fx.seasonsLeft!=null)fx.seasonsLeft--});
        pl.growthFxV42=pl.growthFxV42.filter(fx=>fx.permanent||fx.gamesLeft>0||fx.seasonsLeft>0);
      }
      if(pl._growthCommitK!==k){pl._growthCommitK=k;pl._growthSeasonK=k;delete pl._crossroadsV135;
        setTimeout(()=>showWheel(pl,"season","SEASON COMMITMENT · HOW WILL YOU LIVE THIS YEAR?"),650)}
    }}catch(e){}
    return r;
  };
  // post-game watcher: decrement game-scoped effects; maybe fire an in-season decision
  let lastPlayed=-1;
  setInterval(()=>{try{
    const s=ST(),pl=PL();if(!pl||!pl.weekResults)return;
    const played=pl.weekResults.filter(w=>w&&w.played).length;
    if(lastPlayed===-1)lastPlayed=played;
    if(played>lastPlayed){
      const delta=played-lastPlayed;lastPlayed=played;
      if(Array.isArray(pl.growthFxV42)){
        pl.growthFxV42.forEach(fx=>{if(fx.gamesLeft!=null)fx.gamesLeft-=delta});
        pl.growthFxV42=pl.growthFxV42.filter(fx=>fx.permanent||fx.seasonsLeft>0||fx.gamesLeft==null||fx.gamesLeft>0);
      }
      // seeded in-season decisions: default ~2-3 per 8-game season, dialable
      const freq=cl(dial("freq",1),0,3);                                  // 0=off 1=normal 2=busy 3=constant
      if(freq>0&&s&&s.view!=="live"){
        const rand=seededRand(pl,"inseason|"+played);
        // v135: never popped on its own any more — queued on the player, and the pregame's wheel
        // page spins it before the plan (the same seeded ctx, so the same options and the same roll)
        if(rand()<[0,.32,.5,.7][Math.round(freq)]) pl._crossroadsV135={ctx:"inseason|w"+played,title:"MIDSEASON CROSSROADS · WEEK "+(played+1)};
      }
    }
    if(played<lastPlayed)lastPlayed=played;                               // new career/season reset
  }catch(e){}},700);
  /* v150 A: the dials wrote window.o.settings — window.o never existed (the state is window.S), so every change threw
   * and none was kept. One setter on the live state, saved through GridironStorage like every other write. */
  window.setGrowthDialV150=function(k,v){const s=ST();if(!s||!/^(freq|luck|soften|jive)$/.test(String(k)))return false;const n=+v;if(!isFinite(n))return false;
    s.settings=s.settings||{};s.settings["growth_"+k]=n;try{window.GridironStorage&&window.GridironStorage.save(s)}catch(e){}return true};
  // hub chips + settings dials (polled injection, same pattern as other late blocks)
  setInterval(()=>{try{
    const s=ST(),pl=PL(),scr=document.getElementById("screen");if(!s||!pl||!scr)return;
    if(s.view==="hub"&&!scr.querySelector(".gv42-chips")&&Array.isArray(pl.growthFxV42)&&pl.growthFxV42.length){
      const chips=pl.growthFxV42.map(fx=>`<span style="display:inline-block;margin:3px 4px 0 0;padding:3px 9px;border-radius:20px;font:600 11px Oswald;border:1px solid ${fx.sign<0?"#7d3f3f":"#3f7d4d"};color:${fx.sign<0?"#ff9d94":"#7fe89a"}">${fx.label} ${fx.sign<0?"−":"+"}${fx.amt} · ${fx.permanent?"PERM":fx.gamesLeft!=null?fx.gamesLeft+"g":fx.seasonsLeft+"szn"}</span>`).join("");
      (scr.querySelector(".card")||scr.firstElementChild)?.insertAdjacentHTML("afterend",`<div class="card gv42-chips"><div class="eyebrow">ACTIVE GROWTH EFFECTS</div>${chips}</div>`);
    }
    if(s.view==="settings"&&!scr.querySelector(".gv42-set")){
      const row=(k,lab,opts)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #ffffff10"><span style="font-size:13px">${lab}</span><select data-growth-dial="${k}" onchange="setGrowthDialV150('${k}',this.value)" style="background:#0d1420;color:#e8ecf2;border:1px solid #ffffff22;border-radius:6px;padding:4px 7px">${opts.map(o=>`<option value="${o[0]}" ${dial(k,{freq:1,luck:0,soften:0,jive:.85}[k])===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div>`;
      scr.insertAdjacentHTML("beforeend",`<div class="card gv42-set"><div class="eyebrow">GROWTH DECISIONS</div>
        ${row("freq","Midseason decision frequency",[[0,"Off"],[1,"Normal (2-3/season)"],[2,"Busy"],[3,"Constant"]])}
        ${row("luck","Outcome luck bias",[[-1,"Harsh"],[0,"Fair"],[1,"Kind"],[2,"Charmed"]])}
        ${row("soften","Game-day debuff softening",[[0,"Full stakes"],[1,"−25%"],[2,"−50%"],[3,"−75%"]])}
        ${row("jive","How much personality fit decides outcomes",[[1.6,"Barely (mostly luck)"],[.85,"Normal"],[.55,"Strongly"],[.35,"It's everything"]])}
      </div>`);
    }
  }catch(e){}},900);
  // telemetry / harness
  window.__GROWTH_V42={compose,rollOutcome,applyOutcome,genOptions,THEMES,TIERS,POOLS,LBL,persona,jiveOf,bandOdds,jiveTraits,jiveFrom,traitLedger,showWheel,showWheelIn,spinWheel,wcol,wshade,NEUTRAL,TRAIT_LBL,
    simulate(n){const out=[];for(let i=0;i<(n||100);i++){
      const pl={pos:["QB","RB","WR","LB","CB"][i%5],seasonSeed:1e6+i,seasonsPlayedTotal:i,personaV13:{aggression:i*3%11,iq:i*5%11,eq:i*7%11,longterm:i*2%11,workethic:i*4%11,loyalty:5,confidence:i*6%11,coachability:i*8%11},prestigeLifetime:i%3===0?0:i%3===1?8:18,coachTrust:20+i*7%70,momentum103:30+i*11%50,conditionV11:{fatigue:i*5%30}};
      const rand=seededRand(pl,"sim"+i);const opts=genOptions(pl,rand,5);if(!opts.length)continue;
      const tot=opts.reduce((s,o)=>s+o.w,0);let pick=rand()*tot,idx=0;for(let j=0;j<opts.length;j++){pick-=opts[j].w;if(pick<=0){idx=j;break}}
      const o=rollOutcome(pl,opts[idx],rand,"sim");o._tier=opts[idx].tag;o._names=opts.map(x=>x.name);out.push(o)}
      return out}};
})();
