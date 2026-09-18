import { Router } from "express";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const MAX_LIMIT = 60;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 30;

/**
 * A favorite stores a full snapshot of the wallpaper (`wallpaper_data`),
 * not just its ID. Provider-hosted images and metadata can change or
 * disappear over time, and a user's favorites list should keep showing
 * what they favorited even if the provider later removes it.
 */
function isValidWallpaperPayload(wallpaper) {
  return (
    wallpaper &&
    typeof wallpaper === "object" &&
    typeof wallpaper.id === "string" &&
    wallpaper.id.includes(":") &&
    typeof wallpaper.image_url === "string" &&
    wallpaper.image_url.length > 0
  );
}

/**
 * GET /api/favorites?page=1&limit=30
 */
router.get("/", async (req, res, next) => {
  let page = 1;
  if (req.query.page !== undefined) {
    page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
  }

  let limit = DEFAULT_LIMIT;
  if (req.query.limit !== undefined) {
    const parsed = Number.parseInt(req.query.limit, 10);
    if (Number.isInteger(parsed) && parsed >= MIN_LIMIT && parsed <= MAX_LIMIT) limit = parsed;
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await req.supabase
      .from("favorites")
      .select("id, wallpaper_id, wallpaper_data, created_at", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {
        items: data,
        pagination: { page, limit, has_next: to + 1 < (count ?? 0) },
      },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/favorites
 * Body: a full normalized wallpaper object (see services/normalize.js).
 */
router.post("/", async (req, res, next) => {
  const wallpaper = req.body;

  if (!isValidWallpaperPayload(wallpaper)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: "INVALID_REQUEST",
        message: "Request body must be a wallpaper object with at least 'id' and 'image_url'.",
      },
    });
  }

  try {
    const { data, error } = await req.supabase
      .from("favorites")
      .upsert(
        { user_id: req.user.id, wallpaper_id: wallpaper.id, wallpaper_data: wallpaper },
        { onConflict: "user_id,wallpaper_id", ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    // `ignoreDuplicates` means an already-favorited wallpaper returns no
    // row here — that's success too, so fetch and return the existing one.
    if (!data) {
      const { data: existing, error: fetchError } = await req.supabase
        .from("favorites")
        .select("id, wallpaper_id, wallpaper_data, created_at")
        .eq("user_id", req.user.id)
        .eq("wallpaper_id", wallpaper.id)
        .single();
      if (fetchError) throw fetchError;
      return res.status(200).json({ success: true, data: existing, error: null });
    }

    res.status(201).json({ success: true, data, error: null });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/favorites/:id
 * :id is the wallpaper's namespaced id (e.g. "pexels:12345"), matching
 * what GET /api/favorites and GET /api/wallpapers/:id both use — the
 * client never needs to track a separate favorite-row id.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { error, count } = await req.supabase
      .from("favorites")
      .delete({ count: "exact" })
      .eq("user_id", req.user.id)
      .eq("wallpaper_id", req.params.id);

    if (error) throw error;

    if (!count) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: "NOT_FOUND", message: `No favorite found with wallpaper id '${req.params.id}'.` },
      });
    }

    res.status(200).json({ success: true, data: { deleted: true }, error: null });
  } catch (error) {
    next(error);
  }
});

export default router;
