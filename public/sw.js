/* MeshMaps service worker — offline shell + tile cache (idea 61) */
const VERSION = 'meshmaps-v1'
const SHELL = ['/', '/index.html', '/logo.svg', '/manifest.webmanifest']
const TILE_CACHE = `${VERSION}-tiles`
const SHELL_CACHE = `${VERSION}-shell`

const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'server.arcgisonline.com',
  'tile.opentopomap.org',
  'elevation-tiles-prod.s3.amazonaws.com',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isTile = (url) => TILE_HOSTS.some((h) => url.hostname.includes(h))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return

  // API calls: network only, never cache stale data
  if (/nominatim|overpass|osrm|open-elevation|router\.project-osrm/.test(url.hostname + url.pathname)) return

  if (isTile(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          return cached || Response.error()
        }
      }),
    )
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', res.clone()))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 }))),
    )
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(event.request, res.clone()))
            return res
          }),
      ),
    )
  }
})
