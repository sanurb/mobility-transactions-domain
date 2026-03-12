import { describe, expect, it } from "vitest";
import { IdempotencyKey } from "./idempotency-key.js";
import { buildIdempotencyKey } from "./test/data/build-idempotency-key.js";

describe("IdempotencyKey", () => {
  describe("create", () => {
    it("When raw string has whitespace and mixed case, then canonicalizes to trimmed lowercase", () => {
      const rawKey = "  Test-Key-ABC  ";
      const expectedCanonical = "test-key-abc";

      const result = IdempotencyKey.create(rawKey);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().value).toBe(expectedCanonical);
    });

    it("When empty string provided, then rejects with validation error", () => {
      const emptyKey = "   ";

      const result = IdempotencyKey.create(emptyKey);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("empty"),
        });
      }
    });

    it("When string exceeds max length, then rejects with validation error", () => {
      const tooLongKey = "a".repeat(257);

      const result = IdempotencyKey.create(tooLongKey);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("256"),
        });
      }
    });

    it("When string contains invalid characters, then rejects with validation error", () => {
      const invalidKey = "key-with-spaces and-symbols!";

      const result = IdempotencyKey.create(invalidKey);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("alphanumeric"),
        });
      }
    });

    it("When string contains only valid characters, then accepts key", () => {
      const validKey = "valid-key_123:test";

      const result = IdempotencyKey.create(validKey);

      expect(result.isOk()).toBe(true);
    });
  });

  describe("equals", () => {
    it("When canonical values match, then returns true", () => {
      const key1 = buildIdempotencyKey({ raw: "TEST-KEY" });
      const key2 = buildIdempotencyKey({ raw: "test-key" });

      const result = key1.equals(key2);

      expect(result).toBe(true);
    });

    it("When canonical values differ, then returns false", () => {
      const key1 = buildIdempotencyKey({ raw: "key-one" });
      const key2 = buildIdempotencyKey({ raw: "key-two" });

      const result = key1.equals(key2);

      expect(result).toBe(false);
    });
  });
});
