import cache, { CACHE_TTL, buildCacheKey } from "./cache.js";
import { aggregateFromProviders } from "./aggregate.js";

/**
 * Builds the immersive home feed: each provider's "popular" pool,
 * merged, deduplicated, and ranked with a portrait-first bias (J-Tech
 * Display is primarily a phone wallpaper app — see ranking.js).
 *
 * A `category` can be supplied to bias the feed toward one of the
 * configured categories (see data/categories.js, added in Phase 4) by
 * passing its keywords through as a search-like query instead of using
 * the pure "popular" pool — that wiring happens once categories exist;
 * for now this always serves the general popular feed.
 *
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10] - Kept small by default; this
 *   feed is meant for infinite scroll, not one giant payload.
 * @param {"portrait"|"landscape"|"square"} [options.orientation] - Omit
 *   to use ranking's default portrait-first bias.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, limit: number, has_next: boolean, removed_duplicates: number, provider_status: Record<string, any> }>}
 */
export async function getFeed(options = {}) {
  const { page = 1, limit = 10, orientation } = options;

  const cacheKey = buildCacheKey("feed", { page, limit, orientation });

  return cache.getOrSet(cacheKey, CACHE_TTL.FEED, () =>
    aggregateFromProviders({
      page,
      limit,
      requestedOrientation: orientation,
      callProvider: (providerModule) => providerModule.getPopular({ page, limit, orientation }),
    })
  );
}

export default { getFeed };
