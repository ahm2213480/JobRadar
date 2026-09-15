# JobRadar

An AI-powered job discovery and matching platform. JobRadar analyzes a user's
CV and professional profile, compares it against job descriptions from multiple
sources, and produces a **transparent Match Score (0–100)** with a per-factor
breakdown, an AI-written explanation, CV optimization suggestions, and a
skills-gap analysis with learning goals.

**Every score is deterministic and explainable** — the matching engine is a
pure, unit-tested function with seven documented factors. AI is used only to
*explain* results, never to compute them.

| | |
| --- | --- |
| CI | [![CI](https://github.com/ahm2213480/JobRadar/actions/workflows/ci.yml/badge.svg)](https://github.com/ahm2213480/JobRadar/actions/workflows/ci.yml) |
| Stack | ![Node](https://img.shields.io/badge/node-%E2%89%A520-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![React](https://img.shields.io/badge/React-19-149eca) ![Prisma](https://img.shields.io/badge/Prisma-ORM-16a34a) ![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4) |
| Tests | ![Tests](https://img.shields.io/badge/tests-48%20passing-brightgreen) ![Auth](https://img.shields.io/badge/auth-integration%20tested-8b5cf6) |

## Features

- **Authentication** — JWT access tokens (in memory) + rotating refresh tokens
  (httpOnly cookie), session revocation via token versioning, silent refresh.
- **Profile and preferences** — profile editor, job preferences (titles,
  locations, technologies, work mode, salary range) and a completion score.
- **CV intelligence** — PDF/DOCX upload (magic-byte verified), AI skill
  extraction, auto-fill of profile and skills, CV optimizer.
- **Job discovery** — pluggable provider adapters: Remotive, RemoteOK,
  Arbeitnow, Adzuna, JSearch (LinkedIn + boards) and a web-search provider
  (Serper.dev / Google SERP) that returns real job-listing URLs. Content-based
  deduplication, 6-hour scheduler and manual "Sync now".
- **Transparent matching** — weighted 7-factor engine (required skills 35%,
  preferred skills 10%, experience 15%, title 15%, education 5%,
  location/work mode 10%, salary 10%) with a full per-factor breakdown.
- **Application tracking** — Kanban board, notes, interview rounds with
  outcomes, saved jobs.
- **Skills gap** — demand-based gap analysis against target jobs plus learning
  goals with due dates.
- **Notifications** — new matches, high-score alerts, interview reminders.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, React Router, Tailwind CSS 4 |
| Backend | Node.js 20+, Express 5, TypeScript |
| Database | PostgreSQL (Neon) + Prisma ORM (17 models, 13 enums) |
| Auth | JWT (access + refresh rotation, revocation) |
| AI | Pluggable `IAIService` (Gemini adapter + heuristic fallback) |
| Jobs | Pluggable `IJobProvider` adapters (6 sources) |
| Testing | Vitest (unit + end-to-end auth integration tests) |
| CI | GitHub Actions (Postgres service, migrations, typecheck, lint, tests) |

External services sit behind interfaces (`IAIService`, `IJobProvider`,
`IMatchingService`) so any provider can be swapped without touching business
logic. **No LinkedIn scraping** — job data comes only from official/authorized
APIs or jobs the user adds manually.

## Architecture

```
JobRadar/
├─ client/                 # React SPA (Vite + TS)
│  └─ src/
│     ├─ api/              # Typed HTTP client with silent-refresh on 401
│     ├─ components/       # UI kit (ui/, layout/, jobs/, cv/, matching/, applications/)
│     ├─ context/          # Auth session (silent refresh) + theme
│     ├─ hooks/            # Shared hooks (debounce, …)
│     ├─ pages/            # Route pages (dashboard, jobs, match, applications, …)
│     └─ types/            # Shared DTO shapes
├─ server/
│  ├─ prisma/              # schema.prisma + SQL migrations
│  └─ src/
│     ├─ config/           # Zod-validated env, Prisma client, logger
│     ├─ middleware/       # Auth (JWT), error handler, upload, validate
│     ├─ modules/          # Feature modules: auth / profile / cv / jobs /
│     │                    # matching / saved / skills / applications / notifications
│     ├─ scheduler/        # node-cron job-feed sync (every 6 h)
│     └─ services/         # ai/ · cv/ · jobs/ (6 adapters + ingest) · matching/
└─ package.json            # npm workspaces + shared scripts
```

## Getting started

### Prerequisites

- Node.js ≥ 20 (developed on v22)
- A PostgreSQL database — the [Neon](https://neon.tech) free tier works great
  (no local installation needed)
- Optional API keys (Serper / JSearch / Adzuna / Gemini) — every provider
  degrades gracefully without its key

### Setup

```bash
# 1. Install everything (npm workspaces: server + client)
npm install

# 2. Configure the API environment
cp server/.env.example server/.env
#    → paste your Neon connection string into DATABASE_URL and generate the
#      JWT secrets:
#      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Create the database schema (applies all pending migrations)
npm run db:deploy

# 4. Generate the Prisma client
npm run db:generate

# 5. Run both apps in development
npm run dev
#    API → http://localhost:4000/api/health
#    Web → http://localhost:5173  (the dev server proxies /api to the backend)
```

### Environment variables (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (a Neon pooled URL works) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | 32+ chars; generate with `crypto.randomBytes(48).toString('hex')` |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | no | Defaults: `15m` / `7d` |
| `PORT` / `CORS_ORIGIN` / `NODE_ENV` | no | Defaults: `4000` / `http://localhost:5173` / `development` |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | no | Gemini CV analysis; without a key a built-in heuristic extractor is used |
| `SERPER_API_KEY` | no | Web-search provider (Google SERP via serper.dev, 2 500 free queries/month) |
| `JSEARCH_API_KEY` | no | JSearch (RapidAPI) — LinkedIn + boards aggregation |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | no | Adzuna official job-search API |

The client needs no configuration in development (`VITE_API_BASE_URL=/api`
by default). Every key degrades gracefully — a missing key only disables that
one provider or falls back to the heuristic extractor.

## Scripts (repo root)

| Script | Purpose |
| --- | --- |
| `npm run dev` | API + web dev servers together (concurrently) |
| `npm run dev:server` / `dev:client` | Run one side only |
| `npm run build` | Type-check + production build for both workspaces |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint for both workspaces |
| `npm test` | Vitest suite (run inside `server/`) |
| `npm run format` | Prettier |
| `npm run db:generate` / `db:deploy` / `db:migrate` / `db:studio` | Prisma client / apply migrations / create a dev migration / browse data |

## Testing

```bash
cd server && npm test
```

- **Unit tests** — the deterministic matching engine, provider adapter payload
  mapping, and application status schemas.
- **Integration tests** — the full auth flow (register, login, refresh
  rotation, logout, cross-session revocation) against a real database using
  Node's built-in fetch. Skipped automatically when `DATABASE_URL` is absent;
  provisioned with a Postgres 16 service container in CI.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` and
on every pull request:

| Job | Steps |
| --- | --- |
| server | `prisma migrate deploy` against a Postgres 16 service container, then typecheck, ESLint and the full Vitest suite |
| client | typecheck, ESLint and a production Vite build |

## Security

- Secrets live only in gitignored `.env` files (committed `.env.example`
  templates document every variable). API keys never reach the browser.
- Environment variables are validated with Zod at boot — the API fails fast on
  invalid configuration.
- Helmet, a CORS allow-list, JSON body limits and layered rate limiters
  (global plus tighter limits on credential endpoints) are enabled from day
  one.
- Access tokens live in memory only; refresh tokens are httpOnly cookies that
  rotate on every use and are revoked via token versioning.
- Every query is scoped by the authenticated `userId` from the token — never
  from request input — so users cannot reach each other's data.
- Errors are logged server-side; clients receive generic messages only.

## Roadmap

All planned phases are complete:

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Monorepo, API + client foundations, Prisma schema + migration | Done |
| 1 | Authentication (JWT refresh rotation, revocation, protected routes) | Done |
| 2 | Profile + preferences with completion score | Done |
| 3 | CV upload + parsing + AI skill extraction | Done |
| 4 | Job source adapters, ingestion, deduplication, scheduler | Done |
| 5 | Transparent weighted matching engine + AI explanations | Done |
| 6–7 | Jobs browsing, detail pages, match breakdown, dashboard | Done |
| 8 | Saved jobs + application tracking (Kanban, notes, interviews) | Done |
| 9 | CV optimizer + skills-gap + learning goals | Done |
| 10 | Notifications + polish | Done |

## Deployment (free tier)

JobRadar deploys as **one free web service that serves both the API and the
built SPA**. The browser therefore only ever talks to a single origin: no CORS
setup, and the httpOnly refresh cookie stays first-party (`sameSite=strict`).

| Piece | Service | Free allowance |
| --- | --- | --- |
| API + SPA | Render web service (Free plan) | Single instance that spins down when idle |
| Database | Neon Free | 100 CU-hours/project · 0.5 GB storage · 5 GB transfer/month |

**Do not** use Render's free PostgreSQL — free databases expire 30 days after
creation and have no backups. Use Neon: it suspends compute after 5 minutes of
inactivity, and `config/prisma.ts` already sets `connect_timeout` so a cold
database fails fast instead of hanging the whole job sync.

Build and start commands (Render dashboard, or the `render.yaml` blueprint at
the repo root):

```bash
# Build — --include=dev is required: tsc and the Prisma CLI are devDependencies
npm ci --include=dev && npm run db:generate -w server && npm run build

# Start — migrations run before the server boots
npm run db:deploy -w server && npm run start -w server
```

`healthCheckPath` is `/api/health`. Required environment variables:
`NODE_ENV=production`, `DATABASE_URL` (the Neon **pooled** string), fresh
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, and `CORS_ORIGIN` set to the public
URL. Leave the root directory at the repository root: Render does not expose
files outside it, and this is an npm workspaces monorepo.

Two free-tier behaviours to plan around:

- **The scheduler stops when the instance sleeps.** `node-cron` runs inside the
  API process, so an instance that spins down when idle misses its 6-hourly
  ticks. Point a free pinger (cron-job.org, UptimeRobot) at `/api/health` every
  10 minutes to keep it warm.
- **Uploaded CV files live on the local disk and are lost on redeploy.** Only
  the extracted `rawText` matters downstream — it is stored in PostgreSQL and
  feeds the AI analysis, so the CV flow keeps working. Move to object storage
  before exposing a CV download endpoint.

Possible next steps: full-text search (Postgres `tsvector`), client code
splitting, cloud storage for CV uploads, email notifications.

