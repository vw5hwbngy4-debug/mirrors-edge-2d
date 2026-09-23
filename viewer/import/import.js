(function(){
'use strict';

const preview=document.querySelector('spawnborn-map-preview');
const screen=document.querySelector('[data-import-screen]');
const dropCard=document.querySelector('[data-drop-card]');
const picker=document.querySelector('[data-picker]');
const pickButton=document.querySelector('[data-pick]');
const another=document.querySelector('[data-import-again]');
const hud=document.querySelector('[data-map-hud]');
const mapTitle=document.querySelector('[data-map-title]');
const mapStatus=document.querySelector('[data-map-status]');
const mapKind=document.querySelector('[data-map-kind]');
const metaDrawer=document.querySelector('[data-meta]');
const metaGrid=document.querySelector('[data-meta-grid]');
const artifactsEl=document.querySelector('[data-artifacts]');
const infoButton=document.querySelector('[data-info]');
const modeButtons=[...document.querySelectorAll('[data-view-mode]')];
const walkUI=document.querySelector('[data-walk-ui]');
const coords=document.querySelector('[data-coords]');
const lookZone=document.querySelector('[data-look-zone]');
const joystick=document.querySelector('[data-joystick]');
const stick=document.querySelector('[data-stick]');
const jumpButton=document.querySelector('[data-jump]');

let artifact={name:null,t3d:null,mapgenome:null,validation:null,unr:null,source:null};
let parsed=null;
let walkActive=false;
const THREE=window.THREE;
const state={yaw:0,pitch:-0.04,moveX:0,moveY:0,eyeHeight:64,speed:430,gravity:-900,jumpSpeed:360,vy:0,grounded:false,last:performance.now(),keys:Object.create(null)};

function setStatus(text,error){
  mapStatus.textContent=text;
  mapStatus.classList.toggle('error',!!error);
}
function bytes(n){
  if(!Number.isFinite(n))return '';
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(1)+' MB';
}
function renderMeta(){
  if(!parsed){metaGrid.innerHTML='';return}
  const s=parsed.summary||{};
  const cells=[
    [s.brushes||0,'Brushes'],[s.polygons||0,'Polys'],[(s.playerStarts&&s.playerStarts.total)||0,'Spawns'],
    [s.pathNodes||0,'Paths'],[s.lights||0,'Lights'],[s.skyZones||0,'Sky']
  ];
  metaGrid.innerHTML=cells.map(([v,k])=>`<div><b>${v}</b><span>${k}</span></div>`).join('');
  const items=[];
  if(artifact.t3d)items.push(`<b>T3D</b> ${bytes(new Blob([artifact.t3d]).size)}`);
  if(artifact.mapgenome)items.push('<b>MapGenome</b> detected');
  if(artifact.validation)items.push('<b>Validation</b> detected');
  if(artifact.unr)items.push(`<b>UNR</b> ${artifact.unr.size?bytes(artifact.unr.size):'detected'}`);
  const assets=preview.assetStats||{};
  if(assets.referenced&&assets.referenced.length)items.push(`<b>Textures</b> ${assets.resolved.length}/${assets.referenced.length} resolved`);
  artifactsEl.innerHTML=items.join('<br>')||'No sidecar artifacts.';
}

function revealMap(){
  screen.hidden=true;hud.hidden=false;another.hidden=false;
  mapKind.textContent=artifact.mapgenome?'SPAWNMAP ARTIFACT':'T3D IMPORT';
  mapTitle.textContent=(parsed&&parsed.summary&&parsed.summary.title)||artifact.name||'Imported map';
  setStatus('LOCAL PREVIEW · NOTHING UPLOADED');
  renderMeta();
}

function loadT3D(text,name){
  artifact.t3d=String(text);artifact.name=name||artifact.name||'map.t3d';
  try{
    parsed=window.SpawnbornT3D.parse(artifact.t3d,{sourceName:artifact.name});
    preview.loadT3D(artifact.t3d,{name:artifact.name});
    revealMap();
    setTimeout(renderMeta,350);
  }catch(err){
    setStatus('T3D parse failed: '+err.message,true);screen.hidden=false;
    throw err;
  }
}

function resetImport(){
  exitWalk();artifact={name:null,t3d:null,mapgenome:null,validation:null,unr:null,source:null};parsed=null;
  picker.value='';hud.hidden=true;another.hidden=true;metaDrawer.hidden=true;screen.hidden=false;
}
another.addEventListener('click',resetImport);
pickButton.addEventListener('click',()=>picker.click());
screen.addEventListener('click',e=>{if(e.target===screen)picker.click()});
infoButton.addEventListener('click',()=>metaDrawer.hidden=!metaDrawer.hidden);

['dragenter','dragover'].forEach(type=>screen.addEventListener(type,e=>{e.preventDefault();dropCard.classList.add('drag')}));
['dragleave','drop'].forEach(type=>screen.addEventListener(type,e=>{e.preventDefault();dropCard.classList.remove('drag')}));
screen.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));
picker.addEventListener('change',()=>handleFiles([...picker.files]));

