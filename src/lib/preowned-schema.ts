/**
 * Pre-owned listing rules: ONE copy, used by the build (src/lib/preowned.ts)
 * and by the admin (uksev-admin) in the browser before it publishes. Pure: no fs, no DOM.
 *
 * - normaliseBike(data, opts) turns frontmatter into typed fields and lists problems.
 * - validateBike(data, opts) answers "would the build accept this as a published listing?"
 */
import {
  GRADES,
  INSPECTION_RESULTS,
  STATUSES,
  TYPES,
  type Grade,
  type IncludedItem,
  type InspectionItem,
  type InspectionResult,
  type Photo,
  type PreownedBike,
  type Status,
  type VehicleType,
} from "./preowned-types";

export type FieldError = { field: string; message: string };
type Data = Record<string, unknown>;

export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Required to publish (photos = at least one). */
export const REQUIRED_FIELDS = ["brand", "model", "year", "mileage", "price", "photos"] as const;

export const LIMITS = {
  year: [2000, 0 /* this year + 1, see yearMax */],
  mileage: [0, 200_000],
  batteryWh: [50, 5000],
  batteryHealth: [0, 100],
  chargeCycles: [0, 10_000],
  motorW: [50, 10_000],
  range: [1, 500],
  price: [0, 100_000],
  newPrice: [0, 100_000],
} as const;

export type NormaliseOptions = {
  /** Does this site path (e.g. /uploads/pre-owned/x.webp) exist? Build checks public/, admin checks its upload list. Omit to skip. */
  photoExists?: (src: string) => boolean;
  /** Clock for the "year ≤ this year + 1" rule. */
  now?: Date;
  /** Admin, new listing: `type` must be chosen explicitly (files without it still default to e-bike). */
  requireType?: boolean;
};

export type BikeFields = Omit<PreownedBike, "slug" | "descriptionHtml">;

export type NormaliseResult = {
  bike: BikeFields;
  /** Wrong values (bad number, bad path…). Always fatal. */
  errors: FieldError[];
  /** Required fields that are empty. Fatal unless the file is a repo draft. */
  missing: FieldError[];
  /** Dropped rows etc. Never fatal. */
  warnings: FieldError[];
};

