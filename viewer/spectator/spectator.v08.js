(function(){
'use strict';
const THREE=window.THREE;
const preview=document.querySelector('spawnborn-map-preview');
const loading=document.querySelector('.loading');
const ui=document.querySelector('.spectator-ui');
const lookZone=ui.querySelector('.look-zone');
const coords=ui.querySelector('[data-coords]');
const lookHint=ui.querySelector('[data-look-hint]');
const joystick=ui.querySelector('[data-joystick]');
const stick=ui.querySelector('[data-stick]');
const jumpButton=ui.querySelector('[data-jump]');
const promptSheet=ui.querySelector('[data-prompt]');
const note=ui.querySelector('[data-note]');
const copyButton=ui.querySelector('[data-copy]');

const DEFAULT_START_UE={x:-2087,y:-1843,z:64};
const DEFAULT_START_YAW=Math.PI; // face down the lane instead of diagonally into a wall
const DEFAULT_START_PITCH=-0.03;
const state={yaw:0,pitch:0,moveX:0,moveY:0,eyeHeight:64,speed:430,gravity:-900,jumpSpeed:360,vy:0,grounded:false,last:performance.now(),keys:Object.create(null)};

function cleanInternalUI(){const sr=preview.shadowRoot;if(!sr)return;['.brand','.panel','.toolbar','.status','.tooltip'].forEach(sel=>{const e=sr.querySelector(sel);if(e)e.style.display='none';});}
function collidables(){const out=[];if(!preview.worldRoot)return out;preview.worldRoot.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.kind==='brush')out.push(o);});return out;}
function groundY(x,z,startY,far){const objs=collidables();if(!objs.length)return null;preview.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,startY,z),new THREE.Vector3(0,-1,0),0,far||300);const hit=ray.intersectObjects(objs,false)[0];return hit?hit.point.y:null;}
function playerStart(){const actors=(preview.map&&preview.map.actors)||[];return actors.find(a=>(a.className||'').toLowerCase()==='playerstart'&&Number(a.properties.TeamNumber)===0)||actors.find(a=>(a.className||'').toLowerCase()==='playerstart');}
function applyLook(){const cam=preview.camera;if(!cam)return;cam.rotation.order='YXZ';cam.rotation.y=state.yaw;cam.rotation.x=state.pitch;cam.rotation.z=0;}
function uePosition(){const p=preview.camera.position;return{x:p.x,y:p.z,z:p.y};}
function updateCoords(){if(!preview.camera)return;const p=uePosition();coords.textContent=`X ${Math.round(p.x)} · Y ${Math.round(p.y)} · Z ${Math.round(p.z)}`;}

function gameplayCenter(){
  const actors=(preview.map&&preview.map.actors||[]).filter(a=>{const c=(a.className||'').toLowerCase();return c==='playerstart'||c==='pathnode'||c.includes('objective');});
  const box=new THREE.Box3();
  let n=0;
  actors.forEach(a=>{try{box.expandByPoint(preview._location(a));n++;}catch(_){} });
  if(n<3||box.isEmpty()) box.setFromObject(preview.worldRoot);
  if(box.isEmpty()) return null;
  return box.getCenter(new THREE.Vector3());
}

function yawToTarget(fromX,fromZ,toX,toZ){
  const dx=toX-fromX, dz=toZ-fromZ;
  return Math.atan2(-dx,-dz);
}

function spawn(){
  if(!preview.camera) return;

  // Use a curated starting shot instead of the raw PlayerStart rotation,
  // so Spectator opens on a readable lane instead of staring at a wall.
  const start={x:DEFAULT_START_UE.x,z:DEFAULT_START_UE.y,y:DEFAULT_START_UE.z};
  preview.camera.position.set(start.x,start.y + state.eyeHeight,start.z);
  const g=groundY(start.x,start.z,start.y+220,520);
  preview.camera.position.y=(g!==null?g+state.eyeHeight:start.y+state.eyeHeight);

  // Curated opening angle for a readable spectator start.
  state.yaw=DEFAULT_START_YAW;
  state.pitch=DEFAULT_START_PITCH;
  state.vy=0;
  applyLook();
  updateCoords();
}
function jump(){if(state.grounded){state.vy=state.jumpSpeed;state.grounded=false;}}

function update(dt){if(!preview.camera)return;const cam=preview.camera;
  const forward=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  const right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));
  const keyboardForward=(state.keys.KeyW?1:0)-(state.keys.KeyS?1:0);
  const keyboardRight=(state.keys.KeyD?1:0)-(state.keys.KeyA?1:0);
  const f=keyboardForward-state.moveY;
  const r=keyboardRight+state.moveX;
  const move=new THREE.Vector3().addScaledVector(forward,f).addScaledVector(right,r);
  if(move.lengthSq()>1)move.normalize();
  const speed=(state.keys.ShiftLeft||state.keys.ShiftRight)?state.speed*1.65:state.speed;
  cam.position.addScaledVector(move,speed*dt);

  state.vy+=state.gravity*dt;cam.position.y+=state.vy*dt;
  const g=groundY(cam.position.x,cam.position.z,cam.position.y+state.eyeHeight*.3,state.eyeHeight*2.2);
  if(g!==null&&cam.position.y<=g+state.eyeHeight+7&&state.vy<=0){cam.position.y=g+state.eyeHeight;state.vy=0;state.grounded=true;}else state.grounded=false;
  applyLook();updateCoords();
}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,Math.max(0,(now-state.last)/1000));state.last=now;update(dt);preview.renderer&&preview.renderer.render(preview.scene,preview.camera);}

