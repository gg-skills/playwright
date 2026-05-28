/**
 * @fileoverview Playwright session bootstrap and evidence-manifest helpers for the
 * `playwright` scripts library.
 *
 * Owns folder naming conventions, git-root resolution, manifest IO, and the full
 * session directory initialization orchestration used by browser-validation workflows.
 *
 * @example
 * ```ts
 * const folderName = buildSessionFolderName("demo");
 * ```
 *
 * @testing Manual smoke test via tsx CLI: npx tsx playwright/scripts/playwright-session-bootstrap.ts --session-name demo --task-id TST-1
 * @see playwright/SKILL.md - Playwright skill workflows that depend on session directories and manifests.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** ISO-date-prefixed folder name pattern for validated session folder names. */
export const SESSION_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Options for resolving the git repository root. */
export type RepositoryRootOptions = {
  cwd?: string;
  commandMissingMessage: string;
  resolveFailureMessage: string;
};

/** Options for initializing an evidence manifest in a session directory. */
export type ManifestInitOptions = {
  overwrite: boolean;
  sessionDir: string;
  sourceUrl: string;
  taskId: string;
};

/** Result of initializing an evidence manifest; discriminated by `kind` when manifest already exists vs newly created. */
export type ManifestInitResult =
  | {
      draftPath: string;
      manifestPath: string;
      kind: "created";
      sessionDirAbs: string;
      sessionDirRelative: string;
    }
  | {
      kind: "exists";
      manifestPath: string;
      sessionDirAbs: string;
      sessionDirRelative: string;
    };

/** Options for bootstrapping a new Playwright session folder and evidence structure. */
export type BootstrapOptions = {
  printExport: boolean;
  sessionName: string;
  sourceUrl: string;
  taskId: string;
};

/** Result returned after bootstrapping a Playwright session; includes paths, manifest state, and optional shell export text. */
export type BootstrapResult = {
  guidanceText: string | null;
  manifestInitResult: ManifestInitResult;
  sessionAbsPath: string;
  sessionFolderName: string;
  sessionRelPath: string;
  summaryPath: string;
  summaryWasCreated: boolean;
};

const SUMMARY_TEMPLATE = `# Browser Validation Summary

- Scenario:
- Expected:
- Observed:
- Verdict:
- Follow-up:
`;

const NOTION_EVIDENCE_TEMPLATE = `### Current Screenshots Evidence

> [!WARNING] **Baseline issue snapshot — replace title with surface + state + outcome**
>
> ### Screenshot focus title (required)
>
> Current (Before)
>
> Focus guidance: replace with what reviewers should inspect.
>
> ![Baseline screenshot](./01-before-placeholder.png)
>
> **Assessments**
>
> > **Manual:** Replace with manual review notes and verdict.
> >
> > **ZAI Council:** Replace with ZAI review notes or mark unavailable.
> >
> > **Gemini Council:** Replace with Gemini review notes or mark unavailable.
>
> ---
>
> **References**
>
> - Source URL: replace_with_source_url
> - GitHub Screenshot URL: replace_with_github_blob_url
> - Relative Evidence Path: \`01-before-placeholder.png\`

### Screenshot Evidence

> [!SUCCESS] **Fixed/validated state — replace title with surface + state + outcome**
>
> ### Screenshot focus title (required)
>
> Updated (After)
>
> Focus guidance: replace with what reviewers should inspect.
>
> ![Updated screenshot](./02-after-placeholder.png)
>
> **Assessments**
>
> > **Manual:** Replace with manual review notes and verdict.
> >
> > **ZAI Council:** Replace with ZAI review notes or mark unavailable.
> >
> > **Gemini Council:** Replace with Gemini review notes or mark unavailable.
>
> ---
>
> **References**
>
> - Source URL: replace_with_source_url
> - GitHub Screenshot URL: replace_with_github_blob_url
> - Relative Evidence Path: \`02-after-placeholder.png\`

### Before/After Comparison

| Surface | Current (Before) | Updated (After) | Delta |
| --- | --- | --- | --- |
| replace_with_surface_key | \`01-before-placeholder.png\` | \`02-after-placeholder.png\` | Replace with concise behavioral delta. |

### Validation

- Expected: Replace with acceptance criteria.
- Observed: Replace with observed behavior.
- Manual Verdict: Pass/Fail with rationale.
- ZAI Verdict: Pass/Fail/Unavailable.
- Gemini Verdict: Pass/Fail/Unavailable.
- Kimi Verdict: Pass/Fail/Unavailable.
- Council Result: Final decision and rationale.
- Notes/Follow-up: Optional next steps.
- ZAI Evidence: Unavailable (MCP not available) OR include tool/prompt/inputs/findings.
- Gemini Evidence: Unavailable (delegate tooling not available) OR include model/prompt/inputs/findings.
- Kimi Evidence: Unavailable (delegate tooling not available) OR include model/prompt/inputs/findings.
`;

