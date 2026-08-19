// Service worker for Team Pelagio Fiskeräknare.
//
// Why this exists: the manifest.json alone makes the app *installable*, but
// without a service worker the installed icon is still just a browser
// navigating to a URL — with zero signal (airplane mode, dead zone out on the
// water) it would fail to load at all. This makes the app shell load from a
// local cache instantly, every time, regardless of connectivity.
//
// Strategy: stale-while-revalidate. Every request below is answered from the
// cache immediately if present (fast, works fully offline), while a fresh
// copy is fetched in the background to update the cache for next time — so
// the app stays reasonably current without ever blocking on the network.
const CACHE_NAME = 'pelagio-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting(); // activate this version immediately, don't wait for old tabs to close
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only GET requests to our own scope get the cache treatment. Critically,
  // this leaves the POST export call to Apps Script completely untouched —
  // it always goes straight to the network, exactly as before.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline with no exact cache match: nothing more we can do

      return cached || networkFetch;
    })
  );
});
