const workerUrl = new URL(self.location.href);
const buildVersion = workerUrl.searchParams.get('v') || 'standalone';
const cachePrefix = 'simontok-shell-';
const cacheName = cachePrefix + buildVersion;
const offlinePage = '/offline.html';
const shellFiles = [
    offlinePage,
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(cacheName).then((cache) => cache.addAll(shellFiles)),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith(cachePrefix) &&
                                key !== cacheName,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(offlinePage)),
        );
        return;
    }

    if (!url.pathname.startsWith('/build/assets/')) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(request).then((response) => {
                if (!response.ok || response.type !== 'basic') {
                    return response;
                }

                const copy = response.clone();
                event.waitUntil(
                    caches
                        .open(cacheName)
                        .then((cache) => cache.put(request, copy)),
                );

                return response;
            });
        }),
    );
});
