/**
 * Company brand and contact. A name or domain change is this file only.
 * Email is set on its own — it is not derived from `domain`.
 * Do not put a street address here.
 */
export const site = {
  name: "UKSEV LTD",
  shortName: "UKSEV",
  domain: "uksev.co.uk",
  url: "https://uksev.co.uk",
  email: "Tonysun@uksev.co.uk",
  phone: "+44 7521 639699",
  whatsapp: "https://wa.me/447521639699",
  companyNumber: "16440394",
  logo: "/brand/logo.svg",
  logoMark: "/brand/logo-mark.svg",
} as const;

export type SiteConfig = typeof site;

/** Canonical origin, derived from `domain`. */
export const siteOrigin = `https://${site.domain}`;

/** Absolute URL on the configured domain (always with a trailing slash). */
export function siteUrl(path = "/"): string {
  const pathname = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return `${siteOrigin}${withSlash}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Convenience fields used by existing components. */
export const SITE = {
  ...site,
  phoneDisplay: site.phone,
  phoneHref: telHref(site.phone),
  emailHref: `mailto:${site.email}`,
};

/** Build a mailto enquire link, optionally naming the product in the subject. */
export function enquireMailto(productName?: string): string {
  const subject =
    productName && productName.trim()
      ? `Enquire: ${productName.trim()}`
      : "Enquire";
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}`;
}

/** WhatsApp chat link, optionally with a pre-filled message. */
export function whatsappHref(text?: string): string {
  const base = site.whatsapp.split("?")[0];
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
