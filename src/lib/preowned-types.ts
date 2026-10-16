/** Client-safe types + helpers for the Pre-owned module. No fs access here. */

export const GRADES = ["A", "B", "C"] as const;
export const STATUSES = ["available", "reserved", "sold"] as const;
export const INSPECTION_RESULTS = ["pass", "replaced", "note"] as const;

export type Grade = (typeof GRADES)[number];
export type Status = (typeof STATUSES)[number];
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export type Photo = { src: string; caption?: string };
export type InspectionItem = { item: string; result: InspectionResult; text?: string };
/** "What's included" row; included: false renders as "not included". */
export type IncludedItem = { item: string; text?: string; included: boolean };

export type PreownedBike = {
  slug: string;
  brand: string;
  model: string;
  year: number;
  /** Odometer, miles */
  mileage: number;
  batteryWh?: number;
  /** 0–100 */
  batteryHealth?: number;
  chargeCycles?: number;
  /** Where the battery reading came from, e.g. "BMS app", "Bafang diagnostic" */
  batterySource?: string;
  motorW?: number;
  frameSize?: string;
  wheelSize?: string;
  /** Claimed range, miles */
  range?: number;
  /** Guide price, GBP */
  price: number;
  /** RRP new, GBP */
  newPrice?: number;
  grade?: Grade;
  colour?: string;
  serviceHistory?: string;
  location: string;
  /** First = cover. Always ≥ 1 for published entries. */
  photos: Photo[];
  inspection: InspectionItem[];
  included: IncludedItem[];
  status: Status;
  /** YYYY-MM-DD, set when status = sold */
  soldDate?: string;
  /** YYYY-MM-DD the bike was listed */
  date?: string;
  draft: boolean;
  /** Rendered markdown body (raw HTML stripped) */
  descriptionHtml: string;
};

/** Fields the list cards need (no body). */
export type PreownedSummary = Omit<PreownedBike, "descriptionHtml" | "inspection" | "included">;

export const GRADE_WORD: Record<Grade, string> = { A: "Like new", B: "Good", C: "Fair" };
export const GRADE_NOTE: Record<Grade, string> = {
  A: "light signs of use, no faults, nothing to fix.",
  B: "visible wear, fully working, small cosmetic marks.",
  C: "well used, fully working, priced for its wear.",
};
export const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

export const bikeName = (b: Pick<PreownedBike, "brand" | "model">) => `${b.brand} ${b.model}`;

export function money(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function monthYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d
    .toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

export type PriceBand = "lo" | "mid" | "hi";
export function priceBand(price: number): PriceBand {
  return price < 600 ? "lo" : price < 900 ? "mid" : "hi";
}

/** Default list order: sold last, then newest listed first. */
export function newestFirst(a: PreownedSummary, b: PreownedSummary): number {
  const s = (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0);
  if (s) return s;
  return (b.date ?? "").localeCompare(a.date ?? "");
}
