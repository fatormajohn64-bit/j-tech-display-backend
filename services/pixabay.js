import config from "../config/config.js";
import { createProviderClient, requestWithSafeRetry, ProviderError } from "./httpClient.js";
import { buildNormalizedWallpaper } from "./normalize.js";

const PROVIDER = "pixabay";

const ORIENTATION_MAP = {
  // Pixabay only distinguishes "horizontal" / "vertical" — square images
  // are returned under either depending on the asset, so we don't filter
  // on it and let ranking sort square results out by aspect ratio.
  portrait: "vertical",
  landscape: "horizontal",
};

function getClient() {
  if (!config.providers.pixabay.apiKey) {
    throw new ProviderError(PROVIDER, "PIXABAY_API_KEY is not configured.");
  }
  return createProviderClient({
    baseURL: config.providers.pixabay.baseUrl,
    defaultParams: { key: config.providers.pixabay.apiKey },
  });
}

function normalizeHit(hit, category) {
  const tags = typeof hit.tags === "string"
    ? hit.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];

  return buildNormalizedWallpaper({
    source: PROVIDER,
    providerId: hit.id,
    title: tags[0] ? capitalize(tags[0]) : "",
    image_url: hit.largeImageURL || hit.webformatURL || "",
    thumbnail_url: hit.webformatURL || hit.previewURL || "",
    width: hit.imageWidth || null,
    height: hit.imageHeight || null,
    author: {
      name: hit.user || "",
      url: hit.user_id ? `https://pixabay.com/users/${hit.user}-${hit.user_id}/` : "",
    },
    source_url: hit.pageURL || "",
    tags,
    category,
  });
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Searches Pixabay for wallpapers matching a keyword query.
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30] - Mapped to `per_page` (Pixabay range: 3–200).
 * @param {"portrait"|"landscape"|"square"} [options.orientation]
 * @param {string} [options.category]
 * @param {"popularity"|"relevance"} [options.sort="relevance"] - Mapped to Pixabay's `order` param.
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function search(query, options = {}) {
  const { page = 1, limit = 30, orientation, category = "", sort = "relevance" } = options;
  const client = getClient();

  const perPage = Math.min(Math.max(limit, 3), 200);
  const params = {
    q: query || "",
    image_type: "photo",
    page,
    per_page: perPage,
    order: sort === "popularity" ? "popular" : "latest",
    safesearch: true,
  };
  if (orientation && ORIENTATION_MAP[orientation]) {
    params.orientation = ORIENTATION_MAP[orientation];
  }

  const response = await requestWithSafeRetry(PROVIDER, () =>
    client.get("/", { params })
  );

  const data = response.data || {};
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const total = data.totalHits ?? hits.length;

  return {
    items: hits.map((hit) => normalizeHit(hit, category)),
    page,
    per_page: perPage,
    total,
    has_next: page * perPage < total,
  };
}

/**
 * Pixabay has no dedicated "popular" endpoint — this calls `search`
 * with an empty query and `order=popular`, which Pixabay treats as
 * "top editor's-choice images", giving the same effect.
 *
 * @param {Object} [options]
 * @returns {Promise<{ items: import("./normalize.js").NormalizedWallpaper[], page: number, per_page: number, total: number, has_next: boolean }>}
 */
export async function getPopular(options = {}) {
  return search("", { ...options, sort: "popularity" });
}

export default { search, getPopular };
