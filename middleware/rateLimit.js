import rateLimit from "express-rate-limit";

/**
 * Shared JSON error shape so a rate-limited response looks like every
 * other error response in the API, not like a generic Express error page.
 */
function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    data: null,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please slow down and try again shortly.",
    },
  });
}

/**
 * Baseline limiter applied to every /api route: generous enough that no
 * normal user ever notices it, tight enough to blunt a script hammering
 * the API.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Stricter limiter for routes that call out to the four external
 * providers (search, feed, category browsing, wallpaper detail lookups
 * that aren't yet cached). These are the requests that cost real
 * provider rate-limit budget, so they get their own tighter ceiling on
 * top of the general one.
 */
export const providerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export default generalLimiter;
