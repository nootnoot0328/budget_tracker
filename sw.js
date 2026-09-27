/* Budget Margin 4 service worker: app shell cached for offline use; data never touches it. */
const CACHE = "budget-margin-shell-v40";
const SHELL = [
  "./", "./index.html", "./css/app.css", "./manifest.webmanifest",
  "./js/main.js", "./js/util.js", "./js/state.js", "./js/calc.js", "./js/ai.js", "./js/imports.js", "./js/proposals.js",
  "./js/ui/core.js", "./js/ui/entry.js", "./js/ui/home.js", "./js/ui/activity.js", "./js/ui/plan.js", "./js/ui/importui.js", "./js/ui/ask.js", "./js/ui/settings.js",
  "./icon-180.png", "./icon-192.png", "./icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && (k.startsWith("budget-margin-shell-") || k.startsWith("margin-shell-"))).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("message", event => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Worker calls, pdf.js CDN: straight to the network
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res; }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(req).then(cached => {
    const fresh = fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
