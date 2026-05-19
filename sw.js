// OVERCLOCK service worker — offline cache + scheduled (background) notifications
const CACHE = 'overclock-v7';

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Network-first, fall back to cache (keeps the app usable offline)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Allow the page to schedule a timed notification even if it gets frozen/closed.
// Primary path uses the Notification Triggers API (TimestampTrigger); if that is
// unavailable the page keeps its in-app fallback.
self.addEventListener('message', async (e) => {
  const d = e.data || {};
  const reg = self.registration;
  if (d.type === 'schedule') {
    try {
      const opts = {
        body: d.body || '',
        tag: d.tag || 'overclock-timer',
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 150, 400, 150, 600],
        icon: d.icon,
        badge: d.icon,
        data: { kind: d.kind || 'timer' },
      };
      if ('showTrigger' in Notification.prototype && d.at) {
        opts.showTrigger = new TimestampTrigger(d.at);
      }
      await reg.showNotification(d.title || 'OVERCLOCK', opts);
    } catch (err) { /* trigger unsupported — page handles fallback */ }
  } else if (d.type === 'cancel') {
    const tag = d.tag || 'overclock-timer';
    const list = await reg.getNotifications({ tag, includeTriggered: true });
    list.forEach(n => n.close());
  }
});

// Tapping the notification focuses (or opens) the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
  })());
});
