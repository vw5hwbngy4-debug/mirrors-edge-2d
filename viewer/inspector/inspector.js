(function () {
  'use strict';
  const THREE = window.THREE;
  if (!THREE) return;

  class SpawnMapInspector {
    constructor(preview) {
      this.preview = preview;
      this.mode = 'overview';
      this.keys = Object.create(null);
      this.touchMove = { x: 0, y: 0 };
      this.yaw = 0;
      this.pitch = 0;
      this.eyeHeight = 64;
      this.radius = 30;
      this.moveSpeed = 430;
      this.sprintSpeed = 720;
      this.gravity = -900;
      this.jumpSpeed = 360;
      this.verticalVelocity = 0;
      this.grounded = false;
      this.collision = true;
      this._last = performance.now();
      this._touchLookId = null;
      this._touchLookLast = null;
      this._spawnTeam = 0;
      this.embeddedMobile = new URLSearchParams(location.search).get('ui') === 'mobile';
      this._buildUI();
      this._bind();
      this._loop();
    }

    _buildUI() {
      const ui = document.createElement('div');
      ui.className = 'spawnmap-inspector-ui' + (this.embeddedMobile ? ' smi-embedded-mobile' : '');
      ui.innerHTML = `
        <div class="smi-top">
          <div class="smi-chip"><i class="smi-dot"></i><div><strong>SPAWNMAP INSPECTOR v0.3</strong><span> · DESIGN PREVIEW</span></div></div>
          <div class="smi-buttons">
            <button class="smi-button" data-smi="overview">OVERVIEW</button>
            <button class="smi-button primary" data-smi="inspector">SPECTATOR</button>
            <button class="smi-button" data-smi="team0">TEAM 0</button>
            <button class="smi-button" data-smi="team1">TEAM 1</button>
            <button class="smi-button active" data-smi="collision">COLLISION ON</button>
          </div>
        </div>
        <button class="smi-enter">ENTER SPECTATOR<span>WASD / TOUCH · WALK THE GENERATED MAP</span></button>
        <div class="smi-look-surface" aria-hidden="true"></div>
        <div class="smi-crosshair"></div>
        <div class="smi-readout"><b>SPECTATOR POSITION</b><span data-smi-readout>overview</span></div>
        <button class="smi-change" type="button">✎ CHANGE THIS AREA</button>
        <div class="smi-prompt">
          <button class="smi-prompt-close" type="button" aria-label="Close prompt">×</button>
          <label>ITERATION NOTE</label>
          <input data-smi-note maxlength="320" placeholder="e.g. make this alley narrower">
          <button data-smi-copy>COPY GPT ITERATION PROMPT</button>
        </div>
        <div class="smi-help"><b>DESKTOP</b> WASD · mouse look · Shift sprint · Space jump · Esc releases mouse<div class="smi-runtime-note">Spectator validates design intent. UE1 skybox, BSP, pathing and gameplay remain runtime checks.</div></div>
        <div class="smi-mobile">
          <div class="smi-joystick"><div class="smi-stick"></div></div>
          <button class="smi-jump">JUMP</button>
          <div class="smi-look-hint">SWIPE WORLD TO LOOK</div>
        </div>`;
      document.body.appendChild(ui);
      this.ui = ui;
      this.readout = ui.querySelector('[data-smi-readout]');
      this.note = ui.querySelector('[data-smi-note]');
      this.copyButton = ui.querySelector('[data-smi-copy]');
      this.joystick = ui.querySelector('.smi-joystick');
      this.stick = ui.querySelector('.smi-stick');
      this.changeButton = ui.querySelector('.smi-change');
      this.lookSurface = ui.querySelector('.smi-look-surface');
      this.promptClose = ui.querySelector('.smi-prompt-close');
    }

    _bind() {
      const p = this.preview;
      const canvas = () => p.renderer && p.renderer.domElement;
      this.ui.querySelector('[data-smi=overview]').addEventListener('click', () => this.enterOverview());
      this.ui.querySelector('[data-smi=inspector]').addEventListener('click', () => this.enterInspector(this._spawnTeam));
      this.ui.querySelector('[data-smi=team0]').addEventListener('click', () => { this._spawnTeam = 0; this.enterInspector(0); });
      this.ui.querySelector('[data-smi=team1]').addEventListener('click', () => { this._spawnTeam = 1; this.enterInspector(1); });
      this.ui.querySelector('[data-smi=collision]').addEventListener('click', e => {
        this.collision = !this.collision;
        e.currentTarget.classList.toggle('active', this.collision);
        e.currentTarget.textContent = this.collision ? 'COLLISION ON' : 'NOCLIP';
      });
      this.ui.querySelector('.smi-enter').addEventListener('click', () => this.enterInspector(this._spawnTeam, true));
      this.copyButton.addEventListener('click', () => this.copyIterationPrompt());
      this.changeButton.addEventListener('click', () => { this.ui.classList.add('smi-prompt-open'); this.note.focus(); });
      this.promptClose.addEventListener('click', () => { this.ui.classList.remove('smi-prompt-open'); this.note.blur(); });
      this.note.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.copyIterationPrompt(); } });

      window.addEventListener('keydown', e => {
        if (['INPUT','TEXTAREA'].includes(document.activeElement && document.activeElement.tagName)) return;
        this.keys[e.code] = true;
        if (this.mode === 'inspector' && ['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
        if (this.mode === 'inspector' && e.code === 'Space') this.jump();
      }, { passive:false });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = Object.create(null); this.touchMove.x = this.touchMove.y = 0; });

      window.addEventListener('mousemove', e => {
        const c = canvas();
        if (this.mode !== 'inspector' || !c || document.pointerLockElement !== c) return;
        this.yaw -= e.movementX * 0.0022;
        this.pitch -= e.movementY * 0.0022;
        this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));
      });
      document.addEventListener('pointerlockchange', () => {
        if (this.mode === 'inspector') this._updateReadout();
      });

      const bindCanvas = () => {
        const c = canvas();
        if (!c || c.__smiBound) return;
        c.__smiBound = true;
        c.style.touchAction = 'none';
        c.addEventListener('click', () => {
          if (this.mode === 'inspector' && matchMedia('(pointer:fine)').matches && c.requestPointerLock) c.requestPointerLock();
        });
      };
      if (p.renderer) bindCanvas(); else setTimeout(bindCanvas, 200);

      // iOS/Safari-safe world look surface. This sits over the WebGL canvas only in Spectator mode.
      // A one-finger drag rotates the camera; controls above it keep their own pointer handling.
      let lookId = null;
      let lookLast = null;
      const lookStart = e => {
        if (this.mode !== 'inspector') return;
        lookId = e.pointerId;
        lookLast = { x:e.clientX, y:e.clientY };
        this.lookSurface.setPointerCapture && this.lookSurface.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      const lookMove = e => {
        if (this.mode !== 'inspector' || e.pointerId !== lookId || !lookLast) return;
        const dx = e.clientX - lookLast.x;
        const dy = e.clientY - lookLast.y;
        lookLast = { x:e.clientX, y:e.clientY };
        this.yaw -= dx * 0.0044;
        this.pitch -= dy * 0.0040;
        this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch));
        this._applyLook();
        this.ui.classList.add('smi-look-used');
        e.preventDefault();
      };
      const lookEnd = e => {
        if (e.pointerId !== lookId) return;
        lookId = null; lookLast = null;
        e.preventDefault();
      };
      this.lookSurface.addEventListener('pointerdown', lookStart, {passive:false});
      this.lookSurface.addEventListener('pointermove', lookMove, {passive:false});
      this.lookSurface.addEventListener('pointerup', lookEnd, {passive:false});
      this.lookSurface.addEventListener('pointercancel', lookEnd, {passive:false});

      // Touch fallback for older iOS WebKit paths where Pointer Events can be swallowed by WebGL/iframes.
      let touchLast = null;
      if (!window.PointerEvent) {
        this.lookSurface.addEventListener('touchstart', e => {
          if (this.mode !== 'inspector' || !e.touches.length) return;
          const t=e.touches[0]; touchLast={x:t.clientX,y:t.clientY}; e.preventDefault();
        }, {passive:false});
        this.lookSurface.addEventListener('touchmove', e => {
          if (this.mode !== 'inspector' || !touchLast || !e.touches.length) return;
          const t=e.touches[0];
          const dx=t.clientX-touchLast.x, dy=t.clientY-touchLast.y;
          touchLast={x:t.clientX,y:t.clientY};
          this.yaw -= dx * 0.0044;
          this.pitch -= dy * 0.0040;
          this.pitch = Math.max(-1.42, Math.min(1.42, this.pitch));
          this._applyLook();
          this.ui.classList.add('smi-look-used');
          e.preventDefault();
        }, {passive:false});
        const touchEnd=()=>{touchLast=null;};
        this.lookSurface.addEventListener('touchend', touchEnd, {passive:false});
        this.lookSurface.addEventListener('touchcancel', touchEnd, {passive:false});
      }

      let joyId = null;
      const joyUpdate = e => {
        const r = this.joystick.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        let dx = e.clientX-cx, dy = e.clientY-cy;
        const max = r.width*.32, len = Math.hypot(dx,dy) || 1;
        if (len > max) { dx = dx/len*max; dy = dy/len*max; }
        this.touchMove.x = dx/max; this.touchMove.y = dy/max;
        this.stick.style.transform = `translate(${dx}px,${dy}px)`;
      };
      this.joystick.addEventListener('pointerdown', e => { joyId=e.pointerId; this.joystick.setPointerCapture(e.pointerId); joyUpdate(e); e.stopPropagation(); });
      this.joystick.addEventListener('pointermove', e => { if(e.pointerId===joyId) joyUpdate(e); });
      const joyEnd = e => { if(e.pointerId!==joyId)return; joyId=null; this.touchMove.x=this.touchMove.y=0; this.stick.style.transform='translate(0,0)'; };
      this.joystick.addEventListener('pointerup', joyEnd); this.joystick.addEventListener('pointercancel', joyEnd);
      this.ui.querySelector('.smi-jump').addEventListener('pointerdown', e => { e.preventDefault(); this.jump(); });

      p.addEventListener('spawnborn-preview-ready', () => {
        bindCanvas();
        const qs = new URLSearchParams(location.search);
        if (qs.get('mode') === 'inspector') setTimeout(() => this.enterInspector(Number(qs.get('team')) === 1 ? 1 : 0), 100);
        else setTimeout(() => { this.enterOverview(); this._fitGameplayOverview(); }, 80);
      });
    }

    _setInnerUI(inspecting) {
      const sr = this.preview.shadowRoot;
      if (!sr) return;
      const panel = sr.querySelector('.panel');
      const toolbar = sr.querySelector('.toolbar');
      const status = sr.querySelector('.status');
      const tooltip = sr.querySelector('.tooltip');
      const cleanMobile = this.embeddedMobile;
      if (panel) panel.style.display = (inspecting || cleanMobile) ? 'none' : '';
      if (toolbar) toolbar.style.display = (inspecting || cleanMobile) ? 'none' : '';
      if (status) status.style.display = (inspecting || cleanMobile) ? 'none' : '';
      if (tooltip) { tooltip.style.visibility = (inspecting || cleanMobile) ? 'hidden' : ''; tooltip.style.display = 'none'; }
      const wire = sr.querySelector('[data-toggle=wire]'); if (wire && inspecting) wire.checked = false;
      const spawns = sr.querySelector('[data-toggle=spawns]'); if (spawns && inspecting) spawns.checked = false;
      const paths = sr.querySelector('[data-toggle=paths]'); if (paths && inspecting) paths.checked = false;
      const lights = sr.querySelector('[data-toggle=lights]'); if (lights && inspecting) lights.checked = false;
      this.preview._applyToggles && this.preview._applyToggles();
    }

    _spawns(team) {
      const actors = (this.preview.map && this.preview.map.actors) || [];
      return actors.filter(a => a.className && a.className.toLowerCase() === 'playerstart' && Number(a.properties.TeamNumber) === Number(team));
    }

    _fitGameplayOverview() {
      if (!this.preview.map || !this.preview.camera || !this.preview.controls) return;
      const actors=(this.preview.map.actors||[]).filter(a=>{
        const c=(a.className||'').toLowerCase();
        return c==='playerstart' || c==='pathnode' || c.includes('objective');
      });
      const box=new THREE.Box3();
      let count=0;
      actors.forEach(a=>{ try{ box.expandByPoint(this.preview._location(a)); count++; }catch(e){} });
      if(count<3 || box.isEmpty()) box.setFromObject(this.preview.worldRoot);
      if(box.isEmpty()) return;

      // Frame the playable footprint, not distant sky/backdrop geometry.
      const center=box.getCenter(new THREE.Vector3());
      const size=box.getSize(new THREE.Vector3());
      const radius=Math.max(520, Math.hypot(size.x*.5,size.z*.5,size.y*.35));
      const aspect=Math.max(.35,this.preview.camera.aspect||1);
      const vfov=THREE.MathUtils.degToRad(this.preview.camera.fov||55);
      const hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
      const fitFov=Math.min(vfov,hfov);
      const distance=(radius/Math.tan(fitFov/2))*0.90;
      const dir=new THREE.Vector3(.76,.66,.86).normalize();
      this.preview.controls.target.copy(center);
      this.preview.camera.up.set(0,1,0);
      this.preview.camera.position.copy(center).addScaledVector(dir,distance);
      this.preview.camera.near=Math.max(1,distance/5000);
      this.preview.camera.far=Math.max(distance*18,30000);
      this.preview.camera.updateProjectionMatrix();
      this.preview.controls.update();
    }

    enterInspector(team, requestLock) {
      if (!this.preview.map || !this.preview.webglAvailable) return;
      this.mode = 'inspector';
      this.ui.classList.add('smi-inspector');
      this.ui.querySelector('[data-smi=overview]').classList.remove('active');
      this.ui.querySelector('[data-smi=inspector]').classList.add('active');
      this._setInnerUI(true);
      if (this.preview.controls) this.preview.controls.enabled = false;
      const spawns = this._spawns(team);
      const actor = spawns[0] || this._spawns(team === 0 ? 1 : 0)[0] || (this.preview.map.actors || []).find(a => a.className && a.className.toLowerCase() === 'playerstart');
      if (actor) {
        const pos = this.preview._location(actor);
        this.preview.camera.position.copy(pos);
        const ground = this._groundY(pos.x, pos.z, pos.y + 120, 320);
        if (ground !== null) this.preview.camera.position.y = ground + this.eyeHeight;
        else this.preview.camera.position.y += 34;
        const rot = actor.properties.Rotation || {};
        this.yaw = -(Number(rot.yaw)||0) * (Math.PI*2/65536);
        this.pitch = 0;
      }
      this.verticalVelocity = 0;
      this._applyLook();
      this._updateReadout();
      const c = this.preview.renderer && this.preview.renderer.domElement;
      if (requestLock && c && c.requestPointerLock && matchMedia('(pointer:fine)').matches) c.requestPointerLock();
    }

    enterOverview() {
      this.mode = 'overview';
      this.ui.classList.remove('smi-inspector');
      this.ui.querySelector('[data-smi=overview]').classList.add('active');
      this.ui.querySelector('[data-smi=inspector]').classList.remove('active');
      this._setInnerUI(false);
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      if (this.preview.controls) this.preview.controls.enabled = true;
      if (this.embeddedMobile) this._fitGameplayOverview();
      else this.preview.fitCamera && this.preview.fitCamera('3d');
      this._updateReadout();
    }

    _collidables() {
      const list=[];
      if (!this.preview.worldRoot) return list;
      this.preview.worldRoot.traverse(o => { if(o.isMesh && o.userData && o.userData.kind === 'brush') list.push(o); });
      return list;
    }

    _groundY(x,z,startY,far) {
      const objs=this._collidables(); if(!objs.length) return null;
      this.preview.scene.updateMatrixWorld(true);
      const ray=new THREE.Raycaster(new THREE.Vector3(x,startY,z),new THREE.Vector3(0,-1,0),0,far||260);
      const hits=ray.intersectObjects(objs,false);
      return hits.length ? hits[0].point.y : null;
    }

    _blocked(from, dir, distance) {
      if (!this.collision || distance <= 0.001) return false;
      const objs=this._collidables(); if(!objs.length) return false;
      this.preview.scene.updateMatrixWorld(true);
      const d=dir.clone().normalize();
      const heights=[0,-this.eyeHeight*.45,-this.eyeHeight*.78];
      for(const off of heights){
        const origin=from.clone(); origin.y += off;
        const ray=new THREE.Raycaster(origin,d,0,distance+this.radius);
        const hit=ray.intersectObjects(objs,false)[0];
        if(hit && hit.distance < distance+this.radius) return true;
      }
      return false;
    }

    jump(){ if(this.mode==='inspector' && (this.grounded || !this.collision)){ this.verticalVelocity=this.jumpSpeed; this.grounded=false; } }

    _update(dt) {
      if (this.mode !== 'inspector' || !this.preview.camera) return;
      const cam=this.preview.camera;
      const forward=new THREE.Vector3();
      cam.getWorldDirection(forward);
      forward.y=0;
      if(forward.lengthSq()<1e-6) forward.set(0,0,-1); else forward.normalize();
      const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
      let f=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0) - this.touchMove.y;
      let r=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0) + this.touchMove.x;
      const move=new THREE.Vector3(); move.addScaledVector(forward,f); move.addScaledVector(right,r);
      if(move.lengthSq()>1) move.normalize();
      const speed=(this.keys.ShiftLeft||this.keys.ShiftRight)?this.sprintSpeed:this.moveSpeed;
      move.multiplyScalar(speed*dt);
      if(move.lengthSq()>0){
        const xMove=new THREE.Vector3(move.x,0,0);
        if(!this._blocked(cam.position,xMove,xMove.length())) cam.position.x += xMove.x;
        const zMove=new THREE.Vector3(0,0,move.z);
        if(!this._blocked(cam.position,zMove,zMove.length())) cam.position.z += zMove.z;
      }

      if(this.collision){
        this.verticalVelocity += this.gravity*dt;
        cam.position.y += this.verticalVelocity*dt;
        const ground=this._groundY(cam.position.x,cam.position.z,cam.position.y+this.eyeHeight*.25,this.eyeHeight*1.8);
        if(ground!==null && cam.position.y <= ground+this.eyeHeight+8 && this.verticalVelocity<=0){
          cam.position.y=ground+this.eyeHeight; this.verticalVelocity=0; this.grounded=true;
        } else this.grounded=false;
      } else {
        const fly=((this.keys.Space?1:0)-(this.keys.ControlLeft?1:0))*speed*dt;
        cam.position.y += fly;
      }
      this._applyLook();
      this._updateReadout();
    }

    _applyLook(){
      const cam=this.preview.camera; if(!cam)return;
      cam.rotation.order='YXZ'; cam.rotation.y=this.yaw; cam.rotation.x=this.pitch; cam.rotation.z=0;
    }

    _uePosition(){ const p=this.preview.camera.position; return {x:p.x,y:p.z,z:p.y}; }
    _updateReadout(){
      if(!this.readout)return;
      if(this.mode!=='inspector'){this.readout.textContent='Overview · switch to SPECTATOR to walk at player height';return;}
      const p=this._uePosition(); const lock=document.pointerLockElement===this.preview.renderer.domElement;
      this.readout.textContent=`X ${Math.round(p.x)} · Y ${Math.round(p.y)} · Z ${Math.round(p.z)} · ${this.collision?'COLLISION':'NOCLIP'}${matchMedia('(pointer:fine)').matches?(lock?' · MOUSE LOCKED':' · CLICK WORLD TO LOOK'):''}`;
    }

    async copyIterationPrompt(){
      const change=this.note.value.trim(); if(!change)return;
      const p=this._uePosition();
      let deg=(((-this.yaw)*180/Math.PI)%360+360)%360;
      const title=(this.preview.map && this.preview.map.summary && this.preview.map.summary.title) || (this.preview.map && this.preview.map.sourceName) || 'current map';
      const text=`SpawnMap Inspector feedback for ${title}. At approximately Unreal location X=${Math.round(p.x)}, Y=${Math.round(p.y)}, Z=${Math.round(p.z)}, facing yaw ${Math.round(deg)}°. Change this area as follows: ${change}. Preserve the rest of the approved layout unless the change requires a local connection. Regenerate the map proposal and return an updated SpawnMap Inspector preview before compiling the .unr.`;
      try{await navigator.clipboard.writeText(text);this.copyButton.textContent='COPIED';this.ui.classList.remove('smi-prompt-open');setTimeout(()=>this.copyButton.textContent='COPY GPT ITERATION PROMPT',1400);}catch(e){
        this.note.value=text; this.note.select(); this.copyButton.textContent='SELECTED';
      }
    }

    _loop(){
      requestAnimationFrame(()=>this._loop());
      const now=performance.now(); const dt=Math.min(.05,(now-this._last)/1000); this._last=now;
      this._update(dt);
    }
  }

  const preview=document.querySelector('spawnborn-map-preview');
  if(preview) window.spawnMapInspector=new SpawnMapInspector(preview);
})();
