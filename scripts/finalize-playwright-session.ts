#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Playwright session finalizer CLI that publishes timestamped session directories as scoped artifacts.
 *
 * This file owns session directory resolution (latest or explicit) and delegates artifact publishing to the shared finalize-scoped-artifact helper.
 * Flow: argv -> resolveSessionDir -> publishScopedArtifacts -> JSON result to stdout.
 *
 * @example
 * ```ts
 * runFinalizePlaywrightSessionMain(["--latest", "--dry-run"]);
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/finalize-playwright-session.ts --latest --dry-run
 * @see playwright/scripts/playwright-session-bootstrap.ts - Session bootstrapper that creates the directories this finalizer publishes.
 * @see scripts/shared/finalize-scoped-artifact.ts - Shared scoped-artifact publisher invoked by this CLI to commit session directories.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { getRepoRoot, publishScopedArtifacts } from "../../../scripts/shared/finalize-scoped-artifact";

import { isExecutedAsPlaywrightSkillMainModule } from "./lib/playwright-skill-script-entry.js";

const SESSION_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}-/;

/**
 * Picks the newest timestamp-prefixed session directory under the `.playwright-sessions` root.
 *
 * @remarks
 * Synchronously scans `rootDir` (expected to be `<repo>/.playwright-sessions`), keeps only directories whose names start with an ISO date prefix, sorts by name descending so the first entry is the newest session, and returns a repo-relative path `.playwright-sessions/<dirName>`.
 *
 * @throws Error When no directories match the timestamp pattern.
 */
function resolveLatestSessionDir(rootDir: string): string {
  const entries = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SESSION_DIRECTORY_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  if (entries.length === 0) {
    throw new Error("No timestamped Playwright session directories were found.");
  }

  return path.join(".playwright-sessions", entries[0]);
}

/**
 * Normalizes the CLI-selected session into a repo-relative POSIX path for artifact publishing.
 *
 * @remarks
 * When `latest` is true, delegates to `resolveLatestSessionDir` under `.playwright-sessions`. Otherwise resolves an explicit `sessionDir` against `repoRoot` and returns a forward-slash path suitable for `publishScopedArtifacts`.
 *
 * @throws Error When `latest` is not set and `sessionDir` is missing or whitespace-only.
 */
function resolveSessionDir(repoRoot: string, sessionDir?: string, latest?: boolean): string {
  const sessionsRoot = path.join(repoRoot, ".playwright-sessions");
  if (latest === true) {
    return resolveLatestSessionDir(sessionsRoot);
  }

  if (typeof sessionDir !== "string" || sessionDir.trim().length === 0) {
    throw new Error("Provide --session-dir or use --latest.");
  }

  return path.relative(repoRoot, path.resolve(repoRoot, sessionDir)).replace(/\\/g, "/");
}

/**
 * Parses finalize-session argv and publishes the scoped Playwright session directory (git commit unless `--dry-run`).
 *
 * @remarks
 * Resolves `--session-dir` relative to repo root or picks the newest timestamped folder under `.playwright-sessions` when `--latest` is set.
 * Emits JSON from `publishScopedArtifacts` on stdout for automation callers.
 *
 * @example
 * ```ts
 * runFinalizePlaywrightSessionMain(["--latest", "--dry-run"]);
 * ```
 */
export function runFinalizePlaywrightSessionMain(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      "commit-message": { type: "string" },
      "dry-run": { type: "boolean" },
      latest: { type: "boolean" },
      "session-dir": { type: "string" },
    },
    allowPositionals: false,
  });

  const repoRoot = getRepoRoot(process.cwd());
  const sessionDir = resolveSessionDir(
    repoRoot,
    typeof values["session-dir"] === "string" ? values["session-dir"] : undefined,
    values.latest === true,
  );

  const commitMessage =
    typeof values["commit-message"] === "string" && values["commit-message"].trim().length > 0
      ? values["commit-message"].trim()
      : `docs(playwright): publish ${path.basename(sessionDir)}`;

  const result = publishScopedArtifacts({
    repoRoot,
    scopePaths: [sessionDir],
    commitMessage,
    dryRun: values["dry-run"] === true,
  });

  console.log(JSON.stringify(result, null, 2));
}

/**
 * Executable CLI shim: passes process argv after the script name into `runFinalizePlaywrightSessionMain`.
 *
 * @remarks
 * Used only when this file is launched as the skill main module; errors are handled by the surrounding `try`/`catch` at the import-meta gate.
 */
function main(): void {
  runFinalizePlaywrightSessionMain(process.argv.slice(2));
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
