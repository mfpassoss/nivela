/* Leitor de ZIP para importar CDs completos sem precisar descompactar antes.
   Usa só recursos do próprio navegador: lê o índice do arquivo e descomprime com DecompressionStream. */
const Zip = (() => {
  const utf8 = new TextDecoder('utf-8');
  const cp437chars = '\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

  // Nomes dentro do zip vêm em UTF-8 (quando a bandeira indica) ou na tabela antiga CP437.
  // Sem isso, "Coração.mp3" vira "Cora‡Æo.mp3".
  function decodeName(bytes, utf8Flag) {
    if (utf8Flag) return utf8.decode(bytes);
    let s = '';
    for (const b of bytes) s += b < cp437chars.length ? cp437chars[b] : String.fromCharCode(b);
    return s;
  }

  async function slice(blob, start, len) { return new Uint8Array(await blob.slice(start, start + len).arrayBuffer()); }
  const u16 = (v, o) => v.getUint16(o, true);
  const u32 = (v, o) => v.getUint32(o, true);

  /** Lê o índice central do zip e devolve a lista de arquivos (sem descomprimir nada ainda). */
  async function listEntries(blob) {
    const size = blob.size;
    if (size < 22) throw new Error('arquivo zip vazio ou inválido');
    // o índice fica no fim; o comentário final pode ter até 64 KB
    const tailLen = Math.min(size, 66000);
    const tail = await slice(blob, size - tailLen, tailLen);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('não parece um arquivo zip');
    const tv = new DataView(tail.buffer, tail.byteOffset);
    let count = u16(tv, eocd + 10), cdSize = u32(tv, eocd + 12), cdOff = u32(tv, eocd + 16);

    // zip64: quando passa de 65535 arquivos ou 4 GB, os valores reais ficam em outro registro
    if (cdOff === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
      let loc = -1;
      for (let i = eocd - 20; i >= 0; i--) {
        if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x06 && tail[i + 3] === 0x07) { loc = i; break; }
      }
      if (loc < 0) throw new Error('zip grande demais para ler neste formato');
      const z64Off = Number(new DataView(tail.buffer, tail.byteOffset).getBigUint64(loc + 8, true));
      const z64 = new DataView((await slice(blob, z64Off, 56)).buffer);
      count = Number(z64.getBigUint64(32, true));
      cdSize = Number(z64.getBigUint64(40, true));
      cdOff = Number(z64.getBigUint64(48, true));
    }

    const cd = await slice(blob, cdOff, cdSize);
    const cv = new DataView(cd.buffer, cd.byteOffset);
    const entries = [];
    let p = 0;
    for (let i = 0; i < count && p + 46 <= cd.length; i++) {
      if (u32(cv, p) !== 0x02014b50) break;
      const flags = u16(cv, p + 8), method = u16(cv, p + 10);
      const compSize = u32(cv, p + 20), rawSize = u32(cv, p + 24);
      const nameLen = u16(cv, p + 28), extraLen = u16(cv, p + 30), commentLen = u16(cv, p + 32);
      const localOff = u32(cv, p + 42);
      const name = decodeName(cd.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
      const time = u16(cv, p + 12), date = u16(cv, p + 14);
      entries.push({ name, method, compSize, rawSize, localOff, encrypted: (flags & 1) !== 0, date, time });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  /** Extrai um arquivo do zip como Blob. */
  async function extract(blob, entry) {
    if (entry.encrypted) throw new Error('arquivo protegido por senha');
    // o cabeçalho local repete nome e extras, e só depois vêm os dados
    const head = new DataView((await slice(blob, entry.localOff, 30)).buffer);
    if (u32(head, 0) !== 0x04034b50) throw new Error('cabeçalho do arquivo não confere');
    const dataAt = entry.localOff + 30 + u16(head, 26) + u16(head, 28);
    const raw = blob.slice(dataAt, dataAt + entry.compSize);
    if (entry.method === 0) return raw;
    if (entry.method !== 8) throw new Error('compressão não suportada (' + entry.method + ')');
    if (typeof DecompressionStream !== 'function') throw new Error('este navegador não descompacta zip');
    const out = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(out).blob();
  }

  /** data/hora do arquivo dentro do zip, no formato MS-DOS */
  function entryDate(e) {
    const y = 1980 + ((e.date >> 9) & 0x7f), mo = ((e.date >> 5) & 0xf) - 1, d = e.date & 0x1f;
    const h = (e.time >> 11) & 0x1f, mi = (e.time >> 5) & 0x3f, s = (e.time & 0x1f) * 2;
    const t = new Date(y, Math.max(0, mo), d || 1, h, mi, s).getTime();
    return isFinite(t) ? t : Date.now();
  }

  const isZip = f => /\.zip$/i.test(f.name) || f.type === 'application/zip';

  return { listEntries, extract, entryDate, isZip };
})();
