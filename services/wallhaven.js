import config from "../config/config.js";
import { createProviderClient, requestWithSafeRetry } from "./httpClient.js";
import { buildNormalizedWallpaper } from "./normalize.js";

const PROVIDER = "wallhaven";

// Wallhaven has no single "orientation" param — it filters by explicit
// width:height ratios instead. These lists cover the common phone and
// desktop ratios for each orientation bucket.
const RATIOS_BY_ORIENTATION = {
  portrait: ["9x16", "9x18", "9x19.5", "9x20", "9x21", "10x16", "2x3", "3x4", "4x5"],
  landscape: ["16x9", "18x9", "19.5x9", "20x9", "21x9", "16x10", "3x2", "4x3", "5x4"],
  square: ["1x1"],
};

// "111" = general + anime + people all enabled (Wallhaven's 3-bit category flag).
const ALL_CATEGORIES = "111";
// "100" = SFW only. Wallhaven's NSFW tiers require an account-linked API
// key with the right permissions — we default to SFW-only regardless of
// whether a key is present, since this is a general wallpaper app.
const SFW_ONLY = "100";

function getClient() {
  // Wallhaven's search endpoint works without a key (SFW results, lower
  // rate limit); a key only raises limits / unlocks NSFW tiers, which we
  // don't use. So unlike the other providers, a missing key here isn't
  // a hard failure.
  return createProviderClient({
    baseURL: config.providers.wallhaven.baseUrl,
    defaultParams: config.providers.wallhaven.apiKey
      ? { apikey: config.providers.wallhaven.apiKey }
      : {},
  });
}

function normalizeEntry(entry, category) {
  return buildNormalizedWallpaper({
    source: PROVIDER,
    providerId: entry.id,
    title: "",
    image_url: entry.path || "",
    thumbnail_url: entry.thumbs?.large || entry.thumbs?.original || entry.thumbs?.small || "",
    width: entry.dimension_x || null,
    height: entry.dimension_y || null,
    // Wallhaven's search response does not include uploader info (only
    // the wallpaper detail endpoint does), so author is left blank
    // rather than guessed.
    author: { name: "", url: "" },
    source_url: entry.url || "",
    // Tags require a separate per-wallpaper API call on Wallhaven and
    // aren't returned by search, so this stays an empty, honest default.
    tags: [],
    category,
  });
}

/**
 * Searches Wallhaven for wallpapers matching a keyword query.
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=24] - Wallhaven's page size is fixed
 *   server-side (~24), so this is informational rather than a real cap.
 * @param {"portrait"|"landscape"|"square"} [options.orientation]
 * @param {string} [options.category]
 * @param {"relevance"|"date_added"|"views"|"favorites"|"toplist"|"random"} [options.sort="relevance"] - Mapped to Wallhaven's `sorting`.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function search(query, options = {}) {
  const { page = 1, orientation, category = "", sort = "relevance" } = options;
  const client = getClient();

  const params = {
    q: query || "",
    categories: ALL_CATEGORIES,
    purity: SFW_ONLY,
    sorting: sort,
    order: "desc",
    page,
  };
  if (orientation && RATIOS_BY_ORIENTATION[orientation]) {
    params.ratios = RATIOS_BY_ORIENTATION[orientation].join(",");
  }

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/search", { params })
  );

  const data = response.data || {};
  const entries = Array.isArray(data.data) ? data.data : [];
  const meta = data.meta || {};

  return {
    items: entries.map((entry) => normalizeEntry(entry, category)),
    page: meta.current_page || page,
    per_page: meta.per_page || entries.length,
    total: meta.total ?? entries.length,
    has_next: Boolean(meta.last_page && meta.current_page && meta.current_page < meta.last_page),
  };
}

/**
 * Fetches Wallhaven's all-time top wallpapers via `sorting=toplist`.
 *
 * @param {Object} [options]
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function getPopular(options = {}) {
  return search("", { ...options, sort: "toplist" });
}

/**
 * Fetches a single Wallhaven wallpaper by its provider-specific ID.
 *
 * Unlike `/search`, Wallhaven's detail endpoint (`/w/:id`) also returns
 * uploader info and a full tags array, so this normalizes a richer
 * object than search results carry — that's expected and correct.
 *
 * @param {string} id - The raw Wallhaven ID (without the "wallhaven:" prefix).
 * @returns {Promise<import("./normalize.js").NormalizedWallpaper|null>} `null` on 404.
 */
export async function getById(id) {
  const client = getClient();
  try {
    const response = await requestWithSafeRetry(PROVIDER, () => client.get(`/w/${id}`));
    const entry = response.data?.data;
    if (!entry) return null;

    return buildNormalizedWallpaper({
      source: PROVIDER,
      providerId: entry.id,
      image_url: entry.path || "",
      thumbnail_url: entry.thumbs?.large || entry.thumbs?.small || "",
      width: entry.dimension_x || null,
      height: entry.dimension_y || null,
      author: {
        name: entry.uploader?.username || "",
        url: entry.uploader?.username
          ? `https://wallhaven.cc/user/${entry.uploader.username}`
          : "",
      },
      source_url: entry.url || "",
      tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => tag.name).filter(Boolean) : [],
      category: "",
    });
  } catch (error) {
    if (error.cause?.response?.status === 404) return null;
    throw error;
  }
}

export default { search, getPopular, getById };
