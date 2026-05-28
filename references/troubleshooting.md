# Playwright CLI Troubleshooting

## Wrong Session / No Session

Symptoms:

- commands fail after `open`
- refs from snapshot are not found on follow-up actions

Checks:

1. Ensure `open` ran successfully.
2. Ensure follow-up commands use `-s=default`.
3. Ensure you did not open a second tab/session unexpectedly.
4. Run `pwcli tab-list`, then `pwcli -s=default snapshot`.

## Stale Refs (`e12 not found`)

Symptoms:

- click/fill commands fail on existing UI elements

Fix:

1. Re-run `pwcli -s=default snapshot`.
2. Use refs from the newest snapshot only.
3. Re-snapshot after navigation, modal open/close, and major UI updates.

## Artifacts Saved in Wrong Folder

Symptoms:

- files appear under `.playwright-cli/` or current directory instead of `/.playwright-sessions/...`

Fix:

1. Use the repo TypeScript wrapper via `pwcli`, not the raw global `playwright-cli`.
2. Export `PLAYWRIGHT_MCP_OUTPUT_DIR` before `open`.
3. Confirm directory exists and is writable.
4. Use session-relative artifact paths for `--filename` values (`screenshots/01-home.png`, `snapshots/01-home.yml`).

## Wrong Host Or Port

Symptoms:

- browser opens the wrong host or port
- agent uses direct ports when hostname-based URLs are available

Fix:

1. Run `npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --json`.
2. Use `eval "$(npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell)"` to export the preferred targets.
3. Supply target URLs via `.playwright-targets.json`, the `PLAYWRIGHT_TARGETS` env var, or `--target` flags. See `playwright/SKILL.md` for details.

## Browser / Runtime Setup Issues

Symptoms:

- `playwright-cli` command missing
- browser cannot start

Fix:

1. Use the local TypeScript entrypoint:

```bash
npx tsx "$(git rev-parse --show-toplevel)/playwright/scripts/playwright-skill-cli.ts" --help
```

2. Install browser binaries when needed:

```bash
npx playwright install chromium
```

## App-Specific Failures

Auth or API endpoints can return `500` due to server-side issues (TLS, DB connectivity, misconfiguration).

Capture:

1. browser error UI
2. failing API request/response from the network panel
3. relevant server log snippets from the host project's log tooling
