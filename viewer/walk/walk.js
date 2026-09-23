(function(){
'use strict';
const THREE=window.THREE;
const preview=document.querySelector('spawnborn-map-preview');
const loading=document.querySelector('[data-loading]');
const ui=document.querySelector('[data-ui]');
const onboarding=document.querySelector('[data-onboarding]');
const enter=document.querySelector('[data-enter]');
const lookZone=document.querySelector('[data-look-zone]');
const joystick=document.querySelector('[data-joystick]');
const stick=document.querySelector('[data-stick]');
const jumpButton=document.querySelector('[data-jump]');
const pip=document.querySelector('[data-pip]');
const state={ready:false,active:false,yaw:Math.PI,pitch:-.03,moveX:0,moveY:0,eye:64,speed:430,gravity:-900,jump:360,vy:0,grounded:false,last:performance.now(),keys:Object.create(null)};
let overviewCamera=null;

function cleanInternalUI(){const sr=preview.shadowRoot;if(!sr)return;['.brand','.panel','.toolbar','.status','.tooltip'].forEach(sel=>{const e=sr.querySelector(sel);if(e)e.style.display='none';});}
function collidables(){const a=[];preview.worldRoot?.traverse(o=>{if(o.isMesh&&o.userData?.kind==='brush')a.push(o)});return a}
function groundY(x,z,y,far=340){const objects=collidables();if(!objects.length)return null;preview.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0),0,far);const h=ray.intersectObjects(objects,false)[0];return h?h.point.y:null}
function spawn(){const p={x:-2087,z:-1843,y:64};preview.camera.position.set(p.x,p.y+state.eye,p.z);const g=groundY(p.x,p.z,p.y+220,520);if(g!==null)preview.camera.position.y=g+state.eye;state.yaw=Math.PI;state.pitch=-.03;state.vy=0;applyLook()}
function applyLook(){const c=preview.camera;if(!c)return;c.rotation.order='YXZ';c.rotation.y=state.yaw;c.rotation.x=state.pitch;c.rotation.z=0}
function jump(){if(state.grounded){state.vy=state.jump;state.grounded=false}}
function update(dt){if(!state.active||!preview.camera)return;const c=preview.camera;const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));const right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));const f=((state.keys.KeyW?1:0)-(state.keys.KeyS?1:0))-state.moveY;const r=((state.keys.KeyD?1:0)-(state.keys.KeyA?1:0))+state.moveX;const move=new THREE.Vector3().addScaledVector(fwd,f).addScaledVector(right,r);if(move.lengthSq()>1)move.normalize();const speed=(state.keys.ShiftLeft||state.keys.ShiftRight)?state.speed*1.6:state.speed;c.position.addScaledVector(move,speed*dt);state.vy+=state.gravity*dt;c.position.y+=state.vy*dt;const g=groundY(c.position.x,c.position.z,c.position.y+state.eye*.3,state.eye*2.2);if(g!==null&&c.position.y<=g+state.eye+7&&state.vy<=0){c.position.y=g+state.eye;state.vy=0;state.grounded=true}else state.grounded=false;applyLook()}
function setupOverview(){const box=new THREE.Box3().setFromObject(preview.worldRoot);const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());const span=Math.max(size.x,size.z,1000);overviewCamera=new THREE.OrthographicCamera(-span*.58,span*.58,span*.36,-span*.36,1,Math.max(50000,size.y*10));overviewCamera.position.set(center.x,box.max.y+Math.max(2000,span*.35),center.z);overviewCamera.up.set(0,0,-1);overviewCamera.lookAt(center)}
function render(){if(!preview.renderer||!preview.scene||!preview.camera)return;const renderer=preview.renderer;renderer.setScissorTest(false);renderer.setViewport(0,0,renderer.domElement.width,renderer.domElement.height);renderer.render(preview.scene,preview.camera);if(overviewCamera&&pip){const rect=pip.getBoundingClientRect();const canvas=renderer.domElement.getBoundingClientRect();const sx=(rect.left-canvas.left)*(renderer.domElement.width/canvas.width);const sy=(canvas.bottom-rect.bottom)*(renderer.domElement.height/canvas.height);const sw=rect.width*(renderer.domElement.width/canvas.width);const sh=rect.height*(renderer.domElement.height/canvas.height);renderer.setScissorTest(true);renderer.setScissor(sx,sy,sw,sh);renderer.setViewport(sx,sy,sw,sh);renderer.setClearColor(0x071015,1);renderer.render(preview.scene,overviewCamera);renderer.setScissorTest(false)}}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,Math.max(0,(now-state.last)/1000));state.last=now;update(dt);render()}

