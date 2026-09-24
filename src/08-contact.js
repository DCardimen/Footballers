
(function(){
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  window.__GRIDIRON_CONTACT_MODEL_V156=function(x){
    x=x||{};
    const tw=clamp(Number(x.tacklerWeight)||.75,.45,1.2), rw=clamp(Number(x.runnerWeight)||.68,.45,1.2);
    const ts=clamp(Number(x.tacklerSpeedRatio)||.8,0,1.4), rs=clamp(Number(x.runnerSpeedRatio)||.9,0,1.25);
    const tstr=clamp(Number(x.tacklerStrength)||.65,0,1.25), rstr=clamp(Number(x.runnerStrength)||.62,0,1.25);
    const angle=clamp(Number(x.angleQuality)||.8,.12,1), rear=!!x.rearGrab;
    const suppliedClosing=Number(x.closingRatio); const closing=clamp(Number.isFinite(suppliedClosing)?suppliedClosing:Math.max(0,ts-(rear?rs*.72:rs*.2)),0,1.5);
    const tMom=tw*ts,rMom=rw*rs,balance=clamp((Number(x.runnerAgility)||.58)*.42+rstr*.38+rw*.20,.28,1.2);
    const wrap=clamp(tstr*.52+angle*.28+closing*.20,.18,1.25);
    const force=clamp((tMom*.44+tstr*.31+closing*.25)*angle-balance*.16,0,1.7);
    const drag=rear?Math.round(clamp(5+Math.max(0,rMom+rstr*.34-(tMom*.72+wrap*.42))*31+rs*10,4,42)):0;
    const hitStick=!rear&&force>.86&&ts>.80&&angle>.55;
    const launch=hitStick?Math.round(clamp(8+Math.max(0,force-.70)*42,7,52)):0;
    return {rearGrab:rear,force,drag,hitStick,launch,tacklerMomentum:tMom,runnerMomentum:rMom,wrapQuality:wrap};
  };
  window.__GRIDIRON_SIMULATE_V156=function(iterations){
    iterations=Math.max(1000,iterations||100000); const errors=[]; let rearChecks=0,frontChecks=0;
    for(let i=0;i<iterations;i++){
      const rear=i%2===0; const r=window.__GRIDIRON_CONTACT_MODEL_V156({rearGrab:rear,tacklerWeight:.48+(i%65)/100,tacklerSpeedRatio:(i%141)/100,runnerWeight:.48+((i*7)%65)/100,runnerSpeedRatio:((i*11)%126)/100,tacklerStrength:((i*13)%126)/100,runnerStrength:((i*17)%126)/100,runnerAgility:((i*19)%126)/100,angleQuality:.12+((i*23)%89)/100});
      if(!Number.isFinite(r.force+r.drag+r.launch+r.wrapQuality))errors.push('nonfinite '+i);
      if(rear){rearChecks++;if(r.hitStick||r.drag<4||r.drag>42)errors.push('rear '+i)}else{frontChecks++;if(r.drag!==0||r.launch<0||r.launch>52)errors.push('front '+i)}
      if(errors.length>20)break;
    }
    return {ok:errors.length===0,iterations,errors,rearChecks,frontChecks};
  };
  window.__GRIDIRON_FEATURES__=Object.assign({},window.__GRIDIRON_FEATURES__||{},{realisticMomentumV156:true,rearGrabDragV156:true,relativeVelocityV156:true,wrapQualityV156:true,balanceAndLegDriveV156:true});
})();
