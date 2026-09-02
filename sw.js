const CACHE = 'legacy-forge-v1.1.0';
const CACHE_PREFIX = 'legacy-forge-';
const APP_SHELL = './index.html';
const CORE_ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './src/main.js', './src/data.js', './src/utils.js', './src/validation.js',
  './src/storage.js', './src/render.js', './src/fusion.js', './src/audio.js',
  './src/arena.js'
];
const CORE_URLS = new Set(CORE_ASSETS.map(asset => new URL(asset, self.location.href).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    const url = new URL(request.url);
    const scope = new URL(self.registration.scope);
    const shell = new URL(APP_SHELL, scope);
    const isShell = (url.pathname === scope.pathname || url.pathname === shell.pathname) &&
      response.headers.get('content-type')?.includes('text/html');
    if (response.ok && isShell) {
      await cache.put(APP_SHELL, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(APP_SHELL)) || Response.error();
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (CORE_URLS.has(request.url)) event.respondWith(networkFirstAsset(request));
});
