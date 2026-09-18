import { Router } from "express";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/**
 * Fetches the caller's profile row, creating it from their Google
 * identity on first access. Supabase creates the `auth.users` row the
 * moment someone signs in with Google — this creates the matching
 * `profiles` row (display name/avatar/email) the first time they hit
 * any authenticated endpoint, so no separate "finish setting up your
 * account" step is ever needed.
 */
async function getOrCreateProfile(req) {
  const { data: existing, error: fetchError } = await req.supabase
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing;

  const metadata = req.user.user_metadata || {};
  const { data: created, error: insertError } = await req.supabase
    .from("profiles")
    .insert({
      id: req.user.id,
      email: req.user.email || "",
      display_name: metadata.full_name || metadata.name || "",
      avatar_url: metadata.avatar_url || metadata.picture || "",
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

/**
 * GET /api/users/me
 */
router.get("/me", async (req, res, next) => {
  try {
    const profile = await getOrCreateProfile(req);
    res.status(200).json({ success: true, data: profile, error: null });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/me
 *
 * Only `display_name` is user-editable here — email and avatar are
 * sourced from Google and stay in sync with the Google account rather
 * than being independently editable, so the profile never drifts out
 * of sync with what the user sees on their Google account itself.
 */
router.put("/me", async (req, res, next) => {
  const { display_name } = req.body || {};

  if (typeof display_name !== "string" || display_name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: "'display_name' is required and must be a non-empty string." },
    });
  }
  if (display_name.length > 80) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: "INVALID_REQUEST", message: "'display_name' must be 80 characters or fewer." },
    });
  }

  try {
    await getOrCreateProfile(req); // ensures the row exists before updating it
    const { data, error } = await req.supabase
      .from("profiles")
      .update({ display_name: display_name.trim() })
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data, error: null });
  } catch (error) {
    next(error);
  }
});

export default router;
