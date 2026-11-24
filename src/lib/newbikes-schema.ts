/**
 * New-bike listing rules: ONE copy, used by the build (src/lib/newbikes.ts)
 * and later by the admin. Pure: no fs, no DOM.
 *
 * C21 is the first file written against this shape.
 */
import {
  TYPES,
  type Colour,
  type Edition,
  type FrameSize,
  type NewBike,
  type Photo,
  type SpecRow,
  type VehicleType,
} from "./newbikes-types";

/**
 * Stable snake_case codes for every new-bike validation failure.
 * `field` and `message` stay as they are; the admin UI maps `code` to copy.
 */
export const NEW_BIKE_ERROR_CODES = [
  "battery_invalid",
  "battery_wh_invalid",
  "brand_missing",
  "colour_invalid",
  "colour_name_missing",
  "colour_photo_missing",
  "colour_swatch_invalid",
  "colours_missing",
  "date_invalid",
  "edition_invalid",
  "edition_price_missing",
  "edition_price_zero",
  "edition_range_invalid",
  "edition_was_price_invalid",
  "edition_was_price_not_higher",
  "hidden_invalid",
  "legacy_field_removed",
  "list_invalid",
  "model_missing",
  "motor_w_invalid",
  "order_invalid",
  "photo_not_found",
  "photo_src_invalid",
  "price_from_invalid",
  "price_invalid",
  "price_missing",
  "price_zero",
  "range_km_invalid",
  "range_miles_invalid",
  "size_invalid",
  "spec_row_invalid",
  "text_invalid",
  "top_speed_invalid",
  "type_invalid",
  "was_price_invalid",
  "was_price_not_higher",
  "weight_kg_invalid",
] as const;

export type NewBikeErrorCode = (typeof NEW_BIKE_ERROR_CODES)[number];

/** `code` is optional on the type for backward compatibility; every emitted error sets it. */
export type FieldError = { field: string; message: string; code?: NewBikeErrorCode };
type Data = Record<string, unknown>;

const fe = (field: string, message: string, code: NewBikeErrorCode): FieldError => ({
  field,
  message,
  code,
});

function requiredMissingCode(k: string): NewBikeErrorCode {
  switch (k) {
    case "brand":
      return "brand_missing";
    case "model":
      return "model_missing";
    case "price":
      return "price_missing";
    case "colours":
      return "colours_missing";
    default:
      throw new Error(`unmapped required field: ${k}`);
  }
}

function numInvalidCode(k: string): NewBikeErrorCode {
  switch (k) {
    case "price":
      return "price_invalid";
    case "wasPrice":
      return "was_price_invalid";
    case "rangeKm":
      return "range_km_invalid";
    case "rangeMiles":
      return "range_miles_invalid";
    case "weightKg":
      return "weight_kg_invalid";
    case "topSpeedKmh":
      return "top_speed_invalid";
    case "batteryWh":
      return "battery_wh_invalid";
    case "motorW":
      return "motor_w_invalid";
    case "order":
      return "order_invalid";
    default:
      throw new Error(`unmapped numeric field: ${k}`);
  }
}

function pickInvalidCode(k: string): NewBikeErrorCode {
  switch (k) {
    case "type":
      return "type_invalid";
    default:
      throw new Error(`unmapped pick field: ${k}`);
  }
}

export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
/** Cover photos (and any other listing photos) live under this prefix. */
export const PHOTO_PREFIX = "/uploads/new/";

/**
 * "colours" is satisfied by either a non-empty `colours` list or a non-empty
 * top-level `photos` list (listings whose colour names are unknown).
 */
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
  order: [0, 100_000],
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
    this.missing.push(fe(k, `missing required "${k}"`, requiredMissingCode(k)));
  }
  text(k: string, required = false): string | undefined {
    if (this.empty(k)) {
      if (required) this.need(k);
      return undefined;
    }
    const v = this.data[k];
    if (typeof v !== "string" && typeof v !== "number") {
      this.errors.push(
        fe(k, `"${k}" must be text`, k === "battery" ? "battery_invalid" : "text_invalid"),
      );
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
      this.errors.push(
        fe(k, `"${k}" must be a number ${min}–${max}, got ${JSON.stringify(raw)}`, numInvalidCode(k)),
      );
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
      this.errors.push(
        fe(
          k,
          `"${k}" must be one of ${allowed.join(" / ")}, got ${JSON.stringify(v)}`,
          pickInvalidCode(k),
        ),
      );
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
      this.errors.push(fe(k, `"${k}" must be a date like 2026-10-09`, "date_invalid"));
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
    errors.push(fe(field, `${field} is not an image path`, "photo_src_invalid"));
    return null;
  }
  if (!src.startsWith("/")) {
    errors.push(fe(field, `${field} must start with "/"`, "photo_src_invalid"));
    return null;
  }
  if (src.split("/").includes("..")) {
    errors.push(fe(field, `${field} must not contain ".."`, "photo_src_invalid"));
    return null;
  }
  if (!src.startsWith(PHOTO_PREFIX)) {
    errors.push(fe(field, `${field} must start with "${PHOTO_PREFIX}"`, "photo_src_invalid"));
    return null;
  }
  if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(src)) {
    errors.push(fe(field, `${field} is not an image path`, "photo_src_invalid"));
    return null;
  }
  if (photoExists && !photoExists(src)) {
    errors.push(fe(field, `${field} not found: ${src}`, "photo_not_found"));
    return null;
  }
  const caption =
    raw && typeof raw === "object" && typeof (raw as { caption?: unknown }).caption === "string"
      ? String((raw as { caption: string }).caption).trim() || undefined
      : undefined;
  return { src, ...(caption ? { caption } : {}) };
}

