(async function(){
'use strict';
const THREE=window.THREE;
const qs=new URLSearchParams(location.search),mapId=qs.get('map')||'rapidwater',mode=qs.get('mode')||'overview',embed=qs.get('embed')==='1';
document.body.classList.add(mode);if(embed)document.body.classList.add('embed');
const canvas=document.querySelector('[data-canvas]'),loading=document.querySelector('[data-loading]'),ui=document.querySelector('[data-ui]'),titleEl=document.querySelector('[data-title]'),kindEl=document.querySelector('[data-kind]'),exit=document.querySelector('[data-exit]'),look=document.querySelector('[data-look]'),walkControls=document.querySelector('[data-walk-controls]'),joy=document.querySelector('[data-joy]'),stick=document.querySelector('[data-stick]'),jumpBtn=document.querySelector('[data-jump]'),telemetrySummary=document.querySelector('[data-telemetry-summary]'),noTelemetry=document.querySelector('[data-no-telemetry]');
let renderer,scene,camera,mesh,mapMeta,sceneData,overviewCenter,overviewSpan,overviewControls=null;
const state={yaw:0,pitch:0,moveX:0,moveY:0,vy:0,grounded:false,keys:Object.create(null),last:performance.now(),eye:44,speed:355,sprint:520,jump:330,gravity:-920,radius:22};
const feed=await fetch('/image-to-unreal-map/data/feed-maps.json',{cache:'no-store'}).then(r=>r.json());mapMeta=feed.maps.find(m=>m.id===mapId)||feed.maps[0];
titleEl.textContent=mapMeta.title.toUpperCase();kindEl.textContent=mapMeta.badge;
sceneData=await fetch(mapMeta.scene,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('scene '+r.status);return r.json()});
renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));renderer.setClearColor(0x071013,1);if('outputEncoding' in renderer&&THREE.sRGBEncoding)renderer.outputEncoding=THREE.sRGBEncoding;
scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x071013,mode==='walk'?0.00013:0.000075);
camera=new THREE.PerspectiveCamera(mode==='walk'?74:48,innerWidth/innerHeight,1,150000);camera.rotation.order='YXZ';

