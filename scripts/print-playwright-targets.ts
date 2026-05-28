/**
 * @fileoverview Config-driven Playwright target printer CLI. Reads target definitions
 * from a `.playwright-targets.json` file in the host project root (consumer-supplied),
 * or from `--target name=URL` flags / the `PLAYWRIGHT_TARGETS` env var, then emits
 * human, JSON, or shell-export output.
 *
 * Ownership: config discovery, target normalization, shell-export formatting.
 * Flow: argv → resolveRepositoryRoot → loadTargets → build PlaywrightTargetReport
 *       → stdout (--shell | --json | human).
 *
 * ## Consumer setup
 * Consumers must provide one of the following in their host project:
 *
 * **Option A – config file** (recommended):
 * Create `.playwright-targets.json` in the repository root:
 * ```json
 * {
 *   "targets": {
 *     "WEBSITE": "https://localhost:3000",
 *     "API":     "https://localhost:4000",
 *     "APP":     "https://localhost:5000"
 *   }
 * }
 * ```
 * Each key becomes `PLAYWRIGHT_TARGET_<KEY>_URL` when the shell export form is used.
 *
 * **Option B – env var**:
 * Export `PLAYWRIGHT_TARGETS` as a semicolon-separated `name=URL` list before running:
 * ```bash
 * export PLAYWRIGHT_TARGETS="WEBSITE=https://localhost:3000;API=https://localhost:4000"
 * ```
 *
 * **Option C – flags**:
 * Pass `--target name=URL` one or more times:
 * ```bash
 * npx tsx scripts/print-playwright-targets.ts --target WEBSITE=https://localhost:3000 --shell
 * ```
 *
 * Sources are merged in priority order: flags > env var > config file (flags win).
 *
 * @example
 * ```ts
 * runPrintPlaywrightTargetsMain(["--json"]);
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/print-playwright-targets.ts --json
 * @see playwright/scripts/playwright-cli.ts - Playwright CLI wrapper that consumes the resolved target URLs at session time.
 * @see playwright/SKILL.md - Skill workflows that call this target printer before launching Playwright sessions.
 * @documentation reviewed=2026-05-17 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { isExecutedAsPlaywrightSkillMainModule } from "./lib/playwright-skill-script-entry.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Labels which upstream artifact supplied the Playwright base URLs. */
type PlaywrightTargetSource = "config-file" | "env-var" | "flags" | "merged";

/**
 * Flat map of logical target names → resolved URL strings.
 * Keys are upper-cased identifiers like "WEBSITE" or "API".
 */
type PlaywrightTargetMap = Record<string, string>;

/**
 * Structured snapshot printed as JSON or summarized for human and shell consumers.
 */
type PlaywrightTargetReport = {
  runAt: string;
  repositoryRoot: string;
  /** Primary resolution mechanism that produced the targets (may be "merged" when multiple sources contributed). */
  source: PlaywrightTargetSource;
  /** Absolute path consulted for config-file resolution (may not exist when using other sources). */
  configFilePath: string;
  /** Resolved targets as a key→URL map. */
  targets: PlaywrightTargetMap;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the git repository root for the current working directory.
 *
 * @remarks
 * Invokes `git rev-parse --show-toplevel` synchronously; callers inherit git availability
 * and cwd semantics from the CLI process.
 */
const resolveRepositoryRoot = (): string =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();

/**
 * Narrows arbitrary parsed JSON values to plain object records for field extraction.
 *
 * @remarks
 * PURE: no I/O; used only to gate structured reads after `JSON.parse`.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Parses a `name=URL` pair into a `[name, url]` tuple or returns null when malformed.
 *
 * @remarks
 * Names are upper-cased before storage so `website=…` and `WEBSITE=…` produce the same key.
 */
const parsePair = (pair: string): [string, string] | null => {
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim().toUpperCase();
  const url = pair.slice(eq + 1).trim();
  if (name.length === 0 || url.length === 0) return null;
  return [name, url];
};

/**
 * Reads and validates `.playwright-targets.json` from the repository root.
 *
 * @remarks
 * Returns an empty map (not null) when the config file is absent; throws on parse errors or
 * missing/invalid `targets` field.
 *
 * Expected file shape:
 * ```json
 * { "targets": { "WEBSITE": "https://…", "API": "https://…" } }
 * ```
 */
const readConfigFile = (configFilePath: string): PlaywrightTargetMap => {
  if (!fs.existsSync(configFilePath)) {
    return {};
  }

  const raw = fs.readFileSync(configFilePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[playwright:targets] Failed to parse ${configFilePath} as JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`[playwright:targets] ${configFilePath} must be a JSON object.`);
  }

  const targetsField = parsed.targets;
  if (!isRecord(targetsField)) {
    throw new Error(
      `[playwright:targets] ${configFilePath} must contain a "targets" object. ` +
        `Example: { "targets": { "WEBSITE": "https://localhost:3000" } }`,
    );
  }

  const result: PlaywrightTargetMap = {};
  for (const [key, value] of Object.entries(targetsField)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(
        `[playwright:targets] targets.${key} must be a non-empty string in ${configFilePath}.`,
      );
    }
    result[key.toUpperCase()] = value.trim();
  }

  return result;
};

/**
 * Parses the `PLAYWRIGHT_TARGETS` environment variable (semicolon-separated `name=URL` list).
 *
 * @remarks
 * Returns an empty map when the variable is unset or empty. Invalid pairs are skipped with a
 * warning to stderr so a single typo does not abort the run.
 */
