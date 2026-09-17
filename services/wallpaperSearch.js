import cache, { CACHE_TTL, buildCacheKey } from "./cache.js";
import { aggregateFromProviders, PROVIDERS } from "./aggregate.js";

/**
 * Searches all four providers concurrently for `query`, merges,
 * deduplicates, ranks, and returns one page of results. Cached per
 * unique combination of parameters so repeated identical searches
 * (very common — the same popular query gets typed by many users)
 * don't re-hit every provider each time.
 *
 * @param {string} query - Required, non-empty search keyword(s).
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30]
 * @param {"portrait"|"landscape"|"square"} [options.orientation]
 * @param {string} [options.category]
 * @param {"relevance"|"popularity"|"latest"} [options.sort="relevance"]
 * @param {number} [options.minWidth] - Drop results narrower than this, in pixels.
 * @param {number} [options.minHeight] - Drop results shorter than this, in pixels.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, limit: number, has_next: boolean, removed_duplicates: number, provider_status: Record<string, any> }>}
 */
export async function searchWallpapers(query, options = {}) {
  const { page = 1, limit = 30, orientation, category = "", sort = "relevance", minWidth, minHeight } = options;

  const cacheKey = buildCacheKey("search", {
    query,
    page,
    limit,
    orientation,
    category,
    sort,
    minWidth,
    minHeight,
  });

  const filterFn = minWidth || minHeight
    ? (wallpaper) =>
        (!minWidth || (wallpaper.width || 0) >= minWidth) &&
        (!minHeight || (wallpaper.height || 0) >= minHeight)
    : undefined;

  return cache.getOrSet(cacheKey, CACHE_TTL.SEARCH, () =>
    aggregateFromProviders({
      page,
      limit,
      requestedOrientation: orientation,
      filterFn,
      callProvider: (providerModule) =>
        providerModule.search(query, { page, limit, orientation, category, sort }),
    })
  );
}

/**
 * Looks up a single wallpaper by its namespaced ID (e.g. "pexels:12345").
 * Routes to the correct provider's `getById` based on the ID's prefix.
 *
 * @param {string} id
 * @returns {Promise<import("./normalize.js").NormalizedWallpaper|null>}
 *   `null` if the ID is malformed, the source is unknown, or the
 *   provider reports the wallpaper doesn't exist (404).
 */
export async function getWallpaperById(id) {
  if (typeof id !== "string" || !id.includes(":")) return null;

  const separatorIndex = id.indexOf(":");
  const source = id.slice(0, separatorIndex);
  const providerId = id.slice(separatorIndex + 1);
  if (!providerId) return null;

  const provider = PROVIDERS.find((p) => p.name === source);
  if (!provider) return null;

  const cacheKey = buildCacheKey("wallpaper", { id });
  return cache.getOrSet(cacheKey, CACHE_TTL.SEARCH, () => provider.module.getById(providerId));
}

export default { searchWallpapers, getWallpaperById };
