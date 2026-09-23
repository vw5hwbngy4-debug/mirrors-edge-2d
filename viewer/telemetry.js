(function(){
'use strict';
const THREE=window.THREE;
const preview=document.querySelector('spawnborn-map-preview');
const loading=document.querySelector('[data-loading]');
const hud=document.querySelector('[data-hud]');
const hotZones=document.querySelector('[data-hot-zones]');
const leaderboard=document.querySelector('[data-leaderboard]');
const liveTag=document.querySelector('[data-live-tag]');
const sessionState=document.querySelector('[data-session-state]');
const deathTotal=document.querySelector('[data-death-total]');
const spawnTotal=document.querySelector('[data-spawn-total]');
const archive=window.SPAWNMAP_SUZHOU_TELEMETRY;
let pulseMats=[],controls=null;

function clean(){
  const sr=preview.shadowRoot;if(!sr)return;
  ['.brand','.panel','.toolbar','.status','.tooltip'].forEach(s=>{const e=sr.querySelector(s);if(e)e.style.display='none'});
}
function setBirdView(){
  const center=new THREE.Vector3(-260,0,-130);
  const span=7200;
  preview.camera.position.set(-3600,7600,5700);
  preview.camera.up.set(0,1,0);
  preview.camera.near=1;preview.camera.far=80000;preview.camera.updateProjectionMatrix();
  if(preview.controls){
    controls=preview.controls;
    controls.target.copy(center);
    controls.enableDamping=true;controls.dampingFactor=.07;
    controls.screenSpacePanning=true;
    controls.minDistance=900;controls.maxDistance=22000;
    controls.update();
  }
}
function addDeathTelemetry(){
  const data=archive;if(!data)return;
  const group=new THREE.Group();group.name='tactical-session-telemetry';preview.scene.add(group);
  const regions=(data.regions||[]).filter(r=>(r.victimDeaths||0)>0).sort((a,b)=>b.victimDeaths-a.victimDeaths);
  const max=Math.max(1,...regions.map(r=>r.victimDeaths||0));
  regions.forEach(r=>{
    const n=r.victimDeaths||0,scale=.65+n/max*1.35,y=Number(r.z)||0;
    const ringMat=new THREE.MeshBasicMaterial({color:0xef6859,transparent:true,opacity:.70,depthWrite:false,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(34*scale,5*scale,10,32),ringMat);
    ring.rotation.x=Math.PI/2;ring.position.set(r.x,y+12,r.y);group.add(ring);pulseMats.push(ringMat);

    const beam=new THREE.Mesh(
      new THREE.CylinderGeometry(8*scale,22*scale,90+35*n,18,1,true),
      new THREE.MeshBasicMaterial({color:0xef6859,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide})
    );
    beam.position.set(r.x,y+(90+35*n)/2,r.y);group.add(beam);

    if((r.killerKills||0)>0){
      const k=new THREE.Mesh(
        new THREE.SphereGeometry(10+3*r.killerKills,14,10),
        new THREE.MeshBasicMaterial({color:0xe9bf55,transparent:true,opacity:.82,depthWrite:false})
      );
      k.position.set(r.x,y+120+26*n,r.y);group.add(k);
    }
  });

  // Observed flow lines remain separate from death hotspots.
  const byId=new Map((data.regions||[]).map(r=>[r.id,r]));
  const edges=(data.edges||[]).slice().sort((a,b)=>(b.count||0)-(a.count||0)).slice(0,14);
  const maxEdge=Math.max(1,...edges.map(e=>e.count||0));
  edges.forEach(e=>{
    const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b)return;
    const A=new THREE.Vector3(a.x,(a.z||0)+65,a.y),B=new THREE.Vector3(b.x,(b.z||0)+65,b.y);
    const geom=new THREE.BufferGeometry().setFromPoints([A,B]);
    const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0xb8e634,transparent:true,opacity:.16+.52*Math.sqrt((e.count||0)/maxEdge)}));
    group.add(line);
  });

  hotZones.innerHTML=regions.slice(0,4).map((r,i)=>`<div class="hot-zone-row"><i>${i+1}</i><span>${escapeHtml(r.label||r.id)}</span><b>${r.victimDeaths} D</b></div>`).join('');
  deathTotal.textContent=String(data.counts?.KILL??regions.reduce((a,r)=>a+(r.victimDeaths||0),0));
  spawnTotal.textContent=String(data.counts?.SPAWN??'—');
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderLeaderboard(rows){
  if(!Array.isArray(rows)||!rows.length){
    leaderboard.innerHTML='<li class="empty">Collector does not publish player ranking yet.</li>';
    liveTag.textContent='NO LIVE SCOREBOARD';liveTag.classList.remove('live');
    return;
  }
  liveTag.textContent='LIVE · 15s';liveTag.classList.add('live');
  leaderboard.innerHTML=rows.slice(0,10).map(p=>`<li><b>${escapeHtml(p.name||p.player||'?')}</b><em>${Number(p.kills||0)} K</em><span>${Number(p.deaths||0)} D</span></li>`).join('');
}
async function refreshLive(){
  try{
    const r=await fetch('/image-to-unreal-map/telemetry-live.php?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error();
    const d=await r.json();
    const rows=d.leaderboard||d.topPlayers||d.top_players||[];
    renderLeaderboard(rows);
    if(d.available){
      sessionState.classList.remove('archived');sessionState.classList.add('live');
      sessionState.querySelector('span').textContent='LIVE SESSION TELEMETRY';
    }else{
      sessionState.classList.remove('live');sessionState.classList.add('archived');
      sessionState.querySelector('span').textContent='SESSION 001 · BOT-ONLY ARCHIVE';
    }
  }catch(_){renderLeaderboard([])}
}
preview.addEventListener('spawnborn-preview-ready',()=>{
  clean();setBirdView();addDeathTelemetry();hud.hidden=false;loading.classList.add('done');
  parent.postMessage({type:'spawnmap:sceneReady',mapId:'suzhou',mode:'telemetry'},'*');
  refreshLive();setInterval(refreshLive,15000);
},{once:true});

function animate(t){
  requestAnimationFrame(animate);
  const wave=.48+.22*Math.sin(t*.003);
  pulseMats.forEach((m,i)=>m.opacity=Math.max(.22,Math.min(.82,wave+i*.035)));
}
requestAnimationFrame(animate);

fetch('/image-to-unreal-map/maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d',{cache:'no-store'})
 .then(r=>{if(!r.ok)throw new Error('Map source could not load');return r.text()})
 .then(t=>preview.loadT3D(t,{name:'TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d'}))
 .catch(e=>{loading.querySelector('span').textContent=e.message});
})();