(function(){
  'use strict';
  const THREE = window.THREE;
  const preview = document.querySelector('spawnborn-map-preview');
  const loading = document.querySelector('.loading');

  const FIXED_VIEW = {
    position: { x: -13243, y: 10486, z: 17342 },
    target: { x: -1670, y: -4575, z: 1636 }
  };

  function cleanInternalUI(){
    const sr = preview.shadowRoot;
    if(!sr) return;
    ['.panel','.toolbar','.status','.tooltip'].forEach(sel=>{
      const el = sr.querySelector(sel);
      if(el) el.style.display = 'none';
    });
  }

  function fixedOverviewView(){
    if(!THREE) return null;
    return {
      position: new THREE.Vector3(FIXED_VIEW.position.x, FIXED_VIEW.position.y, FIXED_VIEW.position.z),
      target: new THREE.Vector3(FIXED_VIEW.target.x, FIXED_VIEW.target.y, FIXED_VIEW.target.z)
    };
  }

  function applyView(view){
    if(!THREE || !preview.camera || !preview.controls || !view) return;
    preview.controls.target.copy(view.target);
    preview.camera.up.set(0,1,0);
    preview.camera.position.copy(view.position);
    preview.camera.near = 1;
    preview.camera.far = 60000;
    preview.camera.updateProjectionMatrix();
    preview.controls.update();
  }

  function syncRendererSize(){
    if(!preview || !preview.renderer || !preview.camera) return;
    const rect = preview.getBoundingClientRect ? preview.getBoundingClientRect() : null;
    if(rect && rect.width && rect.height){
      preview.camera.aspect = rect.width / rect.height;
      preview.camera.updateProjectionMatrix();
      preview.renderer.setSize(rect.width, rect.height, false);
    }
  }

  function settleOverviewStart(){
    const view = fixedOverviewView();
    [0, 120, 360, 900].forEach(delay=>{
      setTimeout(()=>{
        applyView(view);
        syncRendererSize();
      }, delay);
    });
  }

  preview.addEventListener('spawnborn-preview-ready', ()=>{
    cleanInternalUI();
    requestAnimationFrame(()=>{
      settleOverviewStart();
      loading.classList.add('done');
      try{parent.postMessage({type:'spawnmap:sceneReady',mapId:'suzhou',mode:'overview'},'*')}catch(_){}
    });
  }, { once:true });

  window.addEventListener('resize', settleOverviewStart);
  window.addEventListener('orientationchange', settleOverviewStart);

  fetch('../maps/TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d')
    .then(r=>{ if(!r.ok) throw new Error('Map source could not be loaded.'); return r.text(); })
    .then(t=> preview.loadT3D(t,{ name:'TO-GPT-SuzhouCanal-GraffitiFruit-v3.t3d' }))
    .catch(e=>{ loading.textContent = e.message; });
})();
