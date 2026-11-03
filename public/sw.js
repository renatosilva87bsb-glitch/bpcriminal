const CACHE_NAME = 'bp-advocacia-public-v3';
const PUBLIC_SHELL = [
  '/',
  '/direito-criminal.html',
  '/areas-de-atuacao.html',
  '/legislacao.html',
  '/privacidade.html',
  '/404.html',
  '/manifest.webmanifest',
  '/assets/site.css',
  '/assets/themes.css',
  '/assets/site.js',
  '/assets/theme.js',
  '/assets/pwa.js',
  '/assets/legal.css',
  '/assets/legal.js',
  '/assets/inner.css'
];
const PUBLIC_PAGES = new Set(PUBLIC_SHELL.filter(path => path.endsWith('.html') || path === '/'));

const isPrivatePath = pathname => pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api' || pathname.startsWith('/api/');
const isPublicPage = pathname => PUBLIC_PAGES.has(pathname) || (pathname.endsWith('.html') && !isPrivatePath(pathname));
const isPublicAsset = pathname => pathname.startsWith('/assets/') && !isPrivatePath(pathname);
const isCacheable = request => request.mode === 'navigate' ? isPublicPage(new URL(request.url).pathname) : isPublicAsset(new URL(request.url).pathname);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PUBLIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || isPrivatePath(url.pathname) || !isCacheable(request)) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('/');
        return Response.error();
      }))
  );
});

self.addEventListener('push', event => {
  let payload = { title: 'B&P Advocacia', body: 'Você tem uma nova notificação institucional.', url: '/' };
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch {}
  const safeUrl = typeof payload.url === 'string' && payload.url.startsWith('/') && !payload.url.startsWith('//') && !isPrivatePath(payload.url) ? payload.url : '/';
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0, 80), {
    body: String(payload.body).slice(0, 180),
    icon: '/assets/pwa/icon-192.png',
    badge: '/assets/pwa/icon-192.png',
    data: { url: safeUrl },
    tag: 'bp-institutional',
    renotify: false
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const requestedUrl = event.notification.data && event.notification.data.url;
  const url = typeof requestedUrl === 'string' && requestedUrl.startsWith('/') && !requestedUrl.startsWith('//') && !isPrivatePath(requestedUrl) ? requestedUrl : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
      return existing ? existing.focus().then(client => client.navigate(url)) : clients.openWindow(url);
    })
  );
});
