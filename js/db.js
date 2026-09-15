/* Persistência local (IndexedDB): faixas analisadas, playlists e configurações. */
const DB = (() => {
  const NAME = 'julianamix', VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      try { out = fn(s); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  return {
    async get(store, key) { const db = await open(); return wrap(db.transaction(store).objectStore(store).get(key)); },
    async getAll(store) { const db = await open(); return wrap(db.transaction(store).objectStore(store).getAll()); },
    put(store, value, key) { return tx(store, 'readwrite', s => key === undefined ? s.put(value) : s.put(value, key)); },
    del(store, key) { return tx(store, 'readwrite', s => s.delete(key)); },
    clear(store) { return tx(store, 'readwrite', s => s.clear()); },
  };
})();
