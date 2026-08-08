// functions/utils/cache.ts

/**
 * 缓存配置常量
 */
export const CACHE_CONFIG = {
  file: {
    maxAge: 86400 * 7, // 7 天
  },
  thumb: {
    maxAge: 86400 * 1, // 1 天
  },
  api: {
    maxAge: 3600, // 1 小时
  },
};

// 新旧 cache 名
const OLD_CACHE_NAME = "otter-music-cache";
const NEW_CACHE_NAME = "qingting-music-cache";

/**
 * 尝试从旧 cache 迁移到新 cache（在可用时运行）
 * 说明：在受限环境（如某些 SW 实现）下复制缓存条目可能失败。
 */
async function migrateCacheIfNeeded() {
  try {
    const oldCache = await caches.open(OLD_CACHE_NAME).catch(() => null);
    if (!oldCache) return;

    const newCache = await caches.open(NEW_CACHE_NAME);
    const requests = await oldCache.keys();
    for (const req of requests) {
      try {
        const resp = await oldCache.match(req);
        if (resp) {
          await newCache.put(req, resp.clone());
        }
      } catch (e) {
        // 单条复制失败继续下一个
        console.warn("cache migrate entry failed:", e);
      }
    }
    // 不主动删除旧 cache，允许并存一段时间，减少风险
  } catch (e) {
    console.error("cache migration failed:", e);
  }
}

// 在模块加载时启动迁移（异步，不阻塞）
void migrateCacheIfNeeded();

export function createCacheKey(request: Request): Request {
  const url = new URL(request.url);
  // 只缓存 GET
  return new Request(url.toString(), {
    method: "GET",
  });
}

export async function getFromCache(request: Request): Promise<Response | null> {
  // 优先从新 cache 读取，如果不存在再尝试旧 cache 作为回退
  const newCache = await caches.open(NEW_CACHE_NAME).catch(() => null);
  const key = createCacheKey(request);
  if (newCache) {
    const r = await newCache.match(key).catch(() => null);
    if (r) return r;
  }

  const oldCache = await caches.open(OLD_CACHE_NAME).catch(() => null);
  if (oldCache) return oldCache.match(key).catch(() => null);
  return null;
}

export async function putToCache(
  request: Request,
  response: Response,
  type: keyof typeof CACHE_CONFIG
) {
  if (!response.ok) return;

  const cache = await caches.open(NEW_CACHE_NAME);
  const key = createCacheKey(request);

  const maxAge = CACHE_CONFIG[type].maxAge;

  // Recreate response to ensure headers are mutable
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Cache-Control", `public, max-age=${maxAge}`);

  const cachedResp = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });

  await cache.put(key, cachedResp).catch(() => {});
}

export async function deleteCache(request: Request) {
  const cache = await caches.open(NEW_CACHE_NAME).catch(() => null);
  if (!cache) return;
  const key = createCacheKey(request);
  await cache.delete(key).catch(() => {});
}
