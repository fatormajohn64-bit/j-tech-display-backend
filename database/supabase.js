import { createClient } from "@supabase/supabase-js";
import config from "../config/config.js";

/**
 * Server-side Supabase client, authenticated with the service-role key.
 *
 * This client bypasses Row Level Security and must NEVER be exposed to
 * the frontend, logged, or sent in any API response. It exists only for
 * trusted backend operations (reading/writing favorites, settings,
 * history, profiles on behalf of an already-authenticated user).
 *
 * If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured, this
 * export is `null` so the rest of the app can boot (e.g. to serve
 * /api/health) without crashing. Routes that depend on the database must
 * check for `null` and respond with a clear "not configured" error
 * rather than throwing.
 */
export const supabaseAdmin =
  config.supabase.url && config.supabase.serviceRoleKey
    ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * Creates a per-request Supabase client scoped to the end user's own
 * access token, so Row Level Security policies apply exactly as they
 * would for a client-side call. Use this (not supabaseAdmin) for any
 * operation that should respect the requesting user's own permissions —
 * for example, verifying a JWT in auth middleware.
 *
 * @param {string} accessToken - The user's Supabase JWT (from the
 *   Authorization header).
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function createUserScopedClient(accessToken) {
  if (!config.supabase.url || !config.supabase.anonKey) {
    return null;
  }

  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * True when Supabase is fully configured and supabaseAdmin is usable.
 */
export const isSupabaseConfigured = Boolean(supabaseAdmin);

export default supabaseAdmin;
