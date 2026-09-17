/**
 * Removes duplicate wallpapers from a combined, multi-provider result
 * set, using two layered signals:
 *
 * 1. Exact URL match — the same image_url (normalized) appearing twice,
 *    which happens when the same provider's item shows up more than
 *    once across paginated/merged calls.
 * 2. Cross-provider fingerprint — same pixel dimensions + a near-
 *    identical title, which catches the common case of the same stock
 *    photo being licensed to more than one of Pexels/Pixabay/Unsplash.
 *
 * Neither signal is perfect. A true perceptual-hash comparison (pHash
 * on downloaded thumbnail bytes) would catch re-crops and re-encodes
 * that these heuristics miss — that's a deliberate future upgrade, not
 * an oversight, and is why this module exports `buildFingerprint`
 * separately: a pHash-based pass can slot in as a third signal later
 * without changing the calling code in wallpaperSearch.js /
 * wallpaperFeed.js.
 */

/**
 * @param {string} url
 * @returns {string} The URL with protocol, query string, and trailing
 *   slash stripped, and host lowercased — so
 *   "https://x.com/a.jpg?w=200" and "http://X.com/a.jpg" collide.
 */
function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.split("?")[0].trim().toLowerCase();
  }
}

/**
 * @param {string} title
 * @returns {string} Lowercased, punctuation-stripped, whitespace-collapsed title.
 */
function normalizeTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a coarse cross-provider fingerprint for a wallpaper. Returns
 * `null` when there isn't enough signal (no title, or no dimensions) to
 * fingerprint safely — a `null` fingerprint is never treated as a match
 * against another `null`, which would otherwise collapse every
 * untitled/dimensionless item into one "duplicate".
 *
 * @param {import("./normalize.js").NormalizedWallpaper} wallpaper
 * @returns {string|null}
 */
export function buildFingerprint(wallpaper) {
  const title = normalizeTitle(wallpaper.title);
  if (!wallpaper.width || !wallpaper.height || title.length < 4) return null;
  return `${wallpaper.width}x${wallpaper.height}::${title}`;
}

/**
 * @param {import("./normalize.js").NormalizedWallpaper[]} items
 * @returns {{ items: import("./normalize.js").NormalizedWallpaper[], removedCount: number }}
 */
export function deduplicateWallpapers(items) {
  const seenUrls = new Set();
  const seenFingerprints = new Set();
  const deduped = [];
  let removedCount = 0;

  for (const wallpaper of items) {
    const urlKey = normalizeUrl(wallpaper.image_url);
    const isUrlDuplicate = urlKey && seenUrls.has(urlKey);

    const fingerprint = buildFingerprint(wallpaper);
    const isFingerprintDuplicate = fingerprint && seenFingerprints.has(fingerprint);

    if (isUrlDuplicate || isFingerprintDuplicate) {
      removedCount += 1;
      continue;
    }

    if (urlKey) seenUrls.add(urlKey);
    if (fingerprint) seenFingerprints.add(fingerprint);
    deduped.push(wallpaper);
  }

  return { items: deduped, removedCount };
}

export default deduplicateWallpapers;
