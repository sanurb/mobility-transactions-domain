/**
 * PostgreSQL advisory lock for dbctl concurrency safety.
 *
 * Uses pg_try_advisory_lock (non-blocking, fail-fast) to prevent
 * concurrent seed/migration execution. Lock key is a deterministic
 * bigint derived from SHA-256 of "dbctl".
 */

import { createHash } from "node:crypto";
import type { Sequelize } from "sequelize";

/** Deterministic lock key: first 8 bytes of SHA-256("dbctl") as signed Int64. */
const computeLockKey = (): string => {
  const hash = createHash("sha256").update("dbctl").digest();
  const bigint = hash.readBigInt64BE(0);
  return bigint.toString();
};

export const LOCK_KEY = computeLockKey();

export const tryAcquire = async (sequelize: Sequelize): Promise<boolean> => {
  const [rows] = await sequelize.query(
    `SELECT pg_try_advisory_lock(${LOCK_KEY}) AS acquired`
  );
  const row = (rows as Array<{ acquired: boolean }>)[0];
  return row?.acquired === true;
};

export const release = async (sequelize: Sequelize): Promise<void> => {
  await sequelize.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`);
};

export interface LockHolder {
  readonly pid: number;
  readonly application_name: string;
  readonly state: string;
  readonly query_start: string | null;
}

export const queryLockStatus = async (
  sequelize: Sequelize
): Promise<{ held: boolean; holders: LockHolder[] }> => {
  const [rows] = await sequelize.query(
    `SELECT
       a.pid,
       a.application_name,
       a.state,
       a.query_start::text
     FROM pg_locks l
     JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory'
       AND l.classid = (${LOCK_KEY}::bigint >> 32)::int
       AND l.objid = (${LOCK_KEY}::bigint & x'FFFFFFFF'::bigint)::int`
  );

  const holders = (
    rows as Array<{
      pid: number;
      application_name: string;
      state: string;
      query_start: string | null;
    }>
  ).map((r) => ({
    pid: r.pid,
    application_name: r.application_name,
    state: r.state,
    query_start: r.query_start,
  }));

  return { held: holders.length > 0, holders };
};
