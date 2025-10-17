// Service Worker mínimo para PWA
const CACHE_NAME = 'pokepwa-v1';
const urlsToCache = ['/', '/static/js/bundle.js', '/static/css/main.css'];

this.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

this.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});