
/* ===== v50 SPEED THROUGH — tap a rolling decision to run it at 5x =====
 * Every decision in this game rolls itself: the wheel picks on personality, the
 * fit roll decides whether it pays. The player's only real input was patience.
 * This gives that input a job — a tap anywhere on a rolling decision multiplies
 * the REST of its animation by TU("decideSpeed", 5). Every delay in a decision
 * goes through DS.wait(), so the boost lands mid-spin instead of only at the
 * next stage. One shared rate so the v16.6 story wheel and the v50 growth wheel
 * speed up the same way. */
(function(){
  "use strict";
  const T=(k,d)=>{try{return window.TU?window.TU(k,d):d}catch(e){return d}};
  const DS={
    rate:1,
    reset(){this.rate=1;this._hint=null;return this},
    boost(){if(this.rate>1)return false;this.rate=Math.max(1,+T("decideSpeed",5)||5);
      if(this._hint){this._hint.textContent=Math.round(this.rate)+"× ▸▸▸▸";this._hint.classList.add("ds50-hot")}
      return true},
    // the one timer every rolling decision schedules through
    wait(ms,fn){return setTimeout(fn,Math.max(8,ms/(this.rate||1)))},
    // scale a duration for animations that tween rather than step
    ms(v){return Math.max(8,v/(this.rate||1))},
    // arm an overlay: any pointer or key input speeds up the rest of the roll.
    // Buttons keep working — this listens, it never swallows the event.
    arm(el,hint){
      if(!el||el._ds50)return this;el._ds50=1;this.reset();this._hint=hint||null;
      if(this._hint)this._hint.textContent="tap to speed up ▸▸";
      const go=()=>this.boost();
      el.addEventListener("pointerdown",go,true);
      el.addEventListener("keydown",go,true);
      window.addEventListener("keydown",go,true);
      this._off=()=>{try{el.removeEventListener("pointerdown",go,true);el.removeEventListener("keydown",go,true);window.removeEventListener("keydown",go,true)}catch(e){}};
      return this},
    disarm(){try{this._off&&this._off()}catch(e){}this._off=null;return this.reset()}
  };
  window.__DECIDE_SPEED_V50=DS;
  const st=document.createElement("style");
  st.textContent=".ds50-hint{font:700 10px Oswald;letter-spacing:2px;color:#8fa2bb;text-align:center;margin-top:8px;transition:color .2s}"
    +".ds50-hint.ds50-hot{color:#f0bb45;text-shadow:0 0 10px rgba(240,187,69,.55)}";
  document.head.appendChild(st);
})();
