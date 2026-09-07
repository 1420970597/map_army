/**
 * Service Worker —— 渐进式 Web 应用的离线能力。
 *
 * 缓存策略按资源类型分治：
 * - **应用外壳与静态页**：安装时预缓存，离线也能打开应用与全部文档页；
 * - **页面导航**：网络优先，失败时回退缓存，保证更新及时可见；
 * - **地图瓦片**：缓存优先并限量淘汰（离线标图时最近浏览过的区域仍可用）；
 * - **同源静态资源**：陈旧-再验证（先给缓存，后台刷新）。
 *
 * 版本号变更即触发旧缓存清理，避免新旧资源混杂。
 */

/** 缓存版本：发布新版本时递增 */
const VERSION = 'v1.0.0';

/** 预缓存（应用外壳与静态站点页） */
const SHELL_CACHE = `map-army-shell-${VERSION}`;
/** 页面导航缓存 */
const PAGE_CACHE = `map-army-pages-${VERSION}`;
/** 地图瓦片缓存 */
const TILE_CACHE = `map-army-tiles-${VERSION}`;
/** 所有需要激活时清理的缓存名 */
const ALL_CACHES = [SHELL_CACHE, PAGE_CACHE, TILE_CACHE];

/** 瓦片缓存上限（条目数），超出后按先进先出淘汰 */
const TILE_LIMIT = 500;

/** 应用外壳清单：相对 SW 所在目录解析，适配任意部署子路径 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './llms.txt',
  './about/zh.html',
  './about/en.html',
  './about/de.html',
  './about/fr.html',
  './about/it.html',
  './example/zh.html',
  './example/en.html',
  './example/de.html',
  './example/fr.html',
  './example/it.html',
  './doc/zh/',
  './doc/en/',
  './doc/de/',
  './doc/fr/',
  './doc/it/',
];

/** 已知地图瓦片服务的主机名后缀 */
const TILE_HOST_SUFFIXES = [
  'tile.openstreetmap.org',
  'tile.opentopomap.org',
  'arcgisonline.com',
  'basemaps.cartocdn.com',
];

/** 判断请求是否指向地图瓦片 */
function isTileUrl(url) {
  return TILE_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}

/** 以先进先出策略修剪瓦片缓存 */
async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_LIMIT) return;
  // keys 按插入顺序返回，删掉最旧的一批
  for (const key of keys.slice(0, keys.length - TILE_LIMIT)) {
    await cache.delete(key);
  }
}

// ────────────────────────────────────────────────────────────
// 生命周期
// ────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll 中任一资源失败都会让整个安装失败，
      // 改为逐个处理以容忍个别页面暂时不可达
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new URL(url, self.registration.scope));
          } catch {
            // 预缓存失败不阻断安装，运行期仍会按需缓存
          }
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !ALL_CACHES.includes(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// ────────────────────────────────────────────────────────────
// 请求拦截
// ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // 仅拦截 GET；其余方法（如上传）直接放行
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isTileUrl(url)) {
    event.respondWith(tileStrategy(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(
      request.mode === 'navigate' ? navigationStrategy(request) : assetStrategy(request),
    );
  }
});

/** 瓦片：缓存优先，未命中时拉取并写入缓存 */
async function tileStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(TILE_CACHE);
      cache.put(request, response.clone());
      trimTileCache();
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Tile offline' });
  }
}

/** 页面导航：网络优先（3 秒超时），失败回退缓存或外壳 */
async function navigationStrategy(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await caches.match('./index.html'));
    return (
      cached ||
      new Response('离线且无缓存', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

/** 同源静态资源：陈旧-再验证，先给缓存再用网络刷新 */
async function assetStrategy(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || new Response('', { status: 504 });
}
