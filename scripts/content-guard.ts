/**
 * CLI entry for content-guard CI.
 * Usage:
 *   npx tsx scripts/content-guard.ts [base] [head]
 * Env: BASE_SHA, HEAD_SHA, GITHUB_STEP_SUMMARY
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  emitAnnotation,
  formatSummary,
  runGuard,
} from "./content-guard-lib";

function resolveRef(ref: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--verify", ref], {
      encoding: "utf8",
    }).trim();
  } catch {
    return execFileSync("git", ["rev-parse", "--verify", `origin/${ref}`], {
      encoding: "utf8",
    }).trim();
  }
}

function main() {
  const baseArg =
    process.argv[2] || process.env.BASE_SHA || process.env.GITHUB_BASE_REF || "origin/main";
  const headArg = process.argv[3] || process.env.HEAD_SHA || "HEAD";

  let base: string;
  try {
    base = resolveRef(baseArg);
  } catch {
    console.error(`::error::Could not resolve base ref: ${baseArg}`);
    process.exit(2);
  }
  const head = resolveRef(headArg);

  const { ok, annotations, changed } = runGuard(base, head);
  for (const a of annotations) emitAnnotation(a);
  const summary = formatSummary(ok, annotations, changed);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) fs.appendFileSync(summaryPath, summary);
  console.log(summary);
  process.exit(ok ? 0 : 1);
}

main();
