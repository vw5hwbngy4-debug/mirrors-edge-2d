(function(){
'use strict';

const body=document.body;
const stage=document.querySelector('[data-stage]');
const thumb=document.querySelector('[data-thumb]');
const poster=document.querySelector('[data-poster]');
const sceneFrame=document.querySelector('[data-scene-frame]');
const title=document.querySelector('[data-title]');
const badge=document.querySelector('[data-badge]');
const subtitle=document.querySelector('[data-subtitle]');
const count=document.querySelector('[data-count]');
const meta=document.querySelector('[data-meta]');
const walkCta=document.querySelector('[data-walk-cta]');
const enterWalk=document.querySelector('[data-enter-walk]');
const walkOverlay=document.querySelector('[data-walk-overlay]');
const walkFrame=document.querySelector('[data-walk-frame]');
const hint=document.querySelector('[data-swipe-hint]');
const noSession=document.querySelector('[data-no-session]');
const noSessionTitle=document.querySelector('[data-no-session-title]');
const modeButtons=[...document.querySelectorAll('[data-mode]')];
const library=document.querySelector('[data-library]');
const libraryGrid=document.querySelector('[data-library-grid]');
const iterationsPanel=document.querySelector('[data-iterations]');
const iterationsGrid=document.querySelector('[data-iterations-grid]');
const iterationsTitle=document.querySelector('[data-iterations-title]');
const edgeMaps=document.querySelector('[data-edge-maps]');
const edgeBuilds=document.querySelector('[data-edge-builds]');
const landingMaps=document.querySelector('[data-landing-maps]');
const landingBuilds=document.querySelector('[data-landing-builds]');
const landing=document.querySelector('[data-landing]');
const enterFeed=document.querySelector('[data-enter-feed]');
const drawer=document.querySelector('[data-drawer]');
const menuButton=document.querySelector('[data-menu]');
const menuSpeech=document.querySelector('[data-menu-speech]');
const menuSpeechText=document.querySelector('[data-menu-speech-text]');
const backdrop=document.querySelector('[data-backdrop]');

const humanCount=document.querySelector('[data-human-count]');
const botCount=document.querySelector('[data-bot-count]');
const hossieCount=document.querySelector('[data-hossie-count]');
const serverState=document.querySelector('[data-server-state]');
const landingStatus=document.querySelector('[data-landing-status]');

const MODES=['walk','overview','telemetry','maps','iterations'];
let maps=[],iterationsByMap={},mapIndex=0,modeIndex=0,busy=false,walkActive=false,pointer=null,wheelLock=false,landingActive=true;


function map(){return maps[mapIndex]}
function mode(){return MODES[modeIndex]}
function setModeButtons(){
  modeButtons.forEach((b,i)=>b.classList.toggle('active',i===modeIndex));
  document.querySelector('.mode-tabs')?.classList.toggle('side-view',mode()==='maps'||mode()==='iterations');
}
function setHintUsed(){hint?.classList.add('used');try{localStorage.setItem('spawnmap.swiped','1')}catch(_){}}
let menuSpeechTimers=[];
function clearMenuSpeechTimers(){
  menuSpeechTimers.forEach(clearTimeout);
  menuSpeechTimers=[];
}
function hideMenuSpeech(){
  clearMenuSpeechTimers();
  if(!menuSpeech)return;
  menuSpeech.classList.remove('show','long');
  menuSpeech.hidden=true;
}
function showMenuSpeechSequence(){
  if(!menuSpeech||!menuSpeechText||!drawer?.hidden)return;
  clearMenuSpeechTimers();

  menuSpeechText.textContent='hi.';
  menuSpeech.hidden=false;
  requestAnimationFrame(()=>menuSpeech.classList.add('show'));

  menuSpeechTimers.push(setTimeout(()=>{
    if(!menuSpeech||!menuSpeechText||!drawer?.hidden)return;
    menuSpeech.classList.add('long');
    menuSpeechText.textContent='hi, do you wanna die a painful death?';
  },4300));

  menuSpeechTimers.push(setTimeout(()=>{
    if(!menuSpeech)return;
    menuSpeech.classList.remove('show');
  },10300));

  menuSpeechTimers.push(setTimeout(()=>{
    if(menuSpeech)menuSpeech.hidden=true;
  },10750));
}
function openMenu(){
  hideMenuSpeech();
  drawer.hidden=false;backdrop.hidden=false;
}
function closeMenu(){drawer.hidden=true;backdrop.hidden=true}

menuButton?.addEventListener('click',openMenu);
menuButton?.addEventListener('mouseenter',()=>{if(drawer?.hidden)showMenuSpeechSequence()});
menuButton?.addEventListener('focus',()=>{if(drawer?.hidden)showMenuSpeechSequence()});
document.querySelector('[data-close-menu]')?.addEventListener('click',closeMenu);
backdrop?.addEventListener('click',closeMenu);

// Let the dots "wake up" shortly after the page becomes visible.
menuSpeechTimers.push(setTimeout(showMenuSpeechSequence,1400));

function sceneUrl(m,md,embedded=true){
  if(md==='overview'&&m.id==='suzhou')return '/image-to-unreal-map/viewer/overview.html?v=interactive-v85';
  if(md==='telemetry'&&m.id==='suzhou')return '/image-to-unreal-map/viewer/telemetry.html?v=85';
  const page=(m.id==='suzhou'&&m.kind==='gpt')?'/image-to-unreal-map/viewer/suzhou-feed.html':'/image-to-unreal-map/viewer/scene.html';
  return `${page}?map=${encodeURIComponent(m.id)}&mode=${encodeURIComponent(md)}&embed=${embedded?'1':'0'}`;
}

function revealScene(){
  if(mode()==='maps')return;
  stage.classList.add('scene-ready');
}

function buildLibrary(){
  if(!libraryGrid||!maps.length)return;
  libraryGrid.innerHTML='';
  maps.forEach((m,i)=>{
    const b=document.createElement('button');
    b.type='button';b.className='library-tile';
    b.innerHTML=`<img src="${m.thumb}" alt=""><span><small>${m.badge}</small><b>${m.title}</b></span>`;
    b.addEventListener('click',()=>{
      mapIndex=i;modeIndex=0;
      stage.classList.add('from-library');
      render();
      setTimeout(()=>stage.classList.remove('from-library'),220);
    });
    libraryGrid.appendChild(b);
  });
  const generate=document.createElement('button');
  generate.type='button';
  generate.className='library-tile generate-tile';
  generate.innerHTML=`<div class="generate-loop" aria-hidden="true"><i></i><i></i><i></i></div><span><small>LOCAL · INSTANT</small><b>IMPORT MAP</b></span>`;
  generate.title='Drop a T3D or SpawnMap artifact into the generic browser viewer.';
  generate.addEventListener('click',()=>location.href='/image-to-unreal-map/viewer/import.html');
  libraryGrid.appendChild(generate);
}


function buildIterations(){
  if(!iterationsGrid||!maps.length)return;
  const m=map(),rows=iterationsByMap[m.id]||[];
  iterationsTitle.textContent=(m.title+' · ITERATIONS · REMIXES').toUpperCase();
  iterationsGrid.innerHTML='';

  if(!rows.length){
    const empty=document.createElement('div');
    empty.className='iterations-empty';
    empty.innerHTML=`<small>NO SPAWNMAP ITERATIONS</small><strong>${m.title}</strong><span>Version history appears here for GPT-built maps when revisions exist.</span>`;
    iterationsGrid.appendChild(empty);
    return;
  }

  rows.forEach(row=>{
    const card=document.createElement('button');
    card.type='button';card.className='iteration-card';
    const shortSha=(row.sha256||'').slice(0,12);
    card.innerHTML=`<img src="${row.thumb||m.thumb}" alt=""><div class="iteration-shade"></div><div class="iteration-copy"><small>${row.status==='current'?'CURRENT':'ITERATION'}</small><strong>${row.label||row.iterationId}</strong><span>${shortSha?`SHA ${shortSha}`:''}</span></div>`;
    card.addEventListener('click',()=>{modeIndex=2;render();});
    iterationsGrid.appendChild(card);
  });

  const future=document.createElement('div');
  future.className='iteration-card future-iteration';
  future.innerHTML=`<div class="iteration-future-loop"><i></i></div><div class="iteration-copy"><small>NEXT REVISION</small><strong>FUTURE ITERATION</strong><span>Appears after build + test</span></div>`;
  iterationsGrid.appendChild(future);
}

function render(){
  if(!maps.length)return;
  const m=map(),md=mode();
  stage.classList.remove('scene-ready','maps-mode','iterations-mode','mode-walk','mode-overview','mode-telemetry','mode-maps','mode-iterations');
  stage.classList.add('mode-'+md);
  sceneFrame.removeAttribute('src');
  library.hidden=true;
  if(iterationsPanel)iterationsPanel.hidden=true;
  poster.hidden=false;
  meta.hidden=false;
  count.hidden=false;
  hint.hidden=false;
  if(noSession)noSession.hidden=true;
  title.textContent=m.title;
  badge.textContent=m.badge;
  count.textContent=`${mapIndex+1} / ${maps.length}`;
  thumb.src=m.thumb;
  thumb.alt=`${m.title} Tactical Ops map`;
  setModeButtons();

  // Side glows are affordances, not another navigation bar.
  // MAPS is always deliberately reachable from the three main views.
  if(edgeMaps)edgeMaps.hidden=!(md==='walk'||md==='overview'||md==='telemetry');
  // Iterations/remixes only make sense for GPT-built maps.
  if(edgeBuilds)edgeBuilds.hidden=!(m.kind==='gpt'&&(md==='walk'||md==='overview'||md==='telemetry'));

  if(md==='maps'){
    stage.classList.add('maps-mode');
    library.hidden=false;
    poster.hidden=true;
    meta.hidden=true;
    count.hidden=true;
    hint.hidden=true;
    walkCta.hidden=true;
    return;
  }

  if(md==='iterations'){
    stage.classList.add('iterations-mode');
    if(iterationsPanel)iterationsPanel.hidden=false;
    buildIterations();
    poster.hidden=true;
    meta.hidden=true;
    count.hidden=true;
    hint.hidden=true;
    walkCta.hidden=true;
    return;
  }

  if(md==='walk'){
    walkCta.hidden=false;
    subtitle.textContent=m.kind==='gpt'?'GPT-built Tactical Ops map':'Tactical Ops classic';
  }else{
    walkCta.hidden=true;
    subtitle.textContent=md==='overview'?'Drag to orbit · pinch to zoom':(m.telemetry?'Tactical session telemetry':'No server sessions recorded');

    if(md==='telemetry'){
      // Telemetry has its own visual language. Never stack the normal feed title/count
      // on top of tactical HUD panels.
      meta.hidden=true;
      count.hidden=true;
      hint.hidden=true;
    }

    if(md==='telemetry'&&!m.telemetry){
      // Important: do not touch the iframe at all here. Removing/changing its src can
      // generate an about:blank load event, which previously marked the blank iframe
      // scene-ready and let it steal all touch input.
      sceneFrame.removeAttribute('src');
      stage.classList.remove('scene-ready');
      poster.hidden=false;
      if(noSession){
        noSession.hidden=false;
        noSessionTitle.textContent=m.title;
      }
    }else{
      requestAnimationFrame(()=>sceneFrame.src=sceneUrl(m,md));
      // A load event fallback prevents an iframe from sitting invisible forever if
      // a browser loses the custom ready message.
      setTimeout(()=>{if(mode()===md&&!stage.classList.contains('scene-ready'))revealScene()},5000);
    }
  }
  prefetch();
}

function prefetch(){
  if(!maps.length)return;
  for(const m of [maps[(mapIndex+1)%maps.length],maps[(mapIndex-1+maps.length)%maps.length]]){
    const i=new Image();i.src=m.thumb;
  }
}

function animate(dir,update){
  if(busy||walkActive)return;
  busy=true;setHintUsed();
  stage.classList.add('anim-'+dir);
  setTimeout(()=>{
    update();
    stage.classList.remove('anim-'+dir);
    render();
    busy=false;
  },155);
}
function nextMap(delta){
  if(mode()==='maps'||!maps.length)return;
  animate(delta>0?'up':'down',()=>mapIndex=(mapIndex+delta+maps.length)%maps.length);
}
function openMaps(){
  if(mode()==='maps'||busy||walkActive)return;
  animate('left',()=>modeIndex=3);
}
function openIterations(){
  if(map()?.kind!=='gpt'||mode()==='iterations'||busy||walkActive)return;
  animate('right',()=>modeIndex=4);
}

function openLandingBuilds(){
  if(!maps.length)return;
  const firstGPT=maps.findIndex(m=>m.kind==='gpt');
  if(firstGPT>=0)mapIndex=firstGPT;
  dismissLanding();
  modeIndex=4;
  render();
}

modeButtons.forEach((b,i)=>b.addEventListener('click',()=>{
  if(i!==modeIndex)animate(i>modeIndex?'left':'right',()=>modeIndex=i);
}));

edgeMaps?.addEventListener('pointerdown',e=>e.stopPropagation());
edgeMaps?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openMaps()});
edgeBuilds?.addEventListener('pointerdown',e=>e.stopPropagation());
edgeBuilds?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openIterations()});
landingMaps?.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  dismissLanding();modeIndex=3;render();
});
landingBuilds?.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  openLandingBuilds();
});

