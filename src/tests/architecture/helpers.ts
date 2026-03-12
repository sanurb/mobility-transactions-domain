import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Architecture test helpers.
 *
 * Design constraints:
 * - Keep test bodies flat (Testing Rules for AI #3, A.13)
 * - Put iteration and parsing logic in helpers
 * - Use regex parsing (no AST dependency)
 * - Context auto-discovery (no hard-coded lists)
 */

export type Violation = {
  readonly file: string;
  readonly line: number;
  readonly offending: string;
  readonly ruleId: string;
};

/**
 * Discovers contexts from src/* directories.
 *
 * Includes a context if it has at least one of:
 * - domain/
 * - application/
 * - adapters/
 * - infrastructure/
 *
 * Excludes: shared, test, tests, scripts, config, health
 */
export function discoverContexts(): readonly string[] {
  const srcDir = join(process.cwd(), "src");
  const contexts: string[] = [];
  const excludes = new Set([
    "shared",
    "test",
    "tests",
    "scripts",
    "config",
    "health",
    "bootstrap",
    "modules",
  ]);

  const scanDir = (baseDir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(baseDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (excludes.has(entry)) {
        continue;
      }

      const fullPath = join(baseDir, entry);
      if (!statSync(fullPath).isDirectory()) {
        continue;
      }

      const hasLayers = [
        "domain",
        "application",
        "adapters",
        "infrastructure",
      ].some((layer) => {
        try {
          const layerPath = join(fullPath, layer);
          return statSync(layerPath).isDirectory();
        } catch {
          return false;
        }
      });

      if (hasLayers && !contexts.includes(entry)) {
        contexts.push(entry);
      }
    }
  };

  scanDir(srcDir);
  scanDir(join(srcDir, "modules"));

  return contexts.sort();
}

/**
 * Resolves a context name to its absolute directory path.
 *
 * Checks src/modules/<ctx>/ first, then falls back to src/<ctx>/.
 */
export function resolveContextDir(ctx: string): string {
  const srcDir = join(process.cwd(), "src");
  const modulesPath = join(srcDir, "modules", ctx);
  try {
    if (statSync(modulesPath).isDirectory()) {
      return modulesPath;
    }
  } catch {
    // fall through
  }
  return join(srcDir, ctx);
}

/**
 * Returns all .ts source files under rootDir.
 *
 * Excludes:
 * - **\/*.test.ts
 * - **\/*.spec.ts
 * - **\/__tests__/**
 * - **\/tests/**
 * - **\/node_modules/**
 * - **\/dist/**
 */
export function getSourceFiles(rootDir: string): readonly string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip excluded directories
          if (
            entry === "node_modules" ||
            entry === "dist" ||
            entry === "__tests__" ||
            entry === "tests"
          ) {
            continue;
          }
          walk(fullPath);
        } else if (stat.isFile()) {
          // Include only .ts files, exclude test files
          if (
            fullPath.endsWith(".ts") &&
            !fullPath.endsWith(".test.ts") &&
            !fullPath.endsWith(".spec.ts")
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Directory doesn't exist - skip silently
      // This allows tests to work even if some contexts don't have all layers
    }
  }

  walk(rootDir);
  return files.sort();
}

/**
 * Extracts imports from a TypeScript file.
 *
 * Captures:
 * - import ... from 'x'
 * - export ... from 'x'
 * - import('x') (dynamic import)
 *
 * Ignores type-only vs value imports (both are coupling).
 */
export function getImports(
  filePath: string
): readonly { readonly source: string; readonly line: number }[] {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const imports: { source: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const lineNumber = i + 1;

    // Match: import ... from 'source' or import ... from "source"
    const importMatch = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/.exec(line);
    const importSource = importMatch?.[1];
    if (importSource !== undefined) {
      imports.push({ source: importSource, line: lineNumber });
      continue;
    }

    // Match: export ... from 'source' or export ... from "source"
    const exportMatch = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/.exec(line);
    const exportSource = exportMatch?.[1];
    if (exportSource !== undefined) {
      imports.push({ source: exportSource, line: lineNumber });
      continue;
    }

    // Match: import('source') (dynamic import)
    const dynamicMatch = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(line);
    const dynamicSource = dynamicMatch?.[1];
    if (dynamicSource !== undefined) {
      imports.push({ source: dynamicSource, line: lineNumber });
    }
  }

  return imports;
}

