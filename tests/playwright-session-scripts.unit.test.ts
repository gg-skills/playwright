#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Regression tests for Playwright session bootstrap and guardrail helpers.
 *
 * Ownership: agent-facing verification surface for `playwright-session.ts` bootstrap,
 * `playwright-cli-guardrails.ts` guardrails, and `playwright-skill-cli.ts` session smoke.
 * Flow: individual test objects → createTempRepo → imported helper invocation → Node.js assert
 * validation → PASS/FAIL console report.
 *
 * @testing CLI: npx tsx playwright/tests/playwright-session-scripts.unit.test.ts
 * @see playwright/scripts/lib/playwright-session.ts - Paired source module under test (bootstrap helpers).
 * @see playwright/scripts/lib/playwright-cli-guardrails.ts - Paired source module under test (guardrail helpers).
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assertHeadedAllowed,
  buildPlaywrightCliCommand,
  ensureResolvedOutputDir,
  inspectWrapperArgs,
  validateFilename,
} from "../scripts/lib/playwright-cli-guardrails.js";
import {
  buildSessionFolderName,
  formatManifestInitMessage,
  initializeEvidenceManifest,
  initializePlaywrightSession,
  resolveRepositoryRoot,
  slugifySessionName,
} from "../scripts/lib/playwright-session.js";

/**
 * Named synchronous test case executed by this file's harness loop.
 *
 * @remarks
 * I/O: none at the type level; `run` may touch temp dirs, git, or the filesystem.
 */
type UnitTest = {
  name: string;
  run: () => void;
};

/**
 * Creates a unique directory under the OS temp dir for isolated test fixtures.
 *
 * @remarks
 * I/O: synchronous `mkdtemp` under `os.tmpdir()`.
 */
function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Initializes a fresh git repository with stable author identity for tests.
 *
 * @remarks
 * I/O: runs `git init` and `git config` via `execFileSync` in `repoRoot`.
 */
