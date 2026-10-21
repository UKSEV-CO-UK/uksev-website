import { SITE } from "@/lib/site";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
import { RevealRoot } from "@/components/RevealRoot";
import "./globals.css";

const syne = localFont({
  src: "../fonts/Syne-latin.woff2",
  variable: "--font-syne",
  weight: "600 800",
  display: "swap",
});

const sora = localFont({
  src: "../fonts/Sora-latin.woff2",
  variable: "--font-sora",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "UKSEV LTD",
    template: "%s — UKSEV",
  },
  description:
    "UKSEV LTD — electric bikes held in UK stock. Guide prices, enquire to confirm.",
};

const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: "https://uksev.co.uk",
  telephone: SITE.phoneHref.replace("tel:", ""),
  email: SITE.email,
  ...(SITE.companyNumber
    ? {
        identifier: {
          "@type": "PropertyValue",
          propertyID: "Companies House",
          value: SITE.companyNumber,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full bg-ground font-ui text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }}
        />
        <RevealRoot />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
