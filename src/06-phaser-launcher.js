


(function(){"use strict";
var SAVE='gridiron_save_v1', BACKUP='gridiron_save_v1_backup', SCHEMA=1;
function migrate(e){ e.schemaVersion=Number(e.schemaVersion!=null?e.schemaVersion:SCHEMA); return e; }
function read(k){ var i=localStorage.getItem(k); if(!i)return null; try{return JSON.parse(i)}catch(err){return null} }
window.GridironStorage={
  load:function(){ var e=read(SAVE); if(e)return migrate(e); var i=read(BACKUP); return i?migrate(i):null; },
  save:function(e){ var i=migrate(typeof structuredClone==='function'?structuredClone(e):JSON.parse(JSON.stringify(e))); var l=localStorage.getItem(SAVE); if(l)localStorage.setItem(BACKUP,l); localStorage.setItem(SAVE,JSON.stringify(i)); try{window.__savePulse&&window.__savePulse();}catch(err){} },
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
    var fin=function(){
      window.__playAnimating=false;
      if(el&&held){ try{ el.innerHTML=held.h; el.className=held.k; el.style.visibility=''; window.__prevComm=held; }catch(e){} }
      try{ window.__flushDeferred&&window.__flushDeferred(); }catch(e){}
      o();
    };
    return document.querySelector('#field')?(bridge().then(function(s){s.animate(t,fin)}).catch(function(){fin()}),true):false;
  },
  cancel:function(){ if(inst)inst.cancel(); },
  destroy:function(){ if(inst)inst.destroy(); inst=undefined; }
};
})();


