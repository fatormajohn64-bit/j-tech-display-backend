/**
 * A simple in-process TTL cache.
 *
 * Deliberately minimal: `get`, `set`, `del`, `clear`, and the
 * convenience `getOrSet`. Every caller in this codebase (wallpaperSearch,
 * wallpaperFeed, categories) talks to this interface, not to a Map
 * directly — so swapping the in-process store for Redis later (via
 * `ioredis`, for example) means rewriting only this file, with zero
 * changes anywhere else.
 *
 * This module is NOT a substitute for a distributed cache in
 * production: if J-Tech Display ever runs more than one server
 * instance, each instance holds its own independent cache, so
 * identical requests hitting different instances still call the
 * providers separately. Fine for a single Render instance; move to
 * Redis before scaling horizontally.
 */

const MAX_ENTRIES = 500;

class TTLCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();

    // Periodic sweep so expired-but-unread entries don't sit in memory
    // forever. unref() so this timer never keeps the process alive on
    // its own.
    this.sweepInterval = setInterval(() => this._sweep(), 5 * 60 * 1000);
    this.sweepInterval.unref?.();
  }

  /**
   * @param {string} key
   * @returns {any|undefined} The cached value, or undefined if missing/expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds
   */
  set(key, value, ttlSeconds) {
    // Simple insertion-order eviction once we hit the cap — good enough
    // for a single-instance cache; a real LRU isn't worth the
    // complexity here.
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /**
   * @param {string} key
   */
  del(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  /**
   * Returns the cached value for `key` if present and fresh; otherwise
   * calls `fn()`, caches its resolved value for `ttlSeconds`, and
   * returns it. If `fn()` rejects, nothing is cached and the rejection
   * propagates — callers should not learn "success" from a failed fetch.
   *
   * @template T
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async getOrSet(key, ttlSeconds, fn) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const fresh = await fn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const cache = new TTLCache();

/** Default TTLs (seconds) by content type, tuned for freshness vs. provider load. */
export const CACHE_TTL = {
  SEARCH: 300, // 5 min — search results change slowly enough for this to feel fresh
  FEED: 300, // 5 min
  CATEGORY: 600, // 10 min — category discovery content is intentionally more static
  TRENDING: 600, // 10 min
};

/**
 * Builds a stable, order-independent cache key from a params object, so
 * `{page:1, limit:30}` and `{limit:30, page:1}` hash to the same key.
 *
 * @param {string} prefix - e.g. "search", "feed", "category"
 * @param {Record<string, any>} params
 * @returns {string}
 */
export function buildCacheKey(prefix, params = {}) {
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const serialized = sortedEntries.map(([key, value]) => `${key}=${value}`).join("&");
  return `${prefix}:${serialized}`;
}

export default cache;