function startWalk(){
  if(walkActive||!maps.length||mode()!=='walk')return;
  walkActive=true;walkOverlay.hidden=false;walkFrame.src=sceneUrl(map(),'walk',false);
}
function stopWalk(){
  if(!walkActive)return;
  walkActive=false;walkOverlay.hidden=true;walkFrame.removeAttribute('src');
}
enterWalk?.addEventListener('pointerdown',e=>e.stopPropagation());
enterWalk?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();startWalk()});

sceneFrame.addEventListener('load',()=>{
  const expected=sceneFrame.getAttribute('src');
  const expectedMode=mode();
  const expectedMap=map()?.id;
  if(!expected||expected==='about:blank')return;
  if(expectedMode==='telemetry'&&!map()?.telemetry)return;

  setTimeout(()=>{
    if(
      sceneFrame.getAttribute('src')===expected &&
      mode()===expectedMode &&
      map()?.id===expectedMap &&
      expectedMode!=='walk' &&
      expectedMode!=='maps' &&
      !(expectedMode==='telemetry'&&!map()?.telemetry) &&
      !stage.classList.contains('scene-ready')
    )revealScene();
  },1800);
});
window.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='spawnmap:sceneReady'&&e.source===sceneFrame.contentWindow)revealScene();
  if(d.type==='spawnmap:exitWalk')stopWalk();
  if(e.source===sceneFrame.contentWindow&&mode()==='telemetry'&&d.type==='spawnmap:openIterations')openIterations();
  if(e.source===sceneFrame.contentWindow&&mode()==='telemetry'&&d.type==='spawnmap:mapSwipe'&&Number.isFinite(+d.delta))nextMap(+d.delta);
});

stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;
  if(mode()==='maps'||mode()==='iterations')return;
  if(landingActive||walkActive||busy||e.button>0||e.target.closest?.('button,a'))return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};
  stage.setPointerCapture?.(e.pointerId);
});
stage.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch')return;
  if(e.target.closest?.('button,a')){pointer=null;return}
  if(!pointer||pointer.id!==e.pointerId||walkActive)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y,dt=performance.now()-pointer.t;
  pointer=null;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(Math.max(ax,ay)<42||dt>900)return;
  if(ay>ax*1.12){
    nextMap(dy<0?1:-1);
  }else if(ax>ay*1.05){
    if(mode()==='walk'&&dx<0)openMaps();
  }
});
stage.addEventListener('pointercancel',()=>pointer=null);

// Mobile horizontal gesture belongs to WALK only.
// Overview remains completely isolated; Telemetry handles its own right-swipe inside its iframe.
let feedTouch=null;
stage.addEventListener('touchstart',e=>{
  if(landingActive||walkActive||busy||mode()!=='walk'||!e.touches.length)return;
  if(e.target.closest?.('button,a'))return;
  const t=e.touches[0];
  feedTouch={x:t.clientX,y:t.clientY,t:performance.now()};
},{passive:true});

stage.addEventListener('touchmove',e=>{
  if(!feedTouch||mode()!=='walk'||!e.touches.length)return;
  const t=e.touches[0],dx=t.clientX-feedTouch.x,dy=t.clientY-feedTouch.y;
  // Suppress browser horizontal page gestures once this is clearly a left/right WALK swipe.
  if(Math.abs(dx)>Math.abs(dy)*1.12)e.preventDefault();
},{passive:false});

