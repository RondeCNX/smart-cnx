// sw.js
const CACHE_NAME = 'smart-cnx-v1';
const ASSETS_ESSENCIAIS = [
    '/',
    '/index.html',
    '/admin/index.html',
    '/manifest.json',
    '/assets/imagens/Logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_ESSENCIAIS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Ignora chamadas que não sejam GET e qualquer requisição externa (Supabase, CDNs, etc.)
    if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
        return;
    }

    // Network-First: tenta buscar sempre o arquivo atualizado; se estiver offline, usa o cache
    event.respondWith(
        fetch(req)
            .then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                return res;
            })
            .catch(() => caches.match(req))
    );
});