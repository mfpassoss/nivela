/* Service worker do Nivela: deixa o app abrir sem internet e atualiza sozinho quando há versão nova. */
const VERSION = 'nivela-v6';
const SHELL = ['./', './index.html', './tela.html', './css/style.css', './manifest.webmanifest',
  './js/db.js', './js/zip.js', './js/tags.js', './js/genres.js', './js/analyzer.js', './js/player.js', './js/app.js', './js/pwa.js', './js/tela.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './fonts/fonts.css',
  './fonts/BigShouldersDisplay-500-latin-ext.woff2', './fonts/BigShouldersDisplay-500-latin.woff2', './fonts/BigShouldersDisplay-700-latin-ext.woff2', './fonts/BigShouldersDisplay-700-latin.woff2', './fonts/BigShouldersDisplay-900-latin-ext.woff2', './fonts/BigShouldersDisplay-900-latin.woff2', './fonts/InstrumentSans-400-latin-ext.woff2', './fonts/InstrumentSans-400-latin.woff2', './fonts/InstrumentSans-400i-latin-ext.woff2', './fonts/InstrumentSans-400i-latin.woff2', './fonts/InstrumentSans-500-latin-ext.woff2', './fonts/InstrumentSans-500-latin.woff2', './fonts/InstrumentSans-600-latin-ext.woff2', './fonts/InstrumentSans-600-latin.woff2', './fonts/JetBrainsMono-400-latin-ext.woff2', './fonts/JetBrainsMono-400-latin.woff2', './fonts/JetBrainsMono-600-latin-ext.woff2', './fonts/JetBrainsMono-600-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // arquivos do app: rede primeiro (pega atualização), cache se estiver sem internet
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  }
});