stage.addEventListener('touchend',e=>{
  if(!feedTouch||mode()!=='walk')return;
  const t=e.changedTouches?.[0];
  const dx=t?t.clientX-feedTouch.x:0,dy=t?t.clientY-feedTouch.y:0,dt=performance.now()-feedTouch.t;
  feedTouch=null;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(dt<950&&ax>=52&&ax>ay*1.10&&dx<0){
    openMaps();
  }else if(dt<950&&ay>=48&&ay>ax*1.10){
    nextMap(dy<0?1:-1);
  }
},{passive:true});
stage.addEventListener('touchcancel',()=>{feedTouch=null},{passive:true});
stage.addEventListener('wheel',e=>{
  if(mode()==='maps'||mode()==='iterations')return;
  if(landingActive||walkActive||busy||wheelLock)return;
  e.preventDefault();wheelLock=true;setTimeout(()=>wheelLock=false,280);
  const horizontal=e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)*.8;
  if(horizontal){
    const dx=e.deltaX||e.deltaY;
    if(mode()==='walk'&&dx>0)openMaps();
    else if(mode()==='telemetry'&&dx<0)openIterations();
  }else{
    nextMap(e.deltaY>0?1:-1);
  }
},{passive:false});

function dismissLanding(){
  if(!landingActive)return;
  landingActive=false;
  // Fundamental fix: the landing is a gate, not a feed slide.
  // Remove it from the DOM synchronously so it cannot snap back over the feed.
  body.classList.remove('landing-active');
  landing?.remove();
}
enterFeed?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();dismissLanding()});

