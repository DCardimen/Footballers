
(function(){
  "use strict";
  /* ===== PLAYER GEAR OVERLAY TOGGLE =====================================
   * The vector "appearance" overlay below draws a second, procedural player
   * (skin/hair/beard + helmet shell, facemask, visor, sleeves, gloves, neck
   * roll, back plate, towel, knee pads, high socks, etc.) ON TOP of the baked
   * pixel-art sprite. Stacked on the sprite it reads as cluttered "too much
   * gear", so it is disabled for now — the clean baked sprites carry facing
   * and animation on their own.
   *
   * TO RE-IMPLEMENT LATER: flip GEAR_OVERLAY_ENABLED back to true. Everything
   * needed (traits, front/rear groups, per-frame flip in updateAppearance) is
   * still here and untouched — the only change is the early skip below. Better
   * still, trim traitsFor()/applyAppearance() to the few accessories you want
   * before turning it back on so it complements the sprite instead of doubling
   * it. Body/shadow sizing per position is NOT gear and stays on either way.
   * ===================================================================== */
  const GEAR_OVERLAY_ENABLED = false;
  const SKINS=[0x2b160f,0x4a281a,0x6b3d25,0x8c5837,0xb97850,0xd5a276,0xf0c7a2,0xf6d8bd];
  const HAIR=[0x130d0a,0x21140d,0x3a2418,0x5a3924,0x8a5b35];
  const POS_SIZE={
    OL:[1.19,1.12],DT:[1.17,1.10],DL:[1.15,1.09],DE:[1.10,1.08],TE:[1.09,1.07],
    LB:[1.07,1.06],RB:[1.03,1.03],QB:[1.00,1.04],S:[0.98,1.01],WR:[0.94,1.00],CB:[0.93,0.99]
  };
  function hash(str){let h=2166136261>>>0;str=String(str);for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function unit(seed,n){let x=(seed+Math.imul(n+1,2654435761))>>>0;x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;x=Math.imul(x,3266489909);return((x^(x>>>16))>>>0)/4294967295;}
  function choose(arr,seed,n){return arr[Math.min(arr.length-1,Math.floor(unit(seed,n)*arr.length))];}
  function traitsFor(m,pos,index){
    const seed=hash([m.team,m.num,pos,index].join("|"));
    const base=POS_SIZE[pos]||[1,1];
    const skin=choose(SKINS,seed,1), hair=choose(HAIR,seed,2);
    const beardRoll=unit(seed,3);
    return {
      seed,skin,hair,
      width:base[0]+(unit(seed,4)-.5)*.075,
      height:base[1]+(unit(seed,5)-.5)*.065,
      shoulder:0.93+unit(seed,6)*.18,
      muscle:unit(seed,7),
      beard:beardRoll>.43,
      beardStyle:beardRoll>.82?"full":beardRoll>.62?"goatee":"stubble",
      hairStyle:choose(["fade","curly","braids","shaved","short"],seed,8),
      visor:unit(seed,9)>.70,
      visorTint:choose([0x111827,0x34516b,0x7b4b2a,0x3b2d55],seed,10),
      eyeBlack:unit(seed,11)>.52,
      sleeves:unit(seed,12)>.48,
      sleeveLong:unit(seed,13)>.67,
      gloves:unit(seed,14)>.34,
      wristTape:unit(seed,15)>.47,
      armBand:unit(seed,16)>.58,
      neckRoll:["OL","DT","DL","LB"].includes(pos)&&unit(seed,17)>.44,
      towel:unit(seed,18)>.66,
      backPlate:["RB","LB","TE","QB"].includes(pos)&&unit(seed,19)>.54,
      kneePads:unit(seed,20)>.35,
      sockHigh:unit(seed,21)>.52,
      cleats:choose(["black","white","team"],seed,22),
      facemask:choose(["standard","cage","speed"],seed,23),
      helmetFit:choose(["tight","standard","high"],seed,24),
      scar:unit(seed,25)>.88,
      tattoo:unit(seed,26)>.68,
      mouthguard:unit(seed,27)>.73,
      handed:unit(seed,28)>.5?"right":"left",
      stanceWide:unit(seed,29)>.54,
      posture:choose(["upright","forward","compact"],seed,30),
      chinstrap:unit(seed,31)>.45,
      stripe:unit(seed,32)>.58
    };
  }
  function teamColor(m){var hx=function(v){try{var h=parseInt(String(v).replace("#",""),16);return isNaN(h)?null:h;}catch(_){return null;}};if((m.kit||m.team)==="def"||(m.team==="you"&&m.kitSide==="def")){return (window.__oppJerseyV25!=null?window.__oppJerseyV25:0xd54d51);}if(window.__usJerseyV25!=null)return window.__usJerseyV25;var tc=window.__GRIDIRON_TEAM_CUSTOM__,c=tc&&tc.col&&hx(tc.col[0]);return c!=null?c:0x3fae5c;}
  function addLocal(scene,type,args){const obj=scene.add[type](...args);obj.setScrollFactor&&obj.setScrollFactor(1);return obj;}
  window.__RIB20_applyAppearance=function(scene,m,pos,index){
    if(!scene||!m||!m.root||!m.body)return;
    const appearanceKey=[m.team,pos,m.num].join("|");
    if(m._rib20Appearance){
      if(m._rib20AppearanceKey!==appearanceKey){try{m._rib20Appearance.destroy(true);}catch(e){}m._rib20Appearance=null;}
      else return;
    }
    const t=traitsFor(m,pos,index);m._rib20Traits=t;m._rib20Pos=pos;m._rib20AppearanceKey=appearanceKey;
    // Keep the subtle per-position body sizing, but skip the gear overlay while disabled.
    if(!GEAR_OVERLAY_ENABLED){
      m._rib20Appearance=null;m._rib20FrontGroup=null;m._rib20RearGroup=null;
      m.body.setScale(t.width,t.height);m.shadow.setScale(.88+t.width*.13,.88+t.width*.09);
      m._rib20TraitCount=Object.keys(t).length;
      return;
    }
    const jersey=teamColor(m), common=[], front=[], rear=[];
    const armY=t.posture==="forward"?0:-1, armW=4.2+(t.muscle*.9), armH=12+(t.muscle*2.3);
    const leftArm=addLocal(scene,"rectangle",[-10.5,armY,armW,armH,t.skin,1]).setOrigin(.5,.35);
    const rightArm=addLocal(scene,"rectangle",[10.5,armY,armW,armH,t.skin,1]).setOrigin(.5,.35);
    leftArm.setRotation(-.14);rightArm.setRotation(.14);common.push(leftArm,rightArm);
    if(t.sleeves){
      const sh=t.sleeveLong?9:5.5;
      common.push(addLocal(scene,"rectangle",[-10.5,-2.8,armW+1,sh,jersey,1]).setOrigin(.5,.2).setRotation(-.14));
      common.push(addLocal(scene,"rectangle",[10.5,-2.8,armW+1,sh,jersey,1]).setOrigin(.5,.2).setRotation(.14));
    }
    if(t.tattoo)common.push(addLocal(scene,"rectangle",[-11,3,1.2,6,0x273247,.78]).setRotation(-.14));
    if(t.armBand)common.push(addLocal(scene,"rectangle",[10.6,1.5,5.5,1.7,0x111827,.95]).setRotation(.14));
    if(t.wristTape)common.push(addLocal(scene,"rectangle",[-11.2,6.5,5.3,2.2,0xf5f3e9,1]).setRotation(-.14));
    if(t.gloves){
      const gc=t.cleats==="white"?0xf5f5f5:(t.cleats==="team"?jersey:0x15191f);
      common.push(addLocal(scene,"ellipse",[-11.4,8.3,5.2,4.1,gc,1]),addLocal(scene,"ellipse",[11.4,8.3,5.2,4.1,gc,1]));
    }
    const faceY=t.helmetFit==="high"?-11.3:-10.2;
    front.push(addLocal(scene,"ellipse",[0,faceY,12.8,10.2,t.skin,1]).setStrokeStyle(1,0x0c1016,.65));
    front.push(addLocal(scene,"ellipse",[-6.3,faceY+.3,2.4,3.8,t.skin,1]),addLocal(scene,"ellipse",[6.3,faceY+.3,2.4,3.8,t.skin,1]));
    if(t.hairStyle!=="shaved"){
      const hh=t.hairStyle==="braids"?4.2:t.hairStyle==="curly"?3.5:2.6;
      front.push(addLocal(scene,"ellipse",[0,faceY-4.3,12.2,hh,t.hair,1]));
      if(t.hairStyle==="braids")front.push(addLocal(scene,"rectangle",[-4.3,faceY+1.5,1.4,8,t.hair,1]),addLocal(scene,"rectangle",[4.3,faceY+1.5,1.4,8,t.hair,1]));
    }
    if(t.beard){
      const bh=t.beardStyle==="full"?5.5:t.beardStyle==="goatee"?3.8:2.6;
      front.push(addLocal(scene,"ellipse",[0,faceY+3.1,10.3,bh,t.hair,t.beardStyle==="stubble"?.58:.92]));
      if(t.beardStyle==="goatee")front.push(addLocal(scene,"rectangle",[0,faceY+4.3,2.6,4.7,t.hair,.95]));
    }
    if(t.eyeBlack)front.push(addLocal(scene,"rectangle",[-3.6,faceY,3.4,1.1,0x101010,.95]).setRotation(-.09),addLocal(scene,"rectangle",[3.6,faceY,3.4,1.1,0x101010,.95]).setRotation(.09));
    if(t.scar)front.push(addLocal(scene,"rectangle",[3.1,faceY-1.2,.8,4.2,0x7b3026,.9]).setRotation(.45));
    if(t.visor)front.push(addLocal(scene,"rectangle",[0,faceY-1.2,13.2,4.8,t.visorTint,.72]).setStrokeStyle(1,0xcfe8ff,.45));
    if(t.mouthguard)front.push(addLocal(scene,"rectangle",[0,faceY+2.8,4.5,1.5,0xf4f4f4,1]));
    const mask=scene.add.graphics();mask.lineStyle(t.facemask==="cage"?1.5:1.1,0xc7ccd2,.95);
    mask.strokeLineShape(new Phaser.Geom.Line(-6,faceY+2.1,6,faceY+2.1));mask.strokeLineShape(new Phaser.Geom.Line(-5,faceY+2.1,-5,faceY+6.2));mask.strokeLineShape(new Phaser.Geom.Line(5,faceY+2.1,5,faceY+6.2));
    if(t.facemask==="cage")mask.strokeLineShape(new Phaser.Geom.Line(-4,faceY+4.2,4,faceY+4.2));front.push(mask);
    if(t.chinstrap)front.push(addLocal(scene,"rectangle",[0,faceY+5.2,7.2,1.1,0xf2f2f2,.95]));

    // True rear view: helmet shell, rear stripe/hair, name plate and back gear.
    rear.push(addLocal(scene,"ellipse",[0,faceY-1,15.2,13.3,0x202936,1]).setStrokeStyle(1.2,0x080c12,.9));
    if(t.stripe)rear.push(addLocal(scene,"rectangle",[0,faceY-2.2,2.5,11.5,jersey,.92]));
    if(t.hairStyle!=="shaved"){
      const rh=t.hairStyle==="braids"?5:t.hairStyle==="curly"?4:2.8;
      rear.push(addLocal(scene,"ellipse",[0,faceY+4,11.8,rh,t.hair,1]));
      if(t.hairStyle==="braids")rear.push(addLocal(scene,"rectangle",[-3.8,faceY+6.8,1.5,7,t.hair,1]),addLocal(scene,"rectangle",[3.8,faceY+6.8,1.5,7,t.hair,1]));
    }
    rear.push(addLocal(scene,"rectangle",[0,-2.5,15.5,4.1,0xf3f3ed,.22]).setStrokeStyle(.7,0xffffff,.24));
    if(t.neckRoll)common.push(addLocal(scene,"ellipse",[0,-3.4,20,8,0x18202b,.9]).setStrokeStyle(1,jersey,.8));
    if(t.backPlate)common.push(addLocal(scene,"rectangle",[0,8.5,14,5,0x202834,.95]).setStrokeStyle(1,jersey,.8));
    if(t.towel)common.push(addLocal(scene,"rectangle",[t.handed==="right"?6:-6,12.5,4,9,0xf3f0e8,.9]).setRotation(t.handed==="right"?.1:-.1));
    if(t.kneePads)common.push(addLocal(scene,"ellipse",[-4.7,15,4.4,3.2,0xe7e9ec,.9]),addLocal(scene,"ellipse",[4.7,15,4.4,3.2,0xe7e9ec,.9]));
    if(t.sockHigh)common.push(addLocal(scene,"rectangle",[-4.8,19,3.4,6,0xf0f0f0,.92]),addLocal(scene,"rectangle",[4.8,19,3.4,6,0xf0f0f0,.92]));
    if(t.muscle>.48){const mg=scene.add.graphics();mg.lineStyle(1,0x301b13,.48);mg.strokeLineShape(new Phaser.Geom.Line(-12,-1,-10.2,3.8));mg.strokeLineShape(new Phaser.Geom.Line(12,-1,10.2,3.8));common.push(mg);}
    const frontGroup=scene.add.container(0,0,front),rearGroup=scene.add.container(0,0,rear);rearGroup.setVisible(false);
    const app=scene.add.container(0,0,[...common,frontGroup,rearGroup]);app.name="rib21-player-appearance";app.__rib20=true;app.__rib21=true;
    m.root.add(app);m.root.bringToTop(m.label);m._rib20Appearance=app;m._rib20FrontGroup=frontGroup;m._rib20RearGroup=rearGroup;
    m.body.setScale(t.width,t.height);m.shadow.setScale(.88+t.width*.13,.88+t.width*.09);m._rib20TraitCount=Object.keys(t).length;
  };
  window.__RIB20_updateAppearance=function(scene,m,state,spd){
    const t=m&&m._rib20Traits,app=m&&m._rib20Appearance;if(!t||!app)return;
    m.body.setScale(t.width,t.height);
    const side=(m.flip&&(m.dirKey==="sd"||m.dirKey==="dr"||m.dirKey==="ur"))?-1:1;
    const rear=m.dirKey==="up"||m.dirKey==="ur";
    app.setScale(side*t.width,t.height);app.x=0;app.y=t.posture==="compact"?1:(t.posture==="forward"?2:0);
    app.setVisible(state!=="down"&&state!=="dive"&&state!=="stance"&&state!=="stance2"&&state.indexOf("tackle")!==0);app.setAlpha(1);
    if(m._rib20FrontGroup)m._rib20FrontGroup.setVisible(!rear);
    if(m._rib20RearGroup)m._rib20RearGroup.setVisible(rear);
    m._ribRearApparelVisible=rear&&!!m._rib20RearGroup&&m._rib20RearGroup.visible;
    if(m.label)m.label.setDepth(50);
  };
  window.__RIB20_createFootball=function(scene,x,y){
    // 58-60% smaller on screen than v15.20, with pointed ends and a leaner profile.
    const shell=scene.add.graphics();shell.fillStyle(0x8b4723,1);shell.lineStyle(1.15,0x180b06,1);
    const footballPoints=[
      new Phaser.Geom.Point(-12,0),new Phaser.Geom.Point(-8.2,-3.8),new Phaser.Geom.Point(-3.2,-5.7),
      new Phaser.Geom.Point(3.2,-5.7),new Phaser.Geom.Point(8.2,-3.8),new Phaser.Geom.Point(12,0),
      new Phaser.Geom.Point(8.2,3.8),new Phaser.Geom.Point(3.2,5.7),new Phaser.Geom.Point(-3.2,5.7),new Phaser.Geom.Point(-8.2,3.8)
    ];
    shell.fillPoints(footballPoints,true);shell.strokePoints(footballPoints,true);
    const seam=scene.add.rectangle(0,0,10.5,1,0xe8dcc5,1);
    const shine=scene.add.ellipse(-3.8,-2.8,6.5,1.8,0xe49a62,.42);
    const lace=scene.add.graphics();lace.lineStyle(.9,0xffffff,.96);for(let i=-3.5;i<=3.5;i+=1.75)lace.strokeLineShape(new Phaser.Geom.Line(i,-1.7,i,1.7));
    const stripe1=scene.add.rectangle(-7.3,0,1,8.5,0xf5f1df,.88),stripe2=scene.add.rectangle(7.3,0,1,8.5,0xf5f1df,.88);
    const ball=scene.add.container(x,y,[shell,stripe1,stripe2,shine,seam,lace]).setDepth(19);
    ball.name="rib21-sleek-football";ball.__rib20Football=true;ball.__rib21Football=true;ball.__baseWidth=24;ball.__baseHeight=12;
    // Child references let the renderer roll the laces around the long axis while
    // keeping the pointed nose aligned to the actual flight path.
    ball.__shell=shell;ball.__shine=shine;ball.__seam=seam;ball.__lace=lace;ball.__stripes=[stripe1,stripe2];
    ball.setVisible(true).setAlpha(1);return ball;
  };
  window.__RIB20_onFumble=function(scene,P,e){
    if(!scene||!P)return;
    if(P.__rib20Glow){try{P.__rib20Glow.destroy();}catch(_){} }
    P.__rib20Glow=scene.add.ellipse(scene.ballSpr?scene.ballSpr.x:0,scene.ballSpr?scene.ballSpr.y:0,24,13,0xff6b52,.14)
      .setStrokeStyle(1.25,0xffa270,.75).setDepth(18);
    if(scene.ballSpr){scene.ballSpr.setDepth(30).setVisible(true).setAlpha(1);}
  };
  window.__RIB20_syncFootballFx=function(scene,P,bh){
    if(!scene||!P||!scene.ballSpr)return;
    const ball=scene.ballSpr;ball.setVisible(true).setAlpha(1);
    const mode=P.ballMode||"ground",spiral=mode==="flight"||mode==="tip";
    if(ball.__lace&&ball.__seam&&ball.__shell){
      if(spiral){
        /* v109: the laces turn at the ball's own speed when the throw reported one, the style ladder when it did not */
        const rate=P.ballVelV109!=null?.052*P.ballVelV109/(window.TU?window.TU("ballVelRef",.36):.36):P.ballStyle==="bullet"?.072:P.ballStyle==="lob"?.038:.052;
        const phase=Math.max(0,P.t-(P.ballReleaseAt||0))*rate, face=Math.cos(phase), edge=Math.abs(face);
        ball.__shell.setScale(1,.88+edge*.12);
        ball.__lace.setY(Math.sin(phase)*1.7).setScale(1,.24+edge*.76).setAlpha(.18+Math.max(0,face)*.82);
        ball.__seam.setY(Math.sin(phase)*1.15).setAlpha(.22+edge*.72);
        if(ball.__shine)ball.__shine.setY(-2.8+Math.sin(phase)*1.25).setAlpha(.20+edge*.28);
        if(ball.__stripes)ball.__stripes.forEach(s=>s.setScale(1,.42+edge*.58).setAlpha(.42+edge*.46));
      }else{
        ball.__shell.setScale(1,1);ball.__lace.setPosition(0,0).setScale(1,1).setAlpha(.96);ball.__seam.setY(0).setAlpha(1);
        if(ball.__shine)ball.__shine.setY(-2.8).setAlpha(.42);
        if(ball.__stripes)ball.__stripes.forEach(s=>s.setScale(1,1).setAlpha(.88));
      }
    }
    if(P.__looseBall){
      ball.setDepth(30);
      if(P.__rib20Glow&&P.__rib20Glow.active){
        P.__rib20Glow.setPosition(ball.x,ball.y+4).setScale(1+Math.sin(P.t/85)*.12).setVisible(true);
      }
    }
  };
  window.__RIB20_onRecovery=function(scene,P,e){
    if(P&&P.__rib20Glow){try{P.__rib20Glow.destroy();}catch(_){}P.__rib20Glow=null;}
    if(scene&&scene.ballSpr)scene.ballSpr.setVisible(true).setDepth(19);
  };
  // A real scene-mounted diagnostic. It refuses to claim success before Phaser is live.
  window.__GRIDIRON_PHASER_DIAGNOSTIC_V1520=function(){
    const scene=window.__gridironScene;
    const canvas=document.querySelector('#field');
    const rect=canvas?canvas.getBoundingClientRect():null;
    const markers=scene&&Array.isArray(scene.markers)?scene.markers:[];
    const skins=new Set(markers.map(m=>m._rib20Traits&&m._rib20Traits.skin).filter(v=>v!=null));
    const widths=markers.map(m=>m._rib20Traits&&m._rib20Traits.width).filter(Number.isFinite);
    return {
      mounted:!!scene, sceneKey:scene&&scene.scene&&scene.scene.key,
      playing:!!(scene&&scene.play), markers:markers.length,
      decorated:markers.filter(m=>m._rib20Appearance&&m._rib20Appearance.active!==false).length,
      skinTones:skins.size, beards:markers.filter(m=>m._rib20Traits&&m._rib20Traits.beard).length,
      traitCountMax:markers.reduce((n,m)=>Math.max(n,m._rib20TraitCount||0),0),
      sizeSpread:widths.length?Math.max(...widths)-Math.min(...widths):0,
      ballExists:!!(scene&&scene.ballSpr), vectorBall:!!(scene&&scene.ballSpr&&scene.ballSpr.__rib20Football),
      ballVisible:!!(scene&&scene.ballSpr&&scene.ballSpr.visible&&scene.ballSpr.alpha>0),
      ballX:scene&&scene.ballSpr&&scene.ballSpr.x, ballY:scene&&scene.ballSpr&&scene.ballSpr.y,
      canvasCssWidth:rect&&rect.width, canvasCssHeight:rect&&rect.height,
      canvasBackingWidth:canvas&&canvas.width, canvasBackingHeight:canvas&&canvas.height,
      rawBodyTextNodes:[...document.body.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim().length>50).length
    };
  };
  window.__GRIDIRON_PHASER_DIAGNOSTIC_V1521=function(){
    const base=window.__GRIDIRON_PHASER_DIAGNOSTIC_V1520?window.__GRIDIRON_PHASER_DIAGNOSTIC_V1520():{};
    const sc=window.__gridironScene,ms=sc&&sc.markers||[],ball=sc&&sc.ballSpr;
    return Object.assign({},base,{
      build:window.__GRIDIRON_BUILD__,sleekBall:!!(ball&&ball.__rib21Football),ballBase:[ball&&ball.__baseWidth,ball&&ball.__baseHeight],
      ballScale:ball?[ball.scaleX,ball.scaleY]:null,
      rearFacing:ms.filter(m=>m&&m._ribRearFacing).length,
      rearNumbersVisible:ms.filter(m=>m&&m._ribRearFacing&&m.label&&m.label.visible).length,
      rearApparelVisible:ms.filter(m=>m&&m._ribRearApparelVisible).length,
      sideNumbersVisible:ms.filter(m=>m&&m.dirKey==='sd'&&m._spdPx>18&&m.label&&m.label.visible).length,
      coveragePlan:sc&&sc.play&&sc.play.script&&sc.play.script.meta&&sc.play.script.meta.coveragePlan||null,
      ballMode:sc&&sc.play&&sc.play.ballMode||null,ballHolderId:sc&&sc.play&&sc.play.ballHolderId,
      handMountedBall:!!(sc&&sc.play&&sc.play.ballHolderId!=null&&ball&&sc.markers&&sc.markers[sc.play.ballHolderId]
        &&Math.abs(ball.x-sc.markers[sc.play.ballHolderId].root.x)>2)
    });
  };
  window.__GRIDIRON_BUILD__="15.21-sleek-ball-coverage-ai";
  window.__GRIDIRON_FEATURES__=Object.assign({},window.__GRIDIRON_FEATURES__,{
    version:"15.21",cleanPhaserRuntime:true,responsivePhaserCanvas:true,vectorFootball:true,
    sleekFootballV1521:true,persistentPlayerAppearance:true,rearFacingNumbersV1521:true,
    rearFacingApparelV1521:true,sideRunNumbersHidden:true,naturalFumblePursuit:true,
    linebackerPassDropsV1521:true,receiverBracketCoverageV1521:true,continuousCornerCoverageV1521:true,
    handMountedFootballV36:true,longAxisSpiralV36:true,ballisticDragV36:true,
    exactBoundaryPlanesV37:true,movementIQV37:true,directionalJukesV37:true,contactSlowMoV37:true,
    wholeFieldAccelerationV38:true,equalTalentBalanceV39:true,positionAwareStarImpactV40:true
  });
})();