class Checker {
  errors: FieldError[] = [];
  warnings: FieldError[] = [];
  missing: FieldError[] = [];
  constructor(private data: Data) {}
  private empty(k: string) {
    const v = this.data[k];
    return v == null || v === "";
  }
  private need(k: string) {
    this.missing.push({ field: k, message: `missing required "${k}"` });
  }
  text(k: string, required = false): string | undefined {
    if (this.empty(k)) {
      if (required) this.need(k);
      return undefined;
    }
    const v = this.data[k];
    if (typeof v !== "string" && typeof v !== "number") {
      this.errors.push({ field: k, message: `"${k}" must be text` });
      return undefined;
    }
    const s = String(v).trim();
    if (!s && required) this.need(k);
    return s || undefined;
  }
  num(k: string, min: number, max: number, required = false): number | undefined {
    if (this.empty(k)) {
      if (required) this.need(k);
      return undefined;
    }
    const raw = this.data[k];
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[£,\s]/g, ""));
    if (!Number.isFinite(n) || n < min || n > max) {
      this.errors.push({ field: k, message: `"${k}" must be a number ${min}–${max}, got ${JSON.stringify(raw)}` });
      return undefined;
    }
    return n;
  }
  pick<T extends string>(k: string, allowed: readonly T[], fallback?: T, required = false): T | undefined {
    if (this.empty(k)) {
      if (required) this.need(k);
      return fallback;
    }
    const v = this.data[k];
    if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
      this.errors.push({ field: k, message: `"${k}" must be one of ${allowed.join(" / ")}, got ${JSON.stringify(v)}` });
      return fallback;
    }
    return v as T;
  }
  bool(k: string): boolean {
    const v = this.data[k];
    if (v == null) return false;
    if (typeof v !== "boolean") {
      this.errors.push({ field: k, message: `"${k}" must be true or false` });
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
      this.errors.push({ field: k, message: `"${k}" must be a date like 2026-10-09, got ${JSON.stringify(v)}` });
      return undefined;
    }
    return s;
  }
  photos(exists?: (src: string) => boolean): Photo[] {
    const v = this.data.photos;
    if (v == null) return [];
    if (!Array.isArray(v)) {
      this.errors.push({ field: "photos", message: `"photos" must be a list` });
      return [];
    }
    const out: Photo[] = [];
    v.forEach((p, i) => {
      const o = p && typeof p === "object" ? (p as Data) : null;
      const src = typeof p === "string" ? p : (o?.src ?? o?.photo);
      const caption = o && typeof o.caption === "string" ? o.caption.trim() : undefined;
      if (typeof src !== "string" || !src.trim()) {
        this.errors.push({ field: "photos", message: `photos[${i}] is not an image path` });
        return;
      }
      const s = src.trim();
      if (!/^https?:\/\//.test(s)) {
        if (!s.startsWith("/")) {
          this.errors.push({ field: "photos", message: `photos[${i}] must start with "/" (e.g. /uploads/pre-owned/x.jpg)` });
          return;
        }
        if (s.split("/").includes("..")) {
          this.errors.push({ field: "photos", message: `photos[${i}] must not contain ".."` });
          return;
        }
        if (exists && !exists(s)) {
          this.errors.push({ field: "photos", message: `photos[${i}] file not found in public/: ${s}` });
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
      this.errors.push({ field: "inspection", message: `"inspection" must be a list of { item, result, text }` });
      return [];
    }
    const out: InspectionItem[] = [];
    v.forEach((row, i) => {
      const o = row && typeof row === "object" ? (row as Data) : null;
      const item = typeof o?.item === "string" ? o.item.trim() : "";
      const result = o?.result;
      // Agreed contract: rows without an item or with an unknown result are dropped, not fatal.
      if (!item || typeof result !== "string" || !(INSPECTION_RESULTS as readonly string[]).includes(result)) {
        this.warnings.push({
          field: "inspection",
          message: `inspection[${i}] dropped (needs item + result ${INSPECTION_RESULTS.join("/")})`,
        });
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
      this.errors.push({ field: "included", message: `"included" must be a list` });
      return [];
    }
    const out: IncludedItem[] = [];
    v.forEach((row, i) => {
      const o = row && typeof row === "object" ? (row as Data) : null;
      const item = typeof row === "string" ? row.trim() : typeof o?.item === "string" ? o.item.trim() : "";
      if (!item) {
        this.warnings.push({ field: "included", message: `included[${i}] dropped (no item)` });
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

export const yearMax = (now: Date = new Date()) => now.getFullYear() + 1;

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug);
}

/** Frontmatter → typed fields + problems. Same code path for build and admin. */
export function normaliseBike(data: Data, opts: NormaliseOptions = {}): NormaliseResult {
  const c = new Checker(data ?? {});
  const L = LIMITS;
  const bike: BikeFields = {
    type: c.pick<VehicleType>("type", TYPES, "e-bike", opts.requireType)!,
    brand: c.text("brand", true) as string,
    model: c.text("model", true) as string,
    year: c.num("year", L.year[0], yearMax(opts.now), true) as number,
    mileage: c.num("mileage", ...L.mileage, true) as number,
    batteryWh: c.num("batteryWh", ...L.batteryWh),
    batteryHealth: c.num("batteryHealth", ...L.batteryHealth),
    chargeCycles: c.num("chargeCycles", ...L.chargeCycles),
    batterySource: c.text("batterySource"),
    motorW: c.num("motorW", ...L.motorW),
    frameSize: c.text("frameSize"),
    wheelSize: c.text("wheelSize"),
    range: c.num("range", ...L.range),
    price: c.num("price", ...L.price, true) as number,
    newPrice: c.num("newPrice", ...L.newPrice),
    grade: c.pick<Grade>("grade", GRADES),
    colour: c.text("colour"),
    serviceHistory: c.text("serviceHistory"),
    photos: c.photos(opts.photoExists),
    inspection: c.inspection(),
    included: c.included(),
    status: c.pick<Status>("status", STATUSES, "available")!,
    soldDate: c.date("soldDate"),
    date: c.date("date"),
    draft: c.bool("draft"),
  };
  if (bike.photos.length === 0 && !c.errors.some((e) => e.field === "photos"))
    c.missing.push({ field: "photos", message: `missing required "photos (at least one)"` });
  return { bike, errors: c.errors, missing: c.missing, warnings: c.warnings };
}

export type ValidateResult = {
  ok: boolean;
  /** Blocking: missing required fields first, then wrong values. */
  errors: FieldError[];
  /** Non-blocking hints (e.g. no battery reading). */
  warnings: FieldError[];
};

/** Would the build accept `data` as a PUBLISHED listing (draft not set)? */
export function validateBike(data: Data, opts: NormaliseOptions = {}): ValidateResult {
  const r = normaliseBike(data, opts);
  const errors = [...r.missing, ...r.errors];
  const warnings = [...r.warnings];
  if (r.bike.batteryHealth == null && r.bike.chargeCycles == null)
    warnings.push({ field: "batteryHealth", message: "Battery reading recommended" });
  return { ok: errors.length === 0, errors, warnings };
}
