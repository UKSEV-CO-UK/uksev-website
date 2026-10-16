import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import {
  USED_CONDITIONS,
  USED_STATUSES,
  defaultUsedOrder,
  type UsedBike,
  type UsedCondition,
  type UsedStatus,
} from "./used-types";

const CONTENT_DIR = path.join(process.cwd(), "content", "used");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const DEFAULT_LOCATION = "Abingdon OX13";
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Draft entries (e.g. the seeded EXAMPLE listings) are hidden from production
 * builds. They show in `next dev`, or in any build run with
 * NEXT_PUBLIC_SHOW_DRAFTS=1 (local preview only — never set it in CI/Pages).
 */
export const SHOW_DRAFTS =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_DRAFTS === "1";

// Markdown → HTML. Raw HTML in the body is dropped so CMS input can't inject markup.
const md = new Marked({ gfm: true, breaks: true });
md.use({ renderer: { html: () => "" } });

class UsedEntryError extends Error {
  constructor(file: string, msg: string) {
    super(`[used] content/used/${file}: ${msg}`);
    this.name = "UsedEntryError";
  }
}

function str(file: string, data: Record<string, unknown>, key: string, required: boolean) {
  const v = data[key];
  if (v == null || v === "") {
    if (required) throw new UsedEntryError(file, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof v !== "string" && typeof v !== "number")
    throw new UsedEntryError(file, `"${key}" must be text, got ${JSON.stringify(v)}`);
  return String(v).trim();
}

function num(
  file: string,
  data: Record<string, unknown>,
  key: string,
  required: boolean,
  min: number,
  max: number,
) {
  const v = data[key];
  if (v == null || v === "") {
    if (required) throw new UsedEntryError(file, `missing required field "${key}"`);
    return undefined;
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n < min || n > max)
    throw new UsedEntryError(
      file,
      `"${key}" must be a number between ${min} and ${max}, got ${JSON.stringify(v)}`,
    );
  return n;
}

function oneOf<T extends string>(
  file: string,
  data: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const v = data[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v))
    throw new UsedEntryError(
      file,
      `"${key}" must be one of ${allowed.join(" / ")}, got ${JSON.stringify(v)}`,
    );
  return v as T;
}

function bool(file: string, data: Record<string, unknown>, key: string): boolean {
  const v = data[key];
  if (v == null) return false;
  if (typeof v !== "boolean")
    throw new UsedEntryError(file, `"${key}" must be true or false, got ${JSON.stringify(v)}`);
  return v;
}

function parseDate(file: string, data: Record<string, unknown>): string {
  const v = data.date;
  if (v == null || v === "") throw new UsedEntryError(file, `missing required field "date"`);
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime()))
    throw new UsedEntryError(file, `"date" is not a valid date: ${JSON.stringify(v)}`);
  return d.toISOString().slice(0, 10);
}

function parsePhotos(file: string, data: Record<string, unknown>): string[] {
  const v = data.photos;
  if (v == null) return [];
  if (!Array.isArray(v)) throw new UsedEntryError(file, `"photos" must be a list of image paths`);
  return v.map((p, i) => {
    // Decap/Sveltia list widgets may store either "path" or { photo: "path" }.
    const src = typeof p === "string" ? p : p && typeof p === "object" ? (p as Record<string, unknown>).photo : undefined;
    if (typeof src !== "string" || !src.trim())
      throw new UsedEntryError(file, `photos[${i}] is not an image path`);
    const s = src.trim();
    if (/^https?:\/\//.test(s)) return s;
    if (!s.startsWith("/"))
      throw new UsedEntryError(file, `photos[${i}] must start with "/" (e.g. /uploads/used/x.jpg), got "${s}"`);
    const local = path.join(PUBLIC_DIR, decodeURI(s));
    if (!local.startsWith(PUBLIC_DIR) || !fs.existsSync(local))
      throw new UsedEntryError(file, `photos[${i}] file not found in public/: "${s}"`);
    return s;
  });
}

function parseEntry(file: string): UsedBike {
  const slug = file.replace(/\.md$/, "");
  if (!SLUG_RE.test(slug))
    throw new UsedEntryError(
      file,
      `file name must be letters, digits, dashes or underscores (it becomes the URL /used/${slug}/)`,
    );
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    throw new UsedEntryError(file, `invalid frontmatter: ${(e as Error).message}`);
  }
  const data = parsed.data as Record<string, unknown>;
  const thisYear = new Date().getFullYear();

  return {
    slug,
    title: str(file, data, "title", true)!,
    brand: str(file, data, "brand", true)!,
    model: str(file, data, "model", true)!,
    year: num(file, data, "year", true, 2000, thisYear + 1)!,
    mileage: num(file, data, "mileage", true, 0, 1_000_000)!,
    batteryHealth: num(file, data, "batteryHealth", false, 0, 100),
    motor: str(file, data, "motor", false),
    battery: str(file, data, "battery", false),
    price: num(file, data, "price", true, 0, 1_000_000)!,
    condition: oneOf<UsedCondition>(file, data, "condition", USED_CONDITIONS),
    status: oneOf<UsedStatus>(file, data, "status", USED_STATUSES),
    location: str(file, data, "location", false) ?? DEFAULT_LOCATION,
    photos: parsePhotos(file, data),
    featured: bool(file, data, "featured"),
    date: parseDate(file, data),
    draft: bool(file, data, "draft"),
    bodyHtml: md.parse(parsed.content.trim(), { async: false }) as string,
  };
}

let cache: UsedBike[] | null = null;

/** Every entry, validated. Throws (failing the build) on the first bad file. */
function loadAll(): UsedBike[] {
  if (cache && process.env.NODE_ENV !== "development") return cache;
  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))
    : [];
  cache = files.map(parseEntry);
  return cache;
}

/** Published listings (drafts hidden in production), default order. */
export function getUsedBikes(): UsedBike[] {
  return loadAll()
    .filter((b) => SHOW_DRAFTS || !b.draft)
    .sort(defaultUsedOrder);
}

export function getUsedBike(slug: string): UsedBike | undefined {
  return getUsedBikes().find((b) => b.slug === slug);
}
