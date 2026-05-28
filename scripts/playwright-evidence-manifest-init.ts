#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Playwright evidence manifest initializer CLI. Owns argv parsing for
 * `--session-dir`, `--task-id`, and `--source-url` before delegating manifest creation
 * to the session library. Agent-facing entry point for initializing or overwriting a
 * session evidence manifest JSON.
 *
 * Flow: argv -> parseArgs -> resolveRepositoryRoot -> initializeEvidenceManifest -> formatted message to stdout.
 *
 * @example
 * ```ts
 * runPlaywrightEvidenceManifestInitMain(["--session-dir", ".playwright-sessions/demo", "--task-id", "TST-1"]);
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-evidence-manifest-init.ts --session-dir .playwright-sessions/test --task-id TST-1
 * @see playwright/scripts/lib/playwright-session.ts - Session library that owns manifest creation logic invoked by this CLI.
 * @see playwright/scripts/playwright-session-bootstrap.ts - Full session bootstrapper that also initializes evidence manifests during session setup.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { parseArgs } from "node:util";

import { isExecutedAsPlaywrightSkillMainModule } from "./lib/playwright-skill-script-entry.js";
import {
  formatManifestInitMessage,
  initializeEvidenceManifest,
  resolveRepositoryRoot,
} from "./lib/playwright-session.js";

/**
 * Parses evidence-manifest-init argv and creates or refreshes the session evidence manifest JSON under `--session-dir`.
 *
 * @remarks
 * Requires `--session-dir`; honors `--overwrite`, `--task-id`, and `--source-url` for manifest metadata passed to `initializeEvidenceManifest`.
 *
 * @example
 * ```ts
 * runPlaywrightEvidenceManifestInitMain(["--session-dir", ".playwright-sessions/demo", "--task-id", "TST-1"]);
 * ```
 */
export function runPlaywrightEvidenceManifestInitMain(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      overwrite: {
        type: "boolean",
      },
      "session-dir": {
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

  if (typeof values["session-dir"] !== "string" || values["session-dir"].length === 0) {
    throw new Error("Error: --session-dir is required");
  }

  const repoRoot = resolveRepositoryRoot({
    commandMissingMessage: "Error: git is required but not found on PATH.",
    resolveFailureMessage: "Error: unable to resolve repository root.",
  });

  const result = initializeEvidenceManifest(repoRoot, {
    overwrite: values.overwrite === true,
    sessionDir: values["session-dir"],
    sourceUrl: typeof values["source-url"] === "string" ? values["source-url"] : "",
    taskId: typeof values["task-id"] === "string" ? values["task-id"] : "N/A",
  });

  console.log(formatManifestInitMessage(result));
}

/**
 * Direct CLI entry: forwards argv after the Node/binary prefix to `runPlaywrightEvidenceManifestInitMain`.
 *
 * @remarks
 * Only invoked when this module is executed as the Playwright skill main module; failures are handled by the surrounding `try/catch` (stderr message, exit code 1).
 */
function main(): void {
  runPlaywrightEvidenceManifestInitMain(process.argv.slice(2));
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
