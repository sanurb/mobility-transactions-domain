# Local Observability (Collector-first)

## Contract
Topology is non-negotiable:
app -> OTLP (4317/4318) -> OTel Collector -> backends
Prometheus scrapes ONLY the Collector exporter (otel-collector:8889).

This stack is "as code" and invoked via Taskfile. Do not run docker compose manually.

## Compose modules
- infra/obs/compose/obs.base.yml       : collector + prometheus + mimir + grafana
- infra/obs/compose/obs.dev.yml        : localhost ports + dev-only grafana settings
- infra/obs/compose/obs.traces.yml     : tempo (optional)
- infra/obs/compose/obs.logs.yml       : loki + fluent bit (optional)
- infra/obs/compose/obs.tools.yml      : telemetry generator (run-on-demand)

## Log Pipeline
App (Pino JSON to stdout) -> Docker fluentd log driver -> Fluent Bit (forward input :24224) -> Loki
To use: configure your app container with the fluentd Docker log driver pointing to localhost:24224.

## Profiles
- core   : base + dev
- traces : core + traces
- logs   : core + logs
- full   : core + traces + logs

Collector config is selected by COLLECTOR_CONFIG:
- core.yaml | traces.yaml | logs.yaml | full.yaml

## URLs (dev mode)
- Collector health:  http://127.0.0.1:13133
- Prometheus:        http://127.0.0.1:9090
- Mimir:             http://127.0.0.1:9009
- Grafana:           http://127.0.0.1:3001
- Tempo API:         http://127.0.0.1:3200    (traces/full)
- Loki:              http://127.0.0.1:3100    (logs/full)
- OTLP gRPC:         127.0.0.1:4317
- OTLP HTTP:         http://127.0.0.1:4318

## Usage (Taskfile)
Expected tasks:
- task obs:start [OBS_PROFILE=core|traces|logs|full]
- task obs:check
- task obs:smoke
- task obs:urls
- task obs:logs
- task obs:status
- task obs:destroy
- task obs:doctor
- task obs:config

## Troubleshooting
1) task obs:doctor
2) task obs:config
3) task obs:logs (collector)
4) Verify endpoints:
   - curl http://127.0.0.1:13133/
   - curl http://127.0.0.1:9090/-/ready
   - curl http://127.0.0.1:3001/api/health