async function handleFiles(files){
  if(!files.length)return;
  setStatus('Reading artifact…');
  try{
    if(files.length===1&&files[0].name.toLowerCase().endsWith('.zip')){
      await loadZip(files[0]);
      return;
    }
    for(const file of files) await consumeFile(file.name,file);
    if(artifact.t3d)loadT3D(artifact.t3d,artifact.name);
    else{
      mapKind.textContent='SIDECAR ONLY';mapTitle.textContent=artifact.name||'Artifact';
      hud.hidden=false;another.hidden=false;screen.hidden=false;
      setStatus('MapGenome/validation loaded · add matching .t3d',false);
    }
  }catch(err){
    screen.hidden=false;setStatus(err.message||String(err),true);
    const p=dropCard.querySelector('p');if(p)p.textContent='Import failed: '+(err.message||err);
  }
}

async function consumeFile(name,fileOrBytes){
  const lower=name.toLowerCase();
  let text=null;
  const asText=async()=>{
    if(text!==null)return text;
    if(fileOrBytes instanceof Uint8Array)text=new TextDecoder('utf-8').decode(fileOrBytes);
    else text=await fileOrBytes.text();
    return text;
  };
  if(lower.endsWith('.t3d')){
    artifact.t3d=await asText();artifact.name=name.split('/image-to-unreal-map/').pop();return;
  }
  if(lower.endsWith('.mapgenome.json')||lower.endsWith('mapgenome.json')){
    try{artifact.mapgenome=JSON.parse(await asText());artifact.name=artifact.name||artifact.mapgenome.mapName||name.split('/image-to-unreal-map/').pop()}catch(_){}
    return;
  }
  if(lower.endsWith('.validation.json')||lower.endsWith('validation.json')){
    try{artifact.validation=JSON.parse(await asText())}catch(_){}
    return;
  }
  if(lower.endsWith('.unr')){
    artifact.unr={name:name.split('/image-to-unreal-map/').pop(),size:fileOrBytes.size||fileOrBytes.byteLength||0};return;
  }
}

