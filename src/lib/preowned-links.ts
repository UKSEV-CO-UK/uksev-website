import { SITE, enquireMailto } from "./site";
import { bikeName, type PreownedSummary } from "./preowned-types";

/** Enquiry email to Tonysun@uksev.co.uk with the bike in the subject. */
export function enquireHref(b: Pick<PreownedSummary, "brand" | "model" | "year">) {
  return enquireMailto(`Pre-owned ${bikeName(b)} (${b.year})`);
}

export function whatsappHref(text?: string) {
  return text ? `${SITE.whatsapp}?text=${encodeURIComponent(text)}` : SITE.whatsapp;
}

export function whatsappBike(b: Pick<PreownedSummary, "brand" | "model" | "year" | "slug">) {
  return whatsappHref(
    `Hi, is the pre-owned ${bikeName(b)} (${b.year}) still available? https://uksev.co.uk/pre-owned/${b.slug}/`,
  );
}

/** "Find similar" → list filtered by the same brand. */
export function similarHref(brand: string) {
  return `/pre-owned/?brand=${encodeURIComponent(brand)}`;
}
