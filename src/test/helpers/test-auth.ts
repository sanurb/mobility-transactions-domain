import { randomUUID } from "node:crypto";
import { config } from "../../config/index.js";
import type { AuthScope } from "../../shared/infrastructure/auth/index.js";
import { AUTH_SCOPES, auth } from "../../shared/infrastructure/auth/index.js";

/**
 * Predefined test users for common scenarios
 */
export const TEST_USERS = {
  rider: {
    sub: "test-rider-001",
    role: "rider",
    authScopes: [
      AUTH_SCOPES.RIDER_READ,
      AUTH_SCOPES.RIDER_WRITE,
      AUTH_SCOPES.RIDE_CREATE,
      AUTH_SCOPES.RIDE_READ,
      AUTH_SCOPES.RIDE_CANCEL,
      AUTH_SCOPES.PAYMENT_READ,
    ] as AuthScope[],
  },
  driver: {
    sub: "test-driver-001",
    role: "driver",
    authScopes: [AUTH_SCOPES.RIDE_READ, AUTH_SCOPES.RIDE_UPDATE] as AuthScope[],
  },
  admin: {
    sub: "test-admin-001",
    role: "admin",
    authScopes: [
      AUTH_SCOPES.ADMIN_READ,
      AUTH_SCOPES.ADMIN_WRITE,
    ] as AuthScope[],
  },
  noScopes: {
    sub: "test-user-no-scopes",
    role: "rider",
    authScopes: [] as AuthScope[],
  },
} as const;

export type TestUserType = keyof typeof TEST_USERS;

const TEST_PASSWORD = "Password123!";
const TEST_DOMAIN = "test.local";
const tokenCache = new Map<string, string>();

/** Unique suffix per test run to avoid email collisions across parallel runs */
const RUN_ID = randomUUID().slice(0, 8);

const buildTestEmail = (subject: string): string =>
  `${subject.toLowerCase()}-${RUN_ID}@${TEST_DOMAIN}`;

const roleFromClaims = (claims: {
  readonly riderId: string | undefined;
  readonly driverId: string | undefined;
  readonly scopes: readonly AuthScope[];
}): "rider" | "driver" | "admin" => {
  if (claims.scopes.includes(AUTH_SCOPES.ADMIN_READ)) {
    return "admin";
  }
  if (claims.driverId !== undefined) {
    return "driver";
  }
  return "rider";
};

const upsertUserAuthShape = async (params: {
  readonly email: string;
  readonly role: "rider" | "driver" | "admin";
  readonly authScopes: readonly AuthScope[];
}): Promise<void> => {
  const { pool } = await import(
    "../../shared/infrastructure/database/index.js"
  );
  await pool.query(
    'UPDATE "user" SET role = $1, "authScopes" = $2, "updatedAt" = NOW() WHERE email = $3',
    [params.role, params.authScopes.join(","), params.email]
  );
};

const signUpIfNeeded = async (params: {
  readonly email: string;
  readonly name: string;
}): Promise<void> => {
  const request = new Request(
    `${config.betterAuth.url}/api/auth/sign-up/email`,
    {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        password: TEST_PASSWORD,
      }),
    }
  );

  const response = await auth.handler(request);
  if (response.ok || response.status === 409 || response.status === 422) {
    return;
  }

  const body = await response.text();
  throw new Error(`Test auth sign-up failed (${response.status}): ${body}`);
};

const signInAndGetBearerToken = async (email: string): Promise<string> => {
  const request = new Request(
    `${config.betterAuth.url}/api/auth/sign-in/email`,
    {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        email,
        password: TEST_PASSWORD,
      }),
    }
  );

  const response = await auth.handler(request);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Test auth sign-in failed (${response.status}): ${body}`);
  }

  const token = response.headers.get("set-auth-token");
  if (token === null || token.length === 0) {
    throw new Error(
      "Missing set-auth-token header in Better Auth sign-in response"
    );
  }

  return token;
};

const ensureBearerToken = async (params: {
  readonly cacheKey: string;
  readonly subject: string;
  readonly role: "rider" | "driver" | "admin";
  readonly authScopes: readonly AuthScope[];
}): Promise<string> => {
  const cached = tokenCache.get(params.cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const email = buildTestEmail(params.subject);
  await signUpIfNeeded({
    email,
    name: params.subject,
  });
  await upsertUserAuthShape({
    email,
    role: params.role,
    authScopes: [...params.authScopes],
  });
  const token = await signInAndGetBearerToken(email);
  tokenCache.set(params.cacheKey, token);
  return token;
};

export const createTestToken = async (
  userType: TestUserType = "rider"
): Promise<string> => {
  const user = TEST_USERS[userType];
  return ensureBearerToken({
    cacheKey: `preset:${userType}`,
    subject: user.sub,
    role: user.role,
    authScopes: user.authScopes,
  });
};

/**
 * Generate a custom bearer token with specific auth shape.
 * Preserves the previous helper API used by integration tests.
 */
export const createCustomTestToken = async (claims: {
  readonly sub: string;
  readonly tenantId: string;
  readonly riderId?: string;
  readonly driverId?: string;
  readonly scopes: readonly AuthScope[];
}): Promise<string> => {
  const role = roleFromClaims({
    riderId: claims.riderId,
    driverId: claims.driverId,
    scopes: claims.scopes,
  });
  const cacheKey = [
    "custom",
    claims.sub,
    role,
    claims.scopes.slice().sort().join("|"),
  ].join(":");

  return ensureBearerToken({
    cacheKey,
    subject: claims.sub,
    role,
    authScopes: claims.scopes,
  });
};

/**
 * Create Authorization header value for test requests
 */
export const createAuthHeader = async (
  userType: TestUserType = "rider"
): Promise<string> => {
  const token = await createTestToken(userType);
  return `Bearer ${token}`;
};

/**
 * Clear cached tokens between test runs to avoid stale auth state
 */
export const clearTokenCache = (): void => {
  tokenCache.clear();
};
