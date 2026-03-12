/**
 * @fileoverview
 * Role-to-scope mapping policy.
 *
 * Maps each UserRole to the set of authorization scopes it grants.
 * This is the single source of truth for "which role can do what".
 *
 * Scopes are intentionally coarse -- they gate HTTP-level access.
 * Fine-grained domain rules live in domain policies / aggregates.
 */

import type { AuthScope } from "./auth.types.js";
import { AUTH_SCOPES } from "./auth.types.js";
import type { UserRole } from "./better-auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// All scopes (convenience array for the admin role)
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SCOPES: readonly AuthScope[] = Object.values(AUTH_SCOPES);

// ─────────────────────────────────────────────────────────────────────────────
// Role → Scopes mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic mapping from role to granted scopes.
 *
 * Invariant: every role present in USER_ROLES MUST have an entry here.
 * Adding a role without mapping will cause a compile-time error via
 * the `satisfies` assertion.
 */
const ROLE_SCOPES: Record<UserRole, readonly AuthScope[]> = {
  rider: [
    AUTH_SCOPES.RIDER_READ,
    AUTH_SCOPES.RIDER_WRITE,
    AUTH_SCOPES.RIDE_CREATE,
    AUTH_SCOPES.RIDE_READ,
    AUTH_SCOPES.RIDE_CANCEL,
    AUTH_SCOPES.PAYMENT_READ,
  ],

  driver: [
    AUTH_SCOPES.DRIVER_READ,
    AUTH_SCOPES.DRIVER_WRITE,
    AUTH_SCOPES.RIDE_READ,
    AUTH_SCOPES.RIDE_UPDATE,
  ],

  admin: ALL_SCOPES,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the scopes granted to a given role.
 * Falls back to an empty array for unknown roles (defensive).
 */
export const getScopesForRole = (role: string): readonly AuthScope[] => {
  if (role in ROLE_SCOPES) {
    return ROLE_SCOPES[role as UserRole];
  }
  return [];
};
