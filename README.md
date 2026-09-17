# J-Tech Display — Backend

Mobile-first wallpaper discovery API. Aggregates wallpapers from **Pexels**, **Pixabay**, **Unsplash**, and **Wallhaven** into one normalized, ranked, deduplicated feed — built for a fast, immersive vertical-scroll wallpaper app.

This is **Phase 1 — Foundation**. Search, categories, feed, favorites, and auth are built in later phases.

## Stack

- Node.js + Express (ES Modules)
- Supabase (Postgres, Auth, Row Level Security)
- Axios / native `fetch` for provider calls
- Deployable on Render with zero extra infrastructure

## Getting started

```bash
npm install
cp .env.example .env
# fill in .env with your real keys
npm run dev      # auto-restarts on file changes
# or
npm start
```

The server boots even with missing provider keys — it logs a warning per missing group instead of crashing, so `/api/health` is always reachable. Fill in `.env` before relying on any provider- or database-backed route in later phases.

## Environment variables

See [`.env.example`](./.env.example) for the full list. Required groups:

| Variable | Powers |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, favorites, settings, history |
| `PEXELS_API_KEY` | Pexels provider |
| `PIXABAY_API_KEY` | Pixabay provider |
| `UNSPLASH_ACCESS_KEY` | Unsplash provider |
| `WALLHAVEN_API_KEY` | Optional — raises Wallhaven rate limits / unlocks NSFW-tier browsing; public search works without it |
| `FRONTEND_URL` | Comma-separated allowed CORS origins |

`SUPABASE_SERVICE_ROLE_KEY` and all provider keys are server-side only and are never sent to the client.

## Project structure

```
j-tech-display-backend/
├── server.js              # Express app entry point
├── config/config.js       # Centralized env var config + validation
├── database/supabase.js   # Supabase clients (admin + user-scoped)
├── routes/health.js       # GET /api/health
├── routes/                # (search, wallpapers, categories, settings,
│                             favorites, users — added in later phases)
├── services/               # provider adapters, ranking, cache, dedupe
│                             (added in later phases)
├── middleware/auth.js      # (added in Phase 5)
└── data/categories.js      # (added in Phase 4)
```

## API — Phase 1

### `GET /api/health`

```json
{
  "success": true,
  "data": {
    "service": "J-Tech Display Backend",
    "status": "healthy",
    "environment": "development",
    "uptime_seconds": 42,
    "timestamp": "2026-09-17T12:00:00.000Z",
    "dependencies": {
      "supabase": false,
      "pexels": false,
      "pixabay": false,
      "unsplash": false,
      "wallhaven": true
    }
  },
  "error": null
}
```

## Deployment (Render)

1. Push this repo to GitHub.
2. In Render, create a **Web Service** pointing at the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add every variable from `.env.example` under Render's **Environment** tab.
5. Deploy. Confirm `https://<your-service>.onrender.com/api/health` returns `status: "healthy"`.
