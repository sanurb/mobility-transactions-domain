export type {
  AuthenticatedRequest,
  AuthScope,
  UserContext,
} from "./auth.types.js";
export {
  AUTH_SCOPES,
  DEFAULT_TENANT_ID,
  isAuthenticated,
} from "./auth.types.js";
export type { BetterAuthInstance, UserRole } from "./better-auth.js";
export { auth, USER_ROLES } from "./better-auth.js";

export { betterAuthPlugin } from "./better-auth.plugin.js";

export {
  authMiddleware,
  getAuthenticatedUser,
  requireScopes,
} from "./jwt.middleware.js";

export { getScopesForRole } from "./role-scopes.js";
