# Infra Agent Rules

In the infra folder where local infrastructure and observability live

- Always follow existing patterns under infra obs
- Never invent new folder structures or naming patterns
- Never refactor outside the requested change

The infra folder is structured to optimize:

- Low drift
- Clear ownership
- Predictable extension
- Future migration to Kubernetes
- Minimal context required to modify safely

The structure is not aesthetic. It encodes boundaries.

infra obs is split by responsibility, not by tool.

Each directory has one purpose only.

infra obs compose  
Defines how services run locally.  
Contains only compose wiring.  
No business logic.  
No duplicated config logic.

infra obs otelcol configs  
Defines telemetry routing and pipelines.  
No compose logic here.  
Profiles are explicit.  
Core must remain minimal.

infra obs prometheus  
Defines scraping and rules.  
Prometheus never scrapes application directly.

infra obs grafana  
Defines provisioning only.  
No UI manual steps allowed.  
Dashboards are versioned artifacts.

infra obs loki  
Contains Loki config only.  
No retention logic duplicated elsewhere.

infra obs alertmanager  
Contains routing rules only.  
No alert rules inside compose files.

Reject any change that mixes responsibilities across these folders.


Files represent capabilities, not environments.

Correct examples:

obs base yml  
obs dev yml  
obs traces yml  
obs logs yml  
core yaml  
traces yaml  
logs yaml  
full yaml  

Incorrect examples:

common yml  
helpers yml  
extra yml  
config yml  
misc yml  

Names must describe behavior clearly and minimally.

## Non Negotiable Topology

- Always use collector first telemetry routing
- Always route telemetry as app to OTLP to otel collector to backends
- Never allow an application to export directly to Jaeger Loki or Prometheus
- Never allow Prometheus to scrape the application directly
- Always scrape only otel collector exporter at otel collector 8889

## Compose Rules

- Never modify root docker compose yml to add observability
- Always keep observability compose files under infra obs compose
- Always keep obs base yml free of host published ports
- Always publish ports only in obs dev yml
- Always bind published ports to localhost only using 127 dot 0 dot 0 dot 1
- Always include healthchecks for services with stable HTTP endpoints
- Always use deterministic startup ordering with depends on service healthy
- Never add more than five compose overlay files under infra obs compose

## Collector Config Rules

- Always keep collector configs split by profile under infra obs otelcol configs
- Always keep core profile quiet
- Never include Jaeger exporters in core
- Never include Loki exporters in core
- Always enable Jaeger exporters only in traces and full
- Always enable Loki exporters only in logs and full
- Never configure exporters that point to backends not enabled in the active profile

## Grafana Rules

- Always provision Grafana as code using infra obs grafana provisioning
- Never require manual UI steps for datasources or dashboards
- Always keep anonymous admin settings limited to dev overlay only
- Prefer datasource names that match service names exactly
- Prefer dashboards that reflect use case boundaries rather than infrastructure internals

## Prometheus Rules

- Always keep infra obs prometheus prometheus yml as the single source of truth
- Always keep exactly one scrape target in plan 01 and it must be otel collector 8889
- Never add alert rules or alertmanager wiring in plan 01
- Prefer explicit scrape intervals
- Prefer stable job names

## Tooling Rules

- Always keep telemetry generation as run on demand
- Never start telemetry generator by default in obs start
- Always validate signal without UI using obs smoke plus a metrics check
- Prefer automation over manual verification
- Prefer deterministic checks over visual inspection

When adding new services:

- Must live in its own overlay file
- Must have healthcheck
- Must integrate into obs check and obs smoke
- Must not increase overlay count beyond five without approval
- Must not require manual steps

When migrating to Kubernetes in future:

- Collector configs must remain portable
- Prometheus rules must remain tool agnostic
- Grafana dashboards must remain reusable
- Compose files must reflect logical service boundaries

Structure must anticipate scale but not over engineer.

## Opinionated Principles

This section exists to reduce drift and improve one shot success.

- Prefer boring technology over clever abstractions
- Prefer explicit wiring over magic defaults
- Prefer fewer moving parts over maximum feature coverage
- Prefer local reproducibility over theoretical production parity
- Prefer strict boundaries over flexible but unclear patterns
- Prefer deleting complexity over extending it
- Prefer stable naming over renaming for aesthetics
- Prefer measurable validation over assumed correctness
- Prefer isolation of responsibility over shared configuration
- Prefer short and readable configs over dense and compact ones
- Prefer incremental improvement over large refactors
- Prefer consistency with the existing repository over introducing new paradigms
- Never introduce a second way to wire services
- Never duplicate configuration across files
- Never introduce dynamic templating unless strictly required
- Never create a generic infra utils folder
- Never create shared config without clear ownership

If a new pattern is required, explain why in one sentence in the change summary.

Reject changes that introduce:
- Reject changes that optimize for cleverness over clarity.
- Indirection without benefit
- Configuration that cannot be validated automatically
- Multiple ways to achieve the same result
- Silent fallback behavior
- Hidden coupling between compose files
- Clever tricks that reduce readability

Collector profiles prevent silent exporter drift.

core must export metrics only.  
traces must add Jaeger exporter.  
logs must add Loki exporter.  
full must combine both.

Profiles reduce cognitive load.  
Profiles prevent broken exports.  
Profiles avoid runtime noise.

Reject any config where exporters exist without corresponding backend.

## Required Tasks And Gates

- Always keep Taskfile as the public API for developers for obs lifecycle
- Always preserve:
    obs start  
    obs stop  
    obs destroy  
    obs status  
    obs urls  
    obs logs  
    obs config  
    obs doctor  
    obs check  
    obs smoke  
Reject any change that breaks this contract.
- Never merge infra changes that break any required task

## Commands To Run

Run docker compose config for the relevant overlays.

Run:

task obs start OBS PROFILE core  
task obs check  
task obs smoke  

Repeat for traces logs and full if affected.

Reject change if any fail.

## Stop The Line Changes

Manual diff review required for

- any port exposure change
- any Grafana auth or credential change
- any collector exporter or pipeline change
- any retention configuration change
- any alertmanager routing change

## Output Format

When finishing infra work provide

FILES CHANGED  
One path per line

COMMANDS RUN  
One command per line with result

BEHAVIOR CHANGE  
What developers will observe

RISKS  
Potential failure modes

ROLLBACK  
Exact revert plan