const readEnvVar = (): PlaywrightTargetMap => {
  const raw = process.env["PLAYWRIGHT_TARGETS"];
  if (typeof raw !== "string" || raw.trim().length === 0) return {};

  const result: PlaywrightTargetMap = {};
  for (const segment of raw.split(";")) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) continue;
    const pair = parsePair(trimmed);
    if (pair === null) {
      process.stderr.write(
        `[playwright:targets] warn: ignoring malformed PLAYWRIGHT_TARGETS entry: ${trimmed}\n`,
      );
      continue;
    }
    result[pair[0]] = pair[1];
  }
  return result;
};

/**
 * Parses `--target name=URL` flags from the argv array.
 *
 * @remarks
 * Consumes every `--target <value>` and `--target=<value>` occurrence and returns the
 * accumulated map. Unknown flags are ignored here (they were already filtered upstream or will
 * be ignored by the caller).
 */
const readFlags = (argv: string[]): PlaywrightTargetMap => {
  const result: PlaywrightTargetMap = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let value: string | undefined;

    if (arg === "--target" && argv[i + 1] !== undefined) {
      value = argv[++i];
    } else if (arg !== undefined && arg.startsWith("--target=")) {
      value = arg.slice("--target=".length);
    }

    if (value !== undefined) {
      const pair = parsePair(value);
      if (pair === null) {
        process.stderr.write(
          `[playwright:targets] warn: ignoring malformed --target value: ${value}\n`,
        );
        continue;
      }
      result[pair[0]] = pair[1];
    }
  }
  return result;
};

/**
 * Escapes a string for safe embedding in POSIX `export KEY='...'` lines.
 *
 * @remarks
 * Wraps the value in single quotes and escapes embedded single quotes per shell rules.
 */
const shellQuote = (value: string): string => {
  const escapedValue = value.replace(/'/g, "'\\''");
  return `'${escapedValue}'`;
};

/**
 * Writes `export PLAYWRIGHT_TARGET_<NAME>_URL=…` lines for downstream shell sourcing.
 *
 * @remarks
 * I/O: synchronous writes to `process.stdout`. Emits one export per resolved target, plus
 * metadata exports for `PLAYWRIGHT_TARGET_SOURCE` and `PLAYWRIGHT_TARGET_REPOSITORY_ROOT`.
 */
const printShellExports = (report: PlaywrightTargetReport): void => {
  process.stdout.write(`export PLAYWRIGHT_TARGET_SOURCE=${shellQuote(report.source)}\n`);
  process.stdout.write(
    `export PLAYWRIGHT_TARGET_REPOSITORY_ROOT=${shellQuote(report.repositoryRoot)}\n`,
  );
  for (const [name, url] of Object.entries(report.targets)) {
    process.stdout.write(`export PLAYWRIGHT_TARGET_${name}_URL=${shellQuote(url)}\n`);
  }
};

/**
 * Prints a human-readable, line-oriented summary of the resolved target report.
 *
 * @remarks
 * I/O: uses `console.log` for readable output in interactive shells.
 */
const printHumanReport = (report: PlaywrightTargetReport): void => {
  console.log(`[playwright:targets] source=${report.source}`);
  console.log(`[playwright:targets] repositoryRoot=${report.repositoryRoot}`);
  console.log(`[playwright:targets] configFilePath=${report.configFilePath}`);
  for (const [name, url] of Object.entries(report.targets)) {
    console.log(`[playwright:targets] target.${name}=${url}`);
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Resolves Playwright target URLs from config file, env var, and/or CLI flags, then
 * prints human, JSON, or shell-export output.
 *
 * @remarks
 * Sources are merged with priority: flags > env var > config file (flags win on conflict).
 *
 * @throws When no targets can be resolved from any source.
 *
 * @example
 * ```ts
 * runPrintPlaywrightTargetsMain(["--json"]);
 * ```
 */
export function runPrintPlaywrightTargetsMain(argv: string[]): void {
  const repositoryRoot = resolveRepositoryRoot();
  const configFilePath = path.join(repositoryRoot, ".playwright-targets.json");
  const argSet = new Set(argv);

  // Collect targets from each source.
  const fromConfig = readConfigFile(configFilePath);
  const fromEnv = readEnvVar();
  const fromFlags = readFlags(argv);

  // Merge: flags win over env, env wins over config.
  const merged: PlaywrightTargetMap = { ...fromConfig, ...fromEnv, ...fromFlags };

  if (Object.keys(merged).length === 0) {
    throw new Error(
      "[playwright:targets] No targets found. Provide at least one of:\n" +
        "  1. A .playwright-targets.json file in the repository root.\n" +
        "  2. The PLAYWRIGHT_TARGETS env var (semicolon-separated name=URL pairs).\n" +
        "  3. One or more --target name=URL flags.\n" +
        "See playwright/SKILL.md for details.",
    );
  }

  // Determine which sources contributed (for reporting).
  const activeSources: string[] = [];
  if (Object.keys(fromConfig).length > 0) activeSources.push("config-file");
  if (Object.keys(fromEnv).length > 0) activeSources.push("env-var");
  if (Object.keys(fromFlags).length > 0) activeSources.push("flags");
  const source: PlaywrightTargetSource =
    activeSources.length === 1
      ? (activeSources[0] as PlaywrightTargetSource)
      : "merged";

  const report: PlaywrightTargetReport = {
    runAt: new Date().toISOString(),
    repositoryRoot,
    source,
    configFilePath,
    targets: merged,
  };

  if (argSet.has("--shell")) {
    printShellExports(report);
    return;
  }

  if (argSet.has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  printHumanReport(report);
}

/**
 * CLI entry shim that forwards `process.argv` after the node executable and script path.
 *
 * @remarks
 * Keeps direct execution separate from importable `runPrintPlaywrightTargetsMain` for tests and
 * programmatic reuse.
 */
function main(): void {
  runPrintPlaywrightTargetsMain(process.argv.slice(2));
}

if (isExecutedAsPlaywrightSkillMainModule(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
