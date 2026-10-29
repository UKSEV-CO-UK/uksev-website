/**
 * Pure helpers + check logic for admin/content CI (content-guard).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import {
  LIMITS,
  yearMax,
  validateBike,
  type FieldError,
} from "../src/lib/preowned-schema";

/** Same limit as uksev-admin `MAX_PHOTO_BYTES`. */
export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
export const MAX_PHOTO_MB = 2.5;

export const ALLOWED_PREFIXES = [
  "content/pre-owned/",
  "public/uploads/pre-owned/",
] as const;

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|svg)$/i;

export type Annotation = { file: string; message: string };

export function isAllowedPath(p: string): boolean {
  const n = p.replace(/\\/g, "/");
  return ALLOWED_PREFIXES.some(
    (prefix) => n === prefix.slice(0, -1) || n.startsWith(prefix),
  );
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    brand: "Brand",
    model: "Model",
    year: "Year",
    mileage: "Mileage",
    price: "Price",
    newPrice: "New price",
    photos: "Photos",
    type: "Type",
    grade: "Grade",
    status: "Status",
    colour: "Colour",
    batteryWh: "Battery capacity (Wh)",
    batteryHealth: "Battery health (%)",
    chargeCycles: "Charge cycles",
    batterySource: "Battery source",
    motorW: "Motor (W)",
    frameSize: "Frame size",
    wheelSize: "Wheel size",
    range: "Range",
    serviceHistory: "Service history",
    soldDate: "Sold date",
    date: "Listed date",
    draft: "Draft",
    inspection: "Inspection",
    included: "Included items",
  };
  return labels[field] ?? field.charAt(0).toUpperCase() + field.slice(1);
}

/** Staff-readable English for a schema FieldError (annotation body). */
export function friendlySchemaMessage(err: FieldError): string {
  const f = err.field;
  const m = err.message;

  if (m.startsWith("missing required")) {
    if (f === "photos") return "At least one photo is required";
    return `${fieldLabel(f)} is missing`;
  }

  if (f === "photos") {
    const idx = m.match(/photos\[(\d+)\]/);
    const n = idx ? Number(idx[1]) + 1 : null;
    if (m.includes("not found")) {
      const src = m.split(": ").pop() ?? "";
      return n
        ? `Photo ${n} was not found in the repo (${src})`
        : `A photo was not found in the repo (${src})`;
    }
    if (m.includes("must start with"))
      return n ? `Photo ${n} path must start with "/"` : 'Photo path must start with "/"';
    if (m.includes('".."'))
      return n ? `Photo ${n} path must not contain ".."` : 'Photo path must not contain ".."';
    if (m.includes("not an image path"))
      return n ? `Photo ${n} is not a valid image path` : "A photo entry is not a valid image path";
    if (m.includes("must be a list")) return "Photos must be a list";
    return n ? `Photo ${n}: ${m}` : m;
  }

  if (m.includes("must be a number")) {
    const range = LIMITS[f as keyof typeof LIMITS];
    if (range) {
      const max = f === "year" ? yearMax() : range[1];
      return `${fieldLabel(f)} must be a number between ${range[0]} and ${max}`;
    }
    return `${fieldLabel(f)} must be a number in range`;
  }

  if (m.includes("must be one of")) {
    const opts = m.replace(/^.*must be one of\s*/, "").replace(/,\s*got.*/, "");
    return `${fieldLabel(f)} must be one of: ${opts.replace(/\s*\/\s*/g, ", ")}`;
  }

  if (m.includes("must be a date")) return `${fieldLabel(f)} must be a date like 2026-10-09`;
  if (m.includes("must be true or false")) return `${fieldLabel(f)} must be true or false`;
  if (m.includes("must be text")) return `${fieldLabel(f)} must be text`;
  if (m.includes("must be a list")) return `${fieldLabel(f)} must be a list`;

  return `${fieldLabel(f)}: ${m}`;
}

export function photoOversizeMessage(
  photoIndex1Based: number | null,
  sizeBytes: number,
): string {
  const mb = (sizeBytes / (1024 * 1024)).toFixed(2);
  if (photoIndex1Based != null) {
    return `Photo ${photoIndex1Based} is over ${MAX_PHOTO_MB} MB (file is ${mb} MB)`;
  }
  return `This photo is over ${MAX_PHOTO_MB} MB (file is ${mb} MB)`;
}

export function pathViolationMessage(p: string): string {
  return `File is outside the allowed paths (only content/pre-owned/ and public/uploads/pre-owned/ may change): ${p}`;
}

function gitDiffNames(base: string, head: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function gitDiffNameStatus(base: string, head: string): { status: string; path: string }[] {
  const out = execFileSync("git", ["diff", "--name-status", `${base}...${head}`], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0][0];
      const filePath = status === "R" || status === "C" ? (parts[2] ?? parts[1]) : parts[1];
      return { status, path: filePath };
    });
}

