(() => {
  'use strict';

  /* =========================================================
     Elemente & Zustand
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const canvas = $('glass');
  const ctx = canvas.getContext('2d');
  const wrap = $('glassWrap');
  const timeEl = $('time');
  const durLabel = $('durLabel');
  const startBtn = $('startBtn');
  const flipBtn = $('flipBtn');
  const resetBtn = $('resetBtn');
  const soundBtn = $('soundBtn');
  const fullBtn = $('fullBtn');
  const presets = Array.from(document.querySelectorAll('.preset'));
  const customForm = $('customForm');
  const customMin = $('customMin');
  const doneEl = $('done');
  const doneOk = $('doneOk');
  const historyBox = $('historyBox');
  const historyList = $('historyList');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } },
  };

  const state = {
    duration: (parseFloat(store.get('sanduhr.min')) || 5) * 60000, // ms
    r: 0,            // Anteil des Sandes im oberen Kolben (0..1)
    running: false,
    started: false,
    flipping: false,
    last: performance.now(),
    sound: store.get('sanduhr.sound') !== 'off',
  };

  /* =========================================================
     Geometrie der Sanduhr
     ========================================================= */
  let G = null;
  const SAND_COLORS = ['#c58c3e', '#e9c27e', '#b47a33', '#f3d79c', '#a66d29', '#dcae68'];

  const sandPattern = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#d6a35a';
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2600; i++) {
      x.globalAlpha = 0.5 + Math.random() * 0.5;
      x.fillStyle = SAND_COLORS[i % SAND_COLORS.length];
      const s = Math.random() < 0.8 ? 1 : 1.6;
      x.fillRect(Math.random() * 128, Math.random() * 128, s, s);
    }
    return ctx.createPattern(c, 'repeat');
  })();

  function layout() {
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(60, rect.width);
    const H = Math.max(100, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const capH = H * 0.045;
    const neckY = H / 2;
    const gy0 = capH;
    const L = neckY - gy0;              // Höhe eines Kolbens
    const cx = W / 2;
    const maxHW = W * 0.40;             // halbe maximale Breite
    const neckHW = Math.max(1.6, W * 0.022);
    const K = 400;

    // halbe Breite des Glases, s = 0 am Hals, s = 1 am Ende des Kolbens
    const hw = new Float32Array(K + 1);
    for (let k = 0; k <= K; k++) {
      const s = Math.max(0, (k / K - 0.03) / 0.97);   // kurzer gerader Hals
      const t = (s - 0.52) / 0.52;
      const g = Math.sqrt(Math.max(0, 1 - t * t));
      hw[k] = neckHW + (maxHW - neckHW) * g;
    }
    // kumulierte Fläche vom Hals nach außen
    const cum = new Float64Array(K + 1);
    for (let k = 1; k <= K; k++) cum[k] = cum[k - 1] + (hw[k] + hw[k - 1]) * (L / K);

    // Umriss des Glases
    const path = new Path2D();
    for (let k = K; k >= 0; k--) path.lineTo(cx - hw[k], neckY - (k / K) * L);
    for (let k = 1; k <= K; k++) path.lineTo(cx - hw[k], neckY + (k / K) * L);
    for (let k = K; k >= 0; k--) path.lineTo(cx + hw[k], neckY + (k / K) * L);
    for (let k = 1; k <= K; k++) path.lineTo(cx + hw[k], neckY - (k / K) * L);
    path.closePath();

    const shade = ctx.createLinearGradient(cx - maxHW, 0, cx + maxHW, 0);
    shade.addColorStop(0, 'rgba(70,35,5,0.45)');
    shade.addColorStop(0.3, 'rgba(0,0,0,0)');
    shade.addColorStop(0.45, 'rgba(255,240,200,0.10)');
    shade.addColorStop(0.7, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(70,35,5,0.5)');

    G = {
      W, H, cx, neckY, L, gy0, gy1: neckY + L, capH, maxHW, neckHW, K, hw, cum,
      total: cum[K], sandArea: cum[K] * 0.62, path, shade, bs: null,
    };
    particles.length = 0;
    draw();
  }

  function hwAt(s) {
    const x = Math.min(Math.max(s, 0), 1) * G.K;
    const i = Math.floor(x);
    const j = Math.min(i + 1, G.K);
    return G.hw[i] + (G.hw[j] - G.hw[i]) * (x - i);
  }

  // s, bei dem die Fläche zwischen Hals und s gleich a ist
  function sForArea(a) {
    const { cum, K } = G;
    if (a <= 0) return 0;
    if (a >= cum[K]) return 1;
    let lo = 0, hi = K;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < a) lo = mid; else hi = mid;
    }
    return (lo + (a - cum[lo]) / ((cum[hi] - cum[lo]) || 1)) / K;
  }

  function bottomY(x, bs) {
    const d = (x - G.cx) / bs.R;
    const bell = Math.abs(d) < 1 ? Math.pow(1 - d * d, 1.4) : 0;
    return Math.max(G.neckY + G.L * 0.04, bs.yb + bs.m * 0.4 - bs.m * bell);
  }

  /* =========================================================
     Rieselnde Sandkörner
     ========================================================= */
  const particles = [];

  function flowing() {
    return state.running && !state.flipping && state.r > 0;
  }

  function stepParticles(dt) {
    if (!G) return;
    const { cx, neckY, L, neckHW } = G;
    if (flowing() && particles.length < 400) {
      const n = Math.min(8, Math.ceil(dt * 260));
      for (let i = 0; i < n; i++) {
        particles.push({
          x: cx + (Math.random() - 0.5) * neckHW * 1.2,
          y: neckY + L * 0.02,
          vx: (Math.random() - 0.5) * 8,
          vy: L * (0.3 + Math.random() * 0.3),
          s: Math.random() < 0.7 ? 1.2 : 1.8,
          c: SAND_COLORS[(Math.random() * SAND_COLORS.length) | 0],
          bounced: false,
          life: 3,
        });
      }
    }
    const grav = L * 4;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const floor = G.bs ? bottomY(p.x, G.bs) : G.gy1;
      if (p.y >= floor) {
        if (!p.bounced && Math.random() < 0.35) {
          p.bounced = true;
          p.y = floor - 1;
          p.vy = -Math.abs(p.vy) * 0.12;
          p.vx = (Math.random() - 0.5) * L * 0.4;
        } else {
          particles.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /* =========================================================
     Zeichnen
     ========================================================= */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillSand() {
    ctx.fillStyle = sandPattern;
    ctx.fill();
    ctx.fillStyle = G.shade;
    ctx.fill();
  }

  function drawPosts() {
    const { W, H, cx, maxHW, capH } = G;
    const pw = W * 0.03;
    for (const sgn of [-1, 1]) {
      const x = cx + sgn * (maxHW + W * 0.05) - pw / 2;
      const gr = ctx.createLinearGradient(x, 0, x + pw, 0);
      gr.addColorStop(0, '#3d2210');
      gr.addColorStop(0.45, '#9a6233');
      gr.addColorStop(1, '#3d2210');
      ctx.fillStyle = gr;
      ctx.fillRect(x, capH * 0.5, pw, H - capH);
    }
  }

  function drawCaps() {
    const { W, H, cx, capH, maxHW } = G;
    const cw = 2 * (maxHW + W * 0.085);
    const x = cx - cw / 2;
    for (const y of [0, H - capH]) {
      const gr = ctx.createLinearGradient(0, y, 0, y + capH);
      gr.addColorStop(0, '#a8703c');
      gr.addColorStop(0.5, '#6e3f1b');
      gr.addColorStop(1, '#3a1f0c');
      ctx.fillStyle = gr;
      roundRect(x, y, cw, capH, capH * 0.35);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGlass() {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(190,215,255,0.18)';
    ctx.lineWidth = 5;
    ctx.stroke(G.path);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke(G.path);

    // Lichtreflexe
    ctx.clip(G.path);
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      let first = true;
      for (let k = Math.round(G.K * 0.18); k <= Math.round(G.K * 0.88); k += 4) {
        const s = k / G.K;
        const y = G.neckY + dir * s * G.L;
        const x = G.cx - hwAt(s) * 0.72;
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = G.maxHW * 0.09;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = G.maxHW * 0.022;
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    if (!G) return;
    const { W, H, cx, neckY, L, maxHW } = G;
    const r = state.r;
    const left = cx - maxHW - 12;
    const right = cx + maxHW + 12;

    ctx.clearRect(0, 0, W, H);
    drawPosts();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill(G.path);

    ctx.save();
    ctx.clip(G.path);

    // --- oberer Sand mit Trichter in der Mitte ---
    if (r > 0.0004) {
      const s = sForArea(r * G.sandArea);
      const y = neckY - s * L;
      const hwS = hwAt(s);
      const depth = state.started && r < 1
        ? Math.min(L * 0.1, hwS * 0.7) * Math.min(1, (1 - r) / 0.05)
        : 0;
      const sig = hwS * 0.33 + 2;
      const base = y - depth * 0.22;
      ctx.beginPath();
      ctx.moveTo(left, base);
      for (let x = cx - hwS - 2; x <= cx + hwS + 2; x += 2) {
        const dx = x - cx;
        ctx.lineTo(x, Math.min(neckY, base + depth * Math.exp(-dx * dx / (2 * sig * sig))));
      }
      ctx.lineTo(right, base);
      ctx.lineTo(right, neckY);
      ctx.lineTo(left, neckY);
      ctx.closePath();
      fillSand();
    }

    // --- unterer Sandhaufen ---
    let bs = null;
    const amount = (1 - r) * G.sandArea;
    if (amount > G.total * 0.0005) {
      const s = sForArea(G.total - amount);
      const yb = neckY + s * L;
      const hwB = hwAt(s);
      const m = Math.min(L * 0.16, hwB * 0.5) * Math.min(1, amount / (G.sandArea * 0.06));
      bs = { yb, m, R: hwB * 1.05 };
      ctx.beginPath();
      ctx.moveTo(left, bottomY(left, bs));
      for (let x = cx - bs.R; x <= cx + bs.R; x += 2) ctx.lineTo(x, bottomY(x, bs));
      ctx.lineTo(right, bottomY(right, bs));
      ctx.lineTo(right, H);
      ctx.lineTo(left, H);
      ctx.closePath();
      fillSand();
    }
    G.bs = bs;

    // --- Sandstrahl ---
    if (flowing()) {
      const yEnd = bs ? bottomY(cx, bs) : G.gy1;
      const w = G.neckHW * (0.7 + Math.random() * 0.3);
      ctx.fillStyle = sandPattern;
      ctx.fillRect(cx - w / 2, neckY - L * 0.03, w, yEnd - neckY + L * 0.03);
    }
    for (const p of particles) {
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();

    drawGlass();
    drawCaps();
  }

  /* =========================================================
     Ton & Sprache
     ========================================================= */
  let actx = null, master = null, noiseBuf = null, grainBuf = null;
  let hissSrc = null, hissGain = null, speechUnlocked = false;

  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.9;
      master.connect(actx.destination);
      const len = actx.sampleRate * 2;
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      grainBuf = actx.createBuffer(1, len, actx.sampleRate);
      const n = noiseBuf.getChannelData(0);
      const g = grainBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        n[i] = Math.random() * 2 - 1;
        g[i] = Math.random() < 0.04 ? (Math.random() * 2 - 1) : 0; // einzelne Körner
      }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // muss innerhalb einer Benutzeraktion laufen (iOS/Android)
  function unlockAudio() {
    if (window.DeviceOrientationEvent &&
        typeof DeviceOrientationEvent.requestPermission === 'function' &&
        !unlockAudio.asked) {
      unlockAudio.asked = true;
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    audio();
    if (!speechUnlocked && 'speechSynthesis' in window) {
      speechUnlocked = true;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  }

  function setHiss(on) {
    const a = actx;
    if (!a) return;
    if (on && !hissSrc) {
      hissSrc = a.createBufferSource();
      hissSrc.buffer = grainBuf;
      hissSrc.loop = true;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800;
      bp.Q.value = 0.8;
      hissGain = a.createGain();
      hissGain.gain.setValueAtTime(0, a.currentTime);
      hissGain.gain.linearRampToValueAtTime(0.22, a.currentTime + 0.4);
      hissSrc.connect(bp).connect(hissGain).connect(master);
      hissSrc.start();
    } else if (!on && hissSrc) {
      const t = a.currentTime;
      hissGain.gain.cancelScheduledValues(t);
      hissGain.gain.setValueAtTime(hissGain.gain.value, t);
      hissGain.gain.linearRampToValueAtTime(0, t + 0.25);
      hissSrc.stop(t + 0.3);
      hissSrc = null;
      hissGain = null;
    }
  }

  function sfxFlip() {
    if (!state.sound) return;
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.7);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.9);
    // dumpfes "Aufsetzen"
    const o = a.createOscillator();
    const og = a.createGain();
    o.frequency.setValueAtTime(150, t + 0.88);
    o.frequency.exponentialRampToValueAtTime(60, t + 1.05);
    og.gain.setValueAtTime(0.0001, t + 0.88);
    og.gain.exponentialRampToValueAtTime(0.4, t + 0.9);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(og).connect(master);
    o.start(t + 0.88);
    o.stop(t + 1.15);
  }

  function sfxChime() {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + 0.05;
    [[880, 0], [1108.73, 0.22], [1318.51, 0.44], [1760, 0.66]].forEach(([f, d]) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.6);
      o.connect(g).connect(master);
      o.start(t0 + d);
      o.stop(t0 + d + 1.7);
    });
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.95;
    const voice = synth.getVoices().find((v) => /^de([-_]|$)/i.test(v.lang));
    if (voice) u.voice = voice;
    synth.cancel();
    synth.speak(u);
  }
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices(); // Stimmen vorladen

  /* =========================================================
     Bildschirm wach halten (Handy/Tablet)
     ========================================================= */
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* nicht unterstützt */ }
  }

  /* =========================================================
     Logik
     ========================================================= */
  const pad = (n) => String(n).padStart(2, '0');

  function fmtTime(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function fmtDur(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m === 0) return `${s} s`;
    return s === 0 ? `${m} min` : `${m}:${pad(s)} min`;
  }

  let shownTime = '';
  function showTime() {
    const ms = state.started ? state.r * state.duration : state.duration;
    const txt = fmtTime(ms);
    if (txt !== shownTime) {
      shownTime = txt;
      timeEl.textContent = txt;
      document.title = state.running ? `${txt} – Sanduhr` : 'Sanduhr';
    }
  }

  function syncUI() {
    startBtn.textContent = state.running ? 'Pause' : (state.started && state.r > 0 ? 'Weiter' : 'Start');
    durLabel.textContent = 'Dauer: ' + fmtDur(state.duration / 1000);
    const min = state.duration / 60000;
    presets.forEach((b) => b.setAttribute('aria-pressed', String(parseFloat(b.dataset.min) === min)));
    soundBtn.textContent = state.sound ? '🔊 Ton an' : '🔇 Ton aus';
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    setHiss(state.running && state.sound && !document.hidden);
    keepAwake(state.running || state.flipping);
    showTime();
  }

  function update(now) {
    const dt = now - state.last;
    state.last = now;
    if (state.running && !state.flipping) {
      state.r -= dt / state.duration;
      if (state.r <= 0) {
        state.r = 0;
        finish();
      }
    }
    showTime();
  }

  function setDuration(min) {
    state.duration = min * 60000;
    store.set('sanduhr.min', String(min));
    reset();
  }

  function reset() {
    if (state.flipping) return;
    state.running = false;
    state.started = false;
    state.r = 0;
    particles.length = 0;
    hideDone();
    syncUI();
  }

  function flip() {
    if (state.flipping) return;
    unlockAudio();
    hideDone();
    state.flipping = true;
    sfxFlip();
    syncUI();
    wrap.classList.add('flipping');
    const fallback = setTimeout(onFlipEnd, 1500);
    wrap.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'transform') return;
      wrap.removeEventListener('transitionend', handler);
      clearTimeout(fallback);
      onFlipEnd();
    });
  }

  function onFlipEnd() {
    if (!state.flipping) return;
    state.flipping = false;
    state.r = 1 - state.r;          // was unten war, ist jetzt oben
    particles.length = 0;
    wrap.classList.add('no-anim');
    wrap.classList.remove('flipping');
    void wrap.offsetWidth;          // Neuberechnung erzwingen
    wrap.classList.remove('no-anim');
    state.started = state.r > 0;
    state.running = state.r > 0;
    state.last = performance.now();
    syncUI();
  }

  function toggle() {
    if (state.flipping) return;
    unlockAudio();
    if (state.running) {
      state.running = false;
    } else if (state.started && state.r > 0) {
      state.running = true;
      state.last = performance.now();
    } else {
      // Sand ist unten → Sanduhr umdrehen startet sie
      state.r = 0;
      flip();
      return;
    }
    syncUI();
  }

  function finish() {
    state.running = false;
    particles.length = 0;
    syncUI();
    if (state.sound) {
      sfxChime();
      setTimeout(() => speak('Sanduhr fertig'), 1100);
    }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    showDone();
    logRun(Math.round(state.duration / 1000));
  }

  function showDone() {
    doneEl.hidden = false;
    doneOk.focus();
  }
  function hideDone() {
    if (!doneEl.hidden) {
      doneEl.hidden = true;
      startBtn.focus();
    }
  }

  /* =========================================================
     Verlauf (PHP)
     ========================================================= */
  async function loadHistory() {
    try {
      const res = await fetch('api.php?action=list', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const list = await res.json();
      historyList.textContent = '';
      if (!list.length) {
        const li = document.createElement('li');
        li.textContent = 'Noch keine Durchläufe.';
        historyList.appendChild(li);
      }
      for (const it of list) {
        const li = document.createElement('li');
        const when = new Date(it.finishedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
        li.textContent = `${fmtDur(it.seconds)} – ${when}`;
        historyList.appendChild(li);
      }
      historyBox.hidden = false;
    } catch (e) {
      historyBox.hidden = true; // ohne PHP-Server einfach ausblenden
    }
  }

  async function logRun(seconds) {
    try {
      await fetch('api.php?action=add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      loadHistory();
    } catch (e) { /* offline */ }
  }

  /* =========================================================
     Ereignisse
     ========================================================= */
  presets.forEach((b) => b.addEventListener('click', () => setDuration(parseFloat(b.dataset.min))));

  customForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const min = parseFloat(String(customMin.value).replace(',', '.'));
    if (!(min >= 0.1 && min <= 600)) {
      customMin.setCustomValidity('Bitte 0,1 bis 600 Minuten eingeben.');
      customMin.reportValidity();
      return;
    }
    customMin.setCustomValidity('');
    setDuration(Math.round(min * 100) / 100);
    customMin.blur();
  });
  customMin.addEventListener('input', () => customMin.setCustomValidity(''));

  startBtn.addEventListener('click', toggle);
  flipBtn.addEventListener('click', flip);
  resetBtn.addEventListener('click', reset);
  // Üst/alt ahşap çerçeve → Umdrehen, cam (kum saati) → Start/Pause
  wrap.addEventListener('click', (e) => {
    if (!G) return;
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) * (G.H / rect.height);
    const hit = G.capH * 1.8; // çerçeveden biraz büyük: telefonda parmakla kolay basılsın
    if (y < hit || y > G.H - hit) flip();
    else toggle();
  });
  doneOk.addEventListener('click', hideDone);
  doneEl.addEventListener('click', (e) => { if (e.target === doneEl) hideDone(); });

  soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    store.set('sanduhr.sound', state.sound ? 'on' : 'off');
    if (state.sound) unlockAudio();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    syncUI();
  });

  if (!document.documentElement.requestFullscreen) {
    fullBtn.hidden = true;
  } else {
    fullBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape' && !doneEl.hidden) { hideDone(); return; }
    const k = e.key.toLowerCase();
    if ((k === ' ' && !(e.target instanceof HTMLButtonElement)) || k === 'mediaplaypause') {
      e.preventDefault();
      toggle();
    } else if (k === 'u') {
      flip();
    } else if (k === 'r') {
      reset();
    }
    else if (k === 'arrowup') {
      e.preventDefault(); // sayfanin klaymasini engeller
      flip();
    }
  });

  new ResizeObserver(layout).observe(wrap);

  /* Handy umdrehen → Sanduhr umdrehen */
  let upsideDown = null;
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    // beta: telefon dik tutulunca ~ +90, ters tutulunca ~ -90
    let now = upsideDown;
    if (e.beta > 45) now = false;
    else if (e.beta < -45) now = true;     // arası "ölü bölge": titremede çevirmesin
    if (upsideDown !== null && now !== upsideDown) flip();
    upsideDown = now;
  });

  document.addEventListener('visibilitychange', syncUI);

  new ResizeObserver(layout).observe(wrap);

  // Hauptschleife: Logik läuft auch im Hintergrund weiter (setInterval)
  let lastFrame = performance.now();
  function frame(now) {
    update(now);
    stepParticles(Math.min(0.05, (now - lastFrame) / 1000));
    lastFrame = now;
    draw();
    requestAnimationFrame(frame);
  }
  setInterval(() => update(performance.now()), 250);

  syncUI();
  loadHistory();
  requestAnimationFrame(frame);
})();
