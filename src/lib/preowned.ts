/**
 * Pre-owned data access — the ONLY module that knows where bikes come from.
 *
 * Today: Markdown files in content/pre-owned/<slug>.md, read and validated at
 * build time (static export). If a backend is chosen later, swap the body of
 * getAll() for a fetch; pages only use getAll / getBySlug / getListed.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import { newestFirst, type PreownedBike } from "./preowned-types";
import { SLUG_RE, normaliseBike } from "./preowned-schema";

const CONTENT_DIR = path.join(process.cwd(), "content", "pre-owned");
const PUBLIC_DIR = path.join(process.cwd(), "public");
/** Sold bikes drop off the list this many days after soldDate (detail page stays). */
export const SOLD_LIST_DAYS = 30;

/**
 * Drafts are hidden from production builds. They show in `next dev`, or in a
 * build run with NEXT_PUBLIC_SHOW_DRAFTS=1 (local preview only, never CI/Pages).
 * (Repo `draft: true` is only used by the example data; admin drafts never reach the repo.)
 */
const SHOW_DRAFTS =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_DRAFTS === "1";

const md = new Marked({ gfm: true, breaks: true });
md.use({ renderer: { html: () => "" } }); // drop raw HTML from bodies

/** Photo path → file in public/ (rules themselves live in preowned-schema.ts, shared with the admin). */
function photoExists(src: string): boolean {
  const local = path.join(PUBLIC_DIR, decodeURI(src));
  return local.startsWith(PUBLIC_DIR) && fs.existsSync(local);
}

function parseFile(file: string): PreownedBike | null {
  const where = `content/pre-owned/${file}`;
  const slug = file.replace(/\.md$/, "");
  if (!SLUG_RE.test(slug))
    throw new Error(`[pre-owned] ${where}: file name must be letters, digits, - or _ (it becomes /pre-owned/${slug}/)`);

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
  } catch (e) {
    throw new Error(`[pre-owned] ${where}: invalid frontmatter — ${(e as Error).message}`);
  }
  const r = normaliseBike(parsed.data as Record<string, unknown>, { photoExists });
  for (const w of r.warnings) console.warn(`[pre-owned] ${where}: ${w.message}`);
  if (r.errors.length || r.missing.length) {
    const problems = [...r.missing, ...r.errors].map((e) => e.message);
    // Unfinished drafts are skipped (with a warning); anything published must be complete.
    if (r.bike.draft && r.errors.length === 0) {
      console.warn(`[pre-owned] skipping incomplete draft ${where}: ${problems.join("; ")}`);
      return null;
    }
    throw new Error(`[pre-owned] ${where}:\n  - ${problems.join("\n  - ")}`);
  }
  return {
    slug,
    ...r.bike,
    descriptionHtml: md.parse(parsed.content.trim(), { async: false }) as string,
  };
}

let cache: PreownedBike[] | null = null;
function loadFiles(): PreownedBike[] {
  if (cache && process.env.NODE_ENV !== "development") return cache;
  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))
    : [];
  cache = files.map(parseFile).filter((b): b is PreownedBike => b !== null);
  return cache;
}

/** Every published bike (drafts hidden in production), newest first, sold last. Detail pages exist for all of these. */
export async function getAll(): Promise<PreownedBike[]> {
  return loadFiles()
    .filter((b) => SHOW_DRAFTS || !b.draft)
    .sort(newestFirst);
}

export async function getBySlug(slug: string): Promise<PreownedBike | undefined> {
  return (await getAll()).find((b) => b.slug === slug);
}

/**
 * Bikes shown on the list page: hides sold bikes whose soldDate (or listing
 * date, if soldDate is missing) is more than SOLD_LIST_DAYS before `now`.
 * Static site → "now" is build time; the list only updates on the next deploy.
 */
export async function getListed(now: Date = new Date()): Promise<PreownedBike[]> {
  const cutoff = now.getTime() - SOLD_LIST_DAYS * 86_400_000;
  return (await getAll()).filter((b) => {
    if (b.status !== "sold") return true;
    const when = b.soldDate ?? b.date;
    return when ? Date.parse(when) >= cutoff : true;
  });
}
