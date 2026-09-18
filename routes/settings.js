import { Router } from "express";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * Defaults applied the first time a user has no settings row yet — kept
 * in one place so GET and PUT agree on exactly what "default" means.
 */
const DEFAULT_SETTINGS = {
  theme: "dark",
  wallpaper_quality: "high",
  preferred_orientation: "portrait",
  autoplay_feed: true,
  data_saver: false,
  show_download_button: true,
  show_source: true,
  preferred_categories: [],
  hide_categories: [],
  feed_mode: "discover",
};

/**
 * One validator per editable setting. PUT rejects any key not listed
 * here, and rejects a listed key whose value fails its validator — so
 * a bad request never partially corrupts a user's settings row.
 */
const VALIDATORS = {
  theme: (v) => ["light", "dark", "system"].includes(v),
  wallpaper_quality: (v) => ["low", "medium", "high", "original"].includes(v),
  preferred_orientation: (v) => ["portrait", "landscape", "square"].includes(v),
  autoplay_feed: (v) => typeof v === "boolean",
  data_saver: (v) => typeof v === "boolean",
  show_download_button: (v) => typeof v === "boolean",
  show_source: (v) => typeof v === "boolean",
  preferred_categories: (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  hide_categories: (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
  feed_mode: (v) => ["discover", "following", "trending"].includes(v),
};

/**
 * Fetches the caller's settings row, creating it with defaults on
 * first access. Uses `req.supabase` (RLS-scoped to this user), so this
 * can never accidentally read or create a row for anyone else.
 */
async function getOrCreateSettings(req) {
  const { data: existing, error: fetchError } = await req.supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { data: created, error: insertError } = await req.supabase
    .from("user_settings")
    .insert({ user_id: req.user.id, ...DEFAULT_SETTINGS })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

/**
 * GET /api/settings
 */
router.get("/", async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req);
    res.status(200).json({ success: true, data: settings, error: null });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 *
 * Partial update — send only the keys you want to change. Unknown keys
 * or invalid values reject the whole request with a 400 rather than
 * silently ignoring them.
 */
router.put("/", async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: "Request body must include at least one setting to update." },
    });
  }

  const errors = [];
  const updates = {};

  for (const key of keys) {
    const validator = VALIDATORS[key];
    if (!validator) {
      errors.push(`Unknown setting '${key}'.`);
      continue;
    }
    if (!validator(body[key])) {
      errors.push(`Invalid value for setting '${key}'.`);
      continue;
    }
    updates[key] = body[key];
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: errors.join(" ") },
    });
  }

  try {
    await getOrCreateSettings(req); // ensures the row exists before updating it
    const { data, error } = await req.supabase
      .from("user_settings")
      .update(updates)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data, error: null });
  } catch (error) {
    next(error);
  }
});

export default router;
