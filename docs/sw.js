// Service worker：離線快取 + 收推送時隨機抽一張卡做通知
importScripts("./db.js");

const VERSION = "v23";
const SHELL = "zhishi-shell-" + VERSION;
const RUNTIME = "zhishi-runtime";
const SHELL_FILES = [
  "./", "./index.html", "./db.js", "./manifest.webmanifest", "./bg.svg?v=town2", "./scroll-cap-l.svg?v=3", "./scroll-cap-r.svg?v=3", "./scroll-mid.svg?v=3",
  "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/badge-96.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("zhishi-shell-") && k !== SHELL) await caches.delete(k);
    // 已移除影相轉文字：清走之前快取嘅辨識程式同資料
    const rt = await caches.open(RUNTIME);
    for (const r of await rt.keys()) if (r.url.includes("/vendor/")) await rt.delete(r);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // 頁面本身：先試網絡（有更新就攞新版），斷網用快取
  if (req.mode === "navigate") {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {   // 有網就一定問伺服器攞最新版
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put("./index.html", copy));
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  // 其他：先俾快取，背景更新
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(isFont ? RUNTIME : SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});

async function pickCard() {
  const cards = await ZDB.all();
  if (!cards.length) return null;
  const last = await ZDB.getKV("lastNotified");
  const pool = cards.length > 1 ? cards.filter(c => c.id !== last) : cards;
  const c = pool[Math.floor(Math.random() * pool.length)];
  await ZDB.setKV("lastNotified", c.id);
  return c;
}

self.addEventListener("push", e => {
  // iPhone 規定：每次收到推送都一定要彈通知，否則會被取消訂閱
  e.waitUntil((async () => {
    let c = null;
    try { c = await pickCard(); } catch (err) { /* 讀唔到就用預設內容 */ }
    const body = c ? c.text.replace(/\s+/g, " ").slice(0, 180) : "未有卡。打開 app 加一張啦。";
    await self.registration.showNotification("知識抽卡", {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/badge-96.png",
      tag: "zhishi-random",
      data: { id: c ? c.id : null },
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  const target = new URL("./" + (id ? "?card=" + encodeURIComponent(id) : ""), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        w.postMessage({ type: "show-card", id });
        return w.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