function u16(v,o){return v.getUint16(o,true)}
function u32(v,o){return v.getUint32(o,true)}
async function unzipEntry(method,data){
  if(method===0)return data;
  if(method!==8)throw new Error('ZIP compression method '+method+' is not supported.');
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress ZIP files. Drop the .t3d directly.');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function loadZip(file){
  setStatus('Opening ZIP…');
  const buf=await file.arrayBuffer(),v=new DataView(buf),bytesArr=new Uint8Array(buf);
  let eocd=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){if(u32(v,i)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('Not a readable ZIP artifact.');
  const count=u16(v,eocd+10),cdOffset=u32(v,eocd+16);
  let p=cdOffset,found=0;
  for(let n=0;n<count;n++){
    if(u32(v,p)!==0x02014b50)break;
    const method=u16(v,p+10),comp=u32(v,p+20),nameLen=u16(v,p+28),extraLen=u16(v,p+30),commentLen=u16(v,p+32),local=u32(v,p+42);
    const name=new TextDecoder('utf-8').decode(bytesArr.slice(p+46,p+46+nameLen));
    const llName=u16(v,local+26),llExtra=u16(v,local+28),start=local+30+llName+llExtra;
    const wanted=/\.t3d$/i.test(name)||/mapgenome\.json$/i.test(name)||/validation\.json$/i.test(name)||/\.unr$/i.test(name);
    if(wanted){
      const raw=bytesArr.slice(start,start+comp);
      const data=await unzipEntry(method,raw);
      await consumeFile(name,data);found++;
    }
    p+=46+nameLen+extraLen+commentLen;
  }
  if(!found)throw new Error('ZIP contains no .t3d / MapGenome / validation / .unr artifact.');
  artifact.source=file.name;
  if(!artifact.t3d)throw new Error('ZIP metadata found, but no .t3d was found for preview.');
  loadT3D(artifact.t3d,artifact.name);
}

function collidables(){
  const out=[];if(!preview.worldRoot)return out;
  preview.worldRoot.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.kind==='brush')out.push(o)});
  return out;
}
function groundY(x,z,startY,far){
  const objs=collidables();if(!objs.length)return null;
  preview.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,startY,z),new THREE.Vector3(0,-1,0),0,far||320);
  const hit=ray.intersectObjects(objs,false)[0];return hit?hit.point.y:null;
}
function actorLoc(a){
  try{return preview._location(a)}catch(_){return new THREE.Vector3()}
}
function gameplayCenter(){
  const actors=(preview.map&&preview.map.actors||[]).filter(a=>{
    const c=(a.className||'').toLowerCase();return c==='playerstart'||c==='pathnode'||c.includes('objective')||c==='s_zonecontrolpoint';
  });
  const box=new THREE.Box3();let n=0;actors.forEach(a=>{box.expandByPoint(actorLoc(a));n++});
  if(n<3||box.isEmpty())box.setFromObject(preview.worldRoot);return box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());
}
function startActor(){
  const aa=(preview.map&&preview.map.actors)||[];
  return aa.find(a=>(a.className||'').toLowerCase()==='playerstart'&&Number(a.properties.TeamNumber)===0)||
         aa.find(a=>(a.className||'').toLowerCase()==='playerstart');
}
function yawToward(from,to){const dx=to.x-from.x,dz=to.z-from.z;return Math.atan2(-dx,-dz)}
function applyLook(){if(!preview.camera)return;preview.camera.rotation.order='YXZ';preview.camera.rotation.y=state.yaw;preview.camera.rotation.x=state.pitch;preview.camera.rotation.z=0}
function uePosition(){const p=preview.camera.position;return{x:p.x,y:p.z,z:p.y}}
function updateCoords(){if(!preview.camera)return;const p=uePosition();coords.textContent=`X ${Math.round(p.x)} · Y ${Math.round(p.y)} · Z ${Math.round(p.z)}`}

