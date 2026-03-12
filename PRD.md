# PRD — Ride Lifecycle, Fare, Payments (Provider-Agnostic) & ETA at Scale

**Currency:** COP (v1)
**Scope:** Backend API / “system of record” for rides, fares, payment intents, settlement outcomes, and ETA exposure.

## 1. Introduction

### 1.1 Purpose of the Document

This PRD specifies the **complete functional and non-functional requirements** for a mobility backend that supports: ride lifecycle, fare finalization, provider-agnostic payment orchestration, and ETA exposure at scale. It is written to be **unambiguous, testable, and auditable**, serving as the single product contract for stakeholders (Product, Engineering, QA, Security, Risk, Operations).

This document defines *what must happen*, *when*, and *how correctness is measured*, without prescribing architecture, algorithms, frameworks, or vendor-specific workflows.

### 1.2 Business Context (Sector Reality)

In ride-hailing, the platform’s credibility and revenue depend on:

* **State integrity** (rides cannot “teleport” between states; terminal states are final).
* **Pricing integrity** (fare must be deterministic, explainable, and immutable post-completion).
* **Payment integrity** (no duplicate capture, clear outcomes, safe retries).
* **Supportability** (operators must resolve disputes using evidence, not guesswork).
* **Scale behaviors** (ETA produces high-QPS read amplification; payments produce high-risk write flows).
* **Compliance** (PCI-DSS, OWASP, privacy regulation, security controls are non-optional).

### 1.3 Objectives and Success Metrics (OKRs)

**O1 — Revenue Integrity & Customer Trust**

* Duplicate successful settlements caused by the platform: **0** (per quarter).
* Completed rides with a recorded canonical settlement outcome: **100%**.
* Payment-related support tickets per 1,000 rides: **decreasing trend**, target baseline established in pilot.

**O2 — Deterministic Ride/Fare Correctness**

* Illegal ride state transitions accepted: **0**.
* Fare mismatch between stored fare and charged amount: **0**.

**O3 — ETA at Scale Without Harming Core Flows**

* ETA freshness contract met or explicitly degraded: **≥ 99.9%**.
* Critical write SLOs remain compliant during peak ETA traffic.

### 1.4 Tenancy and Isolation Model (Explicit)

This system is **not a multi-tenant SaaS platform**.

* There is **no global tenant identifier**.
* Isolation is enforced through **explicit domain concepts**:
  * **Resource ownership** (e.g., rides owned by a rider)
  * **Role-based scope** (client app vs ops)
  * **Geographic scope** (market/city) where applicable

Any requirement phrased as “tenant isolation” MUST be implemented as **ownership/scope checks** defined in this PRD, not via a global `tenantId`.

## 2. Scope

### 2.1 In Scope

* Ride state machine (authoritative) and lifecycle operations.
* Fare computation contract (inputs, outputs, determinism, audit).
* Provider-agnostic Payment Intent creation and Settlement tracking.
* Provider-agnostic error normalization and retry semantics.
* ETA exposure in **four product contexts**: Eyeball, Dispatch, Pickup, On-Trip.
* Audit trails, compliance controls, and operational reporting requirements.

### 2.2 Out of Scope (v1)

* Refunds/chargebacks/dispute workflows (explicitly deferred, but data must support future).
* Driver supply/matching strategies.
* Map/routing algorithm choices and ownership.
* Promotions/dynamic pricing.

### 2.3 Users (Personas)

**End-user perspective**

* Rider: cares about correct ETA, transparent fare, correct charge, and receipt.

**Platform perspective**

* Client App: calls the API reliably under mobile network failures and retries.
* Support/Operations: needs evidence to resolve “I was charged twice” or “fare was wrong”.
* Risk/Fraud: needs signals and controls to reduce abuse and chargebacks.
* Finance/Reconciliation: needs ledger-like data correctness and settlement traceability.
* Security/Compliance: ensures PCI/OWASP/privacy controls are met.

### 2.4 Primary Benefits

* Prevent double charges and missing charges (core business survival).
* Maintain consistent ride progress and fare explainability.
* Enable payment provider swap without contract changes.
* Provide ETA at scale with honesty and controlled degradation.

### 2.5 Scope and Ownership (Authorization Model Inputs)

The following scope concepts are part of the product contract and MUST be enforceable:

* **Rider ownership:** A rider may only read/write rides they own.
* **Ride linkage:** Payment intents and settlement outcomes are scoped to a ride and inherit the ride’s ownership rules.
* **Operational scope:** OPS roles may access evidence/audit within defined policy scope (see §6.2), without write capabilities.
* **Geographic scope (where applicable):** Requests may be restricted to a market/city boundary, if the deployment requires it.

