/**
 * WriteToFire - Procedural Audio Engine (Web Audio API)
 * File: scripts/audio.js (Under 200 lines)
 */
(function(global) {
  const DEFAULT_CONFIG = {
    masterVol: 0.7,
    rumble: { vol: 0.4, tone: 240, air: 0.25, speed: 2.4 },
    crackle: { vol: 0.1, rate: 13, rateJitter: 0.85, pitch: 2800, pitchJitter: 0.7, decay: 3.5 },
    pop: { vol: 0.75, rate: 0.5, rateJitter: 0.7, sharpness: 3.5, pitchJitter: 0.6, body: 0.4 },
    burst: { vol: 0.85, interval: 16, intervalJitter: 0.6, thump: 0.6, decay: 65 }
  };

  let ctx = null, isPlaying = false, masterGain = null;
  let crackleGain = null, burstGain = null, rumbleGain = null, popGain = null;
  let crackleTimer = null;
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  async function loadConfig(url = 'configs/audio-config.json') {
    if (window.location && window.location.protocol === 'file:') return;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        Object.keys(data).forEach(k => {
          if (typeof data[k] === 'object' && config[k]) Object.assign(config[k], data[k]);
          else config[k] = data[k];
        });
        applyGains();
      }
    } catch (e) {}
  }

  function applyGains() {
    if (!ctx) return;
    if (crackleGain) crackleGain.gain.setValueAtTime(config.crackle.vol, ctx.currentTime);
    if (burstGain) burstGain.gain.setValueAtTime(config.burst.vol, ctx.currentTime);
    if (rumbleGain) rumbleGain.gain.setValueAtTime(config.rumble.vol, ctx.currentTime);
    if (popGain) popGain.gain.setValueAtTime(config.pop.vol, ctx.currentTime);
  }

  function init() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Rumble (低周波ピンクノイズ)
    const bufSize = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555; b1 = 0.99332 * b1 + w * 0.0750;
      b2 = 0.96900 * b2 + w * 0.1538; b3 = 0.86650 * b3 + w * 0.3104;
      b4 = 0.55000 * b4 + w * 0.5329; b5 = -0.7616 * b5 - w * 0.0168;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08;
      b6 = w * 0.1159;
    }
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = noiseBuf;
    rumbleSrc.loop = true;
    const rFilter = ctx.createBiquadFilter();
    rFilter.type = 'lowpass';
    rFilter.frequency.value = config.rumble.tone;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = config.rumble.vol;
    rumbleSrc.connect(rFilter);
    rFilter.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    rumbleSrc.start();

    // Module Gains
    crackleGain = ctx.createGain();
    burstGain = ctx.createGain();
    popGain = ctx.createGain();
    crackleGain.connect(masterGain);
    burstGain.connect(masterGain);
    popGain.connect(masterGain);
    applyGains();
  }

  function triggerCrackle() {
    if (!ctx || !isPlaying) return;
    const decaySec = (config.crackle.decay || 3.5) / 1000;
    const len = Math.floor(ctx.sampleRate * decaySec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    const pOffset = (Math.random() - 0.5) * 1600 * config.crackle.pitchJitter;
    f.frequency.value = Math.max(600, config.crackle.pitch + pOffset);
    f.Q.value = 2.5;
    src.connect(f);
    f.connect(crackleGain);
    src.start();
  }

  function loopCrackles() {
    if (!isPlaying) return;
    triggerCrackle();
    const base = 1000 / config.crackle.rate;
    const jitter = (Math.random() - 0.5) * base * 1.8 * config.crackle.rateJitter;
    crackleTimer = setTimeout(loopCrackles, Math.max(6, base + jitter));
  }

  function triggerBurst() {
    if (!ctx || !isPlaying) return;
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.2));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 2.0;

    const osc = ctx.createOscillator();
    const oscG = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.1);
    oscG.gain.setValueAtTime(0.7, ctx.currentTime);
    oscG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    src.connect(f);
    f.connect(burstGain);
    osc.connect(oscG);
    oscG.connect(burstGain);
    src.start(); osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }

  function start() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    isPlaying = true;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(config.masterVol, now + 1.5);
    loopCrackles();
  }

  function fadeOut(durationSec = 30) {
    if (!ctx || !isPlaying) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + durationSec);
    setTimeout(() => {
      isPlaying = false;
      clearTimeout(crackleTimer);
      if (ctx && ctx.state === 'running') ctx.suspend();
    }, durationSec * 1000);
  }

  function toggle(startVal) {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    isPlaying = (typeof startVal === 'boolean') ? startVal : !isPlaying;
    if (isPlaying) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(config.masterVol, ctx.currentTime);
      loopCrackles();
    } else {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      clearTimeout(crackleTimer);
    }
    return isPlaying;
  }

  function triggerBurnReaction(count = 24, intervalMs = 110) {
    triggerBurst();
    for (let i = 0; i < count; i++) {
      setTimeout(triggerCrackle, i * intervalMs + Math.random() * 50);
    }
  }

  global.FireAudio = {
    init, loadConfig, start, fadeOut, toggle,
    triggerCrackle, triggerBurst, triggerBurnReaction,
    isPlaying: () => isPlaying
  };
})(window);
