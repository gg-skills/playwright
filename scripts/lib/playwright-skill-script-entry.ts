/**
 * @fileoverview Detects direct script execution so Playwright skill modules can be imported
 * without side effects.
 *
 * This file owns the `import.meta.url` vs `process.argv[1]` comparison guard used by Playwright
 * CLI skill scripts to decide whether to run main logic or remain side-effect free when imported.
 *
 * @example
 * ```typescript
 * import { isExecutedAsPlaywrightSkillMainModule } from "./playwright-skill-script-entry.js";
 * if (isExecutedAsPlaywrightSkillMainModule(import.meta.url)) {
 *   // run CLI logic
 * }
 * ```
 *
 * @testing CLI: npx tsx playwright/scripts/playwright-skill-cli.ts --help
 * @see playwright/scripts/playwright-cli.ts - Playwright CLI wrapper entrypoint that imports this guard to conditionally execute its main flow.
 * @see playwright/scripts/playwright-skill-cli.ts - Unified TypeScript CLI for Playwright skill scripts that imports this guard to conditionally execute main logic.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns true when the importing module is the main script entry point (direct execution).
 *
 * @remarks
 * Compares the `import.meta.url`-derived file path against `process.argv[1]` to detect
 * whether this module is the process entry point versus being imported as a library.
 *
 * @param importMetaUrl - URL of the module being tested, typically `import.meta.url`.
 *
 * @example
 * ```ts
 * if (isExecutedAsPlaywrightSkillMainModule(import.meta.url)) {
 *   await runMain(process.argv.slice(2));
 * }
 * ```
 */
export function isExecutedAsPlaywrightSkillMainModule(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (typeof entry !== "string" || entry.length === 0) {
    return false;
  }

  try {
    return fileURLToPath(importMetaUrl) === path.resolve(entry);
  } catch {
    return false;
  }
}
