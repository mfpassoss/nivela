/* Janela de vídeo: espelha os dois decks do Nivela numa tela só, com o mesmo crossfade do som.
   O som continua saindo pela janela principal; aqui é só imagem, para jogar na TV ou no projetor. */
(() => {
  const cv = document.getElementById('tela');
  const ctx = cv.getContext('2d', { alpha: false });
  const main = window.opener;
  let showInfo = true, lastDraw = 0;

  function resize() {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(innerWidth * r);
    cv.height = Math.round(innerHeight * r);
  }
  addEventListener('resize', resize); resize();

  // barra de botões some sozinha, como em player de vídeo
  let hideTimer;
  function poke() {
    document.body.classList.add('show-cursor');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => document.body.classList.remove('show-cursor'), 2500);
  }
  addEventListener('mousemove', poke); poke();

  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
  document.getElementById('btnFull').addEventListener('click', full);
  document.getElementById('btnInfo').addEventListener('click', () => { showInfo = !showInfo; });
  addEventListener('dblclick', full);
  addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F' || e.key === 'F11') { e.preventDefault(); full(); }
    if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen();
    if (e.key === 'i' || e.key === 'I') showInfo = !showInfo;
    // espaço e setas continuam comandando o player da janela principal
    if (main && !main.closed && (e.code === 'Space' || e.code === 'ArrowRight')) {
      e.preventDefault();
      const b = main.document.querySelector(e.code === 'Space' ? '#btnPlay' : '#btnNext');
      b && b.click();
    }
  });

  /** desenha o quadro cobrindo a tela inteira, sem distorcer (corta o que sobra) */
  function cover(el, alpha) {
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return false;
    const W = cv.width, H = cv.height;
    const s = Math.max(W / vw, H / vh);
    const w = vw * s, h = vh * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
    ctx.globalAlpha = 1;
    return true;
  }

  let fundo = null, fundoW = 0, fundoH = 0;
  function pintarFundo() {
    const W = cv.width, H = cv.height;
    if (!fundo || fundoW !== W || fundoH !== H) {
      fundo = ctx.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, H * 1.6);
      fundo.addColorStop(0, '#2a2114'); fundo.addColorStop(0.6, '#14120f'); fundo.addColorStop(1, '#000');
      fundoW = W; fundoH = H;
    }
    ctx.fillStyle = fundo; ctx.fillRect(0, 0, W, H);
  }

  /** cartão de "tocando agora", para a tela não ficar preta quando a faixa é só música.
      Vai embaixo do vídeo e some conforme um clipe entra, para não vazar por trás da imagem. */
  function card(P, alpha) {
    const d = P.current();
    const t = d && d.track;
    if (!t || alpha <= 0.01) return;
    const W = cv.width, H = cv.height, u = H / 100;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb02e';
    ctx.font = `700 ${u * 4}px "Big Shoulders Display", sans-serif`;
    ctx.fillText('TOCANDO AGORA', W / 2, H / 2 - u * 16);
    ctx.fillStyle = '#f1e9dc';
    ctx.font = `700 ${u * 13}px "Big Shoulders Display", sans-serif`;
    ctx.fillText((t.title || '').toUpperCase().slice(0, 42), W / 2, H / 2);
    ctx.fillStyle = '#a89f90';
    ctx.font = `500 ${u * 5}px "Instrument Sans", sans-serif`;
    ctx.fillText((t.artist || '').slice(0, 48), W / 2, H / 2 + u * 9);
    ctx.globalAlpha = 1;
  }

  function info(P, alpha) {
    const d = P.current(); const t = d && d.track;
    if (!showInfo || !t || alpha <= 0.02) return;
    const W = cv.width, H = cv.height, u = H / 100;
    ctx.globalAlpha = alpha;
    const grd = ctx.createLinearGradient(0, H - u * 22, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = grd; ctx.fillRect(0, H - u * 22, W, u * 22);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${u * 7}px "Big Shoulders Display", sans-serif`;
    ctx.fillText((t.title || '').toUpperCase().slice(0, 46), u * 5, H - u * 9);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = `500 ${u * 3.6}px "Instrument Sans", sans-serif`;
    ctx.fillText((t.artist || '').slice(0, 52), u * 5, H - u * 4);
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastDraw < 1000 / 60) return;
    lastDraw = now;
    if (!main || main.closed || !main.Player) { document.body.classList.add('lost'); return; }
    document.body.classList.remove('lost');
    const P = main.Player;
    // o deck que está saindo vai primeiro e o que entra por cima: a imagem cruza junto com o som
    const ordered = P.decks.slice().sort((a, b) => a.fade.gain.value - b.fade.gain.value);
    const ativos = ordered.filter(d => d.state !== 'idle' && d.fade.gain.value > 0.004);
    // quanto de imagem vai aparecer neste quadro: o cartão de texto some na mesma medida
    let visivel = 0;
    for (const d of ativos) if (d.media.videoWidth > 0) visivel = Math.max(visivel, Math.min(1, d.fade.gain.value));
    pintarFundo();
    card(P, Math.max(0, 1 - visivel * 2));  // o texto sai antes do meio da emenda, para não vazar sobre a imagem
    for (const d of ativos) cover(d.media, Math.min(1, d.fade.gain.value));
    info(P, visivel);
  }
  requestAnimationFrame(frame);

  addEventListener('beforeunload', () => { try { main && !main.closed && main.postMessage({ nivela: 'tela-fechada' }, '*'); } catch (e) {} });
  try { main && !main.closed && main.postMessage({ nivela: 'tela-aberta' }, '*'); } catch (e) {}
})();
