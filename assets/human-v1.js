(function(){
'use strict';

const prompt = document.querySelector('[data-map-prompt]');
const copy = document.querySelector('[data-copy-prompt]');
const toast = document.querySelector('[data-toast]');

function showToast(text){
  if(!toast) return;
  toast.textContent=text;
  toast.hidden=false;
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>toast.hidden=true,1500);
}

copy?.addEventListener('click', async ()=>{
  const brief=(prompt?.value||'').trim();
  const core=brief || 'Create a professional Tactical Ops map with safe team spawns, multiple viable routes, readable landmarks, human-scale spaces, strong counterplay and navigation that stock bots can use.';
  const text=`SpawnMap build request: ${core}

Build this as a real Tactical Ops / Unreal Engine 1 map. Preserve competitive readability, safe team spawns, multiple meaningful routes and human-scale architecture. Return the browser preview for walking/inspection before compiling the final .unr, then use the SpawnMap plugin/tooling to build the playable artifact.`;
  try{
    await navigator.clipboard.writeText(text);
    showToast('SPAWNMAP PROMPT COPIED');
  }catch(_){
    prompt.value=text; prompt.focus(); prompt.select();
    showToast('PROMPT SELECTED');
  }
});

const serverBox=document.querySelector('[data-server-box]');
const serverLabel=document.querySelector('[data-server-status]');
async function pollServer(){
  if(!serverBox) return;
  try{
    const r=await fetch('/image-to-unreal-map/server-status.php?ts='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error();
    const d=await r.json();
    serverBox.classList.toggle('online',!!d.online);
    serverBox.classList.toggle('checking',false);
    if(serverLabel) serverLabel.textContent=d.online ? ((d.map||'SERVER').replace(/^TO-/,'').slice(0,18)+' · LIVE') : 'SERVER OFFLINE';
  }catch(_){
    serverBox.classList.remove('online','checking');
    if(serverLabel) serverLabel.textContent='SERVER';
  }
}
pollServer();
setInterval(pollServer,30000);
})();
