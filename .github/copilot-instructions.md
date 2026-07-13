# Breadcrumbs — Copilot Instructions

Analytics dashboard for personal Google Maps Timeline location history. Three independently-run pieces share one MySQL database named `breadcrumbs`:

1. **`load_timeline.py`** — Python ETL that parses `data/Timeline.json` into MySQL.
2. **`server/`** — Node + Express + TypeScript API (port **3013**).
3. **`client/`** — React + Vite + Leaflet SPA (dev port **5173**).

Data flow: `Timeline.json` → `load_timeline.py` → MySQL → Express (`/api/*`) → React/Leaflet map.

## Commands

There is **no test suite and no linter** configured — do not invent `npm test`/lint commands.

- ETL: `python load_timeline.py` (requires `data/Timeline.json` and the env vars below).
- Server: `cd server && npm install`, then `npm run dev` (tsx watch), `npm run build` (`tsc`), `npm start` (`node dist/index.js`).
- Client: `cd client && npm install`, then `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run preview`.
- Build is the validation step. After changing TS, run the relevant `npm run build` to type-check.

## Environment & data

- MySQL credentials come **only** from env vars `BREADCRUMBS_MYSQL_USER` and `BREADCRUMBS_MYSQL_PASSWORD`, read identically in `load_timeline.py`, `server/src/index.ts`, and `server/src/analysis.ts`. Never hardcode credentials.
- Auth env vars (`server/src/auth.ts`): `BREADCRUMBS_PASSWORD` (the single shared login password — required for login to succeed), `BREADCRUMBS_SESSION_SECRET` (signing key for the session cookie; set a fixed value so logins survive restarts), and optional `BREADCRUMBS_INSECURE_COOKIES=true` to allow non‑Secure cookies when testing over plain HTTP.
- Connection params are hardcoded as `host: localhost`, `database: breadcrumbs`. MySQL pools set `timezone: "+00:00"`.
- `data/` is git-ignored; `Timeline.json` (~100 MB) is never committed. The README documents its full JSON structure.

## Database conventions

- **The schema lives only in `README.md`** (the "MySQL Schema" section) — there are no migration files. `load_timeline.py` assumes all tables already exist; create/update schema by hand from the README, and keep the README in sync if you change tables.
- Segments use a **table-per-subtype** pattern: base `semantic_segments` plus `segment_visits` / `segment_activities` / `segment_timeline_paths`. `places` is a shared lookup table referenced by `place_id` to avoid duplicating Google place-ID strings.
- All timestamps are stored and compared in **UTC** (`DATETIME(3)`); Python normalizes with `parse_time()` before insert. Coordinates are `DECIMAL(10,7)`/`DECIMAL(11,7)`.
- `load_timeline.py` does **incremental loading**: it reads `MAX(start_time)` / `MAX(recorded_at)` as cutoffs and only inserts newer rows. `userLocationProfile` is loaded only on the first (empty-DB) run.

## Server conventions

- The notion of a location **"point"** is built in `analysis.ts::loadPoints` by `UNION ALL` over five sources — timeline-path points, visit start, visit end, activity start, activity end — ordered by event time. The same `dateFilter`/`params` are repeated once per UNION branch, so any change to the filter must update `allParams` accordingly.
- `getPoints` caches the **full unfiltered dataset** in `cachedPoints`; subdivisions are cached in `subdivisionsCache`. These in-memory caches persist for the server's lifetime, so a fresh ETL load requires a server restart to reflect new data.
- Date handling: `/api/analyze` accepts `startUtc`/`endUtc` for exact UTC boundaries (`exactRange=true`) or `start`/`end` for day-granularity (end is bumped +1 day). Preserve both paths.
- Subdivision grouping rounds coordinates to **0.01°** grid cells (`gridKey`), matching `grid_subdivisions` which is populated by `load_timeline.py::load_subdivisions` via Nominatim reverse geocoding at **1 request/sec**.
- Endpoints: `/api/analyze`, `/api/subdivisions`, `/api/average-over-time`. In production the server also serves the built client from `../../client/dist` with an `index.html` fallback.

## Authentication

- The whole app sits behind a **single shared password** (single-user app — no accounts/roles). Logic is in `server/src/auth.ts`, wired in `index.ts` as: `sessionMiddleware` → open `POST /api/login` & `POST /api/logout` → `requireAuth` gate → static client + API.
- `requireAuth` must stay registered **after** the login/logout routes and **before** the static/API handlers, or it will either block login or leak data. Login is validated with a constant-time compare (`crypto.timingSafeEqual`).
- Unauthenticated requests get a self-contained HTML login page (for navigations) or `401` JSON (for `/api/*`). On success a signed, httpOnly, SameSite=Lax, Secure session cookie is set via `cookie-session`; the login page just reloads. The React client is untouched by auth.
- Cookies are `Secure` by default, so the app must be served over **HTTPS** in production.

## Client conventions

- `server/src/types.ts` and `client/src/types.ts` are **duplicated by hand** (no shared package). Keep `LocationEntry` / `Extremes` / `AnalysisResult` identical in both when changing the API contract.
- The client calls the API via relative `/api/...` paths; `vite.config.ts` proxies `/api` → `http://localhost:3013` in dev. Components fetch directly (`fetch("/api/...")`) except `analyze`, which goes through `client/src/api.ts`.
- Styling is Tailwind utility classes inline in JSX. Map rendering uses Leaflet / react-leaflet with a custom `leaflet.heat` heatmap (typed in `leaflet-heat.d.ts`).
