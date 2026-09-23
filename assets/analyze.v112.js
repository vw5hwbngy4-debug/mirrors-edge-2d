
(() => {
  const svg = document.querySelector('#semantic-runtime-map');
  if (!svg) return;

  const paths = {
    regions: '/image-to-unreal-map/data/semantic-runtime-v011/suzhou-v3.semantic-regions.geo.json',
    summary: '/image-to-unreal-map/data/semantic-runtime-v011/suzhou-v3.semantic-runtime-summary.json',
    transitions: '/image-to-unreal-map/data/semantic-runtime-v011/suzhou-v3.semantic-transitions.json'
  };

  const inspector = document.querySelector('#region-inspector');
  const regionRank = document.querySelector('#region-rank');
  const flowRank = document.querySelector('#flow-rank');
  const toolbar = document.querySelector('#semantic-toolbar');

  let geo, summary, flow;
  let mode = 'movement';
  let selected = null;
  const NS = 'http://www.w3.org/2000/svg';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const fmtSec = n => `${Number(n || 0).toLocaleString('en-US')} s`;

  function metric(p, m) {
    if (m === 'kills') return Number(p.killsByVictimLocation || 0);
    if (m === 'dwell') return Number(p.approximateDwellSeconds || 0);
    if (m === 'regions') return 1;
    return Number(p.movementSamples || 0);
  }

  function bounds(features) {
    const xs=[], ys=[];
    features.forEach(f => {
      (f.geometry?.coordinates?.[0] || []).forEach(([x,y]) => {xs.push(x); ys.push(y);});
    });
    return {minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys)};
  }

  function centroid(f) {
    const pts = f.geometry?.coordinates?.[0] || [];
    if (!pts.length) return [0,0];
    const usable = pts.length > 1 && pts[0][0] === pts[pts.length-1][0] && pts[0][1] === pts[pts.length-1][1] ? pts.slice(0,-1) : pts;
    return [
      usable.reduce((a,p)=>a+p[0],0)/usable.length,
      usable.reduce((a,p)=>a+p[1],0)/usable.length
    ];
  }

  function transformFactory(b) {
    const pad=280, W=9000, H=7600;
    const sx=(W-pad*2)/(b.maxX-b.minX || 1);
    const sy=(H-pad*2)/(b.maxY-b.minY || 1);
    const s=Math.min(sx,sy);
    const ox=(W-(b.maxX-b.minX)*s)/2;
    const oy=(H-(b.maxY-b.minY)*s)/2;
    return {
      W,H,
      point(x,y){ return [ox+(x-b.minX)*s, H-(oy+(y-b.minY)*s)]; }
    };
  }

  function polygonPoints(f, T) {
    return (f.geometry?.coordinates?.[0] || []).map(([x,y]) => T.point(x,y).join(',')).join(' ');
  }

  function colorFor(f, maxVal) {
    const p=f.properties || {};
    const value=metric(p, mode);
    if (mode === 'regions') return {fill:'rgba(184,230,52,.12)', stroke:'#59662b', opacity:.65};
    if (value <= 0) return {fill:'rgba(25,32,35,.18)', stroke:'#364145', opacity:.5};
    const r=Math.min(1, value/(maxVal || 1));
    const alpha=.16 + Math.sqrt(r)*.55;
    if (mode === 'kills') return {fill:`rgba(238,92,75,${alpha})`,stroke:'#e27769',opacity:.92};
    if (mode === 'dwell') return {fill:`rgba(255,196,82,${alpha})`,stroke:'#d3a34f',opacity:.9};
    return {fill:`rgba(184,230,52,${alpha})`,stroke:'#91b428',opacity:.92};
  }

  function showInspector(f) {
    if (!f) return;
    selected = f.id;
    const p=f.properties || {};
    inspector.innerHTML = `
      <small>${esc((p.regionType || 'region').toUpperCase())}</small>
      <h3>${esc(p.label || f.id)}</h3>
      <div class="region-id">${esc(f.id)}</div>
      <div class="region-metrics-mini">
        <div><b>${fmt(p.movementSamples)}</b><span>MOVEMENT</span></div>
        <div><b>${fmtSec(p.approximateDwellSeconds)}</b><span>DWELL</span></div>
        <div><b>${fmt(p.killsByVictimLocation)}</b><span>DEATHS HERE</span></div>
        <div><b>${fmt(p.killsByKillerLocation)}</b><span>KILLS FROM HERE</span></div>
      </div>
      <div class="region-source">
        confidence ${Number(p.confidence || 0).toFixed(2)} · ${esc(p.sourceFactKind || 'derived')}<br>
        Semantic annotations are derived from map regions; measured coordinates remain separate raw evidence.
      </div>`;
    document.querySelectorAll('.semantic-region').forEach(el => el.classList.toggle('selected', el.dataset.id === selected));
  }

  function render() {
    const features=geo.features || [];
    const b=bounds(features), T=transformFactory(b);
    svg.setAttribute('viewBox', `0 0 ${T.W} ${T.H}`);
    svg.innerHTML='';

    const values=features.map(f=>metric(f.properties || {}, mode));
    const maxVal=Math.max(...values,1);

    // Flow first, so regions remain clickable above it.
    if (mode === 'flow') {
      const byId=Object.fromEntries(features.map(f=>[f.id,f]));
      const top=(flow.edges || []).slice().sort((a,b)=>b.count-a.count).slice(0,16);
      const maxEdge=Math.max(...top.map(e=>e.count),1);
      top.forEach(e=>{
        const a=byId[e.from], b2=byId[e.to];
        if(!a || !b2) return;
        const ca=centroid(a), cb=centroid(b2), A=T.point(ca[0],ca[1]), B=T.point(cb[0],cb[1]);
        const line=document.createElementNS(NS,'line');
        line.setAttribute('x1',A[0]); line.setAttribute('y1',A[1]); line.setAttribute('x2',B[0]); line.setAttribute('y2',B[1]);
        line.setAttribute('stroke','#b8e634');
        line.setAttribute('stroke-width',String(10+42*Math.sqrt(e.count/maxEdge)));
        line.setAttribute('class','flow-edge');
        line.setAttribute('stroke-linecap','round');
        svg.appendChild(line);
      });
    }

    features.forEach(f=>{
      const poly=document.createElementNS(NS,'polygon');
      const c=colorFor(f,maxVal);
      poly.setAttribute('points',polygonPoints(f,T));
      poly.setAttribute('fill',c.fill);
      poly.setAttribute('stroke',c.stroke);
      poly.setAttribute('stroke-width','18');
      poly.setAttribute('opacity',c.opacity);
      poly.setAttribute('class','semantic-region');
      poly.dataset.id=f.id;
      poly.addEventListener('click',()=>showInspector(f));
      svg.appendChild(poly);
    });

    // Label selected / important active regions.
    const ranked=features.slice().sort((a,b)=>metric(b.properties||{},mode)-metric(a.properties||{},mode));
    const labels=(mode==='regions' ? ranked.filter(f=>['spawn','route'].includes(f.properties?.regionType)).slice(0,8) : ranked.filter(f=>metric(f.properties||{},mode)>0).slice(0,7));
    labels.forEach(f=>{
      const [cx,cy]=centroid(f), [x,y]=T.point(cx,cy);
      const t=document.createElementNS(NS,'text');
      t.setAttribute('x',x); t.setAttribute('y',y);
      t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
      t.setAttribute('class','semantic-region-label');
      t.textContent=(f.properties?.label || f.id).replace('Special Forces ','SF ').replace('Terrorist ','TERR ').replace(' canal ',' ');
      svg.appendChild(t);
    });

    document.querySelectorAll('#semantic-toolbar button').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
    if (selected) {
      const f=features.find(x=>x.id===selected);
      if (f) showInspector(f);
    }
  }

  function populateRanks() {
    const metrics=(summary.regionMetrics || []).slice().sort((a,b)=>b.movementSamples-a.movementSamples);
    regionRank.innerHTML=metrics.slice(0,10).map(r=>`
      <div class="region-rank-row">
        <strong>${esc(r.label)}</strong>
        <span>${fmt(r.movementSamples)} move</span>
        <span class="dwell-col">${fmtSec(r.approximateDwellSeconds)}</span>
        <b>${fmt(r.killsByVictimLocation)} D</b>
      </div>`).join('');

    const edges=(flow.edges || []).slice().sort((a,b)=>b.count-a.count);
    const labels=Object.fromEntries((flow.nodes||[]).map(n=>[n.id,n.label]));
    flowRank.innerHTML=edges.slice(0,10).map(e=>`
      <div class="flow-rank-row">
        <div><b>${esc(labels[e.from] || e.from)}</b> → ${esc(labels[e.to] || e.to)}</div>
        <b>${fmt(e.count)}×</b>
      </div>`).join('');
  }

  toolbar?.addEventListener('click', e=>{
    const btn=e.target.closest('button[data-mode]');
    if(!btn) return;
    mode=btn.dataset.mode;
    render();
  });

  Promise.all(Object.entries(paths).map(async ([key,url]) => {
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return [key,await r.json()];
  })).then(entries=>{
    const data=Object.fromEntries(entries);
    geo=data.regions; summary=data.summary; flow=data.transitions;
    populateRanks();
    render();
    const defaultRegion=(geo.features||[]).find(f=>f.id==='route.central_bridge') || geo.features?.[0];
    if(defaultRegion) showInspector(defaultRegion);
  }).catch(err=>{
    inspector.innerHTML=`<small>DATA ERROR</small><h3>Semantic runtime data could not load.</h3><p>${esc(err.message)}</p>`;
  });
})();
