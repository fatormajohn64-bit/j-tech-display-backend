import config from "../config/config.js";
import { createProviderClient, requestWithSafeRetry, ProviderError } from "./httpClient.js";
import { buildNormalizedWallpaper } from "./normalize.js";

const PROVIDER = "pexels";

/**
 * Pexels orientation values differ slightly from ours — map ours to
 * theirs where a direct equivalent exists; "square" has no Pexels
 * equivalent so we simply omit the filter and let ranking handle it.
 */
const ORIENTATION_MAP = {
  portrait: "portrait",
  landscape: "landscape",
  square: "square",
};

function getClient() {
  if (!config.providers.pexels.apiKey) {
    throw new ProviderError(PROVIDER, "PEXELS_API_KEY is not configured.");
  }
  return createProviderClient({
    baseURL: config.providers.pexels.baseUrl,
    headers: { Authorization: config.providers.pexels.apiKey },
  });
}

function normalizePhoto(photo, category) {
  return buildNormalizedWallpaper({
    source: PROVIDER,
    providerId: photo.id,
    title: photo.alt || "",
    image_url: photo.src?.original || photo.src?.large2x || photo.src?.large || "",
    thumbnail_url: photo.src?.large || photo.src?.medium || photo.src?.small || "",
    width: photo.width || null,
    height: photo.height || null,
    author: {
      name: photo.photographer || "",
      url: photo.photographer_url || "",
    },
    source_url: photo.url || "",
    tags: [],
    category,
  });
}

/**
 * Searches Pexels for wallpapers matching a keyword query.
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30] - Mapped to Pexels' `per_page` (max 80).
 * @param {"portrait"|"landscape"|"square"} [options.orientation]
 * @param {string} [options.category] - Passed through onto the normalized result only.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function search(query, options = {}) {
  const { page = 1, limit = 30, orientation, category = "" } = options;
  const client = getClient();

  const params = {
    query,
    page,
    per_page: Math.min(Math.max(limit, 1), 80),
  };
  if (orientation && ORIENTATION_MAP[orientation]) {
    params.orientation = ORIENTATION_MAP[orientation];
  }

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/search", { params })
  );

  const data = response.data || {};
  const photos = Array.isArray(data.photos) ? data.photos : [];

  return {
    items: photos.map((photo) => normalizePhoto(photo, category)),
    page: data.page || page,
    per_page: data.per_page || params.per_page,
    total: data.total_results ?? photos.length,
    has_next: Boolean(data.next_page),
  };
}

/**
 * Fetches Pexels' curated/popular photo feed — no keyword required.
 *
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30]
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function getPopular(options = {}) {
  const { page = 1, limit = 30 } = options;
  const client = getClient();

  const params = { page, per_page: Math.min(Math.max(limit, 1), 80) };

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/curated", { params })
  );

  const data = response.data || {};
  const photos = Array.isArray(data.photos) ? data.photos : [];

  return {
    items: photos.map((photo) => normalizePhoto(photo, "")),
    page: data.page || page,
    per_page: data.per_page || params.per_page,
    total: data.total_results ?? photos.length,
    has_next: Boolean(data.next_page),
  };
}

/**
 * Fetches a single Pexels photo by its provider-specific numeric ID.
 *
 * @param {string|number} id - The raw Pexels photo ID (without the "pexels:" prefix).
 * @returns {Promise<import("./normalize.js").NormalizedWallpaper|null>} `null` on 404.
 */
export async function getById(id) {
  const client = getClient();
  try {
    const response = await requestWithSafeRetry(PROVIDER, () => client.get(`/photos/${id}`));
    return normalizePhoto(response.data, "");
  } catch (error) {
    if (error.cause?.response?.status === 404) return null;
    throw error;
  }
}

export default { search, getPopular, getById };
