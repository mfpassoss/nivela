/* Motor de reprodução: 2 decks (elemento <video> → ganho de nivelamento → fade → master → limitador → saída).
   Serve tanto para música quanto para clipe: o elemento é sempre <video>, e uma faixa só de áudio
   simplesmente não tem imagem. O crossfade acontece entre os decks, tanto no som quanto na imagem;
   o ganho por faixa vem da medição de loudness. */
const Player = (() => {
  let ctx = null, master, limiter, analyser, levelBuf;
  const decks = [];
  let active = -1;
  const handlers = {};
  const settings = { target: -14, crossfade: 6, crossfadeManual: 3, automix: true, normalize: true, volume: 0.85 };
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
      const media = document.createElement('video');
      media.preload = 'auto'; media.playsInline = true; media.disablePictureInPicture = true;
      media.setAttribute('playsinline', ''); media.crossOrigin = 'anonymous';
      const src = ctx.createMediaElementSource(media);
      const trim = ctx.createGain(); const fade = ctx.createGain(); fade.gain.value = 0;
      src.connect(trim); trim.connect(fade); fade.connect(master);
      const d = { i, media, trim, fade, track: null, url: null, state: 'idle', transitioning: false };
      media.addEventListener('timeupdate', () => onTime(d));
      media.addEventListener('ended', () => onEnded(d));
      media.addEventListener('error', () => { if (d.state !== 'idle') { d.state = 'error'; emit('deck', d); emit('error', d); } });
      media.addEventListener('pause', () => emit('deck', d));
      media.addEventListener('play', () => emit('deck', d));
      media.addEventListener('loadedmetadata', () => emit('deck', d));
      decks.push(d);
    }
  }

  function onTime(d) {
    emit('progress', d);
    if (d.i !== active || d.state !== 'playing' || d.transitioning) return;
    const dur = d.media.duration;
    if (!settings.automix || !isFinite(dur) || dur <= 0) return;
    const remain = dur - d.media.currentTime;
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
    d.media.pause();
    d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
    d.state = 'idle'; d.transitioning = false; d.track = null;
    if (d.url) { URL.revokeObjectURL(d.url); d.url = null; }
    d.media.removeAttribute('src'); d.media.load();
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
  /** qual deck está livre para receber a próxima faixa */
  function freeDeck() {
    ensureCtx();
    const out = active >= 0 ? decks[active] : null;
    return decks[(out ? out.i + 1 : 0) % 2];
  }

  /**
   * Carrega a faixa no deck livre e deixa ela parada, esperando a vez.
   * É o que aparece na mesa como "na espera": já dá para ver capa, tempo e forma de onda
   * antes de entrar no ar. Não toca nada.
   */
  function cue(track) {
    if (!track || !track.file) return null;
    ensureCtx();
    const d = freeDeck();
    if (d.state === 'playing' || d.state === 'fading') return null;   // deck ocupado: não mexe
    if (d.track && d.track.id === track.id && d.state === 'cued') return d;
    if (d.state !== 'idle') stopDeck(d);
    d.track = track; d.state = 'cued'; d.transitioning = false;
    d.url = URL.createObjectURL(track.file);
    d.media.src = d.url;
    d.media.load();
    d.trim.gain.value = dbToLin(gainDb(track));
    d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
    emit('deck', d);
    return d;
  }

  /** tira a faixa que estava esperando, sem tocar no que está no ar */
  function uncue() {
    const d = freeDeck();
    if (d && d.state === 'cued') stopDeck(d);
  }

  /** a faixa que está esperando a vez, se houver */
  function cued() { const d = decks.length ? freeDeck() : null; return d && d.state === 'cued' ? d : null; }

  /**
   * @param {object} track
   * @param {{fade?:number}} [opts] fade: tempo da passagem em segundos; sem isso usa o do automix
   */
  async function play(track, opts = {}) {
    ensureCtx();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    const token = ++playToken;
    const out = active >= 0 ? decks[active] : null;
    const d = decks[(out ? out.i + 1 : 0) % 2];
    // se a faixa já estava esperando neste deck, aproveita o que foi carregado
    const jaCarregada = d.state === 'cued' && d.track && d.track.id === track.id;
    if (!jaCarregada) {
      // troca a fonte direto. Chamar load() aqui cancelaria o play() logo abaixo
      // e a faixa não entrava (erro "interrupted by a new load request").
      if (d.state !== 'idle') {
        d.media.pause();
        if (d.url) { URL.revokeObjectURL(d.url); d.url = null; }
        d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
      }
      d.track = track; d.url = URL.createObjectURL(track.file);
      d.media.src = d.url;
    }
    d.state = 'loading'; d.transitioning = false;
    d.trim.gain.value = dbToLin(gainDb(track));
    d.fade.gain.cancelScheduledValues(ctx.currentTime); d.fade.gain.value = 0;
    if (jaCarregada) { try { d.media.currentTime = 0; } catch (e) {} }
    emit('deck', d);
    try { await d.media.play(); }
    catch (e) {
      if (token !== playToken) return false;
      // uma troca rápida pode abortar o primeiro play; tenta de novo antes de desistir
      if (e && e.name === 'AbortError') {
        try { await d.media.play(); }
        catch (e2) { d.state = 'error'; emit('deck', d); emit('error', d, e2); return false; }
      } else { d.state = 'error'; emit('deck', d); emit('error', d, e); return false; }
    }
    if (token !== playToken) return false;
    d.state = 'playing'; active = d.i;
    const padrao = opts.fade != null ? opts.fade : settings.crossfade;
    const cf = out && out.state === 'playing' && !out.media.paused ? padrao : 0;
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

  /** true quando o deck tem imagem para mostrar (clipe), false para faixa só de som. */
  const hasPicture = d => !!(d && d.media && d.media.videoWidth > 0 && d.state !== 'idle');
  function current() { return active >= 0 ? decks[active] : null; }
  function isPlaying() { const d = current(); return !!d && d.state === 'playing' && !d.media.paused; }
  function toggle() {
    const d = current(); if (!d) return false;
    if (d.media.paused) { ctx.resume(); d.media.play(); decks.forEach(x => x.state === 'fading' && x.media.play()); return true; }
    decks.forEach(x => x.state !== 'idle' && x.media.pause()); return false;
  }
  function stop() { decks.forEach(stopDeck); active = -1; emit('stopped'); }
  function seek(frac) { const d = current(); if (!d || !isFinite(d.media.duration)) return; d.media.currentTime = frac * d.media.duration; }
  function position() { const d = current(); return d ? d.media.currentTime : 0; }

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

  return { on, play, cue, uncue, cued, toggle, stop, seek, position, set, settings, gainDb, current, isPlaying, level, decks, hasPicture };
})();

// a janela de vídeo (tela.html) lê o motor por aqui
window.Player = Player;
