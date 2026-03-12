/**
 * @fileoverview
 * PII and secret redaction utilities for logging.
 * Prevents sensitive data from ever reaching logs.
 */

/**
 * PII field names to redact (case-insensitive matching).
 * These fields will have their values replaced with [REDACTED].
 */
export const PII_FIELD_NAMES = new Set([
  // Personal identification
  "email",
  "phone",
  "phoneNumber",
  "phone_number",
  "mobile",
  "firstName",
  "first_name",
  "lastName",
  "last_name",
  "fullName",
  "full_name",
  "name",
  "address",
  "streetAddress",
  "street_address",
  "city",
  "zipCode",
  "zip_code",
  "postalCode",
  "postal_code",
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "date_of_birth",
  "dob",
  "ip",
  "ipAddress",
  "ip_address",

  // Payment/financial
  "cardNumber",
  "card_number",
  "pan",
  "cvv",
  "cvc",
  "securityCode",
  "security_code",
  "accountNumber",
  "account_number",
  "routingNumber",
  "routing_number",

  // Payment provider references (tokens, refs)
  "providerRef",
  "provider_ref",
  "providerReference",
  "provider_reference",
  "paymentToken",
  "payment_token",
  "paymentRef",
  "payment_ref",
  "transactionId",
  "transaction_id",
  "merchantRef",
  "merchant_ref",

  // Idempotency (can be used for replay attacks)
  "idempotencyKey",
  "idempotency_key",

  // Authentication
  "password",
  "secret",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authToken",
  "auth_token",
  "bearerToken",
  "bearer_token",
  "privateKey",
  "private_key",
  "secretKey",
  "secret_key",
]);

/**
 * Regex patterns for detecting sensitive data in string values.
 */
export const SECRET_PATTERNS = {
  /** Email addresses */
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  /** Credit card numbers (basic pattern - 13-19 digits) */
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,7}\b/g,

  /** JWT tokens (three base64 segments separated by dots) */
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  /** Bearer tokens in Authorization headers */
  bearerToken: /Bearer\s+[a-zA-Z0-9._-]+/gi,

  /** API keys (common formats) */
  apiKey:
    /(?:api[_-]?key|apikey|api_secret)[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,

  /** Colombian phone numbers */
  phoneCol: /\+?57\s*\d{10}/g,

  /** Generic phone patterns */
  phone: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
} as const;

const REDACTED = "[REDACTED]";

// Max recursion depth to prevent infinite loops
const MAX_DEPTH = 10;

/**
 * Check if a field name is a PII field (case-insensitive).
 */
export const isPIIField = (fieldName: string): boolean => {
  const normalized = fieldName.toLowerCase();
  for (const piiField of PII_FIELD_NAMES) {
    if (normalized === piiField.toLowerCase()) {
      return true;
    }
  }
  return false;
};

/**
 * Redact patterns from a string value.
 */
export const redactString = (value: string): string => {
  let result = value;
  for (const pattern of Object.values(SECRET_PATTERNS)) {
    // Clone the regex to reset lastIndex for global patterns
    const patternCopy = new RegExp(pattern.source, pattern.flags);
    result = result.replace(patternCopy, REDACTED);
  }
  return result;
};

/**
 * Deep redact an object, replacing PII field values and patterns in strings.
 */
export const redact = <T>(obj: T, depth = 0): T => {
  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
    return REDACTED as T;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return redactString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1)) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isPIIField(key)) {
        // Redact entire value for PII fields
        result[key] = REDACTED;
      } else if (typeof value === "string") {
        // Check string values for patterns
        result[key] = redactString(value);
      } else if (typeof value === "object" && value !== null) {
        // Recurse into nested objects
        result[key] = redact(value, depth + 1);
      } else {
        // Pass through primitives
        result[key] = value;
      }
    }

    return result as T;
  }

  return obj;
};

/**
 * Create a redacted copy of headers (common in request logging).
 */
export const redactHeaders = (
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> => {
  const sensitiveHeaders = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-auth-token",
  ]);

  const result: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Safe serializer for Pino that redacts PII.
 * Use as the serializers option in Pino config.
 */
export const safeSerializers = {
  req: (req: Record<string, unknown>) => ({
    method: req.method,
    url: req.url,
    headers: redactHeaders(req.headers as Record<string, string>),
    remoteAddress: REDACTED, // Always redact IP
    remotePort: req.remotePort,
  }),
  res: (res: Record<string, unknown>) => ({
    statusCode: res.statusCode,
    headers: redactHeaders((res.headers ?? {}) as Record<string, string>),
  }),
  err: (err: Error) => ({
    type: err.name,
    message: redactString(err.message),
    // Stack traces only in non-production
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  }),
};
