/**
 * In-Memory Dispatch Audit Writer
 *
 * In-memory implementation of DispatchAuditWriter for initial launch.
 * Stores audit records in memory (lost on restart).
 *
 * TODO: Replace with persistent implementation (Sequelize/DispatchAuditModel) in Phase 4.
 */

import { ok, type Result } from "../../../shared/core/result.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import type {
  DispatchAuditRecord,
  DispatchAuditWriter,
} from "../application/ports/dispatch-audit-writer.port.js";

/**
 * In-Memory Dispatch Audit Writer
 */
export class InMemoryDispatchAuditWriter implements DispatchAuditWriter {
  private readonly auditRecords: Map<string, DispatchAuditRecord> = new Map();

  async writeDispatchAttempt(
    audit: DispatchAuditRecord
  ): Promise<Result<void, DomainError>> {
    // Store by correlationId (simplistic - real impl uses DB with indexing)
    this.auditRecords.set(audit.correlationId, audit);
    return ok(undefined);
  }

  /**
   * Get all audit records (for testing/debugging)
   */
  getAll(): readonly DispatchAuditRecord[] {
    return Array.from(this.auditRecords.values());
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.auditRecords.clear();
  }
}

/**
 * Factory function to create an in-memory dispatch audit writer
 */
export const createInMemoryDispatchAuditWriter = (): DispatchAuditWriter => {
  return new InMemoryDispatchAuditWriter();
};