function hydrateTexture(entry,mat){
  if(!entry.texture)return;
  const loader=new THREE.TextureLoader();
  loader.load(entry.texture,t=>{
    t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(1/Math.max(1,entry.width||256),1/Math.max(1,entry.height||256));
    if(THREE.sRGBEncoding)t.encoding=THREE.sRGBEncoding;
    t.anisotropy=renderer.capabilities?.getMaxAnisotropy?Math.min(6,renderer.capabilities.getMaxAnisotropy()):1;
    mat.map=t;mat.color.set(0xffffff);mat.userData.resolved=true;mat.needsUpdate=true;
  },undefined,()=>{mat.userData.resolved=false;});
}
async function buildMap(){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(sceneData.geometry.positions,3));
 if(sceneData.schema==='SpawnMapScene-v2'){
   g.setAttribute('uv',new THREE.Float32BufferAttribute(sceneData.geometry.uvPixels,2));g.setIndex(sceneData.geometry.indices);g.clearGroups();for(const gr of sceneData.geometry.groups)g.addGroup(gr.start,gr.count,gr.material);
   const mats=sceneData.materials.map(m=>{
     const transparent=!!(m.masked||m.translucent);
     const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(m.fallback||'#68777a'),map:null,side:THREE.DoubleSide,transparent,alphaTest:m.masked?.45:0,opacity:m.translucent?.58:1,depthWrite:!m.translucent});
     mat.userData={unrealTexture:m.ref,resolved:false};
     hydrateTexture(m,mat);
     return mat;
   });
   mesh=new THREE.Mesh(g,mats);
 } else {
   g.setIndex(sceneData.geometry.main||[]);g.computeVertexNormals();mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x7e8e91,roughness:.9,side:THREE.DoubleSide}));
 }
 scene.add(mesh);
}
await buildMap();
const box=new THREE.Box3();const mn=sceneData.bounds.min,mx=sceneData.bounds.max;box.min.set(mn[0],mn[1],mn[2]);box.max.set(mx[0],mx[1],mx[2]);const gb=sceneData.gameplayBounds||sceneData.bounds;const overviewBox=new THREE.Box3(new THREE.Vector3(gb.min[0],gb.min[1],gb.min[2]),new THREE.Vector3(gb.max[0],gb.max[1],gb.max[2]));overviewCenter=overviewBox.getCenter(new THREE.Vector3());const size=overviewBox.getSize(new THREE.Vector3());overviewSpan=Math.max(size.x,size.z,900);
function fitOverview(){camera.fov=48;camera.aspect=innerWidth/innerHeight;camera.near=1;camera.far=Math.max(60000,overviewSpan*12);camera.updateProjectionMatrix();const dir=new THREE.Vector3(.78,.92,.82).normalize();const distance=Math.max(900,overviewSpan*1.18);camera.position.copy(overviewCenter).addScaledVector(dir,distance);camera.up.set(0,1,0);camera.lookAt(overviewCenter)}
function ueRad(v){return Math.PI*2*((Number(v)||0)&0xffff)/65536}
function groundY(x,z,startY,far=380){scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,startY,z),new THREE.Vector3(0,-1,0),0,far);const hit=ray.intersectObject(mesh,true)[0];return hit?hit.point.y:null}
function blocked(from,delta){const dist=delta.length();if(dist<.01)return false;scene.updateMatrixWorld(true);const d=delta.clone().normalize();for(const off of [0,-state.eye*.42,-state.eye*.78]){const o=from.clone();o.y+=off;const hit=new THREE.Raycaster(o,d,0,dist+state.radius).intersectObject(mesh,true)[0];if(hit&&hit.distance<dist+state.radius)return true}return false}
function spawnWalk(){
 const starts=sceneData.playerStarts||[];
 const override=mapMeta.walkSpawn;
 // Unreal omits TeamNumber when it is the default 0, so null is a real team-0/default PlayerStart.
 // Prefer the map's own official start unless a map has an explicit tested override.
 const s=override||(starts.find(x=>x.team===0||x.team==null))||starts.find(x=>x.team===1)||starts[0];

 if(s){
   camera.position.set(s.x,s.y+state.eye,s.z);
   state.yaw=-ueRad(s.yaw);

   // IMPORTANT: snap only to floor immediately below the PlayerStart.
   // The old code raycast from +240 units and could hit a roof above a valid indoor spawn,
   // teleporting the browser player onto that roof.
   const localGround=groundY(s.x,s.z,s.y+24,128);
   if(localGround!==null && localGround<=s.y+24)camera.position.y=localGround+state.eye;
 }else{
   camera.position.copy(overviewCenter);
   camera.position.y=Math.max(box.min.y+state.eye+20,overviewCenter.y);
   const fallbackGround=groundY(camera.position.x,camera.position.z,camera.position.y+80,240);
   if(fallbackGround!==null)camera.position.y=fallbackGround+state.eye;
 }

 state.pitch=0;
 state.vy=0;
 state.grounded=true;
 applyLook();
}
function applyLook(){camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;camera.rotation.z=0}
function jump(){if(state.grounded){state.vy=state.jump;state.grounded=false}}
function updateWalk(dt){if(mode!=='walk')return;const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));const right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));const f=((state.keys.KeyW?1:0)-(state.keys.KeyS?1:0))-state.moveY;const r=((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0))+state.moveX;const d=new THREE.Vector3().addScaledVector(fwd,f).addScaledVector(right,r);if(d.lengthSq()>1)d.normalize();const speed=(state.keys.ShiftLeft||state.keys.ShiftRight)?state.sprint:state.speed;d.multiplyScalar(speed*dt);const dx=new THREE.Vector3(d.x,0,0);if(!blocked(camera.position,dx))camera.position.x+=dx.x;const dz=new THREE.Vector3(0,0,d.z);if(!blocked(camera.position,dz))camera.position.z+=dz.z;state.vy+=state.gravity*dt;camera.position.y+=state.vy*dt;const g=groundY(camera.position.x,camera.position.z,camera.position.y+state.eye*.3,state.eye*2.4);if(g!==null&&camera.position.y<=g+state.eye+7&&state.vy<=0){camera.position.y=g+state.eye;state.vy=0;state.grounded=true}else state.grounded=false;if(camera.position.y<box.min.y-1000)spawnWalk();applyLook()}
if(mode==='walk'){
  walkControls.hidden=false;spawnWalk();
}else{
  fitOverview();
  if(mode==='overview'){
    if(window.OrbitControls){
      overviewControls=new OrbitControls(camera,renderer.domElement);
      overviewControls.target.copy(overviewCenter);
      overviewControls.enableDamping=true;
      overviewControls.dampingFactor=.075;
      overviewControls.screenSpacePanning=true;
      overviewControls.minDistance=Math.max(90,overviewSpan*.10);
      overviewControls.maxDistance=Math.max(6000,overviewSpan*6);
      overviewControls.update();
    }
    const sphere=new THREE.SphereGeometry(Math.max(10,overviewSpan*.006),10,8);
    for(const s of (sceneData.playerStarts||[]).slice(0,64)){
      const color=s.team===1?0x6ea4d8:(s.team===0?0xd6a262:0xcfd7d9);
      const m=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72}));
      m.position.set(s.x,s.y+18,s.z);scene.add(m);
    }
  }
  if(mode==='telemetry'){noTelemetry.hidden=false;}
}
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  if(mode!=='walk'&&!overviewControls)fitOverview();
}addEventListener('resize',resize);resize();
let pointerDown=false,lastPointer=null;look?.addEventListener('pointerdown',e=>{if(mode!=='walk')return;if(e.pointerType==='mouse'&&document.pointerLockElement!==look&&look?.requestPointerLock){look.requestPointerLock();return}pointerDown=true;lastPointer={x:e.clientX,y:e.clientY};look.setPointerCapture?.(e.pointerId)});look?.addEventListener('pointermove',e=>{if(mode!=='walk')return;if(document.pointerLockElement===look){state.yaw-=e.movementX*.0024;state.pitch-=e.movementY*.0022}else if(pointerDown&&lastPointer){state.yaw-=(e.clientX-lastPointer.x)*.0036;state.pitch-=(e.clientY-lastPointer.y)*.0033;lastPointer={x:e.clientX,y:e.clientY}}state.pitch=Math.max(-1.34,Math.min(1.34,state.pitch))});look?.addEventListener('pointerup',()=>{pointerDown=false;lastPointer=null});
let jid=null;function joyMove(x,y){const b=joy.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;let dx=x-cx,dy=y-cy,max=b.width*.32,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}state.moveX=dx/max;state.moveY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}joy?.addEventListener('touchstart',e=>{const t=e.changedTouches[0];jid=t.identifier;joyMove(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});joy?.addEventListener('touchmove',e=>{const t=[...e.touches].find(x=>x.identifier===jid);if(!t)return;joyMove(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});function joyEnd(e){for(const t of e.changedTouches)if(t.identifier===jid){jid=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)'}}joy?.addEventListener('touchend',joyEnd,{passive:false});joy?.addEventListener('touchcancel',joyEnd,{passive:false});jumpBtn?.addEventListener('touchstart',e=>{jump();e.preventDefault()},{passive:false});jumpBtn?.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')jump()});
addEventListener('keydown',e=>{state.keys[e.code]=true;if(e.code==='Space'){jump();e.preventDefault()}if(e.code==='Escape'&&!document.pointerLockElement){if(window.parent!==window)parent.postMessage({type:'spawnmap:exitWalk'},'*');else history.back()}});addEventListener('keyup',e=>state.keys[e.code]=false);exit?.addEventListener('click',()=>{if(window.parent!==window)parent.postMessage({type:'spawnmap:exitWalk'},'*');else history.back()});
ui.hidden=false;loading.style.display='none';parent.postMessage({type:'spawnmap:sceneReady',mapId,mode},'*');function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,Math.max(0,(now-state.last)/1000));state.last=now;if(mode==='walk')updateWalk(dt);if(overviewControls)overviewControls.update();renderer.render(scene,camera)}requestAnimationFrame(loop);
})().catch(err=>{console.error(err);const l=document.querySelector('[data-loading]');if(l){l.innerHTML='<span>MAP COULD NOT BE LOADED</span>';}});
