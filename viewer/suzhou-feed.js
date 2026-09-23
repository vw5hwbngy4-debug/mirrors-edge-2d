(function(){
'use strict';
const THREE=window.THREE,qs=new URLSearchParams(location.search),mode=qs.get('mode')||'overview',embed=qs.get('embed')==='1';document.body.classList.add(mode);if(embed)document.body.classList.add('embed');
const preview=document.querySelector('spawnborn-map-preview'),loading=document.querySelector('[data-loading]'),ui=document.querySelector('[data-ui]'),look=document.querySelector('[data-look]'),exit=document.querySelector('[data-exit]'),controls=document.querySelector('[data-walk-controls]'),joy=document.querySelector('[data-joy]'),stick=document.querySelector('[data-stick]'),jumpBtn=document.querySelector('[data-jump]'),telemetrySummary=document.querySelector('[data-telemetry-summary]');
const state={yaw:Math.PI,pitch:-.03,moveX:0,moveY:0,vy:0,grounded:false,keys:Object.create(null),last:performance.now(),eye:64,speed:430,sprint:700,jump:360,gravity:-900,radius:22};let active=false;
function clean(){const sr=preview.shadowRoot;if(!sr)return;['.brand','.panel','.toolbar','.status','.tooltip'].forEach(s=>{const e=sr.querySelector(s);if(e)e.style.display='none'});}
function fitOverview(){if(!preview.camera||!preview.controls)return;const actors=(preview.map?.actors||[]).filter(a=>{const c=(a.className||'').toLowerCase();return c==='playerstart'||c==='pathnode'||c.includes('objective')});const box=new THREE.Box3();let n=0;actors.forEach(a=>{try{box.expandByPoint(preview._location(a));n++}catch(_){}});if(n<3||box.isEmpty())box.setFromObject(preview.worldRoot);const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(size.x,size.z,900),dir=new THREE.Vector3(.78,.92,.82).normalize();preview.controls.target.copy(center);preview.camera.position.copy(center).addScaledVector(dir,Math.max(1000,span*1.16));preview.camera.up.set(0,1,0);preview.camera.near=1;preview.camera.far=Math.max(60000,span*14);preview.camera.updateProjectionMatrix();preview.controls.update();}
function collidables(){const out=[];preview.worldRoot?.traverse(o=>{if(o.isMesh&&o.userData?.kind==='brush')out.push(o)});return out}
function groundY(x,z,startY,far=380){const os=collidables();if(!os.length)return null;preview.scene.updateMatrixWorld(true);const hit=new THREE.Raycaster(new THREE.Vector3(x,startY,z),new THREE.Vector3(0,-1,0),0,far).intersectObjects(os,false)[0];return hit?hit.point.y:null}
function blocked(from,delta){const dist=delta.length();if(dist<.01)return false;const os=collidables();if(!os.length)return false;preview.scene.updateMatrixWorld(true);const d=delta.clone().normalize();for(const off of [0,-state.eye*.42,-state.eye*.78]){const o=from.clone();o.y+=off;const h=new THREE.Raycaster(o,d,0,dist+state.radius).intersectObjects(os,false)[0];if(h&&h.distance<dist+state.radius)return true}return false}
function applyLook(){const c=preview.camera;if(!c)return;c.rotation.order='YXZ';c.rotation.y=state.yaw;c.rotation.x=state.pitch;c.rotation.z=0}
function spawn(){const c=preview.camera;c.position.set(-2087,128,-1843);const g=groundY(-2087,-1843,280,520);if(g!==null)c.position.y=g+state.eye;state.yaw=Math.PI;state.pitch=-.03;state.vy=0;applyLook()}
function jump(){if(state.grounded){state.vy=state.jump;state.grounded=false}}
function update(dt){if(mode!=='walk'||!active)return;const c=preview.camera,fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw)),right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));const f=((state.keys.KeyW?1:0)-(state.keys.KeyS?1:0))-state.moveY,r=((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0))+state.moveX,d=new THREE.Vector3().addScaledVector(fwd,f).addScaledVector(right,r);if(d.lengthSq()>1)d.normalize();d.multiplyScalar((state.keys.ShiftLeft||state.keys.ShiftRight?state.sprint:state.speed)*dt);const dx=new THREE.Vector3(d.x,0,0);if(!blocked(c.position,dx))c.position.x+=dx.x;const dz=new THREE.Vector3(0,0,d.z);if(!blocked(c.position,dz))c.position.z+=dz.z;state.vy+=state.gravity*dt;c.position.y+=state.vy*dt;const g=groundY(c.position.x,c.position.z,c.position.y+state.eye*.3,state.eye*2.3);if(g!==null&&c.position.y<=g+state.eye+7&&state.vy<=0){c.position.y=g+state.eye;state.vy=0;state.grounded=true}else state.grounded=false;applyLook()}
function centroid(f){const ring=f?.geometry?.coordinates?.[0]||[];let x=0,y=0,n=0;for(const p of ring)if(Array.isArray(p)&&p.length>=2){x+=+p[0];y+=+p[1];n++}return n?{x:x/n,y:y/n}:null}
function telemetry(){
  const data=window.SPAWNMAP_SUZHOU_TELEMETRY;
  if(!data)throw new Error('telemetry payload missing');
  const group=new THREE.Group();group.name='spawnmap-telemetry';preview.scene.add(group);
  const metrics=data.regions||[];let max=1;metrics.forEach(m=>max=Math.max(max,m.movement||0));
  const cent=new Map();
  [...metrics].sort((a,b)=>(b.movement||0)-(a.movement||0)).slice(0,18).forEach(m=>{
    cent.set(m.id,{x:m.x,y:m.y,z:m.z||0});
    if(!m.movement)return;
    const r=Math.sqrt((m.movement||0)/max),h=45+r*260,rad=18+r*38,z=Number(m.z)||0;
    const cyl=new THREE.Mesh(
      new THREE.CylinderGeometry(rad,rad*.72,h,18,1,true),
      new THREE.MeshBasicMaterial({color:0xb8e634,transparent:true,opacity:.18+.28*r,side:THREE.DoubleSide,depthWrite:false})
    );
    cyl.position.set(m.x,z+h/2,m.y);group.add(cyl);
    const kills=(m.victimDeaths||0)+(m.killerKills||0);
    if(kills){
      const s=new THREE.Mesh(
        new THREE.SphereGeometry(12+Math.min(24,kills*2),14,10),
        new THREE.MeshBasicMaterial({color:0xf17c67,transparent:true,opacity:.78,depthWrite:false})
      );
      s.position.set(m.x,z+h+15,m.y);group.add(s);
    }
  });
  const ep=[];
  (data.edges||[]).slice(0,18).forEach(e=>{
    const a=cent.get(e.from),b=cent.get(e.to);if(!a||!b)return;
    const y=Math.max(a.z||0,b.z||0)+86;
    ep.push(a.x,y,a.y,b.x,y,b.y);
  });
  if(ep.length){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));
    group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xe4c766,transparent:true,opacity:.72})));
  }
  const c=data.counts||{};
  telemetrySummary.hidden=false;
  telemetrySummary.innerHTML=`<span><b>${data.movement?.allPOSSourceEvents??c.POS??'—'}</b> MOVEMENT</span><span><b>${c.KILL??'—'}</b> KILLS</span><span><b>${c.SPAWN??'—'}</b> SPAWNS</span><span>BOT-ONLY TEST</span><em>${data.scopeWarning||''}</em>`;
}let pdown=false,last=null;
look.addEventListener('pointerdown',e=>{
  if(mode!=='walk')return;
  if(e.pointerType==='mouse'&&document.pointerLockElement!==look&&look.requestPointerLock){look.requestPointerLock();return;}
  pdown=true;last={x:e.clientX,y:e.clientY};look.setPointerCapture?.(e.pointerId);
});
look.addEventListener('pointermove',e=>{
  if(mode!=='walk')return;
  if(document.pointerLockElement===look){state.yaw-=e.movementX*.0024;state.pitch-=e.movementY*.0022;}
  else if(pdown&&last){state.yaw-=(e.clientX-last.x)*.0036;state.pitch-=(e.clientY-last.y)*.0033;last={x:e.clientX,y:e.clientY};}
  state.pitch=Math.max(-1.34,Math.min(1.34,state.pitch));
});
look.addEventListener('pointerup',()=>{pdown=false;last=null});
let jid=null;function joyMove(x,y){const b=joy.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;let dx=x-cx,dy=y-cy,max=b.width*.32,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}state.moveX=dx/max;state.moveY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}joy?.addEventListener('touchstart',e=>{const t=e.changedTouches[0];jid=t.identifier;joyMove(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});joy?.addEventListener('touchmove',e=>{const t=[...e.touches].find(x=>x.identifier===jid);if(!t)return;joyMove(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});function jend(e){for(const t of e.changedTouches)if(t.identifier===jid){jid=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)'}}joy?.addEventListener('touchend',jend,{passive:false});joy?.addEventListener('touchcancel',jend,{passive:false});jumpBtn?.addEventListener('touchstart',e=>{jump();e.preventDefault()},{passive:false});jumpBtn?.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')jump()});addEventListener('keydown',e=>{state.keys[e.code]=true;if(e.code==='Space'){jump();e.preventDefault()}if(e.code==='Escape'&&!document.pointerLockElement)parent.postMessage({type:'spawnmap:exitWalk'},'*')});addEventListener('keyup',e=>state.keys[e.code]=false);exit?.addEventListener('click',()=>parent.postMessage({type:'spawnmap:exitWalk'},'*'));
preview.addEventListener('spawnborn-preview-ready',()=>{clean();if(preview.controls)preview.controls.enabled=mode!=='walk';if(mode==='walk'){controls.hidden=false;spawn();active=true}else{fitOverview();if(mode==='telemetry'){try{telemetry()}catch(err){console.error(err);telemetrySummary.hidden=false;telemetrySummary.innerHTML='<span><b>TELEMETRY</b> VIEW UNAVAILABLE</span>';}}}ui.hidden=false;loading.classList.add('done');parent.postMessage({type:'spawnmap:sceneReady',mapId:'suzhou',mode},'*');state.last=performance.now();requestAnimationFrame(loop)},{once:true});
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,Math.max(0,(now-state.last)/1000));state.last=now;update(dt);if(preview.renderer&&preview.scene&&preview.camera)preview.renderer.render(preview.scene,preview.camera)}
fetch('/image-to-unreal-map/maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('map');return r.text()}).then(t=>preview.loadT3D(t,{name:'TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d'})).catch(()=>loading.querySelector('span').textContent='MAP COULD NOT BE LOADED');
})();
