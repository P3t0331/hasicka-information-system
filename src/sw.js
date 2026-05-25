import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

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
    const { title, body, url } = event.data.json();
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-64x64.png',
            data: { url },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url;
    if (url) event.waitUntil(clients.openWindow(url));
});
