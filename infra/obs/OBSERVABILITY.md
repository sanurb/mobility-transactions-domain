Observability Architecture
==========================

Purpose
-------

Define a deterministic local observability stack.

Guarantees:

- Applications export telemetry only via OTLP.
- Collector is the single ingestion point.
- Prometheus scrapes only the Collector.
- Logs are shipped through Fluent Bit to Loki.
- Dashboards reflect real service behavior.
- Startup and validation are reproducible.

Scope
-----

Local development environment.

Not covered:

- Production high availability
- Multi-region replication
- Long-term storage
- Access control hardening


System Topology
---------------

Application exports:

- Traces via OTLP
- Metrics via OTLP
- Logs via Docker JSON log driver

Collector responsibilities:

- Receive OTLP
- Process telemetry
- Export metrics to Prometheus
- Optionally export traces to Tempo
- Optionally receive logs

Prometheus responsibilities:

- Scrape Collector metrics endpoint
- Store time series
- Evaluate rules
- Remote-write metrics to Mimir

Mimir responsibilities:

- Store long-lived metrics blocks
- Serve Prometheus-compatible query API to Grafana

Grafana responsibilities:

- Query Prometheus
- Query Loki
- Render dashboards

Loki responsibilities:

- Store structured logs

Fluent Bit responsibilities:

- Tail container logs
- Parse JSON
- Enrich labels
- Push to Loki


Repository Layout
-----------------

All observability assets live under:

infra/obs/

Compose overlays:

infra/obs/compose/obs.base.yml
infra/obs/compose/obs.dev.yml
infra/obs/compose/obs.logs.yml
infra/obs/compose/obs.traces.yml
infra/obs/compose/obs.tools.yml

Collector configs:

infra/obs/otelcol/configs/core.yaml
infra/obs/otelcol/configs/logs.yaml
infra/obs/otelcol/configs/traces.yaml

Prometheus:

infra/obs/prometheus/prometheus.yml
infra/obs/prometheus/rules/

Mimir:

infra/obs/mimir/config.yml

Grafana:

infra/obs/grafana/provisioning/
infra/obs/grafana/dashboards/

Loki:

infra/obs/loki/config.yml

Fluent Bit:

infra/obs/fluent-bit/fluent-bit.conf
infra/obs/fluent-bit/parsers.conf


Execution Model
---------------

Always use the full compose chain.

Core stack:

docker compose \
  -f docker-compose.yml \
  -f infra/obs/compose/obs.base.yml \
  -f infra/obs/compose/obs.dev.yml \
  up -d --force-recreate

Core plus logs:

docker compose \
  -f docker-compose.yml \
  -f infra/obs/compose/obs.base.yml \
  -f infra/obs/compose/obs.dev.yml \
  -f infra/obs/compose/obs.logs.yml \
  up -d --force-recreate

Stop stack:

docker compose \
  -f docker-compose.yml \
  -f infra/obs/compose/obs.base.yml \
  -f infra/obs/compose/obs.dev.yml \
  down

Destroy volumes:

docker compose \
  -f docker-compose.yml \
  -f infra/obs/compose/obs.base.yml \
  -f infra/obs/compose/obs.dev.yml \
  down -v


Service Endpoints
-----------------

Grafana
http://127.0.0.1:3001

Prometheus
http://127.0.0.1:9090

Mimir
http://127.0.0.1:9009

Tempo
http://127.0.0.1:3200

Loki
http://127.0.0.1:3100

Collector health
http://127.0.0.1:13133

Collector debug
http://127.0.0.1:55679/debug/tracez


Health Validation
-----------------

Collector:

curl -sf http://127.0.0.1:13133/ && echo collector ok

Prometheus:

curl -sf http://127.0.0.1:9090/-/ready && echo prom ok

Grafana:

curl -sf http://127.0.0.1:3001/api/health && echo grafana ok


Metric Flow Validation
----------------------

Goal:

Prometheus must expose application metrics.

Step 1: Verify target

Open:

http://127.0.0.1:9090/targets

Job otel-collector must be UP.

Step 2: Verify Collector exporter

docker exec -it obs-prometheus sh -lc 'wget -qO- http://otel-collector:8889/metrics | head'

If empty:

- App is not exporting OTLP metrics
- Collector pipeline is misconfigured
- Wrong collector config file is active

Step 3: Verify metrics in Prometheus

Open:

http://127.0.0.1:9090/api/v1/label/__name__/values

Expected:

Application metrics present.

If only go_ and prometheus_ metrics exist:

App metrics are not reaching the Collector.


Required Application Configuration
----------------------------------

Application must:

- Use OTLPTraceExporter
- Use OTLPMetricExporter
- Not use PrometheusExporter
- Export to http://otel-collector:4318 when dockerized
- Export to http://127.0.0.1:4318 when running on host

Environment variables:

OTEL_SERVICE_NAME
OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_TRACES_SAMPLER_ARG


Logs Flow Validation
--------------------

Fluent Bit must be running:

docker logs obs-fluent-bit --tail 50

Inject test log:

echo '{"level":"error","msg":"PIPELINE_TEST","status":500}' >> /var/lib/docker/containers/<container-id>/<container-id>-json.log

Query Loki:

curl -sG "http://127.0.0.1:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service="mobility-transactions"} |= "PIPELINE_TEST"' \
  --data-urlencode "start=$(date -u +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000"

If Loki returns result but dashboards show no errors:

Metrics pipeline is not emitting error counters.


Dashboard Expectations
----------------------

Dependency Health and RPS dashboards require:

- HTTP request count metric
- HTTP duration histogram
- Error status labels

If empty:

- Metrics not emitted
- Metric names mismatch
- Wrong Prometheus datasource
- Time range too narrow


Common Failure Modes
--------------------

No data in Grafana:

Cause:
App metrics not reaching Collector.

Fix:
Verify OTLP endpoint and Collector pipeline.

Collector metrics endpoint empty:

Cause:
Metrics pipeline missing prometheus exporter.

Fix:
Check infra/obs/otelcol/configs/core.yaml.

Fluent Bit parser errors:

Cause:
Missing parsers.conf reference.

Fix:
Ensure Parsers_File directive exists in fluent-bit.conf.

Shell error unknown command -f:

Cause:
Flags pasted without docker compose prefix.

Fix:
Run full docker compose command.


Operational Rules
-----------------

Applications must not export directly to Prometheus.

Collector is mandatory ingestion layer.

Every service must define OTEL_SERVICE_NAME.

Ports must bind to 127.0.0.1 in local environment.

All services must define healthcheck.


Scaling Guidance
----------------

For multiple services:

- Each service exports OTLP to Collector
- Service name must be unique
- Environment label must be consistent

For containerized backend:

- Do not export to localhost
- Use service DNS name otel-collector

For Kubernetes migration:

- Replace compose with Deployment and Service
- Keep Collector topology identical
- Preserve OTLP contract
