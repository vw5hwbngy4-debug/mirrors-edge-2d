(function(){
  'use strict';
  const body=document.body;
  const drawer=document.querySelector('[data-drawer]');
  const detail=document.querySelector('[data-map-detail]');
  const overviewFrame=document.querySelector('[data-overview-frame]');
  const spectatorFrame=document.querySelector('[data-spectator-inline-frame]');
  const createModal=document.querySelector('[data-create-modal]');

  function show(el){ if(el) el.hidden=false; }
  function hide(el){ if(el) el.hidden=true; }
  function syncLock(){
    const open=[drawer,detail,createModal].some(el=>el && !el.hidden);
    body.classList.toggle('overlay-open',open);
  }
  function loadFrame(frame){ if(frame && !frame.getAttribute('src')) frame.setAttribute('src',frame.dataset.src); }
  function unloadFrame(frame){ if(frame) frame.removeAttribute('src'); }

  document.querySelector('[data-menu]')?.addEventListener('click',()=>{show(drawer);syncLock();});
  document.querySelectorAll('[data-close-menu]').forEach(el=>el.addEventListener('click',()=>{hide(drawer);syncLock();}));
  drawer?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{hide(drawer);syncLock();}));

  document.querySelectorAll('[data-open-map]').forEach(row=>row.addEventListener('click',()=>{
    show(detail);
    syncLock();
    loadFrame(overviewFrame);
    loadFrame(spectatorFrame);
    detail.querySelector('.detail-scroll')?.scrollTo(0,0);
  }));

  document.querySelector('[data-close-map]')?.addEventListener('click',()=>{
    hide(detail);
    unloadFrame(overviewFrame);
    unloadFrame(spectatorFrame);
    syncLock();
  });

  document.querySelectorAll('[data-create]').forEach(el=>el.addEventListener('click',()=>{hide(drawer);show(createModal);syncLock();}));
  document.querySelectorAll('[data-close-create]').forEach(el=>el.addEventListener('click',()=>{hide(createModal);syncLock();}));
  document.querySelector('[data-copy-create]')?.addEventListener('click',async e=>{
    const text=createModal.querySelector('textarea').value;
    try{await navigator.clipboard.writeText(text);e.currentTarget.textContent='COPIED';setTimeout(()=>e.currentTarget.textContent='COPY STARTER PROMPT',1300);}catch(_){createModal.querySelector('textarea').select();}
  });

  const search=document.querySelector('[data-map-search]');
  const rows=[...document.querySelectorAll('[data-map-name]')];
  const count=document.querySelector('[data-result-count]');
  const empty=document.querySelector('[data-empty]');
  function filter(){
    const q=(search?.value||'').trim().toLowerCase(); let visible=0;
    rows.forEach(row=>{const hit=!q || row.dataset.mapName.toLowerCase().includes(q);row.hidden=!hit;if(hit)visible++;});
    if(count) count.textContent=visible+(visible===1?' MAP':' MAPS');
    if(empty) empty.hidden=visible!==0;
  }
  search?.addEventListener('input',filter);

  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(createModal && !createModal.hidden) hide(createModal);
    else if(detail && !detail.hidden){ hide(detail); unloadFrame(overviewFrame); unloadFrame(spectatorFrame); }
    else if(drawer && !drawer.hidden) hide(drawer);
    syncLock();
  });
})();


// v0.7 TO-GPT server status. Polls the local PHP bridge so browsers do not need UDP access.
(function(){
  'use strict';
  const indicators=[...document.querySelectorAll('[data-server-indicator]')];
  const labels=[...document.querySelectorAll('[data-server-status]')];
  if(!indicators.length && !labels.length) return;

  function paint(state,data){
    indicators.forEach(el=>{
      el.classList.remove('online','offline','checking');
      el.classList.add(state);
      const suffix=data && data.players!=null && data.maxPlayers!=null ? ` · ${data.players}/${data.maxPlayers}` : '';
      el.title=state==='online' ? `TO-GPT server online${suffix}` : (data?.configured===false ? 'TO-GPT server is not configured yet' : 'TO-GPT server offline');
    });
    labels.forEach(el=>{
      el.classList.remove('online','offline','checking');
      el.classList.add(state);
      if(state==='online'){
        const players=(data && data.players!=null && data.maxPlayers!=null) ? ` · ${data.players}/${data.maxPlayers}` : '';
        el.textContent='ONLINE'+players;
      } else if(state==='checking') el.textContent='CHECKING';
      else el.textContent='OFFLINE';
    });
  }

  async function refresh(){
    try{
      const response=await fetch('/image-to-unreal-map/server-status.php?ts='+Date.now(),{cache:'no-store',headers:{'Accept':'application/json'}});
      if(!response.ok) throw new Error('status '+response.status);
      const data=await response.json();
      paint(data.online?'online':'offline',data);
    }catch(_){ paint('offline',{configured:true}); }
  }
  paint('checking',{});
  refresh();
  window.setInterval(refresh,30000);
})();

// v11 artifact provenance helpers.
(function(){
  'use strict';
  const btn=document.querySelector('[data-copy-sha]');
  const sha=document.querySelector('[data-sha]');
  if(btn&&sha){btn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sha.textContent.trim());btn.textContent='COPIED';setTimeout(()=>btn.textContent='COPY',1200);}catch(_){btn.textContent='SELECT';const r=document.createRange();r.selectNodeContents(sha);const s=window.getSelection();s.removeAllRanges();s.addRange(r);}});}
})();
