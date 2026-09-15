/* Motor de reprodução: 2 decks (elemento <audio> → ganho de nivelamento → fade → master → limitador → saída).
   O crossfade acontece entre os decks; o ganho por faixa vem da medição de loudness. */
const Player = (() => {
  let ctx = null, master, limiter, analyser, levelBuf;
  const decks = [];
  let active = -1;
  const handlers = {};
  const settings = { target: -14, crossfade: 6, automix: true, normalize: true, volume: 0.85 };
  let playToken = 0;

  const on = (ev, fn) => ((handlers[ev] = handlers[ev] || []).push(fn));
  const emit = (ev, ...a) => (handlers[ev] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } });
  const dbToLin = db => Math.pow(10, db / 20);

  /** Ganho (dB) que leva a faixa ao alvo, com teto pelo pico para não estourar mais do que o limitador segura. */
  function gainDb(track) {
    if (!settings.normalize || track == null || track.loudness == null || track.loudness <= -69) return 0;
    let g = settings.target - track.loudness;
    if (track.peak > 0) {
      const headroom = -1 - 20 * Math.log10(track.peak); // até -1 dBFS sem tocar no limitador
      g = Math.min(g, headroom + 6);                      // permite até 6 dB de limitação
    }
    return Math.max(-24, Math.min(20, g));
  }

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = settings.volume;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.15;
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
    levelBuf = new Float32Array(analyser.fftSize);
    master.connect(limiter); limiter.connect(analyser); analyser.connect(ctx.destination);
    for (let i = 0; i < 2; i++) {
      const audio = new Audio(); audio.preload = 'auto';
      const src = ctx.createMediaElementSource(audio);
      const trim = ctx.createGain(); const fade = ctx.createGain(); fade.gain.value = 0;
      src.connect(trim); trim.connect(fade); fade.connect(master);
      const d = { i, audio, trim, fade, track: null, url: null, state: 'idle', transitioning: false };
      audio.addEventListener('timeupdate', () => onTime(d));
      audio.addEventListener('ended', () => onEnded(d));
      audio.addEventListener('error', () => { if (d.state !== 'idle') { d.state = 'error'; emit('deck', d); emit('error', d); } });
      audio.addEventListener('pause', () => emit('deck', d));
      audio.addEventListener('play', () => emit('deck', d));
      decks.push(d);
    }
  }

  function onTime(d) {
    emit('progress', d);
    if (d.i !== active || d.state !== 'playing' || d.transitioning) return;
    const dur = d.audio.duration;
    if (!settings.automix || !isFinite(dur) || dur <= 0) return;
    const remain = dur - d.audio.currentTime;
    const lead = settings.crossfade > 0 ? settings.crossfade + 0.3 : 0.05;
    if (remain <= lead) { d.transitioning = true; emit('needNext', d); }
  }

  function onEnded(d) {
    if (d.i === active) {
      if (d.transitioning) return; // já emendou
      if (settings.automix) { d.transitioning = true; emit('needNext', d); }
      else { stopDeck(d); active = -1; emit('stopped'); }
    } else stopDeck(d);
  }

  function stopDeck(d) {
    d.audio.pause();
    d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
    d.state = 'idle'; d.transitioning = false; d.track = null;
    if (d.url) { URL.revokeObjectURL(d.url); d.url = null; }
    d.audio.removeAttribute('src'); d.audio.load();
    emit('deck', d);
  }

  function ramp(param, to, secs) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    if (secs <= 0.02) { param.setValueAtTime(to, t); return; }
    // curva de potência constante (soa uniforme durante a mistura)
    const from = param.value, N = 32, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = i / (N - 1); curve[i] = from + (to - from) * Math.sin(x * Math.PI / 2) ** (to > from ? 1 : 2); }
    param.setValueCurveAtTime(curve, t, secs);
  }

  /** Toca a faixa agora: entra no deck livre com crossfade sobre o deck ativo. */
  async function play(track) {
    ensureCtx();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    const token = ++playToken;
    const out = active >= 0 ? decks[active] : null;
    const d = decks[(out ? out.i + 1 : 0) % 2];
    if (d.state !== 'idle') stopDeck(d);
    d.track = track; d.state = 'loading'; d.transitioning = false;
    d.url = URL.createObjectURL(track.file);
    d.audio.src = d.url;
    d.trim.gain.value = dbToLin(gainDb(track));
    d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
    emit('deck', d);
    try { await d.audio.play(); } catch (e) { if (token === playToken) { d.state = 'error'; emit('deck', d); emit('error', d, e); } return false; }
    if (token !== playToken) return false;
    d.state = 'playing'; active = d.i;
    const cf = out && out.state === 'playing' && !out.audio.paused ? settings.crossfade : 0;
    ramp(d.fade.gain, 1, cf);
    if (out) {
      if (cf > 0) {
        ramp(out.fade.gain, 0, cf);
        out.state = 'fading'; emit('deck', out);
        const o = out; setTimeout(() => { if (o.state === 'fading') stopDeck(o); }, cf * 1000 + 100);
      } else stopDeck(out);
    }
    emit('deck', d); emit('started', d);
    return true;
  }

  function current() { return active >= 0 ? decks[active] : null; }
  function isPlaying() { const d = current(); return !!d && d.state === 'playing' && !d.audio.paused; }
  function toggle() {
    const d = current(); if (!d) return false;
    if (d.audio.paused) { ctx.resume(); d.audio.play(); decks.forEach(x => x.state === 'fading' && x.audio.play()); return true; }
    decks.forEach(x => x.state !== 'idle' && x.audio.pause()); return false;
  }
  function stop() { decks.forEach(stopDeck); active = -1; emit('stopped'); }
  function seek(frac) { const d = current(); if (!d || !isFinite(d.audio.duration)) return; d.audio.currentTime = frac * d.audio.duration; }
  function position() { const d = current(); return d ? d.audio.currentTime : 0; }

  function set(key, val) {
    settings[key] = val;
    if (!ctx) return;
    if (key === 'volume') master.gain.setTargetAtTime(val, ctx.currentTime, 0.02);
    if (key === 'target' || key === 'normalize') decks.forEach(d => { if (d.track) d.trim.gain.setTargetAtTime(dbToLin(gainDb(d.track)), ctx.currentTime, 0.05); });
  }

  /** Nível de saída em dBFS: { rms, peak }. */
  function level() {
    if (!analyser) return { rms: -90, peak: -90 };
    analyser.getFloatTimeDomainData(levelBuf);
    let s = 0, p = 0;
    for (let i = 0; i < levelBuf.length; i++) { const v = levelBuf[i]; s += v * v; const a = v < 0 ? -v : v; if (a > p) p = a; }
    const rms = Math.sqrt(s / levelBuf.length);
    return { rms: 20 * Math.log10(rms + 1e-9), peak: 20 * Math.log10(p + 1e-9), reduction: limiter.reduction || 0 };
  }

  return { on, play, toggle, stop, seek, position, set, settings, gainDb, current, isPlaying, level, decks };
})();
