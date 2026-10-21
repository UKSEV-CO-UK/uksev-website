export const SITE = {
  name: "UKSEV LTD",
  phoneDisplay: "+44 7521 63699",
  phoneHref: "tel:+44752163699",
  whatsapp: "https://wa.me/44752163699",
  email: "Tonysun@uksev.co.uk",
  emailHref: "mailto:Tonysun@uksev.co.uk",
} as const;

/** Build a mailto enquire link, optionally naming the product in the subject. */
export function enquireMailto(productName?: string): string {
  const subject =
    productName && productName.trim()
      ? `Enquire: ${productName.trim()}`
      : "Enquire";
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`;
}
