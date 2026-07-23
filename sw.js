// OVERCLOCK service worker — offline cache + scheduled (background) notifications
const CACHE = 'overclock-v7-72-0';

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
  const baseOpts = (d) => {
    // quiet = devam eden sayaç bildirimi: renotify KAPALI → aynı tag'li bildirim
    // yukarıdan tekrar düşmez, sadece YERİNDE güncellenir (Spotify tarzı).
    const o = {
      body: d.body || '',
      tag: d.tag || 'overclock-timer',
      renotify: d.quiet ? false : !d.silent,
      requireInteraction: d.quiet ? true : !d.silent,
      vibrate: (d.silent || d.quiet) ? undefined : [500, 200, 500, 200, 700],
      silent: !!(d.silent || d.quiet),
      icon: d.icon,
      badge: d.icon,
      data: { kind: d.kind || 'timer' },
    };
    if (d.image) o.image = d.image;   // yumuşak arkaplan banner görseli
    return o;
  };
  if (d.type === 'schedule') {
    // ONLY schedule when real Notification Triggers exist. Without it, showing
    // here would fire immediately (the bug) — so we skip and let the page's
    // precise setTimeout fallback handle it instead.
    if (!('showTrigger' in Notification.prototype) || !d.at) return;
    try {
      const opts = baseOpts(d);
      opts.showTrigger = new TimestampTrigger(d.at);
      await reg.showNotification(d.title || 'OVERCLOCK', opts);
    } catch (err) { /* trigger failed — page fallback covers it */ }
  } else if (d.type === 'notify') {
    // fire NOW (used by the page fallback at the real end moment)
    try { await reg.showNotification(d.title || 'OVERCLOCK', baseOpts(d)); }
    catch (err) {}
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
