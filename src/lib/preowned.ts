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
import {
  GRADES,
  INSPECTION_RESULTS,
  STATUSES,
  newestFirst,
  type Grade,
  type IncludedItem,
  type InspectionItem,
  type InspectionResult,
  type Photo,
  type PreownedBike,
  type Status,
} from "./preowned-types";

const CONTENT_DIR = path.join(process.cwd(), "content", "pre-owned");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const DEFAULT_LOCATION = "Steventon, Abingdon OX13";
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Sold bikes drop off the list this many days after soldDate (detail page stays). */
export const SOLD_LIST_DAYS = 30;

/**
 * Drafts are hidden from production builds. They show in `next dev`, or in a
 * build run with NEXT_PUBLIC_SHOW_DRAFTS=1 (local preview only, never CI/Pages).
 */
const SHOW_DRAFTS =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SHOW_DRAFTS === "1";

const md = new Marked({ gfm: true, breaks: true });
md.use({ renderer: { html: () => "" } }); // drop raw HTML from bodies

type Data = Record<string, unknown>;

/** Collects problems for one file so the build error lists all of them at once. */
class Checker {
  errors: string[] = [];
  warnings: string[] = [];
  missing: string[] = [];
  constructor(private data: Data) {}
  private empty(k: string) {
    const v = this.data[k];
    return v == null || v === "";
  }
  text(k: string, required = false): string | undefined {
    if (this.empty(k)) {
      if (required) this.missing.push(k);
      return undefined;
    }
    const v = this.data[k];
    if (typeof v !== "string" && typeof v !== "number") {
      this.errors.push(`"${k}" must be text`);
      return undefined;
    }
    return String(v).trim();
  }
  num(k: string, min: number, max: number, required = false): number | undefined {
    if (this.empty(k)) {
      if (required) this.missing.push(k);
      return undefined;
    }
    const raw = this.data[k];
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[£,\s]/g, ""));
    if (!Number.isFinite(n) || n < min || n > max) {
      this.errors.push(`"${k}" must be a number ${min}–${max}, got ${JSON.stringify(raw)}`);
      return undefined;
    }
    return n;
  }
  pick<T extends string>(k: string, allowed: readonly T[], fallback?: T): T | undefined {
    if (this.empty(k)) return fallback;
    const v = this.data[k];
    if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
      this.errors.push(`"${k}" must be one of ${allowed.join(" / ")}, got ${JSON.stringify(v)}`);
      return fallback;
    }
    return v as T;
  }
  bool(k: string): boolean {
    const v = this.data[k];
    if (v == null) return false;
    if (typeof v !== "boolean") {
      this.errors.push(`"${k}" must be true or false`);
      return false;
    }
    return v;
  }
  date(k: string): string | undefined {
    if (this.empty(k)) return undefined;
    const v = this.data[k];
    // YAML turns 2026-10-09 into a Date (UTC midnight)
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
    if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) {
      this.errors.push(`"${k}" must be a date like 2026-10-09, got ${JSON.stringify(v)}`);
      return undefined;
    }
    return s;
  }
  photos(): Photo[] {
    const v = this.data.photos;
    if (v == null) return [];
    if (!Array.isArray(v)) {
      this.errors.push(`"photos" must be a list`);
      return [];
    }
    const out: Photo[] = [];
    v.forEach((p, i) => {
      const o = p && typeof p === "object" ? (p as Data) : null;
      const src = typeof p === "string" ? p : (o?.src ?? o?.photo);
      const caption = o && typeof o.caption === "string" ? o.caption.trim() : undefined;
      if (typeof src !== "string" || !src.trim()) {
        this.errors.push(`photos[${i}] is not an image path`);
        return;
      }
      const s = src.trim();
      if (!/^https?:\/\//.test(s)) {
        if (!s.startsWith("/")) {
          this.errors.push(`photos[${i}] must start with "/" (e.g. /uploads/pre-owned/x.jpg)`);
          return;
        }
        const local = path.join(PUBLIC_DIR, decodeURI(s));
        if (!local.startsWith(PUBLIC_DIR) || !fs.existsSync(local)) {
          this.errors.push(`photos[${i}] file not found in public/: ${s}`);
          return;
        }
      }
      out.push({ src: s, caption: caption || undefined });
    });
    return out;
  }
  inspection(): InspectionItem[] {
    const v = this.data.inspection;
    if (v == null) return [];
    if (!Array.isArray(v)) {
      this.errors.push(`"inspection" must be a list of { item, result, text }`);
      return [];
    }
    const out: InspectionItem[] = [];
    v.forEach((row, i) => {
      const o = row && typeof row === "object" ? (row as Data) : null;
      const item = typeof o?.item === "string" ? o.item.trim() : "";
      const result = o?.result;
      // Agreed contract: rows without an item or with an unknown result are dropped, not fatal.
      if (!item || typeof result !== "string" || !(INSPECTION_RESULTS as readonly string[]).includes(result)) {
        this.warnings.push(`inspection[${i}] dropped (needs item + result ${INSPECTION_RESULTS.join("/")})`);
        return;
      }
      const t = o?.text ?? o?.note; // `text` (optional); `note` accepted as an alias
      out.push({ item, result: result as InspectionResult, text: typeof t === "string" && t.trim() ? t.trim() : undefined });
    });
    return out;
  }
  included(): IncludedItem[] {
    const v = this.data.included;
    if (v == null) return [];
    if (!Array.isArray(v)) {
      this.errors.push(`"included" must be a list`);
      return [];
    }
    const out: IncludedItem[] = [];
    v.forEach((row, i) => {
      const o = row && typeof row === "object" ? (row as Data) : null;
      const item = typeof row === "string" ? row.trim() : typeof o?.item === "string" ? o.item.trim() : "";
      if (!item) {
        this.warnings.push(`included[${i}] dropped (no item)`);
        return;
      }
      const t = o?.text;
      out.push({
        item,
        text: typeof t === "string" && t.trim() ? t.trim() : undefined,
        included: o?.included === false ? false : true,
      });
    });
    return out;
  }
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
  const c = new Checker(parsed.data as Data);
  const thisYear = new Date().getFullYear();

  const draft = c.bool("draft");
  const bike = {
    slug,
    brand: c.text("brand", true),
    model: c.text("model", true),
    year: c.num("year", 2000, thisYear + 1, true),
    mileage: c.num("mileage", 0, 200_000, true),
    batteryWh: c.num("batteryWh", 50, 5000),
    batteryHealth: c.num("batteryHealth", 0, 100),
    chargeCycles: c.num("chargeCycles", 0, 10_000),
    batterySource: c.text("batterySource"),
    motorW: c.num("motorW", 50, 10_000),
    frameSize: c.text("frameSize"),
    wheelSize: c.text("wheelSize"),
    range: c.num("range", 1, 500),
    price: c.num("price", 0, 100_000, true),
    newPrice: c.num("newPrice", 0, 100_000),
    grade: c.pick<Grade>("grade", GRADES),
    colour: c.text("colour"),
    serviceHistory: c.text("serviceHistory"),
    location: c.text("location") ?? DEFAULT_LOCATION,
    photos: c.photos(),
    inspection: c.inspection(),
    included: c.included(),
    status: c.pick<Status>("status", STATUSES, "available")!,
    soldDate: c.date("soldDate"),
    date: c.date("date"),
    draft,
    descriptionHtml: md.parse(parsed.content.trim(), { async: false }) as string,
  };
  if (bike.photos.length === 0 && !c.errors.some((e) => e.startsWith("photos"))) c.missing.push("photos (at least one)");

  for (const w of c.warnings) console.warn(`[pre-owned] ${where}: ${w}`);
  if (c.errors.length || c.missing.length) {
    const problems = [
      ...c.missing.map((k) => `missing required "${k}"`),
      ...c.errors,
    ];
    // Unfinished drafts are skipped (with a warning); anything published must be complete.
    if (draft && c.errors.length === 0) {
      console.warn(`[pre-owned] skipping incomplete draft ${where}: ${problems.join("; ")}`);
      return null;
    }
    throw new Error(`[pre-owned] ${where}:\n  - ${problems.join("\n  - ")}`);
  }
  return bike as PreownedBike;
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
