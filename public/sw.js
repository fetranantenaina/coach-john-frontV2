// Service worker Coach John : l'app reste ouvrable hors-ligne (coquille + derniers fichiers vus).
// Réseau d'abord (jamais de version périmée), cache en secours. L'API et le WebSocket ne sont jamais mis en cache.
const C = 'coach-john-v2';
const PRE = ['/', '/manifest.json', '/logo.png', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(PRE))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /^\/(api|socket\.io)/.test(u.pathname)) return;
  const cle = r.mode === 'navigate' ? '/' : r; // toutes les routes de l'app servent index.html
  e.respondWith(fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(C).then(ch => ch.put(cle, c)); } return x; })
    .catch(() => caches.match(cle)));
});
