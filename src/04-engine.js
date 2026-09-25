
/* ===== v38 WHOLE-FIELD ACCELERATION + v37 EXACT PLANES / MOVEMENT IQ ===== */
/* ===== RIB_TUNE: every gameplay dial reads through TU(key, default) so DEV can retune live ===== */
window.RIB_TUNE = window.RIB_TUNE || {};
window.TU = function (k, d) { var t = window.RIB_TUNE; return t[k] !== undefined ? t[k] : d; };
/* ===== GRIDIRON play choreography engine (pure — no Phaser, no DOM) =====
 * buildPlayScript(payload, cfg) -> { duration, actors, ball, events }
 * actors: [{id, side:'off'|'def', label, frames:[{t,x,y}]}]  (frames every TICK ms)
 * ball:   frames [{t,x,y,h}]   h = flight height px for scale/arc rendering
 * events: [{t, type, x, y, ...}]
 */
(function (root) {
  const TICK = 33;                       // 30 Hz keyframes
  const OFF_LABELS = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"];
  const DEF_LABELS = ["CB","CB","S","S","LB","LB","LB","DE","DT","DT","DE"];
  const SPEED = { WR:150, RB:146, QB:118, TE:132, OL:82, CB:152, S:147, LB:126, DL:96, DE:124, DT:86 };

  function buildPlayScript(payload, cfg) {
    const rand = cfg.rand || Math.random;
    const R = (a,b)=>a+rand()*(b-a), RI=(a,b)=>Math.floor(R(a,b+1)), pick=(arr)=>arr[Math.floor(rand()*arr.length)];
    const { PLAY_L, PLAY_R, F_TOP, F_BOT } = cfg.dims;
    const PLAY_W = PLAY_R-PLAY_L, YD = PLAY_W/100, MIDY=(F_TOP+F_BOT)/2;
    const clampX=(x)=>Math.max(PLAY_L-YD*9,Math.min(PLAY_R+YD*9,x));
    const SIDELINE_TOP=F_TOP+34, SIDELINE_BOT=F_BOT-30;
    const clampY=(y)=>Math.max(SIDELINE_TOP,Math.min(SIDELINE_BOT,y));
    // A boundary is a zero-width plane, not a fuzzy zone. Every dead-ball/score
    // spot below is interpolated onto the FIRST plane touched by the carrier's
    // movement segment, so high speed can never skip a sideline or goal line.
    const crossedPlane=(a,b,plane,sign)=>{const eps=TU("planeEpsilon",.05);
      return sign>0?a<plane&&b>=plane-eps:a>plane&&b<=plane+eps;};
    const planePoint=(x0,y0,x1,y1,axis,plane)=>{ const d=(axis==="x"?x1-x0:y1-y0);
      const q=Math.max(0,Math.min(1,Math.abs(d)<1e-6?0:(plane-(axis==="x"?x0:y0))/d));
      return {x:axis==="x"?plane:x0+(x1-x0)*q,y:axis==="y"?plane:y0+(y1-y0)*q}; };

    const usOff = payload.offense !== "them";
    const dir = usOff ? 1 : -1;
    const losYd = usOff ? (payload.startBall??50) : 100-(payload.startBall??50);
    const endYd = usOff ? (payload.endBall??payload.startBall??50) : 100-(payload.endBall??payload.startBall??50);
    const fieldX = (yd)=>PLAY_L+Math.max(0,Math.min(100,yd))/100*PLAY_W;
    const losX = fieldX(losYd);
    const yards = Number(payload.yards ?? Math.round((endYd-losYd)*dir));
    // THE STAT IS AUTHORITATIVE: if endBall disagrees with startBall+yards,
    // the carry covers exactly `yards` so the +N YD popup mirrors the sim.
    let effEndYd = endYd;
    const isKick0 = payload.event==="punt"||payload.event==="fg"||payload.event==="kickoff";
    const isPick0 = !!payload.pickSix || /INTERCEPT|PICK SIX/.test(String(payload.desc||"").toUpperCase());
    const isFumble0 = String(payload.desc||"").toUpperCase().includes("FUMBLE");
    if (!isKick0 && !isPick0 && !isFumble0 && !payload.scored && Number.isFinite(yards)) {
      const statEnd = losYd + dir*yards;
      if (Math.abs(statEnd - endYd) > 3) effEndYd = Math.max(0, Math.min(100, statEnd));
    }
    // Interception returns travel toward the opposite goal from the offense.
    // Keeping that direction explicit prevents pick-sixes from running through
    // the wrong end zone before the scoring event appears.
    const scoreDir = isPick0 ? -dir : dir;
    if(payload.scored&&isPick0)effEndYd=scoreDir>0?100:0;
    const reachedGoal = scoreDir>0 ? effEndYd>=99.5 : effEndYd<=0.5;
    const endX = fieldX(effEndYd);
    const firstDownYd = Math.max(0,Math.min(100, losYd + dir*(payload.preToGo ?? 10)));
    const firstDownX = fieldX(firstDownYd);
    // fumble spot: the stat marks yards gained before the ball came out
    const fumbleX = fieldX(Math.max(0,Math.min(100, losYd + dir*(Number.isFinite(yards)?yards:0))));
    const desc = String(payload.desc||"").toUpperCase();
    const isSack = desc.includes("SACK"), isPick = !!payload.pickSix || /INTERCEPT|PICK SIX/.test(desc);
    const isFumble = desc.includes("FUMBLE") && !isPick;
    const isPass = payload.event==="pass"||payload.event==="incomplete"||isPick;
    const isKick = payload.event==="punt"||payload.event==="fg"||payload.event==="kickoff";
    const fx = payload.fx || {};
    const scored = !!payload.scored;

    // QB keeps it: scrambles & designed QB runs render as QB carries, not handoffs. v118: a QB
    // career used to make EVERY run of his own offense a keeper here ("Pierce rushes inside"
    // drawn as the quarterback running) — the row has to name him ("You ...") for it to be his
    const qbRun = !isPass && !isKick && !isSack && (desc.includes("SCRAMBLE") ||
      (payload.playerPos === "QB" && (usOff ? payload.offense !== "them" : payload.offense === "them") && /\bYOU\b/.test(desc)));
    // coverage shell for this snap
    const shell = rand() < 0.45 ? "man" : "zone";
    const blitzerId = shell === "man" && rand() < 0.3 ? ["def4","def5","def6"][Math.floor(rand()*3)] : null;
    // goal-line: compress the formation inside the 7
    const goalDist = dir > 0 ? 100 - losYd : losYd;
    const glLine = goalDist <= 7;
    // ---- v15.21 roster-aware coverage profiles ----
    let _state=null,_userRoster=[],_oppRoster=[];
    try {
      _state=root.__getGridironState?root.__getGridironState():null;
      _userRoster=(_state&&_state.player&&_state.player.teamRosterV158)||[];
      const lg=_state&&_state._liveGame;
      _oppRoster=(lg&&lg.opp&&(lg.opp.rosterV157||lg.opp.roster))||(lg&&lg.oppRoster)||[];
      if(!_oppRoster.length&&_state&&_state.teamRosterCacheV158){
        const vals=Object.values(_state.teamRosterCacheV158); if(vals.length)_oppRoster=vals[vals.length-1]||[];
      }
    } catch(e) {}
    const _avg=(arr,fallback)=>arr&&arr.length?arr.reduce((n,p)=>n+(Number(p&&p.ovr)||fallback),0)/arr.length:fallback;
    const _userOvr=_avg(_userRoster,Number(_state&&_state.player&&(_state.player.teamOvr||_state.player.teamRating))||55);
    const _oppOvr=_avg(_oppRoster,Number(_state&&_state._liveGame&&(_state._liveGame.oppOvr||(_state._liveGame.opp&&_state._liveGame.opp.rating)))||55);
    const _offRoster=usOff?_userRoster:_oppRoster, _defRoster=usOff?_oppRoster:_userRoster;
    const _offFallback=usOff?_userOvr:_oppOvr, _defFallback=usOff?_oppOvr:_userOvr;
    const _uses={off:{},def:{}};
    const _posMatch=(p,label)=>{
      const pos=String(p&&p.pos||'').toUpperCase();
      if(label==='OL')return ['LT','LG','C','RG','RT','OL'].includes(pos);
      if(label==='DE')return ['DE','EDGE'].includes(pos);
      if(label==='DT'||label==='DL')return ['DT','DL','NT'].includes(pos);
      return pos===label;
    };
    function _profile(side,label){
      const roster=side==='off'?_offRoster:_defRoster, fallback=side==='off'?_offFallback:_defFallback;
      const pool=(roster||[]).filter(p=>_posMatch(p,label)).sort((a,b)=>(Number(b.ovr)||0)-(Number(a.ovr)||0));
      const k=label, idx=(_uses[side][k]||0); _uses[side][k]=idx+1;
      const p=pool.length?pool[idx%pool.length]:null, attrs=(p&&p.attrs)||p||{};
      const ovr=Math.max(1,Math.min(99,Number(p&&p.ovr)||Number(fallback)||55));
      const val=(name,fb)=>Math.max(1,Math.min(99,Number(attrs[name])||Number(p&&p[name])||fb));
      return {player:p||null,ovr,coverage:val('coverage',ovr),awareness:val('awareness',ovr),
        discipline:val('discipline',ovr),speed:val('speed',ovr),quickness:val('quickness',ovr),
        acceleration:val('acceleration',val('quickness',ovr)),agility:val('agility',ovr),burst:val('burst',val('acceleration',ovr))};
    }
    // ---- formation ----
    const offRow = [78,372,306,158,190,222,254,286,222,262,120];
    const defRow = [78,372,140,306,172,222,276,150,206,242,295];
    const actors = [];
    const gy = (y,lb)=> glLine && ["WR","TE","CB","S"].includes(lb) ? 220+(y-220)*0.62 : y;
    OFF_LABELS.forEach((lb,i)=>{
      const back = lb==="QB"?-38:lb==="RB"?-54:(lb==="WR"&&i===10)?-10:0;
      actors.push(mkActor("off"+i,"off",lb, losX+dir*back, gy(offRow[i],lb)));
    });
    DEF_LABELS.forEach((lb,i)=>{
      const fwd = lb==="S"?(glLine?40:88):lb==="LB"?(glLine?30:52):lb==="CB"?25:15;
      actors.push(mkActor("def"+i,"def",lb, losX+dir*fwd, gy(defRow[i],lb)));
    });
    function mkActor(id,side,label,x,y){
      const pr=_profile(side,label), ratingSpeed=0.92+pr.speed/520;
      return {id,side,label,x,y,vx:0,vy:0,frames:[],state:"idle",
        spd:SPEED[label]*R(0.94,1.06)*ratingSpeed,beatenUntil:-1,
        _ovr:pr.ovr,_cov:pr.coverage,_aware:pr.awareness,_disc:pr.discipline,_quick:pr.quickness,
        _accRating:pr.acceleration,_agiRating:pr.agility,_burstRating:pr.burst,_player:pr.player};
    }
    const A = Object.fromEntries(actors.map(a=>[a.id,a]));
    const isDLine=(lb)=>lb==="DL"||lb==="DE"||lb==="DT";   // v5: the D-line is now DE/DT
    const qbHomeY=A.off8.y;
    // v7: escort-blocking instinct by position (the featured player's real BLOCKING attr overrides below)
    actors.forEach(a=>{ a._blkSkill = a.side==="off"
      ? ({OL:0.6,TE:0.5,RB:0.4,WR:0.25,QB:0.1}[a.label]||0.2)
      : ({LB:0.35,S:0.3,CB:0.25}[a.label]||0.3); });
    const events=[]; const ballFrames=[];
    let ballCarrier=null, ballFlight=null, ballFlightSeq=0, ballPos={x:losX,y:A.off8.y,h:0};

    // ---- the user's marker + stat-authority: `involved` says whether the
    //      game credited YOU with this play; the visuals must agree ----
    const involved = payload.involved !== undefined ? !!payload.involved : true;
    const OFFPOS = ["QB","RB","WR","TE","OL"];
    let featured = { index: usOff ? 8 : 14, isMe: false, actorId: null };
    (function pickFeatured(){
      const pos = payload.playerPos;
      const pickFrom = (labels, base, want) => {
        const idxs = [];
        for (let i = 0; i < labels.length; i++) if (labels[i] === want || (want === "DL" && (labels[i] === "DE" || labels[i] === "DT"))) idxs.push(base + i);
        return idxs.length ? idxs[0] : -1;   // v87: the user's slot is the first of his position, never a random body
      };
      if (pos && involved) {
        const meOff = OFFPOS.includes(pos);
        if (usOff && meOff) { const i = pickFrom(OFF_LABELS, 0, pos); if (i >= 0) { featured = { index: i, isMe: true }; return; } }
        if (!usOff && !meOff) { const i = pickFrom(DEF_LABELS, OFF_LABELS.length, pos); if (i >= 0) { featured = { index: i, isMe: true }; return; } }
      }
      const prio = payload.event === "run" ? ["RB","QB"] : ["WR","TE","RB","QB"];
      for (const want of prio) { const i = pickFrom(OFF_LABELS, 0, want); if (i >= 0) { featured = { index: i, isMe: false }; return; } }
    })();
    featured.actorId = featured.index < 11 ? "off"+featured.index : "def"+(featured.index-11);
    // ---- v4: the featured player's live-sim AI obeys their REAL attributes ----
    try {
      if (featured.isMe && root.__getGridironState) {
        const _st = root.__getGridironState(), _pl = _st && _st.player, _at = (_pl && _pl.attrs) || {};
        const _me = A[featured.actorId], _cap = 40;
        _me.spd *= 0.82 + 0.44 * Math.min(1, ((_at.speed||18)*0.65 + (_at.acceleration||_at.quickness||18)*0.35) / _cap);
        _me._accRating = 99*Math.min(1,(_at.acceleration||_at.quickness||18)/_cap);            // start/recovery rate
        _me._agiRating = 99*Math.min(1,(_at.agility||18)/_cap);                                // cut speed retention + braking
        _me._burstRating = 99*Math.min(1,(_at.burst||_at.acceleration||18)/_cap);               // first 250ms drive
        _me._agi = Math.min(1, (_at.agility||18) / _cap);
        _me._pwr = Math.min(1, ((_at.strength||18)*0.6 + (_at.tackling||_at.blocking||18)*0.4) / _cap); // fight through contact
        _me._blkSkill = Math.max(_me._blkSkill||0, Math.min(1, (_at.blocking||14) / _cap));            // escort blocking IQ
      }
    } catch (e) {}
    // the user's marker id when they play DEFENSE on this snap (contact assignment)
    const userDefId = (!usOff && payload.playerPos && !OFFPOS.includes(payload.playerPos) && featured.isMe && payload.involved) ? featured.actorId : null;   // v87: only when the book credited you

    // ---- FIELD-SIM LOG: if this play was agent-resolved, render THAT resolution ----
    const isTryKickV109 = payload.event === "xp";   // v109: the extra point is a scored row that still renders from its (FG) log
    if (payload.scored && !isTryKickV109 && (root.__FieldSim||{})._Q && root.__FieldSim._Q.length) {
      // scored plays render the drive-true distance to the goal (choreographed,
      // goal-gated); discard the matching sim log so the queue stays aligned
      const h = root.__FieldSim._Q[0];
      if (h && h.sig.off === usOff) root.__FieldSim._Q.shift();
    }
    if (!payload.penalty && !isFumble && (!payload.scored || isTryKickV109) && typeof (root.__FieldSim||{}).takeLog === "function") {
      const kindWant = (payload.event==="run") ? "run" :
        (payload.event==="pass"||payload.event==="incomplete"||payload.event==="turnover"||payload.event==="sack") ? "pass" :   // v82: a taken sack renders from its log
        (payload.event==="punt"||payload.event==="fg"||payload.event==="kickoff") ? payload.event :                             // v82: special teams render from theirs
        isTryKickV109 ? "fg" : null;                                                                                            // v109: the try kicks from the FG family
      if (kindWant) {
        const log = root.__FieldSim.takeLog({ off: usOff, kind: kindWant, yards: yards,
          intercepted: isPick ? true : (payload.event==="turnover"?true:undefined) });
        if (log && log.actors && log.actors.length === 22) {
          const tw = (lx)=>Math.max(6, Math.min(714, losX + dir*lx));
          const actorsOut = log.actors.map(a=>({ id:a.id, side:a.side, label:a.label, sp:a.sp, nm:a.nm, skin:a.skin, you:a.you,   // v151 D: his own top speed rides the script (the pace caps read it)
            frames: a.frames.map(f2=>({t:f2.t, x:tw(f2.x), y:f2.y})) }));
          const ballOut = log.ball.map(f2=>({t:f2.t, x:tw(f2.x), y:f2.y, h:f2.h||0}));
          const eventsOut = log.events.map(e=>Object.assign({}, e,
            e.x!==undefined?{x:tw(e.x)}:{}, e.tx!==undefined?{tx:tw(e.tx)}:{}, e.fpX!==undefined?{fpX:tw(e.fpX)}:{}));   // v153 A: the forward-progress spot is a field x too
          /* ===== v109 THE STICKS COME OUT — the sim never emits a first down, so the badge, the crew's point and the
           * ribbon's "· FIRST DOWN" only ever fired on fallback choreography. A converting sim log gets the event at
           * its dead ball. A measured spot is left to the whistle (badgesWhistleV95), so the chains come out first. */
          if (TU("fdEventSimV109", 1) && payload.firstDown && !payload.measure && !scored && !isPick && !log.events.some(e=>e.type==="firstdown")) {
            const tk = [...log.events].reverse().find(e=>e.type==="tackle"), tAt = Math.max(0, (tk ? tk.t : log.duration) - TU("fdEventLeadMs", 120));
            eventsOut.push({ t: tAt, type: "firstdown", x: firstDownX, y: tk && tk.y != null ? tk.y : MIDY, v109: true });
            eventsOut.sort((a,b)=>a.t-b.t);
            try { const V = root.__V109_D = root.__V109_D || {}; V.fdEvents = (V.fdEvents || 0) + 1; } catch (e) {}
          }
          // stat-authority fix: the gold marker must sit on YOUR actual roster actor
          // in the agent-sim log — never on a random same-position teammate
          const youIdx = log.actors.findIndex(a=>a.you);
          const featOut = youIdx >= 0 ? { index: youIdx, isMe: true, actorId: log.actors[youIdx].id } : featured;
          return { duration: log.duration, actors: actorsOut, ball: ballOut, events: eventsOut,
            meta: { concept: "fieldsim", targetId: null, losX, endX, dir, scored,
              featured: featOut, involved, targetRoute: null, fieldSim: true } };
        }
      }
    }
    // penalty: short pre-snap/early-play sequence, flag thrown, whistle
    if (payload.penalty) {
      /* ===== v109 THE FLAG HAS THREE BEATS — thrown, announced, re-spotted =====
       * The flag used to be one canned 1150 ms jitter. Now the row's `foul` shapes it: the culprit's unit is the
       * one that moves early on a pre-snap foul, the flag comes out (the `flag` event still drives refThrowFlag and
       * the FLAG badge), everyone stands for the announcement (`announce`, carrying the foul), and then the whole
       * formation and the ball walk to the re-spot (`respot`) — the row's endBall — and set. TU("flagBeatMs"). */
      const beat = Math.max(200, TU("flagBeatMs", 700)), foul = payload.foul || null, preSnap = !!(foul && foul.preSnap);
      const tSnap = 640, tFlag = preSnap ? 760 : 900, tAnn = tFlag + beat, tSpot = tAnn + beat, tEnd = tSpot + Math.round(beat * 0.5);
      const newLosX = fieldX(endYd), shift = newLosX - losX;
      const unit = foul ? (/false start/i.test(foul.name) ? ["OL"] : /delay/i.test(foul.name) ? ["QB"] : /formation/i.test(foul.name) ? ["WR"] :
        /offside|encroach|neutral/i.test(foul.name) ? ["DE","DT","DL"] : null) : null;
      const culprit = unit ? actors.find(a => a.side === (foul.side === "offense" ? "off" : "def") && unit.includes(a.label)) : null;
      let pt = 0, jumped = false;
      const rec2 = () => { actors.forEach(a=>a.frames.push({t:pt,x:Math.round(a.x*10)/10,y:Math.round(a.y*10)/10}));
        ballFrames.push({t:pt,x:Math.round(ballPos.x*10)/10,y:Math.round(ballPos.y*10)/10,h:0}); };
      while (pt < tEnd) {
        pt += TICK;
        // beat 0 — the set; on a pre-snap foul the culprit goes early, and that is the whole foul
        if (preSnap && culprit && !jumped && pt >= tSnap - 140) { jumped = true; culprit.x = clampX(culprit.x + (culprit.side === "off" ? dir : -dir) * YD * 1.5); }
        if (pt >= tSnap && !events.some(e=>e.type==="snap")) { events.push({t:pt,type:"snap",x:losX}); ballCarrier="off8"; }
        // beat 1 — the flag
        if (pt >= tFlag && !events.some(e=>e.type==="flag")) {
          const fx = culprit ? culprit.x + dir*R(-8, 8) : losX+dir*R(20,60), fy = culprit ? clampY(culprit.y + R(-10, 10)) : clampY(220+R(-70,70));
          events.push({t:pt,type:"flag",x:fx,y:fy,foul});
        }
        // beat 2 — the announcement: everyone stands
        if (pt >= tFlag + 60 && !events.some(e=>e.type==="announce")) events.push({t:pt,type:"announce",x:losX,y:220,foul,
          text: foul ? (foul.name + (foul.player && foul.player.num ? " · #" + foul.player.num : "") + " · " + foul.yards + " YDS") : "FLAG ON THE PLAY"});
        // beat 3 — the re-spot: the formation and the ball walk to the new line
        if (pt >= tAnn && !events.some(e=>e.type==="respot")) events.push({t:pt,type:"respot",x:newLosX,y:220,yards:Number(payload.yards||0)});
        if (pt > tSnap && pt < tFlag && !preSnap) actors.forEach(a=>{ a.x+=R(-1.5,1.5); a.y+=R(-1.5,1.5); a.x=clampX(a.x); a.y=clampY(a.y); });
        if (pt >= tAnn && pt < tSpot) { const step = shift * (TICK / beat); actors.forEach(a=>{ a.x = clampX(a.x + step); }); }
        if (ballCarrier && pt < tAnn) ballPos={x:A.off8.x,y:A.off8.y+4,h:0};
        else if (pt >= tAnn) ballPos={x:Math.min(Math.max(ballPos.x + shift * (TICK / beat), Math.min(losX, newLosX)), Math.max(losX, newLosX)),y:ballPos.y,h:0};
        rec2();
      }
      try { const V = root.__V109_D = root.__V109_D || {}; V.flagScripts = (V.flagScripts || 0) + 1; V.lastFlag = { beats: [tFlag, tAnn, tSpot, tEnd], foul: foul && foul.name, shiftPx: Math.round(shift) }; } catch (e) {}
      return { duration: pt, actors: actors.map(a=>({id:a.id,side:a.side,label:a.label,frames:a.frames})),
               ball: ballFrames, events, meta:{concept:"penalty",targetId:null,losX,endX,dir,scored:false,featured,involved,targetRoute:null,flagBeatsV109:[tFlag,tAnn,tSpot,tEnd]} };
    }
    // ---- carrier path construction ----
    function weavePath(sx,sy,tx,ty,cuts){
      const pts=[{x:sx,y:sy}]; const n=2+cuts.length;
      for(let i=1;i<n;i++){
        const f=i/n;
        pts.push({x:sx+(tx-sx)*f, y:clampY(sy+(ty-sy)*f+R(-26,26))});
      }
      // insert sharp cut points
      cuts.forEach((c,ci)=>{
        const at=1+ci; const p=pts[Math.min(at,pts.length-2)];
        p.y=clampY(p.y+c.side*R(34,54)); p.cut=c;
      });
      pts.push({x:tx,y:ty});
      return pts;
    }
    function pathLen(pts){ let l=0; for(let i=1;i<pts.length;i++) l+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); return l; }
    function pointAt(pts,d){
      let acc=0;
      for(let i=1;i<pts.length;i++){
        const seg=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
        if(acc+seg>=d){ const f=(d-acc)/seg; return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*f, y:pts[i-1].y+(pts[i].y-pts[i-1].y)*f, seg:i}; }
        acc+=seg;
      }
      return {...pts[pts.length-1],seg:pts.length-1};
    }

    // ---- route library (waypoints from receiver start) ----
    function route(name,sx,sy,depthYd,sideSign){
      const D=(yd)=>dir*yd*YD, S=sideSign;
      const stem=(yd)=>({x:sx+D(yd),y:sy});
      switch(name){
        case "go":     return [ {x:sx,y:sy}, stem(depthYd) ];
        case "post":   return [ {x:sx,y:sy}, stem(depthYd*0.6), {x:sx+D(depthYd),y:clampY(sy+(MIDY-sy)*0.7)} ];
        case "corner": return [ {x:sx,y:sy}, stem(depthYd*0.6), {x:sx+D(depthYd),y:clampY(sy+S*55)} ];
        case "out":    return [ {x:sx,y:sy}, stem(depthYd),    {x:sx+D(depthYd),y:clampY(sy+S*46)} ];
        case "dig":    return [ {x:sx,y:sy}, stem(depthYd),    {x:sx+D(depthYd),y:clampY(sy-S*60)} ];
        case "curl":   return [ {x:sx,y:sy}, stem(depthYd+2),  {x:sx+D(depthYd),y:clampY(sy-S*10)} ];
        case "slant":  return [ {x:sx,y:sy}, stem(2),          {x:sx+D(depthYd),y:clampY(sy-S*48)} ];
        case "cross":  return [ {x:sx,y:sy}, stem(3),          {x:sx+D(depthYd),y:clampY(sy-S*(F_BOT-F_TOP)*0.42)} ];
        case "flat":   return [ {x:sx,y:sy}, {x:sx+D(Math.max(1,depthYd)),y:clampY(sy+S*40)} ];
        case "wheel":  return [ {x:sx,y:sy}, {x:sx,y:clampY(sy+S*44)}, stemAt(sx,clampY(sy+S*44),depthYd) ];
        case "screen": return [ {x:sx,y:sy}, {x:sx-D(2.5),y:clampY(sy+S*14)} ];
        default:       return [ {x:sx,y:sy}, stem(depthYd) ];
      }
      function stemAt(x,y,yd){ return {x:x+D(yd),y:y}; }
    }
    const DEEP=["go","post","corner"], MED=["out","dig","curl","cross"], SHORT=["slant","flat","cross","screen"];

    // ---- choose concept ----
    let concept, targetId, airYd=0, targetRoute=null, cuts=[];
    if(fx.miss) cuts.push({side:pick([-1,1]),type:fx.spin?"spin":"juke"});
    if(yards>=14&&rand()<0.4) cuts.push({side:pick([-1,1]),type:"juke"});

    if(isKick){ concept="kick"; }
    else if(isSack){ concept="sack"; }
    else if(isPass){
      const pos=payload.playerPos;
      const featured = (usOff&&["WR","TE","RB"].includes(pos)) ? pos : null;
      // v87: when the book says YOU caught it the ball goes to YOUR slot; when it does not, never to your slot
      const meSlot=featured==="TE"?"off2":featured==="RB"?"off9":featured==="WR"?"off0":null;
      const pickTgt=(list)=>(meSlot&&payload.involved)?meSlot:pick(list.filter(x=>x!==meSlot));
      if(isPick){ concept="pick"; airYd=Math.max(4,Math.min(18,RI(6,14))); targetId=pickTgt(["off0","off1","off10","off2"]); }
      else if(yards<=3&&!scored){ concept="screen"; targetId=pickTgt(["off0","off1","off9"]); airYd=-2; }
      else if(yards>=18&&rand()<0.6){ concept="deep"; airYd=Math.min(Math.max(13,Math.round(yards*R(0.55,0.85))),26); }
      else { concept="quick"; airYd=Math.max(2,Math.min(Math.round(yards*R(0.4,0.8)),14)); }
      if(!targetId){
        targetId = pickTgt(["off0","off1","off10","off2","off9"]);
      }
      const tgt=A[targetId], side = tgt.y>MIDY?1:-1;
      const rname = concept==="screen"?"screen":concept==="deep"?pick(DEEP):airYd<=4?pick(SHORT.filter(r=>r!=="screen")):pick(MED);
      targetRoute = route(rname,tgt.x,tgt.y,Math.max(1,airYd),side);
      events.push({t:0,type:"concept",concept,route:rname,airYd});
    } else if(qbRun){
      concept = "scramble";
      events.push({t:0,type:"concept",concept});
    } else {
      const draw = yards>=4&&yards<=12&&rand()<0.25;
      const sweep = !draw&&yards>=5&&rand()<0.35;
      concept = yards<=0?"stuff":draw?"draw":sweep?"sweep":yards>=10?"breakaway":"dive";
      events.push({t:0,type:"concept",concept});
    }

    events.push({t:0,type:"shell",shell});
    // cap route depth at the goal line
    if(glLine && airYd>0) airYd = Math.min(airYd, goalDist+2);
    // ---- decoy routes for other receivers on pass plays ----
    const decoys={};
    if(isPass&&concept!=="kick"){
      ["off0","off1","off10","off2"].forEach(id=>{
        if(id===targetId) return;
        const a=A[id], side=a.y>MIDY?1:-1;
        decoys[id]=route(pick(["go","cross","dig","out","curl","slant"]),a.x,a.y,RI(6,16),side);
      });
    }

    const paFake = isPass && !isPick && (concept==="deep" ? rand()<0.7 : rand()<0.3);
    // v15.21: active coverage plan. Cornerbacks continuously mirror receivers;
    // linebackers diagnose pass and drop; elite/high-threat WRs can be bracketed.
    const receiverIds=["off0","off1","off10","off2","off9"];
    const wrIds=["off0","off1","off10"];
    const cbIds=["def0","def1"], lbIds=["def4","def5","def6"], safetyIds=["def2","def3"];
    const threatOf=id=>{const a=A[id];return a?(a._ovr*0.55+(a.label==='WR'?12:a.label==='TE'?7:3)+a.spd/18):0;};
    const topThreat=wrIds.slice().sort((a,b)=>threatOf(b)-threatOf(a))[0];
    const defCoverageAvg=[...cbIds,...lbIds,...safetyIds].reduce((n,id)=>n+(A[id]?A[id]._cov:50),0)/7;
    const threatGap=(A[topThreat]?A[topThreat]._ovr:50)-defCoverageAvg;
    const bracketChance=isPass?Math.max(.10,Math.min(.82,.18+Math.max(0,threatGap)*.018+defCoverageAvg*.004)):0;
    let bracketTargetId=null, bracketHelperId=null;
    if(isPass&&rand()<bracketChance){
      bracketTargetId=(targetId&&wrIds.includes(targetId)&&rand()<.62)?targetId:topThreat;
      // Low-awareness defenses sometimes identify the wrong WR to double.
      if(rand()>Math.max(.30,Math.min(.94,defCoverageAvg/100))){
        const wrong=wrIds.filter(id=>id!==bracketTargetId); if(wrong.length)bracketTargetId=pick(wrong);
      }
      bracketHelperId=(concept==='deep'||airYd>=10)?pick(safetyIds):pick(lbIds.filter(id=>id!==blitzerId));
      events.push({t:0,type:"doubleCoverage",target:bracketTargetId,helper:bracketHelperId});
    }
    const manAssignments={};
    cbIds.forEach(id=>{
      const cb=A[id];
      const outside=wrIds.slice().sort((a,b)=>Math.abs(A[a].y-cb.y)-Math.abs(A[b].y-cb.y));
      manAssignments[id]=outside[0];
      cb._covTarget=outside[0]; cb._covNext=0;
      const low=Math.max(0,(58-cb._aware)/58);
      cb._mistakeAt=640+R(130,850); cb._mistakeUntil=cb._mistakeAt+R(180,520)*low;
      cb._mistakeTarget=pick(receiverIds.filter(r=>r!==cb._covTarget));
    });
    lbIds.forEach((id,idx)=>{
      const lb=A[id], skill=(lb._aware*.65+lb._cov*.35);
      lb._passReadDelay=(isPass?180:650)+(100-skill)*5.2+R(0,260)+(paFake?R(180,420):0);
      lb._dropDepth=dir*YD*(concept==='deep'?10:concept==='screen'?2:6+idx*.8);
      lb._dropAnnounced=false;
    });
    function cbCoverageTarget(cb){
      if(shell==='man')return manAssignments[cb.id]||topThreat;
      // Zone corners pass routes off and continuously match the most dangerous
      // receiver entering their third rather than standing in one spot.
      if(t<(cb._covNext||0)&&cb._covTarget)return cb._covTarget;
      cb._covNext=t+Math.max(90,310-cb._aware*2.1);
      const zoneTop=cb.y<MIDY;
      const candidates=receiverIds.filter(id=>zoneTop?A[id].y<MIDY+45:A[id].y>MIDY-45);
      cb._covTarget=(candidates.length?candidates:receiverIds).slice().sort((a,b)=>{
        const aa=A[a],bb=A[b];
        return (Math.abs(aa.y-cb.y)-threatOf(a)*.18)-(Math.abs(bb.y-cb.y)-threatOf(b)*.18);
      })[0];
      return cb._covTarget;
    }

    // ---- pre-snap motion man + play-action ----
    const motionId = pick(["off0","off1","off10"].filter(id=>id!==targetId));
    const motionToY = clampY(A[motionId].y + (A[motionId].y>MIDY?-1:1)*R(96,150));
    // ---- timeline simulation ----
    let t=0, phase="snap", done=false, motionDone=false, paDone=false, fdFired=false, tdFired=false, brokenLeft=(fx.miss?1:0)+(Math.abs(yards)>=15?1:0);
    const snapT=640; let dropT=isPass? (concept==="deep"?1050:concept==="screen"?800:750) : (concept==="draw"?820:concept==="scramble"?540:380);
    let commitT=Infinity;         // when defense keys the ball
    let carrierPath=null, carrierLen=0, carrierD=0, maxCarrierD=0, carrierDone=false, returner=null, oobPlanned=false, wrapped=false, epiUntil=0, mobIds=null;
    let closerId=null, tackleAt=null, racStart=0;

    // speed profile multiplier along carrier path (shifting speeds)
    function spdMult(f, open){
      if(concept==="breakaway"||concept==="deep"||scored)
        return f<0.18?1.15 : f<0.42?0.78 : f<0.85?1.42 : 1.1;   // burst-congest-burst
      if(concept==="stuff") return 0.85;
      if(wrapped) return f>0.92?0.34:0.5;   // v5: wrapped up — legs churning, being dragged down
      return f<0.3?1.08 : f<0.55?0.82 : 1.25;
    }
    function emit(type,extra){ events.push(Object.assign({t,type},extra||{})); }
    function record(){
      actors.forEach(a=>a.frames.push({t,x:Math.round(a.x*10)/10,y:Math.round(a.y*10)/10}));
      let bx,by,bh=0;
      if(ballFlight){
        const flight=ballFlight;
        const f=Math.max(0,Math.min(1,(t-flight.t0)/Math.max(1,flight.dur)));
        // Real throws leave fastest and give up a little speed to drag. The style only
        // changes visual progress; arrival time and the resolved play stay identical.
        const drag=flight.style==="bullet"?.04:flight.style==="lob"?.13:.08;
        const q=f*(1+drag-drag*f);
        bx=flight.x0+(flight.x1-flight.x0)*q; by=flight.y0+(flight.y1-flight.y0)*q;
        bh=Math.sin(f*Math.PI)*flight.arc;
        if(f>=1&&!flight.landed){
          flight.landed=true; const fin=flight.onLand;
          if(ballFlight===flight) ballFlight=null;
          fin&&fin();
        }
      } else if(ballCarrier&&A[ballCarrier]){ bx=A[ballCarrier].x; by=A[ballCarrier].y+4; }
      else { bx=Number.isFinite(ballPos?.x)?ballPos.x:A.off8.x; by=Number.isFinite(ballPos?.y)?ballPos.y:A.off8.y; bh=0; }
      if(!Number.isFinite(bx)||!Number.isFinite(by)||!Number.isFinite(bh)){ bx=A.off8.x; by=A.off8.y; bh=0; ballFlight=null; }
      ballPos={x:bx,y:by,h:bh};
      ballFrames.push({t,x:Math.round(bx*10)/10,y:Math.round(by*10)/10,h:Math.round(bh)});
    }
    function advanceSpeed(a,targetFrac,dt,turn,brakeScale){
      const accel=Math.max(1,Math.min(99,a._accRating||a._quick||a._ovr||55));
      const agility=Math.max(1,Math.min(99,a._agiRating||a._ovr||55));
      const burst=Math.max(1,Math.min(99,a._burstRating||accel));
      let frac=Math.max(0,(a._v||0)/Math.max(1,a.spd));
      const hardTurn=(turn||0)>TU("accelRestartTurn",.34);
      const wantsMove=targetFrac>.12;
      if(!wantsMove&&frac<TU("accelResetFrac",.08))a._launchReady=true;
      const turnEdge=hardTurn&&!a._hardTurning;
      if(a._launchAt==null||(wantsMove&&a._launchReady)||turnEdge){a._launchAt=t;a._launchReady=false;}
      a._hardTurning=hardTurn;
      if((turn||0)>.04){
        const loss=Math.max(.08,TU("turnLossBase",.30)-(agility-50)*TU("turnLossAgilityK",.0024));
        frac*=Math.max(TU("turnRetentionFloor",.54),1-(turn||0)*loss);
      }
      const launchAge=Math.max(0,t-(a._launchAt==null?t:a._launchAt));
      const launch=launchAge<TU("accelLaunchMs",260)
        ? Math.max(.80,Math.min(1.22,1+(burst-50)*TU("burstAccelK",.0042))):1;
      const accelRate=Math.max(.9,TU("accelBasePerSec",3.0)+(accel-50)*TU("accelRatingK",.040))*launch;
      const brakeRate=Math.max(1.2,TU("brakeBasePerSec",3.0)+(agility-50)*TU("brakeAgilityK",.020)+(accel-50)*TU("brakeAccelK",.006))*(brakeScale||1);
      const rolling=targetFrac>frac&&frac>.18&&launchAge>=TU("rollingReadyMs",132)?TU("rollingAccelScale",3.0):1;
      const rate=targetFrac>=frac?accelRate*rolling:brakeRate;
      frac+=Math.sign(targetFrac-frac)*Math.min(Math.abs(targetFrac-frac),rate*dt/1000);
      a._v=Math.max(0,frac*a.spd);a._speedFrac=frac;
      return a._v;
    }
    function moveToward(a,tx,ty,dt,mult){
      let dx=tx-a.x,dy=ty-a.y; const dist=Math.hypot(dx,dy);
      if(dist<0.5){advanceSpeed(a,0,dt,0,1);return;}
      dx/=dist; dy/=dist;
      // inertia: players can't turn on a dime at speed
      let turn=0;
      if(a._dx!=null){
        turn=Math.max(0,1-(dx*a._dx+dy*a._dy));
        const targetDx=dx,targetDy=dy;
        dx=dx*0.82+a._dx*0.18; dy=dy*0.82+a._dy*0.18;
        // Direction lock: inertia may soften a turn, but it may never make a player
        // travel opposite the requested target vector. This fixes right-moving
        // players briefly running left (and vice versa) after cuts.
        if(Math.abs(targetDx)>0.12 && Math.sign(dx)!==Math.sign(targetDx)) dx=targetDx;
        if(Math.abs(targetDy)>0.12 && Math.sign(dy)!==Math.sign(targetDy)) dy=targetDy;
        if(dx*targetDx+dy*targetDy<0.05){ dx=targetDx; dy=targetDy; }
        const n=Math.hypot(dx,dy)||1; dx/=n; dy/=n; }
      a._dx=dx; a._dy=dy;
      // v38: every movement context requests a target gear; acceleration and
      // braking reach it over time. Multipliers no longer teleport velocity.
      advanceSpeed(a,Math.max(0,Math.min(TU("choreoSpeedCap",2.15),mult||1)),dt,turn,1);
      const step=Math.min(dist,a._v*dt/1000);
      a.x+=dx*step; a.y+=dy*step;
    }
    function throwBall(fromA,toX,toY,dur,arc,onLand){
      ballCarrier=null;
      const origin=A[fromA]||{x:ballPos?.x||toX,y:ballPos?.y||toY};
      const safeDur=Math.max(180,Number.isFinite(dur)?dur:420);
      const safeX=Number.isFinite(toX)?toX:origin.x;
      const safeY=Number.isFinite(toY)?toY:origin.y;
      // A fresh immutable flight state for every throw prevents a previous pass
      // from leaking stale start/end coordinates into the next animation.
      const style=Number(arc)>=44?"lob":Number(arc)<=24?"bullet":"touch";
      ballFlight={id:(ballFlightSeq=(ballFlightSeq||0)+1),t0:t,dur:safeDur,x0:origin.x,y0:origin.y,x1:safeX,y1:safeY,arc:Math.max(4,Math.min(42,Number(arc)||18)),style,onLand,landed:false};
      ballPos={x:origin.x,y:origin.y,h:0};
      emit("throw",{x:origin.x,y:origin.y,tx:safeX,ty:safeY,style,flightId:ballFlight.id});
    }
    function startRAC(id, fromX, fromY){
      ballCarrier=id; racStart=t; commitT=Math.min(commitT,t);
      const remaining = (endX-fromX)*scoreDir;
      const tx = isFumble ? fumbleX : (scored&&reachedGoal) ? (scoreDir>0?PLAY_R+YD*5:PLAY_L-YD*5) : endX;
      let oobTy = null;
      if(!scored && !isFumble && Math.abs(remaining)>YD*6 && rand()<0.22){
        oobTy = rand()<0.5 ? SIDELINE_TOP : SIDELINE_BOT;
      }
      const ty = oobTy!=null ? oobTy : clampY(fromY + R(-40,40)*(Math.abs(remaining)>60?1:0.4));
      oobPlanned = oobTy!=null;
      const useCuts = Math.abs(remaining)>YD*5 ? cuts : [];
      carrierPath = weavePath(fromX,fromY,tx,ty,useCuts);
      carrierLen = pathLen(carrierPath); carrierD=0; carrierDone=false;
      // pick the closer: nearest fast defender (or offense on picks)
      const chaseSide = A[id].side==="off"?"def":"off";
      if (chaseSide==="def" && userDefId && !scored) {
        closerId = userDefId;                       // the game credited YOU — you make the stop
      } else {
        let best=null,bd=1e9;
        actors.filter(a=>a.side===chaseSide&&a.label!=="OL").forEach(a=>{
          const d=Math.hypot(a.x-tx,a.y-ty)/ (SPEED[a.label]/130);
          if(d<bd){bd=d;best=a;}
        });
        closerId=best?best.id:null;
      }
      tackleAt={x:tx,y:ty,startT:t,eta: t + (carrierLen/(A[id].spd*1.05))*1000 };
    }

    let looseBall=null, pullerId=null, stuntPair=null, qbHitAt=0;
    // v4: pocket collapse — on pass plays one rusher eventually sheds his block and hunts the ball
    let shedId=null; const shedAt = (isPass&&!isSack) ? snapT+TU("shedDelay",430)+R(140,TU("shedRand",520)) : Infinity;   // v8: edges win EARLY
    let shedId2=null; const shed2At = shedAt + TU("shed2Gap",280) + R(140,380);                             // and a second man can follow
    let flushT=0, flushBy=null, wound=false;
    let qbHitChase=0;
    let flyConverge=null, flyConverge2=null, flyHandfight=false, flyHighpoint=false;   // WR and CB both attack and contest the ball
    // v5: pancake plan — RARE and earned; flattening a rusher stuns him and frees the blocker to double-team
    let pancakePlan=null;
    if(!isKick&&!payload.penalty&&!isSack){
      let pch = fx.pancake ? 0.9 : (payload.event==="run" ? TU("pancakeRun",0.07) : TU("pancakePass",0.04));
      try {
        if (root.__getGridironState) {
          const _s2=root.__getGridironState(), _p2=_s2&&_s2.player;
          if(_p2&&_p2.pos==="OL"&&usOff&&featured.isMe){
            const _a2=_p2.attrs||{}, _opp=(_s2._liveGame&&(_s2._liveGame.oppOvr||(_s2._liveGame.opp&&_s2._liveGame.opp.ovr)))||55;
            pch=Math.max(0.03,Math.min(0.4, 0.06+(((_a2.blocking||18)*0.6+(_a2.strength||18)*0.4)/40)*0.3-(_opp-40)/280));
          }
        }
      } catch (e) {}
      if(rand()<pch){
        const _ol=pick(["off3","off4","off5","off6","off7"]);
        const _inv={off3:"def7",off4:"def8",off5:"def8",off6:"def9",off7:"def10"};
        pancakePlan={t:snapT+R(280,950), by:_ol, who:_inv[_ol], done:false};
      }
    }
    function pursue(a){
      if(looseBall){ moveToward(a, looseBall.x, looseBall.y, TICK, 1.05); return; }
      const c=A[ballCarrier||"off8"];
      if(a.id===closerId&&tackleAt){
        const rem=Math.max(1,(tackleAt.eta-t));
        const need=Math.hypot(tackleAt.x-a.x,tackleAt.y-a.y);
        moveToward(a, c.x, c.y, TICK, Math.min(TU("paceV151D",1)?TU("choreoCloseMultV151D",1.35):2.1, Math.max(0.8, (need/(a.spd*rem/1000))||1)));   // v151 D: the choreographed closer runs at most his own sprint, not 2.1x it
      } else {
        const L=root.__computeLead(c.x,c.y,c.vx||0,c.vy||0,a.x,a.y,a.spd);
        // v8: a rusher who broke free SPRINTS at a QB still holding the ball
        const sprint=(a.id===shedId||a.id===shedId2)&&ballCarrier==="off8";
        moveToward(a, L.x, L.y, TICK, sprint?1.24:1);
        // broken-tackle attempt: lunge, get stiff-armed, go down
        if(brokenLeft>0 && t>a.beatenUntil && Math.hypot(a.x-c.x,a.y-c.y)<15 && !carrierDone
           && a.id!==userDefId){
          brokenLeft--; a.beatenUntil=t+750;
          emit("brokenTackle",{who:a.id,x:a.x,y:a.y});
        }
      }
    }
    // main loop
    const HARD_CAP = scored ? 9000 : 7000;
    while(!done && t<HARD_CAP){
      const dt=TICK; t+=dt;
      // v4: a pass-rusher breaks free once the pocket has been collapsing long enough
      if(t>=shedAt&&!shedId&&ballCarrier&&A[ballCarrier].side==="off"){
        let _pool=["def7","def8","def9","def10"].filter(id=>(!stuntPair||(id!==stuntPair.a&&id!==stuntPair.b))
          &&!(A[id].stunUntil&&t<A[id].stunUntil+400)&&!(A[id]._doubled&&t-A[id]._doubled<300));
        const _des=_pool.filter(id=>A[id].label==="DE");
        _pool=_pool.concat(_des,_des);                               // v8: edges win the corner FAR more often
        if(_pool.length){ shedId=pick(_pool); emit("shed",{who:shedId,x:A[shedId].x,y:A[shedId].y}); }
      }
      // v9: flight convergence — the receiver/interceptor/returner arrives WITH the ball, never snapped to it
      // v13: the contesting player attacks the same ball a hair slower — a real 50/50
      if(ballFlight&&flyConverge2&&A[flyConverge2]){
        const bf2=ballFlight, tl2=Math.max(16,(bf2.t0+bf2.dur)-t), a8=A[flyConverge2];
        const d8=Math.hypot(bf2.x1-a8.x,bf2.y1-a8.y);
        if(d8>6){
          const need2=d8/tl2*1000;
          if(need2>a8.spd*0.35){
            const sp2=Math.min(TU("convergeCap",300)*0.92, Math.max(need2, 40));
            const st2=Math.min(d8-5, sp2*dt/1000);
            a8.x+=(bf2.x1-a8.x)/d8*st2; a8.y+=(bf2.y1-a8.y)/d8*st2; a8._cvg=t;
          }
        }
      }
      if(!ballFlight) flyConverge2=null;
      if(ballFlight&&flyConverge&&A[flyConverge]){
        const bf=ballFlight, tl=Math.max(16,(bf.t0+bf.dur)-t), a9=A[flyConverge];
        const d9=Math.hypot(bf.x1-a9.x,bf.y1-a9.y);
        if(d9>0.5){
          const need=d9/tl*1000;
          if(need>a9.spd*0.35){                                   // only hustle when the route won't get him there
            const sp=Math.min(TU("convergeCap",300), Math.max(need*1.04, 40));      // hard cap: nobody moves faster than 300 px/s
            const stp=Math.min(d9, sp*dt/1000);
            a9.x+=(bf.x1-a9.x)/d9*stp; a9.y+=(bf.y1-a9.y)/d9*stp; a9._cvg=t;
          }
        }
      }
      if(!ballFlight) flyConverge=null;
      if(ballFlight&&flyConverge&&flyConverge2&&A[flyConverge]&&A[flyConverge2]){
        const _bf=ballFlight, _left=Math.max(0,_bf.t0+_bf.dur-t);
        const _a=A[flyConverge], _b=A[flyConverge2];
        const _ad=Math.hypot(_bf.x1-_a.x,_bf.y1-_a.y), _bd=Math.hypot(_bf.x1-_b.x,_bf.y1-_b.y);
        if(!flyHandfight&&_ad<38&&_bd<38&&_left>120){
          flyHandfight=true; emit("handfight",{off:_a.side==="off"?_a.id:_b.id,def:_a.side==="def"?_a.id:_b.id,x:_bf.x1,y:_bf.y1});
        }
        if(!flyHighpoint&&_left<=260){
          flyHighpoint=true; emit("highpoint",{off:_a.side==="off"?_a.id:_b.id,def:_a.side==="def"?_a.id:_b.id,x:_bf.x1,y:_bf.y1,deep:Math.abs(_bf.x1-_bf.x0)>YD*12});
        }
      }
      // v8: a second rusher can break free while the QB holds the ball
      if(shedId&&!shedId2&&t>=shed2At&&ballCarrier==="off8"&&isPass&&!isSack){
        let _p2=["def7","def8","def9","def10"].filter(id=>id!==shedId
          &&!(A[id].stunUntil&&t<A[id].stunUntil+400)&&!(A[id]._doubled&&t-A[id]._doubled<300)
          &&(!stuntPair||(id!==stuntPair.a&&id!==stuntPair.b)));
        _p2=_p2.concat(_p2.filter(id=>A[id].label==="DE"));
        if(_p2.length&&rand()<0.5){ shedId2=pick(_p2); emit("shed",{who:shedId2,x:A[shedId2].x,y:A[shedId2].y}); }
      }
      // v5: pancake lands — the rusher is STUNNED flat, his blocker peels off free
      if(pancakePlan&&!pancakePlan.done&&t>=pancakePlan.t){
        pancakePlan.done=true;
        const _dl=A[pancakePlan.who];
        if(_dl&&pancakePlan.who!==shedId&&!(ballCarrier&&A[ballCarrier].side==="def")){
          _dl.stunUntil=t+TU("stunMs",1450)+R(0,650); _dl._gotUp=false; _dl._v=0;
          A[pancakePlan.by]._free=true;
          emit("pancake",{who:pancakePlan.who,by:pancakePlan.by,x:_dl.x,y:_dl.y});
        }
      }
      // ---------- phases ----------
      if(phase==="snap"){
        if(!motionDone){ if(t<80){ emit("motion",{who:motionId}); if(blitzerId) emit("blitzLook",{who:blitzerId}); } motionDone="going";
        }
        if(blitzerId){ const bz=A[blitzerId]; moveToward(bz, losX+dir*10, bz.y, dt, 0.9); }
        if(motionDone==="going"){ moveToward(A[motionId], A[motionId].x, motionToY, dt, 1.15);
          if(Math.abs(A[motionId].y-motionToY)<4) motionDone=true; }
        if(t>=snapT){ ballCarrier="off8"; emit("snap",{x:losX});
          if(isSack){ stuntPair={a:"def8",b:"def9",until:t+880}; emit("stunt",{a:"def8",b:"def9"}); } phase= isKick?"kick": (isPass||concept==="draw"||concept==="sack"||concept==="scramble")?"drop":"handoff"; }
      }
      else if(phase==="kick"){
        if(payload.event==="fg"){
          const good = scored || (/GOOD|MADE|SPLITS/.test(desc)&&!/NO GOOD|MISS|WIDE/.test(desc));
          const ux = dir>0?PLAY_R+YD*7:PLAY_L-YD*7;
          const uy = good? MIDY+R(-14,14) : MIDY+pick([-1,1])*R(56,84);
          throwBall("off8",ux,uy, Math.max(760,Math.abs(ux-A.off8.x)*3.0), 150, ()=>{ emit("fgResult",{good,x:ux,y:uy}); emit("land",{x:ux,y:uy}); done=true; });
          emit("kick",{fg:true,upx:ux});
        } else {
          const landX = endX - dir*Math.min(6*YD, Math.abs(endX-A.off8.x)*0.3), landY = clampY(MIDY+R(-50,50));
          returner = nearestDef(landX, landY);
          flyConverge=returner.id;
          // v22: give the punt real hang time so the returner (flyConverge) SPRINTS
          // under it and arrives on his own — no teleport across the field to the ball.
          throwBall("off8",landX,landY, Math.max(TU("puntHang",1150),Math.abs(landX-A.off8.x)*3.4), 170, ()=>{
            emit("land",{x:landX,y:landY});
            if(Math.abs(endX-landX)<YD*2.2){ emit("faircatch",{x:landX,y:landY}); done=true; }
            else {
              // catch where he actually got to; nudge only the last couple px (never a jump)
              const cdx=landX-returner.x, cdy=landY-returner.y, cd=Math.hypot(cdx,cdy);
              if(cd>1){ const cap=Math.min(cd,TU("puntCatchNudge",22)); returner.x+=cdx/cd*cap; returner.y+=cdy/cd*cap; }
              emit("puntCatch",{by:returner.id,x:returner.x,y:returner.y});
              startRAC(returner.id, returner.x, returner.y); phase="carry"; }
          });
          emit("kick",{});
        }
        if(phase==="kick") phase="fly";
      }
      else if(phase==="drop"){
        // QB drops; receivers run routes; pocket forms
        // v8: FLUSHED — a free rusher bearing down forces the QB to scramble from the pocket
        if(!isSack&&concept!=="scramble"&&!flushT&&t<snapT+dropT){
          const fr=[shedId,shedId2,blitzerId].map(id=>id&&A[id]).find(r=>r&&t>=(r.beatenUntil||0)&&Math.hypot(r.x-A.off8.x,r.y-A.off8.y)<TU("flushRadius",44));
          if(fr){ flushT=t; flushBy=fr.id; dropT=dropT+R(240,430);      // buys time on the move
            emit("flush",{x:A.off8.x,y:A.off8.y,by:fr.id}); }
        }
        if(flushT&&t<snapT+dropT&&!(paFake&&!paDone&&t<snapT+300)){
          const rr=A[flushBy];
          const escY=rr?(A.off8.y>=rr.y?1:-1):(A.off8.y>MIDY?1:-1);
          moveToward(A.off8, losX-dir*12, clampY(A.off8.y+escY*30), dt, 1.02);   // roll out away from the heat
        } else if(paFake&&!paDone&&t<snapT+300){
          moveToward(A.off8, A.off9.x+dir*8, A.off9.y, dt, 0.9);      // sell the mesh
          moveToward(A.off9, losX+dir*6, A.off9.y, dt, 0.9);          // RB into the line
          if(t>=snapT+220){ paDone=true; emit("playfake",{x:A.off8.x,y:A.off8.y}); }
        } else
        moveToward(A.off8, losX-dir*34, A.off8.y, dt, 0.8);
        // v13: throwing motion — QB winds up ~300ms before release and steps into the throw.
        // If he was flushed, the rollout drift carries through: he throws on the move.
        if(!wound&&isPass&&!isSack&&t>=snapT+dropT-300){ wound=true; emit("windup",{x:A.off8.x,y:A.off8.y}); }
        if(wound&&t<snapT+dropT) moveToward(A.off8, A.off8.x+dir*5, A.off8.y, dt, 0.16);
        if(t>=snapT+dropT){
          if(concept==="scramble"){ emit("scramble",{x:A.off8.x,y:A.off8.y}); startRAC("off8",A.off8.x,A.off8.y); phase="carry"; }
          else if(concept==="draw"){ ballCarrier="off9"; A.off9.x=A.off8.x+dir*6; emit("handoff",{delay:true}); startRAC("off9",A.off9.x,A.off9.y); phase="carry"; }
          else if(isSack){ phase="sackrush"; commitT=t;
            closerId = userDefId || pick(["def7","def10","def4"]);
            emit("pressure",{}); }
          else {
            // throw to target's route end (or pick point)
            const rp=targetRoute[targetRoute.length-1];
            let dur=Math.max(390, Math.hypot(rp.x-A.off8.x,rp.y-A.off8.y)*(concept==="deep"?5.25:4.35));
            // v9: the QB puts AIR under the ball so his man can get there — flight respects the receiver's distance
            const strFly=(du,a2)=>Math.min(1800, Math.max(du, Math.hypot(rp.x-a2.x,rp.y-a2.y)*TU("leadAir",4.8)));
            const arc= concept==="deep"?64: concept==="screen"?10:34;
            if(isPick&&rand()<0.4){
              // tipped at the second level, then picked off
              const lb = A[pick(["def4","def5","def6"])];
              const tipX=(A.off8.x+rp.x)/2, tipY=clampY((A.off8.y+rp.y)/2+R(-16,16));
              const db = nearestDef(rp.x,rp.y);
              flyConverge=lb.id;
              throwBall("off8",tipX,tipY,dur*0.5,arc*0.7,()=>{
                emit("tip",{x:tipX,y:tipY,by:lb.id});
                flyConverge=db.id;
                ballFlight={t0:t,dur:Math.max(240,dur*0.35),x0:tipX,y0:tipY,x1:rp.x,y1:rp.y,arc:16,onLand:()=>{
                  emit("pick",{by:db.id,x:rp.x,y:rp.y});
                  db.x=rp.x; db.y=rp.y;
                  startRAC(db.id, rp.x, rp.y);
                  phase="carry";
                }};
              });
            } else if(isPick){
              const db = nearestDef(rp.x,rp.y);
              // v13: OFF-TARGET throw — the ball sails toward the defender's side, so it is
              // HIS ball to win. The receiver still fights for it, and loses this one.
              const px9=rp.x+Math.sign(db.x-rp.x||1)*8, py9=clampY(rp.y+Math.sign(db.y-rp.y||1)*8);
              dur=strFly(dur,db);
              flyConverge=db.id;
              flyConverge2=targetId;
              emit("contest",{def:db.id,off:targetId,x:px9,y:py9});
              throwBall("off8",px9,py9,dur,arc,()=>{
                emit("pick",{by:db.id,x:px9,y:py9});
                db.x=px9; db.y=py9;
                // return the other way
                const retYd = usOff? endYd : 100-endYd; // endBall already reflects post-return spot
                startRAC(db.id, px9, py9);
                phase="carry";
              });
            } else if(payload.event==="incomplete"){
              if(rand()<0.4) qbHitAt=t+130;   // throw under duress
              dur=strFly(dur,A[targetId]);
              flyConverge=targetId;
              throwBall("off8",rp.x+R(-14,14),rp.y+R(-16,16),dur,arc,()=>{ emit("incomplete",{x:rp.x,y:rp.y}); done=true; });
            } else {
              dur=strFly(dur,A[targetId]);
              flyConverge=targetId;
              const db2=nearestDef(rp.x,rp.y);
              if(db2){ flyConverge2=db2.id; emit("contest",{def:db2.id,off:targetId,x:rp.x,y:rp.y}); }
              throwBall("off8",rp.x,rp.y,dur,arc,()=>{
                emit("catch",{by:targetId,x:rp.x,y:rp.y,catchType:concept==="deep"?(rand()<0.22?"dive":"high"):"secure"});
                if(rp.y<=F_TOP+44||rp.y>=F_BOT-40) emit("toetap",{x:rp.x,y:rp.y});
                A[targetId].x=rp.x; A[targetId].y=rp.y;
                startRAC(targetId,rp.x,rp.y);
                phase="carry";
              });
            }
            phase="fly";
          }
        }
      }
      else if(phase==="handoff"){
        if(t>=snapT+dropT){ ballCarrier="off9";
          emit("handoff",{});
          let sweepY=null;
          if(concept==="sweep"){ sweepY=clampY(A.off9.y+pick([-1,1])*R(46,70)); pullerId=pick(["off3","off7"]); emit("pull",{who:pullerId}); }
          startRAC("off9",A.off9.x,A.off9.y); phase="carry";
          if(sweepY!=null){ carrierPath.splice(1,0,{x:A.off9.x+dir*12,y:sweepY}); carrierLen=pathLen(carrierPath); }
        } else { moveToward(A.off8, losX-dir*14, A.off8.y+8, dt, 0.7); }
      }
      else if(phase==="sackrush"){
        const qb=A.off8, cl=A[closerId];
        moveToward(qb, endX, qb.y+Math.sin(t/180)*6, dt, 0.55);      // QB retreats to sack spot
        moveToward(cl, qb.x, qb.y, dt, 1.35);                          // rusher sheds & closes
        if(Math.hypot(cl.x-qb.x,cl.y-qb.y)<8 && (qb.x-endX)*dir<4){
          emit("tackle",{tackler:closerId,carrier:"off8",x:qb.x,y:qb.y,sack:true});
          done=true;
        }
      }
      else if(phase==="fly"){
        if(qbHitAt&&t>=qbHitAt){ emit("qbHit",{x:A.off8.x,y:A.off8.y}); qbHitAt=0; qbHitChase=t+520; }
        if(qbHitChase&&t<qbHitChase) moveToward(A.def8, A.off8.x-dir*6, A.off8.y, dt, 1.6);   // v9: he CHARGES, not teleports
      }
      else if(phase==="epilogue"){
        const hitCarrier=ballCarrier&&A[ballCarrier];
        if(hitCarrier&&hitCarrier._hitUntil&&t<hitCarrier._hitUntil){
          const decay=Math.max(0,1-(t-hitCarrier._hitStart)/Math.max(1,hitCarrier._hitUntil-hitCarrier._hitStart));
          hitCarrier.x=clampX(hitCarrier.x+hitCarrier._hitVx*decay*dt/1000);
          hitCarrier.y=clampY(hitCarrier.y+hitCarrier._hitVy*decay*dt/1000);
          if(hitCarrier._dragTackler&&A[hitCarrier._dragTackler]){
            const dragger=A[hitCarrier._dragTackler];
            const settle=1-Math.max(0,Math.min(1,decay));
            dragger.x=clampX(hitCarrier.x+(hitCarrier._dragOffsetX||-7)*(1-settle*.35));
            dragger.y=clampY(hitCarrier.y+(hitCarrier._dragOffsetY||0)*(1-settle*.35));
            dragger._v=Math.max(0,(hitCarrier._v||0)*decay*.72);
          }
        }
        if(mobIds){ mobIds.forEach(id=>{ const m=A[id], c=A[ballCarrier]; if(c) moveToward(m, c.x+R(-14,14), c.y+R(-14,14), dt, 1.1); }); }
        // v18: no freeze-frame at the whistle — everyone else keeps drifting along
        // their last vector and bleeds speed off naturally for ~1s after the play dies
        actors.forEach(a=>{
          if(a.id===ballCarrier) return;
          if(hitCarrier&&hitCarrier._dragTackler===a.id) return;
          if(mobIds&&mobIds.includes(a.id)) return;
          const v=advanceSpeed(a,0,dt,0,TU("whistleBrakeScale",.46));
          if(v>2&&a._dx!=null){ a.x=clampX(a.x+a._dx*v*dt/1000); a.y=clampY(a.y+a._dy*v*dt/1000); }
        });
        if(t>=epiUntil) done=true;
        record(); continue;   // the whistle has blown — but bodies still coast down
      }
      else if(phase==="loose"){
        // v15.20: the football visibly pops free, tumbles, and remains live long enough
        // for players from BOTH teams to react instead of recovering instantly.
        const looseAge=t-(looseBall.t0||t);
        const hop=Math.abs(Math.sin(looseAge/72));
        looseBall.x += (endX-looseBall.x)*0.045;
        looseBall.y = clampY(looseBall.y + Math.sin(looseAge/48)*0.75 + R(-1.15,1.15));
        ballPos={x:looseBall.x,y:looseBall.y,h:6+hop*Math.max(7,22-looseAge*0.012)};
        if(looseAge>=860 && Math.abs(looseBall.x-endX)<8){
          // Preserve the authoritative result: defense recovers, but the winning player
          // has already been pursuing the loose ball during the live scramble.
          const side = "def";
          let best=null,bd=1e9;
          if (userDefId && /RECOVER|SCOOP/.test(desc)) best=A[userDefId];
          else actors.filter(a=>a.side===side&&a.label!=="OL")
            .forEach(a=>{const d=Math.hypot(a.x-looseBall.x,a.y-looseBall.y);if(d<bd){bd=d;best=a;}});
          if(best){ moveToward(best,looseBall.x,looseBall.y,TICK,1.3); best.x=looseBall.x; best.y=looseBall.y; }
          emit("recover",{by:best?best.id:null,side,x:looseBall.x,y:looseBall.y});
          looseBall=null; done=true;
        }
      }
      else if(phase==="carry"){
        const c=A[ballCarrier];
        const f=carrierD/Math.max(1,carrierLen);
        // v4 realism: contact slows the carrier — defenders in arm's reach force him to fight for yards
        let contactMult=1, threat=null, tdist=1e9;
        actors.forEach(dv=>{ if(dv.side===c.side||dv.label==="OL"||t<dv.beatenUntil||dv.id===ballCarrier) return;
          const d2=Math.hypot(dv.x-c.x,dv.y-c.y); if(d2<tdist){tdist=d2;threat=dv;} });
        // Count the hands actually gripping the carrier and how strong that pile is.
        const pwrOf=a=>a._pwr!=null?a._pwr:(["LB","DE","DT"].includes(a.label)?0.76:["RB","TE","QB"].includes(a.label)?0.66:0.50);
        let nNear=0, gripStr=0;
        if(threat&&tdist<12){ actors.forEach(dv=>{ if(dv.side===c.side||dv.label==="OL"||t<dv.beatenUntil||(dv.stunUntil&&t<dv.stunUntil)) return;
          if(Math.hypot(dv.x-c.x,dv.y-c.y)<12){ nNear++; gripStr+=pwrOf(dv); } }); }
        const avgGrip = nNear?gripStr/nNear:0;
        const carrierStr = pwrOf(c);
        const spdFrac = Math.min(1.2, spdMult(f));            // ~how close to full speed the carrier is
        // A CLEAR strength mismatch: the ball carrier is notably stronger than the
        // hands on him, so he shrugs the grab and drags the pile for extra time.
        const strongCarrier = (carrierStr - avgGrip) > TU("gangMismatch",0.22);
        if(threat&&tdist<12){ contactMult=TU("contactSlow",0.5)+(c._pwr||0)*0.22;
          // More hands = the carrier's speed dies faster. Two men grabbing a
          // full-speed runner rip most of that speed away; three collapse it.
          if(nNear>=2) contactMult*=(strongCarrier?0.60:0.44);   // two men on you — speed drops fast
          if(nNear>=3) contactMult*=(strongCarrier?0.66:0.46);   // three: even faster — barely moving
          // the faster he was going, the more of that momentum the grab steals
          contactMult*=1-Math.min(0.45,(nNear-1)*0.16*spdFrac*(strongCarrier?0.5:1));
          contactMult=Math.max(TU("pileFloor",0.30),contactMult);               // but the pile always inches forward
          if(nNear>=2&&!c._grabStart) c._grabStart=t;          // stamp when the multi-grab began
          if(!c._cts||t-c._cts>430){ c._cts=t; emit("contact",{x:c.x,y:c.y,by:threat.id,carrier:ballCarrier,gang:nNear>=2,grabbers:nNear}); } }
        else if(threat&&tdist<26) contactMult=0.82;
        else c._grabStart=0;                                   // lost the grip — reset the pull-down clock
        // ===== TACKLE MOTION + WHIFF =========================================
        // The closing defender commits a diving/wrapping tackle. He can WHIFF on
        // a shifty, full-speed back — but COMMITTING is what brings runners down:
        // a landed lunge wraps him early, and even a whiff staggers the carrier so
        // support cleans up. Attempting the tackle increases the odds of a stop.
        if(closerId&&A[closerId]&&!carrierDone&&!scored&&!isFumble&&phase==="carry"
           &&!c._lungeDone&&carrierD<carrierLen-0.5*YD){
          const cl=A[closerId], dCar=Math.hypot(cl.x-c.x,cl.y-c.y);
          if(dCar<TU("lungeReach",15)&&t>cl.beatenUntil){
            c._lungeDone=true;
            const support=actors.filter(a=>a.side!==c.side&&a.label!=="OL"&&a.id!==closerId
              &&t>a.beatenUntil&&!(a.stunUntil&&t<a.stunUntil)&&Math.hypot(a.x-c.x,a.y-c.y)<TU("supportReach",66));
            const clTk=pwrOf(cl);
            const evadeBase=(c._agi!=null?c._agi:(["RB","WR","CB","S","QB"].includes(c.label)?0.62:0.5));
            const whiffP=Math.max(0.05,Math.min(0.7, 0.26+evadeBase*0.40-clTk*0.40+spdFrac*0.14));
            emit("tackleLunge",{who:closerId,carrier:ballCarrier,x:cl.x,y:cl.y});
            if(closerId!==userDefId&&support.length&&rand()<whiffP){
              // WHIFF — dives past, gets beaten; nearest support becomes the closer.
              cl.beatenUntil=t+TU("whiffMs",600);
              emit("tackleWhiff",{who:closerId,carrier:ballCarrier,x:cl.x,y:cl.y});
              let nb=null,nd=1e9;
              support.forEach(a=>{const d=Math.hypot(a.x-c.x,a.y-c.y);if(d<nd){nd=d;nb=a;}});
              if(nb) closerId=nb.id;
              c._lungeStagger=t+TU("staggerMs",240);           // the attempt still chips him
            } else {
              // LANDED — the wrap begins early and drags him to the spot.
              wrapped=true;
              emit("tackleHit",{who:closerId,carrier:ballCarrier,x:cl.x,y:cl.y});
              c._lungeStagger=t+TU("staggerMs",240);
            }
          }
        }
        if(c._lungeStagger&&t<c._lungeStagger) contactMult*=0.5;  // committing a tackle increases the odds
        // Gang-tackle pull-down: two or three defenders drive the runner back and
        // wrestle him down. Three men bring a full-speed back down inside ~1s;
        // two men take longer — and a clearly stronger carrier drags the pile.
        // maxCarrierD remains the forward-progress spot even while the body is pushed back.
        // v29: group pushes are the EXCEPTION — only short-yardage concepts pile up by
        // default; in space a second man arriving stays a clean assist, not a scrum.
        const pileConcept=(concept==="dive"||concept==="stuff");
        if(!scored&&!isFumble&&nNear>=2&&carrierD>=carrierLen-4.2*YD&&(pileConcept||(c._pushRoll==null&&(c._pushRoll=rand())<TU("pilePushP",0.3)))){
          if(!c._pushStart){
            const pullMs=(nNear>=3?TU("pull3Ms",700):TU("pull2Ms",1300))*(strongCarrier?1.9:1);
            c._pushStart=t; c._pushUntil=t+pullMs; c._pushDefenders=nNear; c._pushStrong=strongCarrier;
            maxCarrierD=Math.max(maxCarrierD,carrierD); wrapped=true;
            emit("pushback",{x:c.x,y:c.y,carrier:ballCarrier,defenders:nNear,strong:strongCarrier,forwardProgress:maxCarrierD});
          }
        }
        if(c._pushUntil&&t<c._pushUntil){
          // a strong carrier still churns forward against 2; otherwise the pile drives him
          // back — v29: the grip-vs-carrier STRENGTH gap sets how hard the pile moves
          const strGap=Math.max(-0.3,Math.min(0.45,(avgGrip-carrierStr)*2));
          const pushRate=(c._pushDefenders>=3?5.4:3.2)*YD*(c._pushStrong?0.35:1)*(1+strGap);
          carrierD=Math.max(0,carrierD+(c._pushStrong&&c._pushDefenders<3?0.4:-1)*pushRate*dt/1000);
          maxCarrierD=Math.max(maxCarrierD,carrierD);
          advanceSpeed(c,TU("pileSpeedFrac",.12),dt,0,1.55);
          contactMult=0;
        } else {
          // The fallback carrier used to bypass movement acceleration entirely.
          // Follow the path's real heading and request a gear so launches, cuts,
          // contact slowdowns and re-acceleration use the same curve as everyone else.
          const ahead=pointAt(carrierPath,Math.min(carrierLen,carrierD+Math.max(8,(c._v||0)*dt/500)));
          let pdx=ahead.x-c.x,pdy=ahead.y-c.y,pn=Math.hypot(pdx,pdy)||1;pdx/=pn;pdy/=pn;
          const pturn=c._dx==null?0:1-Math.max(-1,Math.min(1,pdx*c._dx+pdy*c._dy));
          c._dx=pdx;c._dy=pdy;
          const carrySpeed=advanceSpeed(c,Math.max(0,spdMult(f)*contactMult),dt,pturn,contactMult<.8?1.45:1);
          carrierD += carrySpeed*dt/1000;
          maxCarrierD=Math.max(maxCarrierD,carrierD);
          if(c._pushUntil&&!c._pushFinished){
            c._pushFinished=true; carrierDone=true;
            const fp=pointAt(carrierPath,Math.min(maxCarrierD,carrierLen));
            emit("forwardprogress",{x:fp.x,y:fp.y,carrier:ballCarrier,spot:maxCarrierD});
            emit("tackle",{tackler:threat?threat.id:closerId,carrier:ballCarrier,x:c.x,y:c.y,gang:true,pushback:true,forwardProgress:maxCarrierD});
            phase="epilogue"; epiUntil=t+1000;
          }
        }
        const p=pointAt(carrierPath,Math.min(carrierD,carrierLen));
        const prevCarryX=c.x, prevCarryY=c.y;
        // fire cut events when passing cut waypoints
        carrierPath.forEach((wp,i)=>{
          if(wp.cut&&!wp.cut.fired){
            const dPast=pointAt(carrierPath,carrierD);
            if(dPast.seg>i){ wp.cut.fired=true; emit("cut",{kind:wp.cut.type,x:wp.x,y:wp.y,carrier:ballCarrier});
              // A cut has direction and defenders must diagnose it. Low-awareness/
              // discipline pursuers false-step down the old angle; elite defenders
              // stay square. The primary closer is eligible too — no magnet tackle.
              const chaseSide=c.side==="off"?"def":"off";
              const oldDx=c._dx||scoreDir, oldDy=c._dy||0;
              actors.filter(a=>a.side===chaseSide&&a.label!=="OL")
                .sort((a,b)=>Math.hypot(a.x-wp.x,a.y-wp.y)-Math.hypot(b.x-wp.x,b.y-wp.y)).slice(0,2)
                .forEach((nb,rank)=>{ const nd=Math.hypot(nb.x-wp.x,nb.y-wp.y), iq=(nb._aware||50)*.55+(nb._disc||50)*.45;
                  const bite=Math.max(.05,Math.min(.66,.18+((c._agi||.55)*100-iq)*.007-rank*.08));
                  if(nd<76&&rand()<bite){ nb.beatenUntil=t+Math.round(310+(70-iq)*4); nb.vx=oldDx*nb.spd*.72; nb.vy=oldDy*nb.spd*.72;
                    emit("badAngle",{who:nb.id,x:nb.x,y:nb.y,reason:"juke",delay:Math.round(nb.beatenUntil-t)}); } });
            }
          }
        });
        c.vx=(p.x-c.x)/dt*1000; c.vy=(p.y-c.y)/dt*1000;
        c.x=p.x; c.y=p.y;
        // The instant the ball carrier breaks the plane is the touchdown. Stop
        // the return/run choreography there instead of waiting for an arbitrary
        // end-zone waypoint (especially important on pick-sixes).
        const goalPlane=scoreDir>0?PLAY_R:PLAY_L;
        if(phase==="carry"&&scored&&reachedGoal&&!tdFired&&
          crossedPlane(prevCarryX,c.x,goalPlane,scoreDir)){
          const gp=planePoint(prevCarryX,prevCarryY,c.x,c.y,"x",goalPlane);
          // Keyframes are stored to tenths. Snap the last sub-tenth to the plane
          // so the visible marker and scoring event can never disagree by a frame.
          if((c.x-goalPlane)*scoreDir<0){c.x=goalPlane;c.y=gp.y;}
          tdFired=true; carrierDone=true;
          emit("td",{x:gp.x,y:gp.y,carrier:ballCarrier,plane:"goal"});
          mobIds = actors.filter(a=>a.side===c.side&&a.id!==ballCarrier&&a.label!=="OL")
            .sort((p,q)=>Math.hypot(p.x-c.x,p.y-c.y)-Math.hypot(q.x-c.x,q.y-c.y)).slice(0,3).map(a=>a.id);
          phase="epilogue"; epiUntil=t+1000;
        }
        // v4 realism: subtle open-field avoidance — the carrier bends his path away from contact
        if(threat&&tdist<30&&!carrierDone&&!wrapped&&!scored){
          const away=c.y>=threat.y?1:-1; c.y=clampY(c.y+away*Math.min(2.1,(30-tdist)*0.08));
        }
        if(!fdFired && c.side==="off" && !isPick && (c.x-firstDownX)*dir>=0 && !scored){
          fdFired=true; emit("firstdown",{x:firstDownX,y:c.y});
        }
        if(isFumble && !carrierDone && (c.x-fumbleX)*dir>=-2){
          carrierDone=true;
          let forcer=null;
          if(userDefId){ forcer=A[userDefId]; forcer.x=c.x-dir*7; forcer.y=c.y+R(-4,4); }
          emit("fumble",{x:c.x,y:c.y,by:ballCarrier,forcedBy:forcer?forcer.id:null});
          looseBall={x:c.x,y:c.y,t0:t}; ballCarrier=null; phase="loose"; continue;
        }
        // gang tackle: get wrapped up two yards shy, dragged to the spot
        const inTraffic = (concept==="dive"||concept==="stuff") && !scored && !isFumble;
        if(inTraffic && !wrapped && carrierD>=carrierLen-2.6*YD){
          wrapped=true; emit("wrap",{x:c.x,y:c.y});
        }
        if(phase==="carry"&&carrierD>=carrierLen&&!carrierDone){
          carrierDone=true;
          if(scored&&reachedGoal&&!tdFired){
            // Degenerate fallback (for example a catch already sitting on the
            // plane): the scoring event still belongs to the exact goal line.
            const gx=scoreDir>0?PLAY_R:PLAY_L;
            emit("td",{x:gx,y:c.y,carrier:ballCarrier,plane:"goal"}); tdFired=true;
            // TD mob: nearest teammates converge
            mobIds = actors.filter(a=>a.side===c.side&&a.id!==ballCarrier&&a.label!=="OL")
              .sort((p,q)=>Math.hypot(p.x-c.x,p.y-c.y)-Math.hypot(q.x-c.x,q.y-c.y)).slice(0,3).map(a=>a.id);
            phase="epilogue"; epiUntil=t+1000;
          }
          else if(scored){ emit("score",{x:c.x,y:c.y,carrier:ballCarrier}); phase="epilogue"; epiUntil=t+1000; }
          else {
            const cl=A[closerId];
            let hitStick=false, hitForce=0, launchDist=0, rearGrab=false, dragDist=0, contactType="wrap";
            if(cl){
              const weightMap={DT:1.08,DE:.96,LB:.84,S:.66,CB:.54,QB:.52,RB:.68,WR:.50,TE:.78,OL:1.12};
              const tacklerWeight=weightMap[cl.label]||.62, runnerWeight=weightMap[c.label]||.66;
              const tacklerSpeed=Math.max(0,cl._v||cl.spd*.55), runnerSpeed=Math.max(0,c._v||c.spd*.82);
              const tacklerSpeedRatio=Math.max(0,Math.min(1.4,tacklerSpeed/Math.max(1,cl.spd)));
              const runnerSpeedRatio=Math.max(0,Math.min(1.25,runnerSpeed/Math.max(1,c.spd)));
              const tacklerStrength=cl._pwr!=null?cl._pwr:(["LB","DE","DT"].includes(cl.label)?.76:.50);
              const runnerStrength=c._pwr!=null?c._pwr:(["RB","TE","QB"].includes(c.label)?.68:.48);
              const runnerBalance=Math.max(.28,Math.min(1.2,(c._agi||.58)*.42+runnerStrength*.38+runnerWeight*.20));
              const rx=c._dx||dir, ry=c._dy||0, rlen=Math.hypot(rx,ry)||1, rnx=rx/rlen, rny=ry/rlen;
              const tx=cl._dx||(c.x-cl.x), ty=cl._dy||(c.y-cl.y), tlen=Math.hypot(tx,ty)||1, tnx=tx/tlen, tny=ty/tlen;
              const relX=c.x-cl.x, relY=c.y-cl.y, relLen=Math.hypot(relX,relY)||1;
              const fromBehind=((relX/relLen)*rnx+(relY/relLen)*rny)<-.28;
              const sameDirection=tnx*rnx+tny*rny;
              rearGrab=fromBehind&&sameDirection>.25;
              const closingSpeed=Math.max(0,tacklerSpeed-(rearGrab?runnerSpeed*.72:runnerSpeed*(sameDirection>.2?.35:0)));
              const closingRatio=Math.max(0,Math.min(1.5,closingSpeed/Math.max(1,cl.spd)));
              const angleQuality=Math.max(.12,Math.min(1,tnx*(relX/relLen)+tny*(relY/relLen)));
              const tacklerMomentum=tacklerWeight*tacklerSpeedRatio;
              const runnerMomentum=runnerWeight*runnerSpeedRatio;
              const wrapQuality=Math.max(.18,Math.min(1.25,tacklerStrength*.52+angleQuality*.28+closingRatio*.20));
              hitForce=Math.max(0,Math.min(1.7,(tacklerMomentum*.44+tacklerStrength*.31+closingRatio*.25)*angleQuality-runnerBalance*.16));
              if(rearGrab){
                const momentumAdv=Math.max(0,runnerMomentum+runnerStrength*.34-(tacklerMomentum*.72+wrapQuality*.42));
                dragDist=Math.round(Math.max(4,Math.min(42,5+momentumAdv*31+runnerSpeedRatio*10)));
                contactType=dragDist>20?"drag":"rear-wrap";
                c._hitStart=t; c._hitUntil=t+Math.min(1050,480+dragDist*14);
                c._hitVx=rnx*(38+dragDist*4.8); c._hitVy=rny*(38+dragDist*4.8);
                c._dragTackler=closerId; c._dragOffsetX=-rnx*8; c._dragOffsetY=-rny*8;
                cl.x=c.x-rnx*8; cl.y=c.y-rny*8;
                emit("reargrab",{tackler:closerId,carrier:ballCarrier,x:c.x,y:c.y,drag:dragDist,runnerMomentum,tacklerMomentum,wrapQuality});
              } else {
                hitStick=!!fx.bigHit||(!wrapped&&hitForce>.86&&tacklerSpeedRatio>.80&&angleQuality>.55);
                if(hitStick){
                  launchDist=Math.round(Math.max(7,Math.min(52,8+Math.max(0,hitForce-.70)*42)));
                  const impactX=(tnx*.78+rnx*.22), impactY=(tny*.78+rny*.22), ilen=Math.hypot(impactX,impactY)||1;
                  const nx=impactX/ilen, ny=impactY/ilen;
                  c._hitStart=t; c._hitUntil=t+Math.min(820,370+launchDist*10);
                  c._hitVx=nx*(62+launchDist*7.2); c._hitVy=ny*(62+launchDist*7.2);
                  contactType="hit-stick";
                  emit("hitstick",{tackler:closerId,carrier:ballCarrier,x:c.x,y:c.y,force:hitForce,launch:launchDist,angle:angleQuality});
                }
                cl.x=c.x-dir*(c.side==="off"?6:-6); cl.y=c.y+R(-3,3);
              }
            }
            if(oobPlanned)c.y=c.y<MIDY?SIDELINE_TOP:SIDELINE_BOT;
            emit("tackle",{tackler:closerId,carrier:ballCarrier,x:c.x,y:c.y,
              bigHit:hitStick||!!fx.bigHit, hitStick, hitForce, launch:launchDist, drag:dragDist, rearGrab, contactType,
              oob:oobPlanned, plane:oobPlanned?"sideline":undefined, gang:wrapped});
            phase="epilogue"; epiUntil=t+Math.max(1000,(rearGrab?Math.min(1080,520+dragDist*14):(hitStick?760:440)));
          }
        }
      }

      // ---------- continuous actor behaviors ----------
      actors.forEach(a=>{
        // v15.20 loose-ball intelligence: every nearby player sees the fumble, reacts
        // according to distance/position, and converges without teleporting.
        if(phase==="loose"&&looseBall){
          const looseAge=t-(looseBall.t0||t);
          const distLoose=Math.hypot(a.x-looseBall.x,a.y-looseBall.y);
          const reaction=110+Math.min(300,distLoose*1.15)+(a.label==="OL"||a.label==="DT"?85:0);
          if(looseAge>=reaction){
            const recovererBias=a.side==="def"?1.16:1.05;
            const pursuitBoost=distLoose<70?1.15:1;
            moveToward(a,looseBall.x,looseBall.y,dt,recovererBias*pursuitBoost);
            if(distLoose<13) a._v=Math.max(18,(a._v||0)*0.72);
          }
          a.x=clampX(a.x); a.y=clampY(a.y);
          return;
        }
        if(a.id===ballCarrier) return;
        if(t<a.beatenUntil){ a.x+=a.vx*0.028; a.y+=a.vy*0.028; a.vx*=0.9; a.vy*=0.9; return; }
        if(a.stunUntil){ if(t<a.stunUntil){ a._v=0; return; }               // v5: pancaked — he is DOWN
          if(!a._gotUp){ a._gotUp=true; emit("getup",{who:a.id}); } }
        if(a._cvg===t){ a.x=clampX(a.x); a.y=clampY(a.y); return; }         // v9: converging on the ball — route logic yields
        if(t<(a._blockedUntil||0)&&a.id!==closerId){                        // v7: sealed by an escort block
          const cc=A[ballCarrier||"off8"];
          if(cc) moveToward(a, cc.x, cc.y, dt, 0.15);                       // leans toward the ball, gains nothing
          a.x+=R(-0.5,0.5); a.y+=R(-0.5,0.5);
          a.x=clampX(a.x); a.y=clampY(a.y);
          return;
        }
        if(a.side==="off"){
          if(a.id===pullerId&&(phase==="carry"||phase==="handoff")&&ballCarrier==="off9"){
            moveToward(a, A.off9.x+dir*18, A.off9.y, dt, 1.05);   // lead blocker around the edge
          } else if(a.label==="OL"){ // trench v5: a REAL pocket — tackles kick-slide deep, center anchors
            if(a._free){
              // pancaked his man — peel off and DOUBLE-TEAM the nearest live rusher
              let tgt=null,td2=1e9;
              actors.forEach(dv=>{ if(dv.side!=="def"||!isDLine(dv.label)||(dv.stunUntil&&t<dv.stunUntil)||t<dv.beatenUntil) return;
                const dd=Math.hypot(dv.x-a.x,dv.y-a.y); if(dd<td2){td2=dd;tgt=dv;} });
              if(tgt){ moveToward(a, tgt.x-dir*5, tgt.y+(a.y>tgt.y?5:-5), dt, 0.78); if(td2<16) tgt._doubled=t; }
              else moveToward(a, losX-dir*8, a.y, dt, 0.5);
            } else {
              if(a._homeY==null)a._homeY=a.y;
              const collapse = isPass ? Math.min(20, Math.max(0,(t-snapT))*0.014) : -8;
              const lane = {off3:11,off4:5,off5:2,off6:5,off7:11}[a.id]||6;             // horseshoe depth
              const py = isPass ? a._homeY+(qbHomeY-a._homeY)*0.12 : a.y+R(-2,2);
              moveToward(a, losX-dir*(isPass?3+lane+collapse*0.7:-8)+R(-1.5,1.5), py+R(-1.5,1.5), dt, 0.5);
            }
          } else if(decoys[a.id]){ // route runners
            const rp=decoys[a.id]; const wp=rp[Math.min(rp.length-1, Math.floor((t-snapT)/650)+1)]||rp[rp.length-1];
            if(t>snapT) moveToward(a, wp.x, wp.y, dt, 0.95);
          } else if(a.id===targetId&&targetRoute&&phase!=="carry"){ // target runs his route
            const wp=targetRoute[Math.min(targetRoute.length-1, Math.floor((t-snapT)/560)+1)]||targetRoute[targetRoute.length-1];
            if(t>snapT) moveToward(a, wp.x, wp.y, dt, 1.0);
          } else if(a.label==="RB"&&isPass&&a.id!==targetId){ // RB pass pro / leak
            moveToward(a, losX-dir*20, a.y, dt, 0.5);
          } else if(ballCarrier&&A[ballCarrier].side==="off"&&t>commitT&&a.label!=="QB"){
            // v7: FREE BLOCKERS work — read the carrier's estimated path and pick off the nearest threat
            const c2=A[ballCarrier];
            const ahead = carrierPath ? pointAt(carrierPath, Math.min(carrierLen, carrierD + 34 + (a._blkSkill||0)*34)) : {x:c2.x+dir*24,y:c2.y};
            let tgt=null, td=1e9;
            actors.forEach(dv=>{
              if(dv.side!=="def") return;
              if(isDLine(dv.label)&&dv.id!==shedId) return;                 // engaged linemen aren't worth chasing
              if(dv.id===closerId||t<dv.beatenUntil||(dv.stunUntil&&t<dv.stunUntil)||t<(dv._blockedUntil||0)) return;
              const dd=Math.hypot(dv.x-ahead.x,dv.y-ahead.y)+Math.hypot(dv.x-a.x,dv.y-a.y)*0.5;
              if(dd<td){td=dd;tgt=dv;}
            });
            if(tgt&&td<175){
              moveToward(a, (tgt.x+ahead.x)/2, (tgt.y+ahead.y)/2, dt, 0.68+(a._blkSkill||0)*0.27);
              if(Math.hypot(a.x-tgt.x,a.y-tgt.y)<9 && t>(a._nextBlk||0)){
                const hold = 300+R(0,220)+(a._blkSkill||0)*560;             // blocking skill holds the seal longer
                a._nextBlk=t+hold+280;
                tgt._blockedUntil=t+hold; tgt._blocker=a.id;
                emit("block",{x:(a.x+tgt.x)/2,y:(a.y+tgt.y)/2,by:a.id,who:tgt.id,big:rand()<(a._blkSkill||0)*0.35});
              }
            } else moveToward(a, c2.x+dir*26, a.y, dt, 0.45);               // no work nearby: escort downfield
          } else if(ballCarrier&&A[ballCarrier].side==="def"&&t>commitT&&a.label!=="OL"){ // chase the returner!
            pursue(a);
          }
        } else { // defense
          if(isDLine(a.label)&&(a.id===shedId||a.id===shedId2)&&phase!=="loose"&&ballCarrier){ pursue(a); }   // free rushers hunt the ball
          else if(isDLine(a.label)&&!(phase==="sackrush"&&a.id===closerId)&&phase!=="loose"&&!(ballCarrier&&A[ballCarrier].side==="def")){
            // engaged with a paired OL, pushing the pocket back
            const pairs={def7:"off3",def8:"off4",def9:"off6",def10:"off7"};
            let ol=A[pairs[a.id]||"off5"];
            if(stuntPair&&t<stuntPair.until&&(a.id===stuntPair.a||a.id===stuntPair.b)){
              ol=A[pairs[a.id===stuntPair.a?stuntPair.b:stuntPair.a]];   // cross the rush lanes
              moveToward(a, ol.x+dir*9, ol.y+R(-2,2), dt, 1.05);          // burst through the gap
            } else if(a.label==="DE"&&isPass){
              // v5: the EDGE speed-rushes the arc — wide around the tackle, then flatten to the QB
              if(a._edge==null)a._edge=a.y<qbHomeY?-1:1;
              const beatCorner=(a.x-ol.x)*(0-dir)>3;
              if(beatCorner) moveToward(a, A.off8.x, A.off8.y, dt, 0.95);
              else moveToward(a, ol.x+dir*5, ol.y+a._edge*11, dt, 0.82);
            } else if(a.label==="DT"){
              // v5: the INTERIOR power-rushes — straight through his man, strength on strength
              const dbl=a._doubled&&t-a._doubled<220;
              moveToward(a, ol.x+dir*(isPass?7:9), ol.y+R(-2,2), dt, dbl?0.34:TU("dtPush",0.74));
            } else moveToward(a, ol.x+dir*9, ol.y+R(-2,2), dt, 0.62);
          }
          else if(t<commitT){ // pre-commit: coverage shells
            if(isKick&&returner&&a.id===returner.id){ /* returner settles under the kick via onLand */ }
            if(a.label==="CB"){
              let rid=cbCoverageTarget(a);
              const makingMistake=isPass&&a._aware<60&&t>=a._mistakeAt&&t<a._mistakeUntil;
              if(makingMistake&&a._mistakeTarget)rid=a._mistakeTarget;
              const w=A[rid]||A[topThreat];
              const cushion=shell==="zone"?(10+Math.max(0,58-a._cov)*.25):(5+Math.max(0,48-a._cov)*.18);
              const inside=(w.y<MIDY?1:-1)*(shell==="man"?3:7);
              const mult=Math.max(.68,Math.min(1.16,.72+a._cov/230+a._quick/520));
              moveToward(a,w.x+dir*cushion,w.y+inside,dt,makingMistake?mult*.48:mult);
              if(makingMistake&&!a._mistakeAnn){a._mistakeAnn=true;emit("coverageBust",{who:a.id,wrong:rid});}
              if(!a._mirrorAnn&&t>snapT){a._mirrorAnn=true;emit("cornerMirror",{who:a.id,on:rid,rating:Math.round(a._ovr)});}
            }
            else if(a.label==="S"){
              if(a.id===bracketHelperId&&bracketTargetId){
                const w=A[bracketTargetId];
                moveToward(a,w.x+dir*(concept==='deep'?22:10),w.y+(w.y<MIDY?-10:10),dt,.82+a._cov/310);
              } else if(shell==="zone"){
                const deep=receiverIds.slice().sort((r1,r2)=>(A[r2].x-losX)*dir-(A[r1].x-losX)*dir)[0];
                const w=A[deep]; moveToward(a,Math.max(PLAY_L,Math.min(PLAY_R,w.x+dir*28)),clampY((w.y+MIDY)/2),dt,.62+a._aware/420);
              } else {
                const w=A[a.y<MIDY?"off0":"off1"]; moveToward(a,w.x+dir*24,w.y+(a.y<MIDY?12:-12),dt,.62+a._cov/420);
              }
            }
            else if(a.label==="LB"){
              if(a.id===blitzerId&&isPass){ moveToward(a, A.off8.x, A.off8.y, dt, 1.0); }   // green dog!
              else if(isPass&&t>=snapT+a._passReadDelay){
                if(!a._dropAnnounced){a._dropAnnounced=true;emit("linebackerDrop",{who:a.id,rating:Math.round(a._ovr),delay:Math.round(a._passReadDelay)});}
                let tx=losX+a._dropDepth,ty=a.y;
                let mark=null;
                if(a.id===bracketHelperId&&bracketTargetId)mark=A[bracketTargetId];
                else if(targetId==="off2"||targetId==="off9")mark=A[targetId];
                else {
                  const inside=[A.off2,A.off9,A.off10].filter(Boolean).sort((u,v)=>Math.abs(u.y-a.y)-Math.abs(v.y-a.y));mark=inside[0];
                }
                if(mark){tx=mark.x+dir*7;ty=mark.y+(mark.y<MIDY?8:-8);}
                moveToward(a,tx,clampY(ty),dt,.60+a._cov/250+a._aware/500);
              } else {
                // Diagnose the mesh instead of freezing: lower-awareness LBs take
                // a false step, elite LBs gain depth immediately.
                const falseStep=isPass&&a._aware<52?dir*5:-dir*Math.max(0,(a._aware-60)*.025);
                moveToward(a,losX+dir*26+falseStep,a.y,dt,.38+a._quick/520);
              }
            }
          } else if(ballCarrier&&A[ballCarrier].side!==a.side){ pursue(a); }
            else if(ballCarrier){
              // v7: return escorts hunt blocks too — same path-reading, roles flipped
              const rc=A[ballCarrier];
              const ahead2 = carrierPath ? pointAt(carrierPath, Math.min(carrierLen, carrierD + 30 + (a._blkSkill||0)*30)) : {x:rc.x-dir*20,y:rc.y};
              let tg2=null, td2b=1e9;
              actors.forEach(ov=>{
                if(ov.side!=="off"||ov.label==="OL") return;
                if(ov.id===closerId||t<ov.beatenUntil||t<(ov._blockedUntil||0)) return;
                const dd2=Math.hypot(ov.x-ahead2.x,ov.y-ahead2.y)+Math.hypot(ov.x-a.x,ov.y-a.y)*0.5;
                if(dd2<td2b){td2b=dd2;tg2=ov;}
              });
              if(tg2&&td2b<160){
                moveToward(a, (tg2.x+ahead2.x)/2, (tg2.y+ahead2.y)/2, dt, 0.66+(a._blkSkill||0)*0.25);
                if(Math.hypot(a.x-tg2.x,a.y-tg2.y)<9 && t>(a._nextBlk||0)){
                  const hold2 = 280+R(0,200)+(a._blkSkill||0)*480;
                  a._nextBlk=t+hold2+300;
                  tg2._blockedUntil=t+hold2; tg2._blocker=a.id;
                  emit("block",{x:(a.x+tg2.x)/2,y:(a.y+tg2.y)/2,by:a.id,who:tg2.id,big:false});
                }
              } else moveToward(a, rc.x-dir*20, rc.y, dt, 0.5);
            } // escort own returner
        }
        a.x=clampX(a.x); a.y=clampY(a.y);
      });
      // v5 physics: mass-weighted collision separation EVERY tick — big men move small men
      {
        const MASS={OL:1.6,DT:1.55,DL:1.4,DE:1.25,LB:1.15,TE:1.2,RB:1,QB:1,WR:0.9,CB:0.9,S:0.95};
        for(let i=0;i<actors.length;i++) for(let j=i+1;j<actors.length;j++){
          const p=actors[i],q=actors[j];
          if(p.id===ballCarrier||q.id===ballCarrier) continue;             // the carrier's path is authoritative
          if((p.stunUntil&&t<p.stunUntil)||(q.stunUntil&&t<q.stunUntil)) continue;   // flattened men are on the ground
          const d=Math.hypot(p.x-q.x,p.y-q.y), min=(p.side===q.side)?12:10.5;
          if(d<min&&d>0.01){
            const push=(min-d)/2, ux=(p.x-q.x)/d, uy=(p.y-q.y)/d,
              mp=MASS[p.label]||1, mq=MASS[q.label]||1, tot=mp+mq;
            p.x+=ux*push*(mq/tot)*1.7; p.y+=uy*push*(mq/tot)*1.7;
            q.x-=ux*push*(mp/tot)*1.7; q.y-=uy*push*(mp/tot)*1.7;
            p.x=clampX(p.x); p.y=clampY(p.y); q.x=clampX(q.x); q.y=clampY(q.y);
          }
        }
      }
      record();
    }
    if(t>=HARD_CAP&&!done){ emit("whistle",{forced:true}); }
    // v22 ANTI-TELEPORT: the legacy choreographer occasionally SNAPS an actor across
    // the field (e.g. punt coverage). Cap any single-frame jump to a realistic sprint
    // step so a teleport becomes a fast slide instead. FieldSim plays are already
    // <=17px/frame (well under the cap), so this only touches choreographer output.
    /* v151 D: and a man's step is capped at his own legs (`choreoDefPaceV151D` x his speed a frame),
     * not at 22px — 666px/s, which is how a choreographed closer (or a kick-coverage man) arrived from
     * nowhere. Any man who ever has the ball in his hands (`_holdV151`, read off the ball track) keeps
     * the old cap: his frames and the ball's must never part. */
    const _holdV151=(()=>{ const H=new Set(); if(!ballFrames||!ballFrames.length) return H; const bt={}; ballFrames.forEach(b=>{bt[Math.round(b.t)]=b;});
      actors.forEach(a=>{ for(const f of a.frames){ const b=bt[Math.round(f.t)]; if(b&&(b.h||0)<3&&Math.hypot(b.x-f.x,b.y-f.y)<TU("choreoHoldPxV151D",14)){H.add(a.id);break;} } }); return H; })();
    const _deTPv22=(fr,spd,side,id)=>{ if(!fr||fr.length<2)return fr; const MAX=(!_holdV151.has(id)&&TU("paceV151D",1))?Math.min(TU("choreoMaxStep",22),Math.max(TU("choreoDefMinStepV151D",5),(spd||130)*TU("choreoDefPaceV151D",1.45)*TICK/1000)):TU("choreoMaxStep",22); const out=[fr[0]]; let px=fr[0].x, py=fr[0].y; for(let k=1;k<fr.length;k++){ const dx=fr[k].x-px, dy=fr[k].y-py, d=Math.hypot(dx,dy); if(d>MAX){ px+=dx/d*MAX; py+=dy/d*MAX; } else { px=fr[k].x; py=fr[k].y; } out.push(Object.assign({},fr[k],{x:px,y:py})); } return out; };
    return { duration:t, actors:actors.map(a=>({id:a.id,side:a.side,label:a.label,sp:Math.round(a.spd||SPEED[a.label]||130),nm:a._player&&a._player.name||null,skin:a._player&&Number.isFinite(a._player.skinTone)?a._player.skinTone:null,frames:_deTPv22(a.frames,a.spd,a.side,a.id)})),   // v151 D: sp rides the script
             ball:ballFrames, events, meta:{concept,targetId,losX,endX,dir,scoreDir,scored,
               featured, involved, targetRoute: targetRoute||null,
               coveragePlan:{shell,bracketTargetId,bracketHelperId,manAssignments,
                 cbRatings:cbIds.map(id=>({id,ovr:Math.round(A[id]._ovr),coverage:Math.round(A[id]._cov)})),
                 lbRatings:lbIds.map(id=>({id,ovr:Math.round(A[id]._ovr),awareness:Math.round(A[id]._aware)}))}} };

    function nearestDef(x,y){
      if (userDefId && ["CB","S","LB"].includes(A[userDefId].label)) return A[userDefId];
      let b=null,bd=1e9;
      actors.filter(a=>a.side==="def"&&["CB","S","LB"].includes(a.label))
        .forEach(a=>{const d=Math.hypot(a.x-x,a.y-y);if(d<bd){bd=d;b=a;}});
      return b||A.def2; }
  }
  /* ===== v146 A EVERY MAN WHO GOES DOWN WAS TAKEN DOWN =====
   * The dead-ball tackle names a man, and the broadcast folds the carrier the instant that event
   * fires — wherever the named man happens to be standing. Measured over 1,600 scripted snaps the
   * named tackler was more than 1.7 yd off the carrier on ~20% of the play-ending tackles, and on
   * the worst of them 25+ yards off: nobody near him, and he fell down. Four sources, all of them
   * upstream of the picture and none of them about who MADE the stop:
   *   - v139's cut (`fitLogYardsV139`): a play booked shorter than the sim ran is truncated where
   *     the carrier crosses the credited yard and the SAME tackler is named on the cut — but that
   *     man made the tackle further downfield, later. 17% of all tackles, mean 28px apart.
   *   - the sack a smart quarterback TAKES (v82) resolved on the tick he decided, with the free
   *     rusher still ~20px away (fixed at its source in FieldSim, `v146 A` beside it; this pass is
   *     the belt to that braces).
   *   - the choreographer's path-end tackle SNAPS the closer onto the carrier, and v22's anti-
   *     teleport then turns the snap into a slide that arrives several frames after the whistle.
   *   - a hit stick measured at arm's length.
   * The stop itself is never in question — the man, the spot, the yards and the frame of the event
   * are all booked before this runs — so the fix belongs to the PICTURE: the named man is walked
   * onto the carrier over the approach before the event (a smooth, ease-in-out offset added to his
   * own path, so he keeps every step and cut the sim gave him and simply takes a better line), and
   * after the event he is GLUED to the carrier: they go down together and slide as one. The hit
   * stick is the exception — the hitter is on him at the moment of the hit and then runs on through,
   * on his feet. A script that stops dead ON the tackle (the v139 cut) gets a short coast so the
   * fall has time to read before the whistle phase takes the field. Nothing here reads or writes a
   * number the game books: no roll, no yard, no name, no event time moves.
   * `contactV146(script)`; kill switch `TU("contactV146", 0)`; `window.__V146` is the hook. */
  /* ===== v151 D THE MAN HAS TO GET THERE ON HIS OWN LEGS =====
   * v146 A walked the named tackler onto the carrier with a smoothstep offset laid over his own
   * path, and the window it gave him was `min(the time since the snap, ~off/150px/s)` — so when he
   * started far away and late (the v139 cut, which names a man who really made the stop yards
   * further downfield; a choreographed return; a sack close) the ADDED pace alone reached 400-590
   * px/s on top of his own sprint. Measured over ~570 play-ending tackles: 72 of 85 cut tackles and
   * 21 of 23 hit sticks had the named man drawn above 1.25x his top speed in the last 1.2 s, the
   * worst at 3.4x. That is the man who "flies in from nowhere".
   *
   * The spot, the yards and the NAME are the sim's truth and never move (stat credit follows the
   * name — `pe(X.tackler)`), so there is exactly one honest thing left to spend: TIME. The man is
   * given an approach no faster than `tacklerPaceCapV151D` times his own top speed (`sp`, carried on
   * the script's actor) — or than the sim already drew him, whichever is more — and if even the
   * whole play since the snap is not long enough for that, the WHISTLE WAITS FOR HIM: the carrier's
   * last `waitWinMsV151D` is eased out (a quadratic time-map, rate 1 going in, near zero at the
   * spot: he is cornered, looking for a way out, and slowing into the man who finally arrives), the
   * dead-ball event and everything after it move later by the wait, and the other twenty men carry
   * their own motion through it. The carrier still reaches the SAME spot, the tackle still names
   * the SAME man; only the moment of the hit moves. `waitMaxMsV151D` bounds the wait; beyond it the
   * remaining gap is closed at whatever pace is left (counted as `over`, so the check can see it).
   * The possession guard keeps the eased window after the carrier has the ball, so no throw, catch
   * or handoff is ever slowed. `window.__V151D` counts every approach; kill switch
   * `TU("approachV151D", 0)` restores v146 A exactly. */
  function approachV151D(S, e, K, C, te, c0, k0, ux, uy, setPx, why) {
    const V = root.__V151D = root.__V151D || { approaches: 0, capped: 0, waits: 0, waitMs: 0, maxWait: 0, over: 0, maxRatio: 0, byWhy: {} };
    V.approaches++;
    const at = (fr, t) => {
      if (t <= fr[0].t) return { x: fr[0].x, y: fr[0].y };
      for (let i = 1; i < fr.length; i++) if (fr[i].t >= t) { const a = fr[i - 1], b = fr[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: a.h != null ? a.h + ((b.h || 0) - a.h) * k : undefined }; }
      const l = fr[fr.length - 1]; return { x: l.x, y: l.y, h: l.h };
    };
    const T = { x: c0.x + ux * setPx, y: c0.y + uy * setPx }, dx = T.x - k0.x, dy = T.y - k0.y, off = Math.hypot(dx, dy);
    const sp = K.sp || SPEED[K.label] || 140, cap = sp * TU("tacklerPaceCapV151D", 1.45);
    const snapE = S.events.find(q => q.type === "snap");
    const t0 = Math.max(K.frames[0].t, snapE ? snapE.t : 0);
    const pre = K.frames.filter(f => f.t <= te + 0.01);
    const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    const peak = (fr, fromT) => { let m = 0; for (let i = 1; i < fr.length; i++) { if (fr[i].t < fromT) continue; const dt = (fr[i].t - fr[i - 1].t) / 1000; if (dt > 0) m = Math.max(m, Math.hypot(fr[i].x - fr[i - 1].x, fr[i].y - fr[i - 1].y) / dt); } return m; };
    // the path he runs: his own until the whistle, held on the spot he reached through any wait,
    // plus the correction eased in over the last W ms before the (possibly later) hit
    const build = (W, D) => {
      const tE = te + D, from = tE - W, out = [];
      const put = (t, bx, by) => { const q = ease((t - from) / W); out.push({ t, x: Math.round((bx + dx * q) * 10) / 10, y: Math.round((by + dy * q) * 10) / 10 }); };
      for (const f of pre) { if (f.t >= te - 0.01) break; if (f.t < from) out.push(f); else put(f.t, f.x, f.y); }
      for (let t = te; t < tE - 0.01; t += TICK) put(t, k0.x, k0.y);
      out.push({ t: tE, x: T.x, y: T.y });
      return { fr: out, from, tE };
    };
    const ownPeak = peak(pre, te - TU("waitWinMsV151D", 700));
    const limit = Math.max(cap, ownPeak);
    const wMin = Math.max(TU("closeMinMsV146", 260), TICK * 2), dMax = Math.max(0, TU("waitMaxMsV151D", 1400));
    let best = null;
    for (let D = 0; D <= dMax + 0.01 && !(best && best.ok); D += TICK * 2) {
      const avail = Math.max(TICK, te + D - t0);
      if (avail < wMin) continue;
      // the widest window first: if even that is too fast, no window at this wait will do
      const wide = build(avail, D), pw = peak(wide.fr, wide.from - TICK);
      if (!best || pw < best.pk) best = { W: avail, D, pk: pw, ok: pw <= limit + 0.5 };
      if (pw > limit + 0.5) continue;
      // then the tightest that still fits, so he keeps as much of his own path as he can
      for (let W = wMin; W < avail; W += TICK) { const b = build(W, D), pk = peak(b.fr, b.from - TICK); if (pk <= limit + 0.5) { best = { W, D, pk, ok: true }; break; } }
      if (!best.ok) best = { W: avail, D, pk: pw, ok: true };
    }
    if (!best) return null;
    let D = best.D, W = best.W;
    // the carrier's eased window must start after he has the ball (no throw, catch or handoff is slowed)
    if (D > 0) {
      const POSS = /^(snap|handoff|catch|pick|puntCatch|pickup|recover|snapCatch|kick|land|td)$/;
      let lastPoss = snapE ? snapE.t : 0;
      for (const q of S.events) if (q.t <= te && POSS.test(q.type)) lastPoss = Math.max(lastPoss, q.t);
      const room = te - (lastPoss + TU("waitPossPadMsV151D", 90));
      const Wc = Math.min(Math.max(TU("waitWinMsV151D", 700), D / TU("waitMaxRateV151D", .8)), room);
      const Dfit = Math.max(0, Math.floor(Wc * TU("waitMaxRateV151D", .8) / TICK) * TICK);
      if (Dfit < D) {   // not enough of his run to ease out: wait what fits, close the rest at the pace that is left
        D = Dfit; const avail = Math.max(TICK, te + D - t0); W = avail; best.ok = false;
      }
      if (D > 0) waitV151D(S, C, K, te, D, te - Wc, at);
    }
    const b = build(W, D);
    K.frames = b.fr.concat(K.frames.filter(f => f.t > te + 0.01).map(f => Object.assign({}, f, { t: f.t + D })));
    const pk = peak(b.fr, b.from - TICK), ratio = pk / sp;
    V.maxRatio = Math.max(V.maxRatio, +ratio.toFixed(2));
    if (pk > cap + 0.5 && pk > ownPeak + 0.5) V.over++;
    if (W > Math.max(TU("closeMinMsV146", 260), off / Math.max(1e-3, TU("closePxPerSV146", 150) / 1000)) + 1 || D > 0) V.capped++;
    if (D > 0) { V.waits++; V.waitMs += D; V.maxWait = Math.max(V.maxWait, D); }
    (V.byWhy[why] = V.byWhy[why] || { n: 0, waits: 0 }).n++; if (D > 0) V.byWhy[why].waits++;
    e.v151D = { W: Math.round(W), waitMs: Math.round(D), peak: Math.round(pk), cap: Math.round(cap), ratio: +ratio.toFixed(2) };
    return { dx, dy, off, W, D, tE: te + D, addPxS: Math.round(off / W * 1000 * 1.5) };
  }
  /* the whistle waits: the carrier eases into the spot over [a0, te] -> [a0, te + D]; every event
   * after the hit, the hit itself and every frame past it move D later; everyone else carries on. */
  function waitV151D(S, C, K, te, D, a0, at) {
    const Wc = te - a0, L = Wc + D, A = -D / (L * L);          // old = s + A·s², rate 1 at a0, 1-2D/L at the spot
    const oldOf = s => s + A * s * s, newOf = o => { const q = 1 + 4 * A * o; return q <= 0 ? L : (-1 + Math.sqrt(q)) / (2 * A); };
    const warp = (fr, withH) => {
      const out = fr.filter(f => f.t <= a0 + 0.01);
      for (let s = TICK - ((a0 % TICK) || 0) || TICK; s < L - 0.01; s += TICK) { const p = at(fr, a0 + oldOf(s)); const f = { t: Math.round((a0 + s) * 10) / 10, x: p.x, y: p.y }; if (withH) f.h = p.h || 0; out.push(f); }
      const pe = at(fr, te), fe = { t: te + D, x: pe.x, y: pe.y }; if (withH) fe.h = pe.h || 0; out.push(fe);
      for (const f of fr) if (f.t > te + 0.01) out.push(Object.assign({}, f, { t: f.t + D }));
      return out;
    };
    const shift = fr => {   // the rest of the field keeps moving through the wait, fading, then plays its own tail from there
      const pre = fr.filter(f => f.t <= te + 0.01), post = fr.filter(f => f.t > te + 0.01);
      if (!pre.length) return fr.map(f => Object.assign({}, f, { t: f.t + D }));
      const l = pre[pre.length - 1], p = pre.length > 1 ? pre[pre.length - 2] : l, dt = Math.max(1, l.t - p.t);
      const vx = (l.x - p.x) / dt, vy = (l.y - p.y) / dt, n = Math.max(1, Math.round(D / TICK));
      let x = l.x, y = l.y; const out = pre.slice();
      for (let k = 1; k <= n; k++) { const dec = Math.max(0, 1 - k / n); x += vx * TICK * dec; y += vy * TICK * dec; out.push({ t: l.t + k * TICK * (D / (n * TICK)), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }); }
      const ox = x - l.x, oy = y - l.y;
      for (const f of post) out.push(Object.assign({}, f, { t: f.t + D, x: f.x + ox, y: f.y + oy }));
      return out;
    };
    S.actors.forEach(a => { if (!a.frames || !a.frames.length || a === K) return; a.frames = a === C ? warp(a.frames, false) : shift(a.frames); });
    if (S.ball && S.ball.length) S.ball = warp(S.ball, true);
    const cid = C.id;
    S.events.forEach(q => {
      if (q.t > te + 0.01) q.t += D;
      else if (Math.abs(q.t - te) <= 0.01) q.t = te + D;
      else if (q.t > a0 && (q.carrier === cid || q.who === cid)) q.t = a0 + newOf(q.t - a0);   // his own moves keep their place in his (slower) run
    });
    S.events.sort((p, q) => p.t - q.t);
    S.duration = (S.duration || te) + D;
  }
  function contactV146(S) {
    if (!S || !S.actors || !S.events || !TU("contactV146", 1)) return S;
    const H = root.__V146 = root.__V146 || {};   // shared with FieldSim's sack close-out, which may have made it first
    for (const k of ["scripts", "tackles", "already", "fixed", "glued", "stick", "coast", "maxFixPx", "maxVx", "farAfter"]) if (typeof H[k] !== "number") H[k] = 0;
    if (!H.byWhy) H.byWhy = {};
    H.scripts++;
    let e = null;
    for (let i = S.events.length - 1; i >= 0; i--) { const q = S.events[i]; if (q && q.type === "tackle" && q.tackler && q.carrier && q.tackler !== q.carrier) { e = q; break; } }
    if (!e) return S;
    const K = S.actors.find(a => a.id === e.tackler), C = S.actors.find(a => a.id === e.carrier);
    if (!K || !C || !K.frames || !C.frames || K.frames.length < 2 || C.frames.length < 2) return S;
    H.tackles++;
    // where a man is at time t, interpolated between the two keyframes around it
    const at = (fr, t) => {
      if (t <= fr[0].t) return { x: fr[0].x, y: fr[0].y };
      for (let i = 1; i < fr.length; i++) if (fr[i].t >= t) { const a = fr[i - 1], b = fr[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
      const l = fr[fr.length - 1]; return { x: l.x, y: l.y };
    };
    let te = e.t; const c0 = at(C.frames, te), k0 = at(K.frames, te);   // v151 D: `te` moves when the whistle waits for the man
    const stick = !!(e.hitStick || (e.flyWho && e.flyWho === e.carrier && Number(e.flyVz) > 0));
    const d0 = Math.hypot(k0.x - c0.x, k0.y - c0.y);
    // the side he came from is the side he hits from; a man exactly on top keeps his own side
    let ux = k0.x - c0.x, uy = k0.y - c0.y; const un = Math.hypot(ux, uy);
    if (un < 0.5) { ux = -(e.dirX || 1); uy = 0; } else { ux /= un; uy /= un; }
    const reach = TU("contactPxV146", 9), setPx = TU("contactSetPxV146", 6);
    const why = e.v139 ? "cut" : e.sack ? (e.taken ? "sackTaken" : "sack") : stick ? "stick" : S.meta && S.meta.fieldSim ? "sim" : "choreo";
    let dx = 0, dy = 0;
    /* v151 D: the capped approach (below) replaces the smoothstep walk-on when it is on; the old
     * walk-on stays byte-for-byte under `TU("approachV151D", 0)`. */
    const A151 = d0 > reach && TU("approachV151D", 1) ? approachV151D(S, e, K, C, te, c0, k0, ux, uy, setPx, why) : null;
    if (A151) { dx = A151.dx; dy = A151.dy; H.fixed++; H.maxFixPx = Math.max(H.maxFixPx, Math.round(A151.off));
      (H.byWhy[why] = H.byWhy[why] || { n: 0, px: 0 }).n++; H.byWhy[why].px += Math.round(A151.off);
      e.v146 = { d0: Math.round(d0 * 10) / 10, fixPx: Math.round(A151.off * 10) / 10, fixMs: Math.round(A151.W), addPxS: A151.addPxS, v151: true };
    } else if (d0 > reach) {
      const tx = c0.x + ux * setPx, ty = c0.y + uy * setPx;
      dx = tx - k0.x; dy = ty - k0.y;
      const off = Math.hypot(dx, dy);
      // the approach window: long enough that the extra pace stays inside a man's stride, never
      // reaching back before the snap
      const snapE = S.events.find(q => q.type === "snap");
      const t0 = Math.max(K.frames[0].t, snapE ? snapE.t : 0);
      const avail = Math.max(TICK, te - t0);
      const want = Math.max(TU("closeMinMsV146", 260), off / Math.max(1e-3, TU("closePxPerSV146", 150) / 1000));
      const W = Math.min(avail, want), from = te - W;
      const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
      K.frames = K.frames.map(f => f.t < from ? f : f.t > te ? f : Object.assign({}, f, { x: f.x + dx * ease((f.t - from) / W), y: f.y + dy * ease((f.t - from) / W) }));
      // a keyframe exactly ON the event, so the frame he is drawn at the whistle is the contact frame
      if (!K.frames.some(f => Math.abs(f.t - te) < 0.01)) {
        const i = K.frames.findIndex(f => f.t > te);
        const nf = { t: te, x: tx, y: ty };
        if (i < 0) K.frames.push(nf); else K.frames.splice(i, 0, nf);
      }
      H.fixed++; H.maxFixPx = Math.max(H.maxFixPx, Math.round(off));
      const vx = Math.round(off / W * 1000 * 1.5); H.maxVx = Math.max(H.maxVx, vx);   // peak added pace (smoothstep peaks at 1.5x the mean)
      (H.byWhy[why] = H.byWhy[why] || { n: 0, px: 0 }).n++; H.byWhy[why].px += Math.round(off);
      e.v146 = { d0: Math.round(d0 * 10) / 10, fixPx: Math.round(off * 10) / 10, fixMs: Math.round(W), addPxS: vx };
    } else { H.already++; e.v146 = { d0: Math.round(d0 * 10) / 10, fixPx: 0 }; }
    if (A151) te = A151.tE;   // v151 D: the hit is where the man could really get to it — later, when the whistle waited
    const kc = { x: k0.x + dx - c0.x, y: k0.y + dy - c0.y };   // his offset from the carrier at the hit
    // a script that stops dead on the tackle (the v139 cut) gets a coast, so the fall reads
    const coastMs = TU("fallWindowMsV146", 360), end = S.duration;
    if (end - te < coastMs * 0.5 && coastMs > 0) {
      const n = Math.ceil(coastMs / TICK);
      const vel = fr => { const l = fr[fr.length - 1], p = fr.length > 1 ? fr[fr.length - 2] : l, dt = Math.max(1, l.t - p.t); return { vx: (l.x - p.x) / dt, vy: (l.y - p.y) / dt }; };
      const drive = TU("fallDrivePxV146", 4);
      S.actors.forEach(a => {
        if (!a.frames || !a.frames.length) return;
        const l = a.frames[a.frames.length - 1], v = vel(a.frames); let x = l.x, y = l.y;
        for (let k = 1; k <= n; k++) {
          const t = l.t + k * TICK, dec = Math.max(0, 1 - k / (n * 0.7));
          if (a === C) { const q = Math.min(1, k / (n * 0.6)); x = c0.x - ux * drive * q * (stick ? 0 : 1); y = c0.y - uy * drive * q * (stick ? 0 : 1); }
          else { x += v.vx * TICK * dec * 0.8; y += v.vy * TICK * dec * 0.8; }
          a.frames.push({ t, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
        }
      });
      if (S.ball && S.ball.length) { const l = S.ball[S.ball.length - 1];
        for (let k = 1; k <= n; k++) S.ball.push({ t: l.t + k * TICK, x: l.x, y: l.y, h: 0 }); }
      S.duration = Math.max(end, te + n * TICK);
      H.coast++;
    }
    // after the hit: they go down TOGETHER — his frames ride the carrier's, closing onto him as
    // the two of them fall. The hit stick hitter keeps his own legs and runs on through.
    if (stick) {
      // he drives THROUGH the man for a beat (`stickThroughMsV146`), then his own legs carry him on
      const thr = Math.max(1, TU("stickThroughMsV146", 120));
      K.frames = K.frames.map(f => { if (f.t <= te) return f;
        const own = { x: f.x + dx, y: f.y + dy }, q = Math.min(1, (f.t - te) / thr);
        if (q >= 1) return Object.assign({}, f, own);
        const c = at(C.frames, f.t), gx = c.x + kc.x, gy = c.y + kc.y, k = q * q;
        return Object.assign({}, f, { x: gx + (own.x - gx) * k, y: gy + (own.y - gy) * k }); });
      H.stick++;
    } else {
      const land = TU("pileOnPxV146", 4) / Math.max(1, Math.hypot(kc.x, kc.y));
      K.frames = K.frames.map(f => { if (f.t <= te) return f;
        const c = at(C.frames, f.t), q = Math.min(1, (f.t - te) / TU("fallMsV146", 300)), s = 1 - q * (1 - Math.min(1, land));
        return Object.assign({}, f, { x: Math.round((c.x + kc.x * s) * 10) / 10, y: Math.round((c.y + kc.y * s) * 10) / 10 }); });
      H.glued++;
      /* v153 A THE PILE GOES DOWN TOGETHER (the script): every man FieldSim listed in the heap
       * (`downV153A`) rides the carrier from the whistle and settles onto the pile ring
       * (`gangRingPxV153A` off him, on the side he came in from) over the same fall, so the renderer
       * folds him ON the pile, not where he stood. Nobody listed is moved before the whistle. */
      if (Array.isArray(e.downV153A) && e.downV153A.length && TU("v153A", 1) && TU("gangDownV153A", 1)) {
        const ring = TU("gangRingPxV153A", 7), far = TU("gangDownPxV153A", 20) * TU("gangDownSupKV153A", 1.4) + reach;
        e.downV153A.forEach((id, i) => {
          const F = S.actors.find(a => a.id === id); if (!F || F === K || F === C || !F.frames || F.frames.length < 2) return;
          const f0 = at(F.frames, te), ox = f0.x - c0.x, oy = f0.y - c0.y, od = Math.hypot(ox, oy);
          if (od > far) return;
          const land = (ring + i * TU("gangRingStepPxV153A", 1.5)) / Math.max(1, od);
          if (!F.frames.some(f => Math.abs(f.t - te) < 0.01)) { const j = F.frames.findIndex(f => f.t > te); const nf = { t: te, x: f0.x, y: f0.y }; if (j < 0) F.frames.push(nf); else F.frames.splice(j, 0, nf); }
          F.frames = F.frames.map(f => { if (f.t <= te) return f;
            const c = at(C.frames, f.t), q = Math.min(1, (f.t - te) / TU("fallMsV146", 300)), s = 1 - q * (1 - Math.min(1, land));
            return Object.assign({}, f, { x: Math.round((c.x + ox * s) * 10) / 10, y: Math.round((c.y + oy * s) * 10) / 10 }); });
          H.gangDown = (H.gangDown || 0) + 1;
        });
      }
    }
    const k1 = at(K.frames, te);
    if (Math.hypot(k1.x - c0.x, k1.y - c0.y) > reach + 0.5) H.farAfter++;
    e.v146 = Object.assign(e.v146 || {}, { stick, glued: !stick, why });
    return S;
  }
  root.__contactV146 = contactV146;
  root.buildPlayScript = function (payload, cfg) { const s = buildPlayScript(payload, cfg); try { return contactV146(s); } catch (er) { return s; } };
  root.__computeLead = function(cx,cy,vx,vy,ax,ay,spd){
    const d=Math.hypot(cx-ax,cy-ay), tt=Math.min(0.38, d/Math.max(40,spd)*0.6);
    return {x:cx+vx*tt, y:cy+vy*tt};
  };
})(typeof window!=="undefined"?window:globalThis);

/* ===== v96 THE READ RADIUS — field vision as a radius, a yard a point from 75 =====
 * Vision was one continuous nudge on the lane read. Now it is also a RADIUS: at 74 and
 * under the back reads the line as before; 75 reads one yard further ahead, 76 two, 77
 * three, and so on (TU("visionRadiusFrom"), a yard per point, capped by
 * TU("visionRadiusMax")). The radius stretches the lookahead the back projects every
 * defender along (v82 THE BACK HAS EYES), so the gap he picks is judged on where they
 * will be that much further down the line. The attribute sheet quotes the same number. */
function visionRadiusV96(vis) { return Math.max(0, Math.min(TU("visionRadiusMax", 25), Math.round(vis || 50) - (TU("visionRadiusFrom", 75) - 1))); }
window.__visionRadiusV96 = visionRadiusV96;
/* ===== GRIDIRON FieldSim — agent-based play resolution =====
 * The play's RESULT emerges from 22 agents contesting with real attributes.
 * Returns legacy-resolver-compatible outcome objects and pushes a tick log
 * (frames + events, local coords: LOS at lx=0, +lx = offense direction)
 * onto window.__simQ for the renderer to display verbatim.
 */
(function (root) {
  const TICK = 33, YD = 5.88, F_TOP = 14, F_BOT = 426, MIDY = 220;
  const SIDELINE_TOP = F_TOP + 34, SIDELINE_BOT = F_BOT - 30;
  const OFF_L = ["WR","WR","TE","OL","OL","OL","OL","OL","QB","RB","WR"];
  const DEF_L = ["CB","CB","S","S","LB","LB","LB","DL","DL","DL","DL"];
  const OFF_Y = [78,372,306,158,190,222,254,286,222,262,120];
  const DEF_Y = [78,372,140,306,172,222,276,176,208,240,268];
  const OFF_LX = (lb,i)=> lb==="QB"?-38: lb==="RB"?-54: (lb==="WR"&&i===10)?-10:0;
  const DEF_LX = (lb)=> lb==="S"?88: lb==="LB"?52: lb==="CB"?25:15;
  // v24 TACKLE HEIGHT: rough real-life heights (inches) by role. Contact leverage
  // reads off the tackler-vs-carrier gap — a shorter man gets under pads and wraps
  // clean; a taller man tackles high and gets ducked, hurdled and trucked more.
  const HT_BY_POS = { QB:75, RB:71, WR:73, TE:77, OL:77, CB:71, S:72, LB:74, DL:75, DE:76, DT:75, NT:74 };
  const clampY = y=>Math.max(SIDELINE_TOP,Math.min(SIDELINE_BOT,y));
  const cl = (v,a,b)=>Math.min(b,Math.max(a,v));

  // v38: one acceleration model for every FieldSim movement command. Callers
  // request a target gear; ratings determine how quickly the player launches,
  // brakes, survives a cut, and rebuilds speed afterward.
  function evolveSpeed(a,targetFrac,dt,now,turn=0,brakeScale=1) {
    const accel=cl(a.accel||a.quick||a.spdA||55,1,99), agility=cl(a.agi||55,1,99), burst=cl(a.burst||accel,1,99);
    let frac=Math.max(0,a.vel||0);
    const hardTurn=turn>TU("accelRestartTurn",.34), wantsMove=targetFrac>.12;
    if(!wantsMove&&frac<TU("accelResetFrac",.08))a._launchReady=true;
    const turnEdge=hardTurn&&!a._hardTurning;
    if(a._launchAt==null||(wantsMove&&a._launchReady)||turnEdge){a._launchAt=now;a._launchReady=false;}
    a._hardTurning=hardTurn;
    if(turn>.04){
      const loss=Math.max(.08,TU("turnLossBase",.30)-(agility-50)*TU("turnLossAgilityK",.0024));
      frac*=Math.max(TU("turnRetentionFloor",.54),1-turn*loss);
    }
    const launchAge=Math.max(0,now-(a._launchAt==null?now:a._launchAt));
    const launch=launchAge<TU("accelLaunchMs",260)
      ? cl(1+(burst-50)*TU("burstAccelK",.0042),.80,1.22):1;
    const accelRate=Math.max(.75,TU("accelBasePerSec",3.0)+(accel-50)*TU("accelRatingK",.040))*launch;
    const brakeRate=Math.max(1.1,TU("brakeBasePerSec",3.0)+(agility-50)*TU("brakeAgilityK",.020)+(accel-50)*TU("brakeAccelK",.006))*brakeScale;
    const target=cl(targetFrac,0,TU("fieldSpeedCap",1.35));
    const rolling=target>frac&&frac>.18&&launchAge>=TU("rollingReadyMs",132)?TU("rollingAccelScale",3.0):1;
    const rate=target>=frac?accelRate*rolling:brakeRate;
    frac+=Math.sign(target-frac)*Math.min(Math.abs(target-frac),rate*dt/1000);
    a.vel=Math.max(0,frac);
    return a.vel;
  }

  /* v141: durability is a FieldSim read now — a glancing hit or a stagger takes a slice of the carrier's
   * speed, and a durable body keeps more of it (±15% around 50). Counted on root.__V141F for the check. */
  const durKeepV141 = c => { const k = cl(1 + ((c && c.dur || 50) - 50) * TU("durKeepK", .003), .85, 1.15);
    const F = root.__V141F = root.__V141F || { hits: 0, keepSum: 0, youHits: 0, youKeep: 0 }; F.hits++; F.keepSum += k;
    if (c && c.player && c.player.you) { F.youHits++; F.youKeep += k; } return k; };
  const RX_POS_V56={CB:1.14,S:1.08,LB:1.00,DE:.94,DT:.86,WR:1.10,RB:1.06,TE:.98,QB:1.00,OL:.84};
  function makeAgents(kOff, tDef, att, picks) {
    const byPos = (arr,pos)=>arr.filter(p=>p&&p.pos===pos);
    const avg = (arr,name)=>{ const v=arr.map(p=>att(p,name)).filter(Number.isFinite);
      return v.length? v.reduce((a,b)=>a+b,0)/v.length : 45; };
    const A = (p, side, i, lb) => {
      // per-agent variability: talent jitter (who they are) + daily form (how they show up)
      const jit = () => (Math.random()*10 - 5) + (Math.random()*6 - 3);
      const g = n => Math.max(20, Math.min(99, (p ? att(p,n) : avg(side==="off"?kOff:tDef, n)) + jit()));
      const speed=g("speed"), accel=g("acceleration")||g("burst")||speed;
       /* ===== v56 REACTION RATING =====
        * `a.quick` drives first-step latency, DL shed contests and play recognition.
        * The roster does carry a quickness value, but it is the TEAM AVERAGE plus
        * jit() of +-8 — measured across a full sim it spanned 69-88 for every
        * defender on the field, so a nose tackle and a corner were handed the same
        * reaction. A stat that cannot separate those two is not separating anyone.
        *
        * Reaction is the one place position is not a detail: a corner flips his hips
        * for a living, an interior lineman does not. The roster value still leads
        * where it exists; position scales it, and acceleration/agility/awareness
        * stand in when it does not. */
       const quick=Math.max(20,Math.min(99,Math.round(
         (g("quickness")||(accel*.55+g("agility")*.25+g("awareness")*.20))*(RX_POS_V56[lb]||1))));
      // real height (inches) drives tackle leverage: the you-player's actual body if
      // it's on the roster, otherwise the role base with a couple inches of jitter.
      const ht = (p && p.body && p.body.height >= 64 && p.body.height <= 84)
        ? p.body.height : Math.round((HT_BY_POS[lb] || 73) + (Math.random()*5 - 2.5));
      return { id:(side==="off"?"off":"def")+i, side, lb, ht,
        lx: side==="off"?OFF_LX(lb,i):DEF_LX(lb), y: side==="off"?OFF_Y[i]:DEF_Y[i],
        spd: 92 + speed*0.85, spdA: speed, str:g("strength"), blk:g("blocking"),
        tkl:g("tackling"), cov:g("coverage"), agi:g("agility"),
        burst:g("burst")||accel, accel, quick, aware:g("awareness"), cat:g("catching"),
        jump:g("jumping"), thr:g("throwing")||g("awareness"), vis:g("vision")||g("awareness"),
        stam:g("stamina"), grit:g("grit")||50, disc:g("discipline")||50, bc:g("ballControl")||50,
        dur:g("injuryResist")||50,                              // v141 durability: how much of his speed a carrier keeps through a hit
        reactMs: Math.max(100, TU("reactBaseMs", 295) - (quick-50)*2.4),   // quickness: first-step latency (v141: the base is a dial)
        vel: 0,                                                 // acceleration: ramps toward top speed
        // v20 stamina: the gas tank persists across plays (carried on the roster
        // player), and a player who emptied it is GASSED — moderately slower —
        // until his recovery plays tick down.
        gas0: (p && p._gasV20 != null) ? p._gasV20 : 100,
        gassedV20: !!(p && (p._gassedPlaysV20 || 0) > 0),
        // persona side-effects (you-player only): work-ethic burns/saves gas,
        // football-IQ shifts how smartly the sprint gets spent
        _gasBurnMul: (p && p.you && window.__youPersonaFxV20 && window.__youPersonaFxV20.gasBurn) || 1,
        _sprintIQV20: (p && p.you && window.__youPersonaFxV20 && window.__youPersonaFxV20.sprintIQ) || 0,
        engagedBy:null, engaging:null, shed:false, releaseT:0, cool:0, frames:[], player:p||null };
    };
    const pools = { off:{}, def:{} };
    ["QB","RB","WR","TE","OL"].forEach(p=>pools.off[p]=byPos(kOff,p).slice());
    ["CB","S","LB","DL"].forEach(p=>pools.def[p]=byPos(tDef,p).slice());
    // the user's roster player ALWAYS takes the field at his position slot, so the
    // gold marker and the stat credit track a real on-screen actor every play
    // ===== v111: unless this snap is one of his REST snaps. The engine normally swaps a backup
    // into his roster slot before the call, so he is not in `kOff` at all; `picks.restV111` is
    // the belt to that braces for any caller that hands us the real sheet and still wants him
    // off the field. Absent (every default) this is exactly the old line.
    const restV111 = !!(picks && picks.restV111);
    if (restV111) { ["QB","RB","WR","TE","OL"].forEach(p=>pools.off[p]=pools.off[p].filter(q=>!(q&&q.you)));
                    ["CB","S","LB","DL"].forEach(p=>pools.def[p]=pools.def[p].filter(q=>!(q&&q.you))); }
    const youPending = { off: restV111?null:(kOff.find(p=>p&&p.you)||null), def: restV111?null:(tDef.find(p=>p&&p.you)||null) };
    /* ===== v117 AND HE ROTATES THROUGH THEM =====
     * He used to be dropped into the FIRST slot in the formation list that matched his
     * position, every single snap. The slots are not interchangeable: the three linebacker
     * spots sit at DEF_Y 172 / 222 / 276, and the weak-side backer at 172 — index 4, the one
     * he always got — makes under a third of the stops the man over the ball makes (103 vs
     * 341, measured over 40 games). A team-mate never notices, because he is drawn out of the
     * pool at random and sees all three across a season. Pinning the you-player to the quiet
     * one and letting the duplicate ghosts cover the loud ones is what made his line look
     * right for the wrong reason. He is rolled into one of HIS position's slots per snap now,
     * the same draw everyone else gets, and takes a later one if a named pick claimed it. */
    const slotsForV117=(L,pos)=>L.reduce((a,lb,i)=>(lb===pos&&a.push(i),a),[]);
    const youSlot={off:-1,def:-1};
    ["off","def"].forEach(sd=>{ const yp=youPending[sd]; if(!yp) return;
      const sl=slotsForV117(sd==="off"?OFF_L:DEF_L, yp.pos);
      if(sl.length) youSlot[sd]=sl[Math.floor(Math.random()*sl.length)]; });
    /* ===== v117 ONE MAN, ONE SLOT =====
     * `take` picked out of a position pool and never removed what it had already handed out,
     * so one roster player could be fielded at two slots on the same snap. The you-player was
     * the man it doubled most: he is placed first, out of the very pool the later slots at his
     * position then draw from, so he was on the field as two or three linebackers at once on
     * 56% of his defensive snaps (measured, 30 games). Every stop those extra copies made was
     * booked to him — the credit traced to a named actor, as the house rule demands, but the
     * actor was a ghost standing in a team-mate's slot, so the stat was a team-mate's.
     * A man now leaves his pool the moment he is placed. The defense fills EXACTLY
     * (4 DL / 3 LB / 2 CB / 2 S against those same eleven slots), so it never runs dry; the
     * offense is one receiver short of its three-WR look, and that last slot takes the best
     * body who has not lined up yet rather than a second copy of one who has. */
    const placed = new Set();
    const drop = (side,p)=>{ if(!p) return; placed.add(p); const pool=pools[side][p.pos]; if(!pool) return;
      const i=pool.indexOf(p); if(i>=0) pool.splice(i,1); };
    // the named picks — the carrier, the target, the quarterback — hold their slots before the
    // first body is drawn. A pick used to be handed out on top of the pool, so an earlier slot
    // could draw the very man a later slot was reserving: a quarterback keeper put him at the
    // RB alignment AND under centre, one player, two markers, one stat line.
    ["off","def"].forEach(sd=>{ const pk=picks[sd]; if(!pk) return;
      Object.keys(pk).forEach(k=>{ const q=pk[k]; if(q&&typeof q==="object") drop(sd,q); }); });
    // and so does the you-player, for the same reason: his slot is rolled ahead of the map, so
    // an EARLIER slot at his position must not be able to draw him out of the pool first.
    ["off","def"].forEach(sd=>{ if(youPending[sd]) drop(sd,youPending[sd]); });
    const take = (side,pos,i,prefer)=>{ if(prefer&&!(restV111&&prefer.you)){ if(youPending[side]===prefer) youPending[side]=null; drop(side,prefer); return prefer; }
      const yp=youPending[side];
      if(yp && yp.pos===pos && i>=youSlot[side]){ youPending[side]=null; drop(side,yp); return yp; }
      const pool=pools[side][pos];
      if(pool&&pool.length) return pool.splice(Math.floor(Math.random()*pool.length),1)[0];
      // dry: the roster does not cover this formation at their own positions (three WR slots,
      // two receivers on the sheet). Line up a man who has not taken the field yet rather than
      // clone one who has — and never the you-player, who plays his own spot or none.
      const spare=(side==="off"?kOff:tDef).filter(q=>q&&!q.you&&!placed.has(q));
      if(!spare.length) return null;
      const pick=spare[Math.floor(Math.random()*spare.length)]; drop(side,pick); return pick; };
    const off = OFF_L.map((lb,i)=>A(take("off",lb, i, picks.off&&picks.off[i]), "off", i, lb));
    const def = DEF_L.map((lb,i)=>A(take("def",lb, i, picks.def&&picks.def[i]), "def", i, lb));
    return { off, def, all: off.concat(def) };
  }

  function sim(kind, kOff, tDef, att, picks, opts) {
    const S = makeAgents(kOff, tDef, att, picks);
    const A_all = Object.fromEntries(S.all.map(a=>[a.id,a]));   // id → agent lookup
    const events = [], ballFrames = [];
    // ---- v16.3 short sprint: a ~0.5s burst worth up to +20% speed, its length
    // extended by intelligence (awareness) + acceleration + stamina, then a
    // recovery before it can fire again. Only the ballcarrier and his nearest
    // pursuer kick it in; the renderer shows a draining stamina bar over the head.
    const SPRINT_BOOST = TU("sprintBoost", 0.20);
    const sprintDur = a => cl(500 + (a.aware-50)*4 + (a.accel-50)*3 + (a.stam-50)*3, 320, 900);
    const kickSprint = a => { if (!a || t < (a.sprintCool||0) || (a.sprintUntil && t < a.sprintUntil)
        || (a.gas!==undefined && a.gas < 22)) return;
      // v20 stamina IQ: a smart player (high awareness) protects his reserve — he
      // won't burn the tank toward empty unless HE is the one carrying the ball.
      if ((a.aware + (a._sprintIQV20 || 0)) >= TU("gasIQSmart", 68) && a.gas !== undefined
          && a.gas < TU("gasSmartReserve", 36) && a !== carrier) return;
      const dur = Math.round(sprintDur(a)); a.sprintUntil = t + dur; a.sprintCool = t + dur + 650;
      // sprinting burns real gas up front — this is what can empty the tank
      if (a.gas !== undefined) a.gas = Math.max(0, a.gas - TU("gasSprintCost", 14)*(a._gasBurnMul||1));
      emit("sprint",{who:a.id, dur, x:a.lx, y:a.y}); };
    const sprinting = a => !!(a && a.sprintUntil && t < a.sprintUntil);
    let t = 0, done = false, result = null, carrier = null, ballFlight = null;
    let ballPlayerV110 = null;   // v110: the roster player who actually played the ball, when it was not the coverage man
    /* ===== v150 B THE CREDIT IS THE MAN, NOT A FALLBACK =====
     * `ballPlayerV110 = ballMan.player || ballPlayerV110` let a break-up or a pick made by an agent with
     * no roster player fall through, at the booking, to `coverA.player` and then to `picks.cover` — the
     * man who was ASSIGNED, or the engine's own pre-rolled pick, who may not even be the agent standing
     * there. Measured over ~1,000 arrivals no defender ever carried a null player, so this never fired;
     * but it is exactly the fall-through CLAUDE.md's stat-credit rule forbids, so the play now remembers
     * the AGENT who made it (`ballByV110`), and the credit is his roster player or nobody — never a
     * stand-in. Nothing is rolled, nothing moves: the same random stream, the same result. `out.coverBy`
     * and `__V110.lastBall` name him, which is what v110check traces the credit against. */
    let ballByV110 = null;
    const V110 = root.__V110 = root.__V110 || { laps: 0, takeovers: 0, ballMen: 0, holds: 0 };   // v110: what the new paths actually did
    V110.lastBall = null;
    let ball = { lx: S.off[8].lx, y: S.off[8].y, h: 0 };
    const emit = (type, extra) => events.push(Object.assign({ t, type }, extra));
    const rec = () => { S.all.forEach(a=>a.frames.push({t, x:Math.round(a.lx*10)/10, y:Math.round(a.y*10)/10}));
      if (ballFlight) { const f=Math.min(1,(t-ballFlight.t0)/ballFlight.dur);
        // v36: the football starts fastest and loses a style-specific amount of
        // longitudinal speed to drag. Arrival time and outcome callbacks are unchanged.
        const drag=ballFlight.style==="bullet"?.04:ballFlight.style==="lob"?.13:.08;
        const q=f*(1+drag-drag*f);
        /* ===== v109 THE BALL COMES DOWN STEEPER THAN IT WENT UP =====
         * The height used to be one symmetric sine: apex at the exact middle of the flight,
         * the same shape rising and falling. A thrown ball bleeds speed to drag on the way, so
         * it spends more of its flight climbing than falling — the apex sits past halfway and
         * the descent is the steeper leg, which is what a receiver is settling under. Two
         * quarter-sines meeting at the apex: still 0 at both ends, still smooth at the top,
         * and the landing point, `dur` and every callback are untouched. */
        const af=Math.max(.2,Math.min(.8,ballFlight.apexF!=null?ballFlight.apexF:TU("arcApexFrac",.55)));
        const hf=f<af?Math.sin(Math.PI/2*f/af):Math.sin(Math.PI/2*(1-f)/(1-af));
        ball={ lx: ballFlight.x0+(ballFlight.x1-ballFlight.x0)*q, y: ballFlight.y0+(ballFlight.y1-ballFlight.y0)*q,
               h: hf*ballFlight.arc };
        if(f>=1){ const cb=ballFlight.done; ballFlight=null; cb&&cb(); } }
      else if (carrier) ball = { lx: carrier.lx, y: carrier.y+4, h:0 };
      ballFrames.push({t, x:Math.round(ball.lx*10)/10, y:Math.round(ball.y*10)/10, h:Math.round(ball.h)}); };
    /* v56: the route-break reaction curve, as one testable function.
     * The old hard clamp at 390ms ate the bottom half of the stat range — on a
     * 90-degree break every defender below rxq~46 produced the SAME 390ms — so it
     * eases into a higher ceiling instead of chopping at a low one. Below the knee
     * it stays linear, which is where most reads live. */
    const routeReactDelayV56 = (rxq, angleK, badBite) => {
      const raw=(TU("routeReactBase",285)-(rxq-50)*3.0)*angleK*(badBite?1.35:1);
      const lo=TU("routeReactMin",70),hi=TU("routeReactMax",520),knee=TU("routeReactKnee",330);
      return Math.round(raw<=knee?Math.max(lo,raw)
        :knee+(hi-knee)*(1-Math.exp(-(raw-knee)/((hi-knee)*.9))));
    };
    try{window.__REACT_V56={delay:routeReactDelayV56,posK:RX_POS_V56,
      rxq:(q,a,d)=>q*.55+a*.30+d*.15, iq:(q,a,d)=>a*.58+q*.24+d*.18,
      reactMs:q=>Math.max(100,340-(q-50)*2.4)}}catch(_e){}
    const mv = (a, tx, ty, mult) => { let dx=tx-a.lx, dy=ty-a.y; const d=Math.hypot(dx,dy);
      a._sidelineCross=null;
      if(d<0.5) { evolveSpeed(a,0,TICK,t,0,1); return; } dx/=d; dy/=d;
      let wantDx=dx,wantDy=dy;
      /* ===== v56 PERCEPTION-ACTION LATENCY =====
       * reactMs has been computed on every agent since the sim was written —
       * "quickness: first-step latency" — and read by absolutely nothing. Agents
       * re-aimed instantly every tick; the only brake on a direction change was
       * turn radius, which is AGILITY. So the stat that says it governs reaction
       * governed nothing.
       *
       * A change of INTENT is not free now. When a defender's aim swings past the
       * gate, he keeps steering on the intent he already had until reactMs has
       * elapsed — scaled by how big the swing is, because a slight adjustment is
       * not a re-decision. Quickness sets the length.
       *
       * DEFENCE ONLY, deliberately: an offensive player breaking off a route or a
       * back making his cut is executing a plan, not reacting to one, and lagging
       * that would blunt route running (and the route check would catch it).
       * Blockers reading stunts are the obvious extension, left for later. */
      if(a.side==="def" && a._wantDx!=null){
        const demand=1-Math.max(-1,Math.min(1,wantDx*a._wantDx+wantDy*a._wantDy));
        // Only the STEERING vector is held. The first version also overwrote
        // wantDx/wantDy, which are stored below as the agent's remembered intent —
        // so the next tick measured demand against the stale vector, re-triggered,
        // and the defender never escaped. Defences stopped covering anything and
        // games finished 251-249. The refractory window stops a hold chaining
        // straight into the next one during continuous pursuit.
        if(t<(a._rxUntil||0)){
          dx=a._rxDx; dy=a._rxDy;                                    // still on the old read
        } else if(demand>TU("reactGate",.5) && t>(a._rxCool||0)){
          const hold=(a.reactMs||300)*Math.min(1,demand/1.4)*TU("reactScale",.38);
          a._rxUntil=t+hold; a._rxCool=t+hold+TU("reactRefractory",320);
          a._rxDx=a._wantDx; a._rxDy=a._wantDy;
          dx=a._rxDx; dy=a._rxDy;
          if(window.__REACT_DEBUG){const D=window.__REACT_DEBUG,k=a.quick<40?"low":a.quick<70?"mid":"high";
            D.n++;D.ms+=hold;(D.byQuick[k]||(D.byQuick[k]={n:0,ms:0}));D.byQuick[k].n++;D.byQuick[k].ms+=hold;
            D.qMin=Math.min(D.qMin==null?999:D.qMin,a.quick);D.qMax=Math.max(D.qMax||0,a.quick);D.qSum=(D.qSum||0)+a.quick}
        }
      }
      // agility: tighter turns for agile players. v24 widened the per-point effect
      // (0.0022→0.0026) so cuts are visibly cleaner for elite agility and sloppier
      // for low — an elite back keeps his speed through a hard plant, a stiff one
      // bleeds it. Mirrored in turnTest() so the unit hook stays honest.
      const carry = Math.max(0.06, (0.28 - (a.agi-50)*0.0026) * (0.6 + (a.vel||0)*0.7));
      let turn=0;
      if(a._dx!=null){
        const dot = dx*a._dx + dy*a._dy;
        turn=1-Math.max(-1,Math.min(1,dot));
        /* ===== v109 THE FEET PLANT — the turn is EMITTED =====
         * `turn` has been computed here since the sim was written and handed to evolveSpeed to
         * bleed speed, but the renderer never heard about it: a hard change of direction reached
         * the field as a slide between two keyframes. It goes out now, as `turn`, once per
         * turnEmitGapMs per agent and only when he is actually moving (a stationary man
         * re-aiming is not a turn, and neither is a man jittering across a spot he has reached:
         * the target must be turnEmitMinPx off, and the new line must not be the one he was on
         * two ticks ago — an A-B-A flip-flop is held still, a real reversal, which leaves that
         * line, goes out — and a man another rule pins to his spot every tick, whom `mv` keeps
         * re-aiming, has to have MOVED turnEmitMovePx over the last four ticks). `dir` is the
         * sign of the swing across his old line. Nothing here changes the steering. */
        const back9=a._pdx1==null?-1:dx*a._pdx1+dy*a._pdy1; a._pdx1=a._dx; a._pdy1=a._dy;   // the heading two ticks back, for the flip-flop test
        if(a._posT9!==t){ a._posT9=t; const h=a._posH9||(a._posH9=[]); h.push(a.lx,a.y); if(h.length>8) h.splice(0,2); }
        const moved9=a._posH9&&a._posH9.length>=8?Math.hypot(a.lx-a._posH9[0],a.y-a._posH9[1]):0;
        if(turn>TU("turnEmitMin",.25)&&(a.vel||0)>.5&&d>TU("turnEmitMinPx",6)&&back9<TU("turnEmitBackDot",.5)&&moved9>=TU("turnEmitMovePx",4)&&t>=(a._turnEmitAt||0)){ a._turnEmitAt=t+TU("turnEmitGapMs",200);
          emit("turn",{who:a.id,x:Math.round(a.lx),y:Math.round(a.y),deg:Math.round(Math.acos(Math.max(-1,1-turn))*180/Math.PI),
            dir:(a._dx*dy-a._dy*dx)>=0?1:-1,vel:Math.round((a.vel||0)*100)/100}); }
        dx=dx*(1-carry)+a._dx*carry; dy=dy*(1-carry)+a._dy*carry; const n=Math.hypot(dx,dy)||1; dx/=n; dy/=n;
      }
      a._turnDemand=a._wantDx==null?0:1-Math.max(-1,Math.min(1,wantDx*a._wantDx+wantDy*a._wantDy));
      a._wantDx=wantDx; a._wantDy=wantDy; a._dx=dx; a._dy=dy;
      // stamina: legs fade late in the play
      const fade = t > 2200 ? Math.max(0.62, 1 - (t-2200)/1000 * (0.16 * (1 - (a.stam-50)/100))) : 1;
      // grit: released blockers close cooldown faster (handled in tryTackle); release ramp here
      const rel = a.releaseT && t < a.releaseT + 520 ? 0.45 + (t - a.releaseT)/520 * 0.55 : 1;
      a.gas = a.gas===undefined ? (a.gas0!==undefined ? a.gas0 : 100) : a.gas;
      const tank = a.gas < 30 ? 0.88 : 1;
      // v20: a GASSED player (emptied his tank on a recent play) is moderately
      // slower everywhere until his recovery plays run out
      const gassed = a.gassedV20 ? TU("gassedSpeedMul", 0.9) : 1;
      const targetGear=Math.max(0,(mult||0)*fade*rel*tank*gassed);
      evolveSpeed(a,targetGear,TICK,t,turn,1);
      if (a.vel > 0.92) a.gas = Math.max(0, a.gas - 0.42*(a._gasBurnMul||1)); else a.gas = Math.min(100, a.gas + 0.2);
      let step=Math.min(d, a.spd*a.vel*TICK/1000);
      /* ===== v151 D ONE PAIR OF LEGS A TICK =====
       * `mv` is a steering command, and a few callers issue it twice in one tick for the same man —
       * a rush lane then a sack close-out, a pursuit then a support close — so each call spent a
       * full stride and he covered two. Measured: 3% of all moves were a second move in the same
       * tick, and they are the defenders the broadcast shows arriving at twice their top speed
       * ("flying in from nowhere"). The budget is his legs, not the call: whatever ground the
       * first command spent this tick, the second only gets what is left of `paceTickCapV151D`
       * times his top speed (the fieldSpeedCap ceiling every single move already respects).
       * Kill switch `TU("paceV151D", 0)`. */
      if (TU("paceV151D", 1)) {
        if (a._mvT151 !== t) { a._mvT151 = t; a._mvUsed151 = 0; }
        const room = Math.max(0, a.spd * TU("paceTickCapV151D", 1.35) * TICK / 1000 - a._mvUsed151);
        if (step > room) { step = room; const P = root.__V151D_SIM = root.__V151D_SIM || {}; P.paceClamped = (P.paceClamped || 0) + 1; }
        a._mvUsed151 += step;
      }
      const x0=a.lx,y0=a.y,x1=x0+dx*step,y1=y0+dy*step;
      // Preserve the un-clamped segment long enough to resolve the exact first
      // sideline contact. Clamping alone made fast players live on the stripe for
      // a tick and moved the dead-ball spot downfield.
      let plane=null;
      if(y0>SIDELINE_TOP&&y1<=SIDELINE_TOP)plane=SIDELINE_TOP;
      else if(y0<SIDELINE_BOT&&y1>=SIDELINE_BOT)plane=SIDELINE_BOT;
      if(plane!=null){const den=y1-y0,q=Math.max(0,Math.min(1,Math.abs(den)<1e-9?0:(plane-y0)/den));
        a._sidelineCross={x:x0+(x1-x0)*q,y:plane};}
      a.lx=x1; a.y=clampY(y1); };

    // v82: one blocker on one man — used by return-team wedges and the kick teams'
    // jammers. Reaches, holds him for a stretch, sheds off strength/agility against
    // blocking; a shed man is free of everyone for a beat rather than forever.
    const blockTick = (o, pool, reach) => {
      let tgt = o._stalk && !(o._stalk.stunned && t < o._stalk.stunned) && !(t < (o._stalk._freeUntil||0)) ? o._stalk : null;
      if (!tgt) { let td = reach || 90;
        for (const a of pool) { if ((a.stunned && t < a.stunned) || t < (a._freeUntil||0) || a._climbedBy) continue;
          const d2 = Math.hypot(a.lx - o.lx, a.y - o.y); if (d2 < td) { td = d2; tgt = a; } }
        if (tgt) { o._stalk = tgt; tgt._climbedBy = o.id; } }
      if (!tgt) return false;
      mv(o, tgt.lx + (o.side === "def" ? 6 : -6), tgt.y, .85);
      if (Math.hypot(o.lx - tgt.lx, o.y - tgt.y) < 14) {
        const pshed = cl(((tgt.str*.5 + tgt.agi*.5) - o.blk) * .0006 + TU("kickShedBase", .03), .004, .08);
        if (Math.random() < pshed) { tgt._freeUntil = t + TU("kickFreeMs", 700); tgt._climbedBy = null; o._stalk = null; }
        else { if (o._blockAnn !== tgt.id) { o._blockAnn = tgt.id; emit("block", { by: o.id, on: tgt.id, x: o.lx, y: o.y }); } tgt.held = t + 60; } }
      return true;
    };
    // ---- trench: paired blocking contests; engaged rushers CRAWL ----
    const rushers = S.def.filter(a=>a.lb==="DL");
    const blockers = S.off.filter(a=>a.lb==="OL");
    rushers.forEach((r,i)=>{ r.engaging = blockers[Math.min(i+ (i>=2?1:0), 4)]; r.engaging.engagedBy=r; });
    const freeOL = blockers.find(o=>!o.engagedBy);
    const best = rushers.slice().sort((a2,b2)=>(b2.str+b2.quick)-(a2.str+a2.quick))[0];
    let doubled = null, blitzer = null;
    if (freeOL && best) { doubled = best; best.doubled = true; freeOL.doubling = best; }
    if (kind === "pass" && Math.random() < 0.18) {
      blitzer = S.def.filter(a=>a.lb==="LB")[Math.floor(Math.random()*3)];
      if (blitzer) blitzer.blitzing = true;
    }
    const shedTick = (r) => { if (r.shed || (r.stunned && t<r.stunned)) return;
      const p = cl(((r.str*0.55 + r.quick*0.45) - r.engaging.blk) * 0.00042 + 0.0035, 0.0008, 0.028) * (kind==="run"?0.55:1) * (r.doubled?0.32:1)
        * (playAction && t < declareT + 150 ? TU("paShedK", .5) : 1);   // v81: the front plays the run fake too
      if (Math.random() < p) { r.shed = true; r.releaseT = t; emit("shed",{who:r.id});
        // v30: beaten this fast, a real lineman grabs cloth — holding candidate
        if (t < TU("holdFlagMs",900) && r.engaging && r.engaging.player) flagCand.hold = r.engaging.player; } };
    // ---- v16.3 line play: the two widest D-linemen are edge rushers (DEs). They
    // work the corner to bend the pocket and can beat the tackle with a fast SWIM
    // move (finesse: quickness + agility). An O-lineman who dominates his man
    // PANCAKES him — the rusher is stunned flat for a few seconds and the blocker
    // peels off to double-team another rusher.
    const edges = rushers.slice().sort((a2,b2)=>Math.abs(b2.y-MIDY)-Math.abs(a2.y-MIDY)).slice(0,2);
    edges.forEach(e=>{ e.edge = true; });
    /* ===== v82 SPECIAL TEAMS — the third phase runs on the same engine =====
     * Punts, kickoffs and field goals used to resolve as numbers outside the sim
     * and render from the choreographer. Now they are agent plays: a snap to the
     * punter or holder, protection that has to hold while the rush comes (a free man
     * who reaches the kick point BLOCKS it), the kick's own flight, coverage men
     * running their LANES and narrowing on the returner, gunners fighting jammers,
     * a returner who settles under the ball and fair-catches when the coverage is on
     * him, a return with blockers forming in front of him, and the same contact
     * model deciding where he goes down. The offence slots keep their labels (the
     * "QB" is the kicker/punter, the "RB" the holder or personal protector) so the
     * you-player takes the field at his own position and the art stays right.
     * Special-teams tackles are NOT booked to the box score (creditcheck's sim
     * truth counts scrimmage wraps), which is noted in the docs. */
    const isKick = kind === "punt" || kind === "kickoff" || kind === "fg";
    const kickOpts = opts || {};
    let kRushers = [], kBlockers = [], returner = null, kickPhaseAt = 0;
    if (isKick) {
      const put = (a, lx, y) => { a.lx = lx; a.y = clampY(y); };
      const O = S.off, D = S.def;
      S.all.forEach(a => { a.engagedBy = null; a.engaging = null; a.doubled = false; a.doubling = null; a.edge = false; });
      if (kind === "punt") {
        [O[3],O[4],O[5],O[6],O[7]].forEach((a,i)=>put(a, 0, 174 + i*24));
        put(O[2],-6,150); put(O[10],-6,294); put(O[9],-40,232); put(O[8],TU("punterLx",-82),222);
        put(O[0],0,60); put(O[1],0,380);
        [D[7],D[8],D[9],D[10]].forEach((a,i)=>put(a, 8, 180 + i*28));
        put(D[4],14,150); put(D[5],14,222); put(D[6],14,296);
        put(D[0],16,66); put(D[1],16,374);
        const land = (kickOpts.gross || 40) * YD;
        put(D[2], land - 6, 222); put(D[3], Math.max(60, land - 70), 262);
        kBlockers = [O[3],O[4],O[5],O[6],O[7],O[2],O[10],O[9]]; kRushers = [D[7],D[8],D[9],D[10],D[4],D[5],D[6]];
      } else if (kind === "kickoff") {
        put(O[8], -40, 232);
        [O[0],O[1],O[2],O[3],O[4],O[5],O[6],O[7],O[9],O[10]].forEach((a,i)=>put(a, -10, 72 + i*31));
        const land = (kickOpts.gross || 60) * YD;
        put(D[2], land - 8, 222); put(D[3], land - 80, 262);
        [D[7],D[8],D[9],D[10],D[4],D[5],D[6],D[0],D[1]].forEach((a,i)=>put(a, 200 + (i%3)*22, 96 + i*31));
      } else {
        [O[3],O[4],O[5],O[6],O[7],O[2],O[10]].forEach((a,i)=>put(a, 0, 150 + i*24));
        put(O[0], -4, 126); put(O[1], -4, 318);
        put(O[9], TU("holderLx", -42), 226); put(O[8], TU("kickerLx", -58), 244);
        [D[7],D[8],D[9],D[10],D[4],D[5],D[6]].forEach((a,i)=>put(a, 8, 150 + i*24));
        put(D[0], 2, 164); put(D[1], 2, 284); put(D[2], 34, 200); put(D[3], 34, 250);
        kBlockers = [O[3],O[4],O[5],O[6],O[7],O[2],O[10]]; kRushers = [D[7],D[8],D[9],D[10],D[4],D[5],D[6],D[0],D[1]];
      }
      returner = D[2];
      // a wing who misses his edge man: the free rusher off the corner is where blocks come from
      S.off[0]._wingMiss = kind === "fg" && Math.random() < TU("fgWingMissP", .3) && Math.random() < .5;
      S.off[1]._wingMiss = kind === "fg" && Math.random() < TU("fgWingMissP", .3) && !S.off[0]._wingMiss;
      kRushers.forEach(r => { if (kind === "fg" && (r === D[0] || r === D[1])) { r._edgeRush = true; return; }   // the corners come off the edge
        const o = kBlockers.filter(b=>!b.engagedBy).sort((p2,q2)=>Math.abs(p2.y-r.y)-Math.abs(q2.y-r.y))[0];
        if (o && Math.abs(o.y - r.y) < 30) { r.engaging = o; o.engagedBy = r; } else r._edgeRush = true; });
      S.all.forEach(a => { a._laneY = a.y; });
    }
    /* ===== v82 THE FRONT HAS A PLAN — stunts, a spy, the protection call, the chip =====
     * The pass rush was one dimension: four men shed or did not. Now the front can
     * run a TWIST (the interior man crashes the outside gap first, the edge loops
     * behind him into the vacated lane — the line has to pass it off, and a line
     * that does not read it hands the looper a free run), a SPY mirrors a mobile
     * quarterback instead of dropping, and the offence answers with a PROTECTION
     * CALL (the centre reads the blitz side and slides the line toward it — read it
     * wrong and the back is alone on the blitzer from the wrong side) and a CHIP
     * (the tight end hits the edge on his way into the route). */
    let stunt = null, spy = null, protection = { slide: 0, read: true }, chipper = null, disguise = null;
    if (kind === "pass") {
      const qb0 = S.off[8];
      if (Math.random() < TU("stuntRate", .22)) {
        const looper = edges[Math.floor(Math.random()*edges.length)];
        const pen = rushers.filter(r=>!r.edge).sort((a2,b2)=>Math.abs(a2.y-looper.y)-Math.abs(b2.y-looper.y))[0];
        if (looper && pen && looper.engaging && pen.engaging) {
          stunt = { looper, pen, at: TU("stuntLoopMs", 380) + Math.random()*160, resolved: false };
          looper._stunt = "loop"; pen._stunt = "pen";
        }
      }
      if (qb0.spdA >= TU("spyQbSpd", 62) && Math.random() < TU("spyRate", .55)) {
        spy = S.def.filter(a=>a.lb==="LB" && a!==blitzer).sort((a2,b2)=>Math.abs(a2.y-MIDY)-Math.abs(b2.y-MIDY))[0] || null;
        if (spy) spy._spy = true;
      }
      if (blitzer) {
        const c0 = blockers[2];
        const readP = cl(TU("slideReadBase", .55) + (c0.aware - 50) * TU("slideReadAwareK", .008), .2, .92);
        protection.read = Math.random() < readP;
        protection.slide = protection.read ? (Math.sign(blitzer.y - MIDY) || 1) : (Math.random() < .5 ? -(Math.sign(blitzer.y - MIDY) || 1) : 0);
      }
      const te0 = S.off[2];
      if (te0 && te0.player !== (picks && picks.target) && Math.random() < TU("chipRate", .5)) {
        const edge = edges.slice().sort((a2,b2)=>Math.abs(a2.y-te0.y)-Math.abs(b2.y-te0.y))[0];
        if (edge) chipper = { te: te0, edge, until: TU("chipUntilMs", 520) };
      }
      /* ===== v82 DISGUISE — the shell the quarterback sees is not the shell he gets =====
       * Safeties can show two-high and ROTATE one down as a robber after the snap;
       * corners can PRESS and jam the release instead of playing off. The QB grades
       * his reads off the pre-snap picture, so a rotation he does not see coming
       * (awareness) takes the window away after he has already decided. */
      const safeties = S.def.filter(a=>a.lb==="S");
      const rot = safeties.length >= 2 && Math.random() < TU("rotateRate", .35);
      const robber = rot ? safeties[Math.floor(Math.random()*safeties.length)] : null;
      disguise = { rot, robber, rotateAt: 160 + Math.random()*260, press: [], fooled: null };
      if (robber) robber._robber = true;
      S.def.filter(a=>a.lb==="CB").forEach(cb => {
        if (Math.random() < cl(TU("pressRate", .4) + (cb.cov-55)*.004, .15, .7)) { cb._press = true; cb.lx = TU("pressLx", 6); disguise.press.push(cb.id); } });
    }
    const swimTick = (r) => { if (r.shed || !r.edge || !r.engaging || (r.stunned && t<r.stunned)) return;
      const p = cl(((r.quick*0.5 + r.agi*0.5) - r.engaging.blk*0.9) * 0.0006 + 0.004, 0.001, 0.03) * (kind==="run"?0.6:1) * (r.doubled?0.4:1);
      if (Math.random() < p) { r.shed = true; r.swim = true; r.releaseT = t; emit("swim",{who:r.id, x:r.lx, y:r.y}); } };
    const pancakeTick = (o) => { if (o._free || o.pancaked) return;
      const r = o.engagedBy; if (!r || r.shed || (r.stunned && t<r.stunned)) return;
      const edge = o.blk - (r.str*0.6 + r.quick*0.4);
      if (edge <= 10) return;                                  // only a real mismatch flattens a man
      // v81: a pancake is RARE — at .0009/tick a dominant line flattened someone on
      // a third of its snaps; the per-tick rate now lands a dominant lineman about
      // one pancake a game, and the mesh roll (rollBlockV81) carries the rest
      if (Math.random() < cl((edge-10)*TU("pancakeTickK", 0.00012), 0, 0.02)) {
        r.stunned = t + 1800 + Math.random()*1000; r.shed = false; if (r.engaging) r.engaging = null;
        o._free = true; o.pancaked = t; emit("pancake",{who:r.id, by:o.id, x:r.lx, y:r.y}); } };
    const freeOLHelp = (qb) => { blockers.forEach(o=>{ if(!o._free) return;
      let tgt=null, td=1e9;
      for (const r of rushers) { if (r.stunned && t<r.stunned) continue;
        const d2=Math.hypot(r.lx-qb.lx,r.y-qb.y); if(d2<td){td=d2;tgt=r;} }
      if (tgt) { mv(o, tgt.lx-6, tgt.y, 0.6); if (Math.hypot(o.lx-tgt.lx,o.y-tgt.y)<14){ tgt._doubled=t; tgt.doubled=true; } } }); };

    // ---- v16.2 contact resolution: momentum + strength + elusiveness ----
    // weight ≈ mass by position; momentum = weight × speed. A contact resolves to
    // a WHIFF (shifty back dodges in space), a STIFF-ARM (carrier strength wards the
    // tackler off), a TRUCK / broken tackle (carrier power + momentum flattens him),
    // a STAGGER (grazing arm-tackle that only knocks the runner off-stride — he
    // stays up), a BIG-STICK / BOTH-FALL collision (violent even momentum), or a
    // clean WRAP. Only one defender commits at a time so most stops read as SOLO; a
    // second man in on it makes ~30% assisted (gang). Big stat gaps swing every roll
    // hard — a superstar back beats a scrub far more often — but nothing hits 100%.
    const WT = {DT:1.06,DE:.96,DL:1.0,NT:1.08,LB:.86,S:.7,CB:.58,QB:.6,RB:.72,WR:.54,TE:.82,OL:1.12};
    let brokenShown = 0, committerId = null, committerAt = 0, ganged = false;
    // v30 FLAG CANDIDATES — the sim RECORDS what a real official could have flagged
    // (a blocker beaten instantly = holding candidate; tight contact on an incomplete
    // deep ball = DPI candidate; a wrap from directly behind = face-mask candidate).
    // The game layer rolls whether a flag is actually thrown — so every penalty that
    // IS called traces to something that genuinely happened on the field.
    const flagCand = { hold: null, dpi: null, fm: null, hc: null };   // v103: hc — the horse collar, hauled down from behind
    /* ===== v109 THE HIT HAS A POINT =====
     * Every contact event used to send the carrier's centre (or the defender's) and nothing
     * else: no point of impact, no direction, no weight, and no way to tell which commit it
     * resolved — `tackleLunge` fired on every commit and the renderer paired it with whatever
     * outcome landed nearest, which mis-paired the moment two men arrived in the same tick.
     * Now every commit draws a number (`cid`, the sequence below) and every event that resolves
     * it echoes the number, together with the geometry of the collision: `ix,iy` the midpoint
     * of the two bodies, `nx,ny` the unit normal from the defender through the carrier,
     * `impact` the momentum mismatch |cMom − dMom|, and `side` which side of the carrier the
     * defender came from (+1 below him on screen, −1 above — the grip's own convention).
     * Cosmetic: nothing here feeds an outcome. */
    let commitSeqV109 = 0;
    /* ===== v143 THE TACKLE IS A MOVE, NOT A COLLISION =====
     * A stop resolved in one tick: the committer arrived inside `tackleGrabDist` and `contact()`
     * rolled the whole thing off ratings and a height gap. Three things a real tackle has were
     * missing, and all three are things a viewer can see.
     *
     * THE ANGLE. `behind` was the only geometry that counted (a dot product over .55), so a man
     * flying across the carrier's face at forty-five degrees and one breaking down square in front
     * of him rolled identical numbers. `angleQV143` grades the line he is actually on: his own
     * motion against the unit vector to where the carrier is GOING — the same lead point the
     * pursuit code aims at. On the intercept is +1, across it 0, over-running it negative. It is
     * scaled by how fast HE is moving, because a man standing in the gap has no angle to get
     * wrong; v110 made that defender the most in-position one on the field and this must not undo
     * it. `angleGoodDotV143` is the pivot, set to the measured mean so the term is mean-zero.
     *
     * THE WINDUP. A defender who has had time to gather — to break down and sink his hips — makes
     * the tackle he is supposed to make; one still at a dead sprint is lunging, and a lunge misses.
     * `windupV143` is the time he NEEDS (tackling and discipline buy it, closing speed spends it)
     * against the time he has HAD since he entered the commit window. SET or RUSHED is the one
     * boolean the rolls read, centred on `windupSetMeanV143`.
     *
     * LOW / MEDIUM / HIGH. `style` existed but was a CONSEQUENCE — derived from the height gap
     * after the wrap had already landed, and read only by the picture. It is a CHOICE now
     * (`aimPickV143`), taken before any roll, off the height gap, the carrier's speed and power,
     * the space, and whether he is set. Each aim is then really a different tackle:
     *   LOW  — at the legs. Beats speed, cannot be trucked or stiff-armed, but a springy back
     *          hurdles it, there is no ball to attack, and the carrier falls FORWARD over the top.
     *   MID  — the form tackle. The best wrap there is and no way for it to go badly wrong.
     *   HIGH — at the chest and the ball. Kills forward progress and is the only aim that strips or
     *          delivers a big stick, but it is what gets ducked, stiff-armed and run through.
     * `AIM_FX_V143` is deliberately near zero-sum across the aim mix, so the stop RATE holds while
     * the WAY men are stopped changes; `scoreneutralcheck.mjs` is what proves that.
     * The aim rides `hit`, so it reaches every event the collision emits for free.
     * `window.__V143`; `v143check.mjs`, then `scoreneutralcheck.mjs`, `tacklecheck.mjs`. */
    const V143 = root.__V143 = root.__V143 || { aim: { low: 0, mid: 0, high: 0 }, set: 0, rushed: 0,
      angSum: 0, angN: 0, angRaw: 0, wuNeed: 0, wuHad: 0, res: {} };
    /* Measured on the APPROACH and frozen, not at the collision: by the time he is 16px away he
     * has already arrived, the lead point is further from him than the carrier is, and the dot
     * product is dominated by the carrier's own heading rather than by the line the defender took
     * (measured: a mean of 0.08, i.e. pure noise). The angle you took is decided on the way in, so
     * it is taken once — when he enters the watch window — and carried on `d._angQV143`. The lead
     * is the time it will actually take him to get there, not a fixed fifth of a second. */
    const angleQV143 = (d, c, gap) => {
      const mvl = Math.hypot(d._dx || 0, d._dy || 0);
      const spdFrac = cl((d.vel || 0) / Math.max(.05, TU("angleFullVelV143", .55)), 0, 1);
      if (mvl < .05 || spdFrac < .04) return 0;                 // not moving: judged on position, not on a line
      const closing = Math.max(TU("angleMinClosePxV143", 70), (d.vel || 0) * d.spd);
      const lead = cl((gap || 30) / closing, TU("angleLeadMinV143", .04), TU("angleLeadMaxV143", .40));
      let ax = (c.lx + (c._dx || 0) * c.spd * lead) - d.lx, ay = (c.y + (c._dy || 0) * c.spd * lead) - d.y;
      const al = Math.hypot(ax, ay); if (al < .25) return 0;
      const dot = ((d._dx || 0) / mvl) * (ax / al) + ((d._dy || 0) / mvl) * (ay / al);
      V143.angRaw += dot; V143.angN++;
      d._angDotV143 = +dot.toFixed(3); d._angSpdV143 = +spdFrac.toFixed(3);
      return cl((dot - TU("angleGoodDotV143", .63)) / TU("angleSpanV143", .30), -1, 1) * spdFrac;
    };
    const windupV143 = (d, dSpd) => {
      const need = cl(TU("windupBaseMsV143", 150) - (d.tkl - 50) * TU("windupTklKV143", 1.1)
        - (d.disc - 50) * TU("windupDiscKV143", .7)
        + Math.max(0, dSpd - TU("windupSpdRefV143", 150)) * TU("windupSpdKV143", .35),
        TU("windupMinMsV143", 40), TU("windupMaxMsV143", 320));
      const had = d._closeV143 != null ? (t - d._closeV143) : 0;
      return { need: Math.round(need), had: Math.round(had), set: had >= need };
    };
    /* what each aim is worth. Near zero-sum across the mix the picker actually produces — the
     * point is to change HOW a man is stopped, not how often. `wrapQ` is the counterweight: the
     * evasion bumps high and low hand out are paid back by a better wrap when the aim is right. */
    const AIM_FX_V143 = {
      low:  { whiff: -.015, hurdle: +.07, stiff: -.04, truck: -.07, bounce: +.01, wrapQ: +5, driveK: 1.00, strip: 0,    stick: 0 },
      mid:  { whiff: -.010, hurdle: -.02, stiff: -.01, truck: -.02, bounce: -.02, wrapQ: +7, driveK: 1.00, strip: .45, stick: .6 },
      high: { whiff: +.030, hurdle: -.06, stiff: +.035, truck: +.10, bounce: +.04, wrapQ: -3, driveK: .35,  strip: 1.25, stick: 1.3 }
    };
    const AIM_OFF_V143 = { whiff: 0, hurdle: 0, stiff: 0, truck: 0, bounce: 0, wrapQ: 0, driveK: 1, strip: 1, stick: 1 };
    const aimPickV143 = (d, x) => {
      let wLow = TU("aimLowBaseV143", 1), wMid = TU("aimMidBaseV143", 2.0), wHigh = TU("aimHighBaseV143", 1);
      const lv = cl(x.lev, -8, 8), K = TU("aimLevKV143", .09);
      wHigh *= 1 + lv * K; wLow *= 1 - lv * K;                  // v24's leverage, as a decision rather than an outcome
      const fast = cl((x.cSpd - x.dSpd) / TU("aimSpdRefV143", 60), -1, 1);
      wLow *= 1 + Math.max(0, fast) * TU("aimFastLowKV143", .55);
      wHigh *= 1 - Math.max(0, fast) * TU("aimFastHighKV143", .5);
      const pow = cl((x.cStr - x.dStr) / TU("aimPowRefV143", 30), -1, 1);
      wHigh *= 1 - Math.max(0, pow) * TU("aimPowHighKV143", .6);
      wLow *= 1 + Math.max(0, pow) * TU("aimPowLowKV143", .4);
      if (!x.set) { wLow *= TU("aimRushLowKV143", 1.4); wMid *= TU("aimRushMidKV143", .55); wHigh *= TU("aimRushHighKV143", .7); }
      wMid *= 1 + (d.disc - 50) * TU("aimDiscKV143", .006) + (x.openField ? TU("aimOpenMidKV143", .25) : 0);
      if (x.behind) { wHigh *= TU("aimBehindHighKV143", 1.35); wLow *= TU("aimBehindLowKV143", .7); }
      wLow = Math.max(0, wLow); wMid = Math.max(0, wMid); wHigh = Math.max(0, wHigh);
      const tot = wLow + wMid + wHigh; if (!(tot > 0)) return "mid";
      let r = Math.random() * tot;
      return (r -= wLow) < 0 ? "low" : (r -= wMid) < 0 ? "mid" : "high";
    };
    const hitGeoV109 = (d, c, dMom, cMom) => {
      let nx = c.lx - d.lx, ny = c.y - d.y; const nl = Math.hypot(nx, ny);
      if (nl < 0.25) { nx = c._dx || (c.side === "off" ? 1 : -1); ny = c._dy || 0; } else { nx /= nl; ny /= nl; }
      return { cid: ++commitSeqV109, ix: Math.round((c.lx + d.lx) * 5) / 10, iy: Math.round((c.y + d.y) * 5) / 10,
        nx: +nx.toFixed(3), ny: +ny.toFixed(3), impact: Math.round(Math.abs(cMom - dMom)), side: d.y >= c.y ? -1 : 1 };
    };
    /* v109 BALL SECURITY IS VISIBLE — a hard hit he stays up through can still jar the ball. This
     * is a bobble he SECURES: no possession change, no strip roll, the turnover rate cannot move.
     * `c.bc` (ball control) was read nowhere outside the grip strip; a low number now shows as a
     * man who juggles it on contact, a high one as a man who never looks like losing it. */
    const bobbleV109 = (c, hit) => {
      if (hit.impact < TU("bobbleImpact", 40)) return;
      const bcK = cl((TU("bobbleBcPivot", 75) - (c.bc || 50)) / TU("bobbleBcDiv", 25), TU("bobbleBcMin", .3), TU("bobbleBcMax", 1.8));
      /* v143: a hit aimed at the chest jars the ball; one aimed at the shoelaces does not */
      const aimBobK = !TU("v143", 1) ? 1 : hit && hit.aim === "high" ? TU("bobbleAimHighKV143", 1.35) : hit && hit.aim === "low" ? TU("bobbleAimLowKV143", .5) : 1;
      if (Math.random() < TU("bobbleP", .12) * bcK * aimBobK)
        emit("ballLoose", { who: c.id, x: c.lx, y: c.y, ms: TU("bobbleMs", 260), secured: true, cid: hit.cid, impact: hit.impact, side: hit.side });
    };
    /* v109 THE GANG CONVERGES — the instantaneous tackle collected `supIds` for credit and never
     * moved them, so a "gang tackle" could render as one man wrapping while two others stood five
     * yards off and coasted. Each supporter is now nudged a few px toward the carrier along HIS
     * OWN approach ray, slowed to a walk, and announced with a `wrapIn` the renderer closes on.
     * Credit and spot are untouched: `supIds`, `gang`, `youIn` and `c.lx` are not read here. */
    const wrapInV109 = (c, ids, cid) => {
      if (!TU("wrapInV109", 1)) return;
      for (const sid of ids) { const s = A_all[sid]; if (!s || s === c) continue;
        let ux = s._dx || 0, uy = s._dy || 0, tx = c.lx - s.lx, ty = c.y - s.y; const td = Math.hypot(tx, ty) || 1;
        if (td > TU("wrapInReachPx", 24)) continue;                                     // too far to be part of the heap
        if (ux * tx + uy * ty <= 0.05 * td) { ux = tx / td; uy = ty / td; }          // not closing on him: walk straight in
        const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
        const step = Math.min(TU("wrapInPx", 4), Math.max(0, td - TU("wrapInStopPx", 7)));
        s.lx += ux * step; s.y = clampY(s.y + uy * step); s.vel = Math.min(s.vel || 0, TU("wrapInVel", .2)); s._dx = ux; s._dy = uy;
        emit("wrapIn", { who: s.id, carrier: c.id, x: s.lx, y: s.y, bearing: +Math.atan2(uy, ux).toFixed(3), cid }); }
    };
    /* ===== v153 A THE PILE GOES DOWN TOGETHER =====
     * A gang tackle used to fold the tackler and the men the sim had walked in, and leave everybody
     * else who had arrived on the heap standing round it like spectators. When the stop is a gang stop
     * (booked as assisted, or two or more hands on the carrier) the men who are IN the heap go down
     * with him: every supporter / joiner within `gangDownPxV153A` of the carrier, plus any other
     * defender that close who is still closing (`gangDownVelV153A`), nearest first, at most
     * `gangDownMaxV153A`. The tackler is not listed (he already falls). Pure geometry: no roll, no
     * credit, no spot — the list rides the tackle event as `downV153A` for contactV146 (which lays
     * them onto the pile) and the renderer (which folds them). `TU("gangDownV153A", 0)` / `TU("v153A", 0)`. */
    const gangDownV153A = (c, tkId, ids, gang, hands) => {
      if (!TU("v153A", 1) || !TU("gangDownV153A", 1) || !(gang || hands >= 2)) return undefined;
      const reach = TU("gangDownPxV153A", 20), inHeap = new Set(ids || []), rows = [];
      for (const a of S.all) {
        if (a.side === c.side || a.id === tkId || a === c) continue;
        const d = Math.hypot(a.lx - c.lx, a.y - c.y);
        if (inHeap.has(a.id) ? d > reach * TU("gangDownSupKV153A", 1.4) : (d > reach || (a.vel || 0) < TU("gangDownVelV153A", .3))) continue;
        rows.push({ id: a.id, d });
      }
      rows.sort((p, q) => p.d - q.d);
      const out = rows.slice(0, Math.max(0, Math.round(TU("gangDownMaxV153A", 4)))).map(r => r.id);
      return out.length ? out : undefined;
    };
    /* ===== v112 THE HIT HAS WEIGHT =====
     * A violent collision ended with a man sliding to a stop on the turf: the sim booked the
     * knock-back, the renderer lifted him a fixed few pixels along a fixed hump for a fixed number
     * of milliseconds, and every big hit looked exactly like every other big hit. A man who is
     * genuinely run through, or genuinely stuck, does not get LIFTED — he leaves his feet. He goes
     * up, he travels back along the line of the hit, and he comes down under gravity.
     * This is the sim's half, and it is arithmetic only. It reads numbers `contact()` has already
     * computed — the momentum mismatch the hit carries (`impact`), the strength differential, the
     * knock-back it booked, the leverage, whether it came from behind, and both men's mass out of
     * `WT` — and answers ONE number: `vz`, the vertical speed he left the ground with. The hang is
     * 2·vz/g and the peak is vz²/2g, so height and duration are the same measurement seen twice
     * and can never fight each other; the GROUND he covers is not invented at all — it is the
     * knock-back the sim already booked (`tkb` on a truck, `kb` plus the whistle coast on a
     * tackle), which the renderer spreads over the hang instead of applying in one tick.
     * Nothing here moves a body, sets a spot, or draws a roll. Only the violent tail flies:
     * `launchGate` is set so a few percent of resolved contacts clear it, and a hit that does not
     * MOVE him (`launchMinKb`) never launches him. A man carried in a v103 grip never launches
     * either — he did not leave his feet, he was carried and then set down. */
    const launchV112 = (o) => {
      if (!TU("launchV112", 1)) return null;
      if (!(o.kb >= TU("launchMinKb", 5))) return null;                // a hit that does not move him cannot launch him
      if ((o.hands || 0) > TU("launchMaxHands", 1)) return null;        // nobody gets launched out of a crowd — a pile swallows him
      const flyW = WT[o.fly] || .7, hitW = WT[o.by] || .7;
      // mass: the lighter the man who is hit against the man who hit him, the further he goes
      const massK = cl(hitW / Math.max(.3, flyW), TU("launchMassMin", .6), TU("launchMassMax", 1.8));
      const pow = Math.round((Math.max(0, o.impact) * TU("launchImpactK", 1)
        + Math.max(0, o.strEdge) * TU("launchStrK", .9)
        + Math.max(0, o.kb) * TU("launchKbK", 2.4)
        + (o.stick ? TU("launchStickPow", 26) : 0)
        + Math.max(0, o.lev) * TU("launchLevK", 1.6)                   // the hitter got under his pads
        - (o.behind ? TU("launchBehindPow", 40) : 0)) * massK);        // from behind he is hauled down, not launched
      const gate = TU("launchGate", 168);
      if (!(pow > gate)) return null;
      // the published `flyPow` IS the number the speed is read off, so the arc is reproducible
      // from the event alone — the check re-derives every flyVz from it and must land on the nose
      const vz = cl(TU("launchVzBase", .1) + (pow - gate) * TU("launchVzK", .0011), TU("launchVzMin", .1), TU("launchVzMax", .17));
      return { vz: +vz.toFixed(4), pow };
    };
    try { (root.__V112_F_SIM = root.__V112_F_SIM || {}).launch = launchV112; } catch (e) {}   // v112: v112Fcheck sweeps the collision's inputs through the real function
    // returns: "cooldown" | "whiff" | "stiffarm" | "broken" | "stagger" (stays up) | "tackle" (play ends)
    const contact = (d, c) => {
      if (t < d.cool) return "cooldown";
      d.cool = t + 420 - (d.grit-50)*2;                          // grit: tacklers reload faster
      const behind = (d._dx||0)*(c._dx||0) + (d._dy||0)*(c._dy||0) > 0.55;
      const openField = c.lx > 30;
      const dW = WT[d.lb]||.7, cW = WT[c.lb]||.7;
      const dSpd = Math.max(0.12,(d.vel||0))*d.spd, cSpd = Math.max(0.12,(c.vel||0))*c.spd;
      const dMom = dW*dSpd, cMom = cW*cSpd;                       // mass × velocity
      const hit = hitGeoV109(d, c, dMom, cMom);                   // v109: the point, the normal, the weight, the id
      const dStr = d.str*0.55 + d.tkl*0.45, cStr = c.str*0.6 + (c.burst||c.spdA||50)*0.4;
      const elus = c.agi*0.55 + c.quick*0.45;                    // juke/elusiveness
      // v24 height leverage: gap = tackler − carrier height (in). A TALLER tackler
      // (lev>0) plays high and is easier to duck / hurdle / truck; a SHORTER tackler
      // (lev<0) gets under the pads and wins the wrap. Small per-inch swings, but the
      // per-play height jitter makes every rep a slightly different collision.
      const lev = cl((d.ht||73) - (c.ht||73), -8, 8);
      // v25 GROUP TACKLING: how many OTHER defenders already have hands on the carrier
      // (close and still live). One extra man and he goes down FAST; two and it's a wrap.
      // This is the fix for the 600-yard back — you can juke one man in space, not three.
      let handsOn = 0;
      for (const a of S.all) { if (a.side===d.side && a!==d && a.lb!=="OL"
        && t>(a.beaten||0) && !(a.trucked&&t<a.trucked+900) && !(a.stunned&&t<a.stunned)
        && Math.hypot(a.lx-c.lx,a.y-c.y) < TU("swarmRadius", 16)) handsOn++; }
      // fraction by which EVERY evasion (whiff/hurdle/stiff/truck) is choked by the swarm.
      // Tuned so ONE extra man ≈ −40% (you go down pretty quickly) and TWO ≈ −78% (three
      // men = mostly a wrap), without crushing the base run game to dust.
      const swarmChoke = handsOn <= 0 ? 0 : Math.min(0.9, 1 - Math.pow(0.6, handsOn));
      // v81: the defence arrives one man at a time now (they used to converge as a
      // pack), so nearly every contact became a one-on-one in space — and the
      // one-on-one odds were tuned for a swarm era. A true solo contact on a run is
      // trimmed by soloEvadeK; the stat gaps still decide who wins it.
      // v82: he has already made men miss this play — the third one gets him. Each
      // evasion after the first cuts the next one's odds; a back does not shake
      // the whole defence one at a time, and the swarm is arriving by then.
      const soloK = (handsOn <= 0 && kind === "run" ? TU("soloEvadeK", 1.0) : 1) * Math.pow(TU("evadeRepeatK", .6), Math.max(0, (c._evades||0) - 1));
      /* v143: the three decisions, all taken BEFORE the first roll — the line he is on, whether he
       * got his feet under him, and where he is aiming. `aim` is written onto `hit`, so it rides
       * every event this collision emits without threading it through nine emit() calls. */
      const onV143 = !!TU("v143", 1);
      const angQ = onV143 && d._angQV143 != null ? d._angQV143 : 0;   // frozen on the approach (the commit site)
      /* ===== v151 D THE HIT IS WON AT THE ANGLE =====
       * v143 graded the line he came in on and let it nudge the whiff, the wrap and the bounce — and
       * measured over 3,000 commits a man square on the intercept already stopped the carrier 77% of
       * the time against 56% for one chasing from a bad line. It should decide more than that. The
       * grade is amplified by `angleGainV151D` AROUND the measured mean (`angleMeanV151D` — the mix of
       * lines the sim actually produces), so the stop rate over a game does not move while the spread
       * between a good angle and a bad one widens; and it now reaches the two outcomes it never
       * touched: a man on a bad line is run THROUGH (`angleTruckKV151D`) and stiff-armed
       * (`angleStiffKV151D`) more, a square man is not. A whiff off a bad line is an OVERRUN — his
       * momentum carries him past for longer (`overrunKV151D`), which is what the picture shows.
       * Kill switch `TU("angleV151D", 0)`. */
      const angOnV151 = onV143 && !!TU("angleV151D", 1);
      const angMovV151 = angOnV151 && angQ !== 0;   // a man standing in the gap has no line to grade (v110) — he is left exactly as v143 had him
      const angX = angMovV151 ? angQ + (angQ - TU("angleMeanV151D", .15)) * (TU("angleGainV151D", 1.8) - 1) : angQ;
      const wu = onV143 ? windupV143(d, dSpd) : { need: 0, had: 0, set: true };
      /* the aim costs a roll, so with v143 off it is never taken and the random stream stays
       * bit-identical to the pre-v143 engine — which is the only way the two are comparable */
      const aim = onV143 ? aimPickV143(d, { lev, cSpd, dSpd, cStr, dStr, set: wu.set, openField, behind })
                         : (lev > 1.5 ? "high" : lev < -1.5 ? "low" : "mid");
      const afx = onV143 ? (AIM_FX_V143[aim] || AIM_FX_V143.mid) : AIM_OFF_V143;
      const setQ = onV143 ? ((wu.set ? 1 : 0) - TU("windupSetMeanV143", .41)) : 0;       // centred: the term is mean-zero over a game
      if (onV143) {
        hit.aim = aim; hit.angQ = +angQ.toFixed(3); hit.set = wu.set;
        hit.angDot = d._angDotV143 != null ? d._angDotV143 : null; hit.angSpd = d._angSpdV143 != null ? d._angSpdV143 : null;
        V143.aim[aim]++; wu.set ? V143.set++ : V143.rushed++;
        V143.angSum += angQ; V143.wuNeed += wu.need; V143.wuHad += Math.min(wu.had, 900);
        emit("tackleWindup",{who:d.id, carrier:c.id, x:d.lx, y:d.y, aim, set:wu.set, need:wu.need, had:Math.min(wu.had,900), angQ:hit.angQ});
      }
      emit("tackleLunge",{who:d.id, carrier:c.id, x:c.lx, y:c.y, behind, dMom:Math.round(dMom), cMom:Math.round(cMom), ...hit});   // v109: `cid` is echoed by the event that resolves this commit
      // v30 fatigue: collisions cost real gas on BOTH sides — a back who absorbs six
      // hits finishes the game on heavier legs than one who ran untouched.
      if (d.gas !== undefined) d.gas = Math.max(0, d.gas - TU("gasHitCostD", 4));
      if (c.gas !== undefined) c.gas = Math.max(0, c.gas - TU("gasHitCostC", 6));
      // 1) WHIFF — an elusive back makes him miss in space (never from behind).
      // Steeper gap term + a high (never-100%) ceiling so a huge mismatch shows:
      // even ≈26% open, star-vs-weak ≈70%, generational-vs-scrub ≈78%, floor ≈2%.
      const whiffP = cl(TU("whiffBaseV139", .12) + (elus - d.tkl)*0.008 + (openField?0.10:0) - (behind?0.26:0) - (dMom>cMom+40?0.05:0) + lev*0.006
        + afx.whiff * TU("aimFxV143", 1) - angX * TU("angleWhiffKV143", .07) - setQ * TU("windupWhiffKV143", .10), 0.02, 0.72) * (1 - swarmChoke) * soloK;
      /* v139: the rate is a dial now but its default is exactly what it always was. Raising it
       * lengthens plays, which grows v109C1check's sample, and that check asserts PERFECTION over
       * a stochastic sample (it fails 1-of-N on main too). The visible answer to "more whiffed
       * lunges" is the lunge itself — its height, and a diver who lands instead of snapping to the
       * turf — not a rate that quietly moves the run game. */
      if (!behind && Math.random() < whiffP) {
        d.beaten = t + 640; d.cool = t + 520; c.burstUntil = t + 460; kickSprint(c);
        // v29 OVERSHOOT: the juked man's momentum carries him PAST the cut point — he
        // keeps flying along his old line while beaten instead of freezing in place.
        d._osUntil = t + TU("overshootMs",420) * (angMovV151 ? 1 + Math.max(0, -angX) * TU("overrunKV151D", .6) : 1); d._osdx = d._dx||((c.lx-d.lx)>=0?1:-1); d._osdy = d._dy||0;
        if (angMovV151 && angX < -.3) d.beaten = Math.max(d.beaten, d._osUntil);   // v151 D: the overrun — he is past him until he can plant and turn
        c._evades = (c._evades||0) + 1; emit("tackleWhiff",{who:d.id, carrier:c.id, x:d.lx, y:d.y, ...hit});
        // v24: which move beat him is rating-driven — spin favors raw agility (whipping
        // the hips around), a jump-cut juke favors quickness. `elus` rides the event so
        // the renderer can make an elite back's move crisp and a scrub's sloppy.
        /* v139 THREE MOVES, NOT TWO. The spin was the agile man's answer and the juke was
         * everything else; a SIDE STEP is the quick man's, and it is what he reaches for in
         * traffic, where there is no room to turn his back on the play. The SPIN still takes the
         * one roll this line always took, in the same place; which of the two lateral moves he
         * uses instead is his own feet, not a second draw — so the sim's random stream is
         * untouched and this picks the PICTURE only. */
        const spinPref = cl(TU("spinPrefV139", .26) + (c.agi - c.quick)*0.006 + (c._staggered?-0.1:0), .10, .62);
        const spunV139 = Math.random() < spinPref;
        const stepsV139 = (c.quick - c.agi) + (handsOn > 0 ? TU("stepTrafficV139", 14) : 0) > TU("stepBiasV139", 2);
        const moveKind = spunV139 ? "spin" : stepsV139 ? "sidestep" : "juke", side=(d.y>=c.y?-1:1);
        c._jukeUntil=t+cl(TU("jukePlantMs",170)+(c.quick-40)*2.0,170,300);
        c._jukeY=clampY(c.y+side*cl(TU("jukeLanePx",14)+(c.agi-45)*.22,12,26));
        emit("cut",{kind:moveKind,x:c.lx,y:c.y,carrier:c.id,elus:Math.round(elus),direction:side,targetY:c._jukeY});
        // Nearby help can also bite on the first move. Their awareness/discipline
        // decides whether they false-step; the last layer still has the separate
        // safety-roof/last-man protection below.
        S.all.filter(a=>a!==d&&a.side===d.side&&a.lb!=="OL"&&Math.hypot(a.lx-c.lx,a.y-c.y)<58)
          .sort((p,q)=>Math.hypot(p.lx-c.lx,p.y-c.y)-Math.hypot(q.lx-c.lx,q.y-c.y)).slice(0,2).forEach((a,rank)=>{
            const iq=a.aware*.55+a.disc*.45,biteP=cl(.10+(elus-iq)*.007-rank*.04,.025,.48);
            if(Math.random()<biteP){const delay=Math.round(cl(190+(elus-iq)*2.6,140,390));
              a.beaten=Math.max(a.beaten||0,t+delay);a._osUntil=t+Math.min(delay,TU("overshootMs",420));a._osdx=a._dx||0;a._osdy=a._dy||0;
              emit("badAngle",{who:a.id,x:a.lx,y:a.y,reason:"juke-help",delay});}
          });
        if (committerId===d.id) committerId = null;
        return "whiff";
      }
      // 1.5) HURDLE — a springy carrier leaps clean OVER a low tackle attempt.
      // Driven by jumping + agility vs the tackler's wrap skill; open field helps,
      // never works from behind. The carrier sails over and keeps his momentum.
      const hurdleP = (behind ? 0 : cl(0.03 + ((c.jump*0.6 + c.agi*0.4) - d.tkl)*0.006 + (openField?0.07:0) + Math.max(0,-lev)*0.005
        + afx.hurdle * TU("aimFxV143", 1), 0.02, 0.38)) * (1 - swarmChoke) * soloK;
      if (Math.random() < hurdleP) {
        d.beaten = t + 560; d.cool = t + 480; c.burstUntil = t + 380; kickSprint(c);
        c.vel = Math.max(0,(c.vel||0)*0.98);
        // v109: `clearance` — how much spring he had over the wrap (the rating gap that rolled it)
        c._evades = (c._evades||0) + 1; emit("hurdle",{who:d.id, carrier:c.id, x:c.lx, y:c.y, ...hit,
          clearance: Math.round(cl((c.jump*0.6 + c.agi*0.4) - d.tkl + Math.max(0,-lev)*0.8, -40, 40))});
        if (committerId===d.id) committerId = null;
        return "hurdle";
      }
      // 2) STIFF-ARM — the carrier's strength wards the tackler off at the point of
      // attack. Works even at low speed (unlike a truck), not from behind. The
      // defender is shoved off and stumbles; the runner is slowed a touch, keeps going.
      const armEdge = (cStr - dStr) + (c.str - 50)*0.45;
      const stiffP = (behind ? 0 : cl(0.05 + Math.max(0, armEdge)*0.007 + Math.max(0,lev)*0.005
        + afx.stiff * TU("aimFxV143", 1) - (angMovV151 ? (angX - TU("angleMeanV151D", .15)) * TU("angleStiffKV151D", .03) : 0), 0, 0.5)) * (1 - swarmChoke) * soloK;
      if (Math.random() < stiffP) {
        d.beaten = t + 520; d.stagger = t; c.vel = Math.max(0,(c.vel||0)*0.95); c.burstUntil = t + 300; kickSprint(c);
        c._evades = (c._evades||0) + 1; emit("stiffarm",{who:d.id, carrier:c.id, x:c.lx, y:c.y, ...hit, armEdge: Math.round(armEdge)});   // v109: which arm, and how far he shoved him
        if (committerId===d.id) committerId = null;
        return "stiffarm";
      }
      // 3) TRUCK / BROKEN — the carrier runs THROUGH the tackler. Physics rule: a
      // ballcarrier who is BOTH faster AND stronger/harder-to-tackle than the man in
      // front of him wins the collision outright and flings the tackler the OTHER
      // way — back along the carrier's own line of motion. Momentum still matters,
      // and a raw power edge alone can still truck a smaller man without the speed
      // edge; but "faster and stronger" is the clean win.
      const cFaster = cSpd > dSpd, cStronger = cStr > dStr;
      const powerEdge = (cMom - dMom)*0.85 + (cStr - dStr)*0.5;
      const bothWin = cFaster && cStronger && !behind;
      let truckP = cl(0.16 + powerEdge*0.011 + (behind?-0.09:0) + Math.max(0,lev)*0.006
        + afx.truck * TU("aimFxV143", 1) - (angMovV151 ? (angX - TU("angleMeanV151D", .15)) * TU("angleTruckKV151D", .06) : 0), 0.02, 0.72);
      if (bothWin) truckP = cl(truckP + 0.22 + (cSpd - dSpd)*0.006, 0.05, 0.90);
      truckP *= (1 - swarmChoke) * soloK;                          // v25: you don't truck THROUGH a gang
      if (Math.random() < truckP) {
        d.beaten = t + 600; c.burstUntil = t + 500; kickSprint(c);
        if ((powerEdge > 20 || bothWin) && !behind) d.trucked = t;   // flattened — he stays down
        // v19 BUMP: the beaten tackler is flung back ALONG the carrier's motion — the
        // bigger the speed+power gap, the further the smaller man flies. The carrier
        // barely slows and keeps his feet, so his movement continues into the next hit.
        const tkb = cl(3 + powerEdge*0.12 + (bothWin?(cSpd - dSpd)*0.05:0), 2, 18);
        d.lx += (c._dx||0)*tkb; d.y = clampY(d.y + (c._dy||0)*tkb);
        c.vel = Math.max(0,(c.vel||0) * (bothWin ? 0.97 : 0.90));
        // v25 HIT STICK (offense): a violent truck flattens the defender — flagged so the
        // renderer flings him with the baked dive/down frames and pops "HIT STICK".
        const hitStick = (powerEdge > 24 || bothWin) && tkb > 9;
        // v112: a man run THROUGH by a back with this much on him leaves his feet — the flight is
        // the truck's own knock-back, seen as an arc instead of a slide
        const fly112 = launchV112({ fly: d.lb, by: c.lb, impact: hit.impact, strEdge: cStr - dStr, kb: tkb, stick: hitStick, lev, behind, hands: handsOn });
        // v109: every truck is emitted now so the commit it resolves is always answered; past the
        // fourth in one play it is `quiet` and the renderer keeps only the man going down
        c._evades = (c._evades||0) + 1; emit("brokenTackle",{who:d.id, carrier:c.id, x:d.lx, y:d.y, kb:Math.round(tkb), hitStick, quiet: brokenShown++ >= 4, ...hit,
          ...(fly112 ? { flyWho: d.id, flyVz: fly112.vz, flyPow: fly112.pow } : null)});
        bobbleV109(c, hit);
        if (committerId===d.id) committerId = null;
        return "broken";
      }
      // 4) STAGGER — the defender makes contact but can't wrap up (weak tackling, bad
      // angle, or a well-balanced runner). He grazes the carrier, costing him a step,
      // and stumbles himself — the arm-tackle that only slows the runner down. Bumps
      // matter: a staggered carrier bleeds speed and is easier to bring down next hit.
      const wrapQ = d.tkl*0.62 + (dMom>cMom?14:0) + (behind?22:0)
        + afx.wrapQ * TU("aimFxV143", 1) + angX * TU("angleWrapKV143", 9) + setQ * TU("windupWrapKV143", 10);
      const balance = c.str*0.4 + c.agi*0.35 + (c.burst||c.spdA||50)*0.25;
      // v82 3.5) BOUNCE — a glancing hit from the side: the carrier absorbs it and keeps
      // his feet while the tackler goes to the ground reaching. Balance against the wrap,
      // and the ANGLE of the hit, decide it. Distinct from a stagger, where both stay up.
      const glancing = !behind && Math.abs(d._dy||0) > TU("glancingDy", .7);
      const bounceP = cl(TU("bounceBase", .02) + (balance - wrapQ)*0.004 + (glancing ? TU("glancingBonus", .04) : 0) - (c._staggered&&t-c._staggered<500?0.05:0)
        + afx.bounce * TU("aimFxV143", 1) - angX * TU("angleBounceKV143", .03), 0.01, 0.3) * (1 - swarmChoke) * soloK;
      if (Math.random() < bounceP) {
        d.beaten = t + 520; d.cool = t + 480; d._osUntil = t + TU("overshootMs",420); d._osdx = d._dx||0; d._osdy = d._dy||0;
        c.vel = Math.max(0,(c.vel||0)*0.78*durKeepV141(c)); c._staggered = t;
        c._evades = (c._evades||0) + 1; emit("bounce",{who:d.id, carrier:c.id, x:c.lx, y:c.y, glancing, ...hit});
        bobbleV109(c, hit);
        if (committerId===d.id) committerId = null;
        return "bounce";
      }
      const staggerP = cl(0.11 + (balance - wrapQ)*0.006 - (behind?0.22:0) - (c._staggered&&t-c._staggered<500?0.20:0), 0.03, 0.46) * (1 - swarmChoke);
      if (Math.random() < staggerP) {
        d.stagger = t; d.cool = t + 300;
        c.vel = Math.max(0,(c.vel||0)*0.75*durKeepV141(c)); c._staggered = t;  // knocked off-stride, loses a step (v141: a durable body keeps more of it)
        emit("stagger",{who:d.id, carrier:c.id, x:c.lx, y:c.y, ...hit});
        bobbleV109(c, hit);
        return "stagger";
      }
      // 5) WRAP lands — the tackler GRABS the carrier. Who goes down, and which way,
      // is decided by the head-to-head of SPEED and STRENGTH/TACKLING (the physics
      // rule): a defender who wins both drives the carrier BACKWARD and levels him; an
      // even collision drops both where they meet; a carrier still carrying speed DRAGS
      // the pile forward for extra yards before going down. Nobody freezes on contact —
      // the drive forward / fly-back both play out through the post-whistle coast.
      // Assisted if a second defender is in on it (~30% gang overall).
      emit("tackleHit",{who:d.id, carrier:c.id, x:c.lx, y:c.y, ...hit});
      let nSupport = 0; const supIds = [];
      for (const a of S.all) { if (a.side===d.side && a!==d && a.lb!=="OL"
        && t>(a.beaten||0) && !(a.trucked&&t<a.trucked+900)
        && Math.hypot(a.lx-c.lx,a.y-c.y) < 18) { nSupport++; supIds.push(a.id); } }
      // v29 SOLO-FIRST: most stops are ONE man wrapping and finishing — support that is
      // merely in the frame no longer converts the stop to assisted. Gang odds start low
      // and only climb when extra defenders genuinely have hands on the carrier.
      const gang = nSupport>=1 && Math.random() < Math.min(0.9, (openField ? TU("gangOpen",0.10) : TU("gangBox",0.36)) + handsOn*TU("gangHandsK",0.24));
      // v29 PILE STRENGTH: when it IS a group push, raw strength dominates — the combined
      // grip of every wrapper against the carrier's power decides who moves whom.
      let supStr = 0; for (const sid of supIds) { const s=A_all[sid]; if (s) supStr += (s.str||50); }
      const pileEdge = gang ? cl(((d.str + supStr*0.6) - c.str*(1 + nSupport*0.55)) * TU("pileStrK",0.014), -0.9, 1.3) : 0;
      // signed collision edge: >0 the defender wins the point of contact. Support, a
      // rear angle, and the SWARM all swing it hard to the defense.
      const collEdge = (dSpd - cSpd)*0.018 + (dStr - cStr)*0.02 + (dMom - cMom)*0.006
        + (gang ? 0.35 : 0) + (behind ? 0.3 : 0) + (-lev)*0.02 + handsOn*0.12 + pileEdge;   // v24 leverage + v25 swarm + v29 pile strength
      // v25 tackle GEOMETRY by height: a HIGH tackle (taller man, hits the chest) rides
      // the carrier down and they FALL TOGETHER on the spot; a LOW tackle (shoestring)
      // trips him and both tumble APART, carried by their own momentum.
      /* v143: the style is the aim he CHOSE (the height gap is one of the things that chose it),
       * not a label read off `lev` after the fact. "even" is kept as the name mid answers to, so
       * every downstream reader — the grip, the coast, v86's tstyle — is untouched. */
      const style = aim === "mid" ? "even" : aim;
      const bigStick = !gang && collEdge > TU("bigStickEdge",1.6) && dMom > cMom + 44 && dSpd > d.spd*0.82
        && (!onV143 || afx.stick >= TU("stickAimMinV143", 1));    // v143: only a man who went in high delivers one
      // v30: both men hit the turf only when the collision is genuinely even — a high
      // wrap where the defender clearly won the point is a controlled ride-down, and a
      // dominant wrap (stayUp) leaves the tackler ON HIS FEET over the runner, the way
      // most real solo tackles finish.
      const bothFall = (!gang && !bigStick && Math.abs(collEdge) < 0.24 && dMom > 105 && cMom > 105) || (style === "high" && !bigStick && collEdge < TU("rideDownEdge",0.5));
      const stayUp = !gang && !bigStick && !bothFall && collEdge > TU("stayUpEdge",0.42) && !behind;
      // knockback: a defender-won collision drives the carrier BACK (kb>0, flung along
      // the defender's line). High tackles drop them where they meet; low/shoestring
      // tackles let the carrier's momentum stumble him a step forward as he trips.
      const kb = cl(collEdge*6, -6, 16);
      c.lx -= Math.max(0,kb) * (c.side==="off"?1:-1) * 0.5;
      if (kb > 2) { c._kb = kb; c._kbdx = d._dx!=null?d._dx:(c.side==="off"?-1:1); c._kbdy = d._dy||0; }
      let drive = cl(-collEdge*4 + Math.max(0,(c.grit-50))*0.05, 0, 12);
      // v29: a genuinely powerful carrier CHURNS a pile forward — leg drive through the
      // group push earns extra ground exactly when strength wins the pileEdge contest.
      if (gang && pileEdge < 0) drive = cl(drive + (-pileEdge)*TU("pileDriveK",7), 0, TU("pileDriveMax",11));   // v41: piles churn, but they don't carry into the paint
      if (style === "low") drive = cl(drive + cMom*0.03 + Math.max(0, cSpd - dSpd)*0.04, 0, 16);   // momentum stumble
      drive = cl(drive * afx.driveK, 0, 16);                       // v143: the aim owns how much of it survives (high was 0.35 before v143 and still is)
      if (drive > 0.5) { c._drive = drive; c._drivedx = c._dx!=null?c._dx:(c.side==="off"?1:0); c._drivedy = c._dy||0; }
      // YOU are "in on it" only when the stop is actually assisted AND you are one
      // of the supporting wrappers — standing near the pile is not participation
      const youIn = (gang && supIds.some(id=>{const s=A_all[id];return !!(s&&s.player&&s.player.you);}))||undefined;
      if (behind && d.player) flagCand.fm = d.player;    // v30: a wrap from dead behind can catch the mask
      /* ===== v103 THE GRAB — a wrap is not a whistle =====
       * The tackle used to be instantaneous: the wrap landed and the play was dead on that
       * pixel. The drive and the knockback then played out afterwards as pure decoration, on
       * a spot that had already been booked — which is why a back never fell forward for the
       * yard he had actually earned. That is not how a man is brought down. He is GRABBED,
       * and then the two of them TRAVEL: his legs still going, the tackler hanging on and
       * being dragged, until the momentum is gone and they land together. Where they land is
       * the spot. So the wrap opens a grip here and the carry loop runs it (THE GRIP TICK);
       * the tackle is emitted at the end of it, with the ground they really covered.
       * A violent stop (the hit stick) and a wrap into a waiting crowd still end it where they
       * land — nobody carries three men — so the instantaneous path below is still the common one. */
      const canGripV103 = TU("gripV103", 1) && !bigStick && !c._grip && !done
        && handsOn < TU("gripMaxHands", 3) && cSpd > TU("gripMinSpd", 34);
      if (canGripV103) {
        // how long he stays up: the collision he just lost, plus his own refusal to go down
        const gripMs = cl(TU("gripBaseMs", 130) - collEdge * TU("gripEdgeMs", 130)
          + Math.max(0, c.grit - 50) * TU("gripGritMs", 1.5) + Math.max(0, cMom - dMom) * TU("gripMomMs", .45),
          TU("gripMinMs", 90), TU("gripMaxMs", 340));
        c._grip = { by: d.id, t0: t, ms: gripMs, x0: c.lx, y0: c.y, style, aim, gang, kb, drive, collEdge,
          handsOn, sup: supIds.slice(), nSupport, pileEdge, dMom, cMom, behind, lev, stayUp, bothFall,
          bigStick, side: (d.y >= c.y ? -1 : 1), joined: [], strip: false, strain: false, hc: false,
          openField, gangRolled: false,
          // v109: the hit that opened it (echoed by every heartbeat and the landing), where the
          // gripper was relative to him when he latched (he settles onto the hip from there), and
          // each joiner's approach ray (`joinGeo`), so the pile keeps the shape it arrived in
          hit, lastSay: null, grabDx: d.lx - c.lx, grabDy: d.y - c.y, joinGeo: {} };
        d._gripOn = c.id;
        emit("grab", { who: d.id, carrier: c.id, x: c.lx, y: c.y, behind, style, gang,
          ms: Math.round(gripMs), handsOn, ...hit });
        return "grip";
      }
      wrapInV109(c, supIds, hit.cid);   // v109: the gang closes in before the whistle, not five yards from it
      // v112: and a carrier STUCK this hard leaves his feet — the flight rides the same kb the
      // whistle coast is about to carry him back along, so the spot is untouched
      const flyT112 = launchV112({ fly: c.lb, by: d.lb, impact: hit.impact, strEdge: dStr - cStr, kb, stick: bigStick, lev: -lev, behind, hands: handsOn + nSupport });
      (V143.res[aim] = V143.res[aim] || { n: 0, drive: 0, stick: 0 }).n++;
      V143.res[aim].drive += drive; if (bigStick) V143.res[aim].stick++;
      const downV153A = bigStick ? undefined : gangDownV153A(c, d.id, supIds, gang, handsOn + nSupport);   // v153 A: the heap goes down with him
      emit("tackle",{tackler:d.id, carrier:c.id, x:c.lx, y:c.y, gang, bigHit: bigStick||kb>11, bothFall, stayUp, kb:Math.round(kb), drive:Math.round(drive), sup:supIds, youIn, style, hitStick: bigStick, handsOn, ...hit,
        ...(flyT112 ? { flyWho: c.id, flyVz: flyT112.vz, flyPow: flyT112.pow } : null), ...(downV153A ? { downV153A } : null)});
      return "tackle";
    };

    const finishCarry = (why) => {
      const yards = Math.round(carrier.lx / YD);
      const nearest = S.def.concat(S.off).filter(a=>a.side!==carrier.side)
        .sort((p,q)=>Math.hypot(p.lx-carrier.lx,p.y-carrier.y)-Math.hypot(q.lx-carrier.lx,q.y-carrier.y))[0]||{};
      // v30: no phantom TACKLERS either — the nearest man only gets the stop if he was
      // genuinely on the play (inside tackleCreditPx). A carrier who simply stepped out
      // 20 yards from anyone produces a tackle event with no tackler and no stat.
      const nd = nearest.id ? Math.hypot(nearest.lx-carrier.lx, nearest.y-carrier.y) : 1e9;
      const credited = nd < TU("tackleCreditPx", 20) ? nearest.id : null;
      // no phantom assists at the whistle: an out-of-bounds finish credits nobody
      // as an assist, and otherwise YOU must be a genuine second man at the pile
      // (same 16px support radius as gang tackles), not just trailing the play
      const youIn = (why!=="oob" && credited && S.all.some(a=>a.player&&a.player.you&&a.side!==carrier.side
          &&a!==nearest&&Math.hypot(a.lx-carrier.lx,a.y-carrier.y)<16))||undefined;
      emit("tackle", { tackler: credited,
        carrier: carrier.id, x: carrier.lx, y: carrier.y, oob: why==="oob", youIn });
      done = true; return yards;
    };

    let out = null;
    const HARD = 6600;
    /* ===== v81 BALL AWARENESS — the defence has to FIND the ball =====
     * Every defender used to know who had the ball the instant the sim did: the
     * carry loop handed all eleven the carrier's exact position every tick, so
     * the whole defence converged like it had read the play sheet. A real defence
     * reads KEYS — the guards' first step, the mesh, the back's path — and each man
     * diagnoses the play on his own clock. Until he has, he plays his assignment:
     * linebackers hold their gap and shuffle, safeties stay over the top, corners
     * stay on their receiver. A fake (play action, a draw) moves the moment the
     * play declares itself later, and a defender who BITES steps the wrong way
     * first and has to recover.
     *
     * Awareness is the recognition skill (how fast he finds the ball), quickness
     * is the redirect, discipline is what keeps him from biting on the fake — the
     * same three the route-break reaction uses, so a point spent on any of them
     * pays out here too. */
    const runConcept = kind === "run" ? ((opts && opts.concept) || "inside") : null;
    const isDraw = runConcept === "draw";
    const playAction = kind === "pass" && !!(opts && opts.pa);
    // when the play DECLARES itself to a man reading his keys:
    //  - a straight run: the line's fire-out step, well before the mesh
    //  - a draw: the QB drops and the line pass-sets — only the late handoff tells
    //  - play action: the fake says run; the QB pulling the ball back says pass
    const HANDOFF_T = isDraw ? TU("drawHandoffMs", 760) : 420;
    const declareT = kind === "run" ? (isDraw ? HANDOFF_T : TU("runDeclareMs", 300))
      : (playAction ? TU("paRevealMs", 720) : 180);
    const readDelayV81 = a => {
      const posK = { LB: 1, S: TU("readPosS", 1.3), CB: TU("readPosCB", 1.4), DL: .8 }[a.lb] || 1;
      const iq = a.aware * .62 + a.quick * .22 + a.disc * .16;
      const base = TU("readBaseMs", 480) - (iq - 50) * TU("readIqK", 5.0);
      const fakeK = (isDraw || playAction) ? TU("readFakeK", 1.3) : 1;
      return Math.round(cl(base, 110, 900) * posK * fakeK * (.85 + Math.random() * .3));
    };
    S.def.forEach(a => {
      a._readMs = readDelayV81(a); a._seenAt = null; a._bite = false;
      // the fake: does he step the wrong way first? Discipline holds the key,
      // awareness sees through it. A bitten man finds the ball LATER, not never.
      if ((isDraw || playAction) && (a.lb === "LB" || a.lb === "S")) {
        const biteP = cl(TU("fakeBiteBase", .5) - (a.aware - 50) * TU("fakeBiteAwareK", .007) - (a.disc - 50) * TU("fakeBiteDiscK", .006), .06, .88);
        if (Math.random() < biteP) { a._bite = true; a._readMs += TU("biteExtraMs", 240); }
      }
    });
    /* ===== v110 THE MAN WHO IS THERE — the ball at your feet is not a diagnosis =====
     * v81 gives every defender a read clock and, until it lands, he plays his ASSIGNMENT: the
     * linebacker takes his read step at lbReadLx, the safety stays over the top, the corner stays
     * on his man. The clock had no proximity term, so a carrier could run within a yard of a
     * linebacker who was still reading and go straight past him — the single thing that reads on
     * screen as a defender who is in position and does nothing. Nobody stands a yard off the
     * football and fails to notice it: inside `seeBallPx` the read lands NOW. */
    const seesBall = a => {
      if (a._seenAt != null && t >= a._seenAt) return true;
      if (!TU("seeBallV110", 1) || !carrier || !a || a.side === carrier.side) return false;
      if (Math.hypot(a.lx - carrier.lx, a.y - carrier.y) >= TU("seeBallPx", 20)) return false;
      a._seenAt = t;
      if (!a._sawNearV110) { a._sawNearV110 = 1;
        try { (root.__V110 = root.__V110 || { laps: 0, takeovers: 0, ballMen: 0, holds: 0 }).nearReads = ((root.__V110.nearReads) || 0) + 1; } catch (e) {}
        emit("keyRead", { who: a.id, x: a.lx, y: a.y, ms: 0, bite: !!a._bite, near: true }); }
      return true;
    };
    // announce the lookers to the renderer once the ball is live (at the snap),
    // and mark each man's diagnosis the tick it lands
    const keyTick = () => {
      // once the ball is past the line it is in plain sight: everyone still reading
      // finds it now and goes looking for a job
      const ballOut = !isKick && carrier && carrier.side === "off" && carrier !== S.off[8] && carrier.lx > TU("ballVisibleLx", 8);
      S.def.forEach(a => {
        if (a._seenAt == null && t >= 140) { a._seenAt = declareT + a._readMs; emit("keyLook", { who: a.id, until: a._seenAt, bite: a._bite }); }
        if (ballOut && a._seenAt != null && a._seenAt > t) a._seenAt = t;
        if (a._seenAt != null && !a._keyAnn && t >= a._seenAt) { a._keyAnn = true; emit("keyRead", { who: a.id, x: a.lx, y: a.y, ms: a._seenAt, bite: a._bite }); }
        if (a._bite && !a._biteAnn && t >= declareT - 200) { a._biteAnn = true; emit("keyBite", { who: a.id, x: a.lx, y: a.y, kind: isDraw ? "draw" : "pa" }); }
      });
    };
    /* ===== v81 THE POINT OF ATTACK — every block is a roll of the dice =====
     * The run game had no point of attack: an engaged pair stood on its spot for
     * the whole play and the back picked a lane by which lineman had a body on
     * him. Now a run has a DESIGNATED HOLE (the concept picks the gap), each
     * lineman rolls his block against the man on him — a stalemate, a push, a
     * drive that moves the pair a couple of yards, the rare PANCAKE that puts the
     * defender on the ground, or a LOST block that frees the rusher — and the
     * winning blocks wash their men AWAY from the hole so a gap visibly opens.
     * The back attacks the hole first and reads from there. */
    const GAP_Y = { A: [206, 238], B: [174, 270], C: [142, 302], D: [124, 320] };
    const holeSide = S.off[9].y >= MIDY ? 1 : 0;                               // the back's side
    // power is the short-yardage / goal-line call: a tight inside gap behind a lead
    // block, not the off-tackle bounce (which the play-caller never asks for there)
    // v101: a called run names its own point of attack — Counter hits C, Iso hits A, Jet gets
    // outside the tackle — instead of every run in a family rolling the same two gaps
    const holeGapKey = (opts && GAP_Y[opts.gap]) ? opts.gap
      : runConcept === "sweep" ? (Math.random() < .7 ? "D" : "C") : runConcept === "power" ? (Math.random() < .6 ? "B" : "A")
      : runConcept === "draw" ? "A" : (Math.random() < .55 ? "A" : "B");
    const holeY = kind === "run" ? GAP_Y[holeGapKey][Math.random() < .8 ? holeSide : 1 - holeSide] : MIDY;
    const rollBlockV81 = (o, r) => {
      const edge = (o.blk * .6 + o.str * .4) - (r.str * .55 + r.quick * .25 + r.tkl * .2) + (Math.random() * 24 - 12);
      let bk = "stalemate";
      if (edge > TU("pancakeEdge", 14) && Math.random() < TU("pancakeP", .07)) bk = "pancake";
      else if (edge > TU("driveEdge", 8)) bk = Math.random() < .6 ? "drive" : "push";
      else if (edge > TU("pushEdge", -2)) bk = Math.random() < .45 ? "push" : "stalemate";
      else if (edge < TU("lostEdge", -12)) bk = "lost";
      // wash the man AWAY from the hole; a lineman on the hole's own y gets a coin flip
      const dir0 = o.y < holeY - 4 ? -1 : o.y > holeY + 4 ? 1 : (Math.random() < .5 ? -1 : 1);
      // v82 LEVERAGE: the wash only goes the right way if he gets his head across. A
      // reach block that is not reached seals nothing — the defender ends up washed
      // INTO the hole, which is how a "won" block still blows up a run.
      const reachP = cl(TU("reachBase", .64) + (o.agi - r.quick) * TU("reachK", .006) + (o.aware - 50) * .003, .15, .95);
      const reached = bk === "stalemate" || bk === "lost" || bk === "pancake" || Math.random() < reachP;
      return { kind: bk, dir: reached ? dir0 : -dir0, lev: reached ? "reach" : "lost", t0: t, x0: o.lx, y0: o.y };
    };
    let holeShown = false;
    // phase state
    let phase = "snap", throwAt = 0, sep = -0.5, hurried = false, target = null, coverA = null, routeDepth = 0;
    let throwStyle = "touch", throwWindow = "yellow", arrivalEdgeMs = 0, locationQuality = 1;
    let throwConeYd = 1.1, throwProt = 1, throwLeadPx = 0;   // v101: the live accuracy cone, the pocket, the lead
    /* ===== v101 THE LEAD — a throw is a guess about the future =====
     * The ball used to be aimed at the LAST WAYPOINT of the route: a fixed dot on the grass,
     * already decided before the receiver got anywhere near it. Nobody throws that way. A
     * quarterback watches a man running and throws to where that man is GOING TO BE when the
     * ball arrives — and the two halves of that are separate skills, so they are separate
     * numbers here:
     *   the GUESS — `leadPointV101` walks the receiver forward along his own route for as long
     *     as the ball will be in the air, then re-times the flight to that new, further spot
     *     and walks him again. Two passes and it converges on the interception point. A lob
     *     hangs longer, so it needs a bigger lead than a bullet to the same window; that falls
     *     out of the solve rather than being a special case.
     *   the EXECUTION — `leadSkillV101` is how much of that lead the passer actually puts on
     *     the ball. An accurate, calm quarterback lays it out in front; a raw one, or one with
     *     a man in his face, throws to where the receiver WAS, which is what a ball behind a
     *     man on a crossing route actually is.
     * The miss around that point is the CONE, and the cone is the readable part: it opens with
     * pressure, panic, depth and a poor arm, and it closes — and goes green — when the pocket
     * is clean and the receiver has won. Same number the broadcast draws over the field. */
    const STYLE_K_V101 = { bullet: .84, touch: 1, lob: 1.3 };
    /* ===== v109 THE BALL HAS A SPEED =====
     * The flight used to be a flat milliseconds-per-pixel ladder with a 390ms floor under it,
     * and the floor did most of the work: a 3-yard swing, a 5-yard slant and an 8-yard hitch
     * all hung for exactly 390ms, and a deep ball was just more of the same line. A thrown
     * football has a RELEASE and a VELOCITY. The release is the time the ball spends leaving
     * the hand and coming up to speed — the same on every throw, and the reason a short ball is
     * never instant. The velocity is the style (a rope, a touch ball, a rainbow) scaled by the
     * arm. Flight time is `release + distance / velocity`. Calibrated so the MEAN over the real
     * throw-distance mix is what the old ladder produced (so nothing downstream — coverage
     * arrival, the catch roll, the pick roll — sees a different clock on average), which means
     * the short ball hangs a shade longer than the old floor and the deep ball gets there a
     * shade sooner. The old ladder stays as `flightMsLegacyV109` so the audit can compare. */
    const flightMsLegacyV109 = (qb, px, py, style) =>
      cl(Math.hypot(px - qb.lx, py - qb.y) * (4.45 - (qb.thr - 50) * 0.006) * (STYLE_K_V101[style] || 1), 390, 1700);
    // the ball's speed in px per sim-ms: the style, scaled by the arm (same relative swing the
    // old ladder gave the arm — a 90 arm is ~6% quicker than a 50)
    const ballVelV109 = (thr, style) =>
      (style === "bullet" ? TU("ballVelBullet", .425) : style === "lob" ? TU("ballVelLob", .228) : TU("ballVelTouch", .327))
      * (1 + (((thr == null ? 50 : thr) - 50) * TU("ballVelArmK", .0014)));
    // fitted over 1,450 real throws (mean 131px, arm 80): a 200ms release and these speeds put
    // every style's mean flight exactly on the legacy ladder's — 59 / 45 / 32 mph in real time
    const flightDistMsV109 = (distPx, thr, style) =>
      cl(TU("throwReleaseMs", 200) + distPx / ballVelV109(thr, style), TU("flightMinMs", 390), TU("flightMaxMs", 1700));
    const flightMsV101 = (qb, px, py, style) => flightDistMsV109(Math.hypot(px - qb.lx, py - qb.y), qb.thr, style);
    // the apex of the flight follows its hang (apex ∝ dur², as a ball under gravity does; the
    // constant is a broadcast camera's exaggeration of the real parabola), with a style cap so
    // a bullet stays on a line however far it goes
    const apexPxV109 = (dur, style) => cl(TU("arcGravK", 1.0e-4) * dur * dur
        * (style === "bullet" ? TU("arcBulletK", .7) : style === "lob" ? TU("arcLobK", 1.15) : 1),
      TU("arcMinPx", 8), style === "bullet" ? TU("arcCapBullet", 40) : style === "lob" ? TU("arcCapLob", 120) : TU("arcCapTouch", 90));
    // the audit hook the check reads: the two formulas side by side, and every throw's row
    const V109A = (() => { const H = root.__V109_A = root.__V109_A || {}; H.flightMs = (d, thr, style) => flightDistMsV109(d, thr, style);
      H.flightMsLegacy = (d, thr, style) => flightMsLegacyV109({ lx: 0, y: 0, thr }, d, 0, style);
      H.rows = H.rows || []; H.throws = H.throws || 0; H.away = H.away || 0; H.oob = H.oob || 0; return H; })();
    // where he will be in `ms`, walking his own route — not a straight line off his current heading
    const walkRouteV101 = (a, ms) => {
      let left = Math.max(0, (a.spd || 140) * Math.max(.55, a.vel || .9) * ms / 1000);
      let x = a.lx, y = a.y;
      const R = a.route;
      if (R && R.length) {
        let i = Math.min(a._rwp == null ? 1 : a._rwp, R.length - 1);
        while (left > 0 && i < R.length) {
          const w = R[i], d = Math.hypot(w.lx - x, w.y - y);
          if (d < 1e-6) { i++; continue; }
          if (d >= left) { x += (w.lx - x) / d * left; y += (w.y - y) / d * left; left = 0; break; }
          x = w.lx; y = w.y; left -= d; i++;
        }
        if (left > 0) {   // the route is run out — he drifts on the way it last pointed him, but
          // only a stride or two. Letting the walk run to the full flight time here throws the
          // catch point clean past the called route: air yards climbed 40% and YPA became a
          // fantasy. A ball is thrown to a route's END, not to wherever a man could get to.
          const n = R.length, p0 = R[Math.max(0, n - 2)], p1 = R[n - 1];
          const dx = p1.lx - p0.lx, dy = p1.y - p0.y, dn = Math.hypot(dx, dy) || 1;
          // v129: a ball thrown in stride is thrown PAST the last waypoint on purpose — the man
          // is meant to run through it — so that route gets a longer tail than a ball thrown to a spot
          const drift = Math.min(left, (a._strideV129 ? TU("leadTailStrideYd", 3.4) : TU("leadTailYd", 1.2)) * YD);
          x += dx / dn * drift; y += dy / dn * drift;
        }
      } else if (a._dx != null) { x += a._dx * left; y += a._dy * left; }
      return { lx: x, y: clampY(y) };
    };
    const leadPointV101 = (qb, a, style) => {
      let p = { lx: a.lx, y: a.y }, ms = flightMsV101(qb, a.lx, a.y, style);
      for (let i = 0; i < 3; i++) { ms = flightMsV101(qb, p.lx, p.y, style); p = walkRouteV101(a, ms); }
      return { p, ms };
    };
    /* ===== v129 THE BALL IN STRIDE =====
     * leadSkillV101 is the fraction of the computed lead the passer actually gets on the ball, and
     * it sits around .46-.7 for almost everybody. That is the right average — most throws in
     * football are a step behind — but it meant the game had no BEST case: a ninety-awareness arm
     * throwing to a burner who had beaten his man still put the ball where the man WAS, and the
     * receiver came back for it. There was no ball in stride anywhere in the league.
     *
     * There is one now, and it is a decision the passer makes rather than a dice roll on top of
     * one. `strideOddsV129` is how often this quarterback, throwing to THIS receiver, commits to
     * the spot: the base rate is the LEVEL (a nine-year-old quarterback does not throw a man open
     * — Pee Wee is zero, high school a couple a game, college far more, the UFF most of the time
     * he is clean), and it is moved by the three things that decide it on a field: whether he can
     * read it before it happens (awareness), whether he can put it there (arm), whether the man
     * can run to it (speed), and whether that man has actually won (separation). A hurried,
     * moving or panicking passer never throws one — committing to a spot is the opposite of
     * getting rid of it.
     *
     * When it lands, three things change and nothing else does. The lead goes to FULL, so the ball
     * arrives where he is going rather than where he was. The cone TIGHTENS, because a throw you
     * have decided on before the break is a throw you are not steering. And the receiver runs
     * THROUGH it — his route walk is allowed a longer tail (`leadTailStrideYd`, since he is being
     * led past his last waypoint on purpose) and he does not break stride to track it. The catch,
     * the pick and the swat rolls are the same rolls; what improves is where the ball is, which is
     * exactly what "in stride" means. YAC is emergent, so it follows on its own.
     * `window.__V129` is the hook; `stridecheck.mjs` is the gate. */
    const STRIDE_LVL_V129 = [0, .015, .07, .13, .24, .42, .50, .72, .78];   // Pee Wee → Interstellar
    const lvlV129 = () => { try { return cl(Number(root.__getGridironState && root.__getGridironState().player.level) || 0, 0, 8); } catch (e) { return 4; } };
    const V129 = (() => { const H = root.__V129 = root.__V129 || {}; H.lvlTable = STRIDE_LVL_V129;
      H.throws = H.throws || 0; H.stride = H.stride || 0; H.rows = H.rows || []; return H; })();
    const strideOddsV129 = (qb, a, sep) => {
      const L = STRIDE_LVL_V129[lvlV129()] || 0;
      if (L <= 0) return 0;
      const eye  = cl(((qb.aware == null ? 50 : qb.aware) - 50) / 45, -1, 1.1),        // can he see it before it happens
            arm  = cl(((qb.thr   == null ? 50 : qb.thr)   - 50) / 45, -1, 1.1),        // can he put it there
            legs = cl(((a.spdA   == null ? 50 : a.spdA)   - 50) / 40, -1, 1.2),        // can the man run to it
            // has he actually won. Tight coverage is a real damper, not a veto: a passer who can
            // see it still throws one into a yard of space, he just does it far less often
            open = cl(TU("strideOpenMid", .55) + sep * TU("strideOpenK", .42), TU("strideOpenMin", .22), 1.35);
      var apex = 1; try { apex = 1 + (root.__treeLvlV134 ? root.__treeLvlV134("throwOpen") : 0) * TU("strideApexK", .2); } catch (e) { apex = 1; }   // v134 Apex: Throw Him Open
      return cl(L * (1 + eye * TU("strideEyeK", .62) + arm * TU("strideArmK", .38) + legs * TU("strideLegK", .34)) * open * apex,
        0, TU("strideMax", .92));
    };
    // how much of that lead he can actually put on it
    const leadSkillV101 = (qb, panic, moving) =>
      cl(TU("leadBase", .46) + (qb.thr - 40) * TU("leadThrK", .0062) + (qb.aware - 40) * TU("leadAwareK", .0040)
        - panic * TU("leadPanicK", .30) - (moving ? TU("leadMoveK", .09) : 0)
        + (Math.random() - .5) * TU("leadNoise", .16), TU("leadMin", .28), TU("leadMax", 1.08));
    // the pocket, as one number: 1 is a chair, 0 is a collapse
    const protV101 = (qb, hur) => cl(1
      - Math.min(.34, (qb._freeNV101 || 0) * TU("protFreeK", .14))
      - cl((TU("protRangePx", 100) - (qb._nearFreeV101 == null ? 999 : qb._nearFreeV101)) / TU("protRangePx", 100), 0, 1) * TU("protCloseK", .32)
      - (hur ? TU("protHurryK", .22) : 0) - (qb._slid ? TU("protSlideK", .07) : 0)
      - (qb._climbing ? TU("protClimbK", .06) : 0) - (qb._roll ? TU("protRollK", .05) : 0), 0, 1);
    // the cone, in yards of miss: wide when it is coming apart, tight when it is not
    const coneYdV101 = (qb, depth, prot, panic, moving, sepNow) => {
      const acc = qb.thr * .58 + qb.aware * .42;
      return cl(TU("coneBase", 1.0)
        + (62 - acc) * TU("coneSkillK", .026)
        + Math.max(0, depth) * TU("coneDepthK", .024)
        + (1 - prot) * TU("conePressK", 1.15)
        + panic * TU("conePanicK", .95)
        + (moving ? TU("coneMoveK", .55) : 0)
        - cl(sepNow, 0, 3) * TU("coneOpenK", .20), TU("coneMin", .3), TU("coneMax", 4.2));
    };
    // green is not "he is open" — it is "he is open AND you can put it there"
    const windowV101 = (sepNow, cone, prot) => {
      const grade = sepNow + (prot - TU("winProtMid", .55)) * TU("winProtK", 1.7)
        - (cone - TU("winConeMid", 1.3)) * TU("winConeK", .95);
      return grade > TU("winGreen", .40) ? "green" : grade > TU("winRed", -1.25) ? "yellow" : "red";
    };
    let handfightShown = false, highpointShown = false;
    const passConcept = opts && opts.concept;
    let coverHelp=null, bracketed=false, lbDrops=[];
    // Coverage does not receive the receiver's new direction for free. This
    // callback is upgraded after routes are built; the neutral form keeps run
    // and non-route movement untouched.
    let coverageAim=(d,w)=>({lx:w.lx,y:w.y});
    // v23 QB read progression: the cone shifts through the QB's reads during the
    // drop and LANDS on the man he actually throws to — he can only release to the
    // receiver he is focused on at that instant. Built in the pass setup below.
    let readProg = null, readStart = 320, curFocus = null;
    let _gradesV87 = null;   // v87: the graded reads, kept for the throw decision

    if (kind === "pass") {
      target = S.off.find(a=>a.player===picks.target) || S.off[0];
      /* ===== v87 WHO IS ON HIM — coverage by alignment, never by a coin flip =====
       * The engine used to hand the sim a "cover" pick that was the user's defender 45%
       * of the time whatever his position, and the sim put that man on the target. A
       * linebacker "covering" a go route, and a tackle on your sheet you never earned.
       * The man on the target is now the coverage defender aligned closest to him at
       * the snap; the engine's pick only says who the box score expects. */
      coverA = S.def.filter(a=>["CB","S","LB"].includes(a.lb))
          .sort((p,q)=>Math.hypot(p.lx-target.lx,p.y-target.y)-Math.hypot(q.lx-target.lx,q.y-target.y))[0];
      // route depth is throwing-range bounded, then shaped by the called concept:
      // shots go deep (fewer completions, more air), screens/quick stay short (YAC).
      const _cc = passConcept;
      const _lvl = cl(Number(root.__getGridironState?.()?.player?.level)||0, 0, 7);
      const _ageArm = [12,15,19,25,34,45,55,60][_lvl] + (S.off[8].thr-50)*0.08;
      let _rBase = 4 + (target.spdA-50)*0.1 + Math.random()*12, _rMin = 3, _rMax = Math.min(_ageArm, 16 + (S.off[8].thr-50)*0.12);
      if (_cc==="screen") { _rBase = -1 + Math.random()*4; _rMin = -2; _rMax = 5; }
      else if (_cc==="quick") { _rBase = 3 + Math.random()*5; _rMax = 11; }
      else if (_cc==="shot") { _rBase = 12 + Math.random()*8; _rMin = Math.min(10,_ageArm); _rMax = Math.min(_ageArm, 22 + (S.off[8].thr-50)*0.12); }
      else if (_cc==="fade") { _rBase = 6 + Math.random()*5; _rMin = 4; _rMax = 13; }
      routeDepth = cl(_rBase, _rMin, _rMax);   // throwing: arm range
      // Route endpoints are calibrated to the game's existing result scale. The
      // prior abstract resolver folded route depth and YAC together; explicit ball
      // locations otherwise overstate both and inflate passing by several YPA.
      const _depthK=_cc==="screen"?1:_cc==="quick"?.95:_cc==="shot"?.96:_cc==="fade"?.94:(root.__fullGameBalanceV39?.98:.86);
      routeDepth=Math.max(_cc==="screen"?-2:2,routeDepth*_depthK);
      throwAt = cl(620 + routeDepth*30 + Math.random()*180, 680, 1750);
      if (playAction) throwAt = Math.max(throwAt, declareT + TU("paThrowMin", 360));   // v81: the fake costs the QB a beat
      // ---- v16.5 real routes: every receiver runs an actual route (not a straight
      // line up the field), varied by concept so plays look distinct, and the ball
      // is thrown to the TARGET's break so it meets him there — a full playback.
      // ---- v55 ROUTE TREE: the full tree, not eleven shapes -----------------
      // The old builder had ten cases and a `default` that drew a straight line —
      // and `cross`, which the concept layer picks for medium AND short calls, was
      // never one of them, so every crosser in the game was silently run as a go.
      //
      // A route here is THREE choices, and the combinations are the tree:
      //   * one of 45 shapes below
      //   * a RELEASE off the line — inside jab, straight, or outside jab, which
      //     bends the stem before the break instead of everyone firing straight
      //   * a DEPTH TIER — short / standard / deep, which moves the break point,
      //     not just the length
      // 45 x 3 x 3 = 405 distinct shapes against the previous 10.
      //
      // Every shape also declares a TAIL: what the receiver does once the route is
      // finished. Without it they arrived at the last waypoint and stood dead
      // still — visible in the sim log as a frozen path for the last second of
      // every play — which is most of what "players don't follow routes" looked
      // like. Verticals keep climbing, curls settle back toward the ball, crossers
      // keep working across the field.
      const _sideOf = a => a.y < MIDY ? 1 : -1;
      const R_REL = ["in", "str", "out"], R_TIER = ["short", "std", "deep"];
      const R_TIERK = { short: .72, std: 1, deep: 1.34 };
      // toward the sideline is -s, toward the middle is +s
      const ROUTE_TREE = {
        // --- verticals
        go:        c => ({ w: [c.P(c.sx + c.D, c.sy)], tail: "go" }),
        fade:      c => ({ w: [c.P(c.sx + c.D * .5, c.sy - c.s * 10), c.P(c.sx + c.D, c.sy - c.s * 30)], tail: "go" }),
        seam:      c => ({ w: [c.P(c.sx + c.D * .5, c.sy + c.s * 12), c.P(c.sx + c.D, c.sy + c.s * 16)], tail: "go" }),
        bender:    c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D, c.sy + c.s * 26)], tail: "go" }),
        // --- posts and corners
        post:      c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D, c.sy + (MIDY - c.sy) * .7)], tail: "go" }),
        deep_post: c => ({ w: [c.P(c.sx + c.D * .68, c.sy), c.P(c.sx + c.D * 1.15, c.sy + (MIDY - c.sy) * .85)], tail: "go" }),
        skinny_post:c => ({ w: [c.P(c.sx + c.D * .6, c.sy), c.P(c.sx + c.D, c.sy + c.s * 30)], tail: "go" }),
        corner:    c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D, c.sy - c.s * 44)], tail: "go" }),
        deep_corner:c => ({ w: [c.P(c.sx + c.D * .7, c.sy), c.P(c.sx + c.D * 1.12, c.sy - c.s * 58)], tail: "go" }),
        // --- breaking in
        dig:       c => ({ w: [c.P(c.sx + c.D, c.sy), c.P(c.sx + c.D, c.sy + c.s * 46)], tail: "across" }),
        deep_dig:  c => ({ w: [c.P(c.sx + c.D * 1.2, c.sy), c.P(c.sx + c.D * 1.2, c.sy + c.s * 52)], tail: "across" }),
        slant:     c => ({ w: [c.P(c.sx + 3 * YD, c.sy), c.P(c.sx + c.D, c.sy + c.s * 44)], tail: "across" }),
        drag:      c => ({ w: [c.P(c.sx + 2 * YD, c.sy), c.P(c.sx + 4 * YD, c.sy + c.s * 60)], tail: "across" }),
        shallow:   c => ({ w: [c.P(c.sx + 1.5 * YD, c.sy), c.P(c.sx + 3 * YD, c.sy + c.s * 74)], tail: "across" }),
        cross:     c => ({ w: [c.P(c.sx + c.D * .5, c.sy), c.P(c.sx + c.D, c.sy + c.s * 88)], tail: "across" }),
        deep_cross:c => ({ w: [c.P(c.sx + c.D * .6, c.sy), c.P(c.sx + c.D * 1.1, c.sy + c.s * 104)], tail: "across" }),
        over:      c => ({ w: [c.P(c.sx + c.D * .45, c.sy), c.P(c.sx + c.D * .95, c.sy + c.s * 66), c.P(c.sx + c.D * 1.25, c.sy + c.s * 92)], tail: "across" }),
        dagger:    c => ({ w: [c.P(c.sx + c.D * .8, c.sy), c.P(c.sx + c.D * .85, c.sy + c.s * 50)], tail: "across" }),
        // --- breaking out
        out:       c => ({ w: [c.P(c.sx + c.D, c.sy), c.P(c.sx + c.D, c.sy - c.s * 40)], tail: "out" }),
        speed_out: c => ({ w: [c.P(c.sx + c.D * .6, c.sy), c.P(c.sx + c.D * .72, c.sy - c.s * 44)], tail: "out" }),
        sail:      c => ({ w: [c.P(c.sx + c.D * .7, c.sy), c.P(c.sx + c.D * 1.05, c.sy - c.s * 52)], tail: "out" }),
        flat:      c => ({ w: [c.P(c.sx + YD, c.sy - c.s * 40)], tail: "out" }),
        swing:     c => ({ w: [c.P(c.sx - YD, c.sy - c.s * 26), c.P(c.sx + 2 * YD, c.sy - c.s * 54)], tail: "out" }),
        // --- stopping / working back
        curl:      c => ({ w: [c.P(c.sx + c.D + 2 * YD, c.sy), c.P(c.sx + c.D, c.sy + c.s * 5)], tail: "settle" }),
        hitch:     c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D * .42, c.sy + c.s * 4)], tail: "settle" }),
        comeback:  c => ({ w: [c.P(c.sx + c.D * 1.1, c.sy), c.P(c.sx + c.D * .82, c.sy - c.s * 26)], tail: "settle" }),
        stick:     c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D * .58, c.sy - c.s * 18)], tail: "settle" }),
        spot:      c => ({ w: [c.P(c.sx + c.D * .5, c.sy), c.P(c.sx + c.D * .42, c.sy + c.s * 22)], tail: "settle" }),
        snag:      c => ({ w: [c.P(c.sx + 3 * YD, c.sy + c.s * 18), c.P(c.sx + c.D * .5, c.sy + c.s * 30)], tail: "settle" }),
        jerk:      c => ({ w: [c.P(c.sx + c.D * .4, c.sy + c.s * 20), c.P(c.sx + c.D * .5, c.sy - c.s * 22)], tail: "settle" }),
        choice:    c => ({ w: [c.P(c.sx + c.D * .6, c.sy), c.P(c.sx + c.D * .62, c.sy + c.s * (c.rand() < .5 ? 26 : -26))], tail: "settle" }),
        // --- whips and pivots (break one way, snap back the other)
        whip:      c => ({ w: [c.P(c.sx + c.D * .45, c.sy + c.s * 26), c.P(c.sx + c.D * .48, c.sy - c.s * 34)], tail: "out" }),
        pivot:     c => ({ w: [c.P(c.sx + c.D * .4, c.sy - c.s * 22), c.P(c.sx + c.D * .44, c.sy + c.s * 30)], tail: "across" }),
        angle:     c => ({ w: [c.P(c.sx + c.D * .35, c.sy - c.s * 30), c.P(c.sx + c.D * .7, c.sy + c.s * 34)], tail: "across" }),
        // --- double moves: sell one break, take another
        sluggo:    c => ({ w: [c.P(c.sx + 3 * YD, c.sy), c.P(c.sx + c.D * .42, c.sy + c.s * 26), c.P(c.sx + c.D * 1.1, c.sy + c.s * 14)], tail: "go" }),
        hitch_go:  c => ({ w: [c.P(c.sx + c.D * .4, c.sy), c.P(c.sx + c.D * .34, c.sy + c.s * 6), c.P(c.sx + c.D * 1.05, c.sy) ], tail: "go" }),
        out_up:    c => ({ w: [c.P(c.sx + c.D * .5, c.sy), c.P(c.sx + c.D * .55, c.sy - c.s * 30), c.P(c.sx + c.D * 1.15, c.sy - c.s * 38)], tail: "go" }),
        post_corner:c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D * .8, c.sy + c.s * 26), c.P(c.sx + c.D * 1.15, c.sy - c.s * 40)], tail: "go" }),
        corner_post:c => ({ w: [c.P(c.sx + c.D * .55, c.sy), c.P(c.sx + c.D * .8, c.sy - c.s * 30), c.P(c.sx + c.D * 1.15, c.sy + c.s * 44)], tail: "go" }),
        stutter_go:c => ({ w: [c.P(c.sx + c.D * .45, c.sy), c.P(c.sx + c.D * .52, c.sy + c.s * 8), c.P(c.sx + c.D * 1.12, c.sy - c.s * 8)], tail: "go" }),
        wheel:     c => ({ w: [c.P(c.sx, c.sy - c.s * 34), c.P(c.sx + c.D, c.sy - c.s * 34)], tail: "go" }),
        // --- behind the line
        screen:    c => ({ w: [c.P(c.sx - 2 * YD, c.sy - c.s * 12)], tail: "settle" }),
        bubble:    c => ({ w: [c.P(c.sx - YD, c.sy - c.s * 30), c.P(c.sx + YD, c.sy - c.s * 46)], tail: "out" }),
        tunnel:    c => ({ w: [c.P(c.sx - YD, c.sy + c.s * 20), c.P(c.sx + 2 * YD, c.sy + c.s * 8)], tail: "across" }),
        checkdown: c => ({ w: [c.P(c.sx + 2 * YD, c.sy), c.P(c.sx + 3 * YD, c.sy - c.s * 16)], tail: "settle" }),
      };
      const ROUTE_NAMES = Object.keys(ROUTE_TREE);
      // Routes the QB is allowed to look at by concept depth. `cross` is a real
      // shape now rather than a name that fell through to a straight line.
      const R_DEEP = ["go","fade","seam","post","deep_post","skinny_post","corner","deep_corner","bender","deep_cross","sluggo","post_corner","corner_post","out_up","stutter_go","wheel","dagger"];
      const R_MED = ["out","dig","curl","cross","comeback","sail","speed_out","over","stick","dagger","whip","hitch_go","deep_dig","spot"];
      const R_SHORT = ["slant","flat","curl","hitch","drag","shallow","snag","stick","spot","whip","pivot","angle","swing","checkdown","jerk","choice","bubble","tunnel"];
      // exposed so a check can prove every pool name is a real shape: `cross` used
      // to sit in two pools with no case in the builder, so it silently ran as a go
      try{window.__ROUTE_TREE_V55={names:ROUTE_NAMES,pools:{deep:R_DEEP,med:R_MED,short:R_SHORT},rel:R_REL,tier:R_TIER}}catch(_e){}
      const mkRoute = (a, name, depth, rel, tier) => {
        const sx = a.lx, sy = a.y, s = _sideOf(a), P = (x, y) => ({ lx: x, y: clampY(y) });
        tier = tier || "std"; rel = rel || "str";
        const D = Math.max(1, depth) * YD * R_TIERK[tier];
        const fn = ROUTE_TREE[name] || ROUTE_TREE.go;
        const built = fn({ sx, sy, D, s, P, YD, tier, rel, rand: Math.random });
        // the release bends the stem: an inside jab crosses the defender's face,
        // an outside jab widens him off the ball. It is a real waypoint, so it
        // changes the shape rather than merely decorating it.
        const stem = [];
        if (rel !== "str" && built.w.length && (built.w[0].lx - sx) > YD * 1.2) {
          stem.push(P(sx + YD * .9, sy + (rel === "in" ? s : -s) * 13));
        }
        const wps = [P(sx, sy)].concat(stem, built.w);
        wps.tail = built.tail; wps.rname = name; wps.rel = rel; wps.tier = tier;
        return wps;
      };
      coverageAim=(d,w)=>{
        const br=w&&w._routeBreak;
        const breakKey=br&&`${w.id}:${br.serial}`;
        if(br&&d._seenRouteBreak!==breakKey){
          d._seenRouteBreak=breakKey;
          // v56: RECOGNITION and REACTION are different skills and were blurred into
          // one blend. Reading the break right is awareness; redirecting once you
          // have read it is quickness. They are scored separately now.
          const iq=d.aware*.58+d.quick*.24+d.disc*.18;              // recognition — did he read it
          const rxq=d.quick*.55+d.aware*.30+d.disc*.15;             // reaction — how fast he can go
          const angleK=Math.max(.2,Math.min(1.35,br.angle/1.2));
          const badBite=Math.random()<cl((62-iq)*TU("routeBadBiteK",.008)*angleK,.02,.34);
          // The old hard clamp at 390 ate the bottom half of the stat range: on a
          // 90-degree break everything below iq~46 produced the SAME 390ms, so
          // awareness 10 and awareness 45 were the same defender. Ease into a higher
          // ceiling instead of chopping at a low one.
          const delay=routeReactDelayV56(rxq,angleK,badBite);
          d._routeReactUntil=t+delay; d._routeGhost=br; d._routeBadBite=badBite;
          emit("routeReaction",{who:d.id,on:w.id,x:d.lx,y:d.y,delay,badBite});
        }
        if(d._routeGhost&&t<(d._routeReactUntil||0)){
          const g=d._routeGhost, age=Math.max(0,t-g.t)/1000;
          const extra=(w.spd||130)*age*(d._routeBadBite?1.08:.92);
          return {lx:g.lx+g.inDx*extra,y:clampY(g.y+g.inDy*extra)};
        }
        return {lx:w.lx,y:w.y};
      };
      const _recv = S.off.filter(a=>["WR","TE"].includes(a.lb));
      const _pick = arr => arr[Math.floor(Math.random()*arr.length)];
      /* v101: a CALLED play names the routes it is built out of. `opts.routes` is a list of
       * shape names from the same tree — Mesh asks for drag/shallow/cross, Four Verticals for
       * go/seam, Smash for hitch/corner — so two plays sharing a concept family no longer draw
       * the same picture. Anything the playbook did not name still rolls from the concept's
       * pool exactly as before, and any name it does not recognise falls through mkRoute's own
       * default, so a typo degrades to a go route rather than to nothing. */
      const _called = (opts && Array.isArray(opts.routes) && opts.routes.length)
        ? opts.routes.filter(n => ROUTE_TREE[n]) : null;
      // one complementary receiver runs the called play's second route — the concept needs a
      // partner to BE a concept — and everyone else keeps rolling the whole tree, which is
      // what stops a playbook of forty-two calls from shrinking the route board to forty-two
      // pictures. The primary always runs what was called.
      const _mate = _called && _called.length > 1 ? _recv.filter(a=>a!==target)[Math.floor(Math.random()*Math.max(1,_recv.length-1))] : null;
      _recv.forEach((a, _ri)=>{
        const rn = a===target
          ? (_called ? _called[0]
            : _cc==="screen"?"screen": _cc==="shot"?_pick(R_DEEP): _cc==="quick"?_pick(R_SHORT): _cc==="fade"?_pick(["fade","corner","deep_corner"]):_pick(R_MED))
          : (a === _mate ? _called[1 + (_ri % (_called.length - 1))] : _pick(ROUTE_NAMES));
        // release and depth tier are rolled per receiver, so the same shape is not
        // the same picture twice — this is what multiplies 45 routes into 405
        const rel = _pick(R_REL), tier = _pick(R_TIER);
        const dep = a===target ? routeDepth : cl(routeDepth + (Math.random()*7-4), Math.min(3,_rMin*_depthK), _rMax*_depthK);
        a.route = mkRoute(a, rn, dep, rel, tier); a._rwp = 1; a._routeName = rn; a._routeRel = rel; a._routeTier = tier;
      });
      try{if(window.__ROUTE_DEBUG){const D=window.__ROUTE_DEBUG;if(D.routes&&D.routes.length&&D.log)D.log.push({routes:D.routes,path:D.path});D.path={};D.routes=_recv.map(a=>({id:a.id,
        name:a._routeName,rel:a._routeRel,tier:a._routeTier,tail:(a.route||[]).tail,
        wps:(a.route||[]).map(w=>[Math.round(w.lx),Math.round(w.y)])}))}}catch(_e){}
      if (_cc==="screen" || (_cc==="quick" && Math.random()<0.4)) { const rb=S.off[9]; if(rb){ const _rn=_cc==="screen"?_pick(["screen","bubble","tunnel"]):_pick(["flat","swing","checkdown"]); rb.route=mkRoute(rb,_rn,2,_pick(R_REL),"short"); rb._rwp=1; rb._routeName=_rn; } }
      // v33 QB FIELD SCAN: grade every eligible route against its nearest coverage
      // defender. Awareness controls how many reads the QB reaches and how much
      // noise contaminates the grade; young/raw QBs can still lock onto a bad read.
      // The called primary receives a small preference, not a guaranteed target.
      const _window = v => v > -0.25 ? "green" : v > -1.75 ? "yellow" : "red";
      const _elig = S.off.filter(a=>["WR","TE","RB"].includes(a.lb) && a.route);
      const _grade = a => {
        const e=a.route[a.route.length-1], nearest=S.def.filter(x=>["CB","S","LB"].includes(x.lb))
          .sort((p2,q2)=>Math.hypot(p2.lx-e.lx,p2.y-e.y)-Math.hypot(q2.lx-e.lx,q2.y-e.y))[0];
        const d=a===target?coverA:(nearest||coverA);
        const matchup=(a.spdA*.42+a.agi*.38+a.cat*.20)-(d.cov*.55+d.spdA*.25+d.aware*.20);
        const leverage=(Math.abs(e.y-MIDY)>145?0.25:0)+(a._routeName==="slant"||a._routeName==="out"?0.18:0);
        // Preserve the calibrated won/lost-release shape underneath the richer
        // three-color read: clean releases create green/yellow space; lost ones
        // remain red instead of every route collapsing toward an average window.
        const releaseWin=Math.random()<cl(.5+(a.agi-d.cov)*.006,.22,.78);
        const est=cl((releaseWin?-.25:-2.4)+matchup*.024+leverage+(Math.random()-.5)*.7,-3.4,1.8);
        const depth=Math.max(-2,e.lx/YD), situ=(opts?.toGo&&depth>=opts.toGo?0.35:0)+(a===target?0.3:0);
        return {a,d,sep:est,window:_window(est),score:est*10+a.cat*.055+situ};
      };
      const _grades=_elig.map(_grade), _awr=S.off[8].aware; _gradesV87=_grades;
      for(let i=_grades.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[_grades[i],_grades[j]]=[_grades[j],_grades[i]];}
      _grades.sort((a,b)=>(a.a===target?-1:b.a===target?1:0));
      const _readN=(_cc==="screen"||_cc==="quick")?1:cl(1+Math.floor((_awr-32)/15),1,Math.min(4,_grades.length));
      const _seen=_grades.slice(0,_readN), _noise=Math.max(1.2,(88-_awr)*.16);
      const _primary=_seen.find(r=>r.a===target)||_grades.find(r=>r.a===target)||_seen[0];
      const _best=_seen.slice().sort((a,b)=>(b.score+(Math.random()-.5)*_noise)-(a.score+(Math.random()-.5)*_noise))[0]||_primary;
      let _choice=_primary;
      const _moveOnP=cl(.08+(_awr-45)*.004,.05,.28);
      if(_best&&_primary&&_best.score>_primary.score+2.4&&Math.random()<_moveOnP)_choice=_best;
      const _badReadP=cl(.14-(_awr-35)*.0018,.025,.15);
      if(_seen.length>1&&Math.random()<_badReadP)_choice=_seen[Math.floor(Math.random()*_seen.length)];
      if(_choice){ target=_choice.a; coverA=_choice.d; sep=_choice.sep; throwWindow=_choice.window;
        const e=target.route[target.route.length-1]; target._throwLX=e.lx; target._throwY=e.y; routeDepth=Math.max(-2,e.lx/YD); }
      const relWin = sep > -1.05;
      const secondLevel=S.def.filter(a=>a!==coverA&&["S","LB"].includes(a.lb))
        .sort((p,q)=>(q.aware+q.cov)-(p.aware+p.cov));
      const threat=(target.spdA+target.agi+target.cat)/3, defenseIQ=(coverA.aware+coverA.cov)/2;
      const bracketP=cl(.10+(threat-defenseIQ)*.012+defenseIQ*.004,.08,.78);
      if(secondLevel.length&&Math.random()<bracketP){coverHelp=secondLevel[0];bracketed=true;emit("doubleCoverage",{target:target.id,helper:coverHelp.id});}
      lbDrops=S.def.filter(a=>a.lb==="LB"&&a!==blitzer).map(a=>({a,readAt:220+(100-a.aware)*5+Math.random()*260,ann:false}));
      readProg = _seen.filter(r=>r.a!==target).map(r=>({id:r.a.id,window:r.window,sep:r.sep}));
      readProg.push({id:target.id,window:null,sep:null});
      readStart = 300;
      emit("release",{win:relWin,bracketed});
      // v82: the plans, announced so the broadcast can show them
      if (stunt) emit("stunt", { a: stunt.looper.id, b: stunt.pen.id });
      if (spy) emit("spy", { who: spy.id, on: S.off[8].id });
      if (blitzer) emit("protection", { slide: protection.slide, read: protection.read, blitz: blitzer.id });
      if (chipper) emit("chip", { who: chipper.te.id, on: chipper.edge.id, x: chipper.te.lx, y: chipper.te.y });
      if (disguise) emit("disguise", { show: disguise.rot ? "two-high" : (Math.random() < .5 ? "two-high" : "one-high"), press: disguise.press, rotate: disguise.robber ? disguise.robber.id : null });
      // v82: a designed ROLLOUT — the QB moves the pocket to one side and throws on the run
      if (!playAction && (passConcept === "dropback" || passConcept === "shot") && Math.random() < TU("rolloutRate", .12)) {
        S.off[8]._roll = target.y >= MIDY ? 1 : -1; emit("rollout", { side: S.off[8]._roll, x: S.off[8].lx, y: S.off[8].y }); }
    }

    // v20: announce anyone who takes the field gassed (renderer pops it over the you-player)
    S.all.forEach(a => { if (a.gassedV20) emit("gassed", { who: a.id, x: a.lx, y: a.y }); });

    while (!done && t < HARD) {
      t += TICK;
      // v20 stamina IQ: LOW-awareness players torch their burst at random, useless
      // moments; the tactical kickSprint call-sites (breakaways, chases) stay the
      // only path for everyone else — that's what "using it well" means.
      if ((t / TICK) % 4 < 1) S.all.forEach(a => {
        if ((a.aware + (a._sprintIQV20 || 0)) < TU("gasIQDumb", 46) && Math.random() < TU("gasDumbSprintP", 0.02)) kickSprint(a);
      });
      if (!isKick) keyTick();   // v81: who has found the ball this tick
      if (phase === "snap") { if (t >= 140) {
        if (isKick) {
          phase = "kickset"; kickPhaseAt = t;
          if (kind === "kickoff") { carrier = null; ball = { lx: 0, y: MIDY, h: 0 }; emit("snap", { kickoff: true }); }
          else {
            // the long snap: the ball travels to the punter or the holder
            const to = kind === "fg" ? S.off[9] : S.off[8];
            emit("snap", {}); carrier = null;
            ballFlight = { t0: t, style: "bullet", dur: kind === "fg" ? 420 : 560, x0: 0, y0: MIDY, x1: to.lx + 4, y1: to.y, arc: 5,
              done: () => { carrier = to; emit("snapCatch", { by: to.id, x: to.lx, y: to.y }); } };
          }
        }
        else { carrier = S.off[8]; emit("snap",{}); phase = kind==="pass"?"drop":"handoff"; }
        // v83: who has hands on whom — the broadcast faces each blocker at his man
        emit("engage", { pairs: S.def.filter(r => r.engaging).map(r => [r.engaging.id, r.id]) }); } }
      else if (phase === "kickset" || phase === "kickfly") {
        const kicker = S.off[8], holder = S.off[9];
        const kickPoint = () => kind === "fg" ? { x: holder.lx + 2, y: holder.y } : kind === "punt" ? { x: kicker.lx + 10, y: kicker.y } : { x: 0, y: MIDY };
        const launchKick = () => {
          const kp = kickPoint(); let x1, y1, dur, arc;
          if (kind === "fg") {
            const posts = ((kickOpts.pos != null ? 100 - kickOpts.pos : (kickOpts.dist || 35) - 7) + 10) * YD;
            const good = !!kickOpts.good; const miss = (Math.random() < .5 ? -1 : 1) * (56 + Math.random() * 28);
            x1 = posts + 14; y1 = clampY(MIDY + (good ? (Math.random() * 28 - 14) : miss));
            dur = cl((x1 - kp.x) * 3.2, 900, 2400); arc = 70 + (x1 - kp.x) * .18;
            ballFlight = { t0: t, style: "kick", dur, x0: kp.x, y0: kp.y, x1, y1, arc, done: () => { emit("fgResult", { good, x: x1, y: y1 }); emit("land", { x: x1, y: y1 });
              out = { kind, yards: 0, blocked: false, good }; done = true; } };
            emit("throw", { x: kp.x, y: kp.y, tx: x1, ty: y1, style: "kick", fg: true });
          } else {
            const gross = kickOpts.gross || (kind === "punt" ? cl(28 + (kicker.str-50)*.3 + (kicker.thr-50)*.2 + (Math.random()*14-7), 18, 62)
              : cl(58 + (kicker.str-50)*.35 + (Math.random()*10-5), 45, 72));
            x1 = gross * YD; y1 = clampY(MIDY + (Math.random()*2-1) * (kind === "punt" ? TU("puntSpreadY", 110) : TU("kickoffSpreadY", 60)));
            // the sim clock runs about 2.5x real (a sprint is 25 yd/s here), so a 4.5s real hang is ~1.4s
            dur = kind === "punt" ? cl(TU("puntHangBase", 1250) + gross*9 + (Math.random()*220-110), 900, 1700) : cl(TU("kickoffHangBase", 900) + gross*8, 1200, 1900);
            arc = kind === "punt" ? TU("puntArc", 110) : TU("kickoffArc", 130);
            const ret = returner;
            ballFlight = { t0: t, style: "kick", dur, x0: kp.x, y0: kp.y, x1, y1, arc, done: () => {
              const catchable = Math.hypot(ret.lx - x1, ret.y - y1) < TU("returnCatchPx", 26);
              const near = S.off.filter(a => a !== kicker).map(a => Math.hypot(a.lx - ret.lx, a.y - ret.y)).sort((a2,b2)=>a2-b2)[0] || 999;
              if (kind === "punt" && (!catchable || (near < TU("fairCatchPx", 52) && Math.random() < TU("fairCatchP", .7)))) {
                emit(catchable ? "faircatch" : "land", { x: x1, y: y1 }); out = { kind, yards: 0, ret: 0, fair: true, spotLx: x1 }; done = true; return; }
              if (!catchable) { ret.lx = x1; ret.y = y1; }
              ret._catchLx = ret.lx; carrier = ret; phase = "carry";
              emit("puntCatch", { by: ret.id, x: ret.lx, y: ret.y, kickoff: kind === "kickoff" }); } };
            emit("throw", { x: kp.x, y: kp.y, tx: x1, ty: y1, style: "kick", to: ret.id, gross });
          }
          emit("kick", { fg: kind === "fg", x: kp.x, y: kp.y }); carrier = null; phase = "kickfly";
          S.off.forEach(a => { a._laneY = a.y; });
        };
        if (phase === "kickset") {
          if (kind === "kickoff") {
            mv(kicker, 2, MIDY, .8);
            if (t >= TU("kickoffMs", 600)) launchKick();
          } else {
            // protection holds while the rush comes; a free man at the kick point blocks it
            kRushers.forEach(r => { if (r.shed || !r.engaging || (r.stunned && t < r.stunned)) return;
              const pr = cl(((r.str*.55 + r.quick*.45) - r.engaging.blk) * .0004 + .003, .0006, .02) * TU("kickShedK", .25);
              if (Math.random() < pr) { r.shed = true; r.releaseT = t; r.engaging.engagedBy = null; emit("shed", { who: r.id }); } });
            const kp = kickPoint();
            kRushers.forEach(r => { if (t < (r.held||0)) return; if (r.shed || r._edgeRush) mv(r, kp.x, kp.y, 1.0); else if (r.engaging) mv(r, r.engaging.lx + 8, r.engaging.y, .4); });
            kBlockers.forEach(o => { if (o.engagedBy && !o.engagedBy.shed) mv(o, o.lx - 1, o.y, .3); });
            if (kind === "punt") { blockTick(S.def[0], [S.off[0]], 40); blockTick(S.def[1], [S.off[1]], 40); }   // jammers on the gunners
            if (kind === "fg") { mv(kicker, kicker.lx, kicker.y, 0); if (!S.off[0]._wingMiss) blockTick(S.off[0], [S.def[0]], 40); if (!S.off[1]._wingMiss) blockTick(S.off[1], [S.def[1]], 40); }   // the wings take the edge
            const kickAt = kind === "fg" ? TU("fgKickMs", 640) : TU("puntKickMs", 960);
            if (t >= kickAt && carrier) {
              const blocker = kRushers.find(r => (r.shed || r._edgeRush) && Math.hypot(r.lx - kp.x, r.y - kp.y) < TU("kickBlockPx", 12) && Math.random() < TU("kickBlockP", .04));
              if (blocker) { emit("kickBlocked", { who: blocker.id, x: kp.x, y: kp.y }); out = { kind, yards: 0, blocked: true }; done = true; }
              else launchKick();
            }
          }
        } else {
          // the ball is in the air: coverage runs its lanes and narrows on the returner,
          // the returner settles under it, the return team turns and forms in front
          const bx = ballFlight ? ballFlight.x1 : ball.lx, by = ballFlight ? ballFlight.y1 : ball.y;
          if (kind !== "fg") {
            mv(returner, bx - 2, by, .9); mv(S.def[3], bx - 50, by + (by < MIDY ? 30 : -30), .7);
            S.off.forEach(a => { if (a === kicker || (kind !== "kickoff" && a === holder && false)) return;
              const k = cl((a.lx - 40) / 160, 0, 1);
              mv(a, bx - 14, a._laneY * (1 - k) + returner.y * k, t < (a.held||0) ? .2 : .95); });
            S.def.forEach(a => { if (a === returner || a === S.def[3]) return;
              if (kind === "punt" && (a === S.def[0] || a === S.def[1])) { blockTick(a, [a === S.def[0] ? S.off[0] : S.off[1]], 60); return; }
              if (!blockTick(a, S.off.filter(o => o !== kicker && o.lx > a.lx - 30), 110)) mv(a, Math.max(20, bx - 90), a.y, .7); });
          } else {
            kRushers.forEach(r => mv(r, Math.max(r.lx, 10), r.y, .3));
          }
        }
      }
      else if (phase === "handoff") {
        if (isDraw && t < HANDOFF_T) {
          // v81 DRAW: the QB drops and the line pass-sets — to a man reading his
          // keys this IS a pass until the late mesh. Edge rushers bend upfield,
          // which is exactly what opens the middle for the back.
          const qb = S.off[8], rb = S.off[9];
          rushers.forEach(shedTick); rushers.forEach(swimTick);
          rushers.forEach(r=>{ if(!r.shed && r.engaging && !(r.stunned && t<r.stunned)){
            const wide = r.edge ? (r.y<MIDY?-1:1)*0.5 : 0;
            r.engaging.lx -= Math.max(0,(r.str-r.engaging.str))*0.000027*TICK; r.engaging.y += wide; }});
          mv(qb, -58, qb.y, 0.8); mv(rb, rb.lx - 2, rb.y, 0.25);
          rushers.filter(r=>r.shed).forEach(r=>mv(r, qb.lx, qb.y, 1.0));
          if (!S.off[8]._drawAnn) { S.off[8]._drawAnn = 1; emit("playfake",{x:qb.lx,y:qb.y,draw:true}); }
        }
        else if (t >= HANDOFF_T) { carrier = S.off[9]; emit("handoff",{}); phase = "carry";
          // v81: every block at the point of attack is rolled at the mesh
          blockers.forEach(o=>{ const r=o.engagedBy; if(!r||r.shed||(r.stunned&&t<r.stunned)) return;
            o._blk = rollBlockV81(o, r);
            if (o._blk.kind==="pancake") { r.stunned = t + TU("pancakeStunMs",1500) + Math.random()*800; r.shed=false; r.engaging=null;
              o._free=true; o.pancaked=t; o.engagedBy=null; emit("pancake",{who:r.id,by:o.id,x:r.lx,y:r.y,run:true}); }
            else if (o._blk.kind!=="stalemate") emit("blockWin",{who:o.id,on:r.id,kind:o._blk.kind,dir:o._blk.dir,lev:o._blk.lev,x:o.lx,y:o.y}); });
          // second-level blocking: uncovered linemen climb to linebackers — v81: to
          // the linebacker nearest the HOLE first, since that is the man the design
          // has to account for, not whichever one the roster listed first
          const covered = new Set(rushers.map(r=>r.engaging&&r.engaging.id));
          const lbs = S.def.filter(a=>a.lb==="LB").sort((p,q)=>Math.abs(p.y-holeY)-Math.abs(q.y-holeY));
          blockers.filter(o=>!covered.has(o.id)).forEach((o,i)=>{
            const lb = lbs[i]; if (lb) { o.climb = lb; lb.engagedBy = o; }
          });
          // v16.1: backfield penetration — a DL who wins his gap cleanly at the
          // snap blows the run up for a loss. Rate scales with the trench
          // mismatch, so a strong front vs a weak line produces real TFLs and
          // the negative/stuffed tail that a bell-curve run engine never had.
          const pen = rushers.filter(r=>!r.doubled&&r.engaging).sort((a2,b2)=>
            (b2.str+b2.quick-b2.engaging.blk)-(a2.str+a2.quick-a2.engaging.blk))[0];
          if (pen) { const pp = cl(0.05 + ((pen.str*0.55+pen.quick*0.45) - pen.engaging.blk)*0.006, 0.02, 0.34);
            if (Math.random() < pp) { pen.shed = true; pen.releaseT = t; pen.penetrator = true; emit("penetrate",{who:pen.id}); } }
        }
      }
      else if (phase === "drop") {
        const qb = S.off[8];
        // v82 THE CHIP: the tight end hits the edge on his way out — the rusher is
        // stood up for a beat and cannot work his move while the hands are on him
        if (chipper && t < chipper.until) {
          mv(chipper.te, chipper.edge.lx - 6, chipper.edge.y, .9);
          if (Math.hypot(chipper.te.lx - chipper.edge.lx, chipper.te.y - chipper.edge.y) < 14) {
            chipper.edge._chipUntil = t + 120; if (!chipper.landed) { chipper.landed = true; emit("block", { by: chipper.te.id, on: chipper.edge.id, x: chipper.te.lx, y: chipper.te.y, chip: true }); } }
        }
        rushers.forEach(r => { if (t < (r._chipUntil||0)) return; shedTick(r); });
        rushers.forEach(r => { if (t < (r._chipUntil||0)) return; swimTick(r); });
        blockers.forEach(pancakeTick);
        freeOLHelp(qb);
        // v82 THE TWIST: at the loop the two rushers trade gaps. The line has to see it
        // and pass the men off; if it does not, the looper comes through untouched.
        if (stunt && !stunt.resolved && t >= stunt.at && !stunt.looper.shed && !stunt.pen.shed && stunt.looper.engaging && stunt.pen.engaging) {
          stunt.resolved = true;
          const oL = stunt.looper.engaging, oP = stunt.pen.engaging;
          const passOffP = cl(TU("passOffBase", .58) + ((oL.aware + oP.aware) / 2 - 50) * TU("passOffAwareK", .009) + (oL.doubling || oP.doubling ? .1 : 0), .15, .95);
          stunt.looper._loopVia = { x: oP.lx - 10, y: oP.y }; stunt.looper._loopUntil = t + 360;
          if (Math.random() < passOffP) {
            // passed off: the looper is met by the interior man, the penetrator by the tackle
            stunt.looper.engaging = oP; oP.engagedBy = stunt.looper; stunt.pen.engaging = oL; oL.engagedBy = stunt.pen;
            emit("stuntPassOff", { a: stunt.looper.id, b: stunt.pen.id, x: oP.lx, y: oP.y, pairs: [[oP.id, stunt.looper.id], [oL.id, stunt.pen.id]] });
          } else {
            stunt.looper.shed = true; stunt.looper.releaseT = t; oL.engagedBy = null; stunt.pen.doubled = true;
            emit("stuntWin", { who: stunt.looper.id, x: stunt.looper.lx, y: stunt.looper.y });
          }
        }
        rushers.forEach(r=>{ if(!r.shed && r.engaging && !(r.stunned && t<r.stunned) && t >= (r._chipUntil||0)){
          // edge rushers bend the corner (push wide + up); interior bull-rush straight
          // v82: a penetrator on a twist crashes the OUTSIDE gap before the loop
          const wide = r.edge ? (r.y<MIDY?-1:1)*0.4 : (r._stunt === "pen" && stunt && !stunt.resolved ? (r.y<MIDY?-1:1)*0.6 : 0);
          r.engaging.lx -= Math.max(0,(r.str-r.engaging.str))*0.000027*TICK;
          r.engaging.y += wide; }});
        if (doubled && !doubled._ann) { doubled._ann=1; emit("doubleTeam",{on:doubled.id}); }
        if (blitzer && blitzer.blitzing && !blitzer._ann) { blitzer._ann=1; emit("blitz",{who:blitzer.id}); }
        if (blitzer && blitzer.blitzing && !blitzer.picked && !blitzer.freeRun) {
          mv(blitzer, qb.lx, qb.y, 1.0);
          const rb = S.off[9];
          // v82 THE PROTECTION CALL: a slide read right puts a lineman on the blitzer with
          // the back doubling; a slide read wrong sends the back the wrong way first
          const wrongWay = !protection.read && t < TU("wrongSlideMs", 480);
          if (wrongWay) mv(rb, qb.lx + 6, qb.y - (Math.sign(blitzer.y - qb.y) || 1) * 22, 0.85);
          else mv(rb, (blitzer.lx+qb.lx)/2, (blitzer.y+qb.y)/2, 0.95);   // back scans, steps up to meet it
          if (protection.read && protection.slide) {
            const slider = blockers.slice().sort((a2,b2)=>Math.abs(a2.y-blitzer.y)-Math.abs(b2.y-blitzer.y))[0];
            if (slider && Math.hypot(blitzer.lx-slider.lx, blitzer.y-slider.y) < 22 && Math.random() < TU("slidePickP", .8)) {
              blitzer.picked = true; blitzer.engaging = slider; if (slider.engagedBy && slider.engagedBy.engaging === slider) { rb.engagedBy = slider.engagedBy; slider.engagedBy.engaging = rb; }
              slider.engagedBy = blitzer; emit("pickup", { by: slider.id, on: blitzer.id, slide: true }); }
          }
          if (!blitzer.picked && Math.hypot(blitzer.lx-rb.lx, blitzer.y-rb.y) < 27) {
            if (Math.random() < 0.3 + rb.vis*0.006 + rb.blk*0.004 - (protection.read ? 0 : TU("wrongSlidePen", .2))) { blitzer.picked = true; blitzer.engaging = rb; rb.engagedBy = blitzer; emit("pickup",{by:rb.id, on: blitzer.id}); }
            else { blitzer.freeRun = true; emit("freeRusher",{who:blitzer.id, wrongCall: !protection.read}); }
          }
        }
        // v103: `engaging` is cleared when the man blocking him is pancaked or stunned while
        // `picked` stays true, so a blitzer whose blocker went down deref'd null here and killed
        // the whole play. He is picked up by nobody now — he comes free, which is what happened.
        if (blitzer && blitzer.picked && blitzer.engaging) mv(blitzer, blitzer.engaging.lx+7, blitzer.engaging.y, 0.2);
        else if (blitzer && blitzer.picked && !blitzer.engaging) blitzer.picked = false;
        // v82: the spy comes when the pocket moves — a rollout, a climb, or the QB
        // flushed by pressure — and is a free rusher from then on
        if (spy && !spy._attack && (qb._roll || qb._climbing || hurried) && t > 500) { spy._attack = true; emit("spyAttack", { who: spy.id, x: spy.lx, y: spy.y }); }
        const free = rushers.filter(r=>r.shed).concat(blitzer&&blitzer.freeRun?[blitzer]:[]).concat(spy && spy._attack ? [spy] : []);
        free.forEach(r=>{ if (r._loopVia && t < (r._loopUntil||0)) mv(r, r._loopVia.x, r._loopVia.y, .95); else mv(r, qb.lx, qb.y, 1.0); });
        let slideY = 0, climb = 0;
        if (free.length) {
          const th = free.slice().sort((a2,b2)=>Math.hypot(a2.lx-qb.lx,a2.y-qb.y)-Math.hypot(b2.lx-qb.lx,b2.y-qb.y))[0];
          slideY = th.y > qb.y ? -14 : 14;
          // v82 STEP UP: pressure off the EDGE is answered by climbing the pocket, not
          // sliding into the other edge — a real quarterback steps into the lane
          if (Math.abs(th.y - qb.y) > 26) { climb = TU("stepUpPx", 18); slideY *= .4; if (!qb._climbing) { qb._climbing = true; emit("stepUp", { x: qb.lx, y: qb.y }); } }
          if (!qb._slid) { qb._slid = true; emit("pocketSlide",{}); }
          // v23: a defender has broken the line and is closing on the QB — flag him
          // early (before the hit) so the broadcast can warn "scramble incoming".
          if (th && !th._presAlert && Math.hypot(th.lx-qb.lx, th.y-qb.y) < 72) { th._presAlert = true; emit("pressureAlert",{who:th.id}); }
        }
        // v81 PLAY ACTION: the QB turns and rides the fake to the back before he sets
        if (playAction && t < declareT) { if (!qb._paAnn && t >= 400) { qb._paAnn = 1; emit("playfake",{x:qb.lx,y:qb.y}); }
          mv(qb, -30, S.off[9].y + (qb.y - S.off[9].y) * .5, 0.75); }
        else if (qb._roll) mv(qb, TU("rolloutLx", -28), MIDY + qb._roll * TU("rolloutY", 66), 0.95);      // v82: the pocket moves
        else mv(qb, (playAction ? TU("paDropLx", -46) : -34) + climb, qb.y + slideY, playAction ? 0.95 : 0.8);
        const nearest = free.map(r=>Math.hypot(r.lx-qb.lx, r.y-qb.y)).sort((a,b)=>a-b)[0];
        if (nearest !== undefined && nearest < 26 && !hurried) { hurried = true; emit("qbHit",{x:qb.lx,y:qb.y}); }
        /* ===== v101 THE POCKET IS A NUMBER, AND SO IS PANIC =====
         * The throw used to know one thing about protection: the boolean `hurried`. A pocket
         * that is quietly closing and a pocket that is perfect were the same throw. Two live
         * readings now run the whole drop:
         *   protV101 — how CLEAN it is: free rushers, how close the nearest one is, whether
         *     the quarterback has had to slide, climb or run for it. 1 is a chair, 0 is a
         *     collapse. It is read at the moment of release, so a late blitz costs him.
         *   panicV101 — what that does to a MAN, which is not the same thing. It builds while
         *     someone is bearing down, it keeps building the longer he holds it, it jumps when
         *     he takes a hit, and it bleeds back off when the pocket cleans up. Composure
         *     (discipline, grit, awareness) sets both how fast it rises and how high it goes,
         *     so a veteran with a rusher in his face is calmer than a rookie with a clean one. */
        qb._nearFreeV101 = nearest === undefined ? 999 : nearest; qb._freeNV101 = free.length;
        { const compo = cl((qb.disc * .42 + qb.grit * .34 + qb.aware * .24 - TU("composurePivotV141", 30)) / 60, 0, 1);   // v141: the pivot is a dial (the keys under it are real now)
          const heat = (free.length ? cl(1 - qb._nearFreeV101 / TU("panicRangePx", 130), 0, 1) : 0)
            + (hurried ? TU("panicHitK", .45) : 0)
            + (t > throwAt + 200 ? TU("panicHoldK", .3) : 0);
          const rise = TU("panicRise", .0016) * (1.35 - compo * .7), fall = TU("panicFall", .0011) * (0.65 + compo * .9);
          const cap = cl(TU("panicCap", 1) - compo * TU("panicComposureK", .42), .18, 1);
          qb._panicV101 = cl((qb._panicV101 || 0) + (heat > 0 ? heat * rise * TICK : -fall * TICK), 0, cap); }
        // separation battle every tick. Bracket help compresses the throwing
        // window; low-awareness help arrives late and may not affect the play.
        const helpFactor=bracketed&&coverHelp&&t>260+(100-coverHelp.aware)*4 ? (coverHelp.cov*.34+coverHelp.aware*.18) : 0;
        sep += ((target.spdA*0.5 + target.agi*0.5) - (coverA.cov*0.85 + coverA.spdA*0.15 + helpFactor)) * 0.00085;
        // v82 DISGUISE pays out: the robber rotates down over the middle; a quarterback
        // who graded his reads off the two-high picture and does not see it (awareness)
        // has his window taken away. A press corner who wins the jam delays the route.
        if (disguise && disguise.robber && !disguise.rotated && t >= disguise.rotateAt) {
          disguise.rotated = true; emit("rotate", { who: disguise.robber.id, x: disguise.robber.lx, y: disguise.robber.y });
          const e = target.route && target.route[target.route.length - 1];
          const overMiddle = e && Math.abs(e.y - MIDY) < TU("robberY", 70) && e.lx > 15 && e.lx < 90;
          if (overMiddle) {
            const fooled = Math.random() < cl(TU("disguiseFoolBase", .55) - (qb.aware - 50) * TU("disguiseAwareK", .01), .1, .85);
            disguise.fooled = fooled;
            if (fooled) { sep -= TU("disguiseSep", 1.2); if (!bracketed) { bracketed = true; coverHelp = disguise.robber; } emit("fooled", { x: qb.lx, y: qb.y, by: disguise.robber.id }); }
          }
        }
        if (disguise && !disguise.jammed && t >= 200) { disguise.jammed = true;
          S.def.filter(cb => cb._press).forEach(cb => {
            const w = S.off.filter(x=>["WR","TE"].includes(x.lb)).sort((p,q)=>Math.hypot(p.lx-cb.lx,p.y-cb.y)-Math.hypot(q.lx-cb.lx,q.y-cb.y))[0];
            if (!w || Math.hypot(w.lx-cb.lx, w.y-cb.y) > 30) return;
            const jamP = cl(TU("jamBase", .4) + (cb.cov - w.agi) * TU("jamK", .008) + (cb.str - w.str) * .003, .12, .82);
            if (Math.random() < jamP) { w._jamUntil = t + TU("jamMs", 280); if (w === target) sep -= TU("jamSep", .6); emit("jam", { who: cb.id, on: w.id, x: w.lx, y: w.y }); }
            else { if (w === target) sep += TU("beatPressSep", .35); emit("release", { who: w.id, beatPress: true, x: w.lx, y: w.y }); }
          }); }
        // v81: the fake pays out the moment the QB pulls the ball back — a cover man who
        // bit is a step behind, and every linebacker who stepped up vacated his zone
        if (playAction && !qb._paSep && t >= declareT) { qb._paSep = 1;
          const bit = (coverA && coverA._bite) || (bracketed && coverHelp && coverHelp._bite);
          const vacated = S.def.filter(a=>a.lb==="LB"&&a._bite).length * TU("paVacateSep", .55);
          if (bit) sep += TU("paBiteSep", 2.2);
          sep += vacated; }
        // v23 QB VISION CONE: shift the cone THROUGH the read progression so the
        // broadcast shows him scanning receivers, then landing on the man he
        // throws to. The window before throwAt is split evenly across the reads;
        // the final entry is always the target, so the cone is on the thrown-to
        // receiver at release. Decoys read covered (red); the target's verdict is
        // the live separation truth (green when he actually wins).
        if ((t / TICK) % 6 < 1 && readProg && readProg.length) {
          const _span = Math.max(1, throwAt - readStart), _seg = _span / readProg.length;
          const _ri = Math.max(0, Math.min(readProg.length - 1, Math.floor((t - readStart) / _seg)));
          const _r = readProg[_ri];
          curFocus = _r.id;
          // v101: the cone the broadcast draws IS the accuracy cone the throw will use — read
          // live, so it visibly opens as the pocket goes and closes back down when it holds
          const _lp = protV101(qb, hurried), _lpan = qb._panicV101 || 0;
          const _lsep = _r.sep == null ? sep : _r.sep;
          const _lcone = coneYdV101(qb, routeDepth, _lp, _lpan, !!qb._roll || !!qb._slid, _lsep);
          const _liveWindow = windowV101(_lsep, _lcone, _lp);
          const _lookWindow = _r.window == null ? _liveWindow : _r.window;
          emit("look", { to: _r.id, window:_lookWindow, sep:_lsep, open:_lookWindow==="green",
            cone:+_lcone.toFixed(2), prot:+_lp.toFixed(2), panic:+_lpan.toFixed(2) });
          /* ===== v109 THE PUMP FAKE =====
           * Nothing in the sim ever pumped the ball. A quarterback looking at a covered read from a
           * clean pocket now sells it once a play: the ball goes up and comes back down, and the
           * nearest ZONE defender — never the man on the target, never the help — freezes on the
           * read he already had for a beat (the v56 steering hold, `_rxUntil`, so no new mechanism
           * and no new number on the target's separation). Rolled ONCE per play, the first time
           * the read is covered with the pocket holding; the broadcast plays the arm to the cock
           * and aborts before the release. */
          if (!qb._pumpRolledV109 && _lsep < 0 && _lp > TU("pumpProt", .6) && t < throwAt - TU("pumpBeforeThrowMs", 900)) {
            qb._pumpRolledV109 = true;
            try { const B = root.__V109_B = root.__V109_B || {}; B.pumpEligible = (B.pumpEligible || 0) + 1; } catch (e) {}
            if (Math.random() < TU("pumpRate", .18)) {
              const zone = S.def.filter(d => d !== coverA && d !== coverHelp && (d.lb === "S" || d.lb === "LB") && rushers.indexOf(d) < 0 && !d.blitzing && !d.engaging && !d._spy && d._wantDx != null)
                .sort((p, q) => Math.hypot(p.lx - _r.lx, p.y - _r.y) - Math.hypot(q.lx - _r.lx, q.y - _r.y))[0] || null;
              const freeze = TU("pumpFreezeMs", 120);
              if (zone && freeze > 0) { zone._rxUntil = Math.max(zone._rxUntil || 0, t + freeze); zone._rxCool = Math.max(zone._rxCool || 0, t + freeze + TU("reactRefractory", 320));
                zone._rxDx = zone._dx == null ? zone._wantDx : zone._dx; zone._rxDy = zone._dy == null ? zone._wantDy : zone._dy; zone._pumpedV109 = t; }
              emit("pump", { x: qb.lx, y: qb.y, to: _r.id, tx: _r.lx, ty: _r.y, frozen: zone ? zone.id : null, ms: freeze, sep: +_lsep.toFixed(2), prot: +_lp.toFixed(2) });
              try { const B = root.__V109_B; B.pumpN = (B.pumpN || 0) + 1; B.pumpFrozen = (B.pumpFrozen || 0) + (zone ? 1 : 0); } catch (e) {}
            }
          }
        }
        if (t >= throwAt - 400 && !target._broke) { target._broke = true;
          sep += (target.agi - coverA.cov) * 0.04;
          if (routeDepth > 13 && Math.random() < 0.5) {
            emit("doubleMove",{});
            if (Math.random() < 0.3 + Math.max(0,(50-coverA.disc))*0.012) { sep += 2.2; coverA.beaten = t + 380; }
          } }
        /* ===== v146 A THE SACK HE TAKES IS TAKEN BY SOMEBODY =====
         * v82 resolved the eaten sack on the tick the quarterback decided, with the free rusher
         * wherever he was — measured ~20px (3+ yards) off on average, so the broadcast folded a
         * quarterback nobody had touched. Now he braces on the spot he chose and the rusher
         * finishes his run; the tackle is emitted the tick they MEET (`sackContactPxV146`), and
         * only a rusher who somehow cannot close (`sackCloseMaxMsV146`) is ruled home where he is. */
        if (qb._eatV146) {
          const E = qb._eatV146;
          qb.lx = E.lx; qb.y = E.y; qb.vel = 0;                 // tucked, braced — he is not going anywhere
          const dOf = a => Math.hypot(a.lx - qb.lx, a.y - qb.y), reachS = TU("sackContactPxV146", 8);
          // the man he gave himself up to was picked up on the way: the nearest defender with nobody
          // on him takes over the run (and, if he is the one who gets there, the sack — named truly)
          if (E.th.engaging && t - E.t0 >= TU("sackCloseMaxMsV146", 1200)) {
            const open = S.def.filter(d => !d.engaging).sort((a2, b2) => dOf(a2) - dOf(b2))[0];
            if (open) E.th = open;
          }
          // v151 D: the close-out is his one job now — whatever else steered him this tick, at least half a stride is left for it
          if (TU("paceV151D", 1) && E.th._mvT151 === t) E.th._mvUsed151 = Math.min(E.th._mvUsed151 || 0, E.th.spd * TU("paceTickCapV151D", 1.35) * TICK / 1000 * .5);
          if ((free.indexOf(E.th) < 0 || TU("paceV151D", 1)) && !E.th.engaging) mv(E.th, qb.lx, qb.y, 1.0);   // a free man is already running at him (v151 D: and is steered AT him, not past him)
          // whoever actually GETS there is the man who sacks him
          const near = S.def.slice().sort((a2, b2) => dOf(a2) - dOf(b2))[0];
          const th = dOf(E.th) <= reachS ? E.th : (near && dOf(near) <= reachS ? near : E.th);
          const dq = dOf(th);
          if (dq <= reachS || t - E.t0 >= TU("sackCloseCapMsV146", 2600)) {
            try { const V = root.__V146 = root.__V146 || {}; V.sackClose = (V.sackClose || 0) + 1; V.sackCloseMs = (V.sackCloseMs || 0) + (t - E.t0); if (dq > reachS) V.sackCloseTimeout = (V.sackCloseTimeout || 0) + 1; } catch (e) {}
            emit("tackle", { tackler: th.id, carrier: qb.id, x: qb.lx, y: qb.y, sack: true, taken: true, closeMs: t - E.t0 });
            done = true; out = { kind: "pass", complete: false, intercepted: false, yards: Math.round(qb.lx / YD), sack: true, sacker: th.player || null };
            rec(); continue;
          }
          // still closing: the rest of the field plays on this tick (routes, coverage), the ball stays in his arms
        }
        if (!qb._eatV146 && (t >= throwAt || (hurried && t >= 680))) {
          const underPressure = hurried || !!opts?.pressured;
          const movingThrow = !!opts?.moving || (underPressure && !!qb._slid) || !!qb._roll;
          // v82 THE SACK HE TAKES: a smart quarterback with nothing open and a man on him
          // eats the ball instead of forcing it — the sacker is the free man who got there
          /* ===== v87 THE QB SEES THE LANE, AND NEVER THROWS BACKWARD =====
           * Nothing open and grass in front of him is a run, not a forced ball: the
           * quarterback tucks it when no unblocked defender sits in the lane ahead of
           * him (a spy makes him think twice). And a target behind the passer is not a
           * throw — a back still in protection is never the check-down; the QB finds a
           * man ahead of him or throws it away. */
          const laneAhead = (() => { const half = TU("scrLaneHalf", 30), deep = TU("scrLaneYd", 9) * YD;
            return !S.def.some(d => !d.engaging && d.lx > qb.lx - 8 && d.lx < qb.lx + deep && Math.abs(d.y - qb.y) < half); })();
          if (sep < TU("scrSep", -0.9) && laneAhead && !S.off[8]._scrambleDone && qb.lx < 2 * YD
              && TU("scrOppBase", .35) > 0   // v92: the dial at 0 means none — the floor below is for a live dial, not a switched-off one
              && Math.random() < cl(TU("scrOppBase", .35) + ((qb.spdA || 50) - 55) * .006 + ((qb.agi || 50) - 50) * .003 - (spy ? TU("scrSpyPen", .18) : 0), .05, .85)) {
            emit("scramble", { x: qb.lx, y: qb.y, lane: true, opportunity: true, sep: +sep.toFixed(2) });
            S.off[8]._scrambleDone = true; qb._scrambling = true; carrier = qb; phase = "carry"; out = null; sep = 0;
            rec(); continue;
          }
          if (sep < -1.6 && underPressure && S.off[8].aware >= TU("sackSmartAware", 60) && Math.random() < TU("takeSackP", .32)) {
            const th = free.slice().sort((a2,b2)=>Math.hypot(a2.lx-qb.lx,a2.y-qb.y)-Math.hypot(b2.lx-qb.lx,b2.y-qb.y))[0];
            if (th && TU("sackCloseV146", 1)) {
              /* v146 A: he gives himself up — but the sack is not in until the man GETS there. The
               * decision is taken here (same roll, same tick, same free man); the quarterback tucks
               * and braces on this spot, and the tackle is emitted by the close-out below on the
               * tick the rusher is actually on him. The spot is this spot, so the yards are too. */
              qb._eatV146 = { th, lx: qb.lx, y: qb.y, t0: t };
              emit("sackBrace", { who: qb.id, by: th.id, x: qb.lx, y: qb.y, d: Math.round(Math.hypot(th.lx - qb.lx, th.y - qb.y)) });
              rec(); continue;
            }
            if (th) {
              emit("tackle", { tackler: th.id, carrier: qb.id, x: qb.lx, y: qb.y, sack: true, taken: true });
              done = true; out = { kind: "pass", complete: false, intercepted: false, yards: Math.round(qb.lx / YD), sack: true, sacker: th.player || null };
              rec(); continue; }
          }
          /* ===== v109 A THROWAWAY IS THROWN =====
           * Both throwaway paths used to emit `throwaway` and `incomplete` on the SAME tick with
           * no flight at all: the ball teleported to one fixed spot at the top of the picture
           * whichever sideline the passer was near, and the arm never moved, because the v107
           * wind-up only reads `throw` events. Now it is a real ball — a bullet aimed past the
           * NEAR sideline, `throw{away:true}` first so the arm winds up on it, then the same
           * `incomplete` (now `oob:true, away:true`) from the flight's own `done()`. The play
           * ends when the ball lands, not when the decision is made; `out.yards` stays 0. The
           * flight is trimmed to land before HARD so the ending is always booked. */
          const throwAwayV109 = (ax, extra) => {
            const qb9 = S.off[8];
            const ay = qb9.y < MIDY ? SIDELINE_TOP - TU("throwawayOutPx", 20) : SIDELINE_BOT + TU("throwawayOutPx", 20);
            const room = HARD - t;                                   // the last rec() runs at t === HARD
            if (room < TICK) return false;                            // no ticks left to fly it: the old same-tick ending
            const dPx = Math.hypot(ax - qb9.lx, ay - qb9.y), vel = ballVelV109(qb9.thr, "bullet");
            const dur = Math.max(TICK, Math.min(flightDistMsV109(dPx, qb9.thr, "bullet"), room));
            const apex = apexPxV109(dur, "bullet");
            const wob = cl((qb9._panicV101 || 0) * TU("wobblePanicK", .9) + TU("wobbleHurryK", .15) + (1 - protV101(qb9, true)) * TU("wobbleProtK", .6), 0, 1);
            emit("throw", Object.assign({ x: qb9.lx, y: qb9.y, tx: ax, ty: ay, style: "bullet", away: true, oob: true,
              dur: Math.round(dur), vel: +vel.toFixed(3), velMph: Math.round(vel / YD * 1000 / TU("simClockReal", 2.5) * 3600 / 1760),
              apex: Math.round(apex), wobble: +wob.toFixed(2), platform: qb9._roll ? "roll" : qb9._slid ? "slide" : "hurried",
              prot: +protV101(qb9, true).toFixed(2), panic: +(qb9._panicV101 || 0).toFixed(2) }, extra || {}));
            V109A.throws++; V109A.away++;
            handfightShown = true; highpointShown = true;            // nobody is going up for this one
            ballFlight = { t0: t, style: "bullet", dur, x0: qb9.lx, y0: qb9.y, x1: ax, y1: ay, arc: apex, apexF: TU("arcApexFrac", .55), away: true,
              done: () => { emit("incomplete", Object.assign({ x: ax, y: ay, oob: true, away: true, reason: "away" }, extra || {}));   // v109 B: a thrown-away ball is an incompletion WITH a reason
                try { const B = root.__V109_B = root.__V109_B || {}; (B.incReasons = B.incReasons || {}).away = (B.incReasons.away || 0) + 1; } catch (e) {}
                V109A.oob++; done = true; } };
            return true;
          };
          if (sep < -1.6 && underPressure && Math.random() < 0.28 + (S.off[8].aware-50)*0.005) {
            emit("throwaway",{x:S.off[8].lx,y:S.off[8].y});
            out = { kind:"pass", complete:false, intercepted:false, yards:0 };
            if (throwAwayV109(routeDepth*YD)) { phase = "fly"; rec(); continue; }
            emit("incomplete",{x:routeDepth*YD, y: F_TOP+40});
            done = true;
            rec(); continue;
          } else if (sep < -2.2 && !hurried && Math.random() < 0.3) {
            // v87: the check-down is a receiver AHEAD of the quarterback, never a back still in protection behind him
            const rb9 = S.off[9], rbOut = rb9 && rb9.route && rb9.lx > qb.lx + TU("checkdownAheadYd", 1) * YD;
            if (rbOut) { emit("read",{to:"off9"}); target = rb9; coverA = S.def.find(a=>a.lb==="LB")||coverA; sep = 0.4; routeDepth = 3; }
            else { const alt = (_gradesV87||[]).filter(r=>r.a!==target && r.a.lx > qb.lx + YD).sort((p2,q2)=>q2.score-p2.score)[0];
              if (alt) { emit("read",{to:alt.a.id}); target = alt.a; coverA = alt.d || coverA; sep = Math.max(sep, alt.sep); } }
          }
          if (target.lx < qb.lx + TU("throwAheadYd", .5) * YD) {
            // v87: a target behind the passer is not a throw
            const alt = (_gradesV87||[]).filter(r=>r.a.lx > qb.lx + YD).sort((p2,q2)=>q2.score-p2.score)[0];
            if (alt) { emit("read",{to:alt.a.id}); target = alt.a; coverA = alt.d || coverA; sep = alt.sep; }
            else { emit("throwaway",{x:qb.lx,y:qb.y,behind:true});
              out = { kind:"pass", complete:false, intercepted:false, yards:0, behindFix:true };
              if (throwAwayV109(Math.max(2*YD, qb.lx+6*YD), { behind: true })) { phase = "fly"; rec(); continue; }   // v109: a real ball, past the near sideline
              emit("incomplete",{x:Math.max(2*YD, qb.lx+6*YD), y: F_TOP+40});
              done = true; rec(); continue; }
          }
          /* ===== v101: the release — pick the ball, pick the spot, then miss it by the cone ===== */
          const _panic = qb._panicV101 || 0;
          throwProt = protV101(qb, underPressure);
          // STYLE first, because it changes the flight time and therefore the lead. A defender
          // sitting UNDER the route has to be thrown over; one carrying it over the top has to
          // be thrown under, on a line. Depth and a closing pocket break the ties.
          const _under = coverA && coverA.lx < target.lx - TU("leverageYd", 1.6) * YD;   // he is beneath the route
          const _over  = coverA && coverA.lx > target.lx + TU("leverageYd", 1.6) * YD;   // he has the top
          throwStyle =
              (routeDepth > TU("lobDepthYd", 14) && sep > -1 && throwProt > TU("lobProt", .38)) ? "lob"
            : (_under && routeDepth > 7 && sep > -1.2 && !underPressure) ? "lob"
            : (passConcept === "shot" && sep > -1.5 && !underPressure) ? "lob"
            : (underPressure || _panic > TU("bulletPanic", .5)) ? "bullet"
            : (_over && sep < TU("bulletOverSep", .8)) ? "bullet"
            : (routeDepth < TU("bulletDepthYd", 9) && sep < TU("bulletOpenSep", .4)) ? "bullet"
            : "touch";
          /* v129: the decision comes BEFORE the guess, because a ball thrown in stride is walked
           * further down the route than one thrown to a spot. A passer who is hurried, moving or
           * panicking never throws one — committing to a spot is the opposite of getting rid of it. */
          const _strideOdds = strideOddsV129(qb, target, sep);
          const _stride = !!TU("strideV129", 1) && !underPressure && !movingThrow
            && _panic < TU("stridePanic", .45)
            && routeDepth >= TU("strideMinYd", 4)
            && Math.random() < _strideOdds;
          target._strideV129 = _stride;
          try { V129.throws++; if (_stride) V129.stride++;
            V129.rows.push({ lvl: lvlV129(), odds: +_strideOdds.toFixed(3), stride: _stride, sep: +sep.toFixed(2),
              aware: qb.aware, thr: qb.thr, spdA: target.spdA, depth: +routeDepth.toFixed(1) });
            if (V129.rows.length > 400) V129.rows.shift(); } catch (e) {}
          // the GUESS: walk him along his route for as long as this ball will hang
          const _lead = leadPointV101(qb, target, throwStyle);
          const _re = target.route && target.route.length ? target.route[target.route.length-1] : null;
          const _fallX = _re ? _re.lx : routeDepth*YD, _fallY = _re ? _re.y : clampY(target.y + (Math.random()<0.5?-1:1)*30);
          // the EXECUTION: how much of that lead he actually gets on it. Short of 1 and the ball
          // is behind him; the spot he is throwing AT is still a real point on the grass either way.
          const _lk = _stride ? cl(TU("strideLead", 1.0) + (Math.random() - .5) * TU("strideLeadNoise", .1), .9, 1.12)
            : leadSkillV101(qb, _panic, movingThrow);
          // and the aim point never gets further downfield than the route the concept called for
          // (plus a stride) — routeDepth is the arm and the concept, and it stays the ceiling
          const _capX = Math.max(routeDepth, 2) * YD + (_stride ? TU("strideOverYd", 3.2) : TU("leadOverYd", 1.5)) * YD;
          const _leadOn = !!TU("leadV101", 1);   // 0 puts the ball back on the route's last waypoint
          const idealX = _leadOn ? Math.min(_capX, target.lx + ((_lead.p.lx - target.lx) * _lk) + (_re ? (_fallX - target.lx) * TU("leadRouteBias", .12) : 0)) : _fallX;
          const idealY = _leadOn ? clampY(target.y + ((_lead.p.y - target.y) * _lk) + (_re ? (_fallY - target.y) * TU("leadRouteBias", .12) : 0)) : _fallY;
          throwLeadPx = Math.hypot(idealX - target.lx, idealY - target.y);
          // the CONE: the miss around that spot, and the colour the broadcast draws it in
          throwConeYd = coneYdV101(qb, routeDepth, throwProt, _panic, movingThrow, sep) * (_stride ? TU("strideConeK", .74) : 1);
          throwWindow = windowV101(sep, throwConeYd, throwProt);
          const errYd = throwConeYd;
          /* ===== v109 A HURRIED MISS HAS A DIRECTION =====
           * The miss around the aim point was isotropic: a ball thrown off the back foot with a
           * man in the passer's face was as likely to sail long as to die short. It is not. A
           * hurried or off-platform throw comes out SHORT and BEHIND — the arm never finishes,
           * the hips never come through — so the angle of the miss is pulled toward the vector
           * back to the passer and against the receiver's heading, by panic and by movement.
           * The MAGNITUDE of the miss is untouched: `errMag` is the same draw, so the cone,
           * `locationQuality`, the catch and pick rolls all see the same distribution of how
           * far the ball lands from the spot. A clean, set throw is still isotropic. */
          const _thAng = Math.atan2(idealY - qb.y, idealX - qb.lx);                   // the throw vector
          const _hdx = target._dx != null ? target._dx : Math.cos(_thAng), _hdy = target._dy != null ? target._dy : Math.sin(_thAng);
          const _bK = TU("errBiasBehindK", .8);                                      // how much "behind him" weighs against "short"
          const _biasAng = Math.atan2(-Math.sin(_thAng) - _hdy * _bK, -Math.cos(_thAng) - _hdx * _bK);
          const _biasP = cl(_panic * TU("errBiasPanicK", .7) + (movingThrow ? TU("errBiasMoveK", .35) : 0) + (underPressure ? TU("errBiasHurryK", .12) : 0), 0, TU("errBiasMax", .8));
          const _biased = Math.random() < _biasP;
          const errAng=_biased ? _biasAng + (Math.random() + Math.random() - 1) * TU("errBiasSpreadRad", 1.9) : Math.random()*Math.PI*2;
          const errMag=(Math.random()+Math.random())*.5*errYd*YD;
          let _errDir = errAng - _thAng; while (_errDir > Math.PI) _errDir -= Math.PI * 2; while (_errDir < -Math.PI) _errDir += Math.PI * 2;
          const platform = qb._roll ? "roll" : (qb._slid && underPressure) ? "slide" : underPressure ? "hurried" : "set";
          const cx=cl(idealX+Math.cos(errAng)*errMag,-3*YD,Math.max(idealX+4*YD,routeDepth*YD+4*YD));
          /* ===== v109 A BAD BALL CAN LEAVE THE FIELD =====
           * The landing spot used to be clamped to the sideline, so an errant ball could never
           * go out of bounds — it died ON the line, which no sideline throw does. The BALL now
           * lands where the miss puts it, past the paint if that is where it went; the men stay
           * clamped (that is their own movement), and every OUTCOME number — location quality,
           * who reaches the spot first, the contest — is still read at the in-bounds spot the
           * receiver actually plays it from, so nothing about the roll moves. */
          const cyy=idealY+Math.sin(errAng)*errMag*1.35;
          const cyIn=clampY(cyy), _oobV109 = cyy < SIDELINE_TOP || cyy > SIDELINE_BOT;
          locationQuality=cl(1-Math.hypot(cx-idealX,cyIn-idealY)/(YD*4.6),0,1);
          const _speed=a=>Math.max(110,a.spd||140), _eta=(a,knows)=>Math.hypot(cx-a.lx,cyIn-a.y)/_speed(a)*1000+(knows?55:cl(300-a.aware*2,95,250));
          const wrEta=_eta(target,true), cbEta=_eta(coverA,false);
          arrivalEdgeMs=wrEta-cbEta; // positive means the defender owns the spot first
          /* ===== v109 THE THROW EVENT TELLS THE TRUTH ABOUT THE BALL =====
           * `hang` was the lead-solve's guess; the real flight was recomputed after the cone
           * error and never told anyone. The event now carries `dur` (the flight the ball
           * actually makes), `vel` (px per sim-ms) and `velMph` (the caption's number, with the
           * 2.5x sim clock factored back out), `apex` (px), `wobble` (0..1: a hurried, moving,
           * unprotected ball is not a tight spiral), `platform` and `errDir` (radians off the
           * throw vector: 0 is long, ±π is short). The renderer spins and wobbles off these. */
          const _distV109 = Math.hypot(cx-qb.lx,cyy-qb.y);
          const _durV109 = flightDistMsV109(_distV109, S.off[8].thr, throwStyle);
          const _velV109 = ballVelV109(S.off[8].thr, throwStyle);
          const _velMphV109 = _velV109 / YD * 1000 / TU("simClockReal", 2.5) * 3600 / 1760;
          const _apexV109 = apexPxV109(_durV109, throwStyle);
          const _wobbleV109 = cl(_panic * TU("wobblePanicK", .9) + (movingThrow ? TU("wobbleMoveK", .25) : 0) + (1 - throwProt) * TU("wobbleProtK", .6) + (underPressure ? TU("wobbleHurryK", .15) : 0), 0, 1);
          emit("throw",{x:qb.lx,y:qb.y,tx:cx,ty:cyy,to:target.id,style:throwStyle,window:throwWindow,locationQuality,behind:target.lx<qb.lx,
            cone:+throwConeYd.toFixed(2), prot:+throwProt.toFixed(2), panic:+_panic.toFixed(2),
            lead:Math.round(throwLeadPx), leadYd:+(throwLeadPx/YD).toFixed(2), leadK:+_lk.toFixed(2), hang:Math.round(_lead.ms),
            dur:Math.round(_durV109), vel:+_velV109.toFixed(3), velMph:Math.round(_velMphV109), apex:Math.round(_apexV109),
            wobble:+_wobbleV109.toFixed(2), platform, errDir:+_errDir.toFixed(2), errBiased:_biased, oob:_oobV109||undefined,
            stride:_stride||undefined, strideOdds:+_strideOdds.toFixed(2)});   /* v129 */
          try { V109A.throws++; if (_oobV109) V109A.oob++;
            V109A.rows.push({ d: Math.round(_distV109), thr: S.off[8].thr, style: throwStyle, dur: Math.round(_durV109),
              legacy: Math.round(flightMsLegacyV109(qb, cx, cyy, throwStyle)), apex: Math.round(_apexV109), wobble: +_wobbleV109.toFixed(2),
              platform, errDir: +_errDir.toFixed(2), biased: _biased, panic: +_panic.toFixed(2), oob: _oobV109 });
            if (V109A.rows.length > 4000) V109A.rows.shift(); } catch (e) {}
          try { const W = root.__V101 = root.__V101 || { throws: 0, style: {}, win: {}, cone: 0, lead: 0, prot: 0, panic: 0, behindLead: 0 };
            W.throws++; W.style[throwStyle] = (W.style[throwStyle] || 0) + 1; W.win[throwWindow] = (W.win[throwWindow] || 0) + 1;
            W.cone += throwConeYd; W.lead += throwLeadPx / YD; W.prot += throwProt; W.panic += _panic; if (_lk < .6) W.behindLead++;
            W.last = { style: throwStyle, window: throwWindow, cone: +throwConeYd.toFixed(2), leadYd: +(throwLeadPx / YD).toFixed(2),
              hang: Math.round(_lead.ms), prot: +throwProt.toFixed(2), panic: +_panic.toFixed(2),
              depth: Math.round(routeDepth), sep: +sep.toFixed(2) }; } catch (e) {}
          emit("contest",{def:coverA.id,off:target.id,x:cx,y:cyIn,arrivalEdgeMs:Math.round(arrivalEdgeMs)});
          /* ===== v109 THE ARC FOLLOWS THE HANG =====
           * The apex used to be a per-style line in route depth, unrelated to how long the ball
           * was actually up — a 5-yard bullet peaked three and a half yards high. It is now
           * `apexPxV109(dur, style)`: apex ∝ dur² under one gravity constant, capped per style
           * so a rope stays a rope. `dur` is the same release-plus-velocity flight the throw
           * event just reported, and `apexF` puts the top past halfway (see `rec()`). */
          ballFlight = { t0:t, style:throwStyle, dur: _durV109,
            x0:qb.lx, y0:qb.y, x1:cx, y1:cyy, arc: _apexV109, apexF: TU("arcApexFrac", .55), done: ()=>{
              // soft correction only — they tracked the ball through its flight
              const capTo=(a,tx,ty,maxPx)=>{ const safeY=clampY(ty),d=Math.hypot(tx-a.lx,safeY-a.y);
                if(d>0.1){const f=Math.min(1,(maxPx==null?9:maxPx)/d);a.lx+=(tx-a.lx)*f;a.y=clampY(a.y+(safeY-a.y)*f);} };
              // v101: a defender BREAKS ON THE THROW. The further in front of the receiver the ball
              // was laid out, the more of that flight he spends driving on the catch point instead
              // of trailing the man — without it, leading the receiver hands away yards after the
              // catch that nobody on the field was given a chance to take.
              /* ===== v109 AN INCOMPLETION HAS A REASON =====
               * Where the receiver actually was when the ball came down, BEFORE the safety
               * snap — the miss is measured against the man, not the spot he was pulled to.
               * `capTo` itself is unchanged: the catch point and every roll below are the same. */
              const _tx0 = target.lx, _ty0 = target.y, _missPx = Math.hypot(cx - _tx0, cyIn - _ty0);
              try { const B = root.__V109_B = root.__V109_B || {}; B.arriveN = (B.arriveN || 0) + 1; B.arrivePx = (B.arrivePx || 0) + _missPx;
                B.arriveOver9 = (B.arriveOver9 || 0) + (_missPx > 9 ? 1 : 0); B.arriveDx = (B.arriveDx || 0) + (_tx0 - cx); B.arriveVel = (B.arriveVel || 0) + (target.vel || 0); } catch (e) {}
              capTo(target,cx,cyIn);
              capTo(coverA,cx-sep*2.4,cyIn+3, 9 + cl(throwLeadPx,0,TU("leadBreakCapPx",90))*TU("leadBreakK",.9));
              const qbA = S.off[8];
              /* ===== v82 BALL SKILLS — the catch point is a contest, not a timer =====
               * BOX OUT: a receiver between the defender and the ball uses his body.
               * WORK BACK: an underthrown ball is the receiver's to come back for — a
               * smart one does, a lazy one lets the corner undercut it. HANDS OR BALL:
               * a corner in a tight window plays the hands (a swat) or the ball (a pick). */
              const shortBall = cx < idealX - TU("underthrowPx", 9);
              const boxOut = target.lx > coverA.lx - 2 && arrivalEdgeMs > -80;
              const boxK = boxOut ? cl((target.str * .5 + ((target.ht||73) - 73) * 1.2 - coverA.str * .4) * .002 + .03, 0, .09) : 0;
              const comebackK = shortBall ? cl((target.aware - 50) * .002 + .02, -.02, .06) - (sep < .4 ? TU("underthrowRisk", .05) : 0) : 0;
              /* ===== v110 THE MAN WHO IS THERE — the ball belongs to whoever is standing on it =====
               * Only the assigned coverage man could break a pass up or pick it off, so a safety
               * sitting ON the catch point had no way to touch the ball: measured over ~300
               * arrivals, a defender other than the coverage man was the nearest man to the ball
               * 11% of the time and could do nothing about it. The contest now belongs to whoever
               * is actually closest, and it is HIS ratings that decide it. This swaps the identity
               * of the man making the play rather than adding a roll, so the rates hold. */
              const covGapV110 = Math.hypot(coverA.lx - cx, coverA.y - cyIn);
              let ballMan = coverA, ballManGap = covGapV110;
              if (TU("ballManV110", 1)) {
                for (const d of S.def) {
                  if (d === coverA || (d.stunned && t < d.stunned) || (d.engagedBy && !d.shed)) continue;
                  const g = Math.hypot(d.lx - cx, d.y - cyIn);
                  if (g < ballManGap - TU("ballManTakePx", 4) && g < TU("ballManReachPx", 24)) { ballMan = d; ballManGap = g; }
                }
                if (ballMan !== coverA) V110.ballMen++;
                if (ballMan !== coverA) emit("ballMan", { by: ballMan.id, on: target.id, off: coverA.id,
                  x: cx, y: cyIn, gap: Math.round(ballManGap), covGap: Math.round(covGapV110) });
              }
              const contested = sep < TU("contestSep", .2) && ballManGap < 22;
              const swatP = contested ? cl((ballMan.cov - 50) * .004 + (ballMan.jump - 50) * .002 + TU("swatBase", .04), 0, .3) * (ballMan.cov >= target.cat ? 1 : .6) : 0;
              if (shortBall) emit("comeback", { who: target.id, x: cx, y: cyy, smart: comebackK > 0 });
              if (boxOut && boxK > .04) emit("boxOut", { who: target.id, on: coverA.id, x: cx, y: cyy });
              // jumping decides the high-point on deep shots; ballControl secures contested grabs
              const jumpEdge = routeDepth > 13 ? (target.jump - coverA.jump) * 0.003 : 0;
              const secure = sep < 0 ? (target.bc-50)*0.002 : 0;
              const helperContest=bracketed&&coverHelp?cl(((coverHelp.cov+coverHelp.aware)/2-45)*.0025,0,.16):0;
              // Arrival changes *who owns the window* without making every cleanly
              // separated catch an automatic long YAC play. This keeps the legacy
              // completion/YPA mix while early defenders still create real danger.
              const arrivalCatch=cl(-arrivalEdgeMs/2100,-.045,.025), placementCatch=(locationQuality-.72)*.08;
              const catchP = cl(TU("catchBaseV39",root.__fullGameBalanceV39?.76:.54) + sep*0.05 + (qbA.aware-50)*0.003 + (qbA.thr-50)*0.003
                + (target.cat-50)*0.0035 + jumpEdge + secure + arrivalCatch + placementCatch + boxK + comebackK
                - helperContest - (underPressure?0.12:0) - (movingThrow?.055:0), 0.08, 0.93);
              // v109: the reason an incompletion carries, and the count the check reads
              const _reasonV109 = (reason, extra) => { try { const B = root.__V109_B = root.__V109_B || {}; (B.incReasons = B.incReasons || {})[reason] = (B.incReasons[reason] || 0) + 1; } catch (e) {}
                return Object.assign({ x: cx, y: cyy, reason, sep: +sep.toFixed(2), locQ: +locationQuality.toFixed(2), contested: !!contested,
                  miss: { dx: Math.round(cx - idealX), dy: Math.round(cyy - idealY) }, at: { dx: Math.round(cx - _tx0), dy: Math.round(cyy - _ty0) },
                  oob: _oobV109 || undefined }, extra || {}); };   // v109 A: past the paint when the miss took it there
              if (contested && Math.random() < swatP) {
                // v82: the corner plays the hands — ball knocked away, nobody has it
                // v109 A PASS BREAK-UP IS CONTACT: the arm comes from somewhere. A defender the
                // receiver had boxed out, or one trailing him, reaches through from BEHIND; one
                // deeper than the man undercuts it from the FRONT; side by side it comes OVER the top.
                const _from = (boxOut || ballMan.lx < target.lx - TU("swatSidePx", 3)) ? "behind" : ballMan.lx > target.lx + TU("swatSidePx", 3) ? "front" : "over";
                emit("swat", { by: ballMan.id, on: target.id, x: cx, y: cyIn, contact: true, from: _from, boxOut: !!boxOut, edgeMs: Math.round(arrivalEdgeMs) });
                emit("incomplete", _reasonV109("swat", { by: ballMan.id, on: target.id, from: _from })); done = true;
                ballByV110 = ballMan; ballPlayerV110 = ballMan.player || null;   // v110: the break-up is credited to the man who made it (v150 B: and only to him)
                V110.lastBall = { by: ballMan.id, player: ballMan.player || null, kind: "swat" };
                try { const B = root.__V109_B; B.swatN = (B.swatN || 0) + 1; (B.swatFrom = B.swatFrom || {})[_from] = (B.swatFrom[_from] || 0) + 1; } catch (e) {}
                out = { kind: "pass", complete: false, intercepted: false, yards: 0, swat: true };
              } else if (Math.random() < catchP) {
                emit("catch",{by:target.id,x:cx,y:cyIn,catchType:locationQuality<.62&&routeDepth>7?"dive":routeDepth>12?"high":"secure"});   // v109: caught at the in-bounds spot he plays it from
                carrier = target;
                // Placement that lets the receiver catch in stride carries into
                // the acceleration target for a short run-through window. Poorly
                // located/dive catches get almost none; this is not a velocity snap.
                target._catchRunThroughUntil=t+TU("catchRunThroughMs",550);
                target._catchStrideBoost=cl((locationQuality-.35)*TU("catchStrideLocationK",.32),.02,TU("catchStrideMax",.11));
                // A defender who arrived with the receiver usually finishes the
                // catch immediately; late/trailing coverage concedes real YAC.
                // This makes location/arrival matter while retaining broken-play upside.
                const catchGap=Math.hypot(coverA.lx-target.lx,coverA.y-target.y);
                /* v101: a ball thrown INTO SPACE is also a ball the coverage is running to. The
                 * lead gets the receiver to it cleaner and in stride, which is the whole point —
                 * but the man who was beaten to the spot still arrives, so the further in front of
                 * him it was thrown, the more ground the defender has covered getting there. Without
                 * this the lead alone put yards-after-catch up by half. */
                const leadClose=cl(throwLeadPx/YD,0,TU("leadCloseCapYd",12))*TU("leadCloseK",.012);
                const catchStopP=cl(TU("catchStopBase",.10)+leadClose+arrivalEdgeMs/1400+(coverA.tkl-target.agi*.55-target.str*.25)*.004-Math.max(0,sep)*.07,.04,.42);
                if(catchGap<24&&Math.random()<catchStopP){
                  emit("tackle",{tackler:coverA.id,carrier:target.id,x:cx,y:cyy,stayUp:true,catchTackle:true});
                  out={kind:"pass",complete:true,intercepted:false,yards:Math.max(1,Math.round(cx/YD))}; done=true;
                } else phase = "carry";
              } else {
                const absSpot=(Number(opts?.fieldPos)||50)+cx/YD, sideline=Math.abs(cyy-MIDY)>165;
                const fieldRisk=(absSpot>=90?.012:0)+(absSpot<=12?.006:0)+(routeDepth>12&&!sideline?.008:0)-(sideline?.012:0);
                const earlyRisk=cl((arrivalEdgeMs-70)/1700,0,.05), badLocation=(1-locationQuality)*.02;
                const intP = cl((ballMan.cov - target.spdA*0.5 - target.agi*0.5) * 0.004
                  + (routeDepth>13 ? (ballMan.jump-target.jump)*0.002 : 0)
                  + (bracketed&&coverHelp?(coverHelp.cov-45)*.0012:0)
                  - (S.off[8].aware-50)*0.0007 + (sep < -2 ? 0.028 : 0.012)
                  + earlyRisk + badLocation + fieldRisk + (underPressure?.008:0), 0.004, 0.18)
                  * (window.__toMultV76 || 1);      // v76: takeaway swing, damped by mismatch
                if (Math.random() < intP) {
                  emit("pick",{by:ballMan.id,x:cx,y:cyy});
                  carrier = ballMan; phase = "carry";           // v110: the man who picked it is the man who returns it
                  ballByV110 = ballMan; ballPlayerV110 = ballMan.player || null;   // v150 B: the pick is his, or nobody's
                  V110.lastBall = { by: ballMan.id, player: ballMan.player || null, kind: "pick" };
                  out = { kind:"pass", complete:false, intercepted:true, yards:0 };
                } else {
                  // v109 AN INCOMPLETION HAS A REASON — classified AFTER the rolls, changing none of them.
                  // A catchable ball (well placed, nobody in his hands, the man open) that hit the turf
                  // is a DROP, and it is his. Otherwise the miss says what it was: long past him, an
                  // overthrow; dead in front of him, short; off his hip, behind him; and a ball put on
                  // him with the defender in the window was simply broken up.
                  // (the receiver runs to every ball in this sim, so the miss that MEANS something is the
                  // passer's — the catch point against the spot he was aiming at, `idealX/idealY`)
                  const _mdx = cx - idealX, _mdy = cyy - idealY, _tol = TU("missPx", 10), _catchable = locationQuality > TU("dropLocQ", .7);
                  const _reason = (_catchable && !contested && sep > TU("dropSepMin", -1.5)) ? "drop"
                    : _catchable ? "contested"
                    : _mdx > _tol ? "overthrow" : _mdx < -_tol ? "short" : Math.abs(_mdy) > _tol ? "behind" : "contested";
                  emit("incomplete", _reasonV109(_reason, _reason === "drop" ? { by: target.id } : _reason === "contested" ? { by: ballMan.id, on: target.id } : { on: target.id })); done = true;
                  // v30: the defender was IN the receiver at the catch point on a real
                  // route and the ball hit the turf — that contact is a DPI candidate
                  if (sep < TU("dpiSep",-0.8) && routeDepth > 6 && coverA.player) flagCand.dpi = coverA.player;
                  out = { kind:"pass", complete:false, intercepted:false, yards:0 }; }
              }
            } };
          phase = "fly";
        }
      }
      else if (phase === "fly") {
        if (ballFlight) {
          const remain=Math.max(0,ballFlight.t0+ballFlight.dur-t);
          const wrD=Math.hypot(ballFlight.x1-target.lx,ballFlight.y1-target.y);
          const cbD=Math.hypot(ballFlight.x1-coverA.lx,ballFlight.y1-coverA.y);
          const battling=wrD<38&&cbD<38&&remain>120;
          // When both players arrive before the ball, keep the rep alive: they
          // fight for leverage instead of becoming two statues under the pass.
          const jostle=battling?Math.sin(t/72)*4.5:0;
          /* ===== v109 THE RECEIVER FINDS THE BALL =====
           * The target used to be driven at the landing spot from the instant of release — and
           * driven TWICE a tick, once here and once by the route block below, so he covered
           * double ground the moment the ball was in the air and was parked under it long before
           * it came down. Nobody runs a route that way: a man with his back to the quarterback
           * keeps running his route until he finds the ball over his shoulder, and only then
           * does he adjust to where it is coming down. So he finds it on his own clock —
           * awareness makes it quicker, a ball coming over the shoulder makes it later — and
           * until that moment the route block steers him alone (one `mv` a tick, either way).
           * The catch point itself is untouched: `capTo` in `done()` is still the final safety,
           * so every roll below sees the same numbers it always did. */
          if (target._ballFoundAt == null) {
            const hx = target._dx == null ? 1 : target._dx, hy = target._dy == null ? 0 : target._dy;      // his heading (downfield if he has not moved)
            const bx = ballFlight.x0 - target.lx, by = ballFlight.y0 - target.y, bn = Math.hypot(bx, by) || 1;
            const shoulder = cl((1 - (hx * bx + hy * by) / bn) / 2, 0, 1);   // 0: running at the passer, 1: back square to him
            const findMs = TU("ballFindBaseMs", 110) + cl(70 - target.aware, -30, 40) * TU("ballFindAwareK", 2.0) + shoulder * TU("ballFindShoulderMs", 150);
            const latest = Math.max(40, ballFlight.dur - TU("reachLeadMs", 180) - 60);   // he always finds it before his hands have to go up
            target._ballFindMs = Math.round(cl(findMs, 40, latest)); target._ballShoulder = +shoulder.toFixed(2);
            target._ballFoundAt = ballFlight.t0 + target._ballFindMs;
            // where he would be at arrival if he simply kept running — a ball landing short of
            // that is one he has to turn back for, over the back shoulder
            target._projLxV109 = target.lx + hx * Math.max(110, target.spd || 140) * (target.vel || .8) * ballFlight.dur / 1000;
          }
          const found = !TU("ballFindV109", 1) || t >= target._ballFoundAt;
          if (found && !target._ballTracked) { target._ballTracked = true;
            emit("ballTrack", { who: target.id, x: ballFlight.x1, y: ballFlight.y1, late: target._ballFindMs > TU("ballFindLateMs", 230), ms: target._ballFindMs, shoulder: target._ballShoulder });
            try { const B = root.__V109_B = root.__V109_B || {}; B.trackN = (B.trackN || 0) + 1; B.trackMs = (B.trackMs || 0) + target._ballFindMs;
              (B.tracks = B.tracks || []).push({ ms: target._ballFindMs, shoulder: target._ballShoulder, aware: target.aware }); if (B.tracks.length > 60) B.tracks.shift(); } catch (e) {} }
          // v129: a ball thrown in stride is already where he is going, so he runs onto it
          // instead of adjusting back to it
          if (found) mv(target, ballFlight.x1 - (target._strideV129 ? 0 : 3), ballFlight.y1 + jostle, target._strideV129 ? TU("strideTrackMul", 1.16) : 1.08);
          mv(coverA, ballFlight.x1-sep*2.4+2, ballFlight.y1+3-jostle, 1.02);
          if(battling&&!handfightShown){ handfightShown=true;
            emit("handfight",{off:target.id,def:coverA.id,x:ballFlight.x1,y:ballFlight.y1}); }
          if(remain<=260&&!highpointShown){ highpointShown=true;
            emit("highpoint",{off:target.id,def:coverA.id,x:ballFlight.x1,y:ballFlight.y1,deep:routeDepth>13}); }
          /* v109 THE HANDS GO UP: the reach is its own moment, ahead of the ball. The broadcast
           * starts the catch on it and lets `catch` merely confirm the ball; if nothing confirms,
           * the hands come down empty. `kind` picks the drawn sequence and agrees with the
           * catchType the catch will carry (a dive is a dive on both). */
          if (remain <= TU("reachLeadMs", 180) && !target._reachV109) { target._reachV109 = true;
            const kind = (locationQuality < .62 && routeDepth > 7) ? "dive"
              : (ballFlight.x1 < (target._projLxV109 == null ? target.lx : target._projLxV109) - TU("backShoulderPx", 12) && routeDepth > 5) ? "back-shoulder"
              : routeDepth > 12 ? "high" : "stride";
            emit("reach", { by: target.id, x: ballFlight.x1, y: ballFlight.y1, kind, at: Math.round(t + remain), contested: battling });
            try { const B = root.__V109_B = root.__V109_B || {}; B.reachN = (B.reachN || 0) + 1; (B.reachKinds = B.reachKinds || {})[kind] = (B.reachKinds[kind] || 0) + 1; } catch (e) {} }
          if(bracketed&&coverHelp)mv(coverHelp,ballFlight.x1+5,ballFlight.y1+(coverHelp.y<MIDY?-9:9),.94+coverHelp.aware*.0015);
        }
      }
      else if (phase === "carry") {
        const c = carrier;
        const endTackle = (dfd) => {
          // grit: falls forward. v103: unless he was GRIPPED — the drag just played that out
          // for real, and paying the old blind fudge on top of it counts the yard twice.
          if (!c._wasGripped) c.lx += Math.max(0, (c.grit-50)) * 0.018 * (c.side==="off"?1:-1);
          done = true;
          const spotLx = c._fpSpotV153A != null ? c._fpSpotV153A : c.lx;   // v153 A: forward progress — the spot, not where the pile left him
          const yds = c.side==="off" ? Math.round(spotLx/YD) : 0;
          if (isKick) { out = { kind, yards: 0, ret: Math.round(((c._catchLx||0) - spotLx) / YD), spotLx }; return; }   // v82: the return is booked as return yards
          if (!out) out = { kind, yards: yds }; else out.yards = 0;           // pick return: passer line stays 0
        };
        /* ===== v103 THE GRIP TICK — they travel together, and where they LAND is the spot =====
         * `contact()` no longer ends the play when a wrap lands: it opens a grip and hands the
         * carry loop two men attached to each other. Everything that actually happens between
         * the grab and the ground happens here, once a tick:
         *   - they TRAVEL. His legs are still going and the tackler is dead weight on his back
         *     hip, so the pair slides forward at a pace set by his strength against the man
         *     holding him. The tackler's position is written from the carrier's, which is what
         *     makes the two sprites move as one thing on screen.
         *   - men PILE ON. Anyone who gets hands on joins the heap, rides along, and takes time
         *     off the clock — the third man is why nobody drags a defence ten yards.
         *   - the ball gets PUNCHED AT. A fumble forced here is a fumble the sim can NAME: who
         *     stripped it, who recovered it, and where — the engine's blind pre-roll never could.
         *   - he STRAINS for the sticks. Inside a couple of yards of the marker or the goal line
         *     his leg drive finds another gear, which is where third-and-one is decided.
         *   - he BREAKS it. Rarely, a powerful back rips out of the wrap and the play is live again.
         *   - and he LANDS, with the tackle emitted at the ground they actually covered. */
        /* ===== v109 THE FUMBLE COMES LOOSE =====
         * The strip used to end the play on the SAME tick it was rolled: `defRec` decided, `endTackle`
         * run, whistle — the ball never came loose on screen and nobody dived. The truth is still
         * pre-rolled exactly as before (same `defRec` roll, same spot `c.lx, c.y`, same `out.fumble`
         * fields, same turnover rate), but between the roll and the booking there is now a short
         * SCRAMBLE: a loose-ball point skids a few px from where it came out, the side that has
         * already won it sends its nearest man onto it, everybody else brakes as they would at a
         * whistle, and then `recover` fires and the play ends through `recoverV109` with the very
         * same bookkeeping the old same-tick path did. The carrier does not move — the spot is his.
         * The sub-phase is clamped to the ticks left before HARD, so the clock safety still holds. */
        const recoverV109 = (L) => {
          emit("recover", { by: L.by, x: Math.round(L.x * 10) / 10, y: Math.round(L.y * 10) / 10, ms: t - L.t0,
            defRec: L.defRec, side: L.side, strip: true, cid: L.cid });
          endTackle(L.dfd);
          if (out) out.fumble = { by: c.player || null, forcedBy: L.puncher.player || null, defRec: L.defRec,
            yards: c.side === "off" ? Math.round(c.lx / YD) : 0, x: c.lx, y: c.y };
          c._looseV109 = null;
        };
        if (c._looseV109) {
          const L = c._looseV109; L.k++;
          // the ball skids, loses its pace, and dies inside `looseWanderPx` of where it came out
          const dampK = TU("looseDampK", .8), jit = TU("looseJitterPx", .5);
          L.vx = L.vx * dampK + (Math.random() - .5) * jit; L.vy = L.vy * dampK + (Math.random() - .5) * jit;
          L.x += L.vx; L.y = clampY(L.y + L.vy);
          const wx = L.x - L.x0, wy = L.y - L.y0, wd = Math.hypot(wx, wy), wmax = TU("looseWanderPx", 6);
          if (wd > wmax) { L.x = L.x0 + wx / wd * wmax; L.y = clampY(L.y0 + wy / wd * wmax); }
          // the side that has already won it sends its nearest man; the rest brake as at a whistle
          const rman = A_all[L.by];
          for (const a of S.all) { if (a === c) continue;
            if (a === rman) { mv(a, L.x, L.y, TU("looseChaseMult", 1.0)); continue; }
            evolveSpeed(a, 0, TICK, t, 0, TU("whistleBrakeScale", .46));
            const v = Math.max(0, a.vel || 0) * (a.spd || 120) * (TICK / 1000) * .8;
            if (v > .15) { a.lx += (a._dx || 0) * v; a.y = clampY(a.y + (a._dy || 0) * v); } }
          const landed = L.k >= L.ticks;
          if (landed) recoverV109(L);
          rec();   // the recorded ball is the loose one, not the carrier's hand
          ballFrames[ballFrames.length - 1] = { t, x: Math.round(L.x * 10) / 10, y: Math.round(L.y * 10) / 10, h: 0 };   // on the grass: the renderer draws the bounce (h > 2 would read as a flight)
          continue;
        }
        if (c._grip) {
          const G = c._grip, dfd = A_all[G.by], dsg = c.side === "off" ? 1 : -1, age = t - G.t0;
          if (!dfd || (dfd.stunned && t < dfd.stunned) || (dfd.trucked && t < dfd.trucked + 900)) { c._grip = null; }
          else {
            // ---- men pile on: hands on, riding along, and the clock runs out faster
            if (TU("pileOnV103", 1) && G.joined.length < TU("gripJoinMax", 3)) {
              for (const a of S.all) {
                if (a.side === c.side || a === dfd || a.lb === "OL" || G.joined.indexOf(a.id) >= 0) continue;
                if (t <= (a.beaten || 0) || (a.trucked && t < a.trucked + 900) || (a.stunned && t < a.stunned)) continue;
                if (Math.hypot(a.lx - c.lx, a.y - c.y) > TU("gripJoinPx", 15)) continue;
                G.joined.push(a.id); G.ms = Math.max(TU("gripMinMs", 90), G.ms - TU("gripJoinCutMs", 150));
                /* v109 THE PILE HAS A SHAPE — the pile used to be a rigid comb (every heap the same
                 * shape, a man who arrived from the left ending up on the right because he was joiner
                 * i=1). A joiner now keeps the bearing he ARRIVED on: his rest ray is the reverse of
                 * his approach (or the line from the carrier to him when he was standing still), fanned
                 * a little per joiner so two men off the same side do not share a pixel. The travel
                 * code lerps him in along that ray from the distance he latched at. Cosmetic. */
                let jux = -(a._dx || 0), juy = -(a._dy || 0); const jtx = a.lx - c.lx, jty = a.y - c.y, jtd = Math.hypot(jtx, jty) || 1, jl = Math.hypot(jux, juy);
                if (jl < .2 || jux * jtx + juy * jty <= 0.05 * jtd) { jux = jtx / jtd; juy = jty / jtd; } else { jux /= jl; juy /= jl; }
                const appr = Math.atan2(-juy, -jux), jI = G.joined.length - 1, rot = (jI % 2 ? 1 : -1) * jI * TU("pileFanRad", .3), jcs = Math.cos(rot), jsn = Math.sin(rot);
                G.joinGeo[a.id] = { ux: jux * jcs - juy * jsn, uy: jux * jsn + juy * jcs, r0: jtd, t0: t };
                const aMom = (WT[a.lb] || .7) * Math.max(.12, a.vel || 0) * a.spd;
                /* getting hands on the heap is not the same as being IN ON THE TACKLE. The pile
                 * is physical — it shortens the grip and it rides along — but whether the stop is
                 * BOOKED as assisted is rolled once, on the same odds the instantaneous path has
                 * always used. Without this every man who brushed the pile turned a solo tackle
                 * into a gang tackle and the solo/gang split collapsed to fifty-fifty. */
                if (!G.gang && !G.gangRolled) { G.gangRolled = true;
                  G.gang = Math.random() < Math.min(0.9, (G.openField ? TU("gangOpen", .10) : TU("gangBox", .36)) + G.handsOn * TU("gangHandsK", .24)); }   // handsOn AT THE WRAP, exactly as the instantaneous path counts it
                emit("pileOn", { who: a.id, carrier: c.id, x: c.lx, y: c.y, n: G.joined.length + 1,
                  angle: +appr.toFixed(3), mom: Math.round(aMom), cid: G.hit.cid });   // v109: the bearing he arrived on, and how hard
                if (G.joined.length >= TU("gripJoinMax", 3)) break;
              }
            }
            /* ===== v153 A GIVE GROUND — he backs out of the pile before it closes =====
             * A group tackle is not finished when the first man grabs him: while the second man is
             * still arriving the carrier can give a yard, drop his hips and spin back out of it. Rolled
             * ONCE per grip, the first tick a group is forming (a joiner has hands on, or support was
             * already there when the wrap landed), on the contact odds the grip already weighs — his
             * agility, strength and ball security against the tacklers' tackling and strength, less
             * for every extra man, and each move he has already made this play counts against the
             * next (`evadeRepeatK`, as a broken grip does). On a make: the grip opens, the men who
             * had hands on are beaten for `escapeBeatenMsV153A`, and he gives ground — a short
             * backward, sideways step (`escapeMsV153A`, `escapeBackPxV153A`) with the spin drawn —
             * then turns it upfield again. Giving ground is VOLUNTARY, so no forward progress is kept
             * for it (THE BALL IS SPOTTED WHERE HE GOT TO, below). The roll spends a Math.random()
             * only when a group forms, so ON and OFF are different sample paths: compare seeds.
             * Kill switches `TU("escapeV153A", 0)` / `TU("v153A", 0)`. */
            if (TU("v153A", 1) && TU("escapeV153A", 1) && !G.escRolledV153A && !isKick && !G.strip
                && (G.joined.length || G.nSupport > 0) && age >= TU("escapeFromMsV153A", 33)) {
              G.escRolledV153A = true;
              const menV153A = [dfd].concat(G.joined.map(id => A_all[id]).filter(Boolean));
              const holdV153A = menV153A.reduce((s, a) => s + (a.tkl || 50) * .6 + (a.str || 50) * .4, 0) / menV153A.length;
              const giveV153A = (c.agi || 50) * TU("escapeAgiKV153A", .45) + (c.str || 50) * TU("escapeStrKV153A", .25) + (c.bc || 50) * TU("escapeBcKV153A", .3);
              const pEsc = cl((TU("escapeBaseV153A", .08) + (giveV153A - holdV153A) * TU("escapeEdgeKV153A", .004)
                - Math.max(0, menV153A.length + (G.joined.length ? 0 : Math.min(1, G.nSupport)) - 2) * TU("escapeManKV153A", .03))
                * Math.pow(TU("evadeRepeatK", .6), Math.max(0, c._evades || 0)), 0, TU("escapeCapV153A", .22));
              const Vesc = root.__V153A = root.__V153A || { rolls: 0, escapes: 0, fp: 0, fpYd: 0, fpSkipQB: 0, gangDown: 0, last: null };
              Vesc.rolls++;
              if (Math.random() < pEsc) {
                const sideV153A = G.side || (c.y < MIDY ? 1 : -1), msV153A = TU("escapeMsV153A", 230);
                c._grip = null; dfd._gripOn = null;
                menV153A.forEach(a => { a.beaten = Math.max(a.beaten || 0, t + TU("escapeBeatenMsV153A", 520)); a.cool = t + 480; a._gripOn = null; });
                c._escV153A = { t0: t, until: t + msV153A, side: sideV153A, x0: c.lx };
                c.burstUntil = t + msV153A + TU("escapeBurstMsV153A", 380); c._evades = (c._evades || 0) + 1;
                Vesc.escapes++; Vesc.last = { p: +pEsc.toFixed(3), men: menV153A.length };
                emit("escapeV153A", { carrier: c.id, from: menV153A.map(a => a.id), x: c.lx, y: c.y, side: sideV153A, p: +pEsc.toFixed(3), cid: G.hit.cid });
                emit("cut", { kind: "spin", x: c.lx, y: c.y, carrier: c.id, elus: Math.round((c.agi || 50) * .5 + (c.quick || 50) * .5),
                  direction: sideV153A, targetY: clampY(c.y + sideV153A * TU("escapeLatPxV153A", 22)), escapeV153A: true });
                rec(); continue;
              }
            }
            // ---- the strip: the ball is up in traffic and somebody punches at it
            if (!G.strip && TU("stripV103", 1) && age > TU("stripFromMs", 60) && !isKick) {
              // the man with his arms round him is as likely to punch at it as the second man in
              const puncher = G.joined.length ? A_all[G.joined[G.joined.length - 1]] : dfd;
              if (puncher) {
                const exposure = (G.behind ? TU("stripBehindK", 1) : 0) + G.joined.length * TU("stripHandsK", 1.1);
                /* v143: hands at the ball or hands at the ankles — a low tackle has no strip in it */
                const aimStripK = (TU("v143", 1) && c._grip && AIM_FX_V143[c._grip.aim] ? AIM_FX_V143[c._grip.aim].strip : 1);
                const skill = ((puncher.str * .45 + puncher.tkl * .55) - (c.bc * .72 + c.str * .28)) * TU("stripSkillK", .00055) * aimStripK;
                const pPerTick = cl((TU("stripBase", .024) + exposure * TU("stripExposeK", .006) + skill), 0, TU("stripCap", .05)) * (TICK / 100);
                if (Math.random() < pPerTick) {
                  G.strip = true;
                  const nearOff = S.all.filter(a => a.side === c.side && a !== c && Math.hypot(a.lx - c.lx, a.y - c.y) < 40).length;
                  const nearDef = 1 + G.joined.length + S.all.filter(a => a.side !== c.side && a !== dfd && G.joined.indexOf(a.id) < 0 && Math.hypot(a.lx - c.lx, a.y - c.y) < 40).length;
                  const defRec = Math.random() < cl(TU("stripDefRecP", .46) + (nearDef - nearOff) * TU("stripRecEdgeK", .035), .28, .74);   // the PRE-ROLLED truth; the scramble only shows it
                  emit("fumble", { x: c.lx, y: c.y, by: c.id, forcedBy: puncher.id, defRec, strip: true, cid: G.hit.cid });
                  // v109 THE FUMBLE COMES LOOSE: the ball pops out with a direction and the play goes
                  // into the scramble (see the block above the grip); the booking is identical to the
                  // old same-tick path, just `looseTicks` later. Ticks are clamped to the room before HARD.
                  const lAng = Math.random() * Math.PI * 2, lSp = TU("looseSpeedPx", 1.4);
                  const L = { t0: t, k: 0, x: c.lx, y: c.y, x0: c.lx, y0: c.y, vx: Math.cos(lAng) * lSp, vy: Math.sin(lAng) * lSp,
                    defRec, dfd, puncher, cid: G.hit.cid, side: defRec ? (c.side === "off" ? "def" : "off") : c.side, by: null };
                  let best = null, bd = 1e9;
                  for (const a of S.all) { if (a.side !== L.side || a === c) continue; const dd = Math.hypot(a.lx - c.lx, a.y - c.y); if (dd < bd) { bd = dd; best = a; } }
                  L.by = best ? best.id : null;
                  const lMin = TU("looseTicksMin", 8), room = Math.floor((HARD - t) / TICK) - 1;
                  L.ticks = Math.min(room, Math.round(lMin + Math.random() * Math.max(0, TU("looseTicksMax", 15) - lMin)));
                  emit("looseBall", { x: c.lx, y: c.y, vx: +L.vx.toFixed(2), vy: +L.vy.toFixed(2), by: c.id, cid: L.cid });
                  c._grip = null; dfd._gripOn = null;
                  if (L.ticks <= 0 || L.by == null || !TU("looseV109", 1)) { recoverV109(L); rec(); continue; }   // no room on the clock: the old same-tick ending
                  c._looseV109 = L;
                  rec(); ballFrames[ballFrames.length - 1] = { t, x: Math.round(L.x * 10) / 10, y: Math.round(L.y * 10) / 10, h: 0 };
                  continue;
                }
              }
            }
            // ---- the horse collar: a grab from dead behind, hauling him down by the shoulders
            if (G.behind && !G.hc && TU("horseCollarV103", 1) && age > TU("hcFromMs", 70) && dfd.player
                && Math.random() < TU("hcP", .035)) {
              G.hc = true; flagCand.hc = dfd.player;
              emit("horseCollar", { who: dfd.id, carrier: c.id, x: c.lx, y: c.y });
            }
            // ---- second effort: inside a couple of yards of the marker he strains for it
            let strain = 0;
            if (TU("secondEffortV103", 1) && c.side === "off") {
              const marks = [];
              if (opts && Number.isFinite(opts.toGo)) marks.push(opts.toGo * YD);
              if (opts && Number.isFinite(opts.fieldPos)) marks.push((100 - opts.fieldPos) * YD);
              for (const mk of marks) {
                const gap = (mk - c.lx) * dsg;
                if (gap > 0 && gap < TU("secondEffortYd", 2) * YD) {
                  strain = Math.max(strain, cl(TU("secondEffortK", .22) + Math.max(0, c.grit - 50) * .0055
                    + Math.max(0, c.str - dfd.str) * .0035, 0, TU("secondEffortMax", .6)));
                  if (!G.strain) { G.strain = true; emit("secondEffort", { carrier: c.id, x: c.lx, y: c.y, need: +(gap / YD).toFixed(1) }); }
                }
              }
            }
            // ---- he rips out of it and the play is live again
            if (!G.strip && TU("gripBreakV103", 1) && age > TU("breakFromMs", 80) && !G.joined.length) {
              const edge = (c.str * .5 + c.grit * .3 + c.bc * .2) - (dfd.tkl * .62 + dfd.str * .38);
              const pPerTick = cl(TU("breakBase", .028) + edge * TU("breakEdgeK", .0012), 0, TU("breakCap", .12))
                * Math.pow(TU("evadeRepeatK", .6), Math.max(0, (c._evades || 0) - 1)) * (TICK / 100);
              if (Math.random() < pPerTick) {
                c._grip = null; dfd._gripOn = null;
                dfd.beaten = t + TU("breakBeatenMs", 720); dfd.cool = t + 600;
                c.burstUntil = t + 420; kickSprint(c); c._evades = (c._evades || 0) + 1;
                emit("gripBreak", { who: dfd.id, carrier: c.id, x: c.lx, y: c.y });
                rec(); continue;
              }
            }
            // ---- they travel together
            const pull = cl(TU("gripPace", .13) + (c.str - dfd.str) * TU("gripStrPace", .0022)
              + Math.max(0, c.grit - 50) * TU("gripGritPace", .0014) + strain
              - G.joined.length * TU("gripPilePace", .085), .05, .82);
            // a man with another man on his back does not coast to a stop over ten yards: the
            // grip caps his gear outright, so the drag is the yard or two he can churn out and
            // never the tail of a full-speed deceleration
            c.vel = Math.min(c.vel || 0, cl(TU("gripVelCap", .24) + strain * .5, .08, .9));
            /* ===== v151 D THE PUSH =====
             * The grip only ever travelled FORWARD: a tackler who won the collision outright still
             * got dragged, because the pair's pace was the carrier's strength against his and
             * nothing else. Contact is a shove match. When the tackler clearly won the point of
             * attack (`collEdge` past `pushBackEdgeV151D` — a bigger, faster, stronger man square on
             * him, a gang) he DRIVES the carrier back for the first `pushBackMsV151D` of the grip,
             * both men travelling together along the push, before they go down; the stronger the win
             * the harder the drive (`pushBackPaceV151D`), capped (`pushBackMaxPaceV151D`) and never
             * while he is straining for the sticks. When the CARRIER won it by a street, the forward
             * drag is announced as a push the other way. Either way the pair moves together (the
             * tackler's spot is written from the carrier's just below), the landing is the spot, and
             * `pushV151D` says who drove whom so the renderer can lean them into it. The yards are
             * the ground they really covered — sim truth, exactly as the drag always was.
             * Kill switch `TU("pushV151D", 0)`. */
            let pushDir = 0;
            if (TU("pushV151D", 1)) {
              const eB = TU("pushBackEdgeV151D", 1.5);
              if (G.collEdge > eB && !strain && age < TU("pushBackMsV151D", 200)) pushDir = -1;
              else if (G.collEdge < -TU("pushFwdEdgeV151D", .6) && pull >= TU("pushFwdPullV151D", .2)) pushDir = 1;
              if (pushDir && !G.pushSaid) { G.pushSaid = true;
                emit("pushV151D", { who: pushDir < 0 ? dfd.id : c.id, on: pushDir < 0 ? c.id : dfd.id, carrier: c.id, dir: pushDir,
                  edge: +G.collEdge.toFixed(2), ms: pushDir < 0 ? Math.min(TU("pushBackMsV151D", 200), G.ms) : Math.round(G.ms), x: c.lx, y: c.y, cid: G.hit.cid }); }
            }
            if (pushDir < 0) {   // driven back: he is not running there, he is being moved — his heading stays on the man in front of him
              const bp = cl((G.collEdge - TU("pushBackEdgeV151D", 1.5)) * TU("pushBackPaceV151D", .15) + .06, .05, TU("pushBackMaxPaceV151D", .25));
              c.vel = Math.min(c.vel || 0, bp); c.lx -= dsg * bp * c.spd * TICK / 1000;
            }
            else mv(c, c.lx + dsg * 46, c.y, pull);
            // v153 A: the furthest point his forward progress reached inside this grip (see the landing)
            if (G.fpLxV153A == null) G.fpLxV153A = G.x0;
            if ((c.lx - G.fpLxV153A) * dsg > 0) G.fpLxV153A = c.lx;
            // v109: the gripper settles onto the back hip FROM where he latched rather than snapping
            // there; each joiner rides in along the ray he arrived on (THE PILE HAS A SHAPE)
            const setK = cl(age / TU("gripSettleMs", 120), 0, 1), hx = -dsg * TU("gripHoldPx", 8), hy = G.side * TU("gripHoldY", 4);
            dfd.lx = c.lx + G.grabDx + (hx - G.grabDx) * setK; dfd.y = clampY(c.y + G.grabDy + (hy - G.grabDy) * setK);
            dfd._dx = c._dx; dfd._dy = c._dy; dfd.vel = c.vel;
            G.joined.forEach((id, i) => { const a = A_all[id]; if (!a) return;
              const J = G.joinGeo[id];
              if (J) { const rT = TU("pileRadiusPx", 9) + i * TU("pileRadiusStepPx", 2), jk = cl((t - J.t0) / TU("pileSettleMs", 130), 0, 1), jr = J.r0 + (rT - J.r0) * jk;
                a.lx = c.lx + J.ux * jr; a.y = clampY(c.y + J.uy * jr); }
              else { a.lx = c.lx - dsg * (11 + i * 3); a.y = clampY(c.y + (i % 2 ? 1 : -1) * (7 + i * 3)); }
              a._dx = c._dx; a._dy = c._dy; a.vel = c.vel; });
            // v109 THE HEARTBEAT — the grip used to emit only `grab` and the final `tackle`, so the
            // renderer could not react to a joiner slowing the drag or a strain while the pair
            // travelled 90-340ms. A `drag` now says so every `dragSayMs` (the first tick always).
            if (G.lastSay == null || t - G.lastSay >= TU("dragSayMs", 99)) { G.lastSay = t;
              emit("drag", { carrier: c.id, by: dfd.id, x: c.lx, y: c.y, pull: +pull.toFixed(2), n: G.joined.length + 1,
                strain: !!G.strain, vel: +(c.vel || 0).toFixed(2), cid: G.hit.cid }); }
            // ---- the landing: the tackle is booked on the ground they actually covered
            if (age >= G.ms) {
              const dragYd = (c.lx - G.x0) * dsg / YD;
              /* stat-credit truth: an assist is only real when the stop was actually ASSISTED and
               * YOU were one of the men with hands on. `joined` is hands-on by construction (he
               * reached the pile and latched); `sup` is merely "nearby when the wrap landed", so
               * it only counts when the collision was resolved as a gang stop — which is exactly
               * the gate the instantaneous path has always used. Standing near a pile is not
               * participation, and creditcheck fails the build if this drifts. */
              const _assisted = !!G.gang;
              const youIn = (_assisted && S.all.some(a => a.player && a.player.you && a.side !== c.side && a !== dfd
                && (G.joined.indexOf(a.id) >= 0 || (G.gang && G.sup.indexOf(a.id) >= 0)))) || undefined;
              // v109: the men who were merely near the wrap close into the landing too (credit untouched)
              wrapInV109(c, G.sup.filter(id => G.joined.indexOf(id) < 0 && id !== dfd.id), G.hit.cid);
              /* ===== v153 A THE BALL IS SPOTTED WHERE HE GOT TO (forward progress) =====
               * A carrier the tackle drove BACKWARDS (v151 D's push, a pile that won the shove) used
               * to be spotted where he ended up — he lost the ground he had been driven through. The
               * rule is forward progress: the ball goes down at the furthest point his progress
               * reached, and where the pile carried him after that does not count. `G.fpLxV153A` is
               * that point (the grab, or further if he dragged them); when he lands more than
               * `fwdProgMinPxV153A` behind it, `endTackle` books the yards from it
               * (`c._fpSpotV153A`), the tackle carries `fpX` / `fpYd` for the official's spot, and
               * the picture keeps the real landing. Not for a quarterback taken down behind his own
               * line (a sack — he was going backwards anyway), and not for ground he GAVE (v153 A
               * GIVE GROUND ends the grip first). No roll. `TU("fwdProgV153A", 0)` / `TU("v153A", 0)`. */
              let fpV153A = null;
              if (TU("v153A", 1) && TU("fwdProgV153A", 1) && G.fpLxV153A != null) {
                const lostPx = (G.fpLxV153A - c.lx) * dsg, qbBehind = c.lb === "QB" && G.fpLxV153A * dsg <= TU("fwdProgQbLosPxV153A", 0);
                const Vfp = root.__V153A = root.__V153A || { rolls: 0, escapes: 0, fp: 0, fpYd: 0, fpSkipQB: 0, gangDown: 0, last: null };
                if (lostPx > TU("fwdProgMinPxV153A", 2)) {
                  if (qbBehind) Vfp.fpSkipQB++;
                  else { fpV153A = { fpX: G.fpLxV153A, fpYd: +(lostPx / YD).toFixed(2) }; c._fpSpotV153A = G.fpLxV153A; Vfp.fp++; Vfp.fpYd += lostPx / YD; }
                }
              }
              const downV153A = G.bigStick ? undefined : gangDownV153A(c, dfd.id, G.sup.concat(G.joined), !!G.gang, G.handsOn + G.joined.length);
              emit("tackle", { tackler: dfd.id, carrier: c.id, x: c.lx, y: c.y, ...(fpV153A || null), ...(downV153A ? { downV153A } : null),
                gang: !!G.gang, bigHit: G.bigStick || G.kb > 11, bothFall: G.bothFall,
                stayUp: G.stayUp && !G.joined.length, kb: Math.round(G.kb), drive: Math.round(G.drive),
                sup: G.sup.concat(G.joined), youIn, style: G.style, hitStick: G.bigStick,
                handsOn: G.handsOn + G.joined.length,
                dragged: true, dragMs: Math.round(age), dragYd: +dragYd.toFixed(2), strain: !!G.strain, horseCollar: !!G.hc,
                ...G.hit, ix: Math.round((c.lx + dfd.lx) * 5) / 10, iy: Math.round((c.y + dfd.y) * 5) / 10 });   // v109: the hit's id and normal, the landing's point
              c._grip = null; dfd._gripOn = null; c._wasGripped = true;
              endTackle(dfd);
              if (out) { out.dragYd = +dragYd.toFixed(2); out.strain = !!G.strain; out.dragMs = Math.round(age); }
              rec(); continue;
            }
            rec(); continue;
          }
        }
        const carryStartX=c.lx;
        const boundaryAtStart=c.y<=SIDELINE_TOP+TU("planeEpsilon",.05)?SIDELINE_TOP:
          c.y>=SIDELINE_BOT-TU("planeEpsilon",.05)?SIDELINE_BOT:null;
        // trench keeps resolving during ANY carry (YAC included)
        rushers.forEach(r => { if (!r.shed) {
          if(!r.engaging){r.shed=true;return;}
          // easier to disengage once the ball is past the trench, but still a contest
          const past = c.side==="off" && c.lx > 20;
          /* v103 THE TRENCH BREAKS UP — a lineman does not hold his block while the ball runs
           * away from him. Once the carrier is CLEARLY past the line of scrimmage there is
           * nothing left to block and nothing left to rush: the defender rips off on his own
           * clock and chases the ball, and the man who was blocking him lets go and goes
           * looking for somebody to hit downfield. Before v103 the pair stayed welded together
           * for the whole play, which is why the trench looked frozen while football happened
           * ten yards away. `disengage` is emitted for both halves so the broadcast shows the
           * release rather than two men who simply stop existing. */
          const gone = c.side==="off" && c.lx > TU("trenchBreakPx", 34);
          const pFactor = (kind==="run"?0.55:1) * (past?3:1) * (gone?TU("trenchBreakK",6):1);
          if (!r.shed) { const pr = cl(((r.str*0.55 + r.quick*0.45) - r.engaging.blk) * 0.00042 + 0.0035, 0.0008, 0.028) * pFactor * (r.doubled?0.32:1);
            if (Math.random() < pr) { r.shed = true; r.releaseT = t; emit("shed",{who:r.id});
              if (gone) emit("disengage", { who: r.id, by: r.engaging ? r.engaging.id : null, chase: true, x: r.lx, y: r.y });
              if (t < TU("holdFlagMs",900) && r.engaging && r.engaging.player) flagCand.hold = r.engaging.player; } }
        }});
        // v81: the blocks PLAY OUT — a won block drives the pair off the spot and
        // away from the hole, a lost one frees the rusher inside a quarter second,
        // and once the ball is past a lineman he lets go and looks for a job.
        if (kind === "run") blockers.forEach(o => {
          const r = o.engagedBy, b = o._blk;
          if (!r || r.shed || !b) return;
          if (b.kind === "lost" && t > b.t0 + TU("lostBlockMs", 250)) { r.shed = true; r.releaseT = t; emit("shed", { who: r.id }); return; }
          const age = Math.min(1, (t - b.t0) / TU("blockPlayMs", 850));
          const fwd = b.kind === "drive" ? TU("blockDrivePx", 20) : b.kind === "push" ? TU("blockPushPx", 9) : 2;
          const lat = b.kind === "drive" ? TU("blockDriveLat", 16) : b.kind === "push" ? TU("blockPushLat", 8) : 3;
          mv(o, b.x0 + fwd * age, clampY(b.y0 + b.dir * lat * age), b.kind === "stalemate" ? .25 : .6);
          if (c.side === "off" && c.lx > o.lx + TU("releasePastPx", 20) && !o._released) {
            o._released = t; r.shed = true; r.releaseT = t; o.engagedBy = null; emit("disengage", { who: r.id, by: o.id }); }
        });
        // carrier picks his path: best open lane (runs) or upfield (YAC/returns)
        const dirSign = c.side === "off" ? 1 : -1;
        let laneY = c.y;
        if (kind === "run" && c.lx < 8) {
          // v81: attack the DESIGNATED hole first; read from there only if it has
          // closed. A gap is closed when a live defender is standing in it — an
          // engaged lineman's man is not, he is being handled. The pick is held for
          // a beat so the back commits to a lane instead of flickering between two.
          if (c._laneUntil == null || t >= c._laneUntil) {
            // v82 THE BACK HAS EYES: a gap is judged by where the defenders WILL be — each
            // man's committed line projected a step ahead — not where they stand, and a
            // gap behind a blocker who has his man is the one to press
            const ahead = TU("lookaheadS", .1) + visionRadiusV96(c.vis) * TU("lookaheadPerYdV96", 0.012);   // v96: the read radius — every vision point from 75 reads a yard further down the line
            const liveIn = gy => S.def.some(a => { if ((a.stunned && t < a.stunned) || t <= (a.beaten||0) || (a.lb === "DL" && !a.shed) || t < (a.held||0)) return false;
              const px = a.lx + (a._dx||0) * (a.spd||120) * (a.vel||0) * ahead, py = a.y + (a._dy||0) * (a.spd||120) * (a.vel||0) * ahead;
              return px > -6 && px < 26 && Math.abs(py - gy) < TU("gapCloseY", 13); });
            const sealed = gy => S.def.some(a => t < (a.held||0) && Math.abs(a.y - gy) > 8 && Math.abs(a.y - gy) < 30 && a.lx > -4 && a.lx < 30);
            const gaps = [110,142,174,206,238,270,302,334].map(gy => ({ ly: gy, open: liveIn(gy) ? 0 : 1, home: gy === holeY ? 1 : 0, seal: sealed(gy) ? 1 : 0 }));
            const sorted = gaps.slice().sort((p,q) => (q.open - p.open) || (q.home - p.home) || (q.seal - p.seal) || (Math.abs(p.ly-c.y) - Math.abs(q.ly-c.y)));
            const home = gaps.find(g => g.home) || sorted[0];
            // vision: does he actually SEE the open lane, or guess?
            const sees = Math.random() < 0.38 + (c.vis-50)*0.008;
            const best = home.open ? home : (sees ? sorted[0] : gaps[Math.floor(Math.random()*gaps.length)]);
            if (!home.open && best !== home && sees && c._laneY != null && Math.abs(best.ly - c._laneY) > 20 && !c._pressed) {
              c._pressed = t; emit("press", { x: c.lx, y: c.y, from: home.ly, to: best.ly, direction: best.ly > home.ly ? 1 : -1 }); }
            c._laneY = best.ly + (Math.random()*8-4); c._laneUntil = t + TU("laneHoldMs", 200);
            // the lane lights up on what is there NOW (the projection is the back's read, not the picture)
            const openNow = !S.def.some(a => !(a.stunned && t < a.stunned) && t > (a.beaten||0) && !(a.lb === "DL" && !a.shed) && !(t < (a.held||0)) && a.lx > -6 && a.lx < 26 && Math.abs(a.y - holeY) < TU("gapCloseY", 13));
            if (!holeShown && openNow && c.lx > -30) { holeShown = true; emit("holeOpen", { x: 6, y: holeY, gap: holeGapKey, concept: runConcept }); }
          }
          laneY = c._laneY;
        } else laneY = clampY(c.y + Math.sin(t/300)*14);
        if (kind==="run" && !c._cut && c.lx > 4 && c.lx < 50) {
          const near = chasersNear(c);
          const above = near.filter(a=>a.y<c.y).length, below = near.filter(a=>a.y>=c.y).length;
          if (Math.abs(above-below) >= 2 && Math.random() < 0.3 + (c.vis-50)*0.005) {
            c._cut = true; laneY = clampY(c.y + (above>below?70:-70)); emit("cutback",{x:c.lx,y:c.y,direction:above>below?1:-1});
            // v29: defenders who bite on the cutback overshoot along their old pursuit line
            near.sort((p,q)=>Math.hypot(p.lx-c.lx,p.y-c.y)-Math.hypot(q.lx-c.lx,q.y-c.y)).slice(0,3).forEach((a,rank)=>{
              const moveIQ=c.agi*.45+c.quick*.55, defendIQ=a.aware*.55+a.disc*.45;
              const biteP=cl(.14+(moveIQ-defendIQ)*.008-rank*.045,.035,.62);
              if(Math.random()<biteP){const delay=Math.round(cl(260+(moveIQ-defendIQ)*3.2,180,540));
                a.beaten=t+delay; a._osUntil=t+Math.min(delay,TU("overshootMs",420)); a._osdx=a._dx||0; a._osdy=a._dy||0;
                emit("badAngle",{who:a.id,x:a.lx,y:a.y,reason:"cutback",delay});} });
          }
        }
        // A successful contact juke now changes the runner's actual lane, not just
        // the sprite animation. The plant lasts briefly and then releases back to
        // normal path-finding, so it can shake a poor angle without becoming a
        // permanent sideline sprint.
        if(c._jukeUntil&&t<c._jukeUntil)laneY=c._jukeY;
        const hole = kind==="run" && c.lx > -8 && c.lx < 24;
        // v16.1: springing clean into the open field. Once the back clears the
        // line with no defender in his immediate area, he turns it upfield and
        // only the deep help can run him down — this is where medium gains and
        // breakaways come from (the missing 6-24 yard middle of the run curve).
        if (kind==="run" && c.lx > 24 && !c._sprang) {
          const near = S.all.filter(a=>a.side!==c.side && a.lb!=="OL" && t>(a.beaten||0)
            && Math.hypot(a.lx-c.lx, a.y-c.y) < 46);
          if (!near.length) { c._sprang = true; c.burstUntil = t + 700; kickSprint(c); emit("spring",{x:c.lx,y:c.y}); }
        }
        // v16.2 behavioral evasion: an elusive back bends his path AWAY from the
        // nearest closing defender to avoid getting wrapped — the setup that buys
        // the whiff. Straight-line runners (low agility) can't shake free.
        if (c.lx > 1) {
          let nb=null, nd=1e9;
          for (const a of chasersNear(c)) { if (t<(a.beaten||0)||(a.trucked&&t<a.trucked+900)) continue;
            const dd=Math.hypot(a.lx-c.lx,a.y-c.y); if(dd<nd){nd=dd;nb=a;} }
          if (nb && nd < 34) {
            const elus = c.agi*0.5 + c.quick*0.5;
            const dodge = cl((elus-48)*0.02, 0, 1.15) * (nb.y >= c.y ? -1 : 1);
            laneY = clampY(laneY + dodge * (34-nd));
            if (nd < 48 && c.lx > 4) kickSprint(c);            // a defender is closing — kick the sprint
          }
          // v41 SIDELINE ECONOMY: strung out wide with the angle LOST — the nearest
          // defender leveraged upfield-inside with a closing gap and the wheels to
          // meet him — the runner takes what's there and steps out of bounds
          // instead of cutting back into the pursuit or dragging a pile.
          if (nb && c._oobBail === undefined && Math.abs(c.y - MIDY) > TU("oobWideY", 116) && c.lx > 6
              && nd < TU("oobGap", 46) && nb.lx > c.lx - 4
              && Math.abs(nb.y - MIDY) < Math.abs(c.y - MIDY) - 8
              && nb.spd > c.spd - TU("oobSpdMargin", 5))
            c._oobBail = Math.random() < TU("oobBailP", 0.55);
          if (c._oobBail) laneY = c.y < MIDY ? SIDELINE_TOP - 4 : SIDELINE_BOT + 4;
        }
        // sprint = the visible +20% burst; the old daylight jet is now a small tail
        const catchStride=t<(c._catchRunThroughUntil||0)?(c._catchStrideBoost||0):0;
        const jets = (sprinting(c) ? SPRINT_BOOST : (t < (c.burstUntil||0) ? 0.10 : 0)) + catchStride;
        // v81: on a designed run the back has a running start to the hole — no jog to the line
        const toHole = kind === "run" && c.lx < -8 ? TU("backfieldPace", 1.0) : 0.9;
        /* ===== v109 THE FEET PLANT — the gather, the plant, the carrot that scales =====
         * The back re-read his lane every laneHoldMs and `mv` steered into the new one at full
         * gear the same tick, so a 60px jump between gaps looked like a slide. Now a lane that
         * moves by more than plantLaneDeltaPx is a PLANT: he gathers for plantGatherTicks at
         * plantGatherMult of his gear, the event goes out (`plant`, with where he was aiming and
         * where he is aiming now, the angle of the change and whether it was a hard one), and
         * the exit burst that follows (plantExitBurstMs of the ordinary +0.10 jet) gives the
         * ground back, so the mean yard is where it was. The carrot he steers on scales with
         * his gear: a man still gathering speed can turn tighter, so his aim point is closer
         * and the curve into the lane is sharper — at top gear the carrot is the old 56px, so
         * the forward component of every full-speed carry is unchanged. */
        let gear9 = cl((hole?1.12:toHole) + jets + (c.burst-50)*0.004, 0.72, 1.5);
        if (c._laneAimV109 != null && c.lx > TU("plantMinLx", -30) && Math.abs(laneY - c._laneAimV109) > TU("plantLaneDeltaPx", 24) && t >= (c._plantCoolV109||0)) {
          const ddx = dirSign*TU("carryAimAhead", 56), ddy = laneY - c.y, dn = Math.hypot(ddx, ddy) || 1;
          const dot = (c._dx == null ? dirSign : c._dx)*ddx/dn + (c._dy||0)*ddy/dn, deg = Math.round(Math.acos(cl(dot, -1, 1))*180/Math.PI);
          c._gatherUntil = t + TU("plantGatherTicks", 2)*TICK; c._plantCoolV109 = t + TU("plantGapMs", 300);
          c.burstUntil = Math.max(c.burstUntil||0, c._gatherUntil + TU("plantExitBurstMs", 100));   // the exit burst pays the gather back
          emit("plant", { who: c.id, x: Math.round(c.lx), y: Math.round(c.y), fromY: Math.round(c._laneAimV109), toY: Math.round(laneY),
            deg, hard: deg > TU("plantHardDeg", 40), vel: Math.round((c.vel||0)*100)/100 });
        }
        c._laneAimV109 = laneY;
        if (c._gatherUntil && t < c._gatherUntil) gear9 *= TU("plantGatherMult", .8);
        const carrot9 = TU("carryAimAhead", 56) * cl(TU("carrotBase", .55) + TU("carrotVelK", .75)*(c.vel||0), TU("carrotMin", .55), 1);
        const esc153 = c._escV153A && t < c._escV153A.until ? c._escV153A : null;   // v153 A GIVE GROUND: he backs out of the pile, then turns it up
        if (esc153) mv(c, c.lx - dirSign * TU("escapeBackPxV153A", 30), clampY(c.y + esc153.side * TU("escapeLatPxV153A", 22)), TU("escapePaceV153A", .75));
        else mv(c, c.lx + dirSign*carrot9, laneY, gear9);
        // A catch/return secured on the boundary is dead at that possession
        // point. It has no incoming carry segment this tick, so preserve the
        // exact spot explicitly instead of letting the runner turn back infield.
        if(boundaryAtStart!=null&&!c._sidelineCross)c._sidelineCross={x:carryStartX,y:boundaryAtStart};
        // defense pursues with lead angles; contacts roll tackle contests
        // climbing linemen wall off linebackers (shed contests apply)
        /* v103 THE LINE BLOCKS FOR HIM — v81's "find a job" only ran on a called RUN and only
         * ever looked for the body nearest the LINEMAN, so on a catch-and-run five offensive
         * linemen stood at the line watching, and on a run they blocked whoever happened to be
         * closest rather than the man about to make the tackle. Now the whole front works on
         * any carry the offence has, and the job is chosen by who THREATENS THE CARRIER —
         * distance to the ball, weighted ahead of distance to the blocker — which is what a
         * lineman climbing to the second level is actually looking at. Sustained blocks report
         * `block` on a heartbeat so the broadcast can hold the engagement instead of flickering. */
        if (c.side === "off") blockers.forEach(o => {
          if (o === c) return;
          if ((!o.climb || o.climb.shed2 || (o.climb.stunned && t < o.climb.stunned)) && !(o.engagedBy && !o.engagedBy.shed)) {
            let tgt = null, best = TU("climbScoreMax", 150);
            for (const a of S.def) { if (a.lb === "DL" && !a.shed) continue;
              if ((a.stunned && t < a.stunned) || a.shed2 || a._climbedBy) continue;
              if (a.lx < c.lx - TU("climbBehindPx", 12)) continue;                       // behind the ball: not a job
              const toBall = Math.hypot(a.lx - c.lx, a.y - c.y), toMe = Math.hypot(a.lx - o.lx, a.y - o.y);
              if (toMe > TU("climbReachPx", 92)) continue;
              const score = toBall * TU("climbBallW", 1.6) + toMe * TU("climbSelfW", .55);
              if (score < best) { best = score; tgt = a; } }
            if (tgt) { o.climb = tgt; tgt._climbedBy = o.id; }
            else mv(o, c.lx + 14, o.y + (c.y - o.y) * .5, .55);                           // no job: get out in front of him
          }
          if (o.climb && !o.climb.shed2 && !(o.climb.stunned && t < o.climb.stunned)) {
            // get between the man and the ball, not merely next to him
            const bx = o.climb.lx - Math.sign(o.climb.lx - c.lx || 1) * 7, by = o.climb.y + Math.sign(o.climb.y - c.y || 1) * 2;
            mv(o, bx, by, TU("climbPace", .72));
            if (Math.hypot(o.lx-o.climb.lx, o.y-o.climb.y) < 16) {
              const pshed = cl(((o.climb.str*0.6+o.climb.agi*0.4) - o.blk) * 0.0005 + 0.006, 0.001, 0.05);
              if (Math.random() < pshed) { o.climb.shed2 = true; o.climb.engagedBy = null; o.climb._climbedBy = null; emit("disengage", { who: o.climb.id, by: o.id, x: o.lx, y: o.y }); }
              else {
                if (!o.climb.held) emit("block", { by: o.id, on: o.climb.id, x: o.lx, y: o.y });
                else if (t > (o._blkSay || 0)) { o._blkSay = t + TU("blockSayMs", 260); emit("block", { by: o.id, on: o.climb.id, x: o.lx, y: o.y, sustain: true }); }
                o.climb.held = t + 60;
                // he is driving him off the ball: the pair walks away from the carrier's lane
                mv(o.climb, o.climb.lx + (o.climb.lx - c.lx > 0 ? 6 : -6), o.climb.y + (o.climb.y - c.y > 0 ? 5 : -5), .3);
              }
            }
          }
        });
        function chasersNear(cc){ return S.all.filter(a=>a.side!==cc.side && (a.lb!=="OL" || isKick) && Math.hypot(a.lx-cc.lx,a.y-cc.y)<90); }
        const chasers = S.all.filter(a=>a.side!==c.side && (a.lb!=="OL" || isKick) && !(isKick && a === S.off[8] && kind !== "kickoff"));
        // v82: a kick return ends at the returner's goal line
        if (isKick && kickOpts.goalLx != null && c.side === "def" && c.lx <= kickOpts.goalLx) {
          out = { kind, yards: 0, ret: Math.round(((c._catchLx||0) - c.lx) / YD), td: true, spotLx: c.lx }; done = true; emit("td", { x: c.lx, y: c.y, carrier: c.id }); }
        const walls = blockers.filter(o=>o.engagedBy && !o.engagedBy.shed);
        // the committer may have been beaten/trucked/whiffed — free up the role.
        // v81: or he simply FELL OFF — a man who committed from launch range and then
        // lost ground (a released lineman trailing the play) must not hold the role,
        // because the support rule holds everyone else a stride off the carrier.
        if (committerId && (function(){const cm=A_all[committerId]; return !cm || t<(cm.beaten||0) || (cm.trucked&&t<cm.trucked+900)
          || Math.hypot(cm.lx-c.lx, cm.y-c.y) > TU("commitDropGap", 30) || t > (committerAt||0) + TU("commitMaxMs", 650);})()) committerId = null;
        // the single nearest pursuer is the one who kicks a sprint to run him down
        let nearestChaser=null, nearestGap=1e9, lastMan=null;
        for (const a of chasers) { if (t<(a.beaten||0)||(a.trucked&&t<a.trucked+900)||(a.stunned&&t<a.stunned)||(a.lb==="DL"&&!a.shed)) continue;
          const g2=Math.hypot(a.lx-c.lx,a.y-c.y); if(g2<nearestGap){nearestGap=g2;nearestChaser=a;}
          if(!lastMan||a.lx*dirSign>lastMan.lx*dirSign) lastMan=a; }   // v30: the deepest live defender is the LAST MAN (v82: in the carrier's direction)
        /* ===== v109 THE FEET PLANT — down men go down =====
         * A trucked or pancaked man used to `continue` on the pixel he was flattened on for
         * 900 / 1800ms and then resume at full pursuit — a freeze, then a teleport back into
         * the play. He now slides a decaying downSlidePx along his overshoot vector (a trucked
         * man on along the carrier's line, a pancaked one back the way he came) over the first
         * downSlideMs, and the sim says so ONCE: `down {who, x, y, until, cause, dx, dy}` so the
         * renderer can drop him with the fall frames, face him along the slide and have him
         * off the turf at the same clock the sim does. He is still no one's tackler and still
         * out of every read while he is down, so no outcome moves. */
        const downSlideV109 = (d, cause, cc) => {
          const t0 = cause === "truck" ? d.trucked : (d._stunAtV109 == null || d._stunAtV109 > t ? (d._stunAtV109 = t) : d._stunAtV109);
          const until = cause === "truck" ? d.trucked + 900 : d.stunned;
          if (d._downAnnV109 !== t0) { d._downAnnV109 = t0;
            const vx = cause === "truck" ? (cc._dx||0) : -(d._dx||0), vy = cause === "truck" ? (cc._dy||0) : -(d._dy||0), vn = Math.hypot(vx, vy) || 1;
            d._downDxV109 = vx/vn; d._downDyV109 = vy/vn;
            emit("down", { who: d.id, x: Math.round(d.lx), y: Math.round(d.y), until: Math.round(until), cause,
              dx: Math.round(d._downDxV109*100)/100, dy: Math.round(d._downDyV109*100)/100 }); }
          const ms = TU("downSlideMs", 200), age = t - t0;
          if (age < ms) { const k = (1 - age/ms) * TU("downSlidePx", 5) * 2 * TICK / ms;   // a slide that decays to nothing; its integral is downSlidePx
            d.lx += d._downDxV109 * k; d.y = clampY(d.y + d._downDyV109 * k); }
        };
        for (const dfd of chasers) {
          if (t < (dfd.beaten||0)) {
            // v29 OVERSHOOT: a beaten man doesn't freeze — his momentum carries him past
            // the move that beat him before he can gather himself and re-pursue.
            /* ===== v151 D HE FINDS HIS FEET (the beaten man) =====
             * The overrun used to run at full pace to the last tick and then stop dead, and the
             * man stood frozen until `beaten` ran out and he reversed in one tick. Now the overrun
             * BRAKES (pace falling to `overrunEndPaceV151D` by its end) and the rest of the beat is
             * the plant and turn: he swings back toward the carrier at a walk (`plantTurnPaceV151D`)
             * before he can pursue again. Kill switch `TU("recoverV151D", 0)`. */
            const rcv151 = !!TU("recoverV151D", 1);
            if (dfd._osUntil && t < dfd._osUntil && (dfd._osdx || dfd._osdy)) {
              if (dfd._osKeyV151 !== dfd._osUntil) { dfd._osKeyV151 = dfd._osUntil; dfd._osT0V151 = t; }   // a new overrun starts its own clock
              const left = rcv151 ? cl((dfd._osUntil - t) / Math.max(1, dfd._osUntil - dfd._osT0V151), 0, 1) : 1;
              mv(dfd, dfd.lx + dfd._osdx*34, clampY(dfd.y + dfd._osdy*34), TU("overshootPace",1.0) * (rcv151 ? TU("overrunEndPaceV151D", .35) + (1 - TU("overrunEndPaceV151D", .35)) * left : 1));
            } else if (rcv151) mv(dfd, c.lx, c.y, TU("plantTurnPaceV151D", .3));
            continue;
          }
          if (dfd.trucked && t < dfd.trucked + 900) { downSlideV109(dfd, "truck", c); continue; }     // flattened: he's on the ground (v109: sliding, then still)
          if (dfd.stunned && t < dfd.stunned) { downSlideV109(dfd, "pancake", c); continue; }         // pancaked: on the ground
          for (const wblk of walls) {
            if (dfd === wblk.engagedBy) continue;
            if (Math.hypot(dfd.lx-wblk.lx, dfd.y-wblk.y) < 15) { dfd.y += (dfd.y > wblk.y ? 1 : -1) * 2.2; dfd.y = clampY(dfd.y); }
          }
          if (!isKick && dfd.lb==="DL" && !dfd.shed) { mv(dfd, dfd.engaging.lx+6, dfd.engaging.y, 0.18); continue; }   // still blocked: fight, don't fly
          if (isKick && t < (dfd.held||0)) { mv(dfd, c.lx, c.y, 0.16); continue; }                                   // v82: a return blocker has him
          if (kind==="run") {
            // v81: a blocker with his hands on him — walled off until he sheds
            if (t < (dfd.held||0)) { mv(dfd, c.lx, c.y, 0.16);
              // a blocked man can still fall off the block onto a runner who comes THROUGH him
              const _heldGapV110 = Math.hypot(dfd.lx-c.lx, dfd.y-c.y);
              const _heldCmGapV110 = (committerId && committerId !== dfd.id && A_all[committerId])
                ? Math.hypot(A_all[committerId].lx-c.lx, A_all[committerId].y-c.y) : 1e9;   // v110: a held man who is CLOSER than the committer still gets his hands on him
              if (_heldGapV110 < TU("heldReachPx", 17) && (!committerId || committerId===dfd.id || _heldGapV110 < _heldCmGapV110 - TU("commitTakePx", 3))) {
                committerId = dfd.id; const r = contact(dfd, c); if (r === "grip") break; if (r === "tackle") { endTackle(dfd); break; } }   // v103: a grip hands the carrier to the grip tick
              continue; }
            // v81: until he has FOUND the ball he plays his assignment, not the carrier.
            // A linebacker holds his gap with a read step (a bitten one on a draw is
            // still dropping into coverage), the safety stays over the top, the corner
            // stays with his receiver, a freed rusher chases what he can see.
            if (!seesBall(dfd)) {
              if (dfd.lb==="LB") {
                if (dfd._bite) mv(dfd, TU("lbDropLx", 36), dfd.y, 0.55);
                else mv(dfd, TU("lbReadLx", 40) + Math.sin(t/140)*3, dfd.y, 0.3);   // read step: downhill, gap held
              }
              else if (dfd.lb==="S") mv(dfd, Math.max(dfd._bite ? 72 : 60, dfd.lx), dfd.y + (S.off[9].y - dfd.y) * .35, 0.4);   // keys the back's flow, stays over the top
              else if (dfd.lb==="CB") {
                // the force player squats on the edge (an assignment, not a read); a corner
                // inside the numbers stays on his receiver
                if (Math.abs(dfd.y - MIDY) > TU("containWideY", 46)) mv(dfd, TU("cbForceLx", 14), dfd.y, 0.5);
                else { const w = S.off.filter(x=>["WR","TE"].includes(x.lb))
                  .sort((p,q)=>Math.hypot(p.lx-dfd.lx,p.y-dfd.y)-Math.hypot(q.lx-dfd.lx,q.y-dfd.y))[0];
                  if (w) mv(dfd, Math.max(dfd.lx, w.lx + 6), w.y, 0.6); } }
              else mv(dfd, c.lx, c.y, 0.5);
              continue;
            }
            // v81 THE FIT: a linebacker who has read run fills his gap at the line first —
            // downhill, on his side of the ball — and only once the ball crosses does he
            // chase it. That is the "then they attack" the read step sets up.
            // He TRIGGERS out of the fit once the back is on him — a linebacker who waits
            // flat-footed in the hole gets run over; one who meets him with a running
            // start does not.
            if (dfd.lb==="LB" && c.lx < TU("lbFitUntilLx", 0) && !(c.lx > TU("fitTriggerLx", -8) && Math.hypot(c.lx-dfd.lx, c.y-dfd.y) < TU("fitTriggerGap", 44))) {
              mv(dfd, TU("lbFitLx", 14), clampY(c.y * .55 + dfd.y * .45), 0.85); continue;
            }
            // v30 SAFETY ROOF: the deep safety never outruns his responsibility — until
            // the carrier is genuinely through the second level he stays a cushion
            // DEEPER than the ball, shading toward it, so a sprung run meets one more
            // hat instead of an empty field.
            // v81: the roof is ACTIVE now — he keeps his depth on the ball but comes
            // downhill to fill the alley at speed, so a back through the second level
            // meets a safety on the move, not one flat-footed at the 15.
            if (dfd.lb==="S") {
              // the play-side safety FILLS the alley; the other one is the roof — he keeps
              // a cushion deeper than the ball until the runner is genuinely through
              if (dfd._roof === undefined) { const other = S.def.find(a=>a.lb==="S"&&a!==dfd);
                dfd._roof = !!other && Math.abs(dfd.y-holeY) > Math.abs(other.y-holeY); }
              if (!dfd._roof && c.lx < TU("safetyRoofLx", 6)) {
                mv(dfd, Math.max(TU("safetyFillLx", 30), c.lx + TU("safetyCushion", 26)), c.y + (dfd.y > c.y ? 12 : -12), TU("safetyFillPace", 1.0)); continue; }
              if (dfd._roof && c.lx < TU("roofLx", 50)) {
                mv(dfd, Math.max(56, c.lx + TU("roofCushion", 40)), c.y + (dfd.y > c.y ? 14 : -14), TU("roofPace", .85)); continue; }
            }
          }
          let lead = Math.min(0.35, Math.hypot(c.lx-dfd.lx,c.y-dfd.y)/Math.max(40,dfd.spd)*0.6);
          // v29 PURSUIT IQ: awareness sizes up the intercept point, discipline holds the
          // angle. Each defender rolls ONE signed angle error per play, scaled by how far
          // his IQ falls short — elite defenders run near-perfect lines every rep; low-IQ
          // defenders either overrun the spot (aim too far ahead) or take a chase angle
          // (aim at where the carrier WAS), plus a lateral misjudgment that fades as the
          // gap closes so a bad angle costs ground without looking like blindness.
          if (dfd._angErr == null) {
            const iq = dfd.aware*0.55 + dfd.disc*0.45;
            const mag = Math.max(0, 58 - iq) * TU("angleErrK",0.017);
            dfd._angErr = (Math.random()*2-1) * mag;
            dfd._angLat = (Math.random()*2-1) * mag * TU("angleLatPx",26);
          }
          // v30 LAST-MAN RULE: the deepest defender keeps everything in front of him —
          // he runs the textbook angle no matter his ratings, so a busted pursuit
          // upfield doesn't automatically become a walk-in touchdown.
          const isLastMan = dfd === lastMan;
          if (!isLastMan) {
            if (dfd._angErr >= 0) lead *= 1 + dfd._angErr;                     // overruns the intercept
            else lead *= Math.max(0.2, 1 + dfd._angErr);                        // late read: chases the body
            lead *= 1 + Math.max(0, 50-dfd.disc)*0.012;          // discipline: overpursuit takes bad angles
          }
          const gap = Math.hypot(c.lx-dfd.lx, c.y-dfd.y);
          // SOLO look: while one defender is committed to the tackle and the
          // carrier hasn't broken free, other pursuers close but hold a step off
          // the pile instead of swarming — support within range still counts
          // toward an assisted (gang) tackle inside contact(), but we don't get
          // 5-man cartoon piles on every stop.
          // v30 EDGE CONTAIN / GAP INTEGRITY: wide defenders don't just run at the ball —
          // while the carrier is still in the box they hold OUTSIDE leverage (a spot
          // upfield on their shoulder), stringing sweeps out and funneling the runner
          // back inside to the pursuit. Low discipline abandons the assignment and
          // chases; once the carrier clears the box or beats them wide, contain is off
          // and they attack like everyone else.
          if (kind === "run" && dfd._contain === undefined)
            dfd._contain = dfd.lb !== "DL" && Math.abs(dfd.y - MIDY) > TU("containWideY", 46) ? (dfd.y > MIDY ? 1 : -1) : 0;
          if (dfd._contain) {
            const outsideGap = Math.abs(dfd.y - MIDY) - (c.y - MIDY) * dfd._contain;
            if (c.lx < TU("containLxMax", 22) && outsideGap > 6) {
              mv(dfd, Math.max(dfd.lx, c.lx + TU("containDepth", 10)), clampY(c.y + dfd._contain * TU("containWide", 16)), 0.8);
              if (Math.random() < Math.max(0, 50 - dfd.disc) * 0.001) dfd._contain = 0;   // undisciplined: crashes inside
              continue;
            } else dfd._contain = 0;                       // he's through, or bounced outside past me — attack
          }
          const otherCommitted = committerId && committerId!==dfd.id;
          // v81: support holds a step off only behind a committer who is actually
          // CLOSER to the ball — a man trailing the play does not own the tackle
          const cmGap = otherCommitted ? (function(){const cm=A_all[committerId]; return cm ? Math.hypot(cm.lx-c.lx, cm.y-c.y) : 1e9;})() : 1e9;
          if (root.__V81_TRACE && gap < 40) root.__V81_TRACE.push({ t, id: dfd.id, gap: Math.round(gap), committer: committerId, aim: [Math.round(dfd._aimX||0), Math.round(dfd._aimY||0)], vel: +(dfd.vel||0).toFixed(2), cool: dfd.cool > t });
          /* ===== v110 THE MAN WHO IS THERE — support never holds the closest man =====
           * The hold read `gap > cmGap - 4`, so a defender up to four pixels CLOSER to the ball
           * than the committed man still settled into a support spot and watched. Measured over
           * 660 stops, the man who made the tackle was not the nearest defender 37% of the time.
           * He holds now only if he is genuinely farther off than the committer, and a man who is
           * already on top of the ball is never held at all. */
          if (otherCommitted && gap < TU("supportHold",26) && gap > cmGap + TU("supportHoldEdgePx", 0)
              && gap > TU("supportNeverHoldPx", 12)) {
            // v29: support settles into a leverage spot a full stride off the tackle —
            // he's there to clean up a break, not to pile on. Solo stops stay solo.
            /* v109 THE FEET PLANT — the support FANS. Every support man aimed at one of two spots
             * (fourteen back, eight either side) and they stacked on it. Each now holds on his OWN
             * approach ray to the ball, at supportRayPx plus a stride per man, so three men in
             * support are three men around the tackle, not one heap behind it. */
            const ang9 = Math.atan2(dfd.y - c.y, dfd.lx - c.lx);
            /* v110: support CLOSES, it does not park. The ring was a fixed standoff, so a man two
             * yards off the ball stood on his spot and watched the tackle happen in front of him —
             * the thing that reads as a defender in position doing nothing. The longer the committer
             * has had hold, the tighter the ring draws, and he is moving the whole time; the floor
             * keeps him just outside contact range so this stays a picture, not a second tackler. */
            const tight9 = cl((t - (committerAt || t)) / TU("supportCloseMs", 400), 0, 1);
            const r9 = Math.max(TU("supportFloorPx", 12),
              (TU("supportRayPx", 14) + (Math.max(0, chasers.indexOf(dfd)) % 3) * TU("supportRayStep", 6))
              * (1 - tight9 * TU("supportCloseK", .45)));
            mv(dfd, c.lx + Math.cos(ang9)*r9, clampY(c.y + Math.sin(ang9)*r9), TU("supportPace", .3) + tight9 * TU("supportClosePace", .35));
            continue;
          }
          let beatenPace = gap > 62 && c.spd > dfd.spd + 6 ? 0.9 : 1;
          // v22: a defender who is TRAILING a faster carrier can't rubber-band back.
          // If the offense gets BEHIND the defense they get a real shot at the end
          // zone — no catch-up sprint "out of nowhere" on a footrace he'd lose.
          const _trailing = c.side==="off" ? dfd.lx < c.lx-4 : dfd.lx > c.lx+4;
          const _canRunDown = dfd.spd >= c.spd - (isLastMan ? 9 : 5);   // the last man's angle beats raw speed
          if (isLastMan && gap < 170) beatenPace += 0.15;         // v30: the free safety breaks downhill NOW
          if (_trailing && !_canRunDown) beatenPace = Math.min(beatenPace, 0.9);
          // v82 EFFORT: a man who has lost the footrace, or is on the far side of the
          // field with the ball going away, JOGS — a real broadcast is full of it. A
          // tired man (empty tank) is a step slow everywhere. The last man never quits.
          const behindPlay = _trailing && !_canRunDown && gap > TU("jogGap", 95);
          const farSide = Math.abs(dfd.y - c.y) > TU("farSideY", 150) && gap > 90 && dfd !== nearestChaser;
          if ((behindPlay || farSide) && !isLastMan) { beatenPace = Math.min(beatenPace, TU("jogPace", .55));
            if (!dfd._jogAnn) { dfd._jogAnn = 1; emit("effort", { who: dfd.id, kind: behindPlay ? "givesUp" : "jog", x: dfd.lx, y: dfd.y }); } }
          // v109 THE FEET PLANT — the jog RESUMES. `_jogAnn` latched forever, so a man the play cut
          // back into made the tackle in the jog animation. Once he is back in it (inside
          // resumeGap, or the nearest man, or the last one) the latch clears and `effort
          // {kind:"resume"}` goes out. The pace itself never read the latch; nothing moves.
          else if (dfd._jogAnn && (gap < TU("resumeGap", 70) || dfd === nearestChaser || isLastMan)) { dfd._jogAnn = 0; emit("effort", { who: dfd.id, kind: "resume", x: dfd.lx, y: dfd.y }); }
          if (dfd.gas !== undefined && dfd.gas < TU("tiredGas", 35)) beatenPace *= TU("tiredPace", .92);
          // nearest pursuer kicks a sprint only to run DOWN a breakaway on a real
          // ANGLE (or when genuinely fast enough) — never a pure trailing footrace.
          if (dfd===nearestChaser && gap>46 && gap<140 && (_canRunDown || !_trailing)) kickSprint(dfd);
          if (sprinting(dfd)) beatenPace += SPRINT_BOOST;
          // v17 TACKLE LAUNCH — a committing defender leaps from ~50% further out.
          // If he's within launch range (gap < ~19, was 13) he LUNGES the last stretch:
          // the burst carries him in and contact() commits from there, so the stop reads
          // as a real launch into the ball-carrier. The airborne hop is added scene-side
          // on the tackleLunge that contact() emits for every commit.
          if (dfd._leapUntil && t < dfd._leapUntil) beatenPace += 1.4;    // the dive carries him in — v19: bigger launch
              if (dfd.player && dfd.player.you) beatenPace += 0.07;      // v18: YOUR player has a nose for the ball
          const latErr = isLastMan ? 0 : (dfd._angLat||0) * Math.min(1, gap/60);   // v29: lateral aim error, gone at contact range
          // v81 COMMITTED LINE: he picks an intercept point and RUNS HIS LINE to it,
          // re-reading the carrier on a clock set by awareness instead of every tick.
          // Against a cut or a bounce the stale point is the bad slant you can see;
          // inside contact range everyone reads every tick, so the wrap itself is
          // unchanged. The last man always plays it straight.
          const refresh = cl(TU("angleRefreshMs", 220) - (dfd.aware-50)*3 - (dfd.quick-50)*1.2, 90, 520);
          if (dfd._aimUntil == null || t >= dfd._aimUntil || gap < TU("angleLockGap", 28) || isLastMan) {
            dfd._aimX = c.lx + (c._dx||0)*c.spd*lead; dfd._aimY = clampY(c.y + (c._dy||0)*c.spd*lead + latErr);
            dfd._aimUntil = t + refresh;
          }
          mv(dfd, dfd._aimX, dfd._aimY, beatenPace);
          const gapNow = Math.hypot(dfd.lx-c.lx, dfd.y-c.y);
          /* v143: the WATCH WINDOW. The gather and the angle both belong to the approach, so they
           * open well before the commit — from `tackleLaunchDist` there is only ~54ms left (measured),
           * which is less than any man needs to break down, and the angle read there is noise. He
           * loses both if the carrier gets away from him again. */
          if (gapNow < TU("windupWatchPxV143", 64)) {
            if (dfd._closeV143 == null || dfd._watchOnV143 !== c.id) {
              dfd._closeV143 = t; dfd._watchOnV143 = c.id; dfd._angQV143 = angleQV143(dfd, c, gapNow);
            }
          } else if (gapNow > TU("windupWatchPxV143", 64) * TU("windupDropKV143", 1.6)) {
            dfd._closeV143 = null; dfd._watchOnV143 = null; dfd._angQV143 = null;
          }
          // v19 TACKLE LAUNCH — from ~2 sprite-lengths out (tackleLaunchDist) the
          // committer LEAPS: the dive carries him the last stretch so contact resolves
          // from a real launch into the grab, not a step-in wrap.
          const launchAt = TU("tackleLaunchDist", 30);
          /* v110: the commit is handed over to whoever is actually CLOSEST, measured now (after the
           * step), not to whoever claimed it first. `commitMinVel` still keeps a trailing lineman
           * from claiming the tackle from range — but it no longer stops a man who is standing in
           * the hole the carrier is running into, because a stationary man in the gap is the most
           * in-position defender on the field. */
          const cmGapNow = (function(){ const cm = otherCommitted ? A_all[committerId] : null;
            return cm ? Math.hypot(cm.lx-c.lx, cm.y-c.y) : 1e9; })();
          const takeoverV110 = otherCommitted && gapNow < cmGapNow - TU("commitTakePx", 3);
          if (takeoverV110 && committerId !== dfd.id) V110.takeovers++;
          if (gapNow < launchAt && (!committerId || committerId===dfd.id || takeoverV110)
              && ((dfd.vel||0) >= TU("commitMinVel", .35) || takeoverV110 || gapNow < TU("contactAnyPx", 11))) {
            if (committerId !== dfd.id) committerAt = t;
            committerId = dfd.id;
            if (!dfd._leaped) { dfd._leaped = t; dfd._leapUntil = t + 400; }
          }
          // the grab/collision itself resolves once he's actually on the carrier
          /* v110: and a defender the carrier runs INTO makes the play whether or not he owns the
           * commit. Only the committer could resolve contact, so a man a yard and a half off the
           * ball — inside `contactAnyPx` — did nothing at all: 25% of defenders who got within a
           * yard and a half of the ball never appeared in a single contact event. */
          const inHisLapV110 = gapNow < TU("contactAnyPx", 11);
          if (inHisLapV110 && committerId !== dfd.id) V110.laps++;
          if ((gapNow < TU("tackleGrabDist", 16) && committerId===dfd.id) || inHisLapV110) {
            if (committerId !== dfd.id) { committerId = dfd.id; committerAt = t; }
            const r = contact(dfd, c);
            if (r === "grip") break;                     // v103: he has hold of him — the grip tick takes it from here
            if (r === "tackle") { endTackle(dfd); break; }
            // whiff / stiffarm / broken / stagger / cooldown: carrier stays up, play continues
          }
        }
        // sidelines end the play at the first point the movement segment touches
        // the plane — v30: credit only a defender actually close enough to have
        // forced him out, never a random slot across the field
        if (!done && c._sidelineCross) {
          const boundary=c._sidelineCross; c.lx=boundary.x; c.y=boundary.y;
          const push = chasers.filter(a=>Math.hypot(a.lx-c.lx,a.y-c.y)<TU("tackleCreditPx",20))
            .sort((p,q)=>Math.hypot(p.lx-c.lx,p.y-c.y)-Math.hypot(q.lx-c.lx,q.y-c.y))[0];
          emit("tackle",{tackler:push?push.id:null, carrier:c.id, x:boundary.x, y:boundary.y, oob:true, plane:"sideline"});
          done = true; if (isKick) out = { kind, yards: 0, ret: Math.round(((c._catchLx||0) - c.lx) / YD), spotLx: c.lx }; else if (!out) out = { kind, yards: Math.round(c.lx/YD) };
        }
        // v82: the return team forms in front of the returner
        if (isKick && c.side === "def") S.def.forEach(o => { if (o === c) return;
          if (!blockTick(o, chasers.filter(a => a.lx * dirSign > c.lx * dirSign - 12), 110)) mv(o, c.lx + dirSign * 24, o.y + (c.y - o.y) * .4, .7); });
        // offense blockers escort — v81: on a run the receivers STALK-BLOCK the man
        // in front of them instead of jogging alongside the play
        S.off.forEach(o=>{ if(o===c || o.lb==="OL" || c.side!=="off") return;
          if (kind === "run" && ["WR","TE"].includes(o.lb) && o.lb === "WR" && Math.sign(o.y - MIDY) !== Math.sign(holeY - MIDY) && c.lx < 20) {
            mv(o, o.lx + 40, o.y, 0.8); return; }                                    // backside: run the corner off
          if (kind === "run" && ["WR","TE"].includes(o.lb)) {
            let tgt = o._stalk && !o._stalk.shed2 && !(o._stalk.stunned && t < o._stalk.stunned) ? o._stalk : null;
            if (!tgt) { let td = TU("stalkReachPx", 60);
              for (const a of S.def) { if (a.lb === "DL" || (a.lb === "LB" && o.lb !== "TE") || a.shed2 || (a.stunned && t < a.stunned) || a._climbedBy) continue;
                if (a.lx < c.lx - 10) continue;
                // the tight end's job is the man at the point of attack, not the nearest body
                const d2 = Math.hypot(a.lx - o.lx, a.y - o.y) + (o.lb === "TE" ? Math.abs(a.y - holeY) * .6 : 0); if (d2 < td) { td = d2; tgt = a; } }
              if (tgt) { o._stalk = tgt; tgt._climbedBy = o.id; } }
            if (tgt) { mv(o, tgt.lx - 6, tgt.y, 0.85);
              if (Math.hypot(o.lx - tgt.lx, o.y - tgt.y) < 14 && seesBall(tgt) && (tgt._heldTotal || 0) < TU("stalkHoldMax", 150)) {
                tgt._heldTotal = (tgt._heldTotal || 0) + TICK;
                const pshed = cl(((tgt.str*0.5 + tgt.agi*0.5) - o.blk) * 0.0006 + TU("stalkShedBase", .2), 0.004, 0.08);
                if (Math.random() < pshed) { tgt.shed2 = true; tgt._climbedBy = null; o._stalk = null; }
                else { if (!tgt.held) emit("block", { by: o.id, on: tgt.id, x: o.lx, y: o.y }); tgt.held = t + 60; } }
              return; }
          }
          mv(o, c.lx+26, o.y, 0.45); });
      }
      // pre-carry defense shell drift
      if (phase==="drop"||phase==="fly") {
        S.def.forEach(a=>{
          if(a===coverA){ const aim=coverageAim(a,target); mv(a,aim.lx-sep*2.4,aim.y,.90+a.cov*.0016); }
          else if(a===coverHelp&&bracketed){ const aim=coverageAim(a,target); mv(a,aim.lx+7,aim.y+(a.y<MIDY?-10:10),.78+a.aware*.0018); }
          else if(a.lb==="CB"){
            // v82: a press corner stays in the receiver's face until the jam resolves
            if (a._press && t < 200) { mv(a, a.lx, a.y, .2); return; }
            const receivers=S.off.filter(w=>["WR","TE"].includes(w.lb));
            const w=receivers.slice().sort((p,q)=>Math.hypot(p.lx-a.lx,p.y-a.y)-Math.hypot(q.lx-a.lx,q.y-a.y))[0];
            const error=Math.max(0,55-a.aware)/55;
            const wrong=error>.2&&Math.random()<error*.035;
            const aim=coverageAim(a,w), wy=wrong?clampY(aim.y+(Math.random()<.5?-55:55)):aim.y;
            mv(a,aim.lx+6+(55-a.cov)*.12,wy,.76+a.cov*.0028+a.quick*.0012);
          }
          else if(a.lb==="S"){
            // v82: the robber rotates down over the middle after the snap
            if (a._robber && disguise && t >= disguise.rotateAt) { mv(a, TU("robberLx", 42), MIDY + (a.y < MIDY ? -8 : 8), .9); return; }
            // v81: a safety who bit on play action comes downhill before he realises
            if (playAction && a._bite && !seesBall(a)) { mv(a, Math.min(a.lx, TU("paBiteSafetyLx", 48)), a.y, .6); return; }
            const deepest=S.off.filter(w=>["WR","TE"].includes(w.lb)).sort((p,q)=>q.lx-p.lx)[0];
            const aim=coverageAim(a,deepest); mv(a,aim.lx+20,(aim.y+MIDY)/2,.54+a.aware*.0022);
          }
          else if(a.lb==="LB"){
            // v82: the spy mirrors the quarterback at the line instead of dropping
            if (a._spy) { if (!a._attack) mv(a, TU("spyLx", 16), S.off[8].y, .75); return; }
            // v81: a linebacker who bit fills his gap first; the drop only starts once he
            // has found the ball, which is what opens the window behind him
            if (playAction && a._bite && !seesBall(a)) { mv(a, TU("paBiteLx", 8), a.y, .7); return; }
            const plan=lbDrops.find(x=>x.a===a);
            if(plan&&t>=plan.readAt){
              if(!plan.ann){plan.ann=true;emit("linebackerDrop",{who:a.id,delay:Math.round(plan.readAt)});}
              const inside=S.off.filter(w=>["TE","RB","WR"].includes(w.lb)).sort((p,q)=>Math.abs(p.y-a.y)-Math.abs(q.y-a.y))[0];
              const aim=coverageAim(a,inside); mv(a,Math.max(24,aim.lx+5),aim.y+(aim.y<MIDY?7:-7),.58+a.cov*.0022+a.aware*.0014);
            } else mv(a,22,a.y,.32+a.quick*.0015);
          }
        });
        S.off.forEach(a=>{ if(a.route&&a.route.length){
            if (chipper && a === chipper.te && t < chipper.until) return;     // v82: still chipping
            const jammed = t < (a._jamUntil||0) ? TU("jamPace", .35) : 1;   // v82: hands on him at the line
            // run the assigned route: mv toward the current waypoint, advance on arrival
            if(a._rwp==null)a._rwp=1;
            const _last=a._rwp>=a.route.length-1;
            const wp=a.route[Math.min(a._rwp, a.route.length-1)];
            // v109 THE RECEIVER FINDS THE BALL: until the target has found the ball in the air this
            // block is the ONLY thing steering him (his route, one `mv` a tick — the fly branch waits);
            // once he has found it the pre-v109 steering resumes as it was, this block included,
            // because the arrival it produces (where he stands against the man on him when the ball
            // comes down, and how fast) is what the catch point's stop/YAC economy was tuned on —
            // standing this block down after the find took two yards off every attempt.
            // `ballFindSingleMv` = 1 is the one-mv version, kept as a dial for the record.
            const steerV109 = !(a === target && phase === "fly" && a._ballTracked && TU("ballFindV109", 1) && TU("ballFindSingleMv", 0));
            // v55: once the route is FINISHED keep working. Previously the receiver
            // parked on his last waypoint and stood dead still for the rest of the
            // play — a frozen path in the sim log, and most of what "players do not
            // follow routes" actually looked like on screen.
            if(_last && Math.hypot(a.lx-wp.lx,a.y-wp.y)<11){
              const tail=a.route.tail||"go", pv=a.route[Math.max(0,a.route.length-2)];
              const dx=wp.lx-pv.lx, dy=wp.y-pv.y, n=Math.hypot(dx,dy)||1;
              if(tail==="settle") { if (steerV109) mv(a, a.lx-14, a.y+(MIDY-a.y)*.04, .55); }       // work back toward the ball
              else {
                // Always aim at a point that is actually ON the field and always
                // carries some downfield: a tail that pushed sideways into the
                // boundary just pinned the receiver against the paint, where he
                // stopped dead again — the exact thing the tail exists to prevent.
                const lat = tail==="across" ? 70 : tail==="out" ? 55 : 20;
                const fwd = tail==="go" ? 90 : tail==="across" ? 26 : 22;
                let ty = clampY(a.y + (dy/n)*lat);
                if (Math.abs(ty - a.y) < 6) ty = a.y + (MIDY - a.y) * .10;        // boundary ate it: work back inside
                if (steerV109) mv(a, a.lx + fwd, ty, .88);
              }
            } else if (steerV109) mv(a, wp.lx, wp.y, (a===target?1.0:0.93) * jammed);
            if(window.__ROUTE_DEBUG&&a._routeName){const D=window.__ROUTE_DEBUG;
              (D.path[a.id]||(D.path[a.id]=[])).push([Math.round(a.lx),Math.round(a.y)])}
            if(a._rwp<a.route.length-1 && Math.hypot(a.lx-wp.lx,a.y-wp.y)<9){
              const prev=a.route[Math.max(0,a._rwp-1)], next=a.route[a._rwp+1];
              const inX=wp.lx-prev.lx,inY=wp.y-prev.y,outX=next.lx-wp.lx,outY=next.y-wp.y;
              const inN=Math.hypot(inX,inY)||1,outN=Math.hypot(outX,outY)||1;
              const inDx=inX/inN,inDy=inY/inN,outDx=outX/outN,outDy=outY/outN;
              const angle=Math.acos(cl(inDx*outDx+inDy*outDy,-1,1));
              a._rwp++; a._routeBreak={serial:(a._breakSerial=(a._breakSerial||0)+1),t,lx:a.lx,y:a.y,inDx,inDy,outDx,outDy,angle};
              emit("routeBreak",{who:a.id,x:a.lx,y:a.y,route:a._routeName||"route",angle:Math.round(angle*180/Math.PI),direction:Math.sign(outDy)||0});
            }
          }
          else if(["WR","TE"].includes(a.lb)){ mv(a, a.lx+50, a.y, 0.9); }
          else if(a.lb==="OL"){ const push = a.engagedBy&&!a.engagedBy.shed ? Math.min(18,(t)*0.012):2;
            const shift = (S.off[8]._roll ? S.off[8]._roll * TU("rolloutLineShift", 10) : 0) + (protection.slide ? protection.slide * TU("slideShift", 6) : 0);   // v82: the line moves with the call
            mv(a,-6-push*0.7,a.y + shift,0.5);
            if(a.engagedBy&&!a.engagedBy.shed) mv(a.engagedBy, a.lx-8, a.y, 0.42); }
          else if(a.lb==="RB"&&kind==="pass"){
            if (playAction && t < declareT + 200) mv(a, 4, a.y, 0.9);                      // v81: sells the fake into the line
            else if(!(blitzer&&blitzer.blitzing&&!blitzer.picked&&!blitzer.freeRun)) mv(a,-20,a.y,0.5); } });
      }
      if (phase==="handoff"||phase==="snap") {
        // engaged DL fight through the block — continuous movement, never a snap.
        // Run downs get pancakes too: a dominated lineman is flattened and his
        // blocker climbs to the second level.
        blockers.forEach(pancakeTick);
        rushers.forEach(r=>{ if(!r.shed&&r.engaging&&!(r.stunned&&t<r.stunned)) mv(r, r.engaging.lx+8, r.engaging.y, 0.4); });
      }
      rec();
    }
    if (!done) { // clock safety: down him where he stands
      if (carrier && carrier.side==="off") { out = out || { kind, yards: Math.round(carrier.lx/YD) };
        // credit the actual nearest defender, not a hard-coded slot (which could
        // hand YOUR player a tackle he was nowhere near) — v30: and only if he is
        // genuinely at the ball, else the whistle simply catches the runner
        const nr = S.def.slice().sort((p,q)=>Math.hypot(p.lx-carrier.lx,p.y-carrier.y)-Math.hypot(q.lx-carrier.lx,q.y-carrier.y))[0]||{};
        const nrd = nr.id ? Math.hypot(nr.lx-carrier.lx, nr.y-carrier.y) : 1e9;
        emit("tackle",{tackler:nrd<TU("tackleCreditPx",20)?nr.id:null,carrier:carrier.id,x:carrier.lx,y:carrier.y}); }
      else if (isKick && carrier) out = { kind, yards: 0, ret: Math.round(((carrier._catchLx||0) - carrier.lx) / YD), spotLx: carrier.lx };
      else if (!out) out = { kind, yards: 0, complete:false, intercepted:false };
    }
    out = out || { kind, yards: 0 };
    out.yards = cl(out.yards, -6, 80);
    if(kind==="pass"&&target){ out.targetPlayer=target.player||picks.target||null; out.coverPlayer=ballByV110?ballPlayerV110:(coverA&&coverA.player||picks.cover||null); out.coverBy=ballByV110?ballByV110.id:null;   // v110: credit follows the man who made the play (v150 B: no fall-through once somebody made it)
      out.throwStyle=throwStyle; out.throwWindow=throwWindow; out.arrivalEdgeMs=Math.round(arrivalEdgeMs); out.locationQuality=locationQuality; }
    // v18 post-whistle coast: bodies don't freeze at the whistle — everyone keeps
    // moving and decelerates naturally for ~1 second after the play is blown dead.
    (function(){
      const downMan = carrier;
      /* ===== v109 THE FEET PLANT — the coast =====
       * Everyone braked at one global whistleBrakeScale, so a lineman stopped as fast as a
       * corner; the tackled man slid along his knock-back or drive vector with `_dx/_dy` still
       * pointing the way he had been running, so a man driven backward was drawn running
       * forward. A per-position brake mass (brakeMassOL / DL / DB / Mid) scales the brake, and
       * the down man's heading rotates onto the push over the first downTurnTicks. All of it is
       * after the whistle: the spot is already booked. */
      const BRAKE9 = { OL: ["brakeMassOL", .78], DL: ["brakeMassDL", .85], CB: ["brakeMassDB", 1.15], S: ["brakeMassDB", 1.15], WR: ["brakeMassDB", 1.15] };
      const brakeMassV109 = a => { const b = BRAKE9[a.lb]; return b ? TU(b[0], b[1]) : TU("brakeMassMid", 1); };
      for (let ct = 0; ct < 30; ct++) {
        t += TICK;
        const ease = Math.max(0, 1 - ct/22);
        S.all.forEach(a => {
          if (a === downMan) {
            // v19: the tackled man is NOT frozen at the point of contact — he finishes
            // his motion into the whistle. A won collision DRAGS him forward a beat
            // (real forward progress); a lost one FLINGS him backward. Both decay to a
            // stop across the coast, then he stays down.
            if (a._drive > 0.3 && ct < 10) { const s = a._drive*Math.max(0,1-ct/10)*0.30;
              a.lx += (a._drivedx||0)*s; a.y = clampY(a.y + (a._drivedy||0)*s); }
            if (a._kb > 0.5 && ct < 9) { const s = a._kb*Math.max(0,1-ct/8)*0.28;
              a.lx += (a._kbdx||0)*s; a.y = clampY(a.y + (a._kbdy||0)*s); }
            if (ct < TU("downTurnTicks", 4) && (a._kb > 0.5 || a._drive > 0.3)) {   // v109: his heading turns onto the push
              const px = a._kb > 0.5 ? (a._kbdx||0) : (a._drivedx||0), py = a._kb > 0.5 ? (a._kbdy||0) : (a._drivedy||0), k = (ct+1)/TU("downTurnTicks", 4);
              const nx = (a._dx||0)*(1-k) + px*k, ny = (a._dy||0)*(1-k) + py*k, nn = Math.hypot(nx, ny) || 1; a._dx = nx/nn; a._dy = ny/nn; }
            return;                                        // then the tackled man stays down
          }
          evolveSpeed(a,0,TICK,t,0,TU("whistleBrakeScale",.46) * brakeMassV109(a));   // v109: the heavy men coast longer
          const v = Math.max(0,(a.vel||0)) * (a.spd||120) * ease * (TICK/1000) * 0.8;
          if (v > 0.15) { a.lx += (a._dx||0)*v; a.y = clampY(a.y + (a._dy||0)*v); }
          // v82 THE PILE: a second man arriving after the whistle adds his push — the
          // pile moves a step his way and he stops in it. Cosmetic: the spot is booked.
          if (downMan && a.side !== downMan.side && ct < 12 && (a.vel||0) > .4 && Math.hypot(a.lx-downMan.lx, a.y-downMan.y) < TU("pileReachPx", 16)) {
            const push = TU("pilePushPx", .55) * (1 - ct/12);
            downMan.lx += (a._dx||0) * push; downMan.y = clampY(downMan.y + (a._dy||0) * push);
            a.vel = Math.max(0, a.vel * .5);
            if (!a._piled) { a._piled = 1; events.push({ t, type: "pilePush", who: a.id, x: downMan.lx, y: downMan.y }); }
          }
        });
        rec();
      }
    })();
    // v20 stamina bookkeeping — write the tank back to the roster player so it
    // persists play-to-play. Emptying it triggers GASSED: TU("gassedPlays",5)
    // recovery plays (fewer for high-stamina players), during which he is
    // moderately slower. Between-play regen also scales with the stamina stat —
    // improving the stat directly improves the recovery rate.
    S.all.forEach(a => {
      const p = a.player; if (!p) return;
      const stam = a.stam || 50;
      const gas = a.gas === undefined ? (a.gas0 !== undefined ? a.gas0 : 100) : a.gas;
      let gp = p._gassedPlaysV20 || 0;
      if (gp > 0) gp--;
      else if (gas <= TU("gasEmptyAt", 2)) {
        gp = Math.round(cl(TU("gassedPlays", 5) - (stam - 50) / TU("gassedStamDiv", 25), 2, 7));
        if (p.you) events.push({ t, type: "gassedOut", who: a.id, plays: gp });
      }
      const regen = TU("gasRegenPlay", 16) * (0.65 + (stam / 99) * 0.8) * (gp > 0 ? 1.35 : 1);
      // v30 GAME WEAR: a slice of every play's burn never comes back this game — the
      // tank's CEILING sinks with accumulated workload (slower for high stamina), so
      // fourth-quarter legs are genuinely heavier than first-quarter legs.
      const burned = Math.max(0, (a.gas0 !== undefined ? a.gas0 : 100) - gas);
      p._wearV30 = cl((p._wearV30 || 0) + burned * TU("wearK", 0.05) * (1.3 - (stam / 99) * 0.6), 0, TU("wearMax", 24));
      p._gasV20 = cl(gas + regen, 0, 100 - p._wearV30);
      p._gassedPlaysV20 = gp;
    });
    // who ACTUALLY made the stop — the stat layer credits this roster player, never a random roll
    const _tke = events.filter(e=>e.type==="tackle").pop();
    out.tackler = (_tke && _tke.tackler && A_all[_tke.tackler]) ? (A_all[_tke.tackler].player || null) : null;
    out.assist = null;
    if (_tke && _tke.youIn) { const _yu = S.all.find(a=>a.player&&a.player.you); out.assist = _yu ? _yu.player : null; }
    out.flags = flagCand;   // v30: what an official COULD have flagged — the game layer rolls the call
    out.log = { duration: t, events, ball: ballFrames,
      actors: S.all.map(a=>({id:a.id, side:a.side, label:a.lb, sp:Math.round(a.spd), you:!!(a.player&&a.player.you), nm:a.player&&a.player.name||null, skin:a.player&&Number.isFinite(a.player.skinTone)?a.player.skinTone:null,   /* v151 D: who he is, for his skin tone (render-only) */ gas:Math.round(a.gas!==undefined?a.gas:(a.gas0!==undefined?a.gas0:100)), frames:a.frames})) };
    /* Only a play the offence CARRIED to a spot: an incompletion's ball legitimately lands
     * yards downfield on a zero-yard play, and a pick's ball changes hands and comes back
     * the other way, so neither one's ball track means what `yards` means. */
    if ((kind === "run" || kind === "pass") && out.complete !== false && !out.intercepted)
      out.log = fitLogYardsV139(out.log, out.yards);
    return out;
  }

  /* ===== v139 THE PICTURE OBEYS THE NUMBER =====
   *
   * `out.yards` is clamped to [-6, 80] one line above the log is built, and dampV76 can
   * pull it down again afterwards — but nothing ever told the PICTURE. The log kept the
   * carrier's real `lx`, the bridge maps that straight to the field, and so the broadcast
   * ran a play the box score did not agree with. Measured over 2,187 resolved snaps: 109
   * of them (5%) animated at least six yards further than they credited, every single one
   * of them at the 80-yard clamp, and 81 plays animated the ball more than 100 yards
   * downfield — further than a football field is long. The ball is then spotted on the
   * credited number, so the next snap starts somewhere the viewer did not just watch the
   * play end. That is the "he got 80 and I was credited 30, and then they spot it wrong".
   *
   * The number is the truth — it is what the box score, the chains and the next spot are
   * all built on — so the picture is cut to fit it. The play is TRUNCATED at the moment
   * the ball reaches the credited yardage rather than rescaled: truncation keeps every
   * speed, every relative position and every block exactly as the sim resolved them, and
   * it is also what the number means. He was brought down here. The dead-ball event is
   * carried onto the cut so the play still ends on a tackle, and the renderer's own
   * between-plays phase takes it from there.
   *
   * It only ever SHORTENS. The reported number is never larger than the resolved one —
   * both the clamp and the margin brake only reduce — so a log that already sits inside
   * its number is returned untouched, and a loss (where `want` is behind the ball) fails
   * the same test and is left alone. */
  function fitLogYardsV139(log, yards) {
    if (!log || !log.ball || log.ball.length < 2 || !isFinite(yards)) return log;
    /* MEASURE THE MAN THE NUMBER WAS MEASURED FROM. `yards` is `Math.round(carrier.lx/YD)`
     * taken at the whistle, and the whistle's own event carries that carrier and that very
     * `lx` — so comparing against it is exact, and a play the clamp never touched comes out
     * at a disagreement of zero. Comparing against the BALL instead needs a fudge factor:
     * the ball marker rides up to several yards ahead of the man holding it on a long run,
     * which is not a wrong spot but does look like one, and it had this cutting 36% of
     * snaps for nothing. Half a yard of slack is rounding and nothing else. */
    /* v139 fix: NEVER cut a play whose ending is a turnover. The cut drops every event past it,
     * and a stripped ball's tail — `looseBall`, the scramble, `recover` — IS the ending: losing it
     * leaves a fumble with no recovery in the log, which is both a lie and a play the renderer
     * cannot finish. `yards` on such a play is the offence's, not the carry's, so there is nothing
     * here worth fitting anyway. (Caught by v109C1check: "19 strips, 19 loose, 16 recovered".) */
    for (const e of log.events) if (e.type === "fumble" || e.type === "looseBall" || e.type === "recover") return log;
    const want = yards * YD, bf = log.ball;
    const dead = log.events.slice().reverse().find(e => e.type === "tackle");
    const track = (dead && dead.carrier != null
      && (log.actors.find(a => a.id === dead.carrier) || {}).frames) || bf;
    const endX = dead && isFinite(dead.x) ? dead.x : bf[bf.length - 1].x;
    if (!(endX > want + YD * 0.5)) return log;
    /* THE LAST CROSSING, NOT THE FIRST. On a pass the carrier's own track only starts
     * downfield, but the ball fallback is over the target yard line while it is still IN
     * THE AIR — taking the first crossing there cut the play in mid flight, so the throw
     * never arrived and the catch never happened. Scanning back from the dead ball finds
     * the crossing that belongs to the CARRY, which is the one the number is about. */
    const crossing = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        if (arr[i - 1].x <= want) {
          const a = arr[i - 1], b = arr[i];
          return a.t + (b.t - a.t) * cl((want - a.x) / ((b.x - a.x) || 1), 0, 1);
        }
      }
      return -1;
    };
    /* A receiver's own track can begin ALREADY past the number — a man in motion, or a
     * catch made behind where the play is credited to — and then it never crosses and the
     * play was silently left long. The ball always starts in the backfield, so it always
     * has a crossing to fall back on. */
    let tCut = crossing(track);
    if (tCut < 0 && track !== bf) tCut = crossing(bf);
    if (tCut < 0) return log;
    // every track is cut at the same instant, with one interpolated frame ON the cut so
    // nobody is left a frame short of where the whistle went
    const cut = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].t <= tCut) { out.push(arr[i]); continue; }
        const a = arr[i - 1];
        if (a) {
          const f = cl((tCut - a.t) / ((arr[i].t - a.t) || 1), 0, 1), o = {};
          for (const k in arr[i]) o[k] = (typeof arr[i][k] === "number" && typeof a[k] === "number")
            ? a[k] + (arr[i][k] - a[k]) * f : arr[i][k];
          o.t = tCut; out.push(o);
        }
        break;
      }
      return out.length ? out : arr.slice(0, 1);
    };
    const ball = cut(bf);
    const actors = log.actors.map(a => Object.assign({}, a, { frames: cut(a.frames) }));
    /* THE WHISTLE GOES WHERE THE MAN IS, not where the ball marker is. The ball rides
     * ahead of the carrier, so spotting the synthetic dead ball on it put the new tackle
     * a yard or two past the number the cut was made to hit — which is the very thing
     * this is here to stop. */
    const ca = dead && dead.carrier != null ? actors.find(a => a.id === dead.carrier) : null;
    const cf = ca && ca.frames.length ? ca.frames[ca.frames.length - 1] : ball[ball.length - 1];
    /* v139 fix: DROPPING an event past the cut loses what the play DID. The tail of a stop is
     * bookkeeping — the drags it beat, the men who wrapped in, the break — and a check that counts
     * them (or a renderer that needs them) is entitled to all of it. Nothing is discarded now:
     * an event past the cut is re-timed ONTO the cut, which is where the whistle went. Only the
     * original dead-ball tackle goes, because the synthetic one below replaces it. */
    const events = log.events.filter(e => e !== dead)
      .map(e => e.t <= tCut ? e : Object.assign({}, e, { t: tCut, v139cut: true }));
    events.push(Object.assign({}, dead || { type: "tackle" },
      { t: tCut, x: cf.x, y: cf.y, v139: true }));
    events.sort((a, b) => a.t - b.t);
    return { duration: tCut, events, ball, actors };
  }

  // pure contact formula: momentum, angle, attributes, open field
  function breakProb(c, d, lx, behind, cMom, dMom) {
    let bp = cl(0.20 + ((c.str*0.35 + c.agi*0.4 + c.burst*0.25) - d.tkl) * 0.0065, 0.03, 0.62);
    if (lx > 30) bp = cl(bp + TU("bpOpenBonus",0.13), 0.03, TU("bpOpenCap",0.75));   // v41: open-field misses spring more clean breakaways
    bp = cl(bp + (cMom - dMom)*0.0016, 0.02, 0.78);            // momentum decides collisions
    if (behind) bp = cl(bp + 0.12, 0.02, 0.82);                // arm tackles from behind
    return bp;
  }
  // unit hook: velocity retained through a 90-degree cut at a given agility
  function turnTest(agi) {
    const a = { spd:140, spdA:60, agi, accel:60, burst:60, vel:1, _launchAt:0 };
    return evolveSpeed(a,1,TICK,500,1,1);
  }
  // Unit hook: compare ratings without sim noise. Times are milliseconds and
  // distance is pixels covered in the first 330ms from a standing start.
  function accelerationTest(accel,burst=accel,agi=accel) {
    const a={spd:140,spdA:60,accel,burst,agi,vel:0},dt=33;
    let now=0,dist=0,t50=null,t80=null,t90=null;
    for(let i=0;i<90;i++){
      const prev=a.vel;now+=dt;evolveSpeed(a,1,dt,now,0,1);if(now<=330)dist+=a.spd*a.vel*dt/1000;
      const crossing=threshold=>+(now-dt+dt*cl((threshold-prev)/Math.max(.0001,a.vel-prev),0,1)).toFixed(1);
      if(t50==null&&a.vel>=.5)t50=crossing(.5);if(t80==null&&a.vel>=.8)t80=crossing(.8);if(t90==null&&a.vel>=.9)t90=crossing(.9);
      if(now>=330&&t90!=null)break;
    }
    const startBrake=a.vel;let brake50=null;
    for(let i=0;i<90&&brake50==null;i++){now+=dt;evolveSpeed(a,0,dt,now,0,1);if(a.vel<=startBrake*.5)brake50=(i+1)*dt;}
    return {accel,burst,agility:agi,t50:t50||2970,t80:t80||2970,t90:t90||2970,distance330:+dist.toFixed(2),brake50:brake50||2970};
  }
  const Q = [];
  function pushLog(sig, log) { Q.push({ sig, log }); if (Q.length > 120) Q.shift(); }

  const SKILL_MAP = {
    speed:        "top sprint velocity of the marker (px/s)",
    acceleration: "how fast velocity ramps to top speed after every start/cut",
    burst:        "short-area explosion: hole hit, post-broken-tackle jets, DL get-off",
    agility:      "turn radius (inertia blend), tackle-break contribution, route-break separation",
    quickness:    "first-step reaction latency + DL shed contests + play recognition",
    strength:     "block anchoring, shedding power, tackle-break power",
    blocking:     "block win/hold probability (trench + second-level climbs)",
    tackling:     "tackle attempt success vs the carrier's break roll",
    coverage:     "per-tick separation suppression + interception positioning",
    catching:     "base catch probability on every target",
    jumping:      "high-point contests on deep balls (13+ yd routes) for catches AND picks",
    throwing:     "QB arm: ball velocity (flight time), deep range cap, accuracy",
    awareness:    "QB accuracy + INT avoidance; defenders FIND THE BALL sooner (v81 key read), see through play action and draws, and re-read the carrier's line more often",
    vision:       "ball-carrier lane reading: chance of finding the truly open hole when the designed one closes",
    stamina:      "late-play leg fade: speed decay after 2.2s, slower for high stamina",
    grit:         "carriers fall forward through contact; tacklers reload attempts faster",
    discipline:   "pursuit angles: low discipline overpursues and gets beaten by cuts; holds the key on a fake instead of biting",
    ballControl:  "secures contested catches in tight coverage",
  };
  root.__FieldSim = {
    skillMap: SKILL_MAP, _breakP: breakProb, _turnTest: turnTest, _accelTest: accelerationTest,
    pass(w, k, T, K, g, N, att, concept, ctx={}) {
      try {
        // place the resolved target/cover into their actual formation slots so the
        // animation features the SAME roster players the box score credits
        const tSlot = g && g.pos === "TE" ? 2 : g && g.pos === "RB" ? 9 : 0;
        const cSlot = N && N.pos === "S" ? 2 : N && N.pos === "LB" ? 4 : 0;
        const r = sim("pass", k.off, T.def, att, { target: g, cover: N, off: { 8: K, [tSlot]: g }, def: {} }, Object.assign({ concept },ctx));   // v87: nobody is moved into coverage by the pick
        // v150 B: a swat or a pick names the agent who made it (`coverBy`); his roster player is the credit, never the
        // engine's pre-rolled cover man `N` standing in for him
        const X = { qb: K, rec: r.targetPlayer||g, cover: r.coverBy ? r.coverPlayer : (r.coverPlayer||N), coverBy: r.coverBy||null, complete: !!(r.kind==="pass" && !r.intercepted && r.yards!==undefined && r.complete!==false),
          intercepted: !!r.intercepted, yards: 0, breakaway: false };
        // completed = we entered carry as the target and got tackled with yards
        const catchEv = r.log.events.find(e=>e.type==="catch");
        const comp = !!catchEv;
        X.complete = comp; X.yards = comp ? Math.max(1, r.yards) : 0; X.breakaway = X.yards >= 20;
        // air yards vs yards-after-catch: the ball is caught at routeDepth
        // (catch event x, in local coords with LOS at 0), the rest is YAC.
        if (comp) { X.air = cl(Math.round(catchEv.x/YD), 0, X.yards); X.yac = Math.max(0, X.yards - X.air); }
        // v87: a scramble the sim chose is booked as one; a swat is the only pass break-up
        if (r.log && r.log.events && r.log.events.some(e=>e.type==="scramble"&&e.opportunity)) { X.scramble = true; X.complete = false; X.yards = Math.round(r.yards || 0); X.breakaway = X.yards >= 15; }
        X.swat = !!r.swat;
        X.tackler = r.tackler||null; X.assist = r.assist||null; X.flags = r.flags||null; X.fumble = r.fumble||null; X.dragYd = r.dragYd||0; X.strain = !!r.strain;   // v103: stripped after the catch, and carried for the extra
        X.throwStyle=r.throwStyle; X.throwWindow=r.throwWindow; X.arrivalEdgeMs=r.arrivalEdgeMs; X.locationQuality=r.locationQuality;
        // v82: the quarterback took the sack inside the sim — the sacker is the free man
        // who got there, and the log renders as the sack the box score books
        if (r.sack) { X.sack = true; X.sacker = r.sacker || null; X.yards = Math.min(-1, r.yards); X.complete = false; }
        pushLog({ off: !!w, kind: "pass", yards: X.yards, intercepted: X.intercepted, complete: X.complete }, r.log);
        return X;
      } catch (e) { console.warn("[FieldSim.pass]", e); return null; }
    },
    run(w, k, T, K, att, concept, ctx = {}) {
      try {
        // v81: the concept picks the hole (and a draw sells the pass first)
        // v101: and the CALLED PLAY, when there is one, picks the exact gap
        const r = sim("run", k.off, T.def, att, { off: { 9: K } }, Object.assign({ concept: concept || "inside" }, ctx));   // v103: ctx carries the gap, the down and the distance (the strain reads the sticks)
        const X = { carrier: K, yards: r.yards, breakaway: r.yards >= 15, tackler: r.tackler||null, assist: r.assist||null, flags: r.flags||null, fumble: r.fumble||null, dragYd: r.dragYd||0, strain: !!r.strain };   // v103: a strip the sim NAMED, and the ground he was dragged for
        pushLog({ off: !!w, kind: "run", yards: X.yards }, r.log);
        return X;
      } catch (e) { console.warn("[FieldSim.run]", e); return null; }
    },
    // v82 SPECIAL TEAMS — the game engine keeps its level-scaled leg (gross yards)
    // and its own rare rolls (muffs, onside kicks); the sim decides the block, the
    // fair catch and the return, and pushes the play's log for the broadcast.
    punt(w, k, T, att, o) {
      try { const r = sim("punt", k.off, T.def, att, {}, o || {});
        pushLog({ off: !!w, kind: "punt", yards: 0 }, r.log);
        return { ret: r.ret || 0, fair: !!r.fair, blocked: !!r.blocked, td: !!r.td, tackler: r.tackler || null };
      } catch (e) { console.warn("[FieldSim.punt]", e); return null; }
    },
    kickoff(w, k, T, att, o) {
      try { const r = sim("kickoff", k.off, T.def, att, {}, o || {});
        pushLog({ off: !!w, kind: "kickoff", yards: 0 }, r.log);
        return { ret: r.ret || 0, td: !!r.td, tackler: r.tackler || null };
      } catch (e) { console.warn("[FieldSim.kickoff]", e); return null; }
    },
    fg(w, k, T, att, o) {
      try { const r = sim("fg", k.off, T.def, att, {}, o || {});
        pushLog({ off: !!w, kind: "fg", yards: 0 }, r.log);
        return { blocked: !!r.blocked, good: !!r.good };
      } catch (e) { console.warn("[FieldSim.fg]", e); return null; }
    },
    _sim: sim, _Q: Q, fitLogV139: fitLogYardsV139,
    takeLog(sig) {
      if (!Q.length) return null;
      // SEARCH for the first matching log rather than requiring it at the head.
      // The whole game is resolved up front (pushing every play's log) and then
      // rendered play-by-play; plays that don't push a log (sacks, scrambles,
      // fumbles, scores) and reshaped runs used to desync the FIFO permanently,
      // so ~4 of every 5 plays fell back to the old choreography and none of the
      // agent-sim tackle/sprint/line events reached the screen. Matching by
      // (kind, off, yards, intercepted) anywhere in the queue is order-independent.
      for (let i = 0; i < Q.length; i++) {
        const h = Q[i];
        const kindOk = sig.kind === h.sig.kind || (sig.kind === "passfam" && h.sig.kind === "pass");
        if (kindOk && h.sig.off === sig.off && h.sig.yards === sig.yards &&
            (sig.intercepted === undefined || sig.intercepted === !!h.sig.intercepted)) {
          Q.splice(i, 1); return h.log;
        }
      }
      // no match (a play with no pushed log) — trim stale entries so the queue
      // can't grow unbounded across a long game
      if (Q.length > 30) Q.shift();
      return null;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);

