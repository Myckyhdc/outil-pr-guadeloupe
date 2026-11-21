/* Outil PR – Routes de Guadeloupe : fonctionnement hors connexion.
   À chaque mise à jour importante du site, augmentez le numéro de VERSION
   pour que les téléphones récupèrent la nouvelle version. */
const VERSION = 'v1';
const CACHE = 'outil-pr-' + VERSION;

const ESSENTIELS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ESSENTIELS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n.startsWith('outil-pr-') && n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // Pages : on essaie le réseau (version la plus récente), sinon la copie enregistrée.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copie));
        return res;
      }).catch(() =>
        caches.match(req)
          .then((r) => r || caches.match('./index.html'))
          .then((r) => r || caches.match('./'))
          .then((r) => r || Response.error())
      )
    );
    return;
  }

  // Autres fichiers (données des routes, modèle PDF, scripts, bibliothèques) :
  // réponse immédiate depuis la copie enregistrée, mise à jour en arrière-plan.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((enCache) => {
        const reseau = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => enCache || Response.error());
        return enCache || reseau;
      })
    )
  );
});
