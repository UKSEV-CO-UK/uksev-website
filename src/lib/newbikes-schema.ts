/**
 * New-bike listing rules: ONE copy, used by the build (src/lib/newbikes.ts)
 * and later by the admin. Pure: no fs, no DOM.
 *
 * C21 is the first file written against this shape.
 */
import {
  ARRIVAL_RE,
  AVAILABILITIES,
  TYPES,
  type Availability,
  type Colour,
  type Edition,
  type FrameSize,
  type NewBike,
  type Photo,
  type SpecRow,
  type VehicleType,
} from "./newbikes-types";

export type FieldError = { field: string; message: string };
type Data = Record<string, unknown>;

export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
/** Cover photos (and any other listing photos) live under this prefix. */
export const PHOTO_PREFIX = "/uploads/new/";

export const REQUIRED_FIELDS = ["brand", "model", "price", "colours"] as const;

export const LIMITS = {
  price: [0, 100_000],
  wasPrice: [0, 100_000],
  rangeKm: [1, 1000],
  rangeMiles: [1, 500],
  weightKg: [1, 200],
  topSpeedKmh: [1, 80],
  batteryWh: [50, 5000],
  motorW: [50, 10_000],
} as const;

export type NormaliseOptions = {
  /** Does this site path (e.g. /uploads/new/x.webp) exist? Omit to skip. */
  photoExists?: (src: string) => boolean;
};

export type BikeFields = Omit<NewBike, "slug" | "descriptionHtml">;

export type NormaliseResult = {
  bike: BikeFields;
  errors: FieldError[];
  missing: FieldError[];
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
      this.errors.push({
        field: k,
        message: `"${k}" must be a number ${min}–${max}, got ${JSON.stringify(raw)}`,
      });
      return undefined;
    }
    return n;
  }
  pick<T extends string>(
    k: string,
    allowed: readonly T[],
    fallback?: T,
    required = false,
  ): T | undefined {
    if (this.empty(k)) {
      if (required) this.need(k);
      return fallback;
    }
    const v = this.data[k];
    if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
      this.errors.push({
        field: k,
        message: `"${k}" must be one of ${allowed.join(" / ")}, got ${JSON.stringify(v)}`,
      });
      return fallback;
    }
    return v as T;
  }
  date(k: string): string | undefined {
    if (this.empty(k)) return undefined;
    const raw = this.data[k];
    let s: string | undefined;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      s = raw.toISOString().slice(0, 10);
    } else if (typeof raw === "string" && DATE_RE.test(raw.trim())) {
      s = raw.trim();
    }
    if (!s) {
      this.errors.push({ field: k, message: `"${k}" must be a date like 2026-10-09` });
      return undefined;
    }
    return s;
  }
}

function parsePhoto(
  raw: unknown,
  field: string,
  errors: FieldError[],
  photoExists?: (src: string) => boolean,
): Photo | null {
  const src =
    typeof raw === "string"
      ? raw.trim()
      : raw && typeof raw === "object" && typeof (raw as { src?: unknown }).src === "string"
        ? String((raw as { src: string }).src).trim()
        : "";
  if (!src) {
    errors.push({ field, message: `${field} is not an image path` });
    return null;
  }
  if (!src.startsWith("/")) {
    errors.push({ field, message: `${field} must start with "/"` });
    return null;
  }
  if (src.split("/").includes("..")) {
    errors.push({ field, message: `${field} must not contain ".."` });
    return null;
  }
  if (!src.startsWith(PHOTO_PREFIX)) {
    errors.push({ field, message: `${field} must start with "${PHOTO_PREFIX}"` });
    return null;
  }
  if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(src)) {
    errors.push({ field, message: `${field} is not an image path` });
    return null;
  }
  if (photoExists && !photoExists(src)) {
    errors.push({ field, message: `${field} not found: ${src}` });
    return null;
  }
  const caption =
    raw && typeof raw === "object" && typeof (raw as { caption?: unknown }).caption === "string"
      ? String((raw as { caption: string }).caption).trim() || undefined
      : undefined;
  return { src, ...(caption ? { caption } : {}) };
}

