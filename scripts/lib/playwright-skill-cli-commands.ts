/**
 * @fileoverview Stable command tokens, type guard, parser, and usage formatter for the
 * Playwright skill unified CLI router.
 *
 * Owned by the `playwright` scripts library. Agents import
 * these literals to dispatch or validate Playwright skill CLI commands without spelling
 * raw strings.
 *
 * @example
 * ```typescript
 * import { PLAYWRIGHT_SKILL_CLI_COMMAND, parsePlaywrightSkillCliCommandHead } from "./playwright-skill-cli-commands.js";
 * const cmd = parsePlaywrightSkillCliCommandHead(process.argv[2]);
 * ```
 *
 * @testing Manual CLI invocation: npx tsx playwright/scripts/playwright-skill-cli.ts --help
 * @see playwright/scripts/playwright-skill-cli.ts - Unified router entrypoint.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

/**
 * Stable string tokens for the unified Playwright skill CLI router (`playwright-skill-cli.ts`).
 *
 * @remarks
 * Compare against these literals instead of spelling raw strings so exhaustiveness checks stay aligned with `dispatchPlaywrightSkillCli`.
 */
export const PLAYWRIGHT_SKILL_CLI_COMMAND = {
  CLI: "cli",
  SESSION_BOOTSTRAP: "session-bootstrap",
  EVIDENCE_MANIFEST_INIT: "evidence-manifest-init",
  FINALIZE_SESSION: "finalize-session",
  PRINT_TARGETS: "print-targets",
} as const;

/**
 * Union of command heads accepted after the script name when invoking the Playwright skill CLI.
 */
export type PlaywrightSkillCliCommand =
  (typeof PLAYWRIGHT_SKILL_CLI_COMMAND)[keyof typeof PLAYWRIGHT_SKILL_CLI_COMMAND];

const PLAYWRIGHT_SKILL_CLI_COMMAND_SET: ReadonlySet<string> = new Set(
  Object.values(PLAYWRIGHT_SKILL_CLI_COMMAND),
);

/**
 * Returns true when `value` is one of the `PLAYWRIGHT_SKILL_CLI_COMMAND` string literals.
 *
 * @remarks
 * Uses a precomputed `Set` for O(1) lookup; safe for untrusted argv fragments.
 */
export function isPlaywrightSkillCliCommand(value: string): value is PlaywrightSkillCliCommand {
  return PLAYWRIGHT_SKILL_CLI_COMMAND_SET.has(value);
}

/**
 * Parses the first CLI token into a validated `PlaywrightSkillCliCommand`.
 *
 * @remarks
 * Throws `new Error("help")` when the user passes `-h` or `--help` so the router can emit usage.
 * Throws an `Error` with an informative message when the token is missing or not a known command literal.
 *
 * @param token - Raw first positional argument (often `process.argv[2]` when the process is `npx tsx .../playwright-skill-cli.ts`).
 *
 * @example
 * ```ts
 * parsePlaywrightSkillCliCommandHead(process.argv[2]);
 * ```
 */
export function parsePlaywrightSkillCliCommandHead(
  token: string | undefined,
): PlaywrightSkillCliCommand {
  if (token === undefined || token.length === 0) {
    throw new Error("Missing command. Pass one of the PLAYWRIGHT_SKILL_CLI_COMMAND literals.");
  }
  if (token === "-h" || token === "--help") {
    throw new Error("help");
  }
  if (!isPlaywrightSkillCliCommand(token)) {
    throw new Error(`Unknown command: ${token}`);
  }
  return token;
}

/**
 * Multi-line `--help` usage text listing stable command tokens for the Playwright skill CLI.
 *
 * @remarks
 * Wording mirrors the `dispatchPlaywrightSkillCli` switch so operators see the same command names the router accepts.
 *
 * @example
 * ```ts
 * console.log(formatPlaywrightSkillCliUsage());
 * ```
 */
export function formatPlaywrightSkillCliUsage(): string {
  return [
    "Usage: npx tsx scripts/playwright-skill-cli.ts <command> [options]",
    "",
    "Commands:",
    `  ${PLAYWRIGHT_SKILL_CLI_COMMAND.CLI}                    Delegated Playwright CLI wrapper (guardrails)`,
    `  ${PLAYWRIGHT_SKILL_CLI_COMMAND.SESSION_BOOTSTRAP}      Initialize a dated session folder + manifests`,
    `  ${PLAYWRIGHT_SKILL_CLI_COMMAND.EVIDENCE_MANIFEST_INIT} Refresh evidence manifest for a session dir`,
    `  ${PLAYWRIGHT_SKILL_CLI_COMMAND.FINALIZE_SESSION}      Publish scoped session artifacts`,
    `  ${PLAYWRIGHT_SKILL_CLI_COMMAND.PRINT_TARGETS}         Print env-aware Playwright target URLs`,
  ].join("\n");
}
