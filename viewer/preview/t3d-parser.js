(function (global) {
  'use strict';

  function unquote(value) {
    if (typeof value !== 'string') return value;
    const s = value.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function parseHeaderFields(line) {
    const out = {};
    const re = /(\w+)=((?:"[^"]*")|(?:'[^']*')|(?:[^\s]+))/g;
    let m;
    while ((m = re.exec(line)) !== null) out[m[1]] = unquote(m[2]);
    return out;
  }

  function parseXYZ(text) {
    const out = { x: 0, y: 0, z: 0 };
    const rx = /X\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/i.exec(text);
    const ry = /Y\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/i.exec(text);
    const rz = /Z\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/i.exec(text);
    if (rx) out.x = Number(rx[1]);
    if (ry) out.y = Number(ry[1]);
    if (rz) out.z = Number(rz[1]);
    return out;
  }

  function parseRotator(text) {
    const out = { pitch: 0, yaw: 0, roll: 0 };
    for (const key of ['Pitch', 'Yaw', 'Roll']) {
      const m = new RegExp(key + '\\s*=\\s*([-+]?\\d*\\.?\\d+)', 'i').exec(text);
      if (m) out[key.toLowerCase()] = Number(m[1]);
    }
    return out;
  }

  function parseScale(text) {
    const scaleMatch = /Scale\s*=\s*\(([^)]*)\)/i.exec(text);
    const scale = scaleMatch ? parseXYZ(scaleMatch[1]) : parseXYZ(text);
    const sheerRate = /SheerRate\s*=\s*([-+]?\d*\.?\d+)/i.exec(text);
    const sheerAxis = /SheerAxis\s*=\s*([-+]?\d+)/i.exec(text);
    return {
      x: scale.x || 1,
      y: scale.y || 1,
      z: scale.z || 1,
      sheerRate: sheerRate ? Number(sheerRate[1]) : 0,
      sheerAxis: sheerAxis ? Number(sheerAxis[1]) : 0,
    };
  }

  function parseLooseValue(key, raw) {
    const s = raw.trim();
    const lower = key.toLowerCase();
    if (lower === 'location' || lower === 'prepivot') return parseXYZ(s);
    if (lower === 'rotation') return parseRotator(s);
    if (lower === 'mainscale' || lower === 'postscale') return parseScale(s);
    if (/^\(.*X\s*=.*Y\s*=.*Z\s*=.*\)$/i.test(s)) return parseXYZ(s);
    if (/^true$/i.test(s)) return true;
    if (/^false$/i.test(s)) return false;
    if (/^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(s)) return Number(s);
    return unquote(s);
  }

  function parseVectorLine(line, keyword) {
    const rest = line.slice(keyword.length).trim().replace(/[()]/g, ' ');
    const nums = rest.split(',').map(v => Number(v.trim())).filter(Number.isFinite);
    if (nums.length >= 3) return { x: nums[0], y: nums[1], z: nums[2] };
    return null;
  }

  function parseT3D(text, options) {
    options = options || {};
    const map = {
      sourceName: options.sourceName || 'map.t3d',
      actors: [],
      warnings: [],
      meta: { parser: 'Spawnborn T3D Parser v0.1' },
    };

    let actor = null;
    let polygon = null;
    let inBrush = false;
    let inPolyList = false;

    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
      const rawLine = lines[lineNo];
      const line = rawLine.trim();
      if (!line) continue;

      if (/^Begin Actor\b/i.test(line)) {
        const h = parseHeaderFields(line);
        actor = {
          className: h.Class || 'Actor',
          name: h.Name || `Actor${map.actors.length}`,
          properties: {},
          brush: null,
          line: lineNo + 1,
        };
        continue;
      }

      if (/^End Actor\b/i.test(line)) {
        if (actor) map.actors.push(actor);
        actor = null;
        polygon = null;
        inBrush = false;
        inPolyList = false;
        continue;
      }

      if (!actor) continue;

      if (/^Begin Brush\b/i.test(line)) {
        const h = parseHeaderFields(line);
        actor.brush = actor.brush || { name: h.Name || '', polygons: [] };
        inBrush = true;
        continue;
      }

      if (/^End Brush\b/i.test(line)) {
        inBrush = false;
        continue;
      }

      if (/^Begin PolyList\b/i.test(line)) {
        inPolyList = true;
        continue;
      }

      if (/^End PolyList\b/i.test(line)) {
        inPolyList = false;
        continue;
      }

      if (/^Begin Polygon\b/i.test(line)) {
        const h = parseHeaderFields(line);
        polygon = {
          texture: h.Texture || null,
          flags: h.Flags !== undefined ? Number(h.Flags) : 0,
          origin: null,
          normal: null,
          textureU: null,
          textureV: null,
          vertices: [],
          line: lineNo + 1,
        };
        if (!actor.brush) actor.brush = { name: '', polygons: [] };
        continue;
      }

      if (/^End Polygon\b/i.test(line)) {
        if (polygon) actor.brush.polygons.push(polygon);
        polygon = null;
        continue;
      }

      if (polygon && inPolyList) {
        if (/^Origin\b/i.test(line)) polygon.origin = parseVectorLine(line, 'Origin');
        else if (/^Normal\b/i.test(line)) polygon.normal = parseVectorLine(line, 'Normal');
        else if (/^TextureU\b/i.test(line)) polygon.textureU = parseVectorLine(line, 'TextureU');
        else if (/^TextureV\b/i.test(line)) polygon.textureV = parseVectorLine(line, 'TextureV');
        else if (/^Vertex\b/i.test(line)) {
          const v = parseVectorLine(line, 'Vertex');
          if (v) polygon.vertices.push(v);
        }
        continue;
      }

      if (!inBrush && line.includes('=')) {
        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        actor.properties[key] = parseLooseValue(key, value);
      }
    }

    if (actor) {
      map.warnings.push(`Unclosed actor at end of file: ${actor.name}`);
      map.actors.push(actor);
    }

    for (const a of map.actors) {
      if (a.brush) {
        const main = a.properties.MainScale;
        const post = a.properties.PostScale;
        if ((main && main.sheerRate) || (post && post.sheerRate)) {
          map.warnings.push(`${a.name}: non-zero brush shear is parsed but not previewed in v0.1`);
        }
      }
    }

    map.summary = summarize(map);
    return map;
  }

  function summarize(map) {
    const classes = {};
    const groups = {};
    let polygons = 0;
    let vertices = 0;
    let brushes = 0;
    let additive = 0;
    let subtractive = 0;
    let fakeBackdrop = 0;
    let team0 = 0;
    let team1 = 0;

    for (const a of map.actors) {
      classes[a.className] = (classes[a.className] || 0) + 1;
      const g = a.properties.Group;
      if (g) groups[g] = (groups[g] || 0) + 1;
      if (a.className.toLowerCase() === 'playerstart') {
        const team = Number(a.properties.TeamNumber);
        if (team === 0) team0++;
        if (team === 1) team1++;
      }
      if (a.brush) {
        brushes++;
        const op = Number(a.properties.CsgOper);
        if (op === 1) additive++;
        if (op === 2) subtractive++;
        for (const p of a.brush.polygons) {
          polygons++;
          vertices += p.vertices.length;
          if ((Number(p.flags) & 128) !== 0) fakeBackdrop++;
        }
      }
    }

    const levelInfo = map.actors.find(a => a.className.toLowerCase() === 'levelinfo');
    return {
      title: levelInfo && levelInfo.properties.Title ? levelInfo.properties.Title : map.sourceName,
      actors: map.actors.length,
      brushes,
      additive,
      subtractive,
      polygons,
      vertices,
      fakeBackdrop,
      playerStarts: { team0, team1, total: team0 + team1 },
      pathNodes: classes.PathNode || 0,
      lights: classes.Light || 0,
      skyZones: classes.SkyZoneInfo || 0,
      zoneControlPoints: classes.s_ZoneControlPoint || 0,
      scenarioInfo: classes.TO_ScenarioInfo || 0,
      classes,
      groups,
    };
  }

  global.SpawnbornT3D = {
    parse: parseT3D,
    summarize,
    parseXYZ,
    parseScale,
    version: '0.1.0',
  };
})(window);
