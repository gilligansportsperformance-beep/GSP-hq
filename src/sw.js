/* GSP HQ service worker — offline-first app shell */
const CACHE = 'phq-__VERSION__';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'fonts/bebas-neue.woff2', 'fonts/dm-sans.woff2', 'fonts/dm-serif-display.woff2', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never saves a stale page
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Pages: open instantly from the saved copy (works offline and on weak gym signal),
  // and refresh the saved copy in the background so the next launch has any update.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const saved = (await cache.match('index.html')) || (await cache.match('./'));
      const network = fetch(req).then(res => {
        // Safari refuses redirected responses for page loads, so never store one
        if (res.ok && !res.redirected) cache.put('index.html', res.clone());
        return res;
      });
      if (saved) { e.waitUntil(network.catch(() => {})); return saved; }
      try { return await network; }
      catch { return new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font:16px -apple-system,sans-serif;padding:40px;text-align:center"><h2>You’re offline</h2><p>Open GSP HQ once with an internet connection so it can be saved on this device. After that it works offline.</p>', { headers: { 'content-type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  // Static assets: cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
