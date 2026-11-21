/* yacc service worker：外壳缓存优先，内容网络优先 */
const VERSION = 'yacc-v2'
const SHELL_CACHE = `${VERSION}-shell`
const DATA_CACHE = `${VERSION}-data`

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 内容包：网络优先，失败用缓存
  if (url.pathname === '/content.json') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(DATA_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req)),
    )
    return
  }

  // 导航请求：网络优先，离线回外壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((hit) => hit || caches.match('/offline.html')),
        ),
    )
    return
  }

  // 其余静态资源：缓存优先 + 后台更新
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        fetch(req)
          .then((res) => caches.open(SHELL_CACHE).then((c) => c.put(req, res)))
          .catch(() => {})
        return hit
      }
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => hit)
    }),
  )
})
