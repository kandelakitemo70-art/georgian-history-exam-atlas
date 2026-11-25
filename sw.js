/* Offline support: the app shell is cached on install; maps, tests and images are cached as they are opened
   (stale-while-revalidate), so anything seen once also works without a connection. */
const VERSION = 'v2-2026-11-26';
const SHELL = 'shell-' + VERSION, RUNTIME = 'runtime-' + VERSION;
const SHELL_FILES = ['./', 'index.html', 'assets/style.css', 'assets/app.js', 'assets/tests.js', 'assets/vendor/d3.min.js',
  'data/catalog.js', 'data/tests/index.js', 'manifest.webmanifest', 'assets/icons/icon.svg', 'assets/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return;
  // pages: network first (fresh content), cache as fallback
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(SHELL).then(s => s.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  // everything else: cached copy at once, refreshed in the background
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(RUNTIME).then(s => s.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
// "save everything for offline" from the about page
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'cache-all' || !Array.isArray(e.data.urls)) return;
  const port = e.ports && e.ports[0];
  e.waitUntil((async () => {
    const c = await caches.open(RUNTIME);
    let done = 0;
    for (const u of e.data.urls) {
      try { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } } catch (err) { /* skip */ }
      done++;
      if (port && (done % 10 === 0 || done === e.data.urls.length)) port.postMessage({ done, total: e.data.urls.length });
    }
  })());
});
