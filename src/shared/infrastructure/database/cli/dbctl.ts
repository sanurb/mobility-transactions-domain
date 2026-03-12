#!/usr/bin/env node

/**
 * dbctl — Agent-first database control plane.
 *
 * All commands emit JSON envelopes with HATEOAS next_actions.
 * Machine-parseable, jq-composable, AI-agent-friendly.
 *
 * Usage:
 *   pnpm dbctl                     # Show command tree
 *   pnpm dbctl seed:status         # Query seed state
 *   pnpm dbctl seed:apply --follow # Stream NDJSON progress
 */

import { cli, define } from "gunshi";
import { lockStatusCommand } from "./commands/lock-status.js";
import { migrateApplyCommand } from "./commands/migrate-apply.js";
import { migratePlanCommand } from "./commands/migrate-plan.js";
import { migrateStatusCommand } from "./commands/migrate-status.js";
import { schemaEnsureCommand } from "./commands/schema-ensure.js";
import { seedApplyCommand } from "./commands/seed-apply.js";
import { seedPlanCommand } from "./commands/seed-plan.js";
import { seedStatusCommand } from "./commands/seed-status.js";
import { seedVerifyCommand } from "./commands/seed-verify.js";
import { emit, success } from "./envelope.js";

const commands = {
  "lock:status": lockStatusCommand,
  "migrate:status": migrateStatusCommand,
  "migrate:plan": migratePlanCommand,
  "migrate:apply": migrateApplyCommand,
  "seed:status": seedStatusCommand,
  "seed:plan": seedPlanCommand,
  "seed:apply": seedApplyCommand,
  "seed:verify": seedVerifyCommand,
  "schema:ensure": schemaEnsureCommand,
};

const mainCommand = define({
  name: "dbctl",
  description: "Agent-first database control plane",
  run: () => {
    emit(
      success(
        "dbctl",
        {
          description:
            "Agent-first database control plane for mobility backend",
          commands: Object.entries(commands).map(([name, cmd]) => ({
            name: `dbctl ${name}`,
            description: cmd.description ?? "",
          })),
        },
        0,
        Object.entries(commands).map(([name, cmd]) => ({
          command: `dbctl ${name}`,
          description: cmd.description ?? "",
        }))
      )
    );
  },
});

await cli(process.argv.slice(2), mainCommand, {
  name: "dbctl",
  version: "0.1.0",
  subCommands: commands,
});
