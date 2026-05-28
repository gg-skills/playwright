#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Playwright skill CLI entrypoint that parses argv, validates the command head, and
 * dispatches to the matching async runner.
 *
 * This file owns the unified CLI surface for all Playwright skill scripts. Runners are loaded
 * lazily through the dispatch layer to keep startup cost minimal.
 * Flow: argv -> parse/validate command head -> dispatch to runner -> runner consumes remaining args.
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-skill-cli.ts --help
 * @see playwright/scripts/lib/playwright-skill-cli-commands.ts - Command token definitions and head-parsing logic consumed by this CLI entrypoint.
 * @see playwright/scripts/playwright-skill-cli-dispatch.ts - Dispatch router that forwards validated commands to the individual runner scripts.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import {
  formatPlaywrightSkillCliUsage,
  parsePlaywrightSkillCliCommandHead,
} from "./lib/playwright-skill-cli-commands.js";
import { dispatchPlaywrightSkillCli } from "./playwright-skill-cli-dispatch.js";

/**
 * Parses argv for help vs command head, then dispatches the matched Playwright skill runner.
 *
 * @remarks
 * Help paths print usage and return synchronously. Dispatch runs asynchronously; rejected runners
 * print to stderr and exit with code 1. Uncaught synchronous errors propagate to the module-level
 * try/catch wrapper.
 */
function main(): void {
  const argv = process.argv.slice(2);
  const head = argv[0];

  if (head === undefined || head === "-h" || head === "--help") {
    console.log(formatPlaywrightSkillCliUsage());
    return;
  }

  let command;
  try {
    command = parsePlaywrightSkillCliCommandHead(head);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "help") {
      console.log(formatPlaywrightSkillCliUsage());
      return;
    }
    throw error;
  }

  const rest = argv.slice(1);
  dispatchPlaywrightSkillCli(command, rest).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
