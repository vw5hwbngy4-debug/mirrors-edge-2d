(function (global) {
  'use strict';

  if (!global.THREE) throw new Error('Spawnborn Map Preview requires THREE (tested with the UTPackage.js demo build, r117).');
  if (!global.OrbitControls) throw new Error('Spawnborn Map Preview requires OrbitControls.');
  if (!global.SpawnbornT3D) throw new Error('Spawnborn Map Preview requires t3d-parser.js.');

  const THREE = global.THREE;
  const DEG_PER_UT = Math.PI * 2 / 0x10000;

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host { display:block; width:100%; height:100%; min-height:520px; color:#e9edef; font: 13px/1.35 "Arial Narrow", Arial, sans-serif; }
      * { box-sizing:border-box; }
      .shell { position:relative; width:100%; height:100%; min-height:520px; overflow:hidden; border-radius:0; background:#090b0d; border:0; box-shadow:none; }
      canvas { display:block; width:100%; height:100%; outline:none; }
      .canvas-wrap { position:absolute; inset:0; }
      .topbar { position:absolute; left:14px; right:14px; top:14px; display:flex; align-items:center; gap:8px; z-index:5; pointer-events:none; }
      .brand, .toolbar, .status { pointer-events:auto; backdrop-filter: blur(16px); background:rgba(9,11,13,.82); border:1px solid rgba(195,205,210,.22); box-shadow:0 8px 30px rgba(0,0,0,.35); }
      .brand { display:flex; align-items:center; min-width:0; gap:10px; padding:9px 12px; border-radius:13px; }
      .mark { width:26px; height:26px; display:grid; place-items:center; border-radius:2px; background:#b8e634; color:#11150a; font-weight:1000; font-size:15px; }
      .title-wrap { min-width:0; }
      .eyebrow { font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:#899195; font-weight:800; }
      .title { max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; font-weight:750; color:#f5f9ff; }
      .toolbar { margin-left:auto; display:flex; gap:5px; padding:5px; border-radius:12px; }
      button { appearance:none; border:0; cursor:pointer; font:inherit; color:#dbeafe; background:rgba(116,146,190,.09); border:1px solid rgba(148,173,214,.12); padding:7px 9px; border-radius:9px; transition:.14s ease; }
      button:hover { background:rgba(116,168,235,.18); border-color:rgba(148,197,255,.3); }
      button.active { background:rgba(184,230,52,.18); border-color:rgba(184,230,52,.48); color:white; }
      button.primary { background:rgba(184,230,52,.15); border-color:rgba(184,230,52,.35); }
      .panel { position:absolute; z-index:5; top:72px; right:14px; width:226px; max-height:calc(100% - 88px); overflow:auto; padding:12px; border-radius:4px; background:rgba(9,11,13,.82); border:1px solid rgba(195,205,210,.2); backdrop-filter: blur(16px); box-shadow:0 10px 38px rgba(0,0,0,.34); }
      .panel h3 { margin:0 0 9px; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#8ca7c9; }
      .stats { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px; }
      .stat { border-radius:9px; background:rgba(130,164,211,.07); border:1px solid rgba(157,187,230,.09); padding:7px 8px; }
      .stat strong { display:block; font-size:15px; color:#f6fbff; line-height:1; margin-bottom:3px; }
      .stat span { color:#8ea7c5; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }
      .toggles { display:grid; gap:6px; margin-bottom:12px; }
      label.toggle { display:flex; gap:8px; align-items:center; color:#c7d5e8; cursor:pointer; user-select:none; }
      label.toggle input { accent-color:#7dd3fc; }
      .legend { display:grid; grid-template-columns:1fr 1fr; gap:6px 8px; color:#afc2da; font-size:10px; }
      .legend div { display:flex; align-items:center; gap:6px; min-width:0; }
      .swatch { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
      .drop-hint { position:absolute; z-index:3; inset:0; display:none; place-items:center; background:rgba(2,10,21,.80); border:2px dashed rgba(125,211,252,.55); color:#eaf7ff; font-size:18px; font-weight:700; }
      .drop-hint.show { display:grid; }
      .empty { position:absolute; z-index:2; inset:0; display:grid; place-items:center; pointer-events:none; }
      .empty-card { text-align:center; max-width:340px; padding:24px; color:#a9bdd5; }
      .empty-card b { display:block; color:#f5fbff; font-size:17px; margin-bottom:6px; }
      .status { position:absolute; z-index:6; left:14px; bottom:14px; padding:7px 10px; border-radius:10px; color:#abc0db; font-size:10px; }
      .status.good { color:#c7f9df; }
      .tooltip { position:absolute; z-index:10; pointer-events:none; display:none; min-width:150px; max-width:260px; padding:8px 10px; border-radius:10px; background:rgba(4,12,23,.94); border:1px solid rgba(152,188,238,.24); box-shadow:0 8px 24px rgba(0,0,0,.32); color:#dbeafe; font-size:10px; }
      .tooltip b { display:block; color:white; margin-bottom:2px; }
      .warn { color:#ffd899; }
      input[type=file] { display:none; }
      @media (max-width: 720px) {
        :host { min-height:600px; }
        .shell { border-radius:0; }
        .topbar { left:8px; right:8px; top:8px; flex-wrap:wrap; }
        .brand { max-width:calc(100% - 8px); }
        .title { max-width:210px; }
        .toolbar { width:100%; margin-left:0; overflow:auto; }
        .panel { top:auto; left:8px; right:8px; bottom:8px; width:auto; max-height:186px; }
        .status { display:none; }
        .stats { grid-template-columns:repeat(4,1fr); }
        .legend { display:none; }
      }
    </style>
    <div class="shell">
      <div class="canvas-wrap"></div>
      <div class="empty"><div class="empty-card"><b>Drop a Tactical Ops T3D</b>Drag a <code>.t3d</code> here or load the built-in Suzhou Canal sample.</div></div>
      <div class="drop-hint">Drop T3D to preview</div>
      <div class="topbar">
        <div class="brand"><div class="mark">S</div><div class="title-wrap"><div class="eyebrow">SpawnMap.ai · live geometry</div><div class="title">Compiling map…</div></div></div>
        <div class="toolbar">
          <button data-action="open" class="primary">Open T3D</button>
          <button data-action="sample" style="display:none">Suzhou Canal</button>
          <button data-action="fit">Fit</button>
          <button data-action="top">Top</button>
          <button data-action="orbit" class="active">3D</button>
          <button data-action="png">PNG</button>
        </div>
      </div>
      <aside class="panel">
        <h3>Map genome view</h3>
        <div class="stats">
          <div class="stat"><strong data-stat="brushes">0</strong><span>Brushes</span></div>
          <div class="stat"><strong data-stat="polygons">0</strong><span>Polys</span></div>
          <div class="stat"><strong data-stat="spawns">0</strong><span>Spawns</span></div>
          <div class="stat"><strong data-stat="paths">0</strong><span>Paths</span></div>
          <div class="stat"><strong data-stat="lights">0</strong><span>Lights</span></div>
          <div class="stat"><strong data-stat="sky">0</strong><span>Sky</span></div>
        </div>
        <h3>Layers</h3>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" data-toggle="solid" checked> Semantic solid</label>
          <label class="toggle"><input type="checkbox" data-toggle="wire" checked> Brush wireframe</label>
          <label class="toggle"><input type="checkbox" data-toggle="spawns" checked> Team PlayerStarts</label>
          <label class="toggle"><input type="checkbox" data-toggle="paths"> PathNodes</label>
          <label class="toggle"><input type="checkbox" data-toggle="lights"> Lights</label>
          <label class="toggle"><input type="checkbox" data-toggle="zones" checked> Objective / scenario</label>
          <label class="toggle"><input type="checkbox" data-toggle="shells"> CSG subtractive shells</label>
          <label class="toggle"><input type="checkbox" data-toggle="sky"> PF_FakeBackdrop / sky stage</label>
        </div>
        <h3>Materials</h3>
        <div style="margin:-2px 0 10px;color:#8ea7c5;font-size:10px">Asset Cache first · semantic fallback</div>
        <h3>Fallback legend</h3>
        <div class="legend">
          <div><i class="swatch" style="background:#dfefff"></i>snow</div>
          <div><i class="swatch" style="background:#a9c9e8"></i>ice</div>
          <div><i class="swatch" style="background:#8290a3"></i>stone</div>
          <div><i class="swatch" style="background:#8da77d"></i>path</div>
          <div><i class="swatch" style="background:#8d6e59"></i>wood</div>
          <div><i class="swatch" style="background:#7993ad"></i>other</div>
        </div>
      </aside>
      <div class="status">ready</div>
      <div class="tooltip"></div>
      <input type="file" accept=".t3d,text/plain">
    </div>
  `;

  class SpawnbornMapPreview extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this.map = null;
      this.objects = {};
      this._raf = null;
      this._dragDepth = 0;
      this.assetResolver = (global.SpawnbornAssetResolver && global.SPAWNBORN_ASSET_CACHE_MANIFEST)
        ? new global.SpawnbornAssetResolver(global.SPAWNBORN_ASSET_CACHE_MANIFEST, { basePath: './asset-cache' })
        : null;
      this.assetStats = { referenced: [], resolved: [], unresolved: [] };
      this._textureCache = {};
    }

    connectedCallback() {
      if (this._connected) return;
      this._connected = true;
      this._initThree();
      this._bindUI();
      this._animate();
      if (this.hasAttribute('autoload-sample') && global.SPAWNBORN_SAMPLE) this.loadSample();
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.renderer) this.renderer.dispose();
    }

    _initThree() {
      const wrap = this.shadowRoot.querySelector('.canvas-wrap');
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x07111f);
      this.scene.fog = new THREE.FogExp2(0x07111f, 0.000035);

      this.camera = new THREE.PerspectiveCamera(52, 1, 1, 120000);
      this.camera.position.set(5500, 4800, 6500);
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
      } catch (err) {
        console.warn('Spawnborn Map Preview: WebGL unavailable, using Canvas 2D fallback.', err);
        this.renderer = null;
        this._initFallback2D(wrap);
        return;
      }
      this.webglAvailable = true;
      this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.domElement.tabIndex = 0;
      wrap.appendChild(this.renderer.domElement);

      this.controls = new global.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.screenSpacePanning = true;
      this.controls.maxDistance = 80000;
      this.controls.minDistance = 80;

      const hemi = new THREE.HemisphereLight(0xc8e5ff, 0x1e2835, 1.25);
      this.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(-3000, 7000, 2600);
      this.scene.add(sun);

      this.grid = new THREE.GridHelper(20000, 40, 0x27496b, 0x142b43);
      this.grid.material.transparent = true;
      this.grid.material.opacity = 0.28;
      this.grid.position.y = -2;
      this.scene.add(this.grid);

      this.axes = new THREE.AxesHelper(400);
      this.axes.material.transparent = true;
      this.axes.material.opacity = 0.5;
      this.scene.add(this.axes);

      this.worldRoot = new THREE.Group();
      this.shellRoot = new THREE.Group();
      this.skyRoot = new THREE.Group();
      this.spawnRoot = new THREE.Group();
      this.pathRoot = new THREE.Group();
      this.lightRoot = new THREE.Group();
      this.zoneRoot = new THREE.Group();
      this.scene.add(this.worldRoot, this.shellRoot, this.skyRoot, this.spawnRoot, this.pathRoot, this.lightRoot, this.zoneRoot);
      this.shellRoot.visible = false;
      this.skyRoot.visible = false;
      this.pathRoot.visible = false;
      this.lightRoot.visible = false;

      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
      this.renderer.domElement.addEventListener('pointermove', e => this._onPointerMove(e));
      this.renderer.domElement.addEventListener('pointerleave', () => this._hideTooltip());

      this.resizeObserver = new ResizeObserver(() => this._resize());
      this.resizeObserver.observe(wrap);
      this._resize();
    }

    _initFallback2D(wrap) {
      this.webglAvailable = false;
      this.fallbackView = 'iso';
      this.fallbackCanvas = document.createElement('canvas');
      this.fallbackCanvas.style.width = '100%';
      this.fallbackCanvas.style.height = '100%';
      this.fallbackCanvas.style.display = 'block';
      this.fallbackCanvas.style.background = '#07111f';
      wrap.appendChild(this.fallbackCanvas);
      this.fallbackCtx = this.fallbackCanvas.getContext('2d');
      this.resizeObserver = new ResizeObserver(() => this._resize());
      this.resizeObserver.observe(wrap);
      this._resize();
      this._setStatus('WebGL unavailable · Canvas 2D fallback active');
    }

    _fallbackActorVertex(v, actor) {
      const p = actor.properties || {};
      const pre = p.PrePivot || { x: 0, y: 0, z: 0 };
      const main = p.MainScale || { x: 1, y: 1, z: 1 };
      const post = p.PostScale || { x: 1, y: 1, z: 1 };
      const loc = p.Location || { x: 0, y: 0, z: 0 };
      const tv = new THREE.Vector3(
        (v.x - (pre.x || 0)) * (main.x || 1) * (post.x || 1),
        (v.z - (pre.z || 0)) * (main.z || 1) * (post.z || 1),
        (v.y - (pre.y || 0)) * (main.y || 1) * (post.y || 1)
      );
      if (p.Rotation) {
        const e = new THREE.Euler(
          (p.Rotation.roll || 0) * DEG_PER_UT,
          -(p.Rotation.yaw || 0) * DEG_PER_UT,
          (p.Rotation.pitch || 0) * DEG_PER_UT,
          'YZX'
        );
        tv.applyEuler(e);
      }
      tv.x += loc.x || 0;
      tv.y += loc.z || 0;
      tv.z += loc.y || 0;
      return tv;
    }

    _fallbackProjection(v) {
      if (this.fallbackView === 'top') return { x: v.x, y: -v.z, depth: v.y };
      return {
        x: (v.x - v.z) * 0.8660254,
        y: (v.x + v.z) * 0.34 - v.y * 0.88,
        depth: v.x + v.z + v.y * 0.3,
      };
    }

    _buildFallback(map) {
      this._fallbackPolys = [];
      for (const actor of map.actors) {
        if (!actor.brush) continue;
        const op = Number(actor.properties.CsgOper);
        const g = String(actor.properties.Group || '');
        const isWorld = /world/i.test(g) && op === 2;
        const isSkyStage = /sky/i.test(g) && op === 2;
        for (const poly of actor.brush.polygons) {
          const fake = (Number(poly.flags) & 128) !== 0;
          let layer = null;
          if (op === 1 && !fake) layer = 'solid';
          else if (isWorld && !fake && poly.normal && poly.normal.z < -0.5) layer = 'solid';
          else if (op === 2 && !fake && !isSkyStage) layer = 'shell';
          else if (fake || isSkyStage) layer = 'sky';
          if (!layer || poly.vertices.length < 3) continue;
          const verts = poly.vertices.map(v => this._fallbackActorVertex(v, actor));
          this._fallbackPolys.push({ actor, poly, verts, layer, role: this._roleForPolygon(poly) });
        }
      }
      this._drawFallback();
    }

    _fallbackRoleColor(role, alpha) {
      const colors = {
        snow:[223,239,255], ice:[169,201,232], stone:[130,144,163], path:[141,167,125],
        roof:[183,197,215], wood:[141,110,89], metal:[125,141,158], other:[121,147,173], sky:[114,199,238]
      };
      const c = colors[role] || colors.other;
      return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    }

    _drawFallback() {
      if (!this.fallbackCtx) return;
      const c = this.fallbackCanvas, ctx = this.fallbackCtx;
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const cssW = Math.max(1, c.clientWidth), cssH = Math.max(1, c.clientHeight);
      if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
        c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.fillStyle = '#07111f'; ctx.fillRect(0,0,cssW,cssH);
      if (!this.map || !this._fallbackPolys) return;

      const togg = key => { const el=this.shadowRoot.querySelector(`[data-toggle=${key}]`); return !!(el && el.checked); };
      const projected=[];
      for (const item of this._fallbackPolys) {
        if (item.layer==='shell' && !togg('shells')) continue;
        if (item.layer==='sky' && !togg('sky')) continue;
        if (item.layer==='solid' && !(togg('solid') || togg('wire'))) continue;
        const pts=item.verts.map(v=>this._fallbackProjection(v));
        projected.push({ ...item, pts, depth:pts.reduce((a,p)=>a+p.depth,0)/pts.length });
      }
      const fitPts = projected.filter(i=>i.layer==='solid').flatMap(i=>i.pts);
      if (!fitPts.length) return;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for (const p of fitPts){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
      const pad=50, sx=(cssW-pad*2)/Math.max(1,maxX-minX), sy=(cssH-pad*2)/Math.max(1,maxY-minY), scale=Math.min(sx,sy);
      const ox=(cssW-(maxX-minX)*scale)/2-minX*scale, oy=(cssH-(maxY-minY)*scale)/2-minY*scale;
      const toScreen=p=>({x:p.x*scale+ox,y:p.y*scale+oy});

      projected.sort((a,b)=>a.depth-b.depth);
      for (const item of projected) {
        const pts=item.pts.map(toScreen);
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath();
        if (item.layer==='solid' && togg('solid')) { ctx.fillStyle=this._fallbackRoleColor(item.role,0.84); ctx.fill(); }
        if (item.layer==='sky') { ctx.fillStyle=this._fallbackRoleColor('sky',0.10); ctx.fill(); }
        if (item.layer==='shell') { ctx.strokeStyle='rgba(241,188,112,.32)'; ctx.lineWidth=1; ctx.stroke(); }
        if (item.layer==='solid' && togg('wire')) { ctx.strokeStyle='rgba(215,232,252,.34)'; ctx.lineWidth=.8; ctx.stroke(); }
      }

      const actorPoint = actor => { const loc=actor.properties.Location||{x:0,y:0,z:0}; const v=new THREE.Vector3(loc.x||0,loc.z||0,loc.y||0); return toScreen(this._fallbackProjection(v)); };
      if (togg('paths')) for (const a of this.map.actors.filter(a=>a.className==='PathNode')) { const p=actorPoint(a); ctx.fillStyle='rgba(101,199,255,.85)'; ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fill(); }
      if (togg('lights')) for (const a of this.map.actors.filter(a=>a.className==='Light')) { const p=actorPoint(a); ctx.fillStyle='rgba(255,226,146,.95)';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill(); }
      if (togg('spawns')) for (const a of this.map.actors.filter(a=>a.className==='PlayerStart')) { const p=actorPoint(a), team=Number(a.properties.TeamNumber); ctx.fillStyle=team===0?'#f05b63':'#5a9dff';ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke(); }
      if (togg('zones')) for (const a of this.map.actors.filter(a=>a.className==='s_ZoneControlPoint'||a.className==='TO_ScenarioInfo')) { const p=actorPoint(a); ctx.strokeStyle='#f0cf68';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke(); }

      ctx.fillStyle='rgba(179,204,235,.62)';ctx.font='11px system-ui';ctx.fillText(this.fallbackView==='top'?'Canvas fallback · top view':'Canvas fallback · isometric view',16,cssH-18);
    }

    _resize() {
      const wrap = this.shadowRoot.querySelector('.canvas-wrap');
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      if (!this.webglAvailable) { this._drawFallback(); return; }
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }

    _bindUI() {
      const root = this.shadowRoot;
      const input = root.querySelector('input[type=file]');
      root.querySelector('[data-action=open]').addEventListener('click', () => input.click());
      root.querySelector('[data-action=sample]').addEventListener('click', () => this.loadSample());
      root.querySelector('[data-action=fit]').addEventListener('click', () => this.fitCamera('3d'));
      root.querySelector('[data-action=top]').addEventListener('click', () => this.fitCamera('top'));
      root.querySelector('[data-action=orbit]').addEventListener('click', () => this.fitCamera('3d'));
      root.querySelector('[data-action=png]').addEventListener('click', () => this.downloadPNG());

      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        if (f) this.loadFile(f);
      });

      root.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('change', () => this._applyToggles()));

      const shell = root.querySelector('.shell');
      const hint = root.querySelector('.drop-hint');
      shell.addEventListener('dragenter', e => { e.preventDefault(); this._dragDepth++; hint.classList.add('show'); });
      shell.addEventListener('dragover', e => e.preventDefault());
      shell.addEventListener('dragleave', e => { e.preventDefault(); this._dragDepth--; if (this._dragDepth <= 0) { this._dragDepth = 0; hint.classList.remove('show'); } });
      shell.addEventListener('drop', e => {
        e.preventDefault(); this._dragDepth = 0; hint.classList.remove('show');
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this.loadFile(f);
      });
    }

    loadFile(file) {
      const reader = new FileReader();
      this._setStatus(`reading ${file.name}…`);
      reader.onload = () => this.loadT3D(String(reader.result), { name: file.name });
      reader.onerror = () => this._setStatus('file read failed', true);
      reader.readAsText(file);
    }

    loadSample() {
      if (!global.SPAWNBORN_SAMPLE) return this._setStatus('sample unavailable', true);
      try {
        const binary = atob(global.SPAWNBORN_SAMPLE.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const text = new TextDecoder('utf-8').decode(bytes);
        this.loadT3D(text, { name: global.SPAWNBORN_SAMPLE.name });
      } catch (err) {
        this._setStatus(`sample failed: ${err.message}`, true);
      }
    }

    loadT3D(text, options) {
      options = options || {};
      const started = performance.now();
      try {
        const parsed = global.SpawnbornT3D.parse(text, { sourceName: options.name || 'map.t3d' });
        this.map = parsed;
        if (this.webglAvailable) this._buildScene(parsed); else this._buildFallback(parsed);
        this._updateStats(parsed.summary);
        this.fitCamera('3d');
        this.shadowRoot.querySelector('.empty').style.display = 'none';
        const ms = Math.round(performance.now() - started);
        const warn = parsed.warnings.length ? ` · ${parsed.warnings.length} warning(s)` : '';
        const backend = this.webglAvailable ? 'Three.js WebGL' : 'Canvas fallback';
        const assetNote = this.assetStats.referenced.length
          ? ` · textures ${this.assetStats.resolved.length}/${this.assetStats.referenced.length}`
          : '';
        this._setStatus(`${parsed.summary.brushes} brushes · ${parsed.summary.polygons} polys · ${backend}${assetNote} · ${ms} ms${warn}`);
        this.dispatchEvent(new CustomEvent('spawnborn-preview-ready', { detail: { map: parsed, assets: this.assetStats, milliseconds: ms } }));
      } catch (err) {
        console.error(err);
        this._setStatus(`parse failed: ${err.message}`, true);
      }
    }

    _clearGroup(group) {
      while (group.children.length) {
        const obj = group.children.pop();
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose && m.dispose());
            else if (child.material.dispose) child.material.dispose();
          }
        });
      }
    }

    _buildScene(map) {
      [this.worldRoot, this.shellRoot, this.skyRoot, this.spawnRoot, this.pathRoot, this.lightRoot, this.zoneRoot].forEach(g => this._clearGroup(g));
      Object.values(this._textureCache || {}).forEach(t => t && t.dispose && t.dispose());
      this._materialCache = {};
      this._textureCache = {};
      const refs = Array.from(new Set(map.actors.flatMap(actor => actor.brush ? actor.brush.polygons.map(p => p.texture).filter(Boolean) : []))).sort((a,b) => a.localeCompare(b));
      const resolved = refs.filter(ref => this.assetResolver && this.assetResolver.resolveTextureEntry(ref));
      this.assetStats = { referenced: refs, resolved, unresolved: refs.filter(ref => !resolved.includes(ref)) };

      for (const actor of map.actors) {
        const cls = actor.className.toLowerCase();
        if (actor.brush && actor.brush.polygons.length) this._addBrushActor(actor);
        else if (cls === 'playerstart') this._addPlayerStart(actor);
        else if (cls === 'pathnode') this._addPointActor(actor, this.pathRoot, 0x65c7ff, 12);
        else if (cls === 'light') this._addPointActor(actor, this.lightRoot, 0xffe292, 16);
        else if (cls === 's_zonecontrolpoint') this._addZoneControl(actor);
        else if (cls === 'to_scenarioinfo' || cls === 'skyzoneinfo') this._addSpecialActor(actor);
      }
      this._applyToggles();
    }

    _roleForPolygon(poly) {
      if ((Number(poly.flags) & 128) !== 0) return 'sky';
      const t = String(poly.texture || '').toLowerCase();
      if (t.includes('sky')) return 'sky';
      if (t.includes('ice') || t.includes('water')) return 'ice';
      if (t.includes('path')) return 'path';
      if (t.includes('roof')) return 'roof';
      if (t.includes('snow')) return 'snow';
      if (t.includes('stone') || t.includes('rock') || t.includes('brick') || t.includes('wall')) return 'stone';
      if (t.includes('wood')) return 'wood';
      if (t.includes('metal')) return 'metal';
      return 'other';
    }

    _materialForRole(role) {
      const colors = {
        snow: 0xdfefff,
        ice: 0xa9c9e8,
        stone: 0x8290a3,
        path: 0x8da77d,
        roof: 0xb7c5d7,
        wood: 0x8d6e59,
        metal: 0x7d8d9e,
        other: 0x7993ad,
        sky: 0x72c7ee,
      };
      const key = `semantic:${role}`;
      if (!this._materialCache[key]) {
        const sky = role === 'sky';
        this._materialCache[key] = new THREE.MeshLambertMaterial({
          color: colors[role] || colors.other,
          side: THREE.DoubleSide,
          flatShading: true,
          transparent: sky,
          opacity: sky ? 0.12 : 0.92,
          depthWrite: !sky,
        });
        this._materialCache[key].userData = { source: 'semantic-fallback', role };
      }
      return this._materialCache[key];
    }

    _assetForPolygon(poly) {
      if (!this.assetResolver || !poly || !poly.texture) return null;
      return this.assetResolver.resolveTextureEntry(poly.texture);
    }

    _materialKeyForPolygon(poly) {
      const asset = this._assetForPolygon(poly);
      return asset ? `asset:${asset.source.toLowerCase()}` : `semantic:${this._roleForPolygon(poly)}`;
    }

    _materialForPolygon(poly) {
      const asset = this._assetForPolygon(poly);
      if (!asset) return this._materialForRole(this._roleForPolygon(poly));
      const key = `asset:${asset.source.toLowerCase()}`;
      if (!this._materialCache[key]) {
        let texture = this._textureCache[key];
        if (!texture) {
          texture = new THREE.TextureLoader().load(
            asset.browserPath,
            () => { if (this.renderer) this.renderer.render(this.scene, this.camera); },
            undefined,
            err => console.warn(`Spawnborn Asset Cache: failed to load ${asset.source}`, err)
          );
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.encoding = THREE.sRGBEncoding;
          texture.anisotropy = this.renderer && this.renderer.capabilities && this.renderer.capabilities.getMaxAnisotropy
            ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
            : 1;
          this._textureCache[key] = texture;
        }
        const role = this._roleForPolygon(poly);
        const sky = role === 'sky';
        const masked = Boolean(asset.masked);
        // Use an unlit material for cached game textures so the proof shows the source pixels directly.
        // MyLevel graffiti uses UE1-style masking; web-cache PNGs preserve palette index 0 as alpha.
        this._materialCache[key] = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          map: texture,
          side: THREE.DoubleSide,
          transparent: sky || masked,
          alphaTest: masked ? 0.5 : 0,
          opacity: sky ? 0.72 : 1.0,
          depthWrite: !sky,
        });
        this._materialCache[key].userData = {
          source: 'asset-cache',
          unrealReference: asset.source,
          browserPath: asset.browserPath,
          match: asset.match
        };
      }
      return this._materialCache[key];
    }

    _polygonTriangles(poly, vertexOffset) {
      const n = poly.vertices.length;
      const faces = [];
      if (n < 3) return faces;
      if (n === 3) return [vertexOffset, vertexOffset + 1, vertexOffset + 2];
      if (n === 4) return [vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 3, vertexOffset + 2];
      for (let i = 1; i < n - 1; i++) faces.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
      return faces;
    }

    _polygonUV(poly, vertex, asset) {
      if (!poly.origin || !poly.textureU || !poly.textureV || !asset) return [0, 0];
      const dx = vertex.x - poly.origin.x;
      const dy = vertex.y - poly.origin.y;
      const dz = vertex.z - poly.origin.z;
      const uPixels = dx * poly.textureU.x + dy * poly.textureU.y + dz * poly.textureU.z;
      const vPixels = dx * poly.textureV.x + dy * poly.textureV.y + dz * poly.textureV.z;
      return [uPixels / Math.max(1, asset.width), -vPixels / Math.max(1, asset.height)];
    }

    _makeBrushGeometry(polygons, predicate) {
      const positions = [];
      const uvs = [];
      const indices = [];
      const groups = [];
      const materialEntries = [];
      let vertexOffset = 0;
      let indexOffset = 0;

      for (const poly of polygons) {
        if (predicate && !predicate(poly)) continue;
        const materialKey = this._materialKeyForPolygon(poly);
        let matIndex = materialEntries.findIndex(entry => entry.key === materialKey);
        if (matIndex < 0) {
          matIndex = materialEntries.length;
          materialEntries.push({ key: materialKey, poly });
        }
        const asset = this._assetForPolygon(poly);
        for (const v of poly.vertices) {
          positions.push(v.x, v.z, v.y);
          const uv = this._polygonUV(poly, v, asset);
          uvs.push(uv[0], uv[1]);
        }
        const tris = this._polygonTriangles(poly, vertexOffset);
        indices.push.apply(indices, tris);
        groups.push({ start: indexOffset, count: tris.length, materialIndex: matIndex, poly });
        vertexOffset += poly.vertices.length;
        indexOffset += tris.length;
      }

      if (!positions.length) return null;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setIndex(indices);
      groups.forEach(g => geom.addGroup(g.start, g.count, g.materialIndex));
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      return { geometry: geom, materialEntries, groups };
    }

    _applyBrushTransform(mesh, actor) {
      const p = actor.properties;
      if (p.PrePivot) mesh.geometry.translate(-p.PrePivot.x, -p.PrePivot.z, -p.PrePivot.y);
      if (p.MainScale) mesh.geometry.scale(p.MainScale.x || 1, p.MainScale.z || 1, p.MainScale.y || 1);
      if (p.Rotation) {
        mesh.rotation.order = 'YZX';
        mesh.rotation.x = (p.Rotation.roll || 0) * DEG_PER_UT;
        mesh.rotation.y = -(p.Rotation.yaw || 0) * DEG_PER_UT;
        mesh.rotation.z = (p.Rotation.pitch || 0) * DEG_PER_UT;
      }
      if (p.Location) mesh.position.set(p.Location.x || 0, p.Location.z || 0, p.Location.y || 0);
      if (p.PostScale) mesh.scale.set(p.PostScale.x || 1, p.PostScale.z || 1, p.PostScale.y || 1);
    }

    _addBrushActor(actor) {
      const op = Number(actor.properties.CsgOper);
      const groupName = String(actor.properties.Group || '');
      const isSkyStage = /sky/i.test(groupName) && op === 2;
      const isWorld = /world/i.test(groupName) && op === 2;

      if (op === 1) {
        const built = this._makeBrushGeometry(actor.brush.polygons, p => (Number(p.flags) & 128) === 0);
        if (built) {
          const mats = built.materialEntries.map(entry => this._materialForPolygon(entry.poly));
          const mesh = new THREE.Mesh(built.geometry, mats);
          mesh.userData = { kind: 'brush', actor, label: `${actor.name} · ${groupName || 'Brush'} · CSG_Add` };
          this._applyBrushTransform(mesh, actor);
          this.worldRoot.add(mesh);

          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(built.geometry, 20), new THREE.LineBasicMaterial({ color: 0xc4d8f2, transparent: true, opacity: 0.27 }));
          edges.userData.previewWire = true;
          mesh.add(edges);
        }
      }

      if (op === 2) {
        // The subtractive world contains the actual outdoor ground surface. Preview just its non-sky floor as semantic geometry.
        if (isWorld) {
          const floor = this._makeBrushGeometry(actor.brush.polygons, p => (Number(p.flags) & 128) === 0 && p.normal && p.normal.z < -0.5);
          if (floor) {
            const mesh = new THREE.Mesh(floor.geometry, floor.materialEntries.map(entry => this._materialForPolygon(entry.poly)));
            mesh.userData = { kind: 'brush', actor, label: `${actor.name} · outdoor floor · CSG_Subtract` };
            this._applyBrushTransform(mesh, actor);
            this.worldRoot.add(mesh);
          }
        }

        const shell = this._makeBrushGeometry(actor.brush.polygons, p => (Number(p.flags) & 128) === 0);
        if (shell) {
          const mat = new THREE.MeshBasicMaterial({ color: isSkyStage ? 0x83dcff : 0xf1bc70, wireframe: true, transparent: true, opacity: 0.20, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(shell.geometry, mat);
          mesh.userData = { kind: 'brush', actor, label: `${actor.name} · ${groupName || 'Brush'} · CSG_Subtract` };
          this._applyBrushTransform(mesh, actor);
          if (isSkyStage) this.skyRoot.add(mesh); else this.shellRoot.add(mesh);
        }
      }

      // FakeBackdrop polygons are useful diagnostics, but kept in a separate layer so they do not cage the overview.
      const skyPolys = this._makeBrushGeometry(actor.brush.polygons, p => (Number(p.flags) & 128) !== 0);
      if (skyPolys) {
        const mesh = new THREE.Mesh(skyPolys.geometry, skyPolys.materialEntries.map(entry => this._materialForPolygon(entry.poly)));
        mesh.userData = { kind: 'sky', actor, label: `${actor.name} · PF_FakeBackdrop` };
        this._applyBrushTransform(mesh, actor);
        this.skyRoot.add(mesh);
      }
    }

    _location(actor) {
      const loc = actor.properties.Location || { x: 0, y: 0, z: 0 };
      return new THREE.Vector3(loc.x || 0, loc.z || 0, loc.y || 0);
    }

    _addPlayerStart(actor) {
      const team = Number(actor.properties.TeamNumber);
      const color = team === 0 ? 0xf05b63 : team === 1 ? 0x5a9dff : 0xffffff;
      const geom = new THREE.ConeGeometry(30, 92, 8);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(this._location(actor));
      mesh.position.y += 46;
      mesh.userData = { kind: 'actor', actor, label: `${actor.name} · PlayerStart · Team ${team}` };
      this.spawnRoot.add(mesh);
    }

    _addPointActor(actor, root, color, size) {
      const geom = new THREE.SphereGeometry(size, 9, 7);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(this._location(actor));
      mesh.userData = { kind: 'actor', actor, label: `${actor.name} · ${actor.className}${actor.properties.Group ? ' · ' + actor.properties.Group : ''}` };
      root.add(mesh);
    }

    _addZoneControl(actor) {
      const radius = Math.min(Number(actor.properties.CollisionRadius) || 128, 256);
      const geom = new THREE.TorusGeometry(radius, 7, 6, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf0cf68, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.copy(this._location(actor));
      mesh.userData = { kind: 'actor', actor, label: `${actor.name} · ZoneControlPoint · Team ${actor.properties.OwnedTeam}` };
      this.zoneRoot.add(mesh);
    }

    _addSpecialActor(actor) {
      const isSky = actor.className.toLowerCase() === 'skyzoneinfo';
      const geom = new THREE.OctahedronGeometry(isSky ? 34 : 42);
      const mat = new THREE.MeshBasicMaterial({ color: isSky ? 0x79ddff : 0xd79aff, wireframe: true, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(this._location(actor));
      mesh.userData = { kind: 'actor', actor, label: `${actor.name} · ${actor.className}` };
      (isSky ? this.skyRoot : this.zoneRoot).add(mesh);
    }

    _applyToggles() {
      if (!this.webglAvailable) { this._drawFallback(); return; }
      const q = key => this.shadowRoot.querySelector(`[data-toggle=${key}]`).checked;
      this.worldRoot.traverse(obj => {
        if (obj.material && obj.userData && obj.userData.previewWire) obj.visible = q('wire');
        if (obj.isMesh && obj.userData && obj.userData.kind === 'brush') obj.visible = q('solid');
      });
      // World-root meshes contain wireframe children. Ensure edges can remain visible when solid is off.
      this.worldRoot.children.forEach(mesh => {
        if (mesh.isMesh) {
          mesh.visible = q('solid') || q('wire');
          mesh.material.visible = q('solid');
          mesh.children.forEach(c => { if (c.userData.previewWire) c.visible = q('wire'); });
        }
      });
      this.spawnRoot.visible = q('spawns');
      this.pathRoot.visible = q('paths');
      this.lightRoot.visible = q('lights');
      this.zoneRoot.visible = q('zones');
      this.shellRoot.visible = q('shells');
      this.skyRoot.visible = q('sky');
    }

    _updateStats(s) {
      this.shadowRoot.querySelector('.title').textContent = s.title || this.map.sourceName;
      const set = (k, v) => this.shadowRoot.querySelector(`[data-stat=${k}]`).textContent = v;
      set('brushes', s.brushes);
      set('polygons', s.polygons.toLocaleString());
      set('spawns', s.playerStarts.total);
      set('paths', s.pathNodes);
      set('lights', s.lights);
      set('sky', `${s.fakeBackdrop}/${s.skyZones}`);
    }

    fitCamera(mode) {
      if (!this.map) return;
      if (!this.webglAvailable) {
        this.fallbackView = mode === 'top' ? 'top' : 'iso';
        this._drawFallback();
        this.shadowRoot.querySelector('[data-action=top]').classList.toggle('active', mode === 'top');
        this.shadowRoot.querySelector('[data-action=orbit]').classList.toggle('active', mode !== 'top');
        return;
      }
      const box = new THREE.Box3().setFromObject(this.worldRoot);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1000);
      this.controls.target.copy(center);
      this.camera.up.set(0, 1, 0);

      if (mode === 'top') {
        this.camera.position.set(center.x, center.y + maxDim * 1.35, center.z + 1);
        this.camera.up.set(0, 0, -1);
      } else {
        this.camera.position.set(center.x + maxDim * 0.78, center.y + maxDim * 0.52, center.z + maxDim * 0.88);
      }
      this.camera.near = Math.max(1, maxDim / 5000);
      this.camera.far = maxDim * 20;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.shadowRoot.querySelector('[data-action=top]').classList.toggle('active', mode === 'top');
      this.shadowRoot.querySelector('[data-action=orbit]').classList.toggle('active', mode !== 'top');
    }

    _onPointerMove(e) {
      if (!this.map || !this.webglAvailable) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const roots = [this.worldRoot, this.spawnRoot, this.pathRoot, this.lightRoot, this.zoneRoot, this.shellRoot, this.skyRoot];
      const hits = this.raycaster.intersectObjects(roots, true).filter(h => {
        let o = h.object;
        while (o && o !== this.scene) {
          if (o.userData && o.userData.label) return true;
          o = o.parent;
        }
        return false;
      });
      if (!hits.length) return this._hideTooltip();
      let o = hits[0].object;
      while (o && !(o.userData && o.userData.label)) o = o.parent;
      if (!o) return this._hideTooltip();
      const actor = o.userData.actor;
      const tt = this.shadowRoot.querySelector('.tooltip');
      const group = actor && actor.properties && actor.properties.Group;
      tt.innerHTML = `<b>${escapeHtml(o.userData.label)}</b>${group ? `Group: ${escapeHtml(group)}` : ''}`;
      tt.style.left = `${Math.min(rect.width - 270, e.clientX - rect.left + 14)}px`;
      tt.style.top = `${Math.min(rect.height - 70, e.clientY - rect.top + 14)}px`;
      tt.style.display = 'block';
    }

    _hideTooltip() { this.shadowRoot.querySelector('.tooltip').style.display = 'none'; }

    _setStatus(text, bad) {
      const el = this.shadowRoot.querySelector('.status');
      el.textContent = text;
      el.classList.toggle('good', !bad);
      el.classList.toggle('warn', !!bad);
    }

    exportPNG() {
      if (!this.webglAvailable) { this._drawFallback(); return this.fallbackCanvas.toDataURL('image/png'); }
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL('image/png');
    }

    downloadPNG() {
      if (!this.map) return;
      const a = document.createElement('a');
      const base = String(this.map.sourceName || 'spawnborn-map').replace(/\.t3d$/i, '').replace(/[^a-z0-9_-]+/gi, '-');
      a.download = `${base}-preview.png`;
      a.href = this.exportPNG();
      a.click();
    }

    _animate() {
      if (!this.webglAvailable) return;
      this._raf = requestAnimationFrame(() => this._animate());
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }

  if (!customElements.get('spawnborn-map-preview')) customElements.define('spawnborn-map-preview', SpawnbornMapPreview);
  global.SpawnbornMapPreview = SpawnbornMapPreview;
})(window);
