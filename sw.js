// 손주마켓 서비스워커 — PWA 설치 조건을 만족시키는 최소 구성
// (Chrome 설치 팝업이 뜨려면 fetch 핸들러가 등록되어 있어야 함)
// 경로는 sw.js 위치 기준 상대경로 → 어느 호스트/하위폴더에 올려도 작동
const CACHE = 'sonju-v1';
const ASSETS = ['./', 'index.html', 'app.html', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('app.html')))
  );
});
