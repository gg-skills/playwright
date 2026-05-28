#!/usr/bin/env npx tsx

/**
 * @fileoverview CLI that scores Playwright validation readiness from `--phase` against the eight-item
 * Playwright Quality Checklist for the playwright skill.
 *
 * This file owns the checklist model, phase-to-item mapping, human-readable console reporting, and
 * optional `--json` rollup output; it does not execute Playwright or perform filesystem I/O.
 * Flow: argv -> resolve phase -> synthesize per-item completion flags -> print score and readiness -> optional JSON.
 *
 * @testing CLI: npx tsx skills/playwright/scripts/check-playwright-completeness.ts --phase 8
 * @testing CLI: npx tsx skills/playwright/scripts/check-playwright-completeness.ts --phase 4 --json
 *
 * @see skills/playwright/SKILL.md - Canonical skill prose and checklist tables this script mirrors for operator-facing scoring.
 * @see skills/playwright/scripts/lib/playwright-cli-guardrails.ts - Wrapper and session-path guardrails whose policy items align with several scored checklist gates.
 * @see skills/playwright/references/cli-commands.md - pwcli command crib sheet operators follow while satisfying the checklist items summarized here.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { argv } from "process";

// ============================================================================
// Types
// ============================================================================

/**
 * One Playwright Quality Checklist gate with scoring weight and completion state.
 *
 * @remarks
 * Optional items still affect totals but do not gate `canFinalize` when every required item passes.
 */
interface ChecklistItem {
  number: number;
  name: string;
  description: string;
  required: boolean;
  checked: boolean;
  weight: number;
}

/**
 * Machine-readable rollup emitted when `--json` is passed alongside console output.
 *
 * @remarks
 * Mirrors the same score and readiness logic printed for operators; intended for tooling parsers.
 */
interface CompletenessReport {
  checklist: ChecklistItem[];
  score: number;
  maxScore: number;
  canFinalize: boolean;
}

// ============================================================================
// Checklist Definition
// ============================================================================

const CHECKLIST_ITEMS: Omit<ChecklistItem, "checked">[] = [
  { number: 1, name: "Wrapper verified", description: "pwcli TypeScript wrapper used, not raw CLI", required: true, weight: 2 },
  { number: 2, name: "Headless default", description: "--headed blocked unless PLAYWRIGHT_CLI_ALLOW_HEADED=1", required: true, weight: 2 },
  { number: 3, name: "Artifact storage verified", description: "Under /.playwright-sessions/YYYY-MM-DD-.../", required: true, weight: 2 },
  { number: 4, name: "Env setup complete", description: "PLAYWRIGHT_MCP_OUTPUT_DIR exported before open", required: true, weight: 1 },
  { number: 5, name: "Targets configured", description: ".playwright-targets.json or flags provided", required: true, weight: 2 },
  { number: 6, name: "Dual evidence collected", description: "DOM snapshot + screenshot", required: false, weight: 1 },
  { number: 7, name: "Target verified", description: "URL verified in .playwright-targets.json first", required: true, weight: 1 },
  { number: 8, name: "Session bootstrap complete", description: "Folder, manifests, export command ready", required: true, weight: 2 },
];

// ============================================================================
// Main
// ============================================================================

/**
 * CLI entrypoint that maps `--phase` to checklist completion and prints the scored report.
 *
 * @remarks
 * I/O: reads `process.argv` and writes human-readable lines to stdout; appends JSON only when
 * `--json` is present. No filesystem or network access.
 */
function main() {
  const args = argv.slice(2);
  const phaseArg = args.find(a => a === "--phase" || a === "-p");
  const jsonArg = args.includes("--json");
  
  const phase = phaseArg 
    ? parseInt(args[args.indexOf(phaseArg) + 1] || "8", 10)
    : 8;
  
  console.log("\n📋 Playwright Quality Completeness Check");
  console.log("═".repeat(60));
  console.log(`\n📊 Phase: ${phase}/8`);
  
  // Build checklist based on phase
  const checklist: ChecklistItem[] = CHECKLIST_ITEMS.map(item => {
    let checked = false;
    
    switch (item.number) {
      case 1: // Wrapper verified
        checked = phase >= 1;
        break;
      case 2: // Headless default
        checked = phase >= 1;
        break;
      case 3: // Artifact storage verified
        checked = phase >= 1;
        break;
      case 4: // Env setup complete
        checked = phase >= 2;
        break;
      case 5: // Targets configured
        checked = phase >= 2;
        break;
      case 6: // Dual evidence collected
        checked = phase >= 3 || item.required === false;
        break;
      case 7: // Target verified
        checked = phase >= 2;
        break;
      case 8: // Session bootstrap complete
        checked = phase >= 1;
        break;
      default:
        break;
    }
    
    return { ...item, checked };
  });
  
  const score = checklist.reduce((sum, item) => 
    item.checked ? sum + item.weight : sum, 0);
  const maxScore = checklist.reduce((sum, item) => sum + item.weight, 0);
  
  const requiredItems = checklist.filter(i => i.required);
  const requiredScore = requiredItems.reduce((sum, item) => 
    item.checked ? sum + item.weight : sum, 0);
  const requiredMax = requiredItems.reduce((sum, item) => sum + item.weight, 0);
  
  const canFinalize = requiredScore === requiredMax;
  
  console.log(`\n📊 Score: ${score}/${maxScore} (${((score/maxScore)*100).toFixed(0)}%)`);
  console.log(`   Required items: ${requiredScore}/${requiredMax}`);
  
  console.log(`\n${canFinalize ? "✅" : "⚠️"} Ready: ${canFinalize ? "YES" : "NEEDS WORK"}`);
  
  console.log("\n📝 Checklist:");
  for (const item of checklist) {
    const icon = item.checked ? "✅" : item.required ? "❌" : "⚠️";
    console.log(`   ${icon} [${item.number}] ${item.name}`);
  }
  
  console.log("\n" + "═".repeat(60));
  
  if (!canFinalize) {
    console.log("\n⚠️ Playwright validation needs more work.");
    const failedItems = checklist.filter(i => !i.checked && i.required);
    if (failedItems.length > 0) {
      console.log("\nIssues to verify:");
      failedItems.forEach(i => console.log(`   - ${i.name}: ${i.description}`));
    }
  } else {
    console.log("\n✅ Playwright validation is verified and complete.");
  }
  
  if (jsonArg) {
    const report: CompletenessReport = { checklist, score, maxScore, canFinalize };
    console.log("\n" + JSON.stringify(report, null, 2));
  }
}

main();
