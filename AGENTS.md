# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-17 | **Commit:** 2bd33f3 | **Branch:** dev

## OVERVIEW

Mobility backend (rides, drivers, dispatch, fares, payments) using DDD + hexagonal architecture on Fastify v5, PostgreSQL, TypeScript strict mode.

## STRUCTURE

```
src/
├── main.ts              # Entry: loads .env, starts server
├── server.ts            # Fastify listen + graceful shutdown
├── bootstrap/           # Init order: OTel → app → DB
├── app.ts               # Plugin registration, module wiring, error handler
├── config/              # Zod-validated env (fail-fast startup)
├── modules/             # Bounded contexts (vertical slices)
│   ├── rides/           # Ride lifecycle (DEPRECATED stubs, migrating)
│   ├── drivers/         # Driver availability + geospatial
│   ├── dispatch/        # Ride-driver assignment (in-memory stores)
│   ├── fares/           # Fare calculation on ride completion
│   ├── payments/        # Payment intents + settlement
│   └── health/          # Healthcheck (no index.ts entry)
├── shared/              # Cross-cutting: DDD base, branded types, infra
└── test/                # Shared test infra (Testcontainers, auth, factories)
infra/
├── app/                 # Docker Compose for PostgreSQL
└── obs/                 # Observability stack (OTel Collector → backends)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add bounded context | `src/modules/<name>/` | Copy hexagonal structure from drivers |
| Add domain type | `src/shared/domain/` or `src/shared/types/ids/` | Branded IDs in `ids/`, VOs in `domain/value-objects/` |
| Add use case | `src/modules/<ctx>/application/use-cases/` | Implement `IUseCase`, inject ports |
| Wire module | `src/app.ts:246-279` | Manual DI, order matters (rides before dispatch) |
| Add HTTP route | `src/modules/<ctx>/adapters/inbound/` | JSON:API format, Zod schemas |
| Add DB model | `src/modules/<ctx>/infrastructure/` | Sequelize model + Kysely types |
| Add event handler | `src/modules/<ctx>/event-handlers/` | Subscribe in module `init*()` |
| Debug failing test | `vitest.config.unit.ts` vs `vitest.config.ts` | Unit: parallel 5s, Integration: sequential 30s |
| Architecture rules | `src/tests/architecture/` | ArchUnit tests enforce layer constraints |
| Observability | `src/shared/infrastructure/observability/` | OTel SDK init, must be first in bootstrap |

## CONVENTIONS

- **Error model**: `Result<Ok, Err>` via better-result. `throw` only for unexpected failures.
- **Determinism**: Time, IDs, randomness injected via ports. Never `Date.now()` or `Math.random()` in domain/application.
- **Single pool**: Sequelize owns the connection pool. Kysely uses it via kysely-sequelize bridge. Never create a second pool.
- **No enums**: Use `as const` + discriminated unions.
- **Module init**: Explicit in `app.ts` with dependency injection. Rides must init before dispatch (provides `RideAssignmentPort`).
- **Event bus**: In-process, synchronous. Event handlers must not re-throw (crash prevention).
- **JSON:API**: New routes use JSON:API adapter pattern. Legacy `presentation/` routes are deprecated.

## ANTI-PATTERNS (THIS PROJECT)

- **No horizontal folders**: `/controllers`, `/services`, `/helpers`, `/utils` are forbidden
- **No framework types in domain**: No Fastify, Zod, Sequelize, Kysely, Jose, Pino imports
- **No cross-aggregate transactions**: Each aggregate is its own consistency boundary
- **No unbounded queries**: Pagination always explicit
- **No raw SQL**: Use Kysely. If Kysely can't express it, add tests around the raw query
- **No `as any`/`as never` in production**: Test files have some (tech debt), don't add more
- **No second DB pool**: Critical. See Sequelize+Kysely single pool rule in detail below

## ACTIVE MIGRATION (dev branch)

80+ files moving from `src/{module}/` to `src/modules/{module}/`. Old paths still on disk as deleted-in-git stubs. The rides module returns dummy implementations. Do not build on legacy paths.

## DEPENDENCY DIRECTION

```
Domain ← Application ← Adapters
(pure)   (orchestration) (I/O, frameworks)
```

Domain imports nothing external. Application imports domain + port interfaces. Adapters implement ports.

## COMMANDS

```bash
task dev          # Watch mode (tsc + node)
task qa           # Lint + test (CI gate)
task start        # Start PostgreSQL container
task obs:start    # Observability stack (OBS_PROFILE=core|traces|logs|full)
pnpm vitest run path/to/file.test.ts  # Single test
pnpm run format   # Ultracite fix
pnpm run lint     # Ultracite check
```

## AI SKILLS AND INSTRUCTIONS

- **Source of truth:** This file (`AGENTS.md`) and the **`skills/`** directory at repo root.
- **Setup:** Run `./skills/setup.sh` (or `./skills/setup.sh --all`) to configure AI assistants. It creates symlinks (e.g. `.claude/skills` → `skills/`, `.codex/skills` → `skills/`) and copies AGENTS.md to CLAUDE.md, GEMINI.md, `.github/copilot-instructions.md` where needed.
- **Generated files (do not commit):** CLAUDE.md, GEMINI.md, `.github/copilot-instructions.md` are gitignored; edit AGENTS.md and re-run the script to refresh.

## NOTES

- Health module lacks `index.ts` entry point (imported directly in app.ts)
- Dispatch uses in-memory stores (TODO: persistent implementation)
- Payments has dual implementation: new use cases + legacy PaymentService for event handlers
- `getRiderId` in app.ts is a placeholder returning rideId (TODO: proper lookup)
- Auth: Better Auth + Jose JWT. Role set server-side only, never from signup input