/**
 * Verifies a CLI binary is callable by running `--version` synchronously.
 *
 * @remarks
 * Intended for cheap presence checks before heavier git or Playwright operations.
 * Throws with `missingMessage` when the probe fails (missing binary or non-zero exit).
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
 * Resolves the git repository root by running `git rev-parse --show-toplevel`.
 * Throws if `git` is unavailable or the command fails.
 */
export function resolveRepositoryRoot(options: RepositoryRootOptions): string {
  ensureCommandAvailable("git", options.commandMissingMessage);

  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(options.resolveFailureMessage);
  }
}

/**
 * Ensures `.playwright-sessions` exists under `repoRoot` and returns its absolute path.
 * Creates the directory recursively if missing.
 */
export function ensureSessionsRoot(repoRoot: string): string {
  const sessionsRoot = path.join(repoRoot, ".playwright-sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });

  return fs.realpathSync.native(sessionsRoot);
}

/**
 * Converts a human-readable session name into a lowercased hyphen-separated slug.
 * Returns `"session-name-selfexplanatory"` when the input yields an empty slug.
 */
export function slugifySessionName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "")
    .replace(/-+/g, "-");

  return slug.length > 0 ? slug : "session-name-selfexplanatory";
}

/** Formats a Date as an ISO-style `YYYY-MM-DD` string. */
export function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Combines an ISO date prefix and a slugified session name into a validated session folder name.
 * Validates the result against `SESSION_FOLDER_PATTERN` and throws on mismatch.
 */
export function buildSessionFolderName(sessionName: string, date: Date): string {
  const folderName = `${formatLocalDate(date)}-${slugifySessionName(sessionName)}`;
  if (!SESSION_FOLDER_PATTERN.test(folderName)) {
    throw new Error(`Error: generated session folder name is invalid: ${folderName}`);
  }

  return folderName;
}

/**
 * Normalizes path strings to forward-slash form for manifests and relative URLs.
 *
 * @remarks
 * Collapses platform `path.sep` differences so session-relative paths stay portable in JSON/Markdown.
 */
function normalizeRelativePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}

/**
 * Ensures the session directory exists on disk and returns its canonical absolute path.
 *
 * @remarks
 * Joins `sessionDir` under `repoRoot` when it is not already absolute, then `mkdir -p` and realpath.
 */
function resolveAbsoluteSessionDir(repoRoot: string, sessionDir: string): string {
  const unresolvedPath = path.isAbsolute(sessionDir) ? sessionDir : path.join(repoRoot, sessionDir);
  fs.mkdirSync(unresolvedPath, { recursive: true });

  return fs.realpathSync.native(unresolvedPath);
}

/**
 * Validates that `sessionDirAbs` is strictly under `sessionsRoot`.
 * Returns the relative path or throws if the session dir escapes the sessions root.
 */
