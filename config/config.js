import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized application configuration.
 * Every value here is sourced from environment variables — nothing is
 * hard-coded. Consumers of config should import from this file only,
 * never read `process.env` directly, so validation stays in one place.
 */

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

// FRONTEND_URL supports a comma-separated list of allowed origins.
const parsedFrontendOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  env: nodeEnv,
  isProduction,
  port: parseInt(process.env.PORT, 10) || 3000,

  frontend: {
    allowedOrigins: parsedFrontendOrigins,
  },

  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  providers: {
    pexels: {
      apiKey: process.env.PEXELS_API_KEY || "",
      baseUrl: "https://api.pexels.com/v1",
    },
    pixabay: {
      apiKey: process.env.PIXABAY_API_KEY || "",
      baseUrl: "https://pixabay.com/api",
    },
    unsplash: {
      apiKey: process.env.UNSPLASH_ACCESS_KEY || "",
      baseUrl: "https://api.unsplash.com",
    },
    wallhaven: {
      apiKey: process.env.WALLHAVEN_API_KEY || "",
      baseUrl: "https://wallhaven.cc/api/v1",
    },
  },
};

/**
 * Required secrets grouped by the feature they gate. Nothing here throws
 * at import time — the server should still boot and serve /api/health
 * even when a provider key is missing — but we surface clear warnings so
 * misconfiguration is obvious in the logs instead of failing silently
 * deep inside a request handler.
 */
const requiredGroups = {
  "Supabase (auth, favorites, settings, history)": [
    ["SUPABASE_URL", config.supabase.url],
    ["SUPABASE_ANON_KEY", config.supabase.anonKey],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabase.serviceRoleKey],
  ],
  "Pexels provider": [["PEXELS_API_KEY", config.providers.pexels.apiKey]],
  "Pixabay provider": [["PIXABAY_API_KEY", config.providers.pixabay.apiKey]],
  "Unsplash provider": [
    ["UNSPLASH_ACCESS_KEY", config.providers.unsplash.apiKey],
  ],
  "Wallhaven provider": [
    // Wallhaven's public search works without a key; a key only unlocks
    // NSFW-tier browsing and higher rate limits, so it is not required.
  ],
};

/**
 * Logs a warning for every missing environment variable, grouped by the
 * feature it powers. Call this once at server startup.
 */
export function validateConfig() {
  const missingByGroup = [];

  for (const [groupName, vars] of Object.entries(requiredGroups)) {
    const missing = vars.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      missingByGroup.push({ groupName, missing });
    }
  }

  if (missingByGroup.length > 0) {
    console.warn("⚠️  Missing environment variables — some features will be degraded or disabled:");
    for (const { groupName, missing } of missingByGroup) {
      console.warn(`   • ${groupName}: missing ${missing.join(", ")}`);
    }
    console.warn("   See .env.example for the full list of required variables.\n");
  }

  if (config.frontend.allowedOrigins.length === 0) {
    console.warn("⚠️  FRONTEND_URL is not set — CORS will fall back to a permissive dev default.\n");
  }

  return missingByGroup;
}

export default config;
