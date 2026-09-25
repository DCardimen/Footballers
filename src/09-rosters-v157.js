
/* ===== v15.7: exact team-rating rosters + mismatch breakaways ===== */
(function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const POSITIONS=['QB','RB','WR','WR','TE','LT','LG','C','RG','RT','EDGE','DT','DT','EDGE','LB','LB','CB','CB','S','S','K','P'];
  const ARCH={
    QB:{speed:.86,acceleration:.90,agility:.91,strength:.78,tackling:.36,throwing:1.32,awareness:1.20,catching:.58,blocking:.52,weight:.92},
    RB:{speed:1.20,acceleration:1.24,agility:1.20,strength:1.02,tackling:.55,throwing:.48,awareness:1.00,catching:1.02,blocking:.76,weight:.94},
    WR:{speed:1.24,acceleration:1.20,agility:1.16,strength:.82,tackling:.48,throwing:.45,awareness:.98,catching:1.28,blocking:.68,weight:.82},
    TE:{speed:.98,acceleration:.94,agility:.91,strength:1.18,tackling:.62,throwing:.42,awareness:1.00,catching:1.12,blocking:1.18,weight:1.13},
    LT:{speed:.68,acceleration:.70,agility:.65,strength:1.32,tackling:.70,throwing:.30,awareness:1.02,catching:.38,blocking:1.38,weight:1.32},
    LG:{speed:.70,acceleration:.72,agility:.66,strength:1.34,tackling:.72,throwing:.30,awareness:1.00,catching:.36,blocking:1.36,weight:1.30},
    C:{speed:.69,acceleration:.71,agility:.67,strength:1.28,tackling:.70,throwing:.32,awareness:1.10,catching:.38,blocking:1.34,weight:1.26},
    RG:{speed:.70,acceleration:.72,agility:.66,strength:1.34,tackling:.72,throwing:.30,awareness:1.00,catching:.36,blocking:1.36,weight:1.30},
    RT:{speed:.68,acceleration:.70,agility:.65,strength:1.32,tackling:.70,throwing:.30,awareness:1.02,catching:.38,blocking:1.38,weight:1.32},
    EDGE:{speed:1.04,acceleration:1.06,agility:.94,strength:1.16,tackling:1.18,throwing:.30,awareness:1.02,catching:.52,blocking:.54,weight:1.14},
    DT:{speed:.76,acceleration:.78,agility:.70,strength:1.36,tackling:1.20,throwing:.28,awareness:.96,catching:.40,blocking:.52,weight:1.34},
    LB:{speed:1.02,acceleration:1.04,agility:1.00,strength:1.10,tackling:1.24,throwing:.34,awareness:1.10,catching:.70,blocking:.58,weight:1.08},
    CB:{speed:1.27,acceleration:1.24,agility:1.24,strength:.78,tackling:.92,throwing:.34,awareness:1.08,catching:1.02,blocking:.46,weight:.78},
    S:{speed:1.14,acceleration:1.12,agility:1.12,strength:.92,tackling:1.10,throwing:.34,awareness:1.16,catching:.94,blocking:.48,weight:.90},
    K:{speed:.72,acceleration:.75,agility:.76,strength:.68,tackling:.46,throwing:.40,awareness:1.00,catching:.48,blocking:.40,weight:.72},
    P:{speed:.74,acceleration:.76,agility:.78,strength:.70,tackling:.48,throwing:.68,awareness:1.02,catching:.52,blocking:.42,weight:.74}
  };
  const MAIN={QB:['throwing','awareness'],RB:['speed','acceleration','agility','strength'],WR:['speed','acceleration','catching','agility'],TE:['catching','blocking','strength'],LT:['blocking','strength','awareness'],LG:['blocking','strength'],C:['blocking','awareness','strength'],RG:['blocking','strength'],RT:['blocking','strength','awareness'],EDGE:['tackling','strength','acceleration'],DT:['strength','tackling','weight'],LB:['tackling','awareness','speed'],CB:['speed','acceleration','agility','awareness'],S:['awareness','tackling','speed'],K:['awareness','strength'],P:['awareness','throwing']};
  function rng(seed){let x=(seed|0)||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
  function seededName(i,pos){const first=['Jalen','Marcus','Devin','Trey','Cam','Darius','Eli','Noah','Malik','Ty','Jordan','Isaiah','Cole','Andre','Mason','Jay'];const last=['Carter','Brooks','Hayes','Turner','Reed','Bennett','Price','Foster','Coleman','Ward','Mills','Parker','Gray','Davis','Stone','King'];return first[(i*7+pos.length)%first.length]+' '+last[(i*11+pos.charCodeAt(0))%last.length]}
  function distributeTiers(n,r){
    const stars=1+Math.floor(r()*4), average=4+Math.floor(r()*2), tiers=[];
    for(let i=0;i<stars;i++)tiers.push({tier:'star',mult:1.30+r()*.18});
    for(let i=0;i<average;i++)tiers.push({tier:'average',mult:.94+r()*.12});
    while(tiers.length<n)tiers.push({tier:'depth',mult:.60+r()*.40});
    for(let i=tiers.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[tiers[i],tiers[j]]=[tiers[j],tiers[i]]}
    return tiers;
  }
  function generateRoster(teamOverall,seed){
    const target=clamp(Math.round(Number(teamOverall)||17),1,999),r=rng((seed||target*7919)^0x15A7),tiers=distributeTiers(POSITIONS.length,r);
    // QB gets a modest structural premium, compensated elsewhere so the exact team mean remains target.
    const raw=POSITIONS.map((pos,i)=>{let m=tiers[i].mult*(pos==='QB'?1.12:1);return{pos,tier:tiers[i].tier,mult:m,idx:i}});
    const mean=raw.reduce((s,p)=>s+p.mult,0)/raw.length;
    raw.forEach(p=>p.ovr=clamp(target*p.mult/mean,1,99));
    // Iteratively force the rounded roster average to equal target exactly.
    let rounded=raw.map(p=>Math.round(p.ovr)),diff=target*raw.length-rounded.reduce((a,b)=>a+b,0),guard=0;
    while(diff!==0&&guard++<5000){
      const dir=diff>0?1:-1;
      const candidates=raw.map((p,i)=>({i,room:dir>0?999-rounded[i]:rounded[i]-1,frac:dir>0?p.ovr-Math.floor(p.ovr):Math.ceil(p.ovr)-p.ovr})).filter(x=>x.room>0).sort((a,b)=>b.frac-a.frac);
      if(!candidates.length)break; rounded[candidates[guard%candidates.length].i]+=dir; diff-=dir;
    }
    const attrs=['speed','acceleration','agility','strength','tackling','throwing','awareness','catching','blocking','weight'];
    const roster=raw.map((p,i)=>{
      const base=rounded[i],arch=ARCH[p.pos]||ARCH.LB,main=MAIN[p.pos]||[];
      const ratings={};
      attrs.forEach(k=>{
        const positional=arch[k]||1,noise=.82+r()*.36,preference=main.includes(k)?1.08+r()*.10:.92+r()*.10;
        ratings[k]=clamp(Math.round(base*positional*noise*preference),1,999);
      });
      return{id:'P'+i,name:seededName(i,p.pos),position:p.pos,pos:p.pos,ovr:base,overall:base,tier:p.tier,star:p.tier==='star',ratings,...ratings};
    });
    const avg=roster.reduce((s,p)=>s+p.ovr,0)/roster.length;
    return{teamOverall:target,averageOverall:avg,starCount:roster.filter(p=>p.tier==='star').length,averageCount:roster.filter(p=>p.tier==='average').length,players:roster};
  }
  window.__GRIDIRON_GENERATE_ROSTER_V157=generateRoster;
  // Attach mathematically reconciled rosters to generated opponents/schools.
  try{
    if(typeof rt==='function'){
      const oldRt=rt;
      rt=function(){const team=oldRt.apply(this,arguments),rating=Math.round(Number(team&&team.rating)||17),seed=(arguments[3]||1)+(arguments[2]||1)*101; if(team){const pack=generateRoster(rating,seed);team.rosterV157=pack.players;team.roster=team.roster||pack.players;team.rating=pack.teamOverall;team.averagePlayerRatingV157=pack.averageOverall;} return team};
    }
  }catch(e){console.warn('[v15.7 roster hook]',e)}
  const previous=window.__GRIDIRON_CONTACT_MODEL_V156;
  function contact(x){
    x=x||{}; const base=previous?previous(x):{};
    const defenders=clamp(Math.round(Number(x.defenderCount)||1),1,3);
    const runnerSkill=clamp((Number(x.runnerSpeedRatio)||.8)*.30+(Number(x.runnerStrength)||.6)*.24+(Number(x.runnerAgility)||.6)*.25+(Number(x.runnerBalance)||Number(x.runnerAgility)||.6)*.21,0,1.4);
    const primary=clamp((Number(base.wrapQuality)||.5)*.52+(Number(base.tacklerMomentum)||.5)*.28+(Number(x.angleQuality)||.7)*.20,0,1.5);
    const second=defenders>=2?clamp((Number(x.secondWrapQuality)||primary*.72),0,1.3):0;
    const support=primary+(defenders===2?second*.58:defenders>=3?second*.58+.48:0);
    const mismatch=runnerSkill-support;
    let breakaway=false,breakawayType='none',extraYards=0,stumble=0;
    if(defenders===1&&mismatch>.15){breakaway=true;breakawayType=mismatch>.42?'clean':'shed';extraYards=Math.round(clamp(2+mismatch*18,2,16));}
    if(defenders===2&&mismatch>.10){breakaway=true;breakawayType=mismatch>.34?'double-mismatch':'split-tackle';extraYards=Math.round(clamp(3+mismatch*20,3,18));}
    if(breakaway){stumble=Math.round(clamp((support/Math.max(.2,runnerSkill))*14,2,13));base.hitStick=false;base.launch=0;base.drag=Math.max(Number(base.drag)||0,Math.round(extraYards*2.2));}
    return Object.assign({},base,{defenderCount:defenders,runnerSkill,support,mismatch,breakaway,breakawayType,extraYards,stumble});
  }
  window.__GRIDIRON_CONTACT_MODEL_V157=contact;
  window.__GRIDIRON_CONTACT_MODEL_V156=contact;
  window.__GRIDIRON_SIMULATE_V157=function(iterations){
    iterations=Math.max(1000,iterations||100000);const errors=[];let breakaways=0;
    for(let i=0;i<iterations;i++){
      const overall=1+(i%60),pack=generateRoster(overall,9001+i);
      if(Math.abs(pack.averageOverall-overall)>1e-9)errors.push('average '+i);
      if(pack.starCount<1||pack.starCount>4||pack.averageCount<4||pack.averageCount>5)errors.push('tiers '+i);
      const q=pack.players.find(p=>p.pos==='QB'),cb=pack.players.find(p=>p.pos==='CB');
      if(!q||!cb||!Number.isFinite(q.throwing+cb.speed))errors.push('archetype '+i);
      const c=contact({defenderCount:(i%3)+1,runnerSpeedRatio:.6+((i*7)%70)/100,runnerStrength:.4+((i*11)%80)/100,runnerAgility:.4+((i*13)%80)/100,runnerBalance:.4+((i*17)%80)/100,tacklerWeight:.5+((i*19)%60)/100,tacklerSpeedRatio:.3+((i*23)%100)/100,tacklerStrength:.3+((i*29)%100)/100,angleQuality:.15+((i*31)%85)/100,secondWrapQuality:.2+((i*37)%100)/100});
      if(!Number.isFinite(c.mismatch+c.extraYards+c.support))errors.push('contact '+i); if(c.breakaway)breakaways++;
      if(errors.length>30)break;
    }
    return{ok:!errors.length,iterations,errors,breakaways};
  };
  window.__GRIDIRON_FEATURES__=Object.assign({},window.__GRIDIRON_FEATURES__||{},{exactRosterAverageV157:true,positionArchetypesV157:true,starDistributionV157:true,doubleMismatchBreakawayV157:true});
})();
