import type { LocalDraft } from "@/lib/admin/drafts";
import { formToData, type FormState } from "@/lib/admin/form";
import { validateBike } from "@/lib/preowned-schema";
import { money } from "@/lib/preowned-types";
import { assetUrl } from "@/lib/admin/api";

const urls = new WeakMap<Blob, string>();
export const blobUrl = (b: Blob) => {
  let u = urls.get(b);
  if (!u) {
    u = URL.createObjectURL(b);
    urls.set(b, u);
  }
  return u;
};

/** What the list shows for a device-only draft: name, price, cover, first missing field. */
export function draftSummary(d: LocalDraft) {
  const form = d.form as unknown as FormState;
  const srcs = d.photos.map((p, i) => ({ src: p.kind === "repo" ? p.src : `/uploads/pre-owned/new-${i}.webp` }));
  const v = validateBike(formToData(form, srcs), { requireType: !d.slug });
  const order = ["photos", "type", "brand", "model", "year", "mileage", "price"];
  const first = [...v.errors].sort((a, b) => (order.indexOf(a.field) + 99) % 99 - (order.indexOf(b.field) + 99) % 99)[0];
  const label: Record<string, string> = {
    photos: "Add at least 1 photo",
    price: "Missing guide price",
    brand: "Missing brand",
    model: "Missing model",
    year: "Missing year",
    mileage: "Missing odometer",
    type: "Choose e-bike or e-scooter",
  };
  const p0 = d.photos[0];
  const n = Number(String(form.price ?? "").replace(/[£,\s]/g, ""));
  return {
    name: `${form.brand ?? ""} ${form.model ?? ""}`.trim(),
    price: form.price && Number.isFinite(n) ? money(n) : null,
    cover: p0 ? (p0.kind === "repo" ? assetUrl(p0.src) : blobUrl(p0.blob)) : null,
    missing: first ? (label[first.field] ?? first.message) : null,
  };
}