// Mobile: track the gesture, but do NOT remove the touched element mid-gesture.
// Safari can behave badly when the current touch target disappears during touchmove.
let landingTouch=null;
landing?.addEventListener('touchstart',e=>{
  if(!landingActive||!e.touches.length)return;
  const t=e.touches[0];
  landingTouch={x:t.clientX,y:t.clientY,t:performance.now()};
},{passive:true});

landing?.addEventListener('touchmove',e=>{
  if(!landingActive||!landingTouch||!e.touches.length)return;
  const t=e.touches[0];
  const dx=t.clientX-landingTouch.x,dy=t.clientY-landingTouch.y;
  if(Math.abs(dy)>Math.abs(dx)*1.05)e.preventDefault();
},{passive:false});

landing?.addEventListener('touchend',e=>{
  if(!landingTouch)return;
  const t=e.changedTouches?.[0];
  const dy=t ? t.clientY-landingTouch.y : 0;
  const dx=t ? t.clientX-landingTouch.x : 0;
  const dt=performance.now()-landingTouch.t;
  landingTouch=null;
  if(dt>=1200)return;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(ax>=46&&ax>ay*1.08){
    if(dx<0){
      dismissLanding();
      modeIndex=3;render();
    }else{
      openLandingBuilds();
    }
  }else if(ay>=42&&ay>ax*1.05){
    dismissLanding();
  }
},{passive:true});

landing?.addEventListener('touchcancel',()=>{landingTouch=null},{passive:true});

// Desktop / trackpad.
landing?.addEventListener('wheel',e=>{
  if(!landingActive)return;
  if(Math.abs(e.deltaY)>8){
    e.preventDefault();
    dismissLanding();
  }
},{passive:false});