No global tenant isolation semantics exist.

## 3. System Overview

### 3.1 System Function (Big Picture)

The system is the **system of record** for:

* Ride state transitions
* Fare finalization
* Payment intent creation and settlement outcomes
* ETA exposure status (including degradation metadata)

### 3.2 Operating Environment

* Multi-client consumption (mobile/web/server), unreliable networks, retries.
* Peak loads, burst traffic, and partial dependency failures.
* Separation of environments with strict data/secret isolation.
* Authorization must be correct under retries and concurrent requests (no “best effort” access checks).

### 3.3 Architecture General (Non-prescriptive)

The product requires strict separation between:

* Domain contract (rides, fare, payment intent, settlement)
  and
* External dependencies (payment providers, ETA signal providers),
  so that vendor changes do not alter the public product semantics.

## 4. Functional Requirements

### 4.1 Ride Management (Authoritative State Machine)

#### 4.1.1 Ride States

`CREATED`, `DISPATCHING`, `ASSIGNED`, `STARTED`, `COMPLETED`, `CANCELED`, `EXPIRED`, `FAILED`

**Terminal:** `COMPLETED`, `CANCELED`, `EXPIRED`, `FAILED` (immutable)

#### 4.1.2 Allowed Transitions (Exhaustive)

* Normal: `CREATED → DISPATCHING → ASSIGNED → STARTED → COMPLETED`
* Cancel: `CREATED|DISPATCHING|ASSIGNED → CANCELED`
* Expire: `CREATED|DISPATCHING|ASSIGNED → EXPIRED`
* Fail: `CREATED|DISPATCHING|ASSIGNED|STARTED → FAILED`

All other transitions MUST be rejected as `STATE_CONFLICT`.

#### 4.1.3 Cancellation and Expiration Rules (Real-world)

* Rider cancellation allowed only before `STARTED`.
* System cancellation allowed in any non-terminal state with mandatory reason codes.
* Expiration MUST be policy-driven with explicit timers (v1 defaults are permitted and must be documented).
  **Business Default v1:**

  * `DISPATCHING` expires after **120s** without assignment.
  * `ASSIGNED` expires after **300s** without `STARTED`.

#### 4.1.4 Concurrency and Retries (Behavioral Contract)

When conflicting terminal transitions are requested concurrently (cancel/complete/fail):

* Exactly one terminal transition may succeed.
* The losing request MUST receive a deterministic conflict response containing the current authoritative state.

### 4.2 Fare (COP) — Deterministic and Explainable

#### 4.2.1 Inputs (Required)

* `baseFareCOP` (integer pesos ≥ 0)
* `distanceKm` (decimal ≥ 0)
* `durationMinutes` (decimal ≥ 0)

#### 4.2.2 Outputs (Required)

* `totalFareCOP` (integer pesos)
* `fareBreakdown` (base, distance, time, minimumApplied)

#### 4.2.3 Determinism Rules

* Currency is COP (integer pesos). No fractional pesos in external contract.
* Rounding is deterministic: **round up** to the nearest peso.
* Minimum fare applies: `totalFareCOP ≥ minimumFareCOP`.
  **Business Default v1:** `minimumFareCOP = 5,000`.

#### 4.2.4 Auditability Rules (Support + Finance)

The system MUST store enough evidence to reproduce the fare output:

* inputs used (base, distance, duration, applied minimum)
* calculation timestamp (UTC)
* pricing version identifier (not an implementation detail; a functional contract for change control)

### 4.3 Payments — Provider-Agnostic Payment Intent + Settlement

This is where industry “implicit rules” matter most.

#### 4.3.1 Canonical Concepts

* **Payment Intent**: immutable business record describing *what must be collected* for a completed ride.
* **Settlement Attempt**: an action to collect funds against a Payment Intent.
* **Settlement Outcome**: canonical state representing the authoritative result.

The public product contract MUST NOT expose provider-specific terms (e.g., “acceptance token”, “link”, “capture”), but the domain must still represent them through **canonical semantics**.

#### 4.3.2 Payment Intent Rules (Non-negotiable)

* A Payment Intent MUST be created exactly once when the ride becomes `COMPLETED`.
* Payment Intent MUST bind to: `rideId`, `riderId`, `amountCOP`, `currency=COP`, `fareBreakdown`, `createdAtUTC`.
* Payment Intent amount and currency MUST be immutable once created.

#### 4.3.3 Canonical Settlement Outcomes (Authoritative)

* `PENDING` (non-terminal)
* `SUCCEEDED` (terminal)
* `DECLINED` (terminal; requires rider action for further attempts)
* `FAILED` (terminal; retry may be allowed)
* `UNKNOWN` (terminal v1; outcome cannot be determined within bounded time)