function parseColours(
  raw: unknown,
  errors: FieldError[],
  missing: FieldError[],
  photoExists?: (src: string) => boolean,
): Colour[] {
  if (raw == null || raw === "") {
    missing.push({ field: "colours", message: 'missing required "colours"' });
    return [];
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    missing.push({ field: "colours", message: 'missing required "colours"' });
    return [];
  }
  const out: Colour[] = [];
  raw.forEach((row, i) => {
    const field = `colours[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (!o) {
      errors.push({ field, message: `${field} must be a colour with a name and photos` });
      return;
    }
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) {
      errors.push({ field, message: `${field}.name is missing` });
      return;
    }
    let swatch: string | undefined;
    if (o.swatch != null && o.swatch !== "") {
      if (typeof o.swatch !== "string" || !HEX_RE.test(o.swatch.trim())) {
        errors.push({ field, message: `${field}.swatch must be a hex colour like #5c5f63` });
      } else {
        swatch = o.swatch.trim();
      }
    }
    const photosRaw = o.photos ?? o.src;
    const list = Array.isArray(photosRaw) ? photosRaw : photosRaw != null ? [photosRaw] : [];
    if (list.length === 0) {
      errors.push({ field, message: `${field} needs at least one photo` });
      return;
    }
    const photos = list
      .map((p, j) => parsePhoto(p, `${field}.photos[${j}]`, errors, photoExists))
      .filter((p): p is Photo => p != null);
    if (!photos.length) return;
    out.push({ name, photos, ...(swatch ? { swatch } : {}) });
  });
  return out;
}

function parseSizes(raw: unknown, errors: FieldError[]): FrameSize[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: "sizes", message: '"sizes" must be a list' });
    return [];
  }
  const out: FrameSize[] = [];
  raw.forEach((row, i) => {
    const field = `sizes[${i}]`;
    if (typeof row === "string" && row.trim()) {
      out.push({ name: row.trim() });
      return;
    }
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const name = o && typeof o.name === "string" ? o.name.trim() : "";
    if (!name) {
      errors.push({ field, message: `${field}.name is missing` });
      return;
    }
    const riderHeight =
      o && typeof o.riderHeight === "string" ? o.riderHeight.trim() || undefined : undefined;
    out.push({ name, ...(riderHeight ? { riderHeight } : {}) });
  });
  return out;
}

function parseEditions(
  raw: unknown,
  errors: FieldError[],
): Edition[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: "editions", message: '"editions" must be a list' });
    return [];
  }
  const out: Edition[] = [];
  raw.forEach((row, i) => {
    const field = `editions[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (!o) {
      errors.push({ field, message: `${field} must be an edition with a name and price` });
      return;
    }
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const priceRaw = o.price;
    const price =
      typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw ?? "").replace(/[£,\s]/g, ""));
    if (!name || !Number.isFinite(price) || price < 0 || price > 100_000) {
      errors.push({ field, message: `${field} needs a name and a price in range` });
      return;
    }
    let wasPrice: number | undefined;
    if (o.wasPrice != null && o.wasPrice !== "") {
      const w =
        typeof o.wasPrice === "number"
          ? o.wasPrice
          : Number(String(o.wasPrice).replace(/[£,\s]/g, ""));
      if (!Number.isFinite(w) || w < 0 || w > 100_000) {
        errors.push({ field, message: `${field}.wasPrice must be a number 0–100000` });
      } else if (w <= price) {
        errors.push({ field, message: `${field}.wasPrice must be higher than price` });
      } else {
        wasPrice = w;
      }
    }
    let rangeKm: number | undefined;
    if (o.rangeKm != null && o.rangeKm !== "") {
      const r = typeof o.rangeKm === "number" ? o.rangeKm : Number(o.rangeKm);
      if (!Number.isFinite(r) || r < 1 || r > 1000) {
        errors.push({ field, message: `${field}.rangeKm must be a number 1–1000` });
      } else {
        rangeKm = r;
      }
    }
    const note = typeof o.note === "string" ? o.note.trim() || undefined : undefined;
    out.push({ name, price, ...(wasPrice != null ? { wasPrice } : {}), ...(rangeKm != null ? { rangeKm } : {}), ...(note ? { note } : {}) });
  });
  return out;
}

function parseSpecs(raw: unknown, errors: FieldError[]): SpecRow[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push({ field: "specs", message: '"specs" must be a list' });
    return [];
  }
  const out: SpecRow[] = [];
  raw.forEach((row, i) => {
    const field = `specs[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const label = o && typeof o.label === "string" ? o.label.trim() : "";
    const value = o && (typeof o.value === "string" || typeof o.value === "number") ? String(o.value).trim() : "";
    if (!label || !value) {
      errors.push({ field, message: `${field} needs a label and a value` });
      return;
    }
    out.push({ label, value });
  });
  return out;
}