/**
 * Colours are optional: an absent or empty list is fine here, and
 * `normaliseNewBike` only reports `colours_missing` when the listing has
 * neither colours nor top-level photos.
 */
function parseColours(
  raw: unknown,
  errors: FieldError[],
  photoExists?: (src: string) => boolean,
): Colour[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push(fe("colours", '"colours" must be a list', "list_invalid"));
    return [];
  }
  if (raw.length === 0) return [];
  const out: Colour[] = [];
  raw.forEach((row, i) => {
    const field = `colours[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (!o) {
      errors.push(fe(field, `${field} must be a colour with a name and photos`, "colour_invalid"));
      return;
    }
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) {
      errors.push(fe(field, `${field}.name is missing`, "colour_name_missing"));
      return;
    }
    let swatch: string | undefined;
    if (o.swatch != null && o.swatch !== "") {
      if (typeof o.swatch !== "string" || !HEX_RE.test(o.swatch.trim())) {
        errors.push(fe(field, `${field}.swatch must be a hex colour like #5c5f63`, "colour_swatch_invalid"));
      } else {
        swatch = o.swatch.trim();
      }
    }
    const photosRaw = o.photos ?? o.src;
    const list = Array.isArray(photosRaw) ? photosRaw : photosRaw != null ? [photosRaw] : [];
    if (list.length === 0) {
      errors.push(fe(field, `${field} needs at least one photo`, "colour_photo_missing"));
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

/** Top-level photos not tied to a colour (optional). */
function parsePhotos(
  raw: unknown,
  errors: FieldError[],
  photoExists?: (src: string) => boolean,
): Photo[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push(fe("photos", '"photos" must be a list', "list_invalid"));
    return [];
  }
  return raw
    .map((p, i) => parsePhoto(p, `photos[${i}]`, errors, photoExists))
    .filter((p): p is Photo => p != null);
}

function parseSizes(raw: unknown, errors: FieldError[]): FrameSize[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push(fe("sizes", '"sizes" must be a list', "list_invalid"));
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
      errors.push(fe(field, `${field}.name is missing`, "size_invalid"));
      return;
    }
    const riderHeight =
      o && typeof o.riderHeight === "string" ? o.riderHeight.trim() || undefined : undefined;
    out.push({ name, ...(riderHeight ? { riderHeight } : {}) });
  });
  return out;
}

