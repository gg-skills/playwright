---
name: playwright
description: when configuring browser validation with Playwright CLI — artifact sessions, screenshot evidence, findings to planning/Notion workflows. Not for non-browser testing.
---

> **Snapshot age:** collected 2026-04-30 (revised 2026-05-17).
> Verify release-sensitive answers with upstream Playwright docs before responding with high confidence.

# playwright

## Overview

Use this skill when browser validation is done with `playwright-cli` in a host project.
This skill is self-contained and does not require the global `playwright` skill.
The objective is deterministic artifact storage under `/.playwright-sessions/` for every run.

For a direct command lookup, see [Quick Commands](#quick-commands) below.

## When to Use This Skill

**TRIGGER when:**
- User asks to validate UI behavior in a browser using Playwright CLI
- A plan requires baseline or post-implementation screenshot evidence
- Visual parity between app surfaces must be validated
- Browser artifacts need structured storage under `/.playwright-sessions/`
- Evidence must be handed off to Notion or planning workflows

**SKIP when:**
- The task can be verified with unit tests or API tests alone
- Browser validation is already covered by other dedicated test suites
- The user explicitly asks for manual inspection without screenshots

## Common Misconceptions

| # | Misconception | Correction | Key concept |
|---|---------------|------------|-------------|
| 1 | Raw `playwright-cli` is the recommended entrypoint | Use the TypeScript wrapper (`pwcli`) which enforces guardrails | Wrapper safety |
| 2 | `--headed` works by default | Headed mode is blocked unless `PLAYWRIGHT_CLI_ALLOW_HEADED=1` is set | Headless default |
| 3 | Artifacts can go anywhere | All artifacts must land under `/.playwright-sessions/YYYY-MM-DD-session-name-selfexplanatory/` | Deterministic storage |
| 4 | `open` and `--filename` work without env setup | `PLAYWRIGHT_MCP_OUTPUT_DIR` must be exported before `open` | Session guardrails |
| 5 | Target URLs are optional to configure | Consumers must provide `.playwright-targets.json` (or flags / env var) | Config-driven targets |
| 6 | Screenshots alone prove functionality | Snapshot DOM refs first, then screenshot | Dual evidence |
| 7 | Any URL can be tested | Verify URL in .playwright-targets.json first | Target verification |
| 8 | Screenshots alone prove functionality | Snapshot DOM refs first | Dual evidence |

## Playwright Quality Checklist

Use this checklist before and during any Playwright validation.

| # | Checklist Item | Why It Matters | Gate |
|---|---------------|---------------|------|
| 1 | **Wrapper verified** — pwcli TypeScript wrapper used, not raw CLI | Wrapper safety | Pre-op |
| 2 | **Headless default** — `--headed` blocked unless `PLAYWRIGHT_CLI_ALLOW_HEADED=1` | Security | Pre-op |
| 3 | **Artifact storage verified** — Under `/.playwright-sessions/YYYY-MM-DD-.../` | Deterministic storage | Pre-op |
| 4 | **Env setup complete** — `PLAYWRIGHT_MCP_OUTPUT_DIR` exported before `open` | Session guardrails | Draft |
| 5 | **Targets configured** — `.playwright-targets.json` or flags provided | Config-driven targets | Draft |
| 6 | **Dual evidence collected** — DOM snapshot + screenshot | Completeness | Draft |
| 7 | **Target verified** — URL verified in .playwright-targets.json first | Target verification | Draft |
| 8 | **Session bootstrap complete** — Folder, manifests, export command ready | Session readiness | Pre-op |

### Quality Tiers

| Tier | Criteria | Use When |
|------|----------|----------|
| **Minimal** | Items 1-3, 8 | Quick session |
| **Standard** | Items 1-5, 7-8 | Standard validation |
| **Full** | All 8 items | Full evidence |

### Pre-Op Verification

```
□ Wrapper verified (pwcli)
□ Headless default configured
□ Artifact storage ready
□ Session bootstrap complete
□ Targets configured
```

## Playwright Consistency Validator

Before finalizing, verify:

### Consistency Check Matrix

| Check | What to Verify | How to Fix |
|-------|---------------|------------|
| **Wrapper vs Raw** | pwcli used, not raw CLI | Use pwcli |
| **Storage vs Anywhere** | Under /.playwright-sessions/ | Check path |
| **Targets vs Optional** | .playwright-targets.json provided | Configure |
| **Evidence vs Screenshot** | DOM + screenshot collected | Dual evidence |

### Red Flags (Never Present)

- [ ] Raw playwright-cli used instead of pwcli
- [ ] Artifacts stored outside /.playwright-sessions/
- [ ] `--headed` used without `PLAYWRIGHT_CLI_ALLOW_HEADED=1`
- [ ] `open` without `PLAYWRIGHT_MCP_OUTPUT_DIR`
- [ ] No .playwright-targets.json and no flags

## Quick Commands

```bash
# Bootstrap a session (creates folder, manifests, export command)
npm run playwright:session:bootstrap -- --session-name "<name>"

# Open a target URL (after exporting PLAYWRIGHT_MCP_OUTPUT_DIR)
pwcli open "$PLAYWRIGHT_TARGET_WEBSITE_URL"

# Snapshot DOM refs, then screenshot
pwcli -s=default snapshot --filename "snapshots/01-home.yml"
pwcli -s=default screenshot --filename "screenshots/01-home.png" --full-page

# Print resolved target URLs
npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell
```

For the full command catalog, see `references/cli-commands.md`.

## Command Decision Guide

| Scenario | Recommended command |
|----------|---------------------|
| Start a new browser validation run | `npm run playwright:session:bootstrap -- --session-name "<name>"` |
| Open a URL and begin interacting | `pwcli open "$URL"` |
| Capture DOM refs for interaction | `pwcli -s=default snapshot --filename "snapshots/..."` |
| Save a full-page screenshot | `pwcli -s=default screenshot --filename "screenshots/..." --full-page` |
| Capture console or network logs | `pwcli -s=default console` or `pwcli -s=default network` |
| Resolve target URLs for current checkout | `npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell` |
| Publish completed session artifacts | `npx tsx playwright/scripts/playwright-skill-cli.ts finalize-session --session-dir "<path>"` |

**Rule of thumb:** bootstrap once per validation topic, then snapshot before every interaction sequence.

## Playwright Quality Checklist

Use this checklist before running any Playwright validation.

| # | Checklist Item | Why It Matters | Gate |
|---|---------------|---------------|------|
| 1 | **Session bootstrapped** — Folder and manifests created under `/.playwright-sessions/` | Enables deterministic storage | Pre-command |
| 2 | **Env vars exported** — `PLAYWRIGHT_MCP_OUTPUT_DIR` set | Required for CLI commands | Pre-command |
| 3 | **Target verified** — URL in .playwright-targets.json or provided via env | Prevents wrong URL | Pre-command |
| 4 | **Headless enforced** — No `PLAYWRIGHT_CLI_ALLOW_HEADED=1` unless explicit | Security safety | Pre-command |
| 5 | **DOM snapshot taken** — Before screenshots, DOM refs captured | Enables verification | Draft |
| 6 | **Screenshot full-page** — `--full-page` for complete evidence | Captures full view | Draft |
| 7 | **Console/network logs captured** — If relevant to validation | Enables debugging | Draft |
| 8 | **Session finalized** — Manifest completed, evidence reported | Closeout documentation | Closeout |

### Quality Tiers

| Tier | Criteria | Use When |
|------|----------|----------|
| **Minimal** | Items 1-4, 8 | Read-only URL check |
| **Standard** | Items 1-6, 8 | Visual validation |
| **Full** | All 8 items | Full browser automation |

### Pre-Validation Verification

```
□ Session bootstrapped in /.playwright-sessions/
□ PLAYWRIGHT_MCP_OUTPUT_DIR exported
□ Target URL verified
□ Headless mode enforced
□ DOM snapshot ready
□ Screenshot path set
□ Logs captured if needed
□ Manifest complete at closeout
```

## Playwright Consistency Validator

Before finalizing, verify:

### Consistency Check Matrix

| Check | What to Verify | How to Fix |
|-------|---------------|------------|
| **Session vs Artifacts** | All artifacts in session folder | Move artifacts |
| **Env vs Commands** | Env vars exported before commands | Export vars |
| **Snapshot vs Screenshot** | DOM refs before visual capture | Add snapshot |
| **Target vs Test** | URL matches test intent | Update target |

### Red Flags (Never Present)

- [ ] Artifacts outside session folder
- [ ] Headless disabled without explicit approval
- [ ] Screenshot without prior DOM snapshot
- [ ] Unverified target URL
- [ ] Missing session bootstrap

## Guidance Alignment

- Snapshot verified: 2026-04-30 (revised 2026-05-17).
- If this skill file is updated, run the host project's skills sync command so IDEs pick up the new version immediately.
- If guidance semantics changed, run the host project's agents-sync workflow before workflow closure.
- For external docs lookup, prefer `research-online/SKILL.md` or `firecrawl/SKILL.md` before the built-in `web` tool.

## Non-Negotiable Policy

1. Always store browser artifacts under `/.playwright-sessions/YYYY-MM-DD-session-name-selfexplanatory/`.
2. Export `PLAYWRIGHT_MCP_OUTPUT_DIR` before `open` or any `--filename` command.
3. Use the TypeScript wrapper (`pwcli`) instead of the raw global `playwright-cli`.
4. Initialize each session with `npm run playwright:session:bootstrap` so manifests and drafts are created.
5. Verify every screenshot in `NOTION_EVIDENCE.md` resolves to a real local artifact before Notion handoff.
6. Prefer resolved hostnames from `print-targets` when available; default to headless sessions.
7. Never reconstruct shell commands, CLI flags, or setup steps from memory -- always read `references/cli-commands.md` or `references/troubleshooting.md` first.
8. Load only the subset of `references/` the task requires. For version-sensitive answers, verify with upstream Playwright docs.

## Prerequisites

1. Confirm Node tooling exists:

```bash
node --version
npm --version
command -v npx >/dev/null 2>&1
```

2. Choose runner:

- Canonical entrypoint: `playwright/scripts/playwright-skill-cli.ts`
  with explicit subcommands (`cli`, `session-bootstrap`, `evidence-manifest-init`, `finalize-session`,
  `print-targets`). Host npm scripts (`playwright:session:bootstrap`, `playwright:session:manifest:init`,
  `finalize-session`, `print-targets`) invoke this router.
- Do not run the raw global `playwright-cli` binary for normal browser work because it bypasses the session guardrails this skill depends on.

3. Set one reusable helper function from repo root:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
pwcli() { npx tsx "$REPO_ROOT/playwright/scripts/playwright-skill-cli.ts" cli "$@"; }
```

If Node/npm/npx are missing, install Node.js first, then re-run the checks above.

## Consumer Target Configuration

This skill is config-driven: consumers must supply their own target URL list. The target printer
reads from three sources, merged in priority order (flags win over env var, env var wins over config
file):

### Option A — `.playwright-targets.json` (recommended)

Create `.playwright-targets.json` in the host project's repository root:

```json
{
  "targets": {
    "WEBSITE": "https://localhost:3000",
    "API":     "https://localhost:4000",
    "APP":     "https://localhost:5000"
  }
}
```

Each key becomes `PLAYWRIGHT_TARGET_<KEY>_URL` when the shell export form is used.

### Option B — `PLAYWRIGHT_TARGETS` env var

```bash
export PLAYWRIGHT_TARGETS="WEBSITE=https://localhost:3000;API=https://localhost:4000"
```

### Option C — `--target` flags

```bash
npx tsx playwright/scripts/print-playwright-targets.ts \
  --target WEBSITE=https://localhost:3000 \
  --target API=https://localhost:4000 \
  --shell
```

### Using resolved targets

After configuring a source, run:

```bash
eval "$(npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell)"
```

This exports `PLAYWRIGHT_TARGET_<NAME>_URL` for every entry in your config, plus
`PLAYWRIGHT_TARGET_SOURCE` and `PLAYWRIGHT_TARGET_REPOSITORY_ROOT`.

## Environment Discovery

Preferred target discovery command:

```bash
npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --json
eval "$(npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell)"
```

The `--shell` output exports one `PLAYWRIGHT_TARGET_<NAME>_URL` variable per configured target.
Use those exported variables in subsequent `pwcli open` calls.

## Standard Workflow

For diagnostic requests, run the inspection commands first before loading any reference files.

1. Bootstrap session: `npm run playwright:session:bootstrap -- --session-name "<name>"`
2. Export `PLAYWRIGHT_MCP_OUTPUT_DIR` to the active session folder.
3. Resolve target URLs with `npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell`.
4. Prefer hostnames from the host project's environment discovery mechanism (worktree info, reverse-proxy router, etc.) when available; otherwise use the URLs resolved by `print-targets`.
5. Open target URL: `pwcli open "$URL"`
6. Snapshot to obtain fresh refs: `pwcli -s=default snapshot --filename "snapshots/01-home.yml"`
7. Interact using refs from the latest snapshot.
8. Re-snapshot after navigation, modal changes, tab switches, or ref failures.
9. Save at least one screenshot and one snapshot per significant state.
10. Update `EVIDENCE_MANIFEST.json` with real before/after rows and source URLs.
11. Update `NOTION_EVIDENCE.md` with real evidence callouts.
12. Capture console and network when validating behavioral changes or failures.
13. If failures appear during local server startup, inspect local log evidence before declaring a blocker.
14. Validate evidence: `npm run notion:evidence:validate -- --session <session_path>`
15. Finalize: `npx tsx playwright/scripts/playwright-skill-cli.ts finalize-session --session-dir "<session_path>"`
16. Close sessions and unset `PLAYWRIGHT_MCP_OUTPUT_DIR`.

### Reference loading by task type

| Task type | Load these files | Skip |
|-----------|-----------------|------|
| Bootstrap / setup | `cli-commands.md` (bootstrap section) | `troubleshooting.md` |
| Target resolution | Consumer Target Configuration section above | `cli-commands.md` |
| Browser interaction | `cli-commands.md` | `troubleshooting.md` |
| Troubleshooting / debugging | `troubleshooting.md` | `cli-commands.md` |
| Evidence validation / publishing | Required Artifacts + Cross-Skill Handoffs sections below | `cli-commands.md` |

Load only the subset the task needs.

## Session Template

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
pwcli() { npx tsx "$REPO_ROOT/playwright/scripts/playwright-skill-cli.ts" cli "$@"; }

npm run playwright:session:bootstrap -- --session-name "landing-header-qa"
SESSION_ABS="$REPO_ROOT/.playwright-sessions/$(date +%F)-landing-header-qa"
export PLAYWRIGHT_MCP_OUTPUT_DIR="$SESSION_ABS"
eval "$(npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell)"

pwcli open "$PLAYWRIGHT_TARGET_WEBSITE_URL"
pwcli -s=default snapshot --filename "snapshots/01-home.yml"
pwcli -s=default screenshot --filename "screenshots/01-home.png" --full-page
pwcli -s=default console
pwcli -s=default network
npm run notion:evidence:validate -- --session "$SESSION_ABS"

pwcli close-all
unset PLAYWRIGHT_MCP_OUTPUT_DIR
```

## Interaction Rules

1. Always snapshot before interacting with refs.
2. Re-snapshot when refs are stale or after major DOM updates.
3. Keep using `-s=default` after `open`; missing session flags are a common failure source.
4. Keep Playwright CLI headless by default so browser sessions stay silent in the background.
5. Use `--headed` only for an explicitly requested manual debugging run, and only with `PLAYWRIGHT_CLI_ALLOW_HEADED=1`.
6. Use session-relative artifact paths such as `screenshots/...`, `snapshots/...`, or `state/...`; the TypeScript CLI will create those folders inside the active session.
7. Capture evidence immediately after reproducing a bug (`screenshot`, `console`, `network`).
8. If a local dev server is active, capture the relevant server log artifact context alongside the browser evidence.

## Required Artifacts

Each run folder must include:

1. `SUMMARY.md` with scenario, expected behavior, observed behavior, and follow-up.
2. At least one full-page screenshot.
3. At least one snapshot (`.yml`).
4. `EVIDENCE_MANIFEST.json` with before/after evidence entries and source URLs.
5. `NOTION_EVIDENCE.md` draft that can be validated before posting to Notion.
6. For failures: console and network evidence, plus relevant server log evidence when a local server is active.

## Cross-Skill Handoffs

**AUTO_TRIGGER_WHEN**
1. `plan/SKILL.md` requires baseline evidence before implementation.
2. `plan/SKILL.md` requires post-implementation evidence after code changes.

**AUTO_SUGGEST_WHEN**
1. A plan includes user-facing UI behavior but no screenshot artifacts yet.
2. Visual parity between app surfaces must be validated.
3. Regression risk is primarily visual/interaction-level.

**BLOCKING_GATES**
1. Do not report evidence complete when required screenshots are missing.
2. Do not hand off to Notion without validated `NOTION_EVIDENCE.md`.
3. Do not hand off evidence when any screenshot entry lacks a readable local artifact.

**HANDOFF_OUTPUTS**
1. To downstream task tracking when explicitly requested: session path, screenshot paths, source URLs, validation notes.
2. To `plan/SKILL.md`: baseline/post evidence completeness status, unresolved visual anomalies.
3. To `specs/SKILL.md`: session path and screenshot evidence for Runbook References, observed behaviors for User Journey diagrams.

**Evidence Linkage Rule**
Every run must preserve traceability links to: source plan path, source study path (if available), and task URL/ID when one exists.

## Common Pitfalls

1. **Forgetting to export `PLAYWRIGHT_MCP_OUTPUT_DIR` before `open`**
   - Why: The wrapper hard-fails `open` and `--filename` commands without it.
   - Correct approach: Always run the bootstrap export command before opening the browser.
   - See: Session Template above.

2. **Using raw `playwright-cli` instead of the TypeScript wrapper**
   - Why: Raw binary bypasses session guardrails and can write artifacts to `.playwright-cli/` or current directory.
   - Correct approach: Use the `pwcli` helper function defined in Prerequisites.
   - See: `references/troubleshooting.md`.

3. **Passing `--headed` without the opt-in env var**
   - Why: Headed mode is disabled by default to keep sessions silent.
   - Correct approach: Set `PLAYWRIGHT_CLI_ALLOW_HEADED=1` only for manual debugging runs.
   - See: Non-Negotiable Policy rule 6.

4. **Forgetting `-s=default` after `open`**
   - Why: Follow-up commands target the wrong context without an explicit session flag.
   - Correct approach: Pass `-s=default` on every command after `open`.
   - See: `references/troubleshooting.md`.

5. **Using root-level `--filename` paths**
   - Why: The wrapper rejects root-level paths for safety.
   - Correct approach: Always include a subfolder (`screenshots/...`, `snapshots/...`).
   - See: Non-Negotiable Policy rule 2.

6. **Re-snapshotting too infrequently**
   - Why: Refs become stale after navigation, modals, or tab switches.
   - Correct approach: Re-snapshot after every significant DOM change.
   - See: Interaction Rules.

7. **Not providing a `.playwright-targets.json` before running `print-targets`**
   - Why: The target printer requires at least one configured source; it errors with guidance when none are found.
   - Correct approach: Add `.playwright-targets.json` to the repository root, or use `--target` flags, or set `PLAYWRIGHT_TARGETS`.
   - See: Consumer Target Configuration above.

## Install and Setup Checks

```bash
command -v npx >/dev/null 2>&1 || echo "npx missing"
command -v playwright-cli >/dev/null 2>&1 && playwright-cli --help
npx tsx "$(git rev-parse --show-toplevel)/playwright/scripts/playwright-skill-cli.ts" cli --help
```

If `playwright-cli` is missing:

```bash
# Optional global install path
npm install -g @playwright/cli@latest
playwright-cli --help
```

If browser binaries are missing:

```bash
npx playwright install chromium
```

## Troubleshooting

1. `No session` / command targets wrong context:
   - ensure `open` was called first
   - ensure follow-up commands include `-s=default`
2. Refs such as `e12` not found:
   - run `snapshot` again, then retry
3. Artifacts unexpectedly appear in `.playwright-cli/`:
   - ensure you are using the TypeScript wrapper (`pwcli`) instead of the raw global `playwright-cli`
   - ensure `PLAYWRIGHT_MCP_OUTPUT_DIR` is exported before `open`
4. `print-targets` errors with "No targets found":
   - add `.playwright-targets.json` to the repository root, or set `PLAYWRIGHT_TARGETS`, or pass `--target` flags
   - see Consumer Target Configuration above
5. UI blocks interactions:
   - dismiss cookie/privacy banners, then re-snapshot
6. App auth returns `500`:
   - capture browser error, auth API response, and relevant server log snippets

For detailed troubleshooting, see `references/troubleshooting.md`.

## References

### Local Corpus Layout

The `references/` directory contains 2 hand-authored Markdown files with no subfolders.

| File | Description |
|------|-------------|
| `cli-commands.md` | Full Playwright CLI command catalog organized by category |
| `troubleshooting.md` | Detailed troubleshooting guide for session, ref, and setup failures |

### External Documentation

- Consumer project browser testing policy: see the host project's `docs/BROWSER_TESTING.md`

### Bundled Assets

| File | Description |
|------|-------------|
| `assets/icon-small.svg` | Small icon for IDE skill surfaces |
| `assets/icon-large.png` | Large icon for IDE skill surfaces |

### Canonical URLs

- Playwright CLI upstream docs: https://playwright.dev/docs/intro
