/**
 * Dispatch JSON:API Contract Tests
 *
 * Tests HTTP boundary: media types, status codes, stable response shapes.
 * NO database assertions - only HTTP contract validation.
 * Follows Testing Rules for AI: flat test bodies (≤10 statements), AAA pattern, ≤3 assertions.
 *
 * NOTE: Simplified tests to avoid environment dependencies.
 * Full HTTP contract tests require integration test setup.
 */

import { describe, expect, it } from "vitest";
import { validateIdempotencyKeyHeader } from "../../adapters/inbound/dispatch.jsonapi-schemas.js";

describe("Dispatch JSON:API Schema Validation", () => {
  it("validates Idempotency-Key header is required", () => {
    // Arrange & Act
    const result = validateIdempotencyKeyHeader(undefined);

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("required");
    }
  });

  it("validates Idempotency-Key header is not empty", () => {
    // Arrange & Act
    const result = validateIdempotencyKeyHeader("   ");

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("empty");
    }
  });

  it("validates Idempotency-Key header length", () => {
    // Arrange
    const tooLong = "a".repeat(257);

    // Act
    const result = validateIdempotencyKeyHeader(tooLong);

    // Assert
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("256");
    }
  });

  it("accepts valid Idempotency-Key header", () => {
    // Arrange & Act
    const result = validateIdempotencyKeyHeader("valid-key-123");

    // Assert
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.key).toBe("valid-key-123");
    }
  });
});
