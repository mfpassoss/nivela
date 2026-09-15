/* Leitura de tags: ID3v2 (2.2/2.3/2.4), ID3v1 e fallback pelo nome do arquivo. */
const Tags = (() => {
  const GENRES_V1 = ['Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance','Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise','AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop','Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta','Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave','Psychadelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock','Folk','Folk-Rock','National Folk','Swing','Fast Fusion','Bebob','Latin','Revival','Celtic','Bluegrass','Avantgarde','Gothic Rock','Progressive Rock','Psychedelic Rock','Symphonic Rock','Slow Rock','Big Band','Chorus','Easy Listening','Acoustic','Humour','Speech','Chanson','Opera','Chamber Music','Sonata','Symphony','Booty Bass','Primus','Porn Groove','Satire','Slow Jam','Club','Tango','Samba','Folklore','Ballad','Power Ballad','Rhythmic Soul','Freestyle','Duet','Punk Rock','Drum Solo','A capella','Euro-House','Dance Hall'];

  const latin1 = new TextDecoder('windows-1252');
  const utf8 = new TextDecoder('utf-8');
  const utf16le = new TextDecoder('utf-16le');
  const utf16be = new TextDecoder('utf-16be');

  function decodeText(bytes, enc) {
    let s;
    if (enc === 1) {
      if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) s = utf16le.decode(bytes.subarray(2));
      else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) s = utf16be.decode(bytes.subarray(2));
      else s = utf16le.decode(bytes);
    } else if (enc === 2) s = utf16be.decode(bytes);
    else if (enc === 3) s = utf8.decode(bytes);
    else s = latin1.decode(bytes);
    return s.replace(/\0+$/g, '').replace(/\0/g, ' / ').trim();
  }

  // posição do terminador de string conforme codificação
  function findTerminator(bytes, start, enc) {
    if (enc === 1 || enc === 2) {
      for (let i = start; i + 1 < bytes.length; i += 2) if (bytes[i] === 0 && bytes[i + 1] === 0) return [i, i + 2];
      return [bytes.length, bytes.length];
    }
    for (let i = start; i < bytes.length; i++) if (bytes[i] === 0) return [i, i + 1];
    return [bytes.length, bytes.length];
  }

  const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];

  function unsync(bytes) {
    const out = new Uint8Array(bytes.length);
    let j = 0;
    for (let i = 0; i < bytes.length; i++) {
      out[j++] = bytes[i];
      if (bytes[i] === 0xFF && bytes[i + 1] === 0x00) i++;
    }
    return out.subarray(0, j);
  }

  function parseGenre(s) {
    if (!s) return null;
    // "(17)Rock", "(17)", "17"
    const m = s.match(/^\((\d+)\)\s*(.*)$/) || s.match(/^(\d+)$/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const rest = (m[2] || '').trim();
      return rest || GENRES_V1[idx] || null;
    }
    return s;
  }

  function parseId3v2(head, body, wantPicture) {
    const ver = head[3];
    const flags = head[5];
    const out = {};
    if (ver === 3 && (flags & 0x80)) body = unsync(body);
    let pos = 0;
    if (flags & 0x40) { // extended header
      if (ver === 4) pos += syncsafe(body, 0);
      else pos += 4 + u32(body, 0);
    }
    const isV22 = ver === 2;
    const map = isV22
      ? { TT2: 'title', TP1: 'artist', TAL: 'album', TCO: 'genre', TYE: 'year', PIC: 'picture' }
      : { TIT2: 'title', TPE1: 'artist', TALB: 'album', TCON: 'genre', TYER: 'year', TDRC: 'year', APIC: 'picture' };
    const need = new Set(Object.values(map));
    while (pos + (isV22 ? 6 : 10) <= body.length) {
      let id, size, fflags = 0, hdr;
      if (isV22) { id = latin1.decode(body.subarray(pos, pos + 3)); size = u24(body, pos + 3); hdr = 6; }
      else {
        id = latin1.decode(body.subarray(pos, pos + 4));
        size = ver === 4 ? syncsafe(body, pos + 4) : u32(body, pos + 4);
        fflags = (body[pos + 8] << 8) | body[pos + 9]; hdr = 10;
      }
      if (!/^[A-Z0-9]{3,4}$/.test(id) || size <= 0) break;
      let data = body.subarray(pos + hdr, pos + hdr + size);
      pos += hdr + size;
      const key = map[id];
      if (!key || out[key] !== undefined) continue;
      if (ver === 4 && (fflags & 0x02)) data = unsync(data);
      if (ver === 4 && (fflags & 0x01)) data = data.subarray(4); // data length indicator
      if (key === 'picture') {
        if (!wantPicture) continue;
        const enc = data[0];
        let p = 1, mime;
        if (isV22) { mime = latin1.decode(data.subarray(1, 4)).toLowerCase(); p = 4; mime = mime === 'jpg' ? 'image/jpeg' : 'image/' + mime; }
        else { const [e, n] = findTerminator(data, 1, 0); mime = latin1.decode(data.subarray(1, e)); p = n; }
        p += 1; // picture type
        const [, n2] = findTerminator(data, p, enc);
        const pic = data.subarray(n2);
        if (pic.length > 16) out.picture = new Blob([pic], { type: mime || 'image/jpeg' });
        continue;
      }
      const txt = decodeText(data.subarray(1), data[0]);
      if (txt) out[key] = key === 'genre' ? parseGenre(txt) : txt;
      if (need.size && Object.keys(out).length >= need.size) break;
    }
    return out;
  }

  async function readId3v1(file) {
    if (file.size < 128) return {};
    const b = new Uint8Array(await file.slice(file.size - 128, file.size).arrayBuffer());
    if (b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return {};
    const str = (a, z) => latin1.decode(b.subarray(a, z)).replace(/\0.*$/, '').trim();
    const out = { title: str(3, 33), artist: str(33, 63), album: str(63, 93), year: str(93, 97) };
    const g = b[127];
    if (g < GENRES_V1.length) out.genre = GENRES_V1[g];
    return out;
  }

  /** Lê título/artista/álbum/gênero (e capa, se pedido). Nunca lança. */
  async function read(file, { picture = false } = {}) {
    const out = { title: null, artist: null, album: null, genre: null, year: null, picture: null };
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 && head[3] <= 4) {
        const size = syncsafe(head, 6);
        const body = new Uint8Array(await file.slice(10, 10 + Math.min(size, 4 * 1024 * 1024)).arrayBuffer());
        Object.assign(out, parseId3v2(head, body, picture));
      }
      if (!out.title && !out.artist) {
        const v1 = await readId3v1(file);
        for (const k of Object.keys(v1)) if (!out[k] && v1[k]) out[k] = v1[k];
      }
    } catch (e) { /* tags corrompidas: seguimos com o nome do arquivo */ }
    return out;
  }

  /** "01 - Henrique & Juliano - Vidinha de Balada.mp3" → { artist, title } */
  function fromFilename(name) {
    let base = name.replace(/\.[a-z0-9]{2,5}$/i, '');
    base = base.replace(/^\s*\d{1,3}\s*[-._)]?\s*/, ''); // número de faixa
    base = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    base = base.replace(/\s*[\(\[](official|oficial|clipe|video|vídeo|audio|áudio|lyric|letra|ao vivo|dvd)[^\)\]]*[\)\]]\s*/gi, ' ').trim();
    const parts = base.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    return { artist: null, title: base };
  }

  return { read, fromFilename };
})();
