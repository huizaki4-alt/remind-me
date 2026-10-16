// 本地資料庫（IndexedDB）。頁面同 service worker 共用，咁通知先可以喺背景抽卡。
const ZDB = (() => {
  const NAME = "zhishi", VER = 1;
  let pending = null;

  function open() {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("cards")) db.createObjectStore("cards", { keyPath: "id" });
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); pending = null; };
        resolve(db);
      };
      req.onerror = () => { pending = null; reject(req.error); };
    });
    return pending;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      let result;
      const r = fn(os);
      if (r) r.onsuccess = () => { result = r.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("aborted"));
    });
  }

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  return {
    newId,
    all: () => run("cards", "readonly", os => os.getAll()).then(r => r || []),
    get: id => run("cards", "readonly", os => os.get(id)),
    put: card => run("cards", "readwrite", os => os.put(card)),
    remove: id => run("cards", "readwrite", os => os.delete(id)),
    putMany: cards => run("cards", "readwrite", os => { for (const c of cards) os.put(c); }),
    clear: () => run("cards", "readwrite", os => os.clear()),
    getKV: key => run("kv", "readonly", os => os.get(key)),
    setKV: (key, val) => run("kv", "readwrite", os => os.put(val, key)),
  };
})();