function cleanInternalForWalk(hide){
  const sr=preview.shadowRoot;if(!sr)return;
  ['.brand','.panel','.toolbar','.status','.tooltip'].forEach(sel=>{const e=sr.querySelector(sel);if(e)e.style.display=hide?'none':''});
}
function enterWalk(){
  if(!preview.map||walkActive)return;
  walkActive=true;walkUI.hidden=false;cleanInternalForWalk(true);
  if(preview.controls)preview.controls.enabled=false;
  const a=startActor(),center=gameplayCenter(),pos=a?actorLoc(a):center.clone().add(new THREE.Vector3(-600,120,0));
  preview.camera.position.copy(pos);preview.camera.position.y+=state.eyeHeight;
  const g=groundY(pos.x,pos.z,pos.y+220,600);if(g!==null)preview.camera.position.y=g+state.eyeHeight;
  state.yaw=yawToward(preview.camera.position,center);state.pitch=-.04;state.vy=0;applyLook();updateCoords();state.last=performance.now();
  modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.viewMode==='walk'));
}
function exitWalk(){
  if(!walkActive)return;walkActive=false;walkUI.hidden=true;cleanInternalForWalk(false);state.keys=Object.create(null);state.moveX=state.moveY=0;
  if(preview.controls)preview.controls.enabled=true;preview.fitCamera('3d');
  modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.viewMode==='overview'));
}
modeButtons.forEach(b=>b.addEventListener('click',()=>b.dataset.viewMode==='walk'?enterWalk():exitWalk()));
function jump(){if(state.grounded){state.vy=state.jumpSpeed;state.grounded=false}}
function update(dt){
  if(!walkActive||!preview.camera)return;
  const cam=preview.camera,forward=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw)),right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));
  const f=((state.keys.KeyW?1:0)-(state.keys.KeyS?1:0))-state.moveY,r=((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0))+state.moveX;
  const move=new THREE.Vector3().addScaledVector(forward,f).addScaledVector(right,r);if(move.lengthSq()>1)move.normalize();
  const speed=(state.keys.ShiftLeft||state.keys.ShiftRight)?state.speed*1.65:state.speed;cam.position.addScaledVector(move,speed*dt);
  state.vy+=state.gravity*dt;cam.position.y+=state.vy*dt;
  const g=groundY(cam.position.x,cam.position.z,cam.position.y+state.eyeHeight*.3,state.eyeHeight*2.4);
  if(g!==null&&cam.position.y<=g+state.eyeHeight+7&&state.vy<=0){cam.position.y=g+state.eyeHeight;state.vy=0;state.grounded=true}else state.grounded=false;
  applyLook();updateCoords();
}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,Math.max(0,(now-state.last)/1000));state.last=now;update(dt);if(walkActive&&preview.renderer)preview.renderer.render(preview.scene,preview.camera)}
requestAnimationFrame(loop);

let mouse=false,last=null;
lookZone.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;mouse=true;last={x:e.clientX,y:e.clientY};lookZone.setPointerCapture?.(e.pointerId)});
lookZone.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!mouse||!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};state.yaw-=dx*.003;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch-dy*.003));applyLook()});
lookZone.addEventListener('pointerup',()=>{mouse=false;last=null});lookZone.addEventListener('pointercancel',()=>{mouse=false;last=null});

let lookId=null,lookLast=null;
lookZone.addEventListener('touchstart',e=>{if(lookId!==null)return;const t=e.changedTouches[0];lookId=t.identifier;lookLast={x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
lookZone.addEventListener('touchmove',e=>{const t=[...e.touches].find(t=>t.identifier===lookId);if(!t||!lookLast)return;const dx=t.clientX-lookLast.x,dy=t.clientY-lookLast.y;lookLast={x:t.clientX,y:t.clientY};state.yaw-=dx*.004;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch-dy*.0038));applyLook();e.preventDefault()},{passive:false});
lookZone.addEventListener('touchend',e=>{if([...e.changedTouches].some(t=>t.identifier===lookId)){lookId=null;lookLast=null}},{passive:false});

let joyId=null;
function joyUpdate(x,y){const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy;const max=r.width*.31,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}state.moveX=dx/max;state.moveY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
joystick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];joyId=t.identifier;joyUpdate(t.clientX,t.clientY);e.preventDefault()},{passive:false});
joystick.addEventListener('touchmove',e=>{const t=[...e.touches].find(t=>t.identifier===joyId);if(t){joyUpdate(t.clientX,t.clientY);e.preventDefault()}},{passive:false});
joystick.addEventListener('touchend',e=>{if([...e.changedTouches].some(t=>t.identifier===joyId)){joyId=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)'}},{passive:false});
jumpButton.addEventListener('pointerdown',jump);
window.addEventListener('keydown',e=>{state.keys[e.code]=true;if(walkActive&&['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)){e.preventDefault();if(e.code==='Space')jump()}},{passive:false});
window.addEventListener('keyup',e=>state.keys[e.code]=false);
window.addEventListener('blur',()=>{state.keys=Object.create(null);state.moveX=state.moveY=0});

const q=new URLSearchParams(location.search),src=q.get('src');
if(src){
  artifact.source=src;setStatus('Loading '+src+'…');
  fetch(src,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Map source '+r.status);return r.text()}).then(t=>loadT3D(t,src.split('/image-to-unreal-map/').pop())).catch(err=>{setStatus(err.message,true);screen.hidden=false});
}
})();
