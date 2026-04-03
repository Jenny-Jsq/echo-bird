/**
 * IndexedDB corpus v2: { text, count, firstSeen, lastSeen }; max 200; evict oldest lastSeen.
 */
(function (global) {
  const DB_NAME = 'echoBirdDB';
  const DB_VERSION = 2;
  const STORE = 'tokens';
  const MAX = 200;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldV = e.oldVersion;

        if (oldV < 1) {
          db.createObjectStore(STORE, { keyPath: 'text' });
        } else if (oldV < 2) {
          const tx = e.target.transaction;
          const store = tx.objectStore(STORE);
          const buf = [];
          const creq = store.openCursor();
          creq.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
              buf.push(cursor.value);
              cursor.continue();
            } else {
              db.deleteObjectStore(STORE);
              const ns = db.createObjectStore(STORE, { keyPath: 'text' });
              for (const row of buf) {
                if (row && typeof row.count === 'number' && row.text) {
                  ns.put(row);
                } else if (row && row.token) {
                  ns.put({
                    text: row.token,
                    count: 2,
                    firstSeen: 0,
                    lastSeen: row.lastUsed || Date.now(),
                  });
                }
              }
            }
          };
        }
      };
    });
  }

  function getAllRecords(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function count() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function incrementTokens(tokenList) {
    const unique = [...new Set((tokenList || []).filter(Boolean))];
    if (!unique.length) return;

    const db = await openDb();
    const now = Date.now();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      for (const text of unique) {
        const g = os.get(text);
        g.onsuccess = () => {
          const prev = g.result;
          if (prev) {
            os.put({
              text,
              count: prev.count + 1,
              firstSeen: prev.firstSeen,
              lastSeen: now,
            });
          } else {
            os.put({ text, count: 1, firstSeen: now, lastSeen: now });
          }
        };
        g.onerror = () => reject(g.error);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await trimToMax(await openDb());
  }

  async function trimToMax(db) {
    const n = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (n <= MAX) return;

    const all = await getAllRecords(db);
    all.sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0));
    const remove = all.slice(0, n - MAX);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      for (const r of remove) os.delete(r.text);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getStats() {
    const rows = await getAllRecords(await openDb());
    let mastered = 0;
    let learning = 0;
    for (const r of rows) {
      if (r.count >= 2) mastered += 1;
      else if (r.count === 1) learning += 1;
    }
    return { mastered, learning, total: rows.length };
  }

  async function getMasteredTexts() {
    const rows = await getAllRecords(await openDb());
    return rows.filter((r) => r.count >= 2).map((r) => r.text);
  }

  async function clear() {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  global.EchoBirdCorpus = {
    openDb,
    count,
    incrementTokens,
    getStats,
    getMasteredTexts,
    clear,
    MAX,
  };
})(typeof self !== 'undefined' ? self : this);
