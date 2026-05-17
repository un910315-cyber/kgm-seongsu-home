// KGM 성수 내부 페이지 — Service Worker
// 앱 셸(HTML/manifest/icons)만 캐시. Firebase·외부 CDN은 자체 캐시·재시도.

const CACHE_VERSION = 'v1-2026-05-17';
const CACHE_NAME = `kgm-seongsu-un-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('kgm-seongsu-un-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 동일 출처 + /un/ 범위만 가로챔. 다른 경로(루트 사이트 등)는 그대로 통과.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/un/')) return;

  if (req.mode === 'navigate') {
    // 네비게이션은 network-first → 오프라인일 때만 캐시 fallback
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
