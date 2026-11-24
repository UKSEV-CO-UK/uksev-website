/**
 * New-bike listing types (first use: Fiido C21).
 * Same idea as the pre-owned module: one schema in this repo, which the admin
 * will copy later.
 */

/**
 * `accessory` covers the batteries, lights and racks carried over from the
 * scraped catalogue. They are listed like bikes but are not vehicles.
 */
export const TYPES = ["e-bike", "e-scooter", "accessory"] as const;

export type VehicleType = (typeof TYPES)[number];

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
  /** Optional catalogue code, e.g. "UK-ADO-AIR-CARBON". Searchable; not shown on the card. */
  code?: string;
  /**
   * Optional sort position for "Featured" (ascending; 1 is first). Listings
   * without an order are shown before ordered ones, newest first.
   */
  order?: number;
  /** Current selling price, GBP. */
  price: number;
  /**
   * Optional display text for the price, e.g. "From £1,559". Shown instead of
   * the formatted `price` when set; `price` stays the number used for sorting.
   */
  priceLabel?: string;
  /**
   * Optional original / list / compare-at price, GBP.
   * Rendered struck through only when set and greater than `price`.
   */
  wasPrice?: number;
  /**
   * Showcase visibility. `true` keeps the file in the repo but the bike is not
   * listed, linked or built into a page. Defaults to `false`.
   */
  hidden: boolean;
  /**
   * Colour options. May be empty when the colour names are unknown; the site
   * then shows no swatches and uses `photos` instead.
   */
  colours: Colour[];
  /**
   * Photos not tied to a colour. Used when `colours` is empty (or as extra
   * photos after the colour covers). First is the cover.
   */
  photos: Photo[];
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
  accessory: "Accessory",
};

export const bikeName = (b: Pick<NewBike, "brand" | "model">) => `${b.brand} ${b.model}`;

/** Model title without a leading brand (render only; does not change stored data). */
export function modelTitle(brand: string, model: string): string {
  const prefix = brand.trim();
  if (!prefix) return model;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return model.replace(new RegExp(`^${escaped}\\s+`, "i"), "");
}

/**
 * Split a list-style mid-dot in a spec value at render time.
 * Requires spaces around "·" so units like "N·m" stay intact.
 */
export function splitSpecValue(value: string): string[] {
  return value
    .split(/\s+·\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function money(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function newestFirst(a: NewBikeSummary, b: NewBikeSummary): number {
  return (b.date ?? "").localeCompare(a.date ?? "");
}

/** Price text for display: `priceLabel` when set, else the formatted price. */
export function priceText(b: Pick<NewBike, "price" | "priceLabel">): string {
  return b.priceLabel ?? money(b.price);
}

/**
 * "Featured" order: listings without `order` first (newest first, then name),
 * then ascending `order`, ties by name.
 */
export function featuredFirst(a: NewBikeSummary, b: NewBikeSummary): number {
  const ao = a.order;
  const bo = b.order;
  if (ao == null && bo == null) return newestFirst(a, b) || bikeName(a).localeCompare(bikeName(b));
  if (ao == null) return -1;
  if (bo == null) return 1;
  return ao - bo || bikeName(a).localeCompare(bikeName(b));
}

/** Cover photo for a colour, or the first colour's cover, or the first loose photo. */
export function coverPhoto(
  b: Pick<NewBike, "colours" | "photos">,
  colourName?: string,
): Photo | undefined {
  const colour =
    (colourName && b.colours.find((c) => c.name === colourName)) || b.colours[0];
  return colour?.photos[0] ?? b.photos[0];
}
