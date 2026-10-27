// Trí Planner service worker: lets the app open without internet once installed.
// Bump VERSION whenever index.html changes so devices pick up the new copy.
const VERSION = "tri-planner-v5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// tapping a reminder opens (or focuses) the app on the right tab
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || 1;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { c.postMessage({ tab }); return c.focus(); }
    return self.clients.openWindow("./#" + tab);
  }));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // app page: try the network first so updates arrive, fall back to the saved copy offline
  if (req.mode === "navigate") {
    // "no-cache" makes the browser re-check GitHub Pages, so a new upload shows up on the next open
    e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // own files and Google Fonts: serve the saved copy, refresh it in the background
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })
        .catch(() => hit);
      return hit || net;
    }));
  }
});
