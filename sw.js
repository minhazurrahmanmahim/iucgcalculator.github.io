const CACHE = 'iu-cgpa-v9';
const ASSETS = [
  './', 'index.html', 'css/style.css?v=9', 'js/data.js?v=9', 'js/app.js?v=9', 'manifest.webmanifest',
  'assets/logo.png', 'assets/fonts/LiberationSans-Regular.woff', 'assets/fonts/LiberationSans-Bold.woff',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => { }))))   // a missing file (e.g. logo) must not break install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fast on slow mobile data:
   - the page (index.html): try the network for max 2.5 s, otherwise use the saved copy instantly
   - styles/scripts (…?v=9), fonts, images, icons: saved copy first. To publish a change, bump ?v=9 in index.html AND CACHE below */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('timeout')), ms); promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); }); });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/_vercel/')) return;                    // analytics: let the browser handle it
  const isStatic = /\.(woff2?|ttf|png|jpe?g|webp|svg|ico)$/i.test(url.pathname) || url.searchParams.has('v');   // versioned files never change
  const store = res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
  if (isStatic) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(store)));
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(store);
      if (!hit) return net;
      return withTimeout(net, 2500).catch(() => hit);
    }).catch(() => caches.match('index.html'))
  );
});
