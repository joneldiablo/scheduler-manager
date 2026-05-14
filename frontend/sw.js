const CACHE_NAME = 'alchemist-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/script.js',
  '/assets/app-state.js',
  '/assets/app-computed.js',
  '/assets/app-methods-auth.js',
  '/assets/app-methods-ui.js',
  '/assets/app-methods-tasks.js',
  '/assets/app-methods-scheduler.js',
  '/assets/endpoint-config.js',
  '/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