let lookId=null,lastLook=null;
lookZone.addEventListener('touchstart',e=>{if(lookId!==null||!state.active)return;const t=e.changedTouches[0];lookId=t.identifier;lastLook={x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
lookZone.addEventListener('touchmove',e=>{if(lookId===null||!lastLook)return;const t=[...e.touches].find(x=>x.identifier===lookId)||[...e.changedTouches].find(x=>x.identifier===lookId);if(!t)return;state.yaw-=(t.clientX-lastLook.x)*.0042;state.pitch-=(t.clientY-lastLook.y)*.0038;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch));lastLook={x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
function endLook(e){for(const t of e.changedTouches){if(t.identifier===lookId){lookId=null;lastLook=null}}}
lookZone.addEventListener('touchend',endLook,{passive:false});lookZone.addEventListener('touchcancel',endLook,{passive:false});

let mouse=false,ml=null;
lookZone.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||!state.active)return;mouse=true;ml={x:e.clientX,y:e.clientY};lookZone.setPointerCapture?.(e.pointerId)});
lookZone.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!mouse||!ml)return;state.yaw-=(e.clientX-ml.x)*.003;state.pitch-=(e.clientY-ml.y)*.003;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch));ml={x:e.clientX,y:e.clientY}});
lookZone.addEventListener('pointerup',()=>{mouse=false;ml=null});lookZone.addEventListener('pointercancel',()=>{mouse=false;ml=null});

let joyId=null;
function moveStick(x,y){const r=joystick.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy;const max=r.width*.32;const len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}state.moveX=dx/max;state.moveY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
joystick?.addEventListener('touchstart',e=>{const t=e.changedTouches[0];joyId=t.identifier;moveStick(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});
joystick?.addEventListener('touchmove',e=>{const t=[...e.touches].find(x=>x.identifier===joyId);if(!t)return;moveStick(t.clientX,t.clientY);e.preventDefault();e.stopPropagation()},{passive:false});
function joyEnd(e){for(const t of e.changedTouches){if(t.identifier===joyId){joyId=null;state.moveX=state.moveY=0;stick.style.transform='translate(0,0)'}}}
joystick?.addEventListener('touchend',joyEnd,{passive:false});joystick?.addEventListener('touchcancel',joyEnd,{passive:false});
jumpButton?.addEventListener('touchstart',e=>{jump();e.preventDefault()},{passive:false});jumpButton?.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')jump()});
window.addEventListener('keydown',e=>{state.keys[e.code]=true;if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.code==='Space')jump()},{passive:false});window.addEventListener('keyup',e=>state.keys[e.code]=false);

enter.addEventListener('click',()=>{if(!state.ready)return;onboarding.hidden=true;state.active=true;state.last=performance.now()});
preview.addEventListener('spawnborn-preview-ready',()=>{cleanInternalUI();if(preview.controls)preview.controls.enabled=false;spawn();setupOverview();state.ready=true;ui.hidden=false;loading.classList.add('done');requestAnimationFrame(loop)},{once:true});
fetch('../maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d').then(r=>{if(!r.ok)throw new Error();return r.text()}).then(t=>preview.loadT3D(t,{name:'TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d'})).catch(()=>{loading.textContent='MAP COULD NOT BE LOADED'});
})();
