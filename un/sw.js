// KGM 성수 내부 페이지 — Service Worker
// /un/ 경로만 가로챔. un-v2/ 테스트 환경과 캐시 분리.

const CACHE_VERSION = 'v96-2026-05-29-strip-fit';
const CACHE_NAME = `kgm-seongsu-un-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app-module.js',
  './app-pages.js',
  './app-insurance.js',
  './app-features.js',
  './work-codes-data.js',
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
        // 운영 캐시만 정리 — un-v2/ 캐시는 손대지 않음
        keys.filter((k) => k.startsWith('kgm-seongsu-un-') && !k.startsWith('kgm-seongsu-un-v2-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 동일 출처 + /un/ 범위만 가로챔. /un-v2/, 루트, 다른 경로는 통과.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/un/')) return;
  if (url.pathname.startsWith('/un-v2/')) return;

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
