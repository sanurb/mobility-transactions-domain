# SHARED LAYER

Cross-cutting DDD building blocks, branded types, and infrastructure adapters used by all bounded contexts.

## STRUCTURE

```
shared/
├── core/               # Result<T>, Guard, UseCase interface, AppError, constants
├── domain/             # AggregateRoot, Entity, ValueObject, DomainEvent base classes
│   ├── event/          # DomainEvent, EventBus interface, subscriber contracts
│   └── value-objects/  # Reusable VOs: FareAmount, IdempotencyKey, Location, Distance, etc.
├── types/
│   ├── branded.ts      # Branded type utility (compile-time ID safety)
│   └── ids/            # Per-context branded IDs: RideId, DriverId, FareId, PaymentIntentId...
├── application/        # Idempotency policy
├── errors/             # HTTP error mapper (Result → HTTP status)
└── infrastructure/
    ├── auth/           # Better Auth plugin, JWT middleware, session validation
    ├── database/       # Sequelize singleton, Kysely bridge, connection pooling
    ├── events/         # InProcessEventBus (singleton, type-specific + global handlers)
    ├── http/           # JSON:API helpers, base controller
    ├── logging/        # Pino config, PII redactor
    └── observability/  # OTel SDK init, metrics recording, HTTP instrumentation
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| New value object | `domain/value-objects/` | Extend `ValueObject<T>` base class |
| New branded ID | `types/ids/` | Use `Brand<string, 'TypeName'>` pattern |
| New domain event | `domain/event/` | Extend `DomainEvent` base |
| Error → HTTP mapping | `errors/http-error-mapper.ts` | Never expose internal details or PII |
| Database connection | `infrastructure/database/sequelize.ts` | Singleton. Never create second pool |
| Event publishing | `infrastructure/events/event-bus.ts` | `getEventBus()` returns singleton |
| Auth middleware | `infrastructure/auth/` | Public routes bypass auth via Better Auth endpoints |
| OTel setup | `infrastructure/observability/otel.ts` | Must init first in bootstrap sequence |

## CONVENTIONS

- **ValueObject**: Immutable, equality by value. Use `ValueObject.equals()` for comparison.
- **AggregateRoot**: Extends Entity. Manages domain events via `addDomainEvent()`.
- **Branded types**: Prevent mixing IDs across contexts at compile-time (e.g., `RideId` vs `DriverId`).
- **Result pattern**: `core/result.ts` is legacy. Prefer `better-result` library used in modules.
- **PII redaction**: `logging/pii-redactor.ts` strips sensitive fields from logs. Never log raw tokens/secrets.
- **HTTP error mapper**: Never includes cause, stack traces, or internal details. Safe metadata only.

## ANTI-PATTERNS

- Don't import infrastructure types in domain (no Sequelize, Pino, Fastify)
- Don't create standalone Kysely connections (use the Sequelize-bridged instance)
- Don't add to `core/constants/` unless it's truly cross-cutting (mime types, HTTP status/headers live here)
- Don't use `core/` classes for new module domain logic—each module owns its domain types
