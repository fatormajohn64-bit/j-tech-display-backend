import * as pexels from "./pexels.js";
import * as pixabay from "./pixabay.js";
import * as unsplash from "./unsplash.js";
import * as wallhaven from "./wallhaven.js";
import { deduplicateWallpapers } from "./deduplicate.js";
import { rankWallpapers } from "./ranking.js";

/**
 * Every supported provider, named and paired with its adapter module.
 * wallpaperSearch.js and wallpaperFeed.js both import this instead of
 * each hard-coding its own provider list, so adding a fifth provider
 * later means editing one array, not two call sites.
 */
export const PROVIDERS = [
  { name: "pexels", module: pexels },
  { name: "pixabay", module: pixabay },
  { name: "unsplash", module: unsplash },
  { name: "wallhaven", module: wallhaven },
];

function stripInternalMeta(wallpaper) {
  const { _meta, ...publicFields } = wallpaper;
  return publicFields;
}

/**
 * Runs one call per provider concurrently (fault-tolerant — a failing
 * provider is logged and excluded, never aborts the others), then
 * dedupes and ranks the combined pool, and returns the requested page
 * slice.
 *
 * Pagination note: because each provider paginates independently, "page
 * N" here means "page N of each provider's own results, merged." This
 * keeps infinite scroll working smoothly without deep cross-provider
 * cursor bookkeeping, at the cost of not guaranteeing a perfectly
 * stable global ordering deep into pagination — an acceptable trade-off
 * for a wallpaper feed, and one worth revisiting if usage data ever
 * shows it matters.
 *
 * @param {Object} args
 * @param {(providerModule: any) => Promise<{ items: any[], has_next?: boolean }>} args.callProvider
 *   Given one provider's adapter module, returns its promise (e.g. `(m) => m.search(query, opts)`).
 * @param {number} args.page
 * @param {number} args.limit
 * @param {"portrait"|"landscape"|"square"} [args.requestedOrientation]
 * @param {{ name: string, module: any }[]} [args.providers] - Defaults to all four; pass a subset for testing.
 * @param {(wallpaper: any) => boolean} [args.filterFn] - Applied to the
 *   combined pool before dedup/ranking (e.g. a minimum-resolution filter).
 * @returns {Promise<{ items: any[], page: number, limit: number, has_next: boolean, removed_duplicates: number, provider_status: Record<string, any> }>}
 */
export async function aggregateFromProviders({
  callProvider,
  page,
  limit,
  requestedOrientation,
  providers = PROVIDERS,
  filterFn,
}) {
  const settled = await Promise.allSettled(providers.map((p) => callProvider(p.module)));

  const providerStatus = {};
  const combined = [];

  settled.forEach((result, index) => {
    const providerName = providers[index].name;

    if (result.status === "fulfilled") {
      const { items, has_next } = result.value;
      providerStatus[providerName] = { ok: true, count: items.length, has_next: Boolean(has_next) };

      items.forEach((wallpaper, itemIndex) => {
        wallpaper._meta = { originalIndex: itemIndex, providerTotal: items.length };
        combined.push(wallpaper);
      });
    } else {
      const message = result.reason?.message || String(result.reason);
      providerStatus[providerName] = { ok: false, error: message, has_next: false };
      console.error(`Provider "${providerName}" failed:`, message);
    }
  });

  const filtered = typeof filterFn === "function" ? combined.filter(filterFn) : combined;
  const { items: deduped, removedCount } = deduplicateWallpapers(filtered);
  const ranked = rankWallpapers(deduped, { requestedOrientation });
  const pageItems = ranked.slice(0, limit).map(stripInternalMeta);

  const anyProviderHasNext = Object.values(providerStatus).some((status) => status.ok && status.has_next);

  return {
    items: pageItems,
    page,
    limit,
    has_next: anyProviderHasNext,
    removed_duplicates: removedCount,
    provider_status: providerStatus,
  };
}

export default aggregateFromProviders;
