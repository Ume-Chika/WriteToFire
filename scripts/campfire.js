/**
 * WriteToFire - Campfire Stage Renderer (Canvas 2D + Ambient Glow)
 * File: scripts/campfire.js (Under 200 lines)
 */
(function(global) {
  const DEFAULT_CONFIG = {
    glowIntensity: 0.37, flickerSpeed: 3.0, particleCount: 45, sparkRatio: 0.20,
    width: 80, speed: 1.0, wind: 2.0, flareUpDecay: 0.008
  };

  let canvas = null, ctx = null, glowEl = null, isRunning = false;
  let flareUp = 1.0;
  let intensity = 0.35; // 初期は種火
  let targetIntensity = 0.35;
  let intensitySpeed = 0.02;
  let isExtinguished = false;
  const config = Object.assign({}, DEFAULT_CONFIG);
  let flameTex = null, firePool = [];

  function createFlameTexture() {
    flameTex = document.createElement('canvas');
    flameTex.width = flameTex.height = 64;
    const ftx = flameTex.getContext('2d');
    const grad = ftx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 245, 200, 1.0)');
    grad.addColorStop(0.3, 'rgba(255, 140, 20, 0.8)');
    grad.addColorStop(0.7, 'rgba(200, 40, 0, 0.3)');
    grad.addColorStop(1, 'rgba(150, 20, 0, 0)');
    ftx.fillStyle = grad;
    ftx.fillRect(0, 0, 64, 64);
  }

  function resetParticle(p) {
    if (isExtinguished || intensity <= 0.005) {
      p.size = 0; p.life = 0; return;
    }
    const curScale = intensity * flareUp;
    const cx = canvas.width / 2;
    const cy = canvas.height - 52;
    const sparkR = (config.sparkRatio + (flareUp > 1.2 ? 0.3 : 0)) * Math.min(1.0, intensity * 1.5);
    p.isSpark = Math.random() < sparkR;
    p.x = cx + (Math.random() - 0.5) * (config.width * curScale);
    p.y = cy + (Math.random() - 0.5) * (10 * curScale);

    if (p.isSpark) {
      p.vx = (Math.random() - 0.5) * 2.4 * curScale;
      p.vy = -(Math.random() * 3.8 + 1.8) * curScale * config.speed;
      p.size = (Math.random() * 2.2 + 0.8) * Math.min(1.0, intensity + 0.2);
      p.life = p.maxLife = (Math.random() * 42 + 30) * Math.min(1.0, intensity + 0.3);
    } else {
      p.vx = (Math.random() - 0.5) * 0.8 * curScale;
      p.vy = -(Math.random() * 2.3 + 1.0) * curScale * config.speed;
      p.size = (Math.random() * 36 + 24) * curScale;
      p.life = p.maxLife = (Math.random() * 36 + 24) * Math.min(1.2, intensity + 0.2);
    }
  }

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height;
  }

  function render() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // インテンシティの滑らかな遷移
    if (Math.abs(intensity - targetIntensity) > 0.001) {
      intensity += (targetIntensity - intensity) * intensitySpeed;
    } else {
      intensity = targetIntensity;
      if (intensity <= 0.001) {
        isExtinguished = true;
        if (glowEl) glowEl.style.opacity = '0';
        return; // 完全消火
      }
    }

    if (flareUp > 1.0) {
      flareUp -= config.flareUpDecay;
    }
    if (glowEl) {
      const baseGlow = config.glowIntensity * intensity;
      glowEl.style.opacity = `${(baseGlow + (flareUp - 1.0) * 0.25).toFixed(3)}`;
    }
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < firePool.length; i++) {
      const p = firePool[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (!p.isSpark) p.size *= 0.955;
      if (p.life <= 0) { resetParticle(p); continue; }

      const progress = Math.max(0, p.life / p.maxLife);
      if (p.isSpark) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.283);
        ctx.fillStyle = `rgba(255, 200, 80, ${progress})`;
        ctx.fill();
      } else {
        ctx.globalAlpha = progress * 0.6;
        ctx.drawImage(flameTex, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1.0;
      }
    }
    requestAnimationFrame(render);
  }

  async function loadConfig(url = 'configs/fire-config.json') {
    if (window.location && window.location.protocol === 'file:') return;
    try {
      const res = await fetch(url);
      if (res.ok) Object.assign(config, await res.json());
    } catch (e) {}
  }

  function init(canvasEl, glowElement) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    glowEl = glowElement;
    createFlameTexture();
    resize();
    window.addEventListener('resize', resize);
    firePool = Array.from({ length: config.particleCount || 45 }, () => {
      const p = { x: 0, y: 0, vx: 0, vy: 0, size: 0, life: 0, maxLife: 0, isSpark: false };
      resetParticle(p);
      return p;
    });
    isRunning = true;
    requestAnimationFrame(render);
  }

  function ignite(durationSec = 2.0) {
    targetIntensity = 1.0;
    intensitySpeed = 1.0 / (durationSec * 60);
  }

  function fadeOut(durationSec = 30) {
    targetIntensity = 0.0;
    intensitySpeed = 1.0 / (durationSec * 60);
  }

  function setFlareUp(val) { flareUp = val; }

  global.CampfireStage = {
    init, loadConfig, setFlareUp, ignite, fadeOut,
    getFlareUp: () => flareUp,
    setIntensity: (v) => { intensity = targetIntensity = v; }
  };
})(window);
