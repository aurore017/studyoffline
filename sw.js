/* ==========================================================================
   SERVICE WORKER
   --------------------------------------------------------------------------
   Keeps a copy of the app's own files (page, styles, scripts, icons) on the
   device the first time it is opened online. After that the app opens even
   with no internet at all.

   IMPORTANT: when you change any app file, change CACHE_VERSION below so
   devices download the new files.
   ========================================================================== */
var CACHE_VERSION = 'v4';
var CACHE_NAME = 'studyoffline-shell-' + CACHE_VERSION;

var APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/store.js',
  'js/audit.js',
  'js/network.js',
  'js/server.js',
  'js/auth.js',
  'js/content.js',
  'js/sync.js',
  'js/ui.js',
  'js/main.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names
          .filter(function (n) { return n.indexOf('studyoffline-shell-') === 0 && n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // ping.txt is how the app checks for real internet: never answer it from the cache.
  if (url.pathname.slice(-8) === 'ping.txt') return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(req).catch(function () {
        // offline and not cached: for page loads, show the app
        if (req.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
