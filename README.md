# Mobility Transactions Domain

**Provider-agnostic backend for ride lifecycle, fare finalization, payment intents, settlement, and ETA at scale.**

A system-of-record API built with strict hexagonal architecture, domain-driven design, and zero tolerance for duplicate charges or invalid state transitions.

## Description

This project is the **backend API** for a mobility platform. It is the single source of truth for:

- **Ride state** — Authoritative state machine (`CREATED` → `DISPATCHING` → `ASSIGNED` → `STARTED` → `COMPLETED` / `CANCELED` / `EXPIRED` / `FAILED`) with illegal transitions rejected.
- **Fare (COP)** — Deterministic, explainable fare computation with audit trail (base, distance, duration, minimum applied).
- **Payment intents & settlement** — Provider-agnostic payment orchestration: one intent per completed ride, idempotent settlement attempts, canonical outcomes (`PENDING` | `SUCCEEDED` | `DECLINED` | `FAILED` | `UNKNOWN`), and no duplicate successful charges.
- **ETA exposure** — Four contexts (Eyeball, Dispatch, Pickup, On-Trip) with freshness and honest degradation so high-QPS ETA reads do not harm critical write paths.

The system is **not multi-tenant**. Isolation is by **resource ownership**, **role scope**, and (where applicable) **geographic scope**. It is designed for retries, timeouts, and duplicate messages: all writes are idempotent; payment and ride invariants are enforced in the domain and guarded by tests.

### Features

- **Hexagonal architecture** — Domain ← Application ← Adapters; no framework or infra types in domain.
- **Screaming architecture** — Bounded contexts by business capability (rides, fares, payments, drivers, dispatch, etc.) with vertical slices: `domain`, `application`, `infrastructure` (adapters).
- **Typed errors** — `Result<Ok, Err>` (`better-result`) for expected outcomes; no `throw` for business failures.
- **Single DB pool** — Sequelize for pool and migrations, Kysely (via kysely-sequelize) for typed SQL; one transaction boundary per use case when both are used.
- **Determinism** — IDs, time, and randomness injected via ports (cuid2, clock, RNG); no `Date.now()` or `Math.random()` in domain/application.
- **Validation at the boundary** — Zod at HTTP; domain receives only validated primitives and value objects.
- **Observability** — Pino (JSON), OpenTelemetry (metrics/traces), collector-first routing; optional local stack (Prometheus, Grafana, Jaeger, Loki) via Taskfile.

### Tech stack

| Layer        | Choices |
|-------------|---------|
| Runtime     | Node.js (ESM) |
| Language    | TypeScript (strict) |
| HTTP        | Fastify v5 |
| Validation  | Zod (fastify-type-provider-zod) |
| Database    | PostgreSQL |
| ORM / pool  | Sequelize |
| Typed SQL   | Kysely + kysely-sequelize (single pool) |
| Errors      | better-result |
| Auth / crypto | jose, Better Auth |
| IDs         | cuid2 |
| Logging     | Pino (JSON) |
| Tests       | Vitest, Testcontainers (integration) |
| Lint/format | Ultracite (Biome) |
| Env         | std-env, dotenv |


## Visuals

- **Architecture:** A high-level diagram (e.g. HTTP → Application → Domain, with Adapters on the side) can go in `docs/` or here. The PRD includes a Mermaid state diagram for the ride state machine (see [PRD.md](PRD.md)).
- **Screenshots:** For local dev, consider a screenshot of Swagger/Scalar at `/docs`, or of Grafana/Prometheus when running the observability stack (`task obs:start`).
- **Sequence diagrams:** Optionally add sequence diagrams for “Complete ride” or “Initiate settlement” in `docs/` to illustrate flow across layers.


## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (ESM)
- **pnpm** ≥ 8
- **Docker** and **Docker Compose** (for Postgres and optional observability)
- **Task** ([go-task](https://taskfile.dev/)) — recommended for infra and observability tasks

### Installation

```bash
# Clone the repository
git clone https://github.com/sanurb/mobility-transactions-domain.git
cd mobility-transactions-domain

# Install dependencies
pnpm install

# Copy env template (if present) or create .env — see Configuration
# cp .env.example .env
```

### Configuration

Create a `.env` in the project root. Required and optional variables (validated at startup via Zod):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP server port (1–65535) |
| `APP_NAME` | No | `Mobility Transactions API` | Application name (max 100 chars) |
| `DATABASE_URL` | **Yes** | — | PostgreSQL URL (e.g. `postgres://mobility:secret@localhost:5432/mobility_transactions`) |
| `DATABASE_POOL_MIN` | No | `2` | Pool minimum size |
| `DATABASE_POOL_MAX` | No | `10` | Pool maximum size |
| `DATABASE_POOL_ACQUIRE` | No | `30000` | Acquire timeout (ms) |
| `DATABASE_POOL_IDLE` | No | `10000` | Idle timeout (ms) |
| `JWT_ISSUER` | No | `mobility-transactions` | JWT issuer |
| `JWT_AUDIENCE` | No | `mobility-api` | JWT audience |
| `BETTER_AUTH_SECRET` | **Yes** | — | Secret for Better Auth (min 32 chars) |
| `BETTER_AUTH_URL` | No | `http://localhost:3000` | Base URL for Better Auth |
| `LOG_LEVEL` | No | `info` | One of: trace, debug, info, warn, error, fatal |
| `LOG_PRETTY` | No | `false` | Pretty-print logs (dev) |

Example minimal `.env` for local development (adjust DB credentials to match your Postgres):

```bash
DATABASE_URL=postgres://mobility:secret@127.0.0.1:5432/mobility_transactions
BETTER_AUTH_SECRET=your-32-char-minimum-secret-here-change-in-production
```

Start Postgres (and wait until ready), then run migrations and the app:

```bash
# Start infra (Postgres)
task start

# Run DB migrations (Sequelize + Better Auth as needed)
pnpm run auth:migrate   # if using Better Auth migrations
# and/or sequelize-cli migrations as your project uses

# Compile and run (dev: watch)
pnpm run dev
```

For **observability** (Prometheus, Grafana, optional Jaeger/Loki), see [infra/obs/README.md](infra/obs/README.md). Use the Taskfile API (e.g. `task obs:start`, `task obs:check`, `task obs:smoke`) — do not wire observability into the root `docker-compose.yml`.


## Usage

### Development

```bash
# Install and start Postgres
task install
task start

# Run dev server (TypeScript watch + Node watch)
pnpm run dev
```

Server listens on `http://0.0.0.0:3000` by default. Health and docs:

- Health: `GET /api/v1/health`
- Metrics: `GET /metrics` (Prometheus)
- API docs: `GET /docs` (Swagger/Scalar if configured)

### Example: health check

```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

### Example: calling protected endpoints

All functional endpoints require authentication. Use your auth scheme (e.g. Bearer JWT or session) as required by the routes. Example with a placeholder token:

```bash
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:3000/api/v1/rides
```

Exact request/response shapes are defined per bounded context (rides, fares, payments, etc.) in the codebase and in OpenAPI/Swagger if generated.

### Taskfile (recommended)

- `task start` — Start Postgres and wait until ready  
- `task stop` / `task destroy` — Stop or tear down infra  
- `task dev` — Install deps and run `pnpm run dev`  
- `task lint` — Run `pnpm run lint` (Ultracite check)  
- `task test` — Run Vitest  
- `task qa` — Lint + test (CI-like gate)  
- `task obs:start [OBS_PROFILE=core|traces|logs|full]` — Start observability stack  
- `task obs:check` / `task obs:smoke` — Validate observability  
- `task obs:urls` — Print local URLs (Grafana, Prometheus, etc.)


## Running Tests

- **Unit / integration (Vitest):**  
  `pnpm test`  
  For watch: `pnpm test:watch`  
  Coverage: `pnpm test:coverage`

- **Single file:**  
  `pnpm vitest run path/to/file.test.ts`

- **Quality gate (before commit):**  
  `pnpm run lint && pnpm test`  
  (Lint runs Ultracite check; no separate `check` script.)

Integration tests may use Testcontainers for Postgres; ensure Docker is available.


## Contributing

- **One PR = one capability;** vertical slice only; no unrelated refactors.
- **Architecture:** Keep domain pure (no Fastify, Zod, Sequelize, Kysely, jose, pino in domain). Put orchestration in application and I/O in adapters. See [AGENTS.md](AGENTS.md) and [.cursor/rules/](.cursor/rules/) for strict rules.
- **Change process:** Identify invariants → implement in domain → orchestrate in application (ports) → implement in adapters → add tests at the appropriate layer.
- **Quality:** Run `pnpm run lint && pnpm test` before committing. Follow Ultracite and project rules; format with `pnpm run format` (or `pnpm dlx ultracite fix`).
- **PR title format:** `[bounded-context] intent` (e.g. `[payments] idempotent settlement by key`).

For detailed constraints (Sequelize+Kysely single pool, idempotency, error model, testing order), see [AGENTS.md](AGENTS.md). Rationales and ADRs live in `docs/adr` when present.


## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3)**. See [LICENSE](LICENSE) for the full text.


## Contact / Links

- **Repository:** [mobility-transactions-domain](https://github.com/sanurb/mobility-transactions-domain) (update URL if different)
- **Issues:** [GitHub Issues](https://github.com/sanurb/mobility-transactions-domain/issues)
- **Product and behavior:** [PRD.md](PRD.md)
- **Developer and AI instructions:** [AGENTS.md](AGENTS.md). AI skills live in `skills/`; run `./skills/setup.sh` to configure assistants (Claude, Codex, Gemini, Copilot).
- **Infra and observability:** [infra/obs/README.md](infra/obs/README.md), [infra/AGENTS.md](infra/AGENTS.md)


## Acknowledgments

- **Fastify** — HTTP server and plugin ecosystem  
- **Zod** — Schema validation and type inference  
- **better-result** — Railway-oriented error handling  
- **Sequelize & Kysely** — Pool, migrations, and typed SQL with a single connection source (kysely-sequelize)  
- **Vitest & Testcontainers** — Testing and integration DB  
- **Ultracite (Biome)** — Formatting and linting  
- **OpenTelemetry** — Metrics and tracing with collector-first topology  
- **PRD and hex/DDD guidelines** — For defining boundaries, invariants, and operational constraints
