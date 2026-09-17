import config from "../config/config.js";
import { createProviderClient, requestWithSafeRetry, ProviderError } from "./httpClient.js";
import { buildNormalizedWallpaper } from "./normalize.js";

const PROVIDER = "unsplash";

const ORIENTATION_MAP = {
  portrait: "portrait",
  landscape: "landscape",
  square: "squarish",
};

function getClient() {
  if (!config.providers.unsplash.apiKey) {
    throw new ProviderError(PROVIDER, "UNSPLASH_ACCESS_KEY is not configured.");
  }
  return createProviderClient({
    baseURL: config.providers.unsplash.baseUrl,
    headers: { Authorization: `Client-ID ${config.providers.unsplash.apiKey}` },
  });
}

function normalizePhoto(photo, category) {
  const tags = Array.isArray(photo.tags)
    ? photo.tags.map((tag) => tag?.title).filter(Boolean)
    : [];

  return buildNormalizedWallpaper({
    source: PROVIDER,
    providerId: photo.id,
    title: photo.alt_description || photo.description || "",
    description: photo.description || "",
    image_url: photo.urls?.full || photo.urls?.raw || photo.urls?.regular || "",
    thumbnail_url: photo.urls?.small || photo.urls?.thumb || "",
    width: photo.width || null,
    height: photo.height || null,
    author: {
      name: photo.user?.name || "",
      url: photo.user?.links?.html || "",
    },
    source_url: photo.links?.html || "",
    tags,
    category,
  });
}

/**
 * Searches Unsplash for wallpapers matching a keyword query.
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30] - Mapped to `per_page` (max 30 per Unsplash's API).
 * @param {"portrait"|"landscape"|"square"} [options.orientation]
 * @param {string} [options.category]
 * @param {"relevant"|"latest"} [options.sort="relevant"] - Mapped to Unsplash's `order_by`.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function search(query, options = {}) {
  const { page = 1, limit = 30, orientation, category = "", sort = "relevant" } = options;
  const client = getClient();

  const perPage = Math.min(Math.max(limit, 1), 30);
  const params = {
    query,
    page,
    per_page: perPage,
    order_by: sort === "latest" ? "latest" : "relevant",
  };
  if (orientation && ORIENTATION_MAP[orientation]) {
    params.orientation = ORIENTATION_MAP[orientation];
  }

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/search/photos", { params })
  );

  const data = response.data || {};
  const results = Array.isArray(data.results) ? data.results : [];
  const totalPages = data.total_pages ?? page;

  return {
    items: results.map((photo) => normalizePhoto(photo, category)),
    page,
    per_page: perPage,
    total: data.total ?? results.length,
    has_next: page < totalPages,
  };
}

/**
 * Fetches Unsplash's popular photo feed via `/photos?order_by=popular`.
 * This endpoint does not return a total count, so `has_next` is a
 * best-effort guess based on whether a full page came back.
 *
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30]
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number|null, has_next: boolean }>}
 */
export async function getPopular(options = {}) {
  const { page = 1, limit = 30 } = options;
  const client = getClient();

  const perPage = Math.min(Math.max(limit, 1), 30);
  const params = { page, per_page: perPage, order_by: "popular" };

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/photos", { params })
  );

  const results = Array.isArray(response.data) ? response.data : [];

  return {
    items: results.map((photo) => normalizePhoto(photo, "")),
    page,
    per_page: perPage,
    total: null,
    has_next: results.length === perPage,
  };
}

export default { search, getPopular };
