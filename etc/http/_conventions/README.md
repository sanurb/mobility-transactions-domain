# REST Client Conventions

## Required Headers

Every request must include:
- `Authorization: Bearer {{token}}` (all endpoints require authentication)
- `request-id: {{$guid}}` (correlate logs and tracing)
- `Accept: {{json}}` (content negotiation)

Write operations must also include:
- `idempotency-key: {{$guid}}` (retry-safe operations)
- `Content-Type: {{json}}` (request body format)

## Error Contract

All errors return a consistent structure:

```json
{
  "errorType": "STATE_CONFLICT",
  "message": "Driver is in terminal state OFFLINE",
  "retryable": false,
  "requestId": "b1d2...",
  "details": {
    "driverId": "...",
    "currentState": "OFFLINE",
    "attemptedTransition": "BUSY"
  }
}
```

### Error Types
| Type | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `VALIDATION_ERROR` | 400 | No | Invalid input data |
| `MISSING_CORRELATION_ID` | 400 | No | Missing required header |
| `NOT_FOUND` | 404 | No | Resource doesn't exist |
| `STATE_CONFLICT` | 409 | No | Invalid state transition |
| `INTERNAL_ERROR` | 500 | Yes | Unexpected server error |

## Driver State Machine

```
OFFLINE ←→ AVAILABLE ←→ BUSY
   ↑________________________↓
```

Valid transitions:
- `OFFLINE → AVAILABLE` (go online)
- `AVAILABLE → BUSY` (assigned to ride)
- `AVAILABLE → OFFLINE` (go offline)
- `BUSY → AVAILABLE` (ride complete)
- `BUSY → OFFLINE` (special case)

Invalid transitions return `STATE_CONFLICT` with `currentState` and `attemptedTransition`.

## Naming Conventions

### Request Names
Format: `{capability}_{action}_{variant}`

Examples:
- `drivers_register_ok`
- `drivers_availability_stateConflict`
- `dispatch_ok`
- `dispatch_missingCorrelation`

### File Variables
- `@baseUrl` - Base server URL
- `@api` - Full API path with version
- `@json` - Content type shorthand
- `@token` - Bearer token from env

## Authorization Scopes

| Scope | Description |
|-------|-------------|
| `driver:read` | Read driver information |
| `driver:write` | Register drivers, update availability/location |
| `dispatch:execute` | Execute dispatch operations |
| `ride:read` | Read ride information |
| `ride:create` | Create new rides |

## Idempotency Rules

- Any endpoint that creates or initiates irreversible side effects accepts `idempotency-key`
- Server deduplicates based on (tenantId, aggregateId, idempotencyKey)
- Replays return the same canonical outcome without double execution
- Dispatch requires `Idempotency-Key` or `x-correlation-id` header
