type SiteInfo = {
  readonly name: string;
  readonly phoneDisplay: string;
  readonly phoneHref: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly emailHref: string;
  /** Companies House number. Leave undefined to hide the registration line. */
  readonly companyNumber?: string;
};

export const SITE: SiteInfo = {
  name: "UKSEV LTD",
  phoneDisplay: "+44 7521 63699",
  phoneHref: "tel:+44752163699",
  whatsapp: "https://wa.me/44752163699",
  email: "Tonysun@uksev.co.uk",
  emailHref: "mailto:Tonysun@uksev.co.uk",
  companyNumber: undefined,
};

/** Build a mailto enquire link, optionally naming the product in the subject. */
export function enquireMailto(productName?: string): string {
  const subject =
    productName && productName.trim()
      ? `Enquire: ${productName.trim()}`
      : "Enquire";
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`;
}
