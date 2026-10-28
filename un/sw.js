// KGM 성수 내부 페이지 — Service Worker
// /un/ 경로만 가로챔. un-v2/ 테스트 환경과 캐시 분리.

const CACHE_VERSION = 'v204-2026-10-28';
const CACHE_NAME = `kgm-seongsu-un-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './design-refresh.css',
  './app-module.js',
  './app-safety.js',
  './leave-calculation.js',
  './app-pages.js',
  './app-ops-calendar.js',
  './ops-calendar.css',
  './app-insurance.js',
  './app-maintenance.js',
  './app-features.js',
  './app-workcodes-ui.js',
  './app-labor-search.js',
  './labor-search.css',
  './repair-guide-config.js',
  './app-repair-guide.js',
  './repair-guide/index.html',
  './repair-guide/staff.js',
  './repair-guide/presets.js',
  './repair-guide/staff.css',
  './work-codes-data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
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

  // Repair guide must use current mode/permissions rather than an older cached script.
  if (url.pathname.startsWith('/un/repair-guide/')) {
    event.respondWith(fetch(new Request(req, {cache:'no-store'})));
    return;
  }

  if (req.mode === 'navigate') {
    // 네비게이션은 network-first → 오프라인일 때만 캐시 fallback
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 새 배포의 HTML이 다른 버전(?v=)의 파일을 요청하면 이 서비스워커의 저장본은 옛 버전이다.
  // 그때는 저장본을 주지 않고 서버에서 받는다 (배포 직후 새 HTML + 옛 JS가 섞이던 문제).
  const askedVersion = url.searchParams.get('v');
  if (askedVersion && askedVersion !== CACHE_VERSION) {
    event.respondWith(
      fetch(new Request(req, { cache: 'no-store' })).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    // ignoreSearch: HTML이 ?v= 캐시버스터를 붙여 요청하므로 프리캐시(쿼리 없음)와 키를 맞춤.
    // CACHE_VERSION을 ?v와 함께 범프하는 것이 전제 (배포 관습).
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // 페이지가 지금 자기를 맡은 서비스워커의 버전을 묻는다 (index.html 맨 위 확인 코드)
  if (event.data === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage(CACHE_VERSION);
});
