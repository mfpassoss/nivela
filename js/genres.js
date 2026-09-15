/* Identificação de estilo: tag de gênero → artista conhecido → palavras no nome/pasta → BPM. */
const Genres = (() => {
  const STYLES = [
    { id: 'sert-univ',   label: 'Sertanejo Universitário', color: '#ffb02e' },
    { id: 'sert-raiz',   label: 'Sertanejo Raiz / Modão',  color: '#c98a3a' },
    { id: 'sofrencia',   label: 'Sofrência',                color: '#ff6b8a' },
    { id: 'agronejo',    label: 'Agronejo',                 color: '#b6d94c' },
    { id: 'arrocha',     label: 'Arrocha',                  color: '#e86fd0' },
    { id: 'pagode',      label: 'Pagode',                   color: '#f4d35e' },
    { id: 'samba',       label: 'Samba',                    color: '#d9a441' },
    { id: 'forro',       label: 'Forró / Piseiro',          color: '#ff7a1a' },
    { id: 'axe',         label: 'Axé',                      color: '#ff4d3d' },
    { id: 'funk',        label: 'Funk',                     color: '#9b6bff' },
    { id: 'mpb',         label: 'MPB',                      color: '#7cc7a6' },
    { id: 'pop',         label: 'Pop / Internacional',      color: '#3ee0c6' },
    { id: 'rock',        label: 'Rock',                     color: '#8fa3b8' },
    { id: 'gospel',      label: 'Gospel',                   color: '#cfe8ff' },
    { id: 'eletronica',  label: 'Eletrônica',               color: '#4fd3ff' },
    { id: 'rap',         label: 'Rap / Trap',               color: '#b0b0b0' },
    { id: 'outros',      label: 'Não identificado',         color: '#6f675b' },
  ];
  const byId = Object.fromEntries(STYLES.map(s => [s.id, s]));

  // Artistas conhecidos → estilo. Chave normalizada (sem acento, minúscula, "&" vira "e").
  const ARTISTS = {
    // sertanejo universitário
    'henrique e juliano': 'sert-univ', 'jorge e mateus': 'sert-univ', 'gusttavo lima': 'sert-univ', 'luan santana': 'sert-univ',
    'matheus e kauan': 'sert-univ', 'ze neto e cristiano': 'sert-univ', 'maiara e maraisa': 'sert-univ', 'simone e simaria': 'sert-univ',
    'simone mendes': 'sert-univ', 'israel e rodolffo': 'sert-univ', 'hugo e guilherme': 'sert-univ', 'diego e victor hugo': 'sert-univ',
    'fernando e sorocaba': 'sert-univ', 'joao bosco e vinicius': 'sert-univ', 'munhoz e mariano': 'sert-univ', 'michel telo': 'sert-univ',
    'cesar menotti e fabiano': 'sert-univ', 'victor e leo': 'sert-univ', 'joao neto e frederico': 'sert-univ', 'humberto e ronaldo': 'sert-univ',
    'gustavo mioto': 'sert-univ', 'murilo huff': 'sert-univ', 'clayton e romario': 'sert-univ', 'guilherme e benuto': 'sert-univ',
    'bruno e barretto': 'sert-univ', 'lauana prado': 'sert-univ', 'naiara azevedo': 'sert-univ', 'paula fernandes': 'sert-univ',
    'jads e jadson': 'sert-univ', 'thaeme e thiago': 'sert-univ', 'edson e hudson': 'sert-univ', 'marcos e belutti': 'sert-univ',
    'george henrique e rodrigo': 'sert-univ', 'joao gustavo e murilo': 'sert-univ', 'felipe araujo': 'sert-univ', 'leo santana': 'axe',
    'zeze di camargo e luciano': 'sert-univ', 'leonardo': 'sert-univ', 'bruno e marrone': 'sert-univ', 'chitaozinho e xororo': 'sert-univ',
    'daniel': 'sert-univ', 'joao carreiro e capataz': 'sert-univ', 'gino e geno': 'sert-univ', 'rick e renner': 'sert-univ',
    'rionegro e solimoes': 'sert-univ', 'guilherme e santiago': 'sert-univ', 'joao paulo e daniel': 'sert-univ', 'leandro e leonardo': 'sert-univ',
    'eduardo costa': 'sert-univ', 'cristiano araujo': 'sert-univ', 'joao neto e frederico ': 'sert-univ', 'us agroboy': 'agronejo',
    'ana castela': 'agronejo', 'luan pereira': 'agronejo', 'dj chris no beat': 'agronejo', 'mc pedrinho': 'funk',
    // sofrência
    'marilia mendonca': 'sofrencia', 'yasmin santos': 'sofrencia', 'mari fernandez': 'sofrencia', 'grupo menos e mais': 'pagode',
    'wesley safadao': 'forro', 'xand aviao': 'forro', 'joao gomes': 'forro', 'tarcisio do acordeon': 'forro', 'vitor fernandes': 'forro',
    'ze vaqueiro': 'forro', 'nattan': 'forro', 'mc danny': 'funk', 'aviões do forró': 'forro', 'avioes do forro': 'forro',
    'calcinha preta': 'forro', 'solange almeida': 'forro', 'mastruz com leite': 'forro', 'luiz gonzaga': 'forro', 'dominguinhos': 'forro',
    'falamansa': 'forro', 'rastape': 'forro', 'bicho de pe': 'forro', 'limão com mel': 'forro', 'limao com mel': 'forro',
    'gusttavo lima ': 'sert-univ',
    // raiz / modão
    'milionario e jose rico': 'sert-raiz', 'tiao carreiro e pardinho': 'sert-raiz', 'chico rey e parana': 'sert-raiz', 'tonico e tinoco': 'sert-raiz',
    'almir sater': 'sert-raiz', 'sergio reis': 'sert-raiz', 'trio parada dura': 'sert-raiz', 'joao mineiro e marciano': 'sert-raiz',
    'matogrosso e mathias': 'sert-raiz', 'renato teixeira': 'sert-raiz', 'pena branca e xavantinho': 'sert-raiz', 'gian e giovani': 'sert-raiz',
    'teodoro e sampaio': 'sert-raiz', 'di paullo e paulino': 'sert-raiz', 'joao pedro e cristiano': 'sert-raiz', 'cezar e paulinho': 'sert-raiz',
    'ze henrique e gabriel': 'sert-raiz', 'goia e goiano': 'sert-raiz', 'bruno e trio': 'sert-raiz',
    // arrocha
    'pablo': 'arrocha', 'pablo do arrocha': 'arrocha', 'silvanno salles': 'arrocha', 'tayrone': 'arrocha', 'thiago aquino': 'arrocha',
    'unha pintada': 'arrocha', 'devinho novaes': 'arrocha', 'nadson o ferinha': 'arrocha', 'thiago jhonathan': 'arrocha', 'tj': 'arrocha',
    // pagode / samba
    'thiaguinho': 'pagode', 'ferrugem': 'pagode', 'dilsinho': 'pagode', 'sorriso maroto': 'pagode', 'turma do pagode': 'pagode',
    'pixote': 'pagode', 'exaltasamba': 'pagode', 'menos e mais': 'pagode', 'raca negra': 'pagode', 'so pra contrariar': 'pagode',
    'art popular': 'pagode', 'katinguele': 'pagode', 'soweto': 'pagode', 'belo': 'pagode', 'pericles': 'pagode', 'ludmilla': 'funk',
    'revelacao': 'pagode', 'grupo revelacao': 'pagode', 'fundo de quintal': 'pagode', 'jeito moleque': 'pagode', 'vou pro sereno': 'pagode',
    'zeca pagodinho': 'samba', 'arlindo cruz': 'samba', 'beth carvalho': 'samba', 'alcione': 'samba', 'martinho da vila': 'samba',
    'jorge aragao': 'samba', 'diogo nogueira': 'samba', 'cartola': 'samba', 'paulinho da viola': 'samba', 'dudu nobre': 'samba',
    // axé
    'ivete sangalo': 'axe', 'claudia leitte': 'axe', 'chiclete com banana': 'axe', 'e o tchan': 'axe', 'asa de aguia': 'axe', 'banda eva': 'axe',
    'daniela mercury': 'axe', 'harmonia do samba': 'axe', 'psirico': 'axe', 'parangole': 'axe', 'timbalada': 'axe', 'olodum': 'axe',
    'bell marques': 'axe', 'ara ketu': 'axe', 'babado novo': 'axe', 'cheiro de amor': 'axe',
    // funk
    'anitta': 'pop', 'mc kevinho': 'funk', 'mc livinho': 'funk', 'mc ryan sp': 'funk', 'mc hariel': 'funk', 'mc ig': 'funk', 'mc don juan': 'funk',
    'mc daniel': 'funk', 'mc paiva': 'funk', 'kevin o chris': 'funk', 'mc gw': 'funk', 'mc zaac': 'funk', 'mc lan': 'funk', 'mc marks': 'funk',
    'pedro sampaio': 'funk', 'dennis dj': 'funk', 'dennis': 'funk', 'mc pipokinha': 'funk', 'mc cabelinho': 'funk', 'mc poze do rodo': 'funk',
    // mpb
    'caetano veloso': 'mpb', 'gilberto gil': 'mpb', 'chico buarque': 'mpb', 'djavan': 'mpb', 'marisa monte': 'mpb', 'maria bethania': 'mpb',
    'gal costa': 'mpb', 'elis regina': 'mpb', 'tim maia': 'mpb', 'jorge ben jor': 'mpb', 'seu jorge': 'mpb', 'ana carolina': 'mpb',
    'vanessa da mata': 'mpb', 'tiago iorc': 'mpb', 'anavitoria': 'mpb', 'roberto carlos': 'mpb', 'milton nascimento': 'mpb', 'zeca baleiro': 'mpb',
    'lenine': 'mpb', 'nando reis': 'mpb', 'rita lee': 'rock', 'legiao urbana': 'rock', 'capital inicial': 'rock', 'skank': 'rock',
    'jota quest': 'rock', 'titas': 'rock', 'paralamas do sucesso': 'rock', 'os paralamas do sucesso': 'rock', 'charlie brown jr': 'rock',
    'cpm 22': 'rock', 'raimundos': 'rock', 'engenheiros do hawaii': 'rock', 'barao vermelho': 'rock', 'cazuza': 'rock', 'pitty': 'rock',
    'natiruts': 'mpb', 'armandinho': 'mpb', 'maneva': 'mpb', 'melim': 'pop', 'jao': 'pop', 'luisa sonza': 'pop', 'iza': 'pop', 'pabllo vittar': 'pop',
    'vitor kley': 'pop', 'lagum': 'pop', 'sandy e junior': 'pop', 'sandy': 'pop', 'wanessa': 'pop', 'kell smith': 'pop',
    // gospel
    'aline barros': 'gospel', 'fernandinho': 'gospel', 'gabriela rocha': 'gospel', 'ana nobrega': 'gospel', 'isadora pompeo': 'gospel',
    'thalles roberto': 'gospel', 'ministerio zoe': 'gospel', 'eli soares': 'gospel', 'midian lima': 'gospel', 'bruna karla': 'gospel',
    'diante do trono': 'gospel', 'cassiane': 'gospel', 'anderson freire': 'gospel', 'damares': 'gospel', 'preto no branco': 'gospel',
    'fernanda brum': 'gospel', 'morada': 'gospel', 'casa worship': 'gospel', 'kemuel': 'gospel', 'gabriel guedes': 'gospel', 'isaias saad': 'gospel',
    // eletrônica / rap
    'alok': 'eletronica', 'vintage culture': 'eletronica', 'dubdogz': 'eletronica', 'kvsh': 'eletronica', 'bhaskar': 'eletronica', 'cat dealers': 'eletronica',
    'david guetta': 'eletronica', 'calvin harris': 'eletronica', 'avicii': 'eletronica', 'martin garrix': 'eletronica', 'tiesto': 'eletronica',
    'racionais mcs': 'rap', 'emicida': 'rap', 'criolo': 'rap', 'matue': 'rap', 'teto': 'rap', 'wiu': 'rap', 'l7nnon': 'rap', 'djonga': 'rap',
    'filipe ret': 'rap', 'hungria hip hop': 'rap', 'hungria': 'rap', 'orochi': 'rap', 'veigh': 'rap', 'bk': 'rap', 'sabotage': 'rap', 'projota': 'rap',
    // pop internacional
    'taylor swift': 'pop', 'ed sheeran': 'pop', 'bruno mars': 'pop', 'adele': 'pop', 'beyonce': 'pop', 'rihanna': 'pop', 'the weeknd': 'pop',
    'dua lipa': 'pop', 'justin bieber': 'pop', 'ariana grande': 'pop', 'lady gaga': 'pop', 'shakira': 'pop', 'maroon 5': 'pop', 'coldplay': 'pop',
    'michael jackson': 'pop', 'madonna': 'pop', 'bad bunny': 'pop', 'billie eilish': 'pop', 'harry styles': 'pop', 'sia': 'pop', 'katy perry': 'pop',
    'queen': 'rock', 'bon jovi': 'rock', 'guns n roses': 'rock', 'ac dc': 'rock', 'nirvana': 'rock', 'the beatles': 'rock', 'u2': 'rock', 'metallica': 'rock',
  };

  // Palavras no gênero (tag), nome do arquivo ou pastas → estilo. Ordem importa (mais específico primeiro).
  const KEYWORDS = [
    [/sofr[eê]ncia|sofrencia/, 'sofrencia'],
    [/agronejo|agro\b|agroboy|pis[ea]dinha/, 'agronejo'],
    [/arrocha/, 'arrocha'],
    [/universit[aá]rio|sertanejo pop|sertanejo romantico|sertanejo rom[aâ]ntico/, 'sert-univ'],
    [/mod[aã]o|raiz|caipira|viola|moda de viola|sertanejo antigo|sertanejo classico|sertanejo cl[aá]ssico/, 'sert-raiz'],
    [/piseiro|forr[oó]|vaquejada|xote|bai[aã]o|arrasta[- ]?p[eé]/, 'forro'],
    [/pagode/, 'pagode'],
    [/samba(?!.*pagode)|partido alto|samba[- ]enredo/, 'samba'],
    [/ax[eé]|carnaval|pagod[aã]o|swingueira/, 'axe'],
    [/\bfunk\b|\bmc\b|baile|150 ?bpm|brega ?funk/, 'funk'],
    [/gospel|louvor|worship|adora[cç][aã]o|evang[eé]lic|hino|crist[aã]/, 'gospel'],
    [/eletr[oô]nic|electronic|edm|house|techno|trance|remix|dance/, 'eletronica'],
    [/\brap\b|hip[- ]?hop|trap/, 'rap'],
    [/\bmpb\b|bossa/, 'mpb'],
    [/\brock\b|metal|punk|grunge|indie/, 'rock'],
    [/\bpop\b|internacional|reggaeton|latin|r&b|soul/, 'pop'],
    [/sertanej/, 'sertanejo'],  // genérico: decidido pelo BPM
    [/country/, 'sert-raiz'],
  ];

  function norm(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' e ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }


  function matchArtist(artist) {
    if (!artist) return null;
    const n = norm(artist);
    if (ARTISTS[n]) return { style: ARTISTS[n], name: artist };
    // "Henrique e Juliano part. Marília Mendonça" → tenta o artista principal e depois cada parte
    const main = n.split(/\b(?:feat|ft|part|participacao|vs)\b/)[0].trim();
    if (ARTISTS[main]) return { style: ARTISTS[main], name: main };
    for (const k of Object.keys(ARTISTS)) {
      if (k.length >= 5 && (n.startsWith(k + ' ') || n.endsWith(' ' + k) || n.includes(' ' + k + ' '))) return { style: ARTISTS[k], name: k };
    }
    return null;
  }

  function matchKeywords(text) {
    const n = norm(text);
    for (const [re, style] of KEYWORDS) if (re.test(n)) return style;
    return null;
  }

  function resolveGeneric(style, bpm) {
    if (style !== 'sertanejo') return style;
    if (bpm && bpm <= 88) return 'sofrencia';
    return 'sert-univ';
  }

  /**
   * @param {object} t  { genreTag, artist, title, path, bpm }
   * @returns {{ style:string, reason:string, confidence:number }}
   */
  function classify(t) {
    // 1. artista conhecido (mais confiável que a tag, que costuma vir errada em MP3 baixado)
    const a = matchArtist(t.artist);
    if (a) return { style: a.style, reason: 'artista: ' + a.name, confidence: 0.9 };
    // 2. tag de gênero
    if (t.genreTag) {
      const k = matchKeywords(t.genreTag);
      if (k) return { style: resolveGeneric(k, t.bpm), reason: 'tag: ' + t.genreTag, confidence: 0.75 };
    }
    // 3. nome do arquivo / pastas / título
    const k2 = matchKeywords([t.path, t.title].filter(Boolean).join(' '));
    if (k2) return { style: resolveGeneric(k2, t.bpm), reason: 'nome/pasta', confidence: 0.5 };
    // 4. artista no nome do arquivo (ex: "Gusttavo Lima - Tchê Tcherere")
    const fa = matchArtist(Tags.fromFilename(t.path.split('/').pop()).artist);
    if (fa) return { style: fa.style, reason: 'artista no nome: ' + fa.name, confidence: 0.7 };
    return { style: 'outros', reason: 'sem pista (escolha manualmente)', confidence: 0 };
  }

  return { STYLES, byId, classify, norm };
})();