#### 4.3.4 Anti-Duplication and Financial Integrity

* A ride MUST NOT have more than one `SUCCEEDED` settlement outcome, ever.
* A repeated settlement initiation request MUST NOT produce multiple successful charges (must be prevented under retries and timeouts).
* Settlement must be idempotent with respect to Payment Intent and client idempotency key.

#### 4.3.5 Multiple Attempts Policy (Industry reality)

Declines happen; networks fail; tokens expire. The product must formalize attempt policy:

**Business Default v1:**

* Max settlement attempts per ride: **3**.
* New attempt allowed only when last state is `FAILED` or `UNKNOWN`.
* `DECLINED` requires rider action (e.g., change payment method) before a new attempt is permitted.
* Attempts beyond limit must be blocked with a deterministic `PAYMENT_POLICY_VIOLATION`.

#### 4.3.6 Unpaid Definition (Formal)

A ride is **UNPAID** iff:

* ride state is `COMPLETED`, and
* the latest settlement state is not `SUCCEEDED`.

UNPAID is derived; it is not a ride state.

#### 4.3.7 Receipts and User Evidence (End-user lens)

Upon settlement completion (success or definitive failure), the system MUST provide:

* a user-facing receipt payload (safe fields only)
* a support-facing evidence payload (includes normalized reason codes, timestamps, attempt count)

### 4.4 ETA Exposure (Four Contexts, Read Amplification, Honest Degradation)

#### 4.4.1 ETA Contexts (Authoritative)

* `EYEBALL` (destination preview)
* `DISPATCH` (driver assignment optimization)
* `PICKUP` (time to pickup)
* `ON_TRIP` (live arrival updates)

#### 4.4.2 ETA Contract (Required Fields)

Every ETA response MUST include:

* `etaContext`
* `computedAtUTC`
* either `etaSeconds` (integer ≥ 0) OR explicit absence
* `isDegraded` boolean
* `degradationReason` when degraded
* `freshnessSeconds` (computedAtUTC to now, in seconds)

#### 4.4.3 Freshness Policy (Explicit, Non-ambiguous)

**Business Default v1:**

* ON_TRIP and PICKUP: max age **10s**
* DISPATCH and EYEBALL: max age **30s**
  If older, response MUST be degraded with `STALE_INPUT_DATA` OR no ETA with degradation.

#### 4.4.4 Degradation Reasons (Authoritative Set)

* `INSUFFICIENT_LOCATION_SIGNAL` (GPS noise/sparsity)
* `STALE_INPUT_DATA`
* `DEPENDENCY_UNAVAILABLE`
* `RATE_LIMITED`
* `UNKNOWN`

#### 4.4.5 Scale and “Do Not Harm” Rule

ETA requests MUST be treated as “high-QPS reads” and MUST NOT degrade:

* ride completion
* payment intent creation
* settlement initiation

Even under peak ETA traffic. If necessary, ETA may degrade (explicitly), but core writes must remain within SLO.

## 5. Non-Functional Requirements

### 5.1 Performance (SLOs)

**Critical writes:**

* Complete ride (fare finalization + payment intent): p95 ≤ 300ms, p99 ≤ 800ms
* Initiate settlement: p95 ≤ 500ms, p99 ≤ 1200ms

**Reads:**

* ETA: p95 ≤ 150ms, p99 ≤ 400ms
* Ride status: p95 ≤ 150ms, p99 ≤ 400ms
* Settlement status: p95 ≤ 200ms, p99 ≤ 500ms

### 5.2 Scalability (Explicit Load Model)

The system MUST support (single region baseline):

* 100,000 concurrent active rides
* up to 1,000 ETA reads per ride (expected worst-case)
* peak 50,000 ETA RPS while preserving critical write SLOs

### 5.3 Usability and Accessibility

API usability requirements:

* Deterministic errors with `errorType`, `retryable`, `requestId`, optional `retryAfterSeconds`.
* Backward-compatible evolution: versioned contract changes, documented deprecations.

### 5.4 Maintainability (Product-level)

* Swapping payment providers MUST NOT require public contract changes.
* Canonical states and invariants must remain stable across versions.
* Change control for pricing rules (pricing version) must be auditable.

## 6. Security Requirements

### 6.1 Compliance (Mandatory)

The system MUST comply with:

* **PCI-DSS** (scope minimized by never handling raw cardholder data; tokenized references only)
* **OWASP Top 10** and **OWASP API Security Top 10** (input validation, auth, access control, rate limiting, logging, SSRF protections, etc.)
* Applicable privacy regulations (GDPR-like principles; and if operating in Colombia, align with local data protection requirements)

### 6.2 Authentication and Authorization

