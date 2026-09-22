/* Interface e estado: biblioteca, análise em fila, estilos, playlists e reprodução. */
(() => {
  const $ = s => document.querySelector(s);
  const el = {
    status: $('#status'), statusText: $('#statusText'), libBody: $('#libBody'), libEmpty: $('#libEmpty'), libCount: $('#libCount'),
    styles: $('#styles'), playlists: $('#playlists'), plDetail: $('#playlistDetail'), plName: $('#plName'), plTracks: $('#plTracks'),
    search: $('#search'), filterStyle: $('#filterStyle'), filterTipo: $('#filterTipo'), nextUp: $('#nextUp'), toast: $('#toast'), btnPlay: $('#btnPlay'), vu: $('#vu'),
    tableWrap: $('.table-wrap'), libMore: $('#libMore'),
  };
  const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|wma|aif|aiff)$/i;
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp|ts)$/i;
  const MEDIA_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|wma|aif|aiff|mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp|ts)$/i;
  const ZIP_RE = /\.zip$/i;
  // pergunta ao próprio programa o que ele sabe tocar, em vez de chutar por extensão
  const TIPOS = { mp4: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', m4v: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    webm: 'video/webm; codecs="vp8, vorbis"', mov: 'video/quicktime', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', mpg: 'video/mpeg', mpeg: 'video/mpeg', '3gp': 'video/3gpp', ts: 'video/mp2t' };
  const provador = document.createElement('video');
  const suporteCache = new Map();
  function formatoSuportado(nome) {
    const ext = (nome.split('.').pop() || '').toLowerCase();
    if (!TIPOS[ext]) return true;                       // áudio: deixa a análise decidir
    if (!suporteCache.has(ext)) suporteCache.set(ext, !!provador.canPlayType(TIPOS[ext]));
    return suporteCache.get(ext);
  }
  const IMPORT_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|wma|aif|aiff|mp4|m4v|mov|webm|mkv|avi|wmv|mpg|mpeg|3gp|ts|zip)$/i;

  const state = {
    tracks: new Map(), order: [], playlists: [], selectedStyles: new Set(), currentPlaylist: null,
    queue: [], pos: -1, mode: null, source: null, roots: [], fileHandles: [], rows: new Map(), zips: new Map(), tipo: '',
    visible: [], shown: 0, dupes: new Set(), onlyDupes: false,
  };

  /* ---------------- utilidades ---------------- */
  const fmtTime = s => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let toastTimer;
  function toast(msg, ms = 2600) { el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms); }
  const styleOf = t => t.styleManual || t.style || 'outros';
  const styleLabel = id => (Genres.byId[id] || Genres.byId.outros).label;
  const styleColor = id => (Genres.byId[id] || Genres.byId.outros).color;
  const trackId = f => `${f.size}-${f.lastModified}-${f.name}`;
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // embaralha evitando o mesmo artista duas vezes seguidas quando possível
  function smartShuffle(ids) {
    const a = shuffle(ids);
    for (let i = 1; i < a.length; i++) {
      const prev = state.tracks.get(a[i - 1]), cur = state.tracks.get(a[i]);
      if (!prev || !cur || !prev.artist || Genres.norm(prev.artist) !== Genres.norm(cur.artist)) continue;
      for (let j = i + 1; j < a.length; j++) {
        const cand = state.tracks.get(a[j]);
        if (cand && Genres.norm(cand.artist) !== Genres.norm(prev.artist)) { [a[i], a[j]] = [a[j], a[i]]; break; }
      }
    }
    return a;
  }
  // a faixa está tocável se o arquivo está em mãos ou se o zip de origem está disponível
  const available = t => !!(t.file || (t.zip && state.zips.has(t.zip.key)));
  const tocavel = t => available(t) && t.status !== 'error' && t.status !== 'unsupported';
  // o que pode entrar no aleatório: precisa tocar e bater com o filtro de música/clipe
  const sorteavel = t => tocavel(t) && tipoOk(t);

  function persist(t) {
    const { file, cover, _q, _qs, ...rest } = t;
    return DB.put('tracks', rest).catch(e => console.warn('persist', e));
  }
  function setStatus(text, cls) { el.statusText.textContent = text; el.status.className = 'status ' + (cls || ''); }

  /* ---------------- importação ---------------- */
  async function walkHandle(handle, prefix, out) {
    if (handle.kind === 'file') {
      if (IMPORT_RE.test(handle.name)) { const file = await handle.getFile(); out.push({ file, path: prefix + handle.name }); }
      return;
    }
    for await (const [name, child] of handle.entries()) {
      if (name.startsWith('.')) continue;
      await walkHandle(child, prefix + handle.name + '/', out);
    }
  }
  function walkEntry(entry, prefix, out) {
    return new Promise(resolve => {
      if (entry.isFile) {
        if (!IMPORT_RE.test(entry.name)) return resolve();
        entry.file(file => { out.push({ file, path: prefix + entry.name }); resolve(); }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = entry.createReader(); const all = [];
        const readMore = () => reader.readEntries(async ents => {
          if (!ents.length) { for (const e of all) await walkEntry(e, prefix + entry.name + '/', out); return resolve(); }
          all.push(...ents); readMore();
        }, () => resolve());
        readMore();
      } else resolve();
    });
  }

  const zipKey = f => `${f.size}-${f.lastModified}-${f.name}`;

  /**
   * Troca cada .zip da lista pelas músicas que estão dentro dele.
   * Só descompacta o que ainda não foi analisado: uma música já conhecida fica marcada
   * para ser extraída na hora de tocar, então reabrir o programa com muitos CDs é rápido.
   */
  async function expandZips(entries) {
    const out = [];
    const zips = entries.filter(e => ZIP_RE.test(e.file.name));
    if (!zips.length) return entries;
    let n = 0;
    for (const { file, path } of entries) {
      if (!ZIP_RE.test(file.name)) { out.push({ file, path }); continue; }
      const key = zipKey(file);
      state.zips.set(key, file);
      setStatus(`Abrindo CD ${++n} de ${zips.length}: ${file.name}`, 'busy');
      let list;
      try { list = await Zip.listEntries(file); }
      catch (e) { console.warn('zip', file.name, e); toast(`Não consegui abrir "${file.name}": ${e.message}`, 4000); continue; }
      for (const entry of list) {
        if (entry.name.endsWith('/') || !MEDIA_RE.test(entry.name)) continue;
        const base = entry.name.split('/').pop();
        const id = `${entry.rawSize}-${Zip.entryDate(entry)}-${base}`;
        const inner = `${file.name}/${entry.name}`;
        const known = state.tracks.get(id);
        if (known && known.status === 'ok') {
          // já medida: guarda só a referência e extrai quando for tocar
          known.zip = { key, entry }; known.path = known.path || inner;
          persist(known);
          continue;
        }
        try {
          const blob = await Zip.extract(file, entry);
          const f = new File([blob], base, { type: 'audio/mpeg', lastModified: Zip.entryDate(entry) });
          out.push({ file: f, path: inner, zip: { key, entry } });
        } catch (e) { console.warn('extrair', entry.name, e); }
        await new Promise(r => setTimeout(r, 0));
      }
    }
    return out;
  }

  /** Garante que a faixa tem arquivo em mãos, extraindo do zip se for o caso. */
  async function ensureFile(t) {
    if (!t || t.file) return !!(t && t.file);
    if (!t.zip) return false;
    const zf = state.zips.get(t.zip.key);
    if (!zf) return false;
    try {
      const blob = await Zip.extract(zf, t.zip.entry);
      t.file = new File([blob], t.name, { type: 'audio/mpeg', lastModified: t.lastModified });
      return true;
    } catch (e) { console.warn('extrair na hora de tocar', t.name, e); return false; }
  }

  async function addEntries(entries, { announce = true } = {}) {
    entries = await expandZips(entries);
    let added = 0, known = 0;
    const fresh = [];
    for (const e of entries) {
      const { file, path } = e;
      const id = trackId(file);
      const existing = state.tracks.get(id);
      if (existing) { existing.file = file; if (e.zip) existing.zip = e.zip; if (!existing.path) existing.path = path; known++; if (existing.status !== 'ok') queueAnalysis(id); continue; }
      const ehVideo = VIDEO_RE.test(file.name);
      const t = { id, name: file.name, path, size: file.size, lastModified: file.lastModified, file, zip: e.zip || null, video: ehVideo, semSuporte: ehVideo && !formatoSuportado(file.name), title: null, artist: null, album: null,
        genreTag: null, style: null, styleManual: null, reason: '', bpm: null, loudness: null, peak: null, wave: null, duration: null, status: 'new', added: Date.now() };
      state.tracks.set(id, t); fresh.push(t); added++;
    }
    if (fresh.length) {
      setStatus(`Lendo tags de ${fresh.length} músicas…`, 'busy');
      let i = 0;
      for (const t of fresh) {
        const tags = await Tags.read(t.file);
        const fn = Tags.fromFilename(t.name);
        t.title = tags.title || fn.title || t.name; t.artist = tags.artist || fn.artist || ''; t.album = tags.album || ''; t.genreTag = tags.genre || null;
        const c = Genres.classify(t); t.style = c.style; t.reason = c.reason;
        if (t.semSuporte) { t.status = 'unsupported'; persist(t); }
        else { persist(t); queueAnalysis(t.id); }
        if (++i % 25 === 0) { rebuildOrder(); renderLibrary(); renderStyles(); await new Promise(r => setTimeout(r, 0)); }
      }
    }
    findDupes(); rebuildOrder(); renderLibrary(); renderStyles(); updateStatus();
    const semSuporte = [...state.tracks.values()].filter(t => t.status === 'unsupported').length;
    if (announce) toast(added ? `${added} faixas adicionadas${known ? ` (${known} já estavam)` : ''}${semSuporte ? ` · ${semSuporte} em formato não suportado` : ''}` : (known ? 'Essas faixas já estão na biblioteca' : 'Nenhuma música ou clipe encontrado'), semSuporte ? 5000 : 2600);
  }

  async function addDirectoryHandle(handle, remember = true) {
    const out = [];
    await walkHandle(handle, '', out);
    if (remember && !state.roots.some(r => r.name === handle.name)) {
      state.roots.push(handle); await DB.put('settings', state.roots, 'roots').catch(() => {});
    }
    await addEntries(out);
  }

  async function pickFolder() {
    if (window.showDirectoryPicker) {
      try { const h = await window.showDirectoryPicker({ mode: 'read' }); await addDirectoryHandle(h); } catch (e) { if (e.name !== 'AbortError') toast('Não deu para abrir a pasta: ' + e.message); }
    } else $('#inpFolder').click();
  }
  async function pickFiles() {
    if (window.showOpenFilePicker) {
      try {
        const hs = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Músicas e CDs (zip)', accept: { 'audio/*': ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'], 'application/zip': ['.zip'] } }] });
        const out = [];
        for (const h of hs) { out.push({ file: await h.getFile(), path: h.name }); if (!state.fileHandles.some(x => x.name === h.name)) state.fileHandles.push(h); }
        DB.put('settings', state.fileHandles, 'fileHandles').catch(() => {});
        await addEntries(out);
      } catch (e) { if (e.name !== 'AbortError') toast('Não deu para abrir: ' + e.message); }
    } else $('#inpFiles').click();
  }
  /**
   * Reabre as pastas guardadas e traz arquivos novos que apareceram nelas.
   * Em modo silencioso só usa pastas cuja permissão já está concedida (não abre caixa de diálogo),
   * que é o caso da abertura do programa e do botão Reescanear.
   */
  async function reconnect({ silent = false } = {}) {
    const entries = [];
    let denied = 0, scanned = 0;
    const before = state.tracks.size;
    const grant = async h => {
      if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
      if (silent) return false;
      return (await h.requestPermission({ mode: 'read' })) === 'granted';
    };
    setStatus('Procurando músicas nas pastas…', 'busy');
    for (const h of state.roots) {
      try { if (await grant(h)) { await walkHandle(h, '', entries); scanned++; } else denied++; }
      catch (e) { denied++; }
    }
    for (const h of state.fileHandles) {
      try { if (await grant(h)) { entries.push({ file: await h.getFile(), path: h.name }); scanned++; } else denied++; }
      catch (e) { denied++; }
    }
    await addEntries(entries, { announce: false });
    const added = state.tracks.size - before;
    const missing = [...state.tracks.values()].filter(t => !available(t)).length;
    $('#btnReconnect').classList.toggle('hidden', denied === 0);
    if (silent && !scanned) return { scanned, added, denied };
    toast(added ? `${added} músicas novas encontradas` :
      `Nada novo nas pastas${denied ? ` · ${denied} sem permissão, clique em Reconectar` : ''}${missing ? ` · ${missing} sem arquivo` : ''}`);
    return { scanned, added, denied };
  }

  /* ---------------- análise em fila ---------------- */
  const aq = []; const inflight = new Map(); let running = false;
  function queueAnalysis(id) { if (!aq.includes(id) && !inflight.has(id)) { aq.push(id); runQueue(); } }
  async function runQueue() {
    if (running) return; running = true;
    while (aq.length) { const id = aq.shift(); await analyzeOne(id); updateStatus(); }
    running = false; updateStatus();
  }
  function analyzeOne(id) {
    if (inflight.has(id)) return inflight.get(id);
    const t = state.tracks.get(id);
    if (!t || t.status === 'ok' || t.status === 'unsupported') return Promise.resolve();
    if (!t.file && !t.zip) return Promise.resolve();
    const p = (async () => {
      t.status = 'analyzing'; renderRow(t);
      try {
        if (!t.file && !(await ensureFile(t))) { t.status = 'new'; renderRow(t); return; }
        const r = await Analyzer.analyze(t.file);
        Object.assign(t, r, { status: 'ok' });
        const c = Genres.classify(t); t.style = c.style; t.reason = c.reason;
        const d = Player.decks.find(x => x.track && x.track.id === id);
        if (d) Player.set('normalize', Player.settings.normalize);
      } catch (e) { console.warn('análise falhou', t.name, e); t.status = 'error'; }
      await persist(t); renderRow(t); renderStyles();
      const cur = currentTrack(); if (cur && cur.id === id) renderDecks();
    })().finally(() => inflight.delete(id));
    inflight.set(id, p);
    return p;
  }
  function ensureAnalyzed(id) {
    const t = state.tracks.get(id);
    if (!t || t.status === 'ok' || t.status === 'error') return Promise.resolve();
    const i = aq.indexOf(id); if (i >= 0) aq.splice(i, 1);
    return analyzeOne(id);
  }
  function updateStatus() {
    const total = state.tracks.size, pend = aq.length + inflight.size;
    const missing = [...state.tracks.values()].filter(t => !available(t)).length;
    if (!total) setStatus('Arraste músicas ou pastas para cá', '');
    else if (missing && !pend) setStatus(`${total} músicas lembradas · ${missing} sem arquivo: ${state.roots.length || state.fileHandles.length ? 'clique em "Reconectar biblioteca"' : 'adicione a pasta de novo'}`, '');
    else if (pend) setStatus(`${total} músicas · analisando volume (${pend} na fila)`, 'busy');
    else setStatus(`${total} músicas · tudo nivelado`, 'ok');
  }

  /* ---------------- biblioteca ---------------- */
  // mesma música vinda de fontes diferentes: agrupa por artista + título
  const dupeKey = t => Genres.norm((t.artist || '') + '|' + (t.title || ''));
  function findDupes() {
    const seen = new Map();
    state.dupes.clear();
    for (const t of state.tracks.values()) {
      const k = dupeKey(t);
      if (!k || k === '|') continue;
      if (seen.has(k)) { state.dupes.add(t.id); state.dupes.add(seen.get(k)); }
      else seen.set(k, t.id);
    }
    const btn = $('#btnDupes');
    btn.textContent = `⧉ Repetidas ${state.dupes.size}`;
    btn.classList.toggle('hidden', state.dupes.size === 0);
    if (!state.dupes.size && state.onlyDupes) { state.onlyDupes = false; btn.classList.remove('on'); }
  }

  function rebuildOrder() {
    state.order = [...state.tracks.values()].sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'pt') || (a.title || '').localeCompare(b.title || '', 'pt')).map(t => t.id);
  }
  // o texto de busca de cada faixa é calculado uma vez e reaproveitado (com milhares de músicas,
  // normalizar tudo a cada tecla digitada deixava a busca lenta)
  function searchText(t) {
    if (t._q === undefined || t._qs !== styleOf(t)) {
      t._qs = styleOf(t);
      t._q = Genres.norm([t.title, t.artist, t.album, styleLabel(t._qs), t.path, t.video ? 'clipe video' : ''].join(' '));
    }
    return t._q;
  }
  /** respeita a escolha entre música, clipe ou os dois */
  const tipoOk = t => !state.tipo || (state.tipo === 'clipe' ? !!t.video : !t.video);

  function visibleIds() {
    const q = Genres.norm(el.search.value), fs = el.filterStyle.value;
    return state.order.filter(id => {
      const t = state.tracks.get(id);
      if (!tipoOk(t)) return false;
      if (state.onlyDupes && !state.dupes.has(id)) return false;
      if (fs && styleOf(t) !== fs) return false;
      if (!q) return true;
      return searchText(t).includes(q);
    });
  }
  function styleOptions(sel) {
    return Genres.STYLES.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.label)}</option>`).join('');
  }
  function rowHtml(t) {
    const st = styleOf(t);
    const lufs = t.status === 'ok' ? (t.loudness > -69 ? t.loudness.toFixed(1) : 'sil.') :
      t.status === 'analyzing' ? '<span class="pending">medindo…</span>' :
      t.status === 'unsupported' ? '<span class="pending" title="Formato que o Nivela não toca. Converta para MP4 (H.264) e ele entra.">não suportado</span>' :
      t.status === 'error' ? '<span class="pending">erro</span>' : '<span class="pending">na fila</span>';
    const g = t.status === 'ok' ? Player.gainDb(t) : null;
    const gTxt = g == null ? '' : ` <span class="${g >= 0 ? 'up' : 'down'}">${g >= 0 ? '+' : ''}${g.toFixed(1)}</span>`;
    return `<td class="col-play"><button class="rowbtn" data-act="play" title="Tocar agora">▶</button></td>
      <td class="col-title" title="${esc(t.path)}">${t.video ? '<span class="tag-video" title="clipe em vídeo">clipe</span>' : ''}${esc(t.title)}<span class="sub">${esc(t.album || t.path)}</span></td>
      <td class="col-artist">${esc(t.artist)}</td>
      <td class="col-style"><select class="style-select ${t.styleManual ? 'manual' : ''}" data-act="style" title="${esc(t.reason)}">${styleOptions(st)}</select><span class="reason">${t.styleManual ? 'definido por você' : esc(t.reason)}</span></td>
      <td class="col-bpm mono">${t.bpm ?? ''}</td>
      <td class="col-lufs mono">${lufs}${gTxt}</td>
      <td class="col-add"><button class="rowbtn" data-act="add" title="Adicionar à playlist selecionada">+</button><button class="rowbtn" data-act="del" title="Tirar da biblioteca">✕</button></td>`;
  }
  function renderRow(t) {
    const tr = state.rows.get(t.id); if (!tr) return;
    tr.innerHTML = rowHtml(t);
    tr.className = [t.status === 'error' || t.status === 'unsupported' ? 'err' : '', isCurrent(t.id) ? 'now' : '', available(t) ? '' : 'missing', state.dupes.has(t.id) ? 'dupe' : ''].filter(Boolean).join(' ');
  }
  // Com milhares de músicas não dá para criar uma linha para cada uma: monta em blocos
  // e vai acrescentando conforme a pessoa rola a lista.
  const PAGE = 150;
  function appendRows(n) {
    const frag = document.createDocumentFragment();
    const end = Math.min(state.visible.length, state.shown + n);
    for (let i = state.shown; i < end; i++) {
      const id = state.visible[i], t = state.tracks.get(id);
      if (!t) continue;
      const tr = document.createElement('tr'); tr.dataset.id = id; tr.draggable = true;
      state.rows.set(id, tr); frag.appendChild(tr); renderRow(t);
    }
    state.shown = end;
    el.libBody.appendChild(frag);
    const restam = state.shown < state.visible.length;
    el.libMore.classList.toggle('hidden', !restam);
    el.libMore.textContent = restam ? `mostrando ${state.shown} de ${state.visible.length} — role para ver mais` : '';
  }
  function renderLibrary() {
    state.visible = visibleIds();
    el.libCount.textContent = state.visible.length === state.tracks.size ? state.tracks.size : `${state.visible.length} / ${state.tracks.size}`;
    el.libEmpty.classList.toggle('hidden', state.tracks.size > 0);
    state.rows.clear(); state.shown = 0;
    el.libBody.replaceChildren();
    appendRows(PAGE);
  }
  el.tableWrap.addEventListener('scroll', () => {
    if (state.shown >= state.visible.length) return;
    const w = el.tableWrap;
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 400) appendRows(PAGE);
  });
  el.libBody.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = e.target.closest('tr').dataset.id, t = state.tracks.get(id);
    if (b.dataset.act === 'play') playNow(t);
    if (b.dataset.act === 'add') addToPlaylist(t);
    if (b.dataset.act === 'del') removeTrack(t);
  });
  el.libBody.addEventListener('dblclick', e => { const tr = e.target.closest('tr'); if (tr && !e.target.closest('select,button')) playNow(state.tracks.get(tr.dataset.id)); });
  el.libBody.addEventListener('change', e => {
    const s = e.target.closest('select[data-act=style]'); if (!s) return;
    const t = state.tracks.get(e.target.closest('tr').dataset.id);
    t.styleManual = s.value === t.style ? null : s.value;
    t._q = undefined;
    persist(t); renderRow(t); renderStyles();
  });
  el.search.addEventListener('input', renderLibrary);
  el.filterStyle.addEventListener('change', renderLibrary);
  el.filterTipo.addEventListener('change', e => {
    state.tipo = e.target.value;
    DB.put('settings', state.tipo, 'tipo').catch(() => {});
    renderLibrary(); renderStyles();
    // se já está tocando no aleatório, a fila é refeita para obedecer a escolha na hora
    if (state.source && Player.isPlaying()) { if (refillQueue()) { renderNextUp(); } }
    toast(state.tipo === 'clipe' ? 'Tocando só clipe' : state.tipo === 'musica' ? 'Tocando só música' : 'Música e clipe misturados');
  });

  /* ---------------- estilos ---------------- */
  function styleCounts() {
    const c = {}; for (const t of state.tracks.values()) if (t.status !== 'error' && tipoOk(t)) c[styleOf(t)] = (c[styleOf(t)] || 0) + 1; return c;
  }
  function renderStyles() {
    const counts = styleCounts();
    el.styles.innerHTML = Genres.STYLES.map(s => {
      const n = counts[s.id] || 0;
      return `<button class="style-chip ${state.selectedStyles.has(s.id) ? 'on' : ''} ${n ? '' : 'zero'}" data-id="${s.id}" style="--c:${s.color}"><span class="sw"></span>${esc(s.label)}<span class="n">${n}</span></button>`;
    }).join('');
    const cur = el.filterStyle.value;
    el.filterStyle.innerHTML = '<option value="">todos os estilos</option>' + Genres.STYLES.filter(s => counts[s.id]).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.label)} (${counts[s.id]})</option>`).join('');
  }
  el.styles.addEventListener('click', e => {
    const b = e.target.closest('.style-chip'); if (!b) return;
    const id = b.dataset.id;
    if (state.selectedStyles.has(id)) state.selectedStyles.delete(id); else state.selectedStyles.add(id);
    renderStyles();
    if (state.mode === 'styles' && Player.isPlaying()) refillQueue();
  });
  function idsForStyles() {
    const sel = state.selectedStyles;
    return [...state.tracks.values()].filter(t => sorteavel(t) && (!sel.size || sel.has(styleOf(t)))).map(t => t.id);
  }
  function playStyles() {
    const ids = idsForStyles();
    if (!ids.length) return toast('Nenhuma música nesses estilos');
    startQueue(smartShuffle(ids), 'styles', idsForStyles, true);
    const names = [...state.selectedStyles].map(styleLabel).join(', ') || 'todos os estilos';
    toast(`Aleatório: ${names} · ${ids.length} músicas`);
  }

  /* ---------------- playlists ---------------- */
  async function savePlaylists() { for (const p of state.playlists) await DB.put('playlists', p); }
  function renderPlaylists() {
    el.playlists.innerHTML = state.playlists.map(p => `<div class="pl-item ${state.currentPlaylist === p.id ? 'on' : ''}" data-id="${p.id}">🎵 ${esc(p.name)}<span class="n mono">${p.trackIds.length}</span></div>`).join('')
      || '<p class="hint" style="margin:0">Nenhuma playlist ainda.</p>';
    const p = state.playlists.find(x => x.id === state.currentPlaylist);
    el.plDetail.classList.toggle('hidden', !p);
    if (!p) return;
    el.plName.textContent = p.name;
    el.plTracks.innerHTML = p.trackIds.map((id, i) => { const t = state.tracks.get(id); return `<li class="${isCurrent(id) ? 'now' : ''}" data-i="${i}"><span>${esc(t ? `${t.artist ? t.artist + ' – ' : ''}${t.title}` : '(música não encontrada)')}</span><button data-act="rm" title="Tirar da playlist">✕</button></li>`; }).join('')
      || '<li style="list-style:none;color:var(--ink-3)">vazia</li>';
  }
  el.playlists.addEventListener('click', e => { const it = e.target.closest('.pl-item'); if (!it) return; state.currentPlaylist = it.dataset.id; renderPlaylists(); });
  el.plTracks.addEventListener('click', e => {
    const p = state.playlists.find(x => x.id === state.currentPlaylist); if (!p) return;
    const li = e.target.closest('li'); if (!li || li.dataset.i == null) return;
    const i = +li.dataset.i;
    if (e.target.closest('button[data-act=rm]')) { p.trackIds.splice(i, 1); savePlaylists(); renderPlaylists(); }
    else { startQueue(p.trackIds.filter(id => available(state.tracks.get(id))), 'playlist', null, false, p.trackIds[i]); }
  });
  $('#btnNewPlaylist').addEventListener('click', () => {
    const name = prompt('Nome da playlist:'); if (!name || !name.trim()) return;
    const p = { id: 'pl-' + Date.now(), name: name.trim(), trackIds: [] };
    state.playlists.push(p); state.currentPlaylist = p.id; savePlaylists(); renderPlaylists();
    toast('Playlist criada. Use o + das músicas para adicionar.');
  });
  $('#btnDelPl').addEventListener('click', async () => {
    const p = state.playlists.find(x => x.id === state.currentPlaylist); if (!p) return;
    if (!confirm(`Apagar a playlist "${p.name}"?`)) return;
    state.playlists = state.playlists.filter(x => x !== p); await DB.del('playlists', p.id); state.currentPlaylist = null; renderPlaylists();
  });
  $('#btnPlayPl').addEventListener('click', () => { const p = state.playlists.find(x => x.id === state.currentPlaylist); if (p) startQueue(p.trackIds.filter(id => available(state.tracks.get(id))), 'playlist'); });
  $('#btnShufflePl').addEventListener('click', () => { const p = state.playlists.find(x => x.id === state.currentPlaylist); if (p) startQueue(smartShuffle(p.trackIds.filter(id => available(state.tracks.get(id)))), 'playlist', () => p.trackIds.filter(id => available(state.tracks.get(id))), true); });
  function addToPlaylist(t) {
    const p = state.playlists.find(x => x.id === state.currentPlaylist);
    if (!p) return toast('Crie ou selecione uma playlist primeiro (painel à esquerda).');
    if (p.trackIds.includes(t.id)) return toast('Já está na playlist');
    p.trackIds.push(t.id); savePlaylists(); renderPlaylists(); toast(`"${t.title}" → ${p.name}`);
  }

  /* ---------------- fila de reprodução ---------------- */
  function currentTrack() { const d = Player.current(); return d ? d.track : null; }
  function isCurrent(id) { const t = currentTrack(); return !!t && t.id === id; }
  function startQueue(ids, mode, source, loop, startId) {
    if (!ids.length) return toast('Nada para tocar');
    state.queue = ids; state.mode = mode; state.source = source; state.loop = !!loop;
    state.pos = startId ? Math.max(0, ids.indexOf(startId)) : 0;
    playIndex(state.pos);
  }
  function refillQueue() {
    if (!state.source) return false;
    const ids = state.loop ? smartShuffle(state.source()) : state.source();
    if (!ids.length) return false;
    const cur = currentTrack();
    if (cur && ids.length > 1 && ids[0] === cur.id) ids.push(ids.shift());
    state.queue = ids; state.pos = -1; return true;
  }
  let playing = false;
  async function playIndex(i) {
    const id = state.queue[i]; const t = id && state.tracks.get(id);
    if (!t) return next();
    if (!t.file && !(await ensureFile(t))) return next();
    state.pos = i;
    if (t.status !== 'ok' && t.status !== 'error') { setDeckState('analisando…'); await ensureAnalyzed(id); }
    if (t.status === 'unsupported') { toast(`"${t.title}" está num formato que o Nivela não toca. Converta para MP4.`, 5000); return next(); }
    if (t.status === 'error') { toast(`Não consegui tocar "${t.title}"`); return next(); }
    const ok = await Player.play(t);
    if (!ok) return;
    highlightCurrent(); renderNextUp();
    const nid = state.queue[state.pos + 1]; if (nid) ensureAnalyzed(nid); // já deixa a próxima medida
  }
  function next() {
    if (state.pos + 1 >= state.queue.length) {
      if (!refillQueue()) { Player.stop(); toast('Fim da fila'); return; }
    }
    playIndex(state.pos + 1);
  }
  function prev() {
    if (Player.position() > 5 || state.pos <= 0) { Player.seek(0); return; }
    playIndex(state.pos - 1);
  }
  async function playNow(t) {
    if (!t) return;
    if (t.status === 'unsupported') return toast(`"${t.title}" está num formato que o Nivela não toca (${(t.name.split('.').pop() || '').toUpperCase()}). Converta para MP4 e ele entra.`, 6000);
    if (!t.file && !(await ensureFile(t))) return toast('Arquivo não está disponível. Use Reconectar biblioteca.');
    if (!state.queue.length) {
      const ids = visibleIds(); state.queue = ids; state.mode = 'library'; state.source = null; state.loop = false;
      return playIndex(Math.max(0, ids.indexOf(t.id)));
    }
    state.queue.splice(state.pos + 1, 0, t.id);
    playIndex(state.pos + 1);
  }
  /** Tira a música da biblioteca do Nivela. O arquivo no computador não é apagado. */
  function removeTrack(t) {
    state.tracks.delete(t.id);
    DB.del('tracks', t.id).catch(() => {});
    for (const p of state.playlists) {
      const i = p.trackIds.indexOf(t.id);
      if (i >= 0) { p.trackIds.splice(i, 1); savePlaylists(); }
    }
    state.queue = state.queue.filter(id => id !== t.id);
    findDupes(); rebuildOrder(); renderLibrary(); renderStyles(); renderPlaylists(); updateStatus();
    toast(`"${t.title}" saiu da biblioteca (o arquivo continua no computador)`);
  }

  /** coloca a faixa como a próxima da fila, sem interromper o que está tocando */
  function tocarDepois(t) {
    if (!t) return;
    if (t.status === 'unsupported') return toast(`"${t.title}" está num formato que o Nivela não toca.`, 5000);
    if (!available(t)) return toast('Arquivo não está disponível. Use Reconectar biblioteca.');
    if (!state.queue.length) { state.queue = [t.id]; state.pos = -1; }
    else state.queue.splice(state.pos + 1, 0, t.id);
    ensureAnalyzed(t.id);
    renderNextUp();
    toast(`"${t.title}" entra logo depois`);
  }

  function renderNextUp() {
    const nid = state.queue[state.pos + 1]; const t = nid && state.tracks.get(nid);
    el.nextUp.textContent = t ? `${t.artist ? t.artist + ' – ' : ''}${t.title}` : (state.source ? '(nova rodada)' : '—');
  }
  function highlightCurrent() {
    for (const [id, tr] of state.rows) tr.classList.toggle('now', isCurrent(id));
    renderPlaylists();
  }
  let avisouTela = false;
  Player.on('started', d => {
    if (d.track && d.track.video && !avisouTela && (!tela || tela.closed)) {
      avisouTela = true;
      toast('Isso é um clipe. Clique em "🖥 Tela de vídeo" para jogar a imagem na TV.', 6000);
    }
  });
  Player.on('needNext', () => next());
  Player.on('stopped', () => { renderDecks(); highlightCurrent(); el.btnPlay.textContent = '▶'; });
  Player.on('error', (d) => toast(`Erro ao tocar "${d.track?.title || ''}"`));
  Player.on('deck', d => { renderDeck(d); el.btnPlay.textContent = Player.isPlaying() ? '❚❚' : '▶'; });
  Player.on('progress', d => drawWave(d));

  /* ---------------- decks (visual) ---------------- */
  const deckEls = [$('#deckA'), $('#deckB')];
  const q = (root, role) => root.querySelector(`[data-role=${role}]`);
  function setDeckState(txt) { const d = Player.current(); const root = deckEls[d ? (d.i + 1) % 2 : 0]; q(root, 'state').textContent = txt; }
  function renderDecks() { Player.decks.forEach(renderDeck); }
  async function renderDeck(d) {
    const root = deckEls[d.i], t = d.track;
    root.classList.toggle('live', d.state === 'playing');
    q(root, 'state').textContent = d.state === 'idle' ? 'livre' : d.state === 'loading' ? 'carregando' : d.state === 'fading' ? 'saindo' : d.state === 'error' ? 'erro' : d.media.paused ? 'pausado' : 'no ar';
    q(root, 'title').textContent = t ? t.title : '—';
    q(root, 'artist').innerHTML = t ? esc(t.artist || '&nbsp;') : '&nbsp;';
    const st = q(root, 'style'); st.textContent = t ? styleLabel(styleOf(t)) : 'estilo'; st.style.color = t ? styleColor(styleOf(t)) : '';
    q(root, 'bpm').textContent = t && t.bpm ? `${t.bpm} BPM` : '— BPM';
    const g = t ? Player.gainDb(t) : 0;
    q(root, 'gain').textContent = t && t.loudness != null ? `${t.loudness.toFixed(1)} LUFS · ${g >= 0 ? '+' : ''}${g.toFixed(1)} dB` : (t ? 'sem medição' : '0.0 dB');
    const cover = q(root, 'cover');
    // os decks só nascem no primeiro play, então a prévia é encaixada aqui, na primeira vez.
    // O elemento fica dentro do deck e ligado à mesa de som: levá-lo para outra janela mataria o áudio.
    if (d.media.parentElement !== cover) { d.media.classList.add('deck-video'); cover.appendChild(d.media); }
    const comImagem = Player.hasPicture(d);
    cover.classList.toggle('has-video', comImagem);
    root.classList.toggle('is-video', !!(t && t.video));
    if (!t) { setCoverArt(cover, null); cover.dataset.id = ''; }
    else if (cover.dataset.id !== t.id) {
      cover.dataset.id = t.id; setCoverArt(cover, null);
      if (!t.video && t.file) {
        const tags = await Tags.read(t.file, { picture: true });
        if (tags.picture && cover.dataset.id === t.id) setCoverArt(cover, tags.picture);
      }
    }
    drawWave(d);
  }
  /** troca só a arte da capa, sem mexer no <video> que mora dentro da mesma caixa */
  function setCoverArt(cover, blob) {
    const old = cover.querySelector('img, .deck-cover-empty');
    if (old) { if (old.tagName === 'IMG') URL.revokeObjectURL(old.src); old.remove(); }
    if (blob) {
      const img = new Image(); img.src = URL.createObjectURL(blob);
      cover.insertBefore(img, cover.firstChild);
    } else {
      const span = document.createElement('span');
      span.className = 'deck-cover-empty'; span.textContent = '♪';
      cover.insertBefore(span, cover.firstChild);
    }
  }

  function drawWave(d) {
    const root = deckEls[d.i], c = q(root, 'wave'), ctx = c.getContext('2d'), t = d.track;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const dur = d.media.duration, cur = d.media.currentTime;
    const frac = t && isFinite(dur) && dur > 0 ? cur / dur : 0;
    q(root, 'elapsed').textContent = fmtTime(cur);
    q(root, 'remain').textContent = '-' + fmtTime((isFinite(dur) ? dur : (t?.duration || 0)) - cur);
    if (!t) return;
    const color = d.i === 0 ? '#ffb02e' : '#3ee0c6';
    const wave = t.wave;
    const n = wave ? wave.length : 120;
    const bw = W / n;
    for (let i = 0; i < n; i++) {
      const v = wave ? wave[i] / 255 : 0.25;
      const h = Math.max(2, v * (H - 8));
      ctx.fillStyle = i / n <= frac ? color : 'rgba(255,255,255,.18)';
      ctx.fillRect(i * bw + 0.5, (H - h) / 2, Math.max(1, bw - 1), h);
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(frac * W - 1, 0, 2, H);
  }
  deckEls.forEach((root, i) => q(root, 'wave').addEventListener('click', e => {
    const d = Player.decks[i]; if (!d || d.state !== 'playing' || Player.current() !== d) return;
    const r = e.currentTarget.getBoundingClientRect(); Player.seek((e.clientX - r.left) / r.width);
  }));

  // medidor master
  const vuCtx = el.vu.getContext('2d'); let vuHold = -90, vuHoldT = 0;
  function drawVu() {
    requestAnimationFrame(drawVu);
    const { rms, peak } = Player.level();
    const W = el.vu.width, H = el.vu.height;
    vuCtx.clearRect(0, 0, W, H);
    const toY = db => H - Math.max(0, Math.min(1, (db + 40) / 40)) * H;
    const grad = vuCtx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, '#3ee0c6'); grad.addColorStop(0.7, '#ffb02e'); grad.addColorStop(0.92, '#ff4d3d');
    vuCtx.fillStyle = grad; vuCtx.fillRect(6, toY(rms), W - 12, H - toY(rms));
    if (peak >= vuHold || performance.now() - vuHoldT > 900) { vuHold = peak; vuHoldT = performance.now(); }
    vuCtx.fillStyle = '#fff'; vuCtx.fillRect(6, toY(vuHold), W - 12, 2);
  }
  drawVu();

  /* ---------------- controles ---------------- */
  /* ---------------- arrastar faixa da lista para os decks ---------------- */
  const TIPO_ARRASTE = 'application/x-nivela-faixa';
  let arrastandoId = null;

  el.libBody.addEventListener('dragstart', e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    arrastandoId = tr.dataset.id;
    tr.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(TIPO_ARRASTE, arrastandoId);
    e.dataTransfer.setData('text/plain', state.tracks.get(arrastandoId)?.title || '');
    atualizarAlvos(true);
  });
  el.libBody.addEventListener('dragend', e => {
    const tr = e.target.closest('tr'); tr && tr.classList.remove('arrastando');
    arrastandoId = null; atualizarAlvos(false);
    deckEls.forEach(d => d.classList.remove('drop-alvo'));
    $('#nextUpBox').classList.remove('drop-alvo');
  });

  /** o rótulo de cada deck muda conforme o que o arraste vai fazer ali */
  function atualizarAlvos(ligado) {
    if (!ligado) return;
    const live = Player.current();
    deckEls.forEach((root, i) => {
      const alvo = root.querySelector('.deck-drop span');
      alvo.textContent = live && live.i === i ? 'tocar agora' : 'tocar a seguir';
    });
  }

  function ligarAlvo(elemento, aoSoltar, classe = 'drop-alvo') {
    elemento.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes(TIPO_ARRASTE)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      elemento.classList.add(classe);
    });
    elemento.addEventListener('dragleave', e => {
      if (e.relatedTarget && elemento.contains(e.relatedTarget)) return;
      elemento.classList.remove(classe);
    });
    elemento.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes(TIPO_ARRASTE)) return;
      e.preventDefault(); e.stopPropagation();
      elemento.classList.remove(classe);
      const id = e.dataTransfer.getData(TIPO_ARRASTE) || arrastandoId;
      const t = id && state.tracks.get(id);
      if (t) aoSoltar(t);
    });
  }

  deckEls.forEach((root, i) => ligarAlvo(root, t => {
    const live = Player.current();
    // soltou no deck que está no ar: troca a faixa agora. No outro deck: vira a próxima.
    if (live && live.i === i) playNow(t); else tocarDepois(t);
  }));
  ligarAlvo($('#nextUpBox'), tocarDepois);

  /* ---------------- janela de vídeo ---------------- */
  let tela = null;
  function abrirTela() {
    if (tela && !tela.closed) { tela.focus(); return; }
    tela = window.open('tela.html', 'nivela-tela', 'width=1000,height=580,menubar=no,toolbar=no,location=no,status=no');
    if (!tela) return toast('O navegador bloqueou a janela. Permita janelas pop-up para este endereço.', 5000);
    marcarTela(true);
    const vigia = setInterval(() => { if (!tela || tela.closed) { clearInterval(vigia); marcarTela(false); } }, 1000);
  }
  function marcarTela(aberta) {
    const b = $('#btnTela');
    b.classList.toggle('on', aberta);
    b.textContent = aberta ? '🖥 Tela aberta' : '🖥 Tela de vídeo';
  }
  $('#btnTela').addEventListener('click', abrirTela);

  el.btnPlay.addEventListener('click', () => {
    if (Player.current()) { el.btnPlay.textContent = Player.toggle() ? '❚❚' : '▶'; return; }
    if (state.queue.length && state.pos >= 0) return playIndex(state.pos);
    state.selectedStyles.size ? playStyles() : playAll();
  });
  $('#btnNext').addEventListener('click', () => { if (state.queue.length) next(); });
  $('#btnPrev').addEventListener('click', prev);
  $('#btnPlayStyles').addEventListener('click', playStyles);
  function playAll() { const pick = () => [...state.tracks.values()].filter(sorteavel).map(t => t.id); startQueue(smartShuffle(pick()), 'all', pick, true); }
  $('#btnPlayAll').addEventListener('click', playAll);
  $('#volume').addEventListener('input', e => Player.set('volume', e.target.value / 100));
  $('#target').addEventListener('change', e => { Player.set('target', +e.target.value); DB.put('settings', +e.target.value, 'target'); renderLibrary(); renderDecks(); });
  $('#crossfade').addEventListener('change', e => { Player.set('crossfade', +e.target.value); DB.put('settings', +e.target.value, 'crossfade'); });
  $('#automix').addEventListener('change', e => Player.set('automix', e.target.checked));
  $('#normalize').addEventListener('change', e => { Player.set('normalize', e.target.checked); renderDecks(); });
  $('#btnFolder').addEventListener('click', pickFolder);
  $('#btnFiles').addEventListener('click', pickFiles);
  $('#btnReconnect').addEventListener('click', () => reconnect());
  $('#btnRescan').addEventListener('click', async () => {
    if (!state.roots.length && !state.fileHandles.length) return toast('Adicione uma pasta primeiro, com o botão + Pasta.');
    const r = await reconnect({ silent: true });
    if (!r.scanned) toast('As pastas precisam de permissão. Clique em "Reconectar biblioteca".');
  });
  $('#btnDupes').addEventListener('click', e => {
    state.onlyDupes = !state.onlyDupes;
    e.currentTarget.classList.toggle('on', state.onlyDupes);
    renderLibrary();
  });
  $('#inpFolder').addEventListener('change', e => addEntries([...e.target.files].filter(f => IMPORT_RE.test(f.name)).map(f => ({ file: f, path: f.webkitRelativePath || f.name }))));
  $('#inpFiles').addEventListener('change', e => addEntries([...e.target.files].map(f => ({ file: f, path: f.name }))));
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); el.btnPlay.click(); }
    if (e.code === 'ArrowRight' && e.shiftKey) next();
  });

  // arrastar e soltar (arquivos e pastas)
  let dragDepth = 0;
  const arrasteDeArquivo = e => !e.dataTransfer || (!e.dataTransfer.types.includes(TIPO_ARRASTE) && e.dataTransfer.types.includes('Files'));
  window.addEventListener('dragenter', e => { if (!arrasteDeArquivo(e)) return; e.preventDefault(); if (++dragDepth === 1) document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', e => { if (!arrasteDeArquivo(e)) return; e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('dragover', e => { if (arrasteDeArquivo(e)) e.preventDefault(); });
  window.addEventListener('drop', async e => {
    if (!arrasteDeArquivo(e)) return;
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    const items = [...(e.dataTransfer.items || [])];
    const out = [];
    setStatus('Lendo pastas…', 'busy');
    if (items.length && items[0].getAsFileSystemHandle) {
      const handles = await Promise.all(items.map(i => i.kind === 'file' ? i.getAsFileSystemHandle() : null));
      for (const h of handles) {
        if (!h) continue;
        if (h.kind === 'directory') { await walkHandle(h, '', out); if (!state.roots.some(r => r.name === h.name)) state.roots.push(h); }
        else if (IMPORT_RE.test(h.name)) { out.push({ file: await h.getFile(), path: h.name }); state.fileHandles.push(h); }
      }
      DB.put('settings', state.roots, 'roots').catch(() => {}); DB.put('settings', state.fileHandles, 'fileHandles').catch(() => {});
    } else if (items.length && items[0].webkitGetAsEntry) {
      for (const it of items) { const en = it.webkitGetAsEntry(); if (en) await walkEntry(en, '', out); }
    } else {
      for (const f of e.dataTransfer.files) if (IMPORT_RE.test(f.name)) out.push({ file: f, path: f.name });
    }
    await addEntries(out);
  });

  /* ---------------- inicialização ---------------- */
  async function init() {
    try {
      const saved = await DB.getAll('tracks');
      for (const t of saved) { t.file = null; state.tracks.set(t.id, t); }
      state.playlists = await DB.getAll('playlists');
      state.roots = (await DB.get('settings', 'roots')) || [];
      state.fileHandles = (await DB.get('settings', 'fileHandles')) || [];
      const target = await DB.get('settings', 'target'); if (target) { $('#target').value = target; Player.set('target', target); }
      const cf = await DB.get('settings', 'crossfade'); if (cf != null) { $('#crossfade').value = cf; Player.set('crossfade', cf); }
      const tipo = await DB.get('settings', 'tipo'); if (tipo) { state.tipo = tipo; el.filterTipo.value = tipo; }
    } catch (e) { console.warn('sem persistência', e); }
    findDupes(); rebuildOrder(); renderLibrary(); renderStyles(); renderPlaylists(); renderDecks(); updateStatus();
    if (state.roots.length || state.fileHandles.length) {
      $('#btnReconnect').classList.remove('hidden');
      // tenta sozinho: se a permissão das pastas continua valendo, a biblioteca volta
      // e os arquivos baixados desde a última vez entram sem precisar de clique
      const r = await reconnect({ silent: true });
      if (r.scanned && r.added) toast(`${r.added} músicas novas encontradas nas pastas`);
    }
    if (!window.showDirectoryPicker) toast('Dica: no Chrome ou Edge a biblioteca fica lembrada entre sessões.', 5000);
  }
  init();
})();
