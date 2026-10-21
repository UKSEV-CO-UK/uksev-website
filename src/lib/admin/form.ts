/** Edit-form state ⇄ bike frontmatter, and the file list for one publish. */
import { normaliseBike } from "../preowned-schema";
import type { Grade, InspectionResult, Status, VehicleType } from "../preowned-types";
import type { DraftPhoto } from "./drafts";
import { toMarkdown } from "./serialize";
import type { PublishFile, RepoBike } from "./types";

export function todayIso(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const CONTENT_DIR = "content/pre-owned";
export const UPLOAD_DIR = "/uploads/pre-owned";
export const mdPath = (slug: string) => `${CONTENT_DIR}/${slug}.md`;

export type InspectionRow = { item: string; result: InspectionResult; text: string };
export type IncludedRow = { item: string; text?: string; state: "yes" | "no" | "off" };

export type FormState = {
  type: VehicleType | "";
  brand: string;
  model: string;
  year: string;
  mileage: string;
  price: string;
  batteryMode: "health" | "cycles";
  batteryHealth: string;
  chargeCycles: string;
  batterySource: string;
  batteryWh: string;
  motorW: string;
  grade: Grade | "";
  frameSize: string;
  wheelSize: string;
  inspection: InspectionRow[];
  included: IncludedRow[];
  body: string;
  status: Status;
};

/** Chips offered for "What's included" (tap: included → not included → off). */
export const INCLUDED_PRESETS = ["Charger", "2 × keys", "Manual", "Lock", "Lights", "Mudguards", "Rack", "Original box"];

export const emptyForm = (): FormState => ({
  type: "",
  brand: "",
  model: "",
  year: "",
  mileage: "",
  price: "",
  batteryMode: "health",
  batteryHealth: "",
  chargeCycles: "",
  batterySource: "",
  batteryWh: "",
  motorW: "",
  grade: "",
  frameSize: "",
  wheelSize: "",
  inspection: [{ item: "Brakes", result: "pass", text: "" }, { item: "Tyres", result: "pass", text: "" }],
  included: INCLUDED_PRESETS.map((item) => ({ item, state: item === "Charger" ? "yes" : "off" })),
  body: "",
  status: "available",
});

const str = (v: unknown) => (v == null ? "" : String(v));

export function formFromRepo(car: RepoBike): { form: FormState; photos: DraftPhoto[] } {
  const b = normaliseBike(car.data).bike;
  const d = car.data;
  const included: IncludedRow[] = b.included.map((i) => ({ item: i.item, text: i.text, state: i.included ? "yes" : "no" }));
  for (const p of INCLUDED_PRESETS) if (!included.some((i) => i.item === p)) included.push({ item: p, state: "off" });
  return {
    form: {
      type: b.type,
      brand: str(d.brand),
      model: str(d.model),
      year: str(d.year),
      mileage: str(d.mileage),
      price: str(d.price),
      batteryMode: d.batteryHealth == null && d.chargeCycles != null ? "cycles" : "health",
      batteryHealth: str(d.batteryHealth),
      chargeCycles: str(d.chargeCycles),
      batterySource: str(d.batterySource),
      batteryWh: str(d.batteryWh),
      motorW: str(d.motorW),
      grade: b.grade ?? "",
      frameSize: str(d.frameSize),
      wheelSize: str(d.wheelSize),
      inspection: b.inspection.map((r) => ({ item: r.item, result: r.result, text: r.text ?? "" })),
      included,
      body: car.body,
      status: b.status,
    },
    photos: b.photos.map((p) => ({ kind: "repo", src: p.src, caption: p.caption })),
  };
}

const num = (s: string) => {
  const t = s.replace(/[£,\s]/g, "");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : s; // keep bad input so validation reports it
};
const txt = (s: string) => s.trim() || undefined;

/**
 * Frontmatter for publishing. Starts from the repo version so fields the form
 * doesn't show (newPrice, colour, range, captions…) are kept.
 */
export function formToData(
  form: FormState,
  photoSrcs: { src: string; caption?: string }[],
  original: Record<string, unknown> = {},
  today = todayIso(),
): Record<string, unknown> {
  const { draft: _draft, ...base } = original; // admin publishes are never repo drafts
  void _draft;
  const soldDate = form.status === "sold" ? (original.status === "sold" && original.soldDate ? original.soldDate : today) : undefined;
  return {
    ...base,
    type: form.type || undefined,
    brand: txt(form.brand),
    model: txt(form.model),
    year: num(form.year),
    mileage: num(form.mileage),
    price: num(form.price),
    photos: photoSrcs.map((p) => (p.caption ? { src: p.src, caption: p.caption } : { src: p.src })),
    batteryWh: num(form.batteryWh),
    batteryHealth: num(form.batteryHealth),
    chargeCycles: num(form.chargeCycles),
    batterySource: txt(form.batterySource),
    motorW: num(form.motorW),
    frameSize: txt(form.frameSize),
    wheelSize: txt(form.wheelSize),
    grade: form.grade || undefined,
    inspection: form.inspection
      .filter((r) => r.item.trim())
      .map((r) => (r.text.trim() ? { item: r.item.trim(), result: r.result, text: r.text.trim() } : { item: r.item.trim(), result: r.result })),
    included: form.included
      .filter((i) => i.state !== "off" && i.item.trim())
      .map((i) => ({ item: i.item.trim(), ...(i.text ? { text: i.text } : {}), ...(i.state === "no" ? { included: false } : {}) })),
    status: form.status,
    soldDate,
    date: original.date ?? today,
  };
}

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[″"]/g, "in")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function uniqueSlug(form: FormState, taken: Set<string>) {
  const base = slugify(`${form.brand} ${form.model} ${form.year}`) || "listing";
  let s = base;
  for (let i = 2; taken.has(s); i++) s = `${base}-${i}`;
  return s;
}

const rand = () => Math.random().toString(36).slice(2, 8);

/** Repo upload paths no other listing still uses (safe to delete). */
export function orphanedUploads(srcs: string[], slug: string, all: RepoBike[]): string[] {
  const used = new Set<string>();
  for (const c of all) if (c.slug !== slug) for (const p of normaliseBike(c.data).bike.photos) used.add(p.src);
  return [...new Set(srcs)].filter((s) => s.startsWith(`${UPLOAD_DIR}/`) && !used.has(s));
}

/**
 * Everything one Publish writes, in ONE commit: the .md, new photos, and deletes
 * for photos removed from this listing (if no other listing uses them).
 */
export function buildPublish(args: {
  slug: string;
  form: FormState;
  photos: DraftPhoto[];
  original?: RepoBike;
  all: RepoBike[];
}): { files: PublishFile[]; data: Record<string, unknown>; newPhotoPaths: string[] } {
  const { slug, form, photos, original, all } = args;
  const files: PublishFile[] = [];
  const srcs: { src: string; caption?: string }[] = [];
  const newPhotoPaths: string[] = [];
  for (const p of photos) {
    if (p.kind === "repo") srcs.push({ src: p.src, caption: p.caption });
    else {
      const src = `${UPLOAD_DIR}/${slug}-${rand()}.${p.ext}`;
      srcs.push({ src, caption: p.caption });
      newPhotoPaths.push(src);
      files.push({ path: `public${src}`, content: p.blob });
    }
  }
  const data = formToData(form, srcs, original?.data);
  files.unshift({ path: mdPath(slug), content: toMarkdown(data, form.body) });
  if (original) {
    const before = normaliseBike(original.data).bike.photos.map((p) => p.src);
    const kept = new Set(srcs.map((s) => s.src));
    for (const src of orphanedUploads(before.filter((s) => !kept.has(s)), slug, all))
      files.push({ path: `public${src}`, content: null });
  }
  return { files, data, newPhotoPaths };
}

/** Delete a listing and its photos (photos shared with another listing are kept). */
export function buildDelete(car: RepoBike, all: RepoBike[]): PublishFile[] {
  const photos = normaliseBike(car.data).bike.photos.map((p) => p.src);
  return [
    { path: car.path, content: null },
    ...orphanedUploads(photos, car.slug, all).map((src) => ({ path: `public${src}`, content: null })),
  ];
}

/** Status switch from the list: same file, only status/soldDate change. */
export function withStatus(data: Record<string, unknown>, status: Status, today = todayIso()) {
  const next: Record<string, unknown> = { ...data, status };
  if (status === "sold") next.soldDate = data.status === "sold" && data.soldDate ? data.soldDate : today;
  else delete next.soldDate;
  return next;
}