let landingMouse=null;
landing?.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button!==0||e.target.closest?.('button,a'))return;
  landingMouse={x:e.clientX,y:e.clientY,t:performance.now()};
});
landing?.addEventListener('pointerup',e=>{
  if(!landingMouse)return;
  const dx=e.clientX-landingMouse.x,dy=e.clientY-landingMouse.y,dt=performance.now()-landingMouse.t;
  landingMouse=null;
  if(dt<1000&&Math.abs(dx)>54&&Math.abs(dx)>Math.abs(dy)*1.08){
    if(dx<0){dismissLanding();modeIndex=3;render();}
    else openLandingBuilds();
  }
});

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();

  if(landingActive){
    if(e.key==='ArrowLeft'||k==='a'){
      e.preventDefault();dismissLanding();modeIndex=3;render();
    }else if(e.key==='ArrowRight'||k==='d'){
      e.preventDefault();openLandingBuilds();
    }else if(['ArrowDown','Enter',' ','PageDown'].includes(e.key)||k==='s'){
      e.preventDefault();dismissLanding();
    }
    return;
  }

  if(e.key==='Escape'){
    if(walkActive){stopWalk();return}
    if(!drawer.hidden){closeMenu();return}
    if(mode()==='maps'){modeIndex=0;render();return}
    if(mode()==='iterations'){modeIndex=2;render();return}
    return;
  }
  if(walkActive)return;

  // Side views use A/D or arrows as the obvious way back into the main map.
  if(mode()==='maps'){
    if(e.key==='ArrowRight'||k==='d'){e.preventDefault();modeIndex=0;render();}
    return;
  }
  if(mode()==='iterations'){
    if(e.key==='ArrowLeft'||k==='a'){e.preventDefault();modeIndex=2;render();}
    return;
  }

  if(e.key==='ArrowUp'||k==='w'){e.preventDefault();nextMap(-1);}
  else if(e.key==='ArrowDown'||k==='s'){e.preventDefault();nextMap(1);}
  else if(e.key==='ArrowLeft'||k==='a'){e.preventDefault();openMaps();}
  else if((e.key==='ArrowRight'||k==='d')&&map()?.kind==='gpt'){e.preventDefault();openIterations();}
  else if(e.key==='Enter'&&mode()==='walk')startWalk();
});

async function refreshServer(){
  if(!landing?.isConnected)return;
  try{
    const r=await fetch('/image-to-unreal-map/server-status.php?ts='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error();
    const d=await r.json();
    landingStatus.classList.remove('checking','online','offline');
    landingStatus.classList.add(d.online?'online':'offline');
    serverState.textContent=d.online?'ONLINE':'OFFLINE';
    humanCount.textContent=d.humans==null?'—':String(d.humans);
    botCount.textContent=d.bots==null?'—':String(d.bots);
    hossieCount.textContent=d.hossie==null?'—':String(d.hossie);
    if(d.hossie==null)hossieCount.title='Hossie is not yet reported separately by the server health feed.';
  }catch(_){
    landingStatus.classList.remove('checking','online');landingStatus.classList.add('offline');
    serverState.textContent='OFFLINE';
    humanCount.textContent=botCount.textContent=hossieCount.textContent='—';
  }
}
refreshServer();
setInterval(refreshServer,30000);

Promise.all([
  fetch('/image-to-unreal-map/data/feed-maps.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('feed');return r.json()}),
  fetch('/image-to-unreal-map/data/map-iterations.json',{cache:'no-store'}).then(r=>r.ok?r.json():({maps:{}})).catch(()=>({maps:{}}))
]).then(([d,it])=>{
    maps=d.maps||[];
    iterationsByMap=it.maps||{};
    buildLibrary();
    const q=new URLSearchParams(location.search),requestedMap=q.get('map'),requestedMode=q.get('mode');
    const mi=maps.findIndex(m=>m.id===requestedMap);if(mi>=0)mapIndex=mi;
    const mdi=MODES.indexOf(requestedMode);if(mdi>=0)modeIndex=mdi;
    if(requestedMap||requestedMode){
      landingActive=false;body.classList.remove('landing-active');
      landing?.remove();
    }
    try{if(localStorage.getItem('spawnmap.swiped'))hint?.classList.add('used')}catch(_){}
    render();
  })
  .catch(()=>{title.textContent='SpawnMap';subtitle.textContent='Map feed could not be loaded';walkCta.hidden=true});
})();