function parseEditions(raw: unknown, errors: FieldError[]): Edition[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push(fe("editions", '"editions" must be a list', "list_invalid"));
    return [];
  }
  const out: Edition[] = [];
  raw.forEach((row, i) => {
    const field = `editions[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (!o) {
      errors.push(fe(field, `${field} must be an edition with a name and price`, "edition_invalid"));
      return;
    }
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const priceRaw = o.price;
    const priceEmpty =
      priceRaw == null ||
      priceRaw === "" ||
      (typeof priceRaw === "string" && priceRaw.trim() === "");
    if (priceEmpty) {
      errors.push(fe(field, `${field} needs a name and a price in range`, "edition_price_missing"));
      return;
    }
    const price =
      typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw).replace(/[£,\s]/g, ""));
    if (!name || !Number.isFinite(price) || price < 0 || price > 100_000) {
      errors.push(fe(field, `${field} needs a name and a price in range`, "edition_invalid"));
      return;
    }
    if (price === 0) {
      errors.push(fe(field, `${field} price must be more than 0`, "edition_price_zero"));
      return;
    }
    let wasPrice: number | undefined;
    if (o.wasPrice != null && o.wasPrice !== "") {
      const w =
        typeof o.wasPrice === "number"
          ? o.wasPrice
          : Number(String(o.wasPrice).replace(/[£,\s]/g, ""));
      if (!Number.isFinite(w) || w < 0 || w > 100_000) {
        errors.push(fe(field, `${field}.wasPrice must be a number 0–100000`, "edition_was_price_invalid"));
      } else if (w <= price) {
        errors.push(fe(field, `${field}.wasPrice must be higher than price`, "edition_was_price_not_higher"));
      } else {
        wasPrice = w;
      }
    }
    let rangeKm: number | undefined;
    if (o.rangeKm != null && o.rangeKm !== "") {
      const r = typeof o.rangeKm === "number" ? o.rangeKm : Number(o.rangeKm);
      if (!Number.isFinite(r) || r < 1 || r > 1000) {
        errors.push(fe(field, `${field}.rangeKm must be a number 1–1000`, "edition_range_invalid"));
      } else {
        rangeKm = r;
      }
    }
    const note = typeof o.note === "string" ? o.note.trim() || undefined : undefined;
    out.push({
      name,
      price,
      ...(wasPrice != null ? { wasPrice } : {}),
      ...(rangeKm != null ? { rangeKm } : {}),
      ...(note ? { note } : {}),
    });
  });
  return out;
}

function parseSpecs(raw: unknown, errors: FieldError[]): SpecRow[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) {
    errors.push(fe("specs", '"specs" must be a list', "list_invalid"));
    return [];
  }
  const out: SpecRow[] = [];
  raw.forEach((row, i) => {
    const field = `specs[${i}]`;
    const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const label = o && typeof o.label === "string" ? o.label.trim() : "";
    const value = o && (typeof o.value === "string" || typeof o.value === "number") ? String(o.value).trim() : "";
    if (!label || !value) {
      errors.push(fe(field, `${field} needs a label and a value`, "spec_row_invalid"));
      return;
    }
    out.push({ label, value });
  });
  return out;
}

/**
 * Keys that earlier versions of the schema accepted and the showcase schema
 * dropped. A file or admin save that still sets one is rejected, so a stale
 * stock state, arrival month or free-text price can never reach the site
 * unnoticed. Use `hidden: true` instead of `availability: hidden`, and
 * `priceFrom: true` instead of `priceLabel: From £…`.
 */
export const LEGACY_KEYS = ["availability", "arrival", "priceLabel"] as const;

const LEGACY_HINT: Record<(typeof LEGACY_KEYS)[number], string> = {
  availability: ' (use "hidden: true" to keep a bike off the site)',
  arrival: "",
  priceLabel: ' (the price is shown from "price"; use "priceFrom: true" for "From £…")',
};

/** Optional true / false flag: a YAML boolean or the strings "true" / "false". */
function parseFlag(data: Data, key: string, code: NewBikeErrorCode, errors: FieldError[]): boolean {
  const raw = data[key];
  if (raw == null || raw === "") return false;
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  errors.push(fe(key, `"${key}" must be true or false, got ${JSON.stringify(raw)}`, code));
  return false;
}

/**
 * `hidden: true` keeps a bike off the site. Accepts a YAML boolean or the
 * strings "true" / "false".
 */
function parseHidden(data: Data, errors: FieldError[]): boolean {
  const hidden = parseFlag(data, "hidden", "hidden_invalid", errors);
  for (const k of LEGACY_KEYS) {
    if (data[k] == null || data[k] === "") continue;
    errors.push(fe(k, `"${k}" is no longer supported; remove it${LEGACY_HINT[k]}`, "legacy_field_removed"));
  }
  return hidden;
}

export function normaliseNewBike(data: Data, opts: NormaliseOptions = {}): NormaliseResult {
  const c = new Checker(data);
  const type = c.pick("type", TYPES, "e-bike") ?? "e-bike";
  const brand = c.text("brand", true) ?? "";
  const model = c.text("model", true) ?? "";
  const parsedPrice = c.num("price", ...LIMITS.price, true);
  if (parsedPrice === 0) {
    c.errors.push(fe("price", "Price must be more than 0", "price_zero"));
  }
  const price = parsedPrice ?? 0;
  const code = c.text("code");
  const order = c.num("order", ...LIMITS.order);
  const wasPrice = c.num("wasPrice", ...LIMITS.wasPrice);
  if (wasPrice != null && wasPrice <= price) {
    c.errors.push(fe("wasPrice", "Was price must be higher than Price", "was_price_not_higher"));
  }
  // `priceFrom: true` shows the price as "From £…". Same true / false rules as `hidden`.
  const priceFrom = parseFlag(data, "priceFrom", "price_from_invalid", c.errors);
  const hidden = parseHidden(data, c.errors);
  const colours = parseColours(data.colours, c.errors, opts.photoExists);
  const photos = parsePhotos(data.photos, c.errors, opts.photoExists);
  const coloursEmpty =
    data.colours == null ||
    data.colours === "" ||
    (Array.isArray(data.colours) && data.colours.length === 0);
  const photosEmpty =
    data.photos == null ||
    data.photos === "" ||
    (Array.isArray(data.photos) && data.photos.length === 0);
  if (coloursEmpty && photosEmpty) {
    c.missing.push(fe("colours", 'missing required "colours"', "colours_missing"));
  }
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
    ...(code ? { code } : {}),
    ...(order != null ? { order } : {}),
    price,
    ...(priceFrom ? { priceFrom: true } : {}),
    ...(wasPrice != null && wasPrice > price ? { wasPrice } : {}),
    hidden,
    colours,
    photos,
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
