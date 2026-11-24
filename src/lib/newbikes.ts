/**
 * New-bike data access — the ONLY module that knows where bikes come from.
 *
 * Today: Markdown files in content/new/<slug>.md, read and validated at
 * build time (static export). Pages only use getAll / getBySlug / getListed.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import { featuredFirst, newestFirst, type NewBike } from "./newbikes-types";
import { SLUG_RE, normaliseNewBike } from "./newbikes-schema";

const CONTENT_DIR = path.join(process.cwd(), "content", "new");
const PUBLIC_DIR = path.join(process.cwd(), "public");

const md = new Marked({ gfm: true, breaks: true });
md.use({ renderer: { html: () => "" } });

function photoExists(src: string): boolean {
  const local = path.join(PUBLIC_DIR, decodeURI(src));
  return local.startsWith(PUBLIC_DIR) && fs.existsSync(local);
}

function parseFile(file: string): NewBike | null {
  const where = `content/new/${file}`;
  const slug = file.replace(/\.md$/, "");
  if (!SLUG_RE.test(slug))
    throw new Error(
      `[new] ${where}: file name must be letters, digits, - or _ (it becomes /shop/${slug}/)`,
    );

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
  } catch (e) {
    throw new Error(`[new] ${where}: invalid frontmatter — ${(e as Error).message}`);
  }
  const r = normaliseNewBike(parsed.data as Record<string, unknown>, { photoExists });
  for (const w of r.warnings) console.warn(`[new] ${where}: ${w.message}`);
  if (r.errors.length || r.missing.length) {
    const problems = [...r.missing, ...r.errors].map((e) => e.message);
    if (r.bike.hidden && r.errors.length === 0) {
      console.warn(`[new] skipping incomplete hidden listing ${where}: ${problems.join("; ")}`);
      return null;
    }
    throw new Error(`[new] ${where}:\n  - ${problems.join("\n  - ")}`);
  }
  if (r.bike.hidden) return null;
  return {
    slug,
    ...r.bike,
    descriptionHtml: md.parse(parsed.content.trim(), { async: false }) as string,
  };
}

let cache: NewBike[] | null = null;
function loadFiles(): NewBike[] {
  if (cache && process.env.NODE_ENV !== "development") return cache;
  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))
    : [];
  cache = files.map(parseFile).filter((b): b is NewBike => b != null);
  return cache;
}

/** Every published (non-hidden) bike, newest first. */
export async function getAll(): Promise<NewBike[]> {
  return [...loadFiles()].sort(newestFirst);
}

/** Every published bike in "Featured" order (see `featuredFirst`). */
export async function getListed(): Promise<NewBike[]> {
  return [...loadFiles()].sort(featuredFirst);
}

export async function getBySlug(slug: string): Promise<NewBike | undefined> {
  return loadFiles().find((b) => b.slug === slug);
}
