import { Router } from "express";
import config from "../config/config.js";
import { isSupabaseConfigured } from "../database/supabase.js";

const router = Router();

const startedAt = Date.now();

/**
 * GET /api/health
 *
 * Lightweight liveness/readiness probe. Safe to poll frequently and safe
 * to expose publicly — it reports boolean configuration flags only,
 * never key values, so it can be used by uptime monitors and by the
 * Render deploy health check without leaking anything sensitive.
 */
router.get("/", (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  res.status(200).json({
    success: true,
    data: {
      service: "J-Tech Display Backend",
      status: "healthy",
      environment: config.env,
      uptime_seconds: uptimeSeconds,
      timestamp: new Date().toISOString(),
      dependencies: {
        supabase: isSupabaseConfigured,
        pexels: Boolean(config.providers.pexels.apiKey),
        pixabay: Boolean(config.providers.pixabay.apiKey),
        unsplash: Boolean(config.providers.unsplash.apiKey),
        wallhaven: true, // Wallhaven's search works without an API key
      },
    },
    error: null,
  });
});

export default router;
