/* Análise de áudio: loudness integrado (ITU-R BS.1770-4), pico, forma de onda e BPM.
   Roda no thread principal em fatias, cedendo o controle entre elas para a interface não travar. */
const Analyzer = (() => {
  const WAVE_POINTS = 480;
  let offline = null;
  const yieldNow = () => new Promise(r => setTimeout(r, 0));

  function biquadCoefs(type, fs, f0, Q, gainDb) {
    const w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'highshelf') {
      const A = Math.pow(10, gainDb / 40), sA = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cw + sA); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sA);
      a0 = (A + 1) - (A - 1) * cw + sA; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sA;
    } else { // highpass
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }

  // Filtro K (pré-ênfase + RLB) da norma; coeficientes recalculados para a taxa de amostragem real.
  function kWeight(fs) {
    return [biquadCoefs('highshelf', fs, 1681.974450955533, 0.7071752369554196, 3.999843853973347),
            biquadCoefs('highpass', fs, 38.13547087602444, 0.5003270373238773, 0)];
  }

  async function analyzeBuffer(buf) {
    const fs = buf.sampleRate, N = buf.length, ch = Math.min(buf.numberOfChannels, 2);
    const hop = Math.round(fs * 0.1);              // 100 ms
    const nHops = Math.max(1, Math.floor(N / hop));
    const hopSum = new Float64Array(nHops);        // soma dos quadrados (após filtro K) por 100 ms, somando canais
    const wave = new Float32Array(WAVE_POINTS);
    const wavePer = N / WAVE_POINTS;
    let peak = 0;
    const CHUNK = 1 << 18;

    // envelope de energia para BPM (mono, quadros de ~11,6 ms)
    const FR = 512;
    const nFrames = Math.floor(N / FR);
    const frameE = new Float32Array(nFrames);

    for (let c = 0; c < ch; c++) {
      const data = buf.getChannelData(c);
      const [f1, f2] = kWeight(fs);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0;
      for (let start = 0; start < N; start += CHUNK) {
        const end = Math.min(N, start + CHUNK);
        for (let i = start; i < end; i++) {
          const x = data[i];
          const ax = x < 0 ? -x : x;
          if (ax > peak) peak = ax;
          const w = (i / wavePer) | 0;
          if (ax > wave[w]) wave[w] = ax;
          const fi = (i / FR) | 0;
          if (fi < nFrames) frameE[fi] += x * x;
          // biquad 1 (shelf)
          const y = f1.b0 * x + f1.b1 * x1 + f1.b2 * x2 - f1.a1 * y1 - f1.a2 * y2;
          x2 = x1; x1 = x; y2 = y1; y1 = y;
          // biquad 2 (highpass)
          const v = f2.b0 * y + f2.b1 * u1 + f2.b2 * u2 - f2.a1 * v1 - f2.a2 * v2;
          u2 = u1; u1 = y; v2 = v1; v1 = v;
          const h = (i / hop) | 0;
          if (h < nHops) hopSum[h] += v * v;
        }
        await yieldNow();
      }
    }

    // blocos de 400 ms (4 hops) com 75% de sobreposição
    const nBlocks = Math.max(1, nHops - 3);
    const blockLoud = new Float64Array(nBlocks);
    const blockPow = new Float64Array(nBlocks);
    for (let j = 0; j < nBlocks; j++) {
      const s = (hopSum[j] + hopSum[j + 1] + hopSum[j + 2] + hopSum[j + 3]) / (4 * hop);
      blockPow[j] = s;
      blockLoud[j] = -0.691 + 10 * Math.log10(s + 1e-20);
    }
    // gating: absoluto (-70 LUFS), depois relativo (-10 LU)
    let sum = 0, n = 0;
    for (let j = 0; j < nBlocks; j++) if (blockLoud[j] > -70) { sum += blockPow[j]; n++; }
    let loudness = -70;
    if (n) {
      const rel = -0.691 + 10 * Math.log10(sum / n) - 10;
      sum = 0; n = 0;
      for (let j = 0; j < nBlocks; j++) if (blockLoud[j] > -70 && blockLoud[j] > rel) { sum += blockPow[j]; n++; }
      if (n) loudness = -0.691 + 10 * Math.log10(sum / n);
    }

    const bpm = estimateBpm(frameE, fs / FR);
    const waveU8 = new Uint8Array(WAVE_POINTS);
    const wmax = Math.max(1e-6, ...wave);
    for (let i = 0; i < WAVE_POINTS; i++) waveU8[i] = Math.round(Math.pow(wave[i] / wmax, 0.7) * 255);

    return { loudness, peak, bpm, duration: buf.duration, wave: waveU8 };
  }

  // BPM por autocorrelação do envelope de "onsets" (diferença positiva da energia em log).
  function estimateBpm(frameE, frameRate) {
    const n = frameE.length;
    if (n < frameRate * 20) return null;
    const onset = new Float32Array(n);
    let prev = Math.log(frameE[0] + 1e-9);
    for (let i = 1; i < n; i++) {
      const cur = Math.log(frameE[i] + 1e-9);
      onset[i] = Math.max(0, cur - prev);
      prev = cur;
    }
    // remove média local (deixa só os "ataques")
    const win = Math.round(frameRate * 0.5);
    let acc = 0;
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) { acc += onset[i]; if (i >= win) acc -= onset[i - win]; sm[i] = Math.max(0, onset[i] - acc / win); }
    const minLag = Math.round(frameRate * 60 / 200), maxLag = Math.round(frameRate * 60 / 60);
    const ac = new Float64Array(maxLag + 1);
    let e0 = 0; for (let i = 0; i < n; i++) e0 += sm[i] * sm[i];
    if (e0 <= 0) return null;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = lag; i < n; i++) s += sm[i] * sm[i - lag];
      ac[lag] = s / e0;
    }
    // pontua cada BPM candidato com seus múltiplos (favorece o pulso "real" e não o dobro/metade)
    let best = null, bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = 60 * frameRate / lag;
      let score = ac[lag];
      const l2 = lag * 2; if (l2 <= maxLag) score += 0.5 * ac[l2];
      const lh = Math.round(lag / 2); if (lh >= minLag) score += 0.25 * ac[lh];
      // leve preferência pela faixa mais comum em música popular (80–140)
      if (bpm >= 80 && bpm <= 140) score *= 1.1;
      if (score > bestScore) { bestScore = score; best = lag; }
    }
    if (best == null) return null;
    // refina com interpolação parabólica do pico
    let lag = best;
    if (best > minLag && best < maxLag) {
      const a = ac[best - 1], b = ac[best], c = ac[best + 1];
      const d = (a - c) / (2 * (a - 2 * b + c) || 1);
      if (Math.abs(d) < 1) lag = best + d;
    }
    return Math.round(60 * frameRate / lag);
  }

  async function decode(file) {
    const ab = await file.arrayBuffer();
    if (!offline) offline = new OfflineAudioContext(2, 44100, 44100);
    return offline.decodeAudioData(ab);
  }

  /** Analisa um File. Retorna { loudness, peak, bpm, duration, wave }. Lança se o áudio não puder ser decodificado. */
  async function analyze(file) {
    const buf = await decode(file);
    return analyzeBuffer(buf);
  }

  return { analyze, WAVE_POINTS };
})();
