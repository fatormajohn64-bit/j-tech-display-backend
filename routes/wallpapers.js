import { Router } from "express";
import { getFeed } from "../services/wallpaperFeed.js";
import { getWallpaperById } from "../services/wallpaperSearch.js";

const router = Router();

const VALID_ORIENTATIONS = ["portrait", "landscape", "square"];
const MAX_LIMIT = 60;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 10; // small default — this feed is built for infinite scroll

function parseFeedQuery(query) {
  const errors = [];

  let page = 1;
  if (query.page !== undefined) {
    page = Number.parseInt(query.page, 10);
    if (!Number.isInteger(page) || page < 1) {
      errors.push("Query parameter 'page' must be a positive integer.");
      page = 1;
    }
  }

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    limit = Number.parseInt(query.limit, 10);
    if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
      errors.push(`Query parameter 'limit' must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}.`);
      limit = DEFAULT_LIMIT;
    }
  }

  let orientation;
  if (query.orientation !== undefined) {
    orientation = String(query.orientation).toLowerCase();
    if (!VALID_ORIENTATIONS.includes(orientation)) {
      errors.push(`Query parameter 'orientation' must be one of: ${VALID_ORIENTATIONS.join(", ")}.`);
      orientation = undefined;
    }
  }

  return { errors, value: { page, limit, orientation } };
}

/**
 * GET /api/wallpapers/feed?page=1&limit=10&orientation=portrait
 *
 * Registered before "/:id" so Express matches the literal path first —
 * otherwise "feed" would be captured as an :id value.
 */
router.get("/feed", async (req, res, next) => {
  const { errors, value } = parseFeedQuery(req.query);

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: errors.join(" ") },
    });
  }

  try {
    const result = await getFeed(value);

    res.status(200).json({
      success: true,
      data: {
        items: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          has_next: result.has_next,
        },
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallpapers/:id
 *
 * :id is namespaced as "<source>:<providerId>", e.g. "pexels:12345".
 */
router.get("/:id", async (req, res, next) => {
  const { id } = req.params;

  if (!id.includes(":")) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: "INVALID_REQUEST",
        message: "Wallpaper id must be namespaced as '<source>:<providerId>', e.g. 'pexels:12345'.",
      },
    });
  }

  try {
    const wallpaper = await getWallpaperById(id);

    if (!wallpaper) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "NOT_FOUND", message: `No wallpaper found with id '${id}'.` },
      });
    }

    res.status(200).json({ success: true, data: wallpaper, error: null });
  } catch (error) {
    next(error);
  }
});

export default router;
