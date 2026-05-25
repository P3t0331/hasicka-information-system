import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';

clientsClaim();

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
        denylist: [/^\/api\//],
    })
);

registerRoute(
    ({ url }) => /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\//.test(url.href),
    new NetworkOnly()
);

self.addEventListener('push', (event) => {
    if (!event.data) return;
    const { title, body, url, tag } = event.data.json();
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-64x64.png',
            tag: tag || 'default',
            renotify: true,
            data: { url },
            actions: [
                { action: 'open', title: 'Zobrazit' },
                { action: 'dismiss', title: 'Zavřít' },
            ],
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
