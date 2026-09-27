


(function(){"use strict";
var SAVE='gridiron_save_v1', BACKUP='gridiron_save_v1_backup', SCHEMA=1;
function migrate(e){ e.schemaVersion=Number(e.schemaVersion!=null?e.schemaVersion:SCHEMA); return e; }
function read(k){ var i=localStorage.getItem(k); if(!i)return null; try{return JSON.parse(i)}catch(err){return null} }
/* ===== v150 A A DAMAGED SAVE HAS SOMEWHERE TO GO =====
 * A save is a save only if it is an object carrying `prestige` (a bare JSON value used to reach migrate() and
 * throw). When the main key will not read, the one-deep backup is tried, then the v149 D rolling backups
 * (rib_backup_v149_*, newest first); the unreadable text is kept under gridiron_save_v1_corrupt, and
 * window.__saveRecoveredV150 says what happened so the career app can tell the player. And the one-deep
 * backup is only overwritten by text that looks whole — a damaged save no longer evicts the good copy. */
function isSave(e){ return !!e && typeof e==='object' && !Array.isArray(e) && ('prestige' in e); }
function rolling(){ try{ var idx=JSON.parse(localStorage.getItem('rib_backups_v149')||'[]'); if(!Array.isArray(idx))return null; for(var i=0;i<idx.length;i++){ var m=idx[i]||{}, e=read('rib_backup_v149_'+m.id); if(isSave(e))return {save:e,meta:m}; } }catch(err){} return null; }
function whole(t){ return typeof t==='string' && t.charAt(0)==='{' && t.charAt(t.length-1)==='}'; }
window.GridironStorage={
  load:function(){
    var raw=localStorage.getItem(SAVE), e=read(SAVE); if(isSave(e))return migrate(e);
    if(raw){ try{ localStorage.setItem(SAVE+'_corrupt',raw); }catch(err){} }
    var note=function(from,at){ window.__saveRecoveredV150={from:from,at:at||0,had:!!raw}; };
    var i=read(BACKUP); if(isSave(i)){ if(raw)note('backup'); return migrate(i); }
    var r=rolling(); if(r){ note('rolling',r.meta.at); return migrate(r.save); }
    if(raw)note('fresh');
    return null;
  },
  save:function(e){ var i=migrate(typeof structuredClone==='function'?structuredClone(e):JSON.parse(JSON.stringify(e))); var l=localStorage.getItem(SAVE); if(l&&whole(l))localStorage.setItem(BACKUP,l); localStorage.setItem(SAVE,JSON.stringify(i)); try{window.__savePulse&&window.__savePulse();}catch(err){} },
  export:function(){ return localStorage.getItem(SAVE); }
};
var inst;
function bridge(){ if(!inst){ try{ inst=new window.PhaserFieldBridge(); }catch(e){ return Promise.reject(e); } } return Promise.resolve(inst); }
// defer the big TOUCHDOWN banner + cinema flash until the play finishes on screen
(function(){
  var stash=null;
  function watch(id, isFlash){
    var el=document.getElementById(id);
    if(!el) return;
    new MutationObserver(function(){
      if(window.__playAnimating && el.classList.contains('go')){
        if(!isFlash) stash={id:id, html:el.innerHTML, border:el.style.borderColor};
        el.classList.remove('go');
      }
    }).observe(el,{attributes:true,attributeFilter:['class']});
  }
  watch('momentBanner',false); watch('cinemaFlash',true);
  // legacy fires banners synchronously BEFORE calling animate — capture those too
  window.__captureBanners=function(){
    var mb=document.getElementById('momentBanner');
    if(mb&&mb.classList.contains('go')){ stash={id:'momentBanner',html:mb.innerHTML,border:mb.style.borderColor}; mb.classList.remove('go'); }
    var cf=document.getElementById('cinemaFlash');
    if(cf&&cf.classList.contains('go')) cf.classList.remove('go');
  };
  window.__flushDeferred=function(){
    if(!stash) return;
    var el=document.getElementById(stash.id);
    if(el){ el.innerHTML=stash.html; if(stash.border)el.style.borderColor=stash.border;
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      var f=document.getElementById('cinemaFlash');
      if(f){ f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); } }
    stash=null;
  };
})();
// autosave pulse
(function(){
  var last=0, el=null;
  window.__savePulse=function(){
    var now=Date.now(); if(now-last<4000) return; last=now;
    if(!el){ el=document.createElement('div'); el.id='savePulse';
      el.style.cssText='position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 64px);z-index:170;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.5px;color:#57e07a;background:#0b1119e6;border:1px solid rgba(87,224,122,.4);border-radius:12px;padding:3px 9px;opacity:0;transition:opacity .3s;pointer-events:none';
      el.textContent='SAVED ✓'; document.body.appendChild(el); }
    el.style.opacity='1'; setTimeout(function(){ el&&(el.style.opacity='0'); }, 900);
  };
})();
// post-boot runtime errors surface as a toast instead of failing silently
(function(){
  var last=0;
  window.addEventListener('error', function(e){
    var splash=document.getElementById('splash');
    if(splash && splash.style.display!=='none' && !splash.classList.contains('gone')) return;
    var now=Date.now(); if(now-last<30000) return; last=now;
    var t=document.getElementById('toast');
    if(t){ t.textContent='⚠ '+(e.message||'runtime error').slice(0,80); t.classList.add('show');
      setTimeout(function(){t.classList.remove('show');},2600); }
  });
})();
/* ===== v163 A THE GAME NEVER STOPS (the watch on every play) =====
 * The career app hands a play to the field and waits for it to come back (`fin`). Everything that decides whether it
 * comes back lives inside Phaser — so if Phaser's loop stops (a thrown frame before v163 A's guard, a pause whose
 * resume never arrived after an app switch) or the scene holding the play goes away (a remount), the game waited
 * forever. This watch is on the WALL clock, outside Phaser, and counts only while the page is visible (a hidden tab is
 * paused, not stalled):
 *   - the loop's frame counter has not moved for `v163AstallMs` (4 s) → restart the loop (TimeStep.wake); still not
 *     moving after another window → release the play;
 *   - the play is not on the live scene (no scene holds this play's completion, and none is booting) for
 *     `v163AorphanMs` (5 s) → release it;
 *   - the field is still booting (the play waits in the bridge's queue) after `v163AbootMs` (12 s) → release it;
 *   - a ceiling, `v163AplayMaxMs` (120 s) of visible time → release it.
 * Releasing stops whatever is left of the play on the field and hands the play back, so the log moves on (the score
 * and the stats were never the animation's — the drawn play is skipped, nothing else). `fin` runs once whoever calls
 * it, so a late completion after a release is ignored. Kill switch `TU("v163A", 0)`. `window.__V163A`; `v163Acheck`. */
var activeWatchV163A=null;
function tuV163A(k,d){ try{ return typeof TU==='function'?TU(k,d):d; }catch(e){ return d; } }
function watchPlayV163A(fin){
  if(!tuV163A('v163A',1)) return null;
  var V=window.__V163A=window.__V163A||{caught:0,swept:0,restarts:0,released:0,tickErrors:0,errors:[]};
  var STALL=tuV163A('v163AstallMs',4000), ORPHAN=tuV163A('v163AorphanMs',5000), MAX=tuV163A('v163AplayMaxMs',120000);
  var BOOT=tuV163A('v163AbootMs',12000);
  var last=Date.now(), vis=0, lastFrame=null, still=0, orphan=0, boot=0, restarted=false;
  var release=function(why){
    V.released++; (V.releases=V.releases||[]).push({why:why,at:Date.now(),visMs:vis}); if(V.releases.length>12) V.releases.shift();
    try{ console.warn('[v163 A] the play was handed back: '+why); }catch(e){}
    try{ var sc=inst&&inst.scene; if(sc&&sc.completion===fin){ sc.completion=void 0; if(sc.softStop) sc.softStop(); } }catch(e){}
    fin();
  };
  var iv=setInterval(function(){
    var now=Date.now(), dt=Math.min(1000,now-last); last=now;
    if(document.hidden) return;
    vis+=dt;
    var sc=inst&&inst.scene, g=sc&&sc.game, fr=g&&g.loop?g.loop.frame:null;
    if(fr!=null){
      if(fr===lastFrame) still+=dt; else { still=0; lastFrame=fr; }
      if(still>=STALL){
        if(!restarted){ restarted=true; still=0; V.restarts++;
          try{ var L=g.loop; if(L.raf) L.raf.stop(); L.running=false; L.wake(); }catch(e){} }
        else return release('the frame loop stopped');
      }
    }
    var booting=!!(inst&&!inst.scene&&inst.pending&&inst.pending.length);
    if(booting) boot+=dt;
    if(!(sc&&sc.completion===fin)&&!booting) orphan+=dt; else orphan=0;
    if(orphan>=ORPHAN) return release('no scene holds the play');
    if(boot>=BOOT) return release('the field never finished booting');
    if(vis>=MAX) return release('the play never finished');
  },250);
  return iv;
}
window.GridironPhaser={
  drawStatic:function(t){ if (typeof window.PhaserFieldBridge !== 'function') return false;
    return document.querySelector('#field')?(bridge().then(function(o){o.drawStatic(t)}).catch(function(){}),true):false; },
  animate:function(t,o){
    if (typeof window.PhaserFieldBridge !== 'function') return false;   // legacy 2D fallback
    // the game renders the play result (incl. TOUCHDOWN text) BEFORE animating;
    // hold the previous commentary on screen until the play finishes
    var el=document.querySelector('#screen .commentary')||document.querySelector('.commentary');
    var held=null;
    if(el){ held={h:el.innerHTML,k:el.className};
      if(window.__prevComm){ el.innerHTML=window.__prevComm.h; el.className=window.__prevComm.k; }
      else el.style.visibility='hidden';
    }
    // v97: the loader goes first. While the live game's loader is up, the first play holds at
    // the door and starts the moment the chase has run its exit — load, then run, in that order.
    // v101: and the wait is no longer dead time. The field mounts and the play's whole script
    // is built while the chase runs; the loader is told the moment that finishes, so the door
    // opens onto a play already choreographed and the cross-fade lands on live football.
    var L=window.__LIVELOAD_V94;
    try{ L&&L.ensure&&L.ensure(); }catch(e){}   // v101: claim the door before testing it
    if(L&&L.current&&!L.current.done&&!o.__heldV97){ var self=this, args=arguments;
      var told=function(){ try{ L.simReady&&L.simReady(); }catch(e){} };
      try{ bridge().then(function(s){ try{ s.prewarm(t, told); }catch(e){ told(); } }).catch(told); }catch(e){ told(); }
      L.whenClear(function(){ try{ self.animate.apply(self,args); }catch(e){ try{o();}catch(_){} } }); return document.querySelector('#field')?true:false; }
    window.__playAnimating=true;
    try{ window.__captureBanners&&window.__captureBanners(); }catch(e){}
    var finished=false, watch=null;   // v163 A: the play is handed back exactly once, whoever gets there first
    var fin=function(){
      if(finished) return; finished=true; if(watch){ clearInterval(watch); watch=null; }
      window.__playAnimating=false;
      if(el&&held){ try{ el.innerHTML=held.h; el.className=held.k; el.style.visibility=''; window.__prevComm=held; }catch(e){} }
      try{ window.__flushDeferred&&window.__flushDeferred(); }catch(e){}
      o();
    };
    if(!document.querySelector('#field')) return false;
    bridge().then(function(s){s.animate(t,fin)}).catch(function(){fin()});
    watch=watchPlayV163A(fin); activeWatchV163A=watch;
    return true;
  },
  cancel:function(){ if(activeWatchV163A){ clearInterval(activeWatchV163A); activeWatchV163A=null; } if(inst)inst.cancel(); },   // v163 A: a skipped game is not a stalled one
  destroy:function(){ if(inst)inst.destroy(); inst=undefined; }
};
})();


