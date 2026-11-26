// =====================================================================
// Service worker — небольшой помощник, который сохраняет файлы сайта
// в кэш браузера. Благодаря ему сайт открывается и без интернета.
// Данные пользователя здесь НЕ хранятся — только файлы самого сайта.
// =====================================================================

// При выпуске новой версии сайта поменяйте номер — старый кэш удалится.
const CACHE_NAME = 'laboratoriya-v1';

// При установке сохраняем главную страницу.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html'])));
  self.skipWaiting();
});

// При активации удаляем кэши старых версий.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Запросы файлов: сначала пробуем сеть (чтобы получать обновления),
// при неудаче (нет интернета) берём из кэша.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Работаем только с обычными запросами к своему же сайту.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
