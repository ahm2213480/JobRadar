# 📡 JobRadar

AI-powered job discovery and matching platform. JobRadar analyzes a user's CV
and professional profile, compares it against job descriptions, and produces a
**transparent Match Score (0–100)** with a per-factor breakdown, an AI-written
explanation, CV optimization suggestions, and skills-gap analysis.

> **Status: Phase 0 — Foundation** (monorepo, API server, web client, database
> schema and initial migration). Authentication, CV analysis, job matching and
> the dashboard arrive in the following phases — see [Roadmap](#roadmap).

---

## Tech stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | React 19 + Vite + TypeScript + React Router + Tailwind CSS 4 |
| Backend   | Node.js + Express 5 + TypeScript                    |
| Database  | PostgreSQL (Neon in development) + Prisma ORM       |
| Auth      | JWT (access + refresh) — Phase 1                    |
| AI        | Pluggable `IAIService` provider adapters — Phase 3  |
| Job feeds | Pluggable `IJobProvider` adapters (Remotive, Arbeitnow, RemoteOK, manual/LinkedIn-paste) — Phase 4 |

External services sit behind interfaces (`IAIService`, `IJobProvider`,
`ICVParser`, `IMatchingService`) so any provider can be swapped without
touching business logic. **No LinkedIn scraping** — job data comes only from
official/authorized APIs or jobs the user adds themselves.

## Monorepo layout

```
JobRadar/
├─ client/                 # React SPA (Vite + TS)
│  └─ src/
│     ├─ api/              # HTTP client + typed endpoints
│     ├─ components/       # Reusable UI (layout/, ui/, jobs/, ...)
│     ├─ pages/            # Route pages
│     └─ ...
├─ server/                 # Express API (TS, CommonJS build)
│  ├─ prisma/
│  │  ├─ schema.prisma     # Full ERD (17 models, 13 enums)
│  │  └─ migrations/       # SQL migrations
│  └─ src/
│     ├─ config/           # env (zod-validated), prisma client, logger
│     ├─ middleware/       # error handler, 404, (auth/validate from Phase 1)
│     ├─ routes/           # /api router (health now, features per phase)
│     └─ services/         # IAIService / IJobProvider / IMatchingService adapters
└─ package.json            # npm workspaces + shared scripts
```

## Prerequisites

- Node.js ≥ 20 (developed on v22)
- A PostgreSQL database — [Neon](https://neon.tech) free tier recommended
  (no local installation needed)

## Getting started

```bash
# 1. Install everything (workspaces: server + client)
npm install

# 2. Configure the API environment
cp server/.env.example server/.env
#    → edit server/.env and paste your Neon connection string:
#      DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"

# 3. Create the database schema (applies the initial migration)
npm run db:deploy

# 4. Generate the Prisma client (already committed output; re-run after schema changes)
npm run db:generate

# 5. Run both apps in development
npm run dev
#    API  → http://localhost:4000/api/health
#    Web  → http://localhost:5173 (proxies /api to the backend)
```

`GET /api/health` reports API liveness **and** real database connectivity
(`connected` / `not_configured` / `unreachable`) — the web home page displays
it live.

## Useful scripts (run from the repo root)

| Script                | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | API + web dev servers together             |
| `npm run dev:server`  | API only (`tsx watch`, port 4000)          |
| `npm run dev:client`  | Web only (Vite, port 5173)                 |
| `npm run build`       | Type-check + build both workspaces         |
| `npm run typecheck`   | `tsc --noEmit` for both workspaces         |
| `npm run lint`        | ESLint for both workspaces                 |
| `npm run format`      | Prettier write                             |
| `npm run db:deploy`   | Apply pending migrations (`migrate deploy`) |
| `npm run db:migrate`  | Create/apply a dev migration (`migrate dev`) |
| `npm run db:studio`   | Prisma Studio (browse data)                |

## Security notes

- Secrets live only in `server/.env` / `client/.env` (gitignored; only
  `.env.example` files are committed). AI keys never reach the browser.
- Environment variables are validated with Zod at boot; the API fails fast on
  invalid configuration.
- Helmet, CORS allow-list, JSON body limits and a global rate limiter are
  enabled from day one; per-endpoint auth rules land with Phase 1.
- Errors are logged server-side; clients only ever receive generic messages.

## Roadmap

| Phase | Scope                                                                 |
| ----- | --------------------------------------------------------------------- |
| 0 ✅  | Monorepo, API + client foundations, Prisma schema + initial migration |
| 1     | Authentication (register/login/logout, JWT, protected routes)         |
| 2     | Profile + preferences                                                 |
| 3     | CV upload, parsing (PDF/DOCX), AI CV analysis                         |
| 4     | Job source adapters + ingestion + deduplication                       |
| 5     | Transparent weighted matching engine + AI explanations                |
| 6–7   | Dashboard, jobs browsing/filters, job details ("Why you match")       |
| 8     | Saved jobs + application tracking (Kanban, notes, interviews)         |
| 9     | CV Optimizer + skills-gap + learning goals                            |
| 10    | Notifications, polish, tests, documentation                           |
