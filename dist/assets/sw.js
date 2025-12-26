const CACHE_NAME = 'zengo-v3';
// Use explicit relative paths for files to ensure matching with manifest.json
const URLS_TO_CACHE = [
  '/weiqi-hbwd/dist/index.html',
  '/weiqi-hbwd/dist/assets/manifest.json'
];

// Install event: Cache core static assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force this SW to become the active one immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache v3');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Immediately control all open clients
});

// Fetch event: Network first, fall back to cache. 
// Also cache 3rd party CDN resources (esm.sh, tailwind) dynamically.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors' && response.type !== 'opaque') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache resources from esm.sh, tailwind, fonts, etc.
            const url = new URL(event.request.url);
            if (url.origin.includes('esm.sh') || 
                url.origin.includes('tailwindcss.com') || 
                url.origin.includes('googleapis.com') || 
                url.origin.includes('gstatic.com') ||
                url.origin.includes('flaticon.com')) {
                
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
            }

            return response;
          }
        ).catch(() => {
            // If offline and request fails, try to serve index.html for navigation requests
            if (event.request.mode === 'navigate') {
                // Must match the exact string in URLS_TO_CACHE
                return caches.match('./index.html'); 
            }
        });
      })
  );
});