function initGitRepo(repoRoot: string): void {
  execFileSync("git", ["init", "-q"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "tests@example.com"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Tests"], { cwd: repoRoot });
}

/**
 * Produces a realpath-resolved temp repository root with git initialized.
 *
 * @remarks
 * I/O: combines `createTempDir`, `initGitRepo`, and `realpathSync.native`.
 */
function createTempRepo(prefix: string): string {
  const repoRoot = createTempDir(prefix);
  initGitRepo(repoRoot);
  return fs.realpathSync.native(repoRoot);
}

/**
 * Asserts `callback` throws an `Error` whose message matches `expectedSnippet` literally.
 *
 * @remarks
 * PURITY: treats `expectedSnippet` as a literal substring; regex metacharacters are escaped.
 */
function expectError(callback: () => void, expectedSnippet: string): void {
  let caught: unknown = null;
  try {
    callback();
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof Error, "Expected an Error to be thrown.");
  assert.match(caught.message, new RegExp(expectedSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const tests: UnitTest[] = [
  {
    name: "slugifySessionName normalizes mixed input",
    run: () => {
      assert.equal(slugifySessionName("Landing Header QA"), "landing-header-qa");
      assert.equal(slugifySessionName("___"), "session-name-selfexplanatory");
    },
  },
  {
    name: "buildSessionFolderName uses local date formatting",
    run: () => {
      const date = new Date(2026, 2, 31, 18, 45, 0);
      assert.equal(
        buildSessionFolderName("Landing Header QA", date),
        "2026-03-31-landing-header-qa",
      );
    },
  },
  {
    name: "initializeEvidenceManifest writes expected files and fields",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-manifest-");
      const now = new Date(Date.UTC(2026, 2, 31, 12, 0, 0));
      const result = initializeEvidenceManifest(
        repoRoot,
        {
          overwrite: false,
          sessionDir: ".playwright-sessions/2026-03-31-landing-header-qa",
          sourceUrl: "https://example.test/landing",
          taskId: "TASK-123",
        },
        now,
      );

      assert.equal(result.kind, "created");
      const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8")) as {
        createdAt: string;
        evidence: Array<{ relativePath: string; sourceUrl: string }>;
        notionEvidenceDraftPath: string;
        sessionRelativePath: string;
        taskId: string;
      };
      assert.equal(manifest.taskId, "TASK-123");
      assert.equal(manifest.createdAt, "2026-03-31T12:00:00Z");
      assert.equal(
        manifest.sessionRelativePath,
        ".playwright-sessions/2026-03-31-landing-header-qa",
      );
      assert.equal(manifest.notionEvidenceDraftPath, "NOTION_EVIDENCE.md");
      assert.equal(manifest.evidence[0]?.relativePath, "01-before-placeholder.png");
      assert.equal(manifest.evidence[1]?.sourceUrl, "https://example.test/landing");

      const notionDraft = fs.readFileSync(result.draftPath, "utf8");
      assert.match(notionDraft, /### Current Screenshots Evidence/);
      assert.match(notionDraft, /### Validation/);
    },
  },
  {
    name: "initializeEvidenceManifest preserves existing manifest without overwrite",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-manifest-existing-");
      const sessionDir = path.join(
        repoRoot,
        ".playwright-sessions",
        "2026-03-31-existing-session",
      );
      fs.mkdirSync(sessionDir, { recursive: true });
      const manifestPath = path.join(sessionDir, "EVIDENCE_MANIFEST.json");
      fs.writeFileSync(manifestPath, "{\"keep\":true}\n");

      const result = initializeEvidenceManifest(repoRoot, {
        overwrite: false,
        sessionDir,
        sourceUrl: "",
        taskId: "N/A",
      });

      assert.equal(result.kind, "exists");
      assert.equal(fs.readFileSync(manifestPath, "utf8"), "{\"keep\":true}\n");
      assert.equal(
        formatManifestInitMessage(result),
        `Manifest already exists: ${fs.realpathSync.native(manifestPath)}`,
      );
    },
  },
  {
    name: "initializePlaywrightSession creates summary and guidance text",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-bootstrap-");
      const now = new Date(2026, 2, 31, 11, 30, 0);
      const result = initializePlaywrightSession(
        repoRoot,
        {
          printExport: true,
          sessionName: "Landing Header QA",
          sourceUrl: "https://example.test/landing",
          taskId: "TASK-456",
        },
        now,
      );

      assert.equal(result.sessionFolderName, "2026-03-31-landing-header-qa");
      assert.equal(result.summaryWasCreated, true);
      assert.match(fs.readFileSync(result.summaryPath, "utf8"), /# Browser Validation Summary/);
      assert.ok(fs.existsSync(path.join(result.sessionAbsPath, "screenshots")));
      assert.ok(fs.existsSync(path.join(result.sessionAbsPath, "snapshots")));
      assert.match(result.guidanceText ?? "", /Session initialized\./);
      assert.match(result.guidanceText ?? "", /export PLAYWRIGHT_MCP_OUTPUT_DIR=/);
    },
  },
  {
    name: "ensureResolvedOutputDir rejects missing env",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-output-missing-");
      const sessionsRoot = path.join(repoRoot, ".playwright-sessions");
      fs.mkdirSync(sessionsRoot, { recursive: true });

      expectError(
        () => ensureResolvedOutputDir(fs.realpathSync.native(sessionsRoot), undefined),
        "PLAYWRIGHT_MCP_OUTPUT_DIR is required",
      );
    },
  },
  {
    name: "ensureResolvedOutputDir rejects nested paths and invalid names",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-output-invalid-");
      const sessionsRootPath = path.join(repoRoot, ".playwright-sessions");
      fs.mkdirSync(sessionsRootPath, { recursive: true });
      const sessionsRoot = fs.realpathSync.native(sessionsRootPath);
      const nested = path.join(sessionsRoot, "2026-03-31-parent", "child");

      expectError(
        () => ensureResolvedOutputDir(sessionsRoot, nested),
        "must point to exactly one session folder",
      );

      const invalid = path.join(sessionsRoot, "bad-name");
      expectError(
        () => ensureResolvedOutputDir(sessionsRoot, invalid),
        "session folder name must match",
      );
    },
  },
  {
    name: "validateFilename creates parent dirs and rejects unsafe values",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-filename-");
      const outputDir = path.join(repoRoot, ".playwright-sessions", "2026-03-31-valid-session");
      fs.mkdirSync(outputDir, { recursive: true });

      const createdDir = validateFilename("screenshots/01-home.png", outputDir);
      assert.equal(createdDir, path.join(outputDir, "screenshots"));
      assert.ok(fs.existsSync(createdDir));

      expectError(
        () => validateFilename("/tmp/01-home.png", outputDir),
        "must be session-relative, not absolute",
      );
      expectError(
        () => validateFilename("../01-home.png", outputDir),
        "may not escape the active session folder",
      );
      expectError(
        () => validateFilename("01-home.png", outputDir),
        "must include a session-relative subfolder",
      );
    },
  },
  {
    name: "wrapper inspection and session fallback preserve current semantics",
    run: () => {
      const inspection = inspectWrapperArgs([
        "open",
        "--headed",
        "--filename",
        "screenshots/01-home.png",
      ]);
      assert.deepEqual(inspection, {
        filenameValue: "screenshots/01-home.png",
        hasHeadedFlag: true,
        hasSessionFlag: false,
        isOpenCommand: true,
      });

      const commandWithFallback = buildPlaywrightCliCommand(
        ["snapshot"],
        "default",
        false,
      );
      assert.deepEqual(commandWithFallback, {
        command: "npx",
        args: ["--yes", "--package", "@playwright/cli", "playwright-cli", "--session", "default", "snapshot"],
      });

      const commandWithExplicitSession = buildPlaywrightCliCommand(
        ["-s=custom", "snapshot"],
        "default",
        true,
      );
      assert.deepEqual(commandWithExplicitSession, {
        command: "npx",
        args: ["--yes", "--package", "@playwright/cli", "playwright-cli", "-s=custom", "snapshot"],
      });
    },
  },
  {
    name: "assertHeadedAllowed matches current truthy contract",
    run: () => {
      assertHeadedAllowed("1");
      assertHeadedAllowed("true");
      assertHeadedAllowed("TRUE");
      assertHeadedAllowed("yes");
      assertHeadedAllowed("YES");
      expectError(() => assertHeadedAllowed(undefined), "--headed is disabled by default");
    },
  },
  {
    name: "resolveRepositoryRoot resolves git repo root with current messages",
    run: () => {
      const repoRoot = createTempRepo("pw-skill-root-");
      const resolved = resolveRepositoryRoot({
        cwd: repoRoot,
        commandMissingMessage: "missing git",
        resolveFailureMessage: "failed root",
      });
      assert.equal(resolved, fs.realpathSync.native(repoRoot));
    },
  },
  {
    name: "direct TypeScript router smoke preserves session bootstrap usage",
    run: () => {
      const repoRoot = process.cwd();
      const sessionName = `shim-smoke-${process.pid}`;
      const scriptPath = path.join(
        repoRoot,
        "playwright/scripts/playwright-skill-cli.ts",
      );
      const result = spawnSync(
        "npx",
        ["tsx", scriptPath, "session-bootstrap", "--session-name", sessionName, "--no-export"],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /(Initialized manifest:|Manifest already exists:)/);
    },
  },
];

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`All ${tests.length} Playwright session script tests passed.`);
