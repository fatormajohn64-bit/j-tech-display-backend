/**
 * Shared helpers for turning provider-specific responses into the
 * common wallpaper object shape used everywhere else in the app.
 *
 * Every provider service (pexels.js, pixabay.js, unsplash.js,
 * wallhaven.js) calls `buildNormalizedWallpaper` instead of hand-rolling
 * its own object literal, so the shape — and its fallback rules — only
 * has to be correct in one place.
 */

/**
 * @typedef {Object} NormalizedWallpaper
 * @property {string} id - Namespaced as "<source>:<providerId>" so IDs
 *   never collide across providers.
 * @property {string} source - "pexels" | "pixabay" | "unsplash" | "wallhaven"
 * @property {string} title
 * @property {string} description
 * @property {string} image_url - Full-resolution image URL.
 * @property {string} thumbnail_url - Small/preview image URL.
 * @property {number|null} width
 * @property {number|null} height
 * @property {"portrait"|"landscape"|"square"|"unknown"} orientation
 * @property {number|null} aspect_ratio - width / height, rounded to 4dp.
 * @property {{name: string, url: string}} author
 * @property {string} source_url - Link back to the image's page on the provider's site.
 * @property {string[]} tags
 * @property {string} category
 * @property {boolean} is_wallpaper
 */

/**
 * @param {number|null|undefined} width
 * @param {number|null|undefined} height
 * @returns {"portrait"|"landscape"|"square"|"unknown"}
 */
export function getOrientation(width, height) {
  if (!width || !height) return "unknown";
  if (width > height) return "landscape";
  if (width < height) return "portrait";
  return "square";
}

/**
 * @param {number|null|undefined} width
 * @param {number|null|undefined} height
 * @returns {number|null}
 */
export function getAspectRatio(width, height) {
  if (!width || !height) return null;
  return Math.round((width / height) * 10000) / 10000;
}

/**
 * Builds a fully-populated NormalizedWallpaper, filling in any field the
 * caller omits with a safe default so downstream code never has to
 * null-check provider output.
 *
 * @param {Partial<NormalizedWallpaper> & { source: string, providerId: string | number }} fields
 * @returns {NormalizedWallpaper}
 */
export function buildNormalizedWallpaper(fields) {
  const {
    source,
    providerId,
    title = "",
    description = "",
    image_url = "",
    thumbnail_url = "",
    width = null,
    height = null,
    author = { name: "", url: "" },
    source_url = "",
    tags = [],
    category = "",
  } = fields;

  return {
    id: `${source}:${providerId}`,
    source,
    title: title || "",
    description: description || "",
    image_url: image_url || "",
    thumbnail_url: thumbnail_url || image_url || "",
    width: width || null,
    height: height || null,
    orientation: getOrientation(width, height),
    aspect_ratio: getAspectRatio(width, height),
    author: {
      name: author?.name || "",
      url: author?.url || "",
    },
    source_url: source_url || "",
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    category: category || "",
    is_wallpaper: true,
  };
}

export default buildNormalizedWallpaper;