* All endpoints require authentication.
* Authorization MUST enforce **resource ownership and role-based scope** (not tenancy).
  * Rider access MUST be limited to rides they own.
  * Client App access MUST be limited to authorized capabilities for that app.
  * OPS_READONLY MUST be read-only and limited to evidence/audit access.
  * Where applicable, market/city scope MUST be enforced explicitly.
* The system MUST NOT implement a global tenant-based authorization model.

**Roles (v1):**

* CLIENT_APP (write + read within scope)
* OPS_READONLY (read evidence and audit within scope)

### 6.3 Data Protection

* Encryption in transit required.
* Secrets must never be exposed in logs.
* Payment tokens and PII must be redacted in logs and responses.
* Data retention policies must be defined and enforced (see below).

### 6.4 Data Retention (Business Default v1)

* Ride + fare + settlement audit: retain **5 years** (financial/audit typical).
* PII (email, optional identifiers): retain **as short as legally/operationally necessary**, default **180 days** unless policy requires longer.

## 7. Use Cases (Selected Core)

### UC-01 Create Ride

Actor: Client App  
Preconditions: authenticated rider; request within permitted scope  
Description: create ride request  
Inputs: riderId, origin, destination  
Outputs: rideId, rideState, timestamps

### UC-02 Complete Ride

Actor: Client App  
Preconditions: STARTED; valid metrics  
Description: finalize fare and create payment intent  
Outputs: COMPLETED, fare, paymentIntentId

### UC-03 Initiate Settlement

Actor: Client App  
Preconditions: COMPLETED; payment intent exists; token reference  
Description: initiate settlement attempt; record canonical outcome  
Outputs: settlementState, attemptCount, retryable

### UC-04 Query ETA (On-trip)

Actor: Client App  
Preconditions: STARTED  
Description: retrieve ETA with freshness + degradation rules  
Outputs: etaSeconds or absent, freshnessSeconds, isDegraded, reason

## 8. Diagrams (MermaidJS)

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> DISPATCHING
  DISPATCHING --> ASSIGNED
  ASSIGNED --> STARTED
  STARTED --> COMPLETED

  CREATED --> CANCELED
  DISPATCHING --> CANCELED
  ASSIGNED --> CANCELED

  CREATED --> EXPIRED
  DISPATCHING --> EXPIRED
  ASSIGNED --> EXPIRED

  CREATED --> FAILED
  DISPATCHING --> FAILED
  ASSIGNED --> FAILED
  STARTED --> FAILED

  COMPLETED --> [*]
  CANCELED --> [*]
  EXPIRED --> [*]
  FAILED --> [*]
````

## 9. Integrations and Dependencies

### Internal

* Ride lifecycle service (state machine)
* Fare finalization service
* Payment intent + settlement state service
* Audit/evidence service
* Error normalization contract

### External (Provider-agnostic)

* Payment provider(s) (interchangeable)
* Optional location/ETA signal sources

## 10. Constraints and Assumptions

**Constraints**

* COP only (v1)
* No raw cardholder data accepted or stored
* One successful settlement per ride
* The system is **not multi-tenant**; no global tenant identifier exists. Isolation is enforced via ownership/role/geographic scope defined in this PRD.

**Assumptions**

* Client supplies distance and duration at completion (or a trusted upstream source exists).
* Payment provider may be asynchronous; outcome may be pending or unknown.

## 11. Acceptance Metrics (KPIs)

* Duplicate successful settlement rate: 0
* Missing payment intent for completed rides: 0
* SLO compliance (critical vs read): ≥ 99.9%
* ETA freshness compliance: ≥ 99.9% (or explicit degradation)
* Audit completeness: 100%

## 12. Impact Analysis

* ETA read amplification is the dominant load driver; product must require explicit degradation and non-blocking behavior.
* Payments require strong evidence capture; finance/support workflows depend on canonical outcomes.

## 13. Risk Management Plan

* Retry storms: enforce idempotency and attempt limits.
* Provider outages: canonical UNKNOWN with evidence and support visibility.
* Fraud/abuse: policy gates and evidence signals (without prescribing detection mechanisms).
* Compliance drift: periodic audits and policy enforcement requirements.

## 14. Future Considerations

* Refunds/chargebacks/disputes (must reuse evidence model)
* Multiple payment intents per ride (beyond v1 limits)
* Multi-currency, tax/fees
* ETA quality analytics and continuous calibration governance

## 15. Glossary

* Payment Intent
* Settlement Outcome
* Derived UNPAID
* ETA Freshness
* Degradation
* Scope: Authorization boundary defined by ownership, role, and/or geographic constraints (not tenancy).
* Tenant: SaaS isolation construct intentionally not used in this system.
