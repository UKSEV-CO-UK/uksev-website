import type { FieldError } from "@/lib/preowned-schema";

/** Human labels for every frontmatter field the schema checks (bottom bar + inline help). */
export const FIELD_LABEL: Record<string, string> = {
  type: "Type",
  brand: "Brand",
  model: "Model",
  year: "Year",
  mileage: "Mileage",
  batteryWh: "Battery capacity",
  batteryHealth: "Battery health",
  chargeCycles: "Charge cycles",
  batterySource: "Battery reading source",
  motorW: "Motor power",
  frameSize: "Frame size",
  wheelSize: "Wheel size",
  range: "Range",
  price: "Guide price",
  newPrice: "New price",
  grade: "Grade",
  colour: "Colour",
  serviceHistory: "Service history",
  photos: "Photos",
  inspection: "Inspection",
  included: "What’s included",
  status: "Status",
  soldDate: "Sold date",
  date: "Listed date",
  draft: "Draft",
};

export const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f.charAt(0).toUpperCase() + f.slice(1);

/** Schema messages name raw keys ("brand", photos[0]); turn them into staff-facing text. */
export function humanError(e: FieldError): string {
  const label = fieldLabel(e.field);
  if (/^missing required /.test(e.message)) return `${label} missing`;
  return e.message
    .replace(/, got .*$/, "")
    .replace(/^"([A-Za-z]+)"/, (_, k: string) => fieldLabel(k))
    .replace(/^(photos|inspection|included)\[(\d+)\]/, (_, k: string, i: string) => `${fieldLabel(k)} #${Number(i) + 1}`);
}
