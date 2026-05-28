/**
 * @fileoverview Dispatches validated Playwright skill CLI command tokens to the matching async `run*Main` script runners.
 *
 * Primary routing surface for `playwright-skill-cli.ts` after `parsePlaywrightSkillCliCommandHead` validates the command head.
 *
 * @example
 * ```typescript
 * import { dispatchPlaywrightSkillCli } from "./playwright-skill-cli-dispatch.js";
 * import { PLAYWRIGHT_SKILL_CLI_COMMAND } from "./lib/playwright-skill-cli-commands.js";
 * await dispatchPlaywrightSkillCli(PLAYWRIGHT_SKILL_CLI_COMMAND.PRINT_TARGETS, process.argv.slice(2));
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-skill-cli.ts --help
 * @see playwright/scripts/lib/playwright-skill-cli-commands.ts - Command token literals and head parsing.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import {
  PLAYWRIGHT_SKILL_CLI_COMMAND,
  type PlaywrightSkillCliCommand,
} from "./lib/playwright-skill-cli-commands.js";
import { runPlaywrightCliMain } from "./playwright-cli.js";
import { runFinalizePlaywrightSessionMain } from "./finalize-playwright-session.js";
import { runPlaywrightEvidenceManifestInitMain } from "./playwright-evidence-manifest-init.js";
import { runPlaywrightSessionBootstrapMain } from "./playwright-session-bootstrap.js";
import { runPrintPlaywrightTargetsMain } from "./print-playwright-targets.js";

/**
 * Routes a validated command to the async main handler, forwarding argv for per-command `node:util` `parseArgs` consumption.
 *
 * @remarks
 * All runners are invoked via `tsx` directly to avoid module-resolution surprises.
 * The `never` exhaustive check on the default branch ensures compile-time exhaustiveness
 * when a new command variant is added to `PLAYWRIGHT_SKILL_CLI_COMMAND`.
 *
 * @example
 * ```ts
 * await dispatchPlaywrightSkillCli(cmd, argv.slice(2));
 * ```
 */
export async function dispatchPlaywrightSkillCli(command: PlaywrightSkillCliCommand, argv: string[]): Promise<void> {
  switch (command) {
    case PLAYWRIGHT_SKILL_CLI_COMMAND.CLI:
      await runPlaywrightCliMain(argv);
      return;
    case PLAYWRIGHT_SKILL_CLI_COMMAND.SESSION_BOOTSTRAP:
      await runPlaywrightSessionBootstrapMain(argv);
      return;
    case PLAYWRIGHT_SKILL_CLI_COMMAND.EVIDENCE_MANIFEST_INIT:
      await runPlaywrightEvidenceManifestInitMain(argv);
      return;
    case PLAYWRIGHT_SKILL_CLI_COMMAND.FINALIZE_SESSION:
      await runFinalizePlaywrightSessionMain(argv);
      return;
    case PLAYWRIGHT_SKILL_CLI_COMMAND.PRINT_TARGETS:
      await runPrintPlaywrightTargetsMain(argv);
      return;
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}
