// FoodWeb Pro — Service Worker
// Estrategia: Cache-First para activos estáticos, Network-First para la API

const CACHE_NAME = 'foodweb-pro-v2';
const STATIC_ASSETS = [
    '/foodweb-pro.html',
    '/styles.css',
    '/script.js',
    '/api.js',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// ─── INSTALL: Pre-cachear activos estáticos ───────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando FoodWeb Pro PWA...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-cacheando activos estáticos');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Activar inmediatamente sin esperar que se cierren pestañas anteriores
    self.skipWaiting();
});

// ─── ACTIVATE: Limpiar caches antiguas ───────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando nueva versión...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Eliminando cache antigua:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    // Tomar control de todas las pestañas de inmediato
    self.clients.claim();
});

// ─── FETCH: Estrategia inteligente por tipo de solicitud ─────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignorar solicitudes POST, PUT, DELETE, etc. Solo cacheamos GET.
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // 1. Llamadas a la API → Network-First (datos siempre frescos)
    //    Si no hay red, devuelve respuesta de error de gracia
    if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
        event.respondWith(
            fetch(request)
                .then((response) => response)
                .catch(() => {
                    // Sin conexión: devolver página de error amigable solo para navegación
                    if (request.mode === 'navigate') {
                        return caches.match('/foodweb-pro.html');
                    }
                    return new Response(JSON.stringify({ error: 'Sin conexión a internet' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // 2. Activos estáticos → Cache-First (carga instantánea)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Sirviendo desde caché — actualizar en segundo plano
                fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
                        }
                    })
                    .catch(() => { }); // Silencioso si no hay red
                return cachedResponse;
            }

            // No está en caché → buscar en red y guardar
            return fetch(request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                    return networkResponse;
                }
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                return networkResponse;
            });
        })
    );
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'FoodWeb Pro';
    const options = {
        body: data.body || 'Tienes una nueva notificación',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/foodweb-pro.html' }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ─── CLICK EN NOTIFICACIÓN ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url || '/foodweb-pro.html');
            }
        })
    );
});
