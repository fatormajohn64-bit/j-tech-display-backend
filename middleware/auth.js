import supabaseAdmin, { isSupabaseConfigured } from "../database/supabase.js";

/**
 * Verifies the caller's Supabase access token and attaches the
 * authenticated user to `req.user`.
 *
 * This backend never handles passwords, email codes, or OAuth
 * redirects itself — that entire flow (including "Continue with
 * Google") is Supabase Auth running on the frontend. The frontend
 * calls:
 *
 *   supabase.auth.signInWithOAuth({ provider: "google" })
 *
 * Supabase handles the Google consent screen and returns a session with
 * an access token. The frontend sends that token here as:
 *
 *   Authorization: Bearer <access_token>
 *
 * This middleware asks Supabase "is this token valid, and who is it
 * for" — it never inspects or trusts the token's contents directly. If
 * valid, `req.user` is populated from Google's profile data (already
 * synced into Supabase by the OAuth flow) so downstream routes never
 * have to re-fetch it.
 *
 * One-time setup this unlocks (done once, in dashboards, not code):
 * enable the Google provider under Supabase → Authentication →
 * Providers, with a Google Cloud OAuth Client ID/Secret.
 */
export async function requireAuth(req, res, next) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({
      success: false,
      data: null,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Authentication is not configured on this server yet.",
      },
    });
  }

  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header. Expected 'Bearer <access_token>'.",
      },
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired session." },
      });
    }

    const { user } = data;

    // Google's profile fields land in user_metadata under slightly
    // different keys depending on the flow, so we check both.
    req.user = {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
    };

    next();
  } catch (err) {
    next(err);
  }
}

export default requireAuth;
    