let lookTouchId=null,lookLast=null;
lookZone.addEventListener('touchstart',e=>{if(lookTouchId!==null)return;const t=e.changedTouches[0];lookTouchId=t.identifier;lookLast={x:t.clientX,y:t.clientY};e.preventDefault();},{passive:false});
lookZone.addEventListener('touchmove',e=>{if(lookTouchId===null||!lookLast)return;const t=[...e.changedTouches].find(x=>x.identifier===lookTouchId)||[...e.touches].find(x=>x.identifier===lookTouchId);if(!t)return;const dx=t.clientX-lookLast.x,dy=t.clientY-lookLast.y;lookLast={x:t.clientX,y:t.clientY};state.yaw-=dx*.0042;state.pitch-=dy*.0038;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch));applyLook();lookHint.classList.add('used');e.preventDefault();},{passive:false});
function endLook(e){if(lookTouchId===null)return;for(const t of e.changedTouches){if(t.identifier===lookTouchId){lookTouchId=null;lookLast=null;break;}}}
lookZone.addEventListener('touchend',endLook,{passive:false});lookZone.addEventListener('touchcancel',endLook,{passive:false});

let mouseLook=false,mouseLast=null;
lookZone.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;mouseLook=true;mouseLast={x:e.clientX,y:e.clientY};lookZone.setPointerCapture?.(e.pointerId);});
lookZone.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!mouseLook||!mouseLast)return;const dx=e.clientX-mouseLast.x,dy=e.clientY-mouseLast.y;mouseLast={x:e.clientX,y:e.clientY};state.yaw-=dx*.003;state.pitch-=dy*.003;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch));applyLook();lookHint.classList.add('used');});
lookZone.addEventListener('pointerup',()=>{mouseLook=false;mouseLast=null;});lookZone.addEventListener('pointercancel',()=>{mouseLook=false;mouseLast=null;});

let joyTouchId=null;
function joyUpdate(clientX,clientY){const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=clientX-cx,dy=clientY-cy;const max=r.width*.32,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}state.moveX=dx/max;state.moveY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`;}
joystick.addEventListener('touchstart',e=>{if(joyTouchId!==null)return;const t=e.changedTouches[0];joyTouchId=t.identifier;joyUpdate(t.clientX,t.clientY);e.preventDefault();e.stopPropagation();},{passive:false});
joystick.addEventListener('touchmove',e=>{const t=[...e.changedTouches].find(x=>x.identifier===joyTouchId)||[...e.touches].find(x=>x.identifier===joyTouchId);if(!t)return;joyUpdate(t.clientX,t.clientY);e.preventDefault();e.stopPropagation();},{passive:false});
function joyEnd(e){for(const t of e.changedTouches){if(t.identifier===joyTouchId){joyTouchId=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)';break;}}}
joystick.addEventListener('touchend',joyEnd,{passive:false});joystick.addEventListener('touchcancel',joyEnd,{passive:false});

let joyPointer=null;
joystick.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;joyPointer=e.pointerId;joystick.setPointerCapture?.(e.pointerId);joyUpdate(e.clientX,e.clientY);e.preventDefault();});
joystick.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||e.pointerId!==joyPointer)return;joyUpdate(e.clientX,e.clientY);e.preventDefault();});
joystick.addEventListener('pointerup',e=>{if(e.pointerId===joyPointer){joyPointer=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)';}});

jumpButton.addEventListener('touchstart',e=>{jump();e.preventDefault();},{passive:false});jumpButton.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')jump();});
window.addEventListener('keydown',e=>{if(document.activeElement===note)return;state.keys[e.code]=true;if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.code==='Space')jump();},{passive:false});window.addEventListener('keyup',e=>{state.keys[e.code]=false;});window.addEventListener('blur',()=>{state.keys=Object.create(null);state.moveX=state.moveY=0;});

async function copyPrompt(){const change=note.value.trim();if(!change){note.focus();return;}const p=uePosition();let deg=(((-state.yaw)*180/Math.PI)%360+360)%360;const text=`SpawnMap iteration for the current TO-GPT-SuzhouCanal GraffitiFruit v3 project. At approximately Unreal location X=${Math.round(p.x)}, Y=${Math.round(p.y)}, Z=${Math.round(p.z)}, facing yaw ${Math.round(deg)}°. Update this area as follows: ${change}. Preserve the rest of the approved map unless this local change requires a connection adjustment. Apply this as an iteration to the current map, not as a remix or new project. Return the updated map proposal for Overview and Spectator inspection before compiling the .unr, then use the @Spawnmap agentplugin to update the current map.`;try{await navigator.clipboard.writeText(text);copyButton.textContent='COPIED';setTimeout(()=>copyButton.textContent='COPY PROMPT',1200);}catch(_){note.value=text;note.select();}}
copyButton.addEventListener('click',copyPrompt);note.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();copyPrompt();}});

preview.addEventListener('spawnborn-preview-ready',()=>{cleanInternalUI();if(preview.controls)preview.controls.enabled=false;spawn();ui.hidden=false;loading.classList.add('done');state.last=performance.now();requestAnimationFrame(loop);},{once:true});
fetch('../maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d').then(r=>{if(!r.ok)throw new Error('Map source could not be loaded.');return r.text();}).then(t=>preview.loadT3D(t,{name:'TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d'})).catch(e=>{loading.textContent=e.message;});
})();
