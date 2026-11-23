/**
 * New-bike listing types (first use: Fiido C21).
 * Same idea as the pre-owned module: one schema in this repo, which the admin
 * will copy later.
 */

export const TYPES = ["e-bike", "e-scooter"] as const;
/** Stock state shown on the site. `hidden` is not listed or linked. */
export const AVAILABILITIES = ["in-stock", "check", "arriving", "hidden"] as const;

export type VehicleType = (typeof TYPES)[number];
export type Availability = (typeof AVAILABILITIES)[number];

export type Photo = { src: string; caption?: string };

export type Colour = {
  /** Colour name on the swatch, e.g. "Grey". */
  name: string;
  /** Optional hex swatch, e.g. "#5c5f63". */
  swatch?: string;
  /** Photos for this colour. First is the cover (side-on full bike). */
  photos: Photo[];
};

export type FrameSize = {
  name: string;
  /** Rider height guidance, e.g. "160–175 cm (5′3″–5′9″)". */
  riderHeight?: string;
};

export type Edition = {
  name: string;
  price: number;
  wasPrice?: number;
  rangeKm?: number;
  note?: string;
};

export type SpecRow = { label: string; value: string };

export type NewBike = {
  slug: string;
  type: VehicleType;
  brand: string;
  model: string;
  /** Current selling price, GBP. */
  price: number;
  /**
   * Optional original / list / compare-at price, GBP.
   * Rendered struck through only when set and greater than `price`.
   */
  wasPrice?: number;
  availability: Availability;
  /**
   * Arrival month as YYYY-MM, e.g. "2026-12".
   * Shown as "Arriving Dec 2026" when availability is `arriving` (and also
   * used if present for `check`).
   */
  arrival?: string;
  colours: Colour[];
  sizes: FrameSize[];
  editions: Edition[];
  /** Card highlight: claimed range, kilometres. */
  rangeKm?: number;
  /** Card highlight: claimed range, miles. */
  rangeMiles?: number;
  /** Card highlight: bike weight, kilograms. */
  weightKg?: number;
  /** Card highlight: assistance cut-off, km/h. */
  topSpeedKmh?: number;
  /** Card highlight: battery label, e.g. "36V 208.8Wh". */
  battery?: string;
  batteryWh?: number;
  motorW?: number;
  /** Remaining facts for the detail-page spec table. */
  specs: SpecRow[];
  /** YYYY-MM-DD the bike was listed. */
  date?: string;
  /** Rendered markdown body (raw HTML stripped). */
  descriptionHtml: string;
};

export type NewBikeSummary = Omit<NewBike, "descriptionHtml">;

export const TYPE_LABEL: Record<VehicleType, string> = {
  "e-bike": "E-bike",
  "e-scooter": "E-scooter",
};

export const bikeName = (b: Pick<NewBike, "brand" | "model">) => `${b.brand} ${b.model}`;

export function money(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/** Arrival month stored as YYYY-MM (e.g. 2026-12). */
export const ARRIVAL_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Format a YYYY-MM arrival as an en-GB short month and year, e.g. "Dec 2026". */
export function formatArrivalMonth(arrival: string): string {
  if (!ARRIVAL_RE.test(arrival)) return arrival;
  const year = Number(arrival.slice(0, 4));
  const month = Number(arrival.slice(5, 7));
  const mon = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return `${mon} ${year}`;
}

/** Stock / arrival line shown next to the price. */
export function stockLabel(b: Pick<NewBike, "availability" | "arrival">): string {
  if (b.availability === "in-stock") return "UK stock";
  if (b.availability === "arriving") {
    return b.arrival ? `Arriving ${formatArrivalMonth(b.arrival)}` : "Arriving";
  }
  if (b.arrival) return formatArrivalMonth(b.arrival);
  return "Check stock";
}

export function newestFirst(a: NewBikeSummary, b: NewBikeSummary): number {
  return (b.date ?? "").localeCompare(a.date ?? "");
}

/** Cover photo for a colour, or the first colour's cover. */
export function coverPhoto(b: Pick<NewBike, "colours">, colourName?: string): Photo | undefined {
  const colour =
    (colourName && b.colours.find((c) => c.name === colourName)) || b.colours[0];
  return colour?.photos[0];
}