export function validateSessionDirWithinSessionsRoot(
  sessionDirAbs: string,
  sessionsRoot: string,
): { sessionDirRelative: string } {
  const relativePath = path.relative(sessionsRoot, sessionDirAbs);
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Error: session dir must be under ${sessionsRoot}`);
  }

  return {
    sessionDirRelative: normalizeRelativePath(relativePath),
  };
}

/**
 * Creates a UTF-8 file only when the path is absent; skips existing files.
 *
 * @remarks
 * Returns whether a new file was written vs leaving an existing artifact untouched.
 */
function writeFileIfMissing(filePath: string, contents: string): boolean {
  if (fs.existsSync(filePath)) {
    return false;
  }

  fs.writeFileSync(filePath, contents);
  return true;
}

/**
 * Creates `EVIDENCE_MANIFEST.json` and optionally `NOTION_EVIDENCE.md` inside the session directory.
 * Returns `"exists"` kind if the manifest already exists and `overwrite` is not `true`.
 */
export function initializeEvidenceManifest(
  repoRoot: string,
  options: ManifestInitOptions,
  now: Date = new Date(),
): ManifestInitResult {
  const sessionsRoot = ensureSessionsRoot(repoRoot);
  const sessionDirAbs = resolveAbsoluteSessionDir(repoRoot, options.sessionDir);
  const { sessionDirRelative } = validateSessionDirWithinSessionsRoot(sessionDirAbs, sessionsRoot);

  const manifestPath = path.join(sessionDirAbs, "EVIDENCE_MANIFEST.json");
  const draftPath = path.join(sessionDirAbs, "NOTION_EVIDENCE.md");

  if (fs.existsSync(manifestPath) && options.overwrite !== true) {
    return {
      kind: "exists",
      manifestPath,
      sessionDirAbs,
      sessionDirRelative: normalizeRelativePath(path.join(".playwright-sessions", sessionDirRelative)),
    };
  }

  const manifest = {
    schemaVersion: "1.0.0",
    taskId: options.taskId,
    createdAt: now.toISOString().replace(/\.\d{3}Z$/u, "Z"),
    sessionRelativePath: normalizeRelativePath(path.join(".playwright-sessions", sessionDirRelative)),
    notionEvidenceDraftPath: "NOTION_EVIDENCE.md",
    evidence: [
      {
        id: "surface-before-placeholder",
        surfaceKey: "replace_with_surface_key",
        phase: "before",
        sourceUrl: options.sourceUrl,
        relativePath: "01-before-placeholder.png",
        focusGuidance: "Replace with what reviewers should inspect.",
      },
      {
        id: "surface-after-placeholder",
        surfaceKey: "replace_with_surface_key",
        phase: "after",
        sourceUrl: options.sourceUrl,
        relativePath: "02-after-placeholder.png",
        focusGuidance: "Replace with what reviewers should inspect.",
      },
    ],
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (!fs.existsSync(draftPath) || options.overwrite === true) {
    fs.writeFileSync(draftPath, NOTION_EVIDENCE_TEMPLATE);
  }

  return {
    draftPath,
    kind: "created",
    manifestPath,
    sessionDirAbs,
    sessionDirRelative: normalizeRelativePath(path.join(".playwright-sessions", sessionDirRelative)),
  };
}

/** Formats a human-readable status message from a `ManifestInitResult`. */
export function formatManifestInitMessage(result: ManifestInitResult): string {
  if (result.kind === "exists") {
    return `Manifest already exists: ${result.manifestPath}`;
  }

  return `Initialized manifest: ${result.manifestPath}\nInitialized draft: ${result.draftPath}`;
}

/**
 * Bootstraps a complete session directory tree (session folder, screenshots/, snapshots/),
 * a `SUMMARY.md`, and an evidence manifest. Returns paths and optional shell export guidance.
 */
export function initializePlaywrightSession(
  repoRoot: string,
  options: BootstrapOptions,
  now: Date = new Date(),
): BootstrapResult {
  const sessionFolderName = buildSessionFolderName(options.sessionName, now);
  const sessionRelPath = normalizeRelativePath(path.join(".playwright-sessions", sessionFolderName));
  const sessionAbsPath = path.join(repoRoot, sessionRelPath);

  fs.mkdirSync(sessionAbsPath, { recursive: true });
  fs.mkdirSync(path.join(sessionAbsPath, "screenshots"), { recursive: true });
  fs.mkdirSync(path.join(sessionAbsPath, "snapshots"), { recursive: true });

  const summaryPath = path.join(sessionAbsPath, "SUMMARY.md");
  const summaryWasCreated = writeFileIfMissing(summaryPath, SUMMARY_TEMPLATE);

  const manifestInitResult = initializeEvidenceManifest(
    repoRoot,
    {
      overwrite: false,
      sessionDir: sessionAbsPath,
      sourceUrl: options.sourceUrl,
      taskId: options.taskId,
    },
    now,
  );

  const guidanceText = options.printExport
    ? `Session initialized.

Session folder:
  ${sessionAbsPath}

Export before calling playwright-cli open:
  export PLAYWRIGHT_MCP_OUTPUT_DIR="${sessionAbsPath}"

Finalize when the evidence set is complete:
  npx tsx "${repoRoot}/playwright/scripts/finalize-playwright-session.ts" --session-dir "${sessionAbsPath}"`
    : null;

  return {
    guidanceText,
    manifestInitResult,
    sessionAbsPath,
    sessionFolderName,
    sessionRelPath,
    summaryPath,
    summaryWasCreated,
  };
}
