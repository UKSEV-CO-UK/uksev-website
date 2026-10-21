/** Bike frontmatter object ⇄ content/pre-owned/<slug>.md text (same format the build reads with gray-matter). */
import yaml from "js-yaml";

/** Key order in written files (matches the README example); unknown keys are kept after these. */
const ORDER = [
  "type", "brand", "model", "year", "mileage", "price", "photos", "newPrice",
  "batteryWh", "batteryHealth", "chargeCycles", "batterySource", "motorW", "frameSize", "wheelSize",
  "range", "grade", "colour", "serviceHistory", "inspection", "included",
  "status", "soldDate", "date", "draft",
];

const isEmpty = (v: unknown) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "number" && Number.isNaN(v));

const toIsoDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

/** Drops empty values, orders keys, writes YYYY-MM-DD dates as plain strings. */
export function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = [...ORDER.filter((k) => k in data), ...Object.keys(data).filter((k) => !ORDER.includes(k))];
  for (const k of keys) {
    const v = toIsoDate(data[k]);
    if (!isEmpty(v)) out[k] = v;
  }
  return out;
}

export function toMarkdown(data: Record<string, unknown>, body: string): string {
  const fm = yaml.dump(cleanData(data), { lineWidth: -1, noRefs: true, quotingType: '"' });
  const text = body.trim();
  return `---\n${fm}---\n${text ? text + "\n" : ""}`;
}

/** Inverse of toMarkdown (used by the fake API and tests; the real module may use its own parser). */
export function fromMarkdown(md: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  if (!m) return { data: {}, body: md };
  const data = (yaml.load(m[1]) as Record<string, unknown> | null) ?? {};
  return { data, body: m[2].trim() };
}
