/**
 * WriteToFire - Paper Physics & Multi-Layer Burn Engine
 * File: scripts/paper-burn.js (Under 200 lines)
 */
(function(global) {
  const DEFAULT_CONFIG = {
    physics: { drag: 0.035, gravity: 0.22, terminal: 2.8, sway: 1.5, tumble: 0.6, rollAmp: 24, yawDrift: 0.3 },
    throw: { minSwipeDelta: -30, vxFactor: 0.035, vyFactor: 0.038, vyMin: -6.5, vzFactor: 0.08, vzMin: 12.0, spreadX: 3.0, spreadY: 1.4, spreadZ: 3.2 },
    burn: { duration: 3600, seedsCount: 5, flareUpIntensity: 2.8, sinkSpeed: 0.11, ignitionY: 55 }
  };
  const CARD_W = 150, CARD_H = 205;
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  let els = {}, cbs = {}, sheets = [], isDragging = false, startX = 0, startY = 0, startTime = 0, sheetCountOverride = null;

  function createSheet(bakedSheet, idx, total, baseVx, baseVy, baseVz) {
    const offset = total > 1 ? idx - (total - 1) / 2 : 0;
    const el = document.createElement('div');
    el.className = 'paper-sheet';
    const cFront = document.createElement('canvas'), cBack = document.createElement('canvas');
    cFront.className = 'bake-canvas canvas-front'; cBack.className = 'bake-canvas canvas-back';
    cFront.width = cBack.width = CARD_W; cFront.height = cBack.height = CARD_H;
    cFront.getContext('2d').drawImage(bakedSheet.frontCanvas, 0, 0);
    cBack.getContext('2d').drawImage(bakedSheet.backCanvas, 0, 0);
    el.appendChild(cFront); el.appendChild(cBack);
    (els.viewport || els.paperLayer.parentElement).appendChild(el);

    const rF = () => 0.8 + Math.random() * 0.4, p = config.physics;
    const phys = {
      drag: (p.drag || 0.035) * rF(), gravity: (p.gravity || 0.22) * rF(), terminal: (p.terminal || 2.8) * rF(),
      sway: (p.sway || 1.5) * rF(), tumble: (p.tumble ?? 0.6) * rF(), rollAmp: (p.rollAmp ?? 24) * rF(), yawDrift: (p.yawDrift ?? 0.3) * rF()
    };

    const seeds = Array.from({ length: config.burn.seedsCount || 5 }, (_, i) => ({
      x: 16 + Math.random() * (CARD_W - 32), y: 20 + Math.random() * (CARD_H - 40),
      aspect: 1.1 + Math.random() * 0.4, angle: Math.random() * Math.PI,
      delay: i * (0.9 / (config.burn.seedsCount || 5)), speed: 0.85 + Math.random() * 0.4,
      harmonics: [[2, 0.14], [3, 0.10], [4, 0.07], [5, 0.05]].map(([k, a]) => ({ k, a: a * (0.8 + Math.random() * 0.5), p: Math.random() * 6.28 }))
    }));

    const s = {
      el, cFront, cBack, ctxFront: cFront.getContext('2d'), ctxBack: cBack.getContext('2d'),
      baseFront: bakedSheet.frontCanvas, baseBack: bakedSheet.backCanvas, seeds, phys,
      phaseX: Math.random() * 6.28, phaseR: Math.random() * 6.28,
      vrx: 1.8 + Math.random() * 0.8,
      vry: (offset * 0.5) + (Math.random() - 0.5) * 0.4,
      state: {
        x: offset * 12, y: 150 - idx * 3, z: -idx * 8,
        vx: baseVx + offset * (config.throw.spreadX || 3.0) + (Math.random() - 0.5) * 0.8,
        vy: baseVy + (Math.random() - 0.5) * (config.throw.spreadY || 1.4) - idx * 0.35,
        vz: baseVz + (Math.random() - 0.5) * (config.throw.spreadZ || 3.2),
        rx: 10, ry: offset * 8, rz: 0,
        timeInAir: 0, isFlying: true, isBurning: false, isDone: false, burnStart: 0
      }
    };
    updateTransform(s);
    return s;
  }

  function traceHarmonic(ctx, r, extra, aspect, harmonics) {
    ctx.beginPath();
    for (let j = 0; j <= 26; j++) {
      const t = j * (6.28318 / 26);
      let m = 1.0;
      for (let h of harmonics) m += h.a * Math.cos(h.k * t + h.p);
      const rad = r * m + extra;
      j === 0 ? ctx.moveTo(Math.cos(t) * rad * aspect, Math.sin(t) * rad) : ctx.lineTo(Math.cos(t) * rad * aspect, Math.sin(t) * rad);
    }
    ctx.closePath();
  }

  function drawSheetBurn(s, now) {
    const totalT = Math.min((now - s.state.burnStart) / (config.burn.duration || 3600), 1.0);
    const maxReach = Math.hypot(CARD_W, CARD_H);
    const active = s.seeds.map(sd => {
      const p = Math.max(0, (totalT - sd.delay) / (1.0 - sd.delay));
      return p > 0 ? { sd, r: Math.pow(p, 1.6) * maxReach * sd.speed } : null;
    }).filter(Boolean);

    const draw = (ctx, baseImg, isBack) => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, CARD_W, CARD_H);
      ctx.drawImage(baseImg, 0, 0);
      const renderSeeds = (extra, style) => {
        for (let { sd, r } of active) {
          ctx.save();
          isBack ? (ctx.translate(CARD_W - sd.x, sd.y), ctx.rotate(-sd.angle), ctx.scale(-1, 1)) : (ctx.translate(sd.x, sd.y), ctx.rotate(sd.angle));
          traceHarmonic(ctx, r, extra, sd.aspect, sd.harmonics);
          if (style) ctx.fillStyle = style;
          ctx.fill(); ctx.restore();
        }
      };
      renderSeeds(7, '#1a0803'); renderSeeds(3.5, '#ff4500'); renderSeeds(1.2, '#ffbb33');
      ctx.globalCompositeOperation = 'destination-out';
      renderSeeds(0);
      ctx.globalCompositeOperation = 'source-over';
    };

    draw(s.ctxFront, s.baseFront, false);
    draw(s.ctxBack, s.baseBack, true);
    s.state.y += (config.burn.sinkSpeed || 0.11); s.state.rx += 0.12; s.state.ry += 0.06;
    updateTransform(s);
    if (totalT >= 1.0) {
      s.state.isDone = true; s.el.style.opacity = '0';
      if (sheets.every(sh => sh.state.isDone) && cbs.onBurnComplete) cbs.onBurnComplete();
    }
  }

  function updateTransform(s) {
    s.el.style.transform = `translate3d(${s.state.x}px, ${s.state.y}px, ${s.state.z}px) rotateX(${s.state.rx}deg) rotateY(${s.state.ry}deg) rotateZ(${s.state.rz}deg)`;
    const f = (Math.cos(s.state.rx * 0.01745) * Math.cos(s.state.ry * 0.01745)) >= 0;
    s.cFront.style.display = f ? 'block' : 'none'; s.cBack.style.display = f ? 'none' : 'block';
  }

  function tickPhysics() {
    const now = performance.now();
    for (let s of sheets) {
      if (s.state.isDone) continue;
      if (s.state.isBurning) { drawSheetBurn(s, now); continue; }
      if (s.state.isFlying) {
        s.state.timeInAir += 0.016;
        s.state.vx *= (1 - s.phys.drag);
        s.state.vz *= (1 - s.phys.drag * 1.5);
        s.state.vy = Math.min(s.state.vy + s.phys.gravity, s.phys.terminal);

        s.state.rx += s.vrx * s.phys.tumble;
        s.state.ry += s.vry * s.phys.yawDrift;

        if (Math.abs(s.state.vz) < 4.5) {
          const tAir = s.state.timeInAir;
          s.state.x += (s.state.vx + Math.sin(tAir * 3.8 + s.phaseX) * s.phys.sway);
          s.state.rz = Math.sin(tAir * 3.2 + s.phaseR) * s.phys.rollAmp;
        } else {
          s.state.x += s.state.vx;
          s.state.rz = s.state.vx * 0.25;
        }
        s.state.y += s.state.vy; s.state.z += s.state.vz;
        updateTransform(s);

        if (s.state.z < -300 && s.state.z > -1150 && Math.abs(s.state.x) < 260 && s.state.vy > 0 && s.state.y > (config.burn.ignitionY ?? 55)) {
          s.state.isFlying = false; s.state.isBurning = true; s.state.burnStart = now;
          s.el.classList.add('burning');
          if (cbs.onIgnite) cbs.onIgnite(s);
        } else if (s.state.y > 400 || s.state.z < -1400) {
          s.state.isDone = true; s.el.style.opacity = '0';
          if (sheets.every(sh => sh.state.isDone)) reset();
        }
      }
    }
    requestAnimationFrame(tickPhysics);
  }

  let currentPages = [''];

  function prepareThrow(pagesArray) {
    currentPages = (Array.isArray(pagesArray) && pagesArray.length > 0) ? pagesArray : [''];
    if (els.paperLayer) {
      els.paperLayer.style.display = 'block';
      els.paperLayer.style.opacity = '1';
      if (global.PaperBake && global.PaperBake.bakePages) {
        const baked = global.PaperBake.bakePages(currentPages);
        if (baked.sheets && baked.sheets[0]) {
          els.paperLayer.innerHTML = '';
          const c = baked.sheets[0].frontCanvas;
          c.className = 'bake-canvas canvas-front';
          els.paperLayer.appendChild(c);
        }
      }
    }
    if (els.hint) els.hint.classList.remove('hidden');
  }

  function onEnd(e) {
    if (!isDragging || sheets.some(s => s.state.isFlying || s.state.isBurning)) return;
    isDragging = false;
    const endX = e.clientX !== undefined ? e.clientX : (e.changedTouches ? e.changedTouches[0].clientX : startX);
    const endY = e.clientY !== undefined ? e.clientY : (e.changedTouches ? e.changedTouches[0].clientY : startY);
    const dt = Math.max((performance.now() - startTime) / 1000, 0.05), deltaY = endY - startY;
    if (deltaY < config.throw.minSwipeDelta) {
      if (els.textarea) els.textarea.blur();
      let bakedData;
      if (global.PaperBake && global.PaperBake.bakePages) {
        bakedData = global.PaperBake.bakePages(currentPages);
      } else if (global.PaperBake) {
        bakedData = global.PaperBake.bake(currentPages.join('\n'), 4, sheetCountOverride);
      } else {
        bakedData = { sheets: [{ frontCanvas: document.createElement('canvas'), backCanvas: document.createElement('canvas') }], totalPages: 1 };
      }
      if (els.paperLayer) els.paperLayer.style.display = 'none';
      if (els.hint) els.hint.classList.add('hidden');
      if (cbs.onThrow) cbs.onThrow();

      const baseVx = ((endX - startX) / dt) * config.throw.vxFactor;
      const baseVy = Math.min((deltaY / dt) * config.throw.vyFactor, config.throw.vyMin || -6.5);
      const baseVz = -Math.max((Math.abs(deltaY) / dt) * config.throw.vzFactor, config.throw.vzMin || 12.0);
      sheets.forEach(s => s.el.remove()); sheets = [];
      const count = bakedData.totalPages;
      for (let i = 0; i < count; i++) sheets.push(createSheet(bakedData.sheets[i], i, count, baseVx, baseVy, baseVz));
    }
  }

  function reset() {
    sheets.forEach(s => s.el.remove()); sheets = [];
    if (els.paperLayer) els.paperLayer.style.display = 'block';
    if (els.domInputCard) els.domInputCard.style.display = 'flex';
    if (els.hint) els.hint.classList.remove('hidden');
  }

  function updateConfig(d) {
    if (!d) return;
    ['physics', 'throw', 'burn'].forEach(k => { if (d[k]) Object.assign(config[k], d[k]); });
  }
  async function loadConfig(url = 'configs/paper-burn-config.json') {
    if (window.location && window.location.protocol === 'file:') return;
    try { const res = await fetch(url); if (res.ok) updateConfig(await res.json()); } catch (e) {}
  }
  function init(elements, callbacks = {}) {
    els = elements; cbs = callbacks;
    const onStart = (e) => {
      if (sheets.some(s => s.state.isFlying || s.state.isBurning)) return;
      isDragging = true;
      startX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
      startY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
      startTime = performance.now();
    };
    els.paperLayer.addEventListener('mousedown', onStart);
    els.paperLayer.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('mouseup', onEnd); window.addEventListener('touchend', onEnd);
    reset(); requestAnimationFrame(tickPhysics);
  }
  global.PaperBurnStage = {
    init, loadConfig, updateConfig, reset, prepareThrow,
    getConfig: () => config, getDefaultConfig: () => DEFAULT_CONFIG,
    setSheetCount: (n) => { sheetCountOverride = n ? parseInt(n, 10) : null; }
  };
})(window);
