/* Instalação como aplicativo e atualização automática. */
(() => {
  const btn = document.getElementById('btnInstall');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.classList.remove('hidden'); });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') btn.classList.add('hidden');
    deferred = null;
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));

  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const t = document.getElementById('toast');
            t.innerHTML = 'Nova versão pronta. <a href="#" style="color:var(--amber)">Recarregar</a>';
            t.style.pointerEvents = 'auto'; t.classList.add('show');
            t.querySelector('a').onclick = ev => { ev.preventDefault(); location.reload(); };
          }
        });
      });
    } catch (e) { console.warn('service worker', e); }
  });
})();
