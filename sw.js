// 离线缓存：核心文件预缓存，字体分片等首次用到时缓存。
// 请求一律先返回缓存、后台拉新版写回缓存（stale-while-revalidate），所以发布后第二次打开才是新版。
// ponytail: 新增/改名 JS 模块时要同步 CORE，menu.test.mjs 会检查是否遗漏。
const CACHE = 'leger-v1';
const CORE = [
  './', 'index.html', 'style.css', 'fonts/fonts.css', 'manifest.webmanifest',
  'app.js', 'calc.js', 'advice.js', 'data.js', 'menu.js', 'store.js', 'charts.js', 'ui.js', 'guide.js', 'report.js',
  'views/core.js', 'views/plan.js', 'views/kitchen.js', 'views/foods.js',
  'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = (await cache.match(request, { ignoreSearch: true }))
      ?? (request.mode === 'navigate' ? await cache.match('./') : undefined);
    const network = fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    });
    if (!cached) return network;
    e.waitUntil(network.catch(() => {})); // 离线时后台更新失败是预期内的
    return cached;
  }));
});
