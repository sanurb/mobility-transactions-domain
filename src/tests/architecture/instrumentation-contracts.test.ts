import { describe, expect, it } from "vitest";
import {
  collectCoreLayerFiles,
  filterAllowlisted,
  findRouteCorrelationViolations,
  findRouteWrapperViolations,
  formatPaths,
  formatViolations,
  scanDependencyViolations,
} from "./helpers.js";

describe("Instrumentation Contract Tests", () => {
  it("When an inbound route defines routes, then it must use withUseCaseObservability", () => {
    const paths = findRouteWrapperViolations();

    expect(
      paths,
      formatPaths("Missing withUseCaseObservability", paths)
    ).toEqual([]);
  });

  it("When an inbound route defines routes, then it must establish correlation via runWithCorrelation", () => {
    const paths = findRouteCorrelationViolations();

    expect(paths, formatPaths("Missing runWithCorrelation", paths)).toEqual([]);
  });

  it("When code is in domain/application, then it must not depend on @opentelemetry", () => {
    const files = collectCoreLayerFiles();
    const violations = scanDependencyViolations(
      files,
      ["@opentelemetry"],
      "I3-otel-in-core"
    );

    const newViolations = filterAllowlisted(violations);

    expect(
      newViolations,
      formatViolations(
        "I3: @opentelemetry in domain/application",
        newViolations
      )
    ).toEqual([]);
  });

  it("When code is in domain/application, then it must not depend on infrastructure observability", () => {
    const files = collectCoreLayerFiles();
    const violations = scanDependencyViolations(
      files,
      ["shared/infrastructure/observability", "infrastructure/observability"],
      "I4-obs-infra-in-core"
    );

    const newViolations = filterAllowlisted(violations);

    expect(
      newViolations,
      formatViolations(
        "I4: Observability infra in domain/application",
        newViolations
      )
    ).toEqual([]);
  });
});