function publicPathFromSrc(src: string): string | null {
  if (!src.startsWith("/") || src.split("/").includes("..")) return null;
  return path.join("public", decodeURI(src.slice(1)));
}

export function checkListingFile(
  filePath: string,
  opts: { photoExists?: (src: string) => boolean; cwd?: string } = {},
): Annotation[] {
  const anns: Annotation[] = [];
  const root = opts.cwd ?? process.cwd();
  const abs = path.resolve(root, filePath);
  if (!fs.existsSync(abs)) {
    anns.push({ file: filePath, message: "Listing file was deleted or is missing" });
    return anns;
  }
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    anns.push({
      file: filePath,
      message: `Could not read frontmatter — ${(e as Error).message}`,
    });
    return anns;
  }

  const data = parsed.data as Record<string, unknown>;
  const photoExists =
    opts.photoExists ??
    ((src: string) => {
      const rel = publicPathFromSrc(src);
      return rel != null && fs.existsSync(path.resolve(root, rel));
    });

  const result = validateBike(data, { photoExists });
  for (const err of result.errors) {
    anns.push({ file: filePath, message: friendlySchemaMessage(err) });
  }

  const photos = Array.isArray(data.photos) ? data.photos : [];
  photos.forEach((p, i) => {
    const o = p && typeof p === "object" ? (p as Record<string, unknown>) : null;
    const src =
      typeof p === "string"
        ? p
        : typeof o?.src === "string"
          ? o.src
          : typeof o?.photo === "string"
            ? o.photo
            : null;
    if (!src || typeof src !== "string" || /^https?:\/\//.test(src)) return;
    const rel = publicPathFromSrc(src.trim());
    if (!rel) return;
    const absPhoto = path.resolve(root, rel);
    if (!fs.existsSync(absPhoto)) return;
    const size = fs.statSync(absPhoto).size;
    if (size > MAX_PHOTO_BYTES) {
      anns.push({
        file: rel.replace(/\\/g, "/"),
        message: photoOversizeMessage(i + 1, size),
      });
    }
  });

  return anns;
}

export function checkImageFile(filePath: string, cwd = process.cwd()): Annotation[] {
  if (!IMAGE_RE.test(filePath)) return [];
  const abs = path.resolve(cwd, filePath);
  if (!fs.existsSync(abs)) return [];
  const size = fs.statSync(abs).size;
  if (size > MAX_PHOTO_BYTES) {
    return [{ file: filePath, message: photoOversizeMessage(null, size) }];
  }
  return [];
}

export function runGuard(
  base: string,
  head: string,
  cwd = process.cwd(),
): { ok: boolean; annotations: Annotation[]; changed: string[] } {
  const prev = process.cwd();
  try {
    process.chdir(cwd);
    const changed = gitDiffNames(base, head);
    const statuses = gitDiffNameStatus(base, head);
    const annotations: Annotation[] = [];

    for (const p of changed) {
      if (!isAllowedPath(p)) {
        annotations.push({ file: p, message: pathViolationMessage(p) });
      }
    }

    for (const { status, path: p } of statuses) {
      if (status === "D") continue;
      if (p.startsWith("content/pre-owned/") && p.endsWith(".md")) {
        annotations.push(...checkListingFile(p, { cwd }));
      } else if (p.startsWith("public/uploads/pre-owned/")) {
        // Skip if a listing already flagged this file (e.g. Photo N oversize).
        if (!annotations.some((a) => a.file === p)) {
          annotations.push(...checkImageFile(p, cwd));
        }
      }
    }

    // Dedupe identical file+message pairs (listing Photo N + standalone image check).
    const seen = new Set<string>();
    const unique = annotations.filter((a) => {
      const k = `${a.file}\0${a.message}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return { ok: unique.length === 0, annotations: unique, changed };
  } finally {
    process.chdir(prev);
  }
}

export function formatSummary(
  ok: boolean,
  annotations: Annotation[],
  changed: string[],
): string {
  const lines: string[] = [];
  lines.push("## content-guard");
  lines.push("");
  lines.push(ok ? "**Result:** pass" : "**Result:** fail");
  lines.push("");
  lines.push(`Changed files: ${changed.length}`);
  if (changed.length) {
    lines.push("");
    for (const p of changed) lines.push(`- \`${p}\``);
  }
  if (annotations.length) {
    lines.push("");
    lines.push("### Problems");
    lines.push("");
    for (const a of annotations) {
      lines.push(`- **${a.file}** — ${a.message}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function emitAnnotation(ann: Annotation): void {
  const msg = ann.message.replace(/\r?\n/g, " ");
  console.log(`::error file=${ann.file}::${msg}`);
}
