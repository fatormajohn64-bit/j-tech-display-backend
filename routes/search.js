import { Router } from "express";
import { searchWallpapers } from "../services/wallpaperSearch.js";

const router = Router();

const VALID_ORIENTATIONS = ["portrait", "landscape", "square"];
const VALID_SORTS = ["relevance", "popularity", "latest"];
const MAX_LIMIT = 60;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 30;
const MAX_QUERY_LENGTH = 200;

/**
 * Parses and validates the shared search/feed query params. Returns
 * `{ errors }` (non-empty) on any invalid input — routes must check
 * `errors.length` before trusting `value`. Centralizing this here means
 * `/api/search` and any future endpoint reusing these filters validate
 * identically, no drift.
 *
 * @param {import("express").Request["query"]} query
 */
function parseSearchQuery(query) {
  const errors = [];

  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (!q) {
    errors.push("Query parameter 'q' is required and cannot be empty.");
  } else if (q.length > MAX_QUERY_LENGTH) {
    errors.push(`Query parameter 'q' must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  }

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

  let sort = "relevance";
  if (query.sort !== undefined) {
    sort = String(query.sort).toLowerCase();
    if (!VALID_SORTS.includes(sort)) {
      errors.push(`Query parameter 'sort' must be one of: ${VALID_SORTS.join(", ")}.`);
      sort = "relevance";
    }
  }

  const category = typeof query.category === "string" ? query.category.trim().slice(0, 100) : "";

  let minWidth;
  if (query.min_width !== undefined) {
    minWidth = Number.parseInt(query.min_width, 10);
    if (!Number.isInteger(minWidth) || minWidth < 0) {
      errors.push("Query parameter 'min_width' must be a non-negative integer.");
      minWidth = undefined;
    }
  }

  let minHeight;
  if (query.min_height !== undefined) {
    minHeight = Number.parseInt(query.min_height, 10);
    if (!Number.isInteger(minHeight) || minHeight < 0) {
      errors.push("Query parameter 'min_height' must be a non-negative integer.");
      minHeight = undefined;
    }
  }

  return { errors, value: { q, page, limit, orientation, sort, category, minWidth, minHeight } };
}

/**
 * GET /api/search?q=anime&page=1&limit=30&orientation=portrait&sort=relevance
 *
 * Also accepts: category, min_width, min_height.
 */
router.get("/", async (req, res, next) => {
  const { errors, value } = parseSearchQuery(req.query);

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: errors.join(" ") },
    });
  }

  try {
    const { q, page, limit, orientation, sort, category, minWidth, minHeight } = value;

    const result = await searchWallpapers(q, {
      page,
      limit,
      orientation,
      sort,
      category,
      minWidth,
      minHeight,
    });

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

export default router;
