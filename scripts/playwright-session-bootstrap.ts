#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Playwright session bootstrap CLI. Owns argv parsing for
 * `--session-name`, `--task-id`, and `--source-url` before delegating to the session
 * library for directory creation and manifest initialization. Agent-facing entry point
 * for creating a new timestamped Playwright session directory.
 *
 * Flow: argv -> parseArgs -> resolveRepositoryRoot -> initializePlaywrightSession -> manifest message + optional guidance to stdout.
 *
 * @example
 * ```ts
 * runPlaywrightSessionBootstrapMain(["--session-name", "smoke-test", "--task-id", "TST-1"]);
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-session-bootstrap.ts --session-name smoke-test --task-id TST-1
 * @see playwright/scripts/lib/playwright-session.ts - Session library that owns directory creation and manifest initialization invoked by this CLI.
 * @see playwright/scripts/finalize-playwright-session.ts - Finalizer that publishes session directories created by this bootstrapper.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { parseArgs } from "node:util";

import { isExecutedAsPlaywrightSkillMainModule } from "./lib/playwright-skill-script-entry.js";
import {
  formatManifestInitMessage,
  initializePlaywrightSession,
  resolveRepositoryRoot,
} from "./lib/playwright-session.js";

/**
 * Parses session-bootstrap argv and creates a timestamped session directory with an initialized evidence manifest.
 *
 * @remarks
 * Delegates directory layout and manifest creation to `initializePlaywrightSession`; prints manifest guidance unless `--no-export` suppresses it.
 *
 * @example
 * ```ts
 * runPlaywrightSessionBootstrapMain(["--session-name", "smoke-test", "--task-id", "TST-1"]);
 * ```
 */
export function runPlaywrightSessionBootstrapMain(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      "no-export": {
        type: "boolean",
      },
      "session-name": {
        type: "string",
      },
      "source-url": {
        type: "string",
      },
      "task-id": {
        type: "string",
      },
    },
    strict: true,
  });

  const repoRoot = resolveRepositoryRoot({
    commandMissingMessage: "Error: git is required but not found on PATH.",
    resolveFailureMessage: "Error: unable to resolve repository root.",
  });

  const result = initializePlaywrightSession(repoRoot, {
    printExport: values["no-export"] !== true,
    sessionName:
      typeof values["session-name"] === "string"
        ? values["session-name"]
        : "session-name-selfexplanatory",
    sourceUrl: typeof values["source-url"] === "string" ? values["source-url"] : "",
    taskId: typeof values["task-id"] === "string" ? values["task-id"] : "N/A",
  });

  console.log(formatManifestInitMessage(result.manifestInitResult));
  if (typeof result.guidanceText === "string") {
    console.log(result.guidanceText);
  }
}

/**
 * CLI process entry that forwards argv after the Node executable and script path to the bootstrap runner.
 *
 * @remarks
 * Invoked only from the `import.meta.url` main guard; keeps argv slicing at the executable boundary.
 */
function main(): void {
  runPlaywrightSessionBootstrapMain(process.argv.slice(2));
}

if (isExecutedAsPlaywrightSkillMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