export function normaliseNewBike(data: Data, opts: NormaliseOptions = {}): NormaliseResult {
  const c = new Checker(data);
  const type = c.pick("type", TYPES, "e-bike") ?? "e-bike";
  const brand = c.text("brand", true) ?? "";
  const model = c.text("model", true) ?? "";
  const price = c.num("price", ...LIMITS.price, true) ?? 0;
  const wasPrice = c.num("wasPrice", ...LIMITS.wasPrice);
  if (wasPrice != null && wasPrice <= price) {
    c.errors.push({ field: "wasPrice", message: "Was price must be higher than Price" });
  }
  const availability = c.pick("availability", AVAILABILITIES, "check") ?? "check";
  const arrivalRaw = c.text("arrival");
  let arrival: string | undefined;
  if (arrivalRaw) {
    if (!ARRIVAL_RE.test(arrivalRaw)) {
      c.errors.push({ field: "arrival", message: '"arrival" must be a month like 2026-12' });
    } else {
      arrival = arrivalRaw;
    }
  }
  if (availability === "arriving" && !arrivalRaw) {
    c.errors.push({ field: "arrival", message: '"arrival" is required when availability is "arriving"' });
  }
  const colours = parseColours(data.colours, c.errors, c.missing, opts.photoExists);
  const sizes = parseSizes(data.sizes, c.errors);
  const editions = parseEditions(data.editions, c.errors);
  const rangeKm = c.num("rangeKm", ...LIMITS.rangeKm);
  const rangeMiles = c.num("rangeMiles", ...LIMITS.rangeMiles);
  const weightKg = c.num("weightKg", ...LIMITS.weightKg);
  const topSpeedKmh = c.num("topSpeedKmh", ...LIMITS.topSpeedKmh);
  const battery = c.text("battery");
  const batteryWh = c.num("batteryWh", ...LIMITS.batteryWh);
  const motorW = c.num("motorW", ...LIMITS.motorW);
  const specs = parseSpecs(data.specs, c.errors);
  const date = c.date("date");

  const bike: BikeFields = {
    type: type as VehicleType,
    brand,
    model,
    price,
    ...(wasPrice != null && wasPrice > price ? { wasPrice } : {}),
    availability: availability as Availability,
    ...(arrival ? { arrival } : {}),
    colours,
    sizes,
    editions,
    ...(rangeKm != null ? { rangeKm } : {}),
    ...(rangeMiles != null ? { rangeMiles } : {}),
    ...(weightKg != null ? { weightKg } : {}),
    ...(topSpeedKmh != null ? { topSpeedKmh } : {}),
    ...(battery ? { battery } : {}),
    ...(batteryWh != null ? { batteryWh } : {}),
    ...(motorW != null ? { motorW } : {}),
    specs,
    ...(date ? { date } : {}),
  };
  return { bike, errors: c.errors, missing: c.missing, warnings: c.warnings };
}

export function validateNewBike(
  data: Data,
  opts: NormaliseOptions = {},
): { ok: boolean; errors: FieldError[]; warnings: FieldError[] } {
  const r = normaliseNewBike(data, opts);
  const errors = [...r.missing, ...r.errors];
  return { ok: errors.length === 0, errors, warnings: r.warnings };
}
