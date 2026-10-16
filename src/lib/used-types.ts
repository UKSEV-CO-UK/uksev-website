/** Shared (client-safe) types + formatting for the Used E-Bikes module. */

export const USED_CONDITIONS = ["Excellent", "Good", "Fair"] as const;
export const USED_STATUSES = ["available", "reserved", "sold"] as const;

export type UsedCondition = (typeof USED_CONDITIONS)[number];
export type UsedStatus = (typeof USED_STATUSES)[number];

export type UsedBike = {
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  /** Miles */
  mileage: number;
  /** 0–100, optional */
  batteryHealth?: number;
  motor?: string;
  battery?: string;
  /** GBP */
  price: number;
  condition: UsedCondition;
  status: UsedStatus;
  location: string;
  photos: string[];
  featured: boolean;
  /** ISO date string (YYYY-MM-DD…) */
  date: string;
  draft: boolean;
  /** Rendered HTML of the markdown body (raw HTML stripped). */
  bodyHtml: string;
};

/** Card-sized subset passed to the client listing. */
export type UsedBikeSummary = Omit<UsedBike, "bodyHtml">;

export const STATUS_LABEL: Record<UsedStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

export function formatGBP(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function formatMiles(n: number): string {
  return `${n.toLocaleString("en-GB")} mi`;
}

/** Default order: sold last, then featured first, then newest. */
export function defaultUsedOrder(a: UsedBikeSummary, b: UsedBikeSummary): number {
  const sa = a.status === "sold" ? 1 : 0;
  const sb = b.status === "sold" ? 1 : 0;
  if (sa !== sb) return sa - sb;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return b.date.localeCompare(a.date);
}
