import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";

/**
 * Strict version format: vN.N.N where N is non-negative integer.
 * Example: v1.0.0, v2.3.15
 */
const PRICING_VERSION_FORMAT = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * PricingVersion provides total ordering for fare calculation versions.
 *
 * Format: vN.N.N (semantic versioning)
 * - major: breaking changes to calculation algorithm
 * - minor: backward-compatible enhancements
 * - patch: bug fixes
 *
 * Why: Fare calculations must be versioned for audit/evidence.
 * Version comparison enables "use latest" vs "use snapshot" policies.
 */
export class PricingVersion {
  readonly #value: string;
  readonly #major: number;
  readonly #minor: number;
  readonly #patch: number;

  private constructor(
    value: string,
    major: number,
    minor: number,
    patch: number
  ) {
    this.#value = value;
    this.#major = major;
    this.#minor = minor;
    this.#patch = patch;
  }

  /**
   * Create PricingVersion with strict format validation.
   */
  static create(version: string): Result<PricingVersion, ValidationError> {
    const match = PRICING_VERSION_FORMAT.exec(version);

    if (!match) {
      return Result.err(
        new ValidationError(
          "PricingVersion must match format vN.N.N (e.g., v1.0.0)"
        )
      );
    }

    const major = Number.parseInt(match[1] as string, 10);
    const minor = Number.parseInt(match[2] as string, 10);
    const patch = Number.parseInt(match[3] as string, 10);

    if (major < 0 || minor < 0 || patch < 0) {
      return Result.err(
        new ValidationError(
          "PricingVersion parts must be non-negative integers"
        )
      );
    }

    return Result.ok(new PricingVersion(version, major, minor, patch));
  }

  get value(): string {
    return this.#value;
  }

  get major(): number {
    return this.#major;
  }

  get minor(): number {
    return this.#minor;
  }

  get patch(): number {
    return this.#patch;
  }

  /**
   * Total ordering comparison: major > minor > patch.
   * Returns true if this version is newer than other.
   */
  isNewerThan(other: PricingVersion): boolean {
    if (this.#major !== other.#major) {
      return this.#major > other.#major;
    }

    if (this.#minor !== other.#minor) {
      return this.#minor > other.#minor;
    }

    return this.#patch > other.#patch;
  }

  equals(other: PricingVersion): boolean {
    return this.#value === other.#value;
  }
}
