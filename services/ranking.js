/**
 * Deterministic wallpaper ranking.
 *
 * This is NOT machine learning — it's a fully transparent, hand-tuned
 * weighted score, on purpose (see section 15/24 of the product spec:
 * "do not pretend the system uses AI if it does not"). Every factor
 * below is readable and adjustable. It's written so a real learned
 * ranking model could later replace `scoreWallpaper` without touching
 * `rankWallpapers` or any calling code.
 *
 * Factors and weights:
 *   - relevance (35%)   how early the provider itself ranked this item
 *                        in its own results, trusting that Pexels/
 *                        Pixabay/Unsplash/Wallhaven's own search
 *                        relevance is meaningful signal
 *   - resolution (25%)  higher pixel count, up to a "big enough" cap —
 *                        beyond that cap, more megapixels earns nothing,
 *                        since a wallpaper doesn't need to be huge
 *   - orientation (25%) match against what the caller asked for, or —
 *                        with no explicit ask — a portrait-first bias,
 *                        per the "primarily a phone wallpaper app" rule
 *   - phone ratio (15%) closeness to a common phone screen ratio
 *                        (9:16, 9:19.5, 9:20, 9:21 and their landscape
 *                        equivalents), since two portrait images at the
 *                        same resolution aren't equally good phone fits
 */

const WEIGHTS = {
  relevance: 0.35,
  resolution: 0.25,
  orientation: 0.25,
  phoneRatio: 0.15,
};

// A 1080x1920 image is already a fully sharp phone wallpaper — pixel
// counts above this earn no extra resolution score.
const TARGET_PIXELS = 1080 * 1920;

const PORTRAIT_PHONE_RATIOS = [9 / 16, 9 / 19.5, 9 / 20, 9 / 21];
const LANDSCAPE_PHONE_RATIOS = PORTRAIT_PHONE_RATIOS.map((r) => 1 / r);

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function resolutionScore(wallpaper) {
  if (!wallpaper.width || !wallpaper.height) return 0.3; // neutral default for unknown dimensions
  const pixels = wallpaper.width * wallpaper.height;
  return clamp01(pixels / TARGET_PIXELS);
}

function relevanceScore(originalIndex, providerTotal) {
  if (!providerTotal || providerTotal <= 1) return 1;
  return clamp01(1 - originalIndex / providerTotal);
}

function orientationScore(wallpaper, requestedOrientation) {
  if (requestedOrientation) {
    return wallpaper.orientation === requestedOrientation ? 1 : 0.2;
  }
  // No explicit orientation requested → default phone-feed bias.
  switch (wallpaper.orientation) {
    case "portrait":
      return 1;
    case "square":
      return 0.6;
    case "landscape":
      return 0.35;
    default:
      return 0.4;
  }
}

function phoneRatioScore(wallpaper) {
  if (!wallpaper.aspect_ratio) return 0.3;
  const candidates =
    wallpaper.orientation === "landscape" ? LANDSCAPE_PHONE_RATIOS : PORTRAIT_PHONE_RATIOS;
  const closest = Math.min(...candidates.map((ratio) => Math.abs(wallpaper.aspect_ratio - ratio)));
  // A difference of 0 → score 1; a difference of 0.5+ → score 0.
  return clamp01(1 - closest * 2);
}

/**
 * @param {import("./normalize.js").NormalizedWallpaper} wallpaper
 * @param {Object} context
 * @param {number} [context.originalIndex=0] - Position in the provider's own results.
 * @param {number} [context.providerTotal=1] - Size of the provider's own result set.
 * @param {"portrait"|"landscape"|"square"} [context.requestedOrientation]
 * @returns {number} A score in [0, 1].
 */
export function scoreWallpaper(wallpaper, context = {}) {
  const { originalIndex = 0, providerTotal = 1, requestedOrientation } = context;

  const scores = {
    relevance: relevanceScore(originalIndex, providerTotal),
    resolution: resolutionScore(wallpaper),
    orientation: orientationScore(wallpaper, requestedOrientation),
    phoneRatio: phoneRatioScore(wallpaper),
  };

  return (
    scores.relevance * WEIGHTS.relevance +
    scores.resolution * WEIGHTS.resolution +
    scores.orientation * WEIGHTS.orientation +
    scores.phoneRatio * WEIGHTS.phoneRatio
  );
}

/**
 * Sorts wallpapers by `scoreWallpaper`, highest first. Expects each
 * wallpaper to carry a `_meta.originalIndex` / `_meta.providerTotal`
 * pair (attached by wallpaperSearch.js / wallpaperFeed.js during
 * aggregation) — items without `_meta` are scored with neutral
 * defaults rather than throwing, so this stays safe to call directly
 * in tests with plain wallpaper objects.
 *
 * @param {import("./normalize.js").NormalizedWallpaper[]} items
 * @param {Object} [context]
 * @param {"portrait"|"landscape"|"square"} [context.requestedOrientation]
 * @returns {import("./normalize.js").NormalizedWallpaper[]} A new, sorted array.
 */
export function rankWallpapers(items, context = {}) {
  const { requestedOrientation } = context;

  return [...items].sort((a, b) => {
    const scoreA = scoreWallpaper(a, {
      originalIndex: a._meta?.originalIndex ?? 0,
      providerTotal: a._meta?.providerTotal ?? 1,
      requestedOrientation,
    });
    const scoreB = scoreWallpaper(b, {
      originalIndex: b._meta?.originalIndex ?? 0,
      providerTotal: b._meta?.providerTotal ?? 1,
      requestedOrientation,
    });
    return scoreB - scoreA;
  });
}

export default rankWallpapers;
