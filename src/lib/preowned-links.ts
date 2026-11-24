import { enquireMailto, site, whatsappHref } from "@/config/site";
import { bikeName, type PreownedSummary } from "./preowned-types";

export { whatsappHref };

/** Enquiry email with the bike in the subject. */
export function enquireHref(b: Pick<PreownedSummary, "brand" | "model" | "year">) {
  return enquireMailto(`Pre-owned ${bikeName(b)} (${b.year})`);
}

export function whatsappBike(b: Pick<PreownedSummary, "brand" | "model" | "year" | "slug">) {
  return whatsappHref(
    `Hi, is the pre-owned ${bikeName(b)} (${b.year}) still available? ${site.url}/pre-owned/${b.slug}/`,
  );
}

/** "Find similar" → list filtered by the same brand. */
export function similarHref(brand: string) {
  return `/pre-owned/?brand=${encodeURIComponent(brand)}`;
}
