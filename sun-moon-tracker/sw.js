// Stellar Vista PWA Service Worker
const BUILD_VERSION = 'v2.3-20261010-stellar-vista';
const CACHE_NAME = `stellar-vista-${BUILD_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './feature_config.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './i18n/en.json',
  './i18n/ja.json',
  './i18n/vi.json',
  './i18n/zh-CN.json',
  './i18n/zh-TW.json',
  './js/engine/astronomy.js',
  './js/engine/declination.js',
  './js/engine/meteor_shower.js',
  './js/ar/quat.js',
  './js/ar/math3d.js',
  './js/ar/sky_sphere.js',
  './js/ar/orientation_fusion.js',
  './js/ar/ar_view.js',
  './js/ar/compass_3d.js',
  './js/ui/i18n.js',
  './js/ui/feature_gate.js',
  './js/ui/field_kit.js',
  './js/ui/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First with Cache Fallback for HTML, JS, CSS, JSON
// Ensures newly deployed versions immediately reach mobile PWA users while retaining offline resilience
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Non-GET requests should bypass cache
  if (request.method !== 'GET') {
    return;
  }

  // Same-origin dynamic assets: network-first, fallback to cache
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        })
    );
  } else {
    // Third-party (e.g. Google Fonts): Cache-first with network fallback
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resp;
        }).catch(() => null);
      })
    );
  }
});
