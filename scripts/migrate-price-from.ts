/**
 * One-off, re-runnable migration: `priceLabel` (free display text) becomes
 * `priceFrom: true` (a "From £…" starting price). The amount always comes from
 * `price`.
 *
 * Every content/new/*.md is verified first. A `priceLabel` must be exactly
 * `money(price)` or `"From " + money(price)`. If any file does not match, the
 * script lists the mismatches, writes nothing and exits 1: a mismatch needs a
 * human decision, never a guess.
 *
 * When every file matches, the `priceLabel:` line is replaced in place by
 * `priceFrom: true` (for "From " labels) or removed. Nothing is written for
 * `false`. Every other byte of the file is left as it is, so key order and
 * formatting stay as the serializer wrote them. Re-running is a no-op.
 *
 * Usage:
 *   npx tsx scripts/migrate-price-from.ts                  # verify, then write
 *   npx tsx scripts/migrate-price-from.ts --check          # verify only
 *   npx tsx scripts/migrate-price-from.ts --check --ref <sha>
 *
 * `--check` fails when any file still has `priceLabel`, or when a file's
 * `priceFrom` / other frontmatter differs from what the migration derives from
 * that file at `--ref` (default 25aabbd, the last main commit with
 * `priceLabel`). Files that do not exist at the ref are only checked for
 * `priceLabel`.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { money } from "../src/lib/newbikes-types";

const DEFAULT_REF = "25aabbd";
const CONTENT_REL = "content/new";
const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, CONTENT_REL);

type Data = Record<string, unknown>;

export type Mismatch = { file: string; priceLabel: unknown; price: unknown; expected: string[] };

export type Plan =
  | { file: string; action: "none" }
  | { file: string; action: "drop" | "from"; text: string };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** `true` / `false` for a label that matches `price`, `null` for a mismatch. */
export function priceFromFor(priceLabel: unknown, price: unknown): boolean | null {
  if (typeof price !== "number" || typeof priceLabel !== "string") return null;
  if (priceLabel === money(price)) return false;
  if (priceLabel === `From ${money(price)}`) return true;
  return null;
}

/** Frontmatter block of a Markdown file: [start, end) character offsets of its lines. */
function frontmatterRange(text: string): [number, number] {
  const m = text.match(/^---\n([\s\S]*?\n)---(\n|$)/);
  if (!m) throw new Error("no frontmatter block");
  return [4, 4 + m[1].length];
}

/**
 * Rewrite one file's text. Returns the plan, or a mismatch. Throws when the
 * `priceLabel` line cannot be rewritten safely (e.g. multi-line value).
 */
export function planFile(file: string, text: string): Plan | Mismatch {
  const { data } = matter(text) as unknown as { data: Data };
  if (!("priceLabel" in data)) return { file, action: "none" };
  const from = priceFromFor(data.priceLabel, data.price);
  if (from === null) {
    const expected = typeof data.price === "number" ? [money(data.price), `From ${money(data.price)}`] : [];
    return { file, priceLabel: data.priceLabel, price: data.price, expected };
  }
  if ("priceFrom" in data) throw new Error(`${file}: has both priceLabel and priceFrom`);
  const [start, end] = frontmatterRange(text);
  const fm = text.slice(start, end);
  const lines = fm.split("\n");
  const hits = lines.flatMap((l, i) => (/^priceLabel:/.test(l) ? [i] : []));
  if (hits.length !== 1) throw new Error(`${file}: expected one priceLabel line, found ${hits.length}`);
  const i = hits[0];
  if (/^\s/.test(lines[i + 1] ?? "")) throw new Error(`${file}: priceLabel is not a single-line value`);
  if (from) lines[i] = "priceFrom: true";
  else lines.splice(i, 1);
  const out = text.slice(0, start) + lines.join("\n") + text.slice(end);

  // The rewrite must change exactly priceLabel -> priceFrom and nothing else.
  const after = (matter(out) as unknown as { data: Data }).data;
  const want: Data = { ...data };
  delete want.priceLabel;
  if (from) want.priceFrom = true;
  if (!isDeepStrictEqual(after, want)) {
    throw new Error(`${file}: rewrite changed more than priceLabel`);
  }
  return { file, action: from ? "from" : "drop", text: out };
}

const isMismatch = (p: Plan | Mismatch): p is Mismatch => "expected" in p;

function listFiles(): string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function report(mismatches: Mismatch[]): void {
  console.error(`${mismatches.length} priceLabel mismatch(es); nothing written:`);
  for (const m of mismatches) {
    console.error(
      `  ${m.file}: priceLabel ${JSON.stringify(m.priceLabel)}, price ${JSON.stringify(m.price)}, expected one of ${JSON.stringify(m.expected)}`,
    );
  }
}

function gitShow(ref: string, rel: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function check(ref: string): string[] {
  const problems: string[] = [];
  let from = 0;
  let compared = 0;
  for (const f of listFiles()) {
    const rel = `${CONTENT_REL}/${f}`;
    const text = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
    const { data } = matter(text) as unknown as { data: Data };
    if ("priceLabel" in data) problems.push(`${rel}: still has priceLabel`);
    if (data.priceFrom === true) from++;
    else if ("priceFrom" in data) problems.push(`${rel}: priceFrom is ${JSON.stringify(data.priceFrom)}; write true or omit it`);
    const old = gitShow(ref, rel);
    if (old == null) continue;
    compared++;
    const plan = planFile(rel, old);
    if (isMismatch(plan)) {
      problems.push(`${rel}: priceLabel at ${ref} does not match price (${JSON.stringify(plan.priceLabel)})`);
      continue;
    }
    const want = plan.action === "none" ? old : plan.text;
    if (want !== text) problems.push(`${rel}: differs from the migration of ${ref}`);
  }
  console.log(`priceFrom: true on ${from} file(s); ${compared} compared with ${ref}`);
  return problems;
}

function main() {
  const ref = arg("--ref") ?? DEFAULT_REF;
  if (process.argv.includes("--check")) {
    const problems = check(ref);
    for (const p of problems) console.error(p);
    console.log(`checked ${listFiles().length} file(s) in ${CONTENT_REL}: ${problems.length} problem(s)`);
    process.exit(problems.length ? 1 : 0);
  }

  const plans = listFiles().map((f) =>
    planFile(`${CONTENT_REL}/${f}`, fs.readFileSync(path.join(CONTENT_DIR, f), "utf8")),
  );
  const mismatches = plans.filter(isMismatch);
  if (mismatches.length) {
    report(mismatches);
    process.exit(1);
  }
  let from = 0;
  let drop = 0;
  for (const p of plans as Plan[]) {
    if (p.action === "none") continue;
    fs.writeFileSync(path.join(ROOT, p.file), p.text);
    if (p.action === "from") from++;
    else drop++;
  }
  console.log(`verified ${plans.length} file(s): 0 mismatches`);
  console.log(`priceFrom: true written to ${from} file(s); priceLabel dropped from ${drop} more`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
