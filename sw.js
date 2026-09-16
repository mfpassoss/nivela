/* Service worker do Nivela: deixa o app abrir sem internet e atualiza sozinho quando há versão nova. */
const VERSION = 'nivela-v1';
const SHELL = ['./', './index.html', './css/style.css', './manifest.webmanifest',
  './js/db.js', './js/tags.js', './js/genres.js', './js/analyzer.js', './js/player.js', './js/app.js', './js/pwa.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

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
  } else if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    // fontes: cache primeiro, atualiza em segundo plano
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