/**
 * Scans a file for string patterns.
 *
 * Returns all matches with line numbers.
 */
export function scanForPatterns(
  filePath: string,
  patterns: readonly RegExp[]
): readonly { readonly pattern: string; readonly line: number }[] {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const matches: { pattern: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const lineNumber = i + 1;

    for (const pattern of patterns) {
      if (pattern.test(line)) {
        matches.push({ pattern: pattern.source, line: lineNumber });
      }
    }
  }

  return matches;
}

/**
 * Scans files for dependency violations.
 *
 * Returns violations for imports matching forbidden patterns.
 */
export function scanDependencyViolations(
  files: readonly string[],
  forbiddenPatterns: readonly string[],
  ruleId: string
): readonly Violation[] {
  const violations: Violation[] = [];
  const srcDir = join(process.cwd(), "src");

  for (const file of files) {
    const imports = getImports(file);

    for (const imp of imports) {
      for (const pattern of forbiddenPatterns) {
        if (imp.source.includes(pattern)) {
          violations.push({
            file: relative(srcDir, file),
            line: imp.line,
            offending: imp.source,
            ruleId,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Formats violations for readable test output.
 */
export function formatViolations(
  title: string,
  violations: readonly Violation[]
): string {
  if (violations.length === 0) {
    return `${title}: OK`;
  }

  const lines = [`${title}: ${violations.length} violation(s) found:\n`];

  for (const v of violations) {
    lines.push(`  [${v.ruleId}] ${v.file}:${v.line}`);
    lines.push(`    → ${v.offending}`);
  }

  return lines.join("\n");
}

/**
 * Ratchet allowlist for legacy violations.
 *
 * Key format: ${ruleId}:${relativePath}:${line}:${fingerprint}
 *
 * IMPORTANT: This allowlist ONLY suppresses known legacy violations.
 * New violations MUST fail CI. Remove entries during modernization.
 */
const ALLOWLIST: readonly string[] = [
  // C1: Legacy cross-context imports in dispatch context
  // Dispatch depends on drivers domain — pending ACL refactor
  // TODO: Introduce DispatchDriverPort / move shared types to shared context
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:24:------drivers-domain-events-js--cross-context-to-d",
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:25:------drivers-domain-ports-clock-port-js--cross-co",
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:26:------drivers-domain-ports-driver-repository-port-",
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:27:------drivers-domain-ports-geo-spatial-index-port-",
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:29:------drivers-domain-value-objects-driver-id-js--c",
  "C1-cross-context-internal:modules/dispatch/application/dispatch.process-manager.ts:31:------drivers-domain-value-objects-tenant-id-js--c",
  "C1-cross-context-internal:modules/dispatch/index.ts:17:---drivers-domain-dispatch-policy-js--cross-contex",
  "C1-cross-context-internal:modules/dispatch/index.ts:18:---drivers-domain-ports-geo-spatial-index-port-js-",

  // P1: False positives in JSDoc comments mentioning Date patterns
  // events.ts:11 has "no new Date() in domain" in a comment
  // fare-calculator.ts:93 has "not Date.now()" in a JSDoc @param
  "P1-clock-access:modules/drivers/domain/events.ts:11:-bnew-s-Date-s----s---",

  // C2: shared/infrastructure/database/run-migrations.ts imports context migration files
  // TODO: Move migration registration to module init or a separate entry point
  "C2-shared-context-dependency:shared/infrastructure/database/run-migrations.ts:15:---------modules-fares-infrastructure-migrations-a",
  "C2-shared-context-dependency:shared/infrastructure/database/run-migrations.ts:16:---------modules-payments-infrastructure-migration",
  "C2-shared-context-dependency:shared/infrastructure/database/run-migrations.ts:17:---------modules-rides-infrastructure-migrations-a",

  // C2: shared/infrastructure/database/seeds/engine/ensure-schema.ts imports context models
  // TODO: Move model registration to module init or a separate entry point
  "C2-shared-context-dependency:shared/infrastructure/database/seeds/engine/ensure-schema.ts:12:---------------modules-dispatch-infrastructure-per",
  "C2-shared-context-dependency:shared/infrastructure/database/seeds/engine/ensure-schema.ts:13:---------------modules-drivers-adapters-outbound-i",
  "C2-shared-context-dependency:shared/infrastructure/database/seeds/engine/ensure-schema.ts:14:---------------modules-fares-infrastructure-index-",
  "C2-shared-context-dependency:shared/infrastructure/database/seeds/engine/ensure-schema.ts:20:---------------modules-rides-infrastructure-index-",
];

/**
 * Checks if a violation is allowlisted.
 */
export function isAllowlisted(violationKey: string): boolean {
  return ALLOWLIST.includes(violationKey);
}

/**
 * Returns the full allowlist.
 */
export function getAllowlist(): readonly string[] {
  return ALLOWLIST;
}

/**
 * Creates a stable violation key for ratchet allowlist.
 */
export function createViolationKey(violation: Violation): string {
  const fingerprint = violation.offending
    .replace(/[^a-zA-Z0-9]/g, "-")
    .slice(0, 50);
  return `${violation.ruleId}:${violation.file}:${violation.line}:${fingerprint}`;
}

/**
 * Filters out allowlisted violations.
 */
export function filterAllowlisted(
  violations: readonly Violation[]
): readonly Violation[] {
  return violations.filter((v) => {
    const key = createViolationKey(v);
    const allowed = isAllowlisted(key);
    if (!allowed && process.env.DEBUG_ALLOWLIST) {
      console.log("Not allowlisted:", key);
    }
    return !allowed;
  });
}

/**
 * Checks if a file is an AggregateRoot (contains 'extends AggregateRoot').
 */
export function isAggregateFile(filePath: string): boolean {
  const content = readFileSync(filePath, "utf8");
  return /extends\s+AggregateRoot\b/.test(content);
}

/**
 * Returns all aggregate files in a directory.
 */
export function getAggregateFiles(rootDir: string): readonly string[] {
  const files = getSourceFiles(rootDir);
  return files.filter((f) => isAggregateFile(f));
}

// ============================================
// Route Contract Enforcement
// ============================================

/**
 * Fastify route definition tokens to scan for.
 * Any file containing these is considered a route file.
 */
const ROUTE_TOKENS = [
  ".route(",
  ".get(",
  ".post(",
  ".put(",
  ".patch(",
  ".delete(",
  ".all(",
];

/**
 * Legacy route files that don't use withUseCaseObservability wrapper yet.
 * TODO: Remove entries as routes are instrumented.
 */
const ROUTE_ALLOWLIST_WRAPPER: readonly string[] = [
  "modules/dispatch/adapters/inbound/dispatch.jsonapi-routes.ts",
  "modules/drivers/adapters/inbound/driver.jsonapi-routes.ts",
];

/**
 * Legacy route files that don't use runWithCorrelation yet.
 * TODO: Remove entries as routes are instrumented.
 */
const ROUTE_ALLOWLIST_CORRELATION: readonly string[] = [
  "modules/dispatch/adapters/inbound/dispatch.jsonapi-routes.ts",
  "modules/drivers/adapters/inbound/driver.jsonapi-routes.ts",
];

/**
 * Returns all inbound route files that define Fastify routes.
 *
 * Includes only .ts files under src/context/adapters/inbound/ that contain route tokens.
 * Excludes test files.
 */
export function getInboundRouteFiles(): readonly string[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const routeFiles: string[] = [];

  for (const ctx of contexts) {
    const inboundDir = join(resolveContextDir(ctx), "adapters", "inbound");
    const files = getSourceFiles(inboundDir);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const hasRouteToken = ROUTE_TOKENS.some((token) =>
        content.includes(token)
      );

      if (hasRouteToken) {
        routeFiles.push(file);
      }
    }
  }

  return routeFiles.sort();
}

/**
 * Scan a route file for contract compliance.
 *
 * @returns routeCount - Number of route definitions found
 * @returns hasWithUseCaseObservability - Whether file uses withUseCaseObservability wrapper
 * @returns hasRunWithCorrelation - Whether file uses runWithCorrelation wrapper
 */
export function scanRouteContract(filePath: string): {
  readonly routeCount: number;
  readonly hasWithUseCaseObservability: boolean;
  readonly hasRunWithCorrelation: boolean;
} {
  const content = readFileSync(filePath, "utf8");

  // Count route definitions
  let routeCount = 0;
  for (const token of ROUTE_TOKENS) {
    // Escape special regex characters in token
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = content.match(new RegExp(escapedToken, "g"));
    if (matches) {
      routeCount += matches.length;
    }
  }

  // Check for wrapper usage (word-boundary regex to avoid false positives)
  const hasWithUseCaseObservability = /\bwithUseCaseObservability\b/.test(
    content
  );
  const hasRunWithCorrelation = /\brunWithCorrelation\b/.test(content);

  return {
    routeCount,
    hasWithUseCaseObservability,
    hasRunWithCorrelation,
  };
}

/**
 * Find route files that violate the wrapper contract.
 *
 * Returns files that:
 * - Define routes (routeCount > 0)
 * - Don't use withUseCaseObservability
 * - Are not in the allowlist
 */
export function findRouteWrapperViolations(): readonly string[] {
  const routeFiles = getInboundRouteFiles();
  const violations: string[] = [];
  const srcDir = join(process.cwd(), "src");

  for (const file of routeFiles) {
    const relativePath = relative(srcDir, file);
    const contract = scanRouteContract(file);

    if (
      contract.routeCount > 0 &&
      !contract.hasWithUseCaseObservability &&
      !ROUTE_ALLOWLIST_WRAPPER.includes(relativePath)
    ) {
      violations.push(relativePath);
    }
  }

  return violations.sort();
}

/**
 * Find route files that violate the correlation contract.
 *
 * Returns files that:
 * - Define routes (routeCount > 0)
 * - Don't use runWithCorrelation
 * - Are not in the allowlist
 */
export function findRouteCorrelationViolations(): readonly string[] {
  const routeFiles = getInboundRouteFiles();
  const violations: string[] = [];
  const srcDir = join(process.cwd(), "src");

  for (const file of routeFiles) {
    const relativePath = relative(srcDir, file);
    const contract = scanRouteContract(file);

    if (
      contract.routeCount > 0 &&
      !contract.hasRunWithCorrelation &&
      !ROUTE_ALLOWLIST_CORRELATION.includes(relativePath)
    ) {
      violations.push(relativePath);
    }
  }

  return violations.sort();
}

/**
 * Scans a specific layer across all discovered contexts for dependency violations.
 */
export function scanLayerAcrossContexts(
  layer: string,
  forbiddenPatterns: readonly string[],
  ruleId: string
): readonly Violation[] {
  const contexts = discoverContexts();
  const violations: Violation[] = [];

  for (const ctx of contexts) {
    const layerDir = join(resolveContextDir(ctx), layer);
    const files = getSourceFiles(layerDir);
    const ctxViolations = scanDependencyViolations(
      files,
      forbiddenPatterns,
      ruleId
    );
    violations.push(...ctxViolations);
  }

  return violations;
}

/**
 * Scans domain layer across all contexts for regex pattern matches.
 */
export function scanDomainPatternsAcrossContexts(
  patterns: readonly RegExp[],
  ruleId: string
): readonly Violation[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const violations: Violation[] = [];

  for (const ctx of contexts) {
    const domainDir = join(resolveContextDir(ctx), "domain");
    const files = getSourceFiles(domainDir);

    for (const file of files) {
      const matches = scanForPatterns(file, patterns);
      for (const match of matches) {
        violations.push({
          file: file.replace(`${srcDir}/`, ""),
          line: match.line,
          offending: match.pattern,
          ruleId,
        });
      }
    }
  }

  return violations;
}

/**
 * Scans for this.record() calls outside aggregate files across all contexts.
 */
export function scanRecordOutsideAggregates(): readonly Violation[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const violations: Violation[] = [];
  const recordPattern = [/\bthis\.record\s*\(/];

  for (const ctx of contexts) {
    const domainDir = join(resolveContextDir(ctx), "domain");
    const files = getSourceFiles(domainDir);

    for (const file of files) {
      const isAggregate = isAggregateFile(file);
      const matches = scanForPatterns(file, recordPattern);

      if (matches.length > 0 && !isAggregate) {
        for (const match of matches) {
          violations.push({
            file: file.replace(`${srcDir}/`, ""),
            line: match.line,
            offending: "this.record() outside AggregateRoot",
            ruleId: "P4-record-outside-aggregate",
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Scans for cross-context internal imports (C1 rule).
 */
export function scanCrossContextInternalImports(): readonly Violation[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const violations: Violation[] = [];

  for (const ctxA of contexts) {
    const ctxDir = resolveContextDir(ctxA);
    const files = getSourceFiles(ctxDir);

    for (const file of files) {
      const imports = getImports(file);

      for (const imp of imports) {
        for (const ctxB of contexts) {
          if (ctxA === ctxB) {
            continue;
          }

          const forbiddenPatterns = [
            `src/${ctxB}/domain/`,
            `/${ctxB}/domain/`,
            `src/${ctxB}/application/`,
            `/${ctxB}/application/`,
            `src/${ctxB}/adapters/`,
            `/${ctxB}/adapters/`,
            `src/${ctxB}/infrastructure/`,
            `/${ctxB}/infrastructure/`,
          ];

          const allowedPatterns = [
            `src/${ctxB}/domain/index`,
            `/${ctxB}/domain/index`,
            `src/${ctxB}/application/index`,
            `/${ctxB}/application/index`,
          ];

          const isForbidden = forbiddenPatterns.some((pattern) =>
            imp.source.includes(pattern)
          );
          const isAllowed = allowedPatterns.some((pattern) =>
            imp.source.includes(pattern)
          );

          if (isForbidden && !isAllowed) {
            violations.push({
              file: file.replace(`${srcDir}/`, ""),
              line: imp.line,
              offending: `${imp.source} (cross-context to ${ctxB})`,
              ruleId: "C1-cross-context-internal",
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Scans shared/ for imports from any context (C2 rule).
 */
export function scanSharedContextDependencies(): readonly Violation[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const violations: Violation[] = [];
  const sharedDir = join(srcDir, "shared");
  const files = getSourceFiles(sharedDir);

  for (const file of files) {
    const imports = getImports(file);

    for (const imp of imports) {
      for (const ctx of contexts) {
        if (
          imp.source.includes(`src/${ctx}/`) ||
          imp.source.includes(`/${ctx}/`)
        ) {
          violations.push({
            file: file.replace(`${srcDir}/`, ""),
            line: imp.line,
            offending: `${imp.source} (shared depends on ${ctx})`,
            ruleId: "C2-shared-context-dependency",
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Collects all source files from domain + application layers across contexts.
 */
export function collectCoreLayerFiles(): readonly string[] {
  const srcDir = join(process.cwd(), "src");
  const contexts = discoverContexts();
  const files: string[] = [];

  for (const ctx of contexts) {
    const domainFiles = getSourceFiles(join(srcDir, ctx, "domain"));
    const appFiles = getSourceFiles(join(srcDir, ctx, "application"));
    files.push(...domainFiles, ...appFiles);
  }

  return files;
}

/**
 * Format file paths for readable test output.
 *
 * @param title - Description of the violation
 * @param paths - File paths that violate the rule
 * @returns Deterministic, compact message
 */
export function formatPaths(title: string, paths: readonly string[]): string {
  if (paths.length === 0) {
    return `${title}: OK`;
  }

  const sortedPaths = [...paths].sort();
  const lines = [`${title}: ${paths.length} violation(s) found:\n`];
  for (const path of sortedPaths) {
    lines.push(`  - ${path}`);
  }

  return lines.join("\n");
}

// ============================================
// Test File Scanning
// ============================================

/**
 * Returns all test files (*.test.ts, *.spec.ts) under a directory.
 * Excludes node_modules and dist.
 */
export function getTestFiles(rootDir: string): readonly string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!existsSync(dir)) {
      return;
    }
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist") {
        continue;
      }
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (
        stat.isFile() &&
        (fullPath.endsWith(".test.ts") || fullPath.endsWith(".spec.ts"))
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

/**
 * Scans test files for .sync( calls that bypass the shared initTestDb() bootstrap.
 *
 * Returns violations for any test file containing .sync( patterns.
 */
export function scanSyncInTestFiles(): readonly Violation[] {
  const srcDir = join(process.cwd(), "src");
  const testFiles = [
    ...getTestFiles(join(srcDir, "modules")),
    ...getTestFiles(join(srcDir, "shared")),
  ];
  const violations: Violation[] = [];
  const syncPattern = /\.sync\s*\(/;

  for (const file of testFiles) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) {
        continue;
      }
      if (syncPattern.test(line)) {
        violations.push({
          file: relative(srcDir, file),
          line: i + 1,
          offending: line.trim(),
          ruleId: "R4-no-sync-in-tests",
        });
      }
    }
  }

  return violations;
}
