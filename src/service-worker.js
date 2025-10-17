const CACHE_NAME = 'pokepwa-v2';
const API_CACHE_NAME = 'pokeapi-v2';

// Archivos para cachear inmediatamente
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/pokeball.png',
  '/pokeball-192.png', 
  '/pokeball-512.png'
];

// Instalación - Cachear recursos esenciales
self.addEventListener('install', (event) => {
  console.log('Service Worker instalándose...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Todos los recursos cacheados');
        return self.skipWaiting();
      })
  );
});

// Activación - Limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker listo para controlar clientes');
      return self.clients.claim();
    })
  );
});

// Estrategia de Cache: Network First con fallback a Cache
self.addEventListener('fetch', (event) => {
  // Ignorar solicitudes que no son GET
  if (event.request.method !== 'GET') return;

  // Para la API de Pokémon
  if (event.request.url.includes('pokeapi.co')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            // Si la respuesta es válida, guardar en cache
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Si falla la red, devolver desde cache
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Si no hay en cache, devolver una respuesta de fallback
              return new Response(
                JSON.stringify({ 
                  error: 'No hay conexión y no hay datos en cache',
                  results: [] 
                }),
                {
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          });
      })
    );
    return;
  }

  // Para otros recursos (HTML, CSS, JS, imágenes)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devolver desde cache si existe
        if (response) {
          return response;
        }

        // Si no está en cache, hacer fetch y guardar en cache
        return fetch(event.request).then((response) => {
          // Verificar si la respuesta es válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clonar la respuesta para guardar en cache
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Fallback para páginas - devolver la página principal
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});

// Manejar mensajes desde la aplicación
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});