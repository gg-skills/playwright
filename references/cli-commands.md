# Playwright CLI Commands

Use the TypeScript helper from the main skill examples:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
pwcli() { npx tsx "$REPO_ROOT/playwright/scripts/playwright-skill-cli.ts" cli "$@"; }
eval "$(npx tsx playwright/scripts/playwright-skill-cli.ts print-targets --shell)"
```

## Core

```bash
pwcli open "$PLAYWRIGHT_TARGET_WEBSITE_URL"
pwcli close
pwcli snapshot
pwcli click e3
pwcli dblclick e7
pwcli type "search terms"
pwcli press Enter
pwcli fill e5 "user@example.com"
pwcli drag e2 e8
pwcli hover e4
pwcli select e9 "option-value"
pwcli upload ./document.pdf
pwcli check e12
pwcli uncheck e12
```

## Navigation and Tabs

```bash
pwcli go-back
pwcli go-forward
pwcli reload
pwcli tab-list
pwcli tab-new "$PLAYWRIGHT_TARGET_MANAGER_NEXT_URL/manager"
pwcli tab-select 0
pwcli tab-close
```

## Artifacts and Diagnostics

```bash
pwcli -s=default screenshot --filename "screenshots/01-page.png" --full-page
pwcli -s=default pdf --filename "artifacts/01-page.pdf"
pwcli -s=default console
pwcli -s=default network
pwcli -s=default tracing-start
pwcli -s=default tracing-stop
```

## Safe Advanced Commands

Use only when CLI actions cannot express the interaction:

```bash
pwcli -s=default eval "document.title"
pwcli -s=default eval "el => el.textContent" e5
```

Avoid `run-code` unless strictly necessary and document why in `SUMMARY.md`.
