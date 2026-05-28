#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Playwright CLI wrapper entrypoint with guardrails for headed mode, filename
 * validation, and session scoping.
 *
 * This file owns the top-level CLI flow that validates prerequisites, applies guardrails, and
 * delegates to the Playwright MCP command.
 * Flow: argv -> inspectWrapperArgs -> validate guardrails -> buildPlaywrightCliCommand -> runDelegatedCommand.
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-cli.ts --help
 * @see playwright/scripts/lib/playwright-cli-guardrails.ts - Guardrail logic for headed mode, filename, and session flag validation used by this entrypoint.
 * @see playwright/SKILL.md - Skill workflows that invoke this CLI wrapper for Playwright MCP sessions.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { execFileSync } from "node:child_process";

import {
  assertHeadedAllowed,
  buildPlaywrightCliCommand,
  ensureResolvedOutputDir,
  inspectWrapperArgs,
  runDelegatedCommand,
  validateFilename,
} from "./lib/playwright-cli-guardrails.js";
import { isExecutedAsPlaywrightSkillMainModule } from "./lib/playwright-skill-script-entry.js";
import { ensureSessionsRoot, resolveRepositoryRoot } from "./lib/playwright-session.js";

/**
 * Probes PATH for an executable before the wrapper depends on it.
 *
 * @remarks
 * Runs a silenced `--version` subprocess check; any probe failure surfaces as the caller-supplied
 * message so prerequisite errors stay actionable in CLI output.
 *
 * @param command - Executable invoked for the probe (for example `npx`).
 * @param missingMessage - Error message thrown when the probe fails.
 * @throws Error when the version probe fails (missing binary or non-zero exit).
 */
function ensureCommandAvailable(command: string, missingMessage: string): void {
  try {
    execFileSync(command, ["--version"], {
      stdio: "ignore",
    });
  } catch {
    throw new Error(missingMessage);
  }
}

/**
 * Runs the Playwright CLI wrapper with guardrails.
 *
 * @remarks
 * Validates prerequisites (npx, git repo), resolves the session output directory, applies
 * headed-mode and filename guardrails, then delegates to the Playwright MCP command.
 * This function does not return; it either exits the process via {@link runDelegatedCommand}
 * or throws on validation failure.
 *
 * @param argv - Raw CLI arguments excluding `node` and the script path.
 */
export function runPlaywrightCliMain(argv: string[]): never {
  ensureCommandAvailable("npx", "Error: npx is required but not found on PATH.");

  const repoRoot = resolveRepositoryRoot({
    commandMissingMessage: "Error: git is required but not found on PATH.",
    resolveFailureMessage: "Error: unable to resolve repository root. Run this script from inside the repo.",
  });
  const sessionsRoot = ensureSessionsRoot(repoRoot);
  const args = argv;
  const inspection = inspectWrapperArgs(args);

  let resolvedOutputDir: string | null = null;
  if (inspection.isOpenCommand || inspection.filenameValue.length > 0) {
    resolvedOutputDir = ensureResolvedOutputDir(
      sessionsRoot,
      process.env.PLAYWRIGHT_MCP_OUTPUT_DIR,
    );
  }

  if (inspection.hasHeadedFlag) {
    assertHeadedAllowed(process.env.PLAYWRIGHT_CLI_ALLOW_HEADED);
  }

  if (inspection.filenameValue.length > 0 && resolvedOutputDir !== null) {
    validateFilename(inspection.filenameValue, resolvedOutputDir);
  }

  const command = buildPlaywrightCliCommand(
    args,
    process.env.PLAYWRIGHT_CLI_SESSION,
    inspection.hasSessionFlag,
  );

  return runDelegatedCommand(command.command, command.args, process.env);
}

/**
 * Invokes {@link runPlaywrightCliMain} with user-supplied argv after stripping the runtime prefix.
 *
 * @remarks
 * Slices `process.argv` from index 2 onward so only post-`node`/script tokens reach guardrails and
 * delegation; typed `never` because the callee exits the process or throws.
 */
function main(): never {
  return runPlaywrightCliMain(process.argv.slice(2));
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
