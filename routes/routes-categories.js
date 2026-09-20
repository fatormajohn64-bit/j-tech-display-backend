import { Router } from "express";
import { getAllCategories, getCategoryBySlug } from "../data/categories.js";
import { searchWallpapers } from "../services/wallpaperSearch.js";

const router = Router();

const VALID_ORIENTATIONS = ["portrait", "landscape", "square"];
const MAX_LIMIT = 60;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 30;

function parseCategoryQuery(query) {
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
 * GET /api/categories
 *
 * Returns the full category list (metadata only — no wallpapers here;
 * fetch a category's wallpapers via GET /api/categories/:slug).
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: { items: getAllCategories() },
    error: null,
  });
});

/**
 * GET /api/categories/:slug?page=1&limit=30&orientation=portrait
 *
 * Runs the category's tuned search_query through the same aggregation
 * pipeline as /api/search, so results are normalized, deduplicated, and
 * ranked identically.
 */
router.get("/:slug", async (req, res, next) => {
  const category = getCategoryBySlug(req.params.slug);

  if (!category) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: `No category found with slug '${req.params.slug}'.` },
    });
  }

  const { errors, value } = parseCategoryQuery(req.query);

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: errors.join(" ") },
    });
  }

  try {
    const { page, limit, orientation } = value;

    const result = await searchWallpapers(category.search_query, {
      page,
      limit,
      orientation,
      category: category.slug,
    });

    res.status(200).json({
      success: true,
      data: {
        category,
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
