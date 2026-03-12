/**
 * IdGeneratorPort — application-layer abstraction for ID generation.
 * Inject via composition root for deterministic IDs in tests.
 */
export interface IdGeneratorPort {
  /** Generate a unique ID string (e.g., UUID v4). */
  generate(): string;
}
