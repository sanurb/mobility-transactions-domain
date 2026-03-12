# BOUNDED CONTEXTS

Six modules following identical hexagonal architecture. Each is a vertical slice owning domain → application → adapters.

## MODULE MAP

| Module | Purpose | Status | Key Complexity |
|--------|---------|--------|----------------|
| **rides** | Ride lifecycle (create → assign → pickup → complete) | Migrating (stubs) | State machine, 7 transitions |
| **drivers** | Driver availability, geospatial location tracking | Active | Haversine geo-index, dispatch policy |
| **dispatch** | Ride-driver assignment orchestration | Active | Process manager, reservation attempts |
| **fares** | Fare calculation on ride completion | Active | Component-based pricing (base + distance + duration) |
| **payments** | Payment intents, settlement, provider integration | Active | Idempotency, outbox pattern, settlement retries |
| **health** | Healthcheck endpoint | Stable | Minimal (no index.ts) |

## HEXAGONAL TEMPLATE (ALL MODULES)

```
<module>/
├── domain/
│   ├── <aggregate>.aggregate.ts    # Business invariants
│   ├── <policies>.ts               # Domain rules (as const states, policies)
│   ├── events.ts                   # Domain events emitted by aggregate
│   └── value-objects/              # Module-specific VOs
├── application/
│   ├── use-cases/                  # One class per use case (IUseCase interface)
│   ├── ports/                      # Interfaces for I/O (repository, clock, provider)
│   └── events/                     # Integration event definitions
├── adapters/
│   ├── inbound/                    # JSON:API routes + Zod schemas (NEW)
│   └── outbound/                   # Repository impl, clock impl, provider impl
├── infrastructure/
│   ├── *.model.ts                  # Sequelize model definitions
│   ├── *.repository.ts             # Repository implementation
│   └── migrations/                 # Additive-only DB migrations
├── presentation/                   # DEPRECATED (legacy routes, throw on use)
├── event-handlers/                 # Cross-context event subscribers
├── tests/
│   ├── domain/                     # Pure unit tests (no I/O)
│   ├── application/                # Use case tests with faked ports
│   ├── adapters/                   # JSON:API contract tests, repository integration
│   └── helpers/
│       ├── faked-ports.ts          # In-memory port implementations
│       └── *-test-factories.ts     # Typed builder functions (Partial<T> overrides)
└── <module>.integration.test.ts    # Full lifecycle (HTTP → DB → events)
```

## CROSS-MODULE EVENT FLOW

```
Ride completed → RIDE_STATE_CHANGED event
  → Fares module subscribes → calculates fare → FARE_CALCULATED event
    → Payments module subscribes → creates PaymentIntent → settlement
```

Events flow through `InProcessEventBus`. Handlers must not re-throw (prevents event bus crash).

## MODULE INIT ORDER (in app.ts)

1. **EventBus** (shared singleton)
2. **Rides** → provides `rideAssignmentPort`
3. **Drivers** (independent)
4. **Dispatch** ← depends on `rideAssignmentPort` from rides
5. **Fares** (independent, subscribes to ride events)
6. **Payments** ← receives `getRiderId` lookup function

## TESTING CONVENTIONS

- **Unit tests**: Parallel, 5s timeout. Pure domain logic, faked ports. `vitest.config.unit.ts`
- **Integration tests**: Sequential, 30s timeout. Real PostgreSQL via Testcontainers. `vitest.config.ts`
- **Contract tests**: `*.jsonapi-contract.test.ts` verify HTTP + validation + auth stack
- **Factories**: Builder pattern with sensible defaults (Bogota coordinates, COP currency)
- **Faked ports**: Implement real port interfaces. `FakePaymentRepository` creates independent snapshots to catch mutation leaks.
- **Architecture tests**: `src/tests/architecture/` enforces no deprecated RideService usage, layer constraints

## ANTI-PATTERNS

- Don't create horizontal folders (`/services`, `/controllers`) inside modules
- Don't import between modules directly—use events or ports
- Don't add new code to `presentation/` folders (deprecated, use `adapters/inbound/`)
- Don't mix Sequelize + Kysely writes without a transaction port
- Don't add `console.log` in production paths (existing ones in fares are tech debt)
- Don't use `as any`/`as never` in new production code

## NOTES

- Rides module returns dummy implementations on `dev` branch (migration in progress)
- Dispatch uses in-memory stores (audit writer + process store) pending Phase 4 persistence
- Payments maintains legacy `PaymentService` alongside new use cases for event handler compatibility
- Migrations are additive-only: never drop or rename existing structures
