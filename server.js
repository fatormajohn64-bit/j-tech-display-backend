import express from "express";
import cors from "cors";
import config, { validateConfig } from "./config/config.js";
import healthRouter from "./routes/health.js";
import searchRouter from "./routes/search.js";
import wallpapersRouter from "./routes/wallpapers.js";
import categoriesRouter from "./routes/categories.js";

const app = express();

// ------------------------------------------------------------------
// Core middleware
// ------------------------------------------------------------------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const allowedOrigins = config.frontend.allowedOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / same-origin requests with no Origin header
      // (curl, health checks, native mobile app shells).
      if (!origin) return callback(null, true);

      // No FRONTEND_URL configured yet (e.g. local dev) — allow all, but
      // this should always be set in production via the env var.
      if (allowedOrigins.length === 0) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Basic structured request logging — never logs bodies, headers, or
// secrets, only what's useful for debugging traffic and latency.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`
    );
  });
  next();
});

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "J-Tech Display Backend",
      message: "See /api/health for status.",
    },
    error: null,
  });
});

app.use("/api/health", healthRouter);
app.use("/api/search", searchRouter);
app.use("/api/wallpapers", wallpapersRouter);
app.use("/api/categories", categoriesRouter);

// Future phases mount here:
// app.use("/api/settings", settingsRouter);
// app.use("/api/favorites", favoritesRouter);
// app.use("/api/users", usersRouter);

// ------------------------------------------------------------------
// 404 handler — must come after all routes
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
    },
  });
});

// ------------------------------------------------------------------
// Centralized error handler — must be registered last, with 4 args
// ------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err.message);

  const isCorsError = err.message === "Not allowed by CORS";

  res.status(isCorsError ? 403 : 500).json({
    success: false,
    data: null,
    error: {
      code: isCorsError ? "CORS_NOT_ALLOWED" : "INTERNAL_SERVER_ERROR",
      message: isCorsError
        ? "This origin is not permitted to access the API."
        : "Something went wrong. Please try again.",
    },
  });
});

// ------------------------------------------------------------------
// Startup
// ------------------------------------------------------------------
validateConfig();

app.listen(config.port, () => {
  console.log(`🚀 J-Tech Display Backend running on port ${config.port} (${config.env})`);
  console.log(`   Health check: http://localhost:${config.port}/api/health`);
});

export default app;
