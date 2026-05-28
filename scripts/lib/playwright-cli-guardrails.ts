/**
 * @fileoverview Playwright CLI guardrail helpers for wrapper argv inspection, risky-flag blocking, and session-folder validation before spawning Playwright.
 *
 * This file owns argv inspection, output-directory guardrails, and command assembly for the Playwright CLI wrapper.
 *
 * @example
 * ```ts
 * const inspection = inspectWrapperArgs(["--session", "demo"]);
 * ```
 *
 * @testing CLI manual: npx tsx playwright/scripts/playwright-cli.ts --help
 * @see playwright/scripts/playwright-cli.ts - Wrapper entrypoint that applies these guardrails before delegating to Playwright.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SESSION_FOLDER_PATTERN } from "./playwright-session.js";

/** Inspection result from parsing Playwright CLI wrapper arguments; records which flags are present. */
export type WrapperInspection = {
  filenameValue: string;
  hasHeadedFlag: boolean;
  hasSessionFlag: boolean;
  isOpenCommand: boolean;
};

/**
 * Parses a Playwright CLI argument array and returns a `WrapperInspection` describing
 * which session-related flags (`--headed`, `--session`, `open`) and `--filename` value are present.
 */
export function inspectWrapperArgs(args: string[]): WrapperInspection {
  let filenameValue = "";
  let expectFilenameValue = false;
  let hasHeadedFlag = false;
  let hasSessionFlag = false;
  let isOpenCommand = false;

  for (const arg of args) {
    if (expectFilenameValue) {
      filenameValue = arg;
      expectFilenameValue = false;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    switch (arg) {
      case "--filename":
        expectFilenameValue = true;
        continue;
      case "--headed":
        hasHeadedFlag = true;
        continue;
      case "--session":
      case "-s":
        hasSessionFlag = true;
        expectFilenameValue = false;
        continue;
      case "open":
        isOpenCommand = true;
        continue;
      default:
        if (arg.startsWith("--filename=")) {
          filenameValue = arg.slice("--filename=".length);
          continue;
        }
        if (arg.startsWith("--session=") || arg.startsWith("-s=")) {
          hasSessionFlag = true;
          continue;
        }
    }
  }

  return {
    filenameValue,
    hasHeadedFlag,
    hasSessionFlag,
    isOpenCommand,
  };
}

/**
 * Validates that `PLAYWRIGHT_MCP_OUTPUT_DIR` is set, points to a single session folder under `sessionsRoot`,
 * and that the session folder name matches the expected date prefix pattern.
 * Creates the directory if missing and returns the resolved absolute path.
 */
export function ensureResolvedOutputDir(
  sessionsRoot: string,
  outputDirEnvValue: string | undefined,
): string {
  if (typeof outputDirEnvValue !== "string" || outputDirEnvValue.length === 0) {
    throw new Error(`Error: PLAYWRIGHT_MCP_OUTPUT_DIR is required for Playwright session commands that open or save artifacts.

Use the canonical bootstrap command:
  npm run playwright:session:bootstrap -- --session-name "<self-explanatory-session-name>"
Then export the printed PLAYWRIGHT_MCP_OUTPUT_DIR value.`);
  }

  fs.mkdirSync(outputDirEnvValue, { recursive: true });
  const resolvedOutputDir = fs.realpathSync.native(outputDirEnvValue);
  const relativePath = path.relative(sessionsRoot, resolvedOutputDir);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Error: PLAYWRIGHT_MCP_OUTPUT_DIR must be under:
  ${sessionsRoot}/YYYY-MM-DD-session-name-selfexplanatory
Current value:
  ${resolvedOutputDir}`);
  }

  if (relativePath.length === 0 || relativePath.includes(path.sep)) {
    throw new Error(`Error: PLAYWRIGHT_MCP_OUTPUT_DIR must point to exactly one session folder under:
  ${sessionsRoot}
Current value:
  ${resolvedOutputDir}`);
  }

  const sessionName = path.basename(resolvedOutputDir);
  if (!SESSION_FOLDER_PATTERN.test(sessionName)) {
    throw new Error(`Error: session folder name must match:
  YYYY-MM-DD-session-name-selfexplanatory
Current session folder:
  ${sessionName}`);
  }

  return resolvedOutputDir;
}

/**
 * Asserts that `--headed` is allowed by checking `PLAYWRIGHT_CLI_ALLOW_HEADED`.
 * Throws with guidance to set the env var if headed mode is disabled.
 */
export function assertHeadedAllowed(value: string | undefined): void {
  switch (value) {
    case "1":
    case "true":
    case "TRUE":
    case "yes":
    case "YES":
      return;
    default:
      throw new Error(`Error: --headed is disabled by default for this repository.

Playwright CLI sessions are expected to run headless in the background unless you intentionally opt in.
If you really want a visible browser window for a manual debugging run, re-run with:
  PLAYWRIGHT_CLI_ALLOW_HEADED=1`);
  }
}

/**
 * Validates that `filenameValue` is session-relative, does not escape the session folder,
 * and includes a subfolder component. Creates the target subdirectory and returns its absolute path.
 */
export function validateFilename(filenameValue: string, resolvedOutputDir: string): string {
  if (filenameValue.startsWith("/")) {
    throw new Error(`Error: --filename must be session-relative, not absolute.
Current value:
  ${filenameValue}`);
  }

  if (
    filenameValue === "." ||
    filenameValue === ".." ||
    filenameValue.endsWith("/..") ||
    filenameValue.startsWith("../") ||
    filenameValue.includes("/../")
  ) {
    throw new Error(`Error: --filename may not escape the active session folder.
Current value:
  ${filenameValue}`);
  }

  const filenameDir = path.dirname(filenameValue);
  if (filenameDir === ".") {
    throw new Error(`Error: --filename must include a session-relative subfolder such as:
  screenshots/01-home.png
  snapshots/01-home.yml
Current value:
  ${filenameValue}`);
  }

  const targetDirectory = path.join(resolvedOutputDir, filenameDir);
  fs.mkdirSync(targetDirectory, { recursive: true });
  return targetDirectory;
}

/**
 * Builds the final Playwright CLI command array, injecting `--session` from `fallbackSession`
 * when not already present, and prefixing with `--yes --package @playwright/cli`.
 */
export function buildPlaywrightCliCommand(
  args: string[],
  fallbackSession: string | undefined,
  hasSessionFlag: boolean,
): { args: string[]; command: string } {
  const commandArgs = ["--yes", "--package", "@playwright/cli", "playwright-cli"];
  if (!hasSessionFlag && typeof fallbackSession === "string" && fallbackSession.length > 0) {
    commandArgs.push("--session", fallbackSession);
  }
  commandArgs.push(...args);

  return {
    args: commandArgs,
    command: "npx",
  };
}

/**
 * Spawns a delegated command synchronously with the supplied env, inheriting stdio.
 * Throws on spawn error, and exits the process on non-zero exit or signal.
 */
export function runDelegatedCommand(command: string, args: string[], env: NodeJS.ProcessEnv): never {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
  });

  if (typeof result.error !== "undefined") {
    throw result.error;
  }

  if (typeof result.signal === "string") {
    process.kill(process.pid, result.signal);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
