import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Btn } from "@/components/Btn";
import { UsedStatusBadge } from "@/components/UsedCard";
import { UsedGallery } from "@/components/UsedGallery";
import { SITE, enquireMailto } from "@/lib/site";
import { getUsedBike, getUsedBikes } from "@/lib/used";
import { formatGBP, formatMiles } from "@/lib/used-types";

/**
 * Static export needs at least one param. When every entry is a draft (or the
 * folder is empty) we emit one placeholder that renders the 404 page.
 */
const PLACEHOLDER = "none";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = getUsedBikes().map((b) => ({ slug: b.slug }));
  return slugs.length ? slugs : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bike = getUsedBike(slug);
  if (!bike) return { title: "Not found", robots: { index: false } };
  return {
    title: `${bike.title} (used)`,
    description: `Used ${bike.brand} ${bike.model}, ${bike.year}, ${formatMiles(
      bike.mileage,
    )}, ${bike.condition} condition — ${formatGBP(bike.price)} at UKSEV Abingdon.`,
    ...(bike.draft ? { robots: { index: false } } : {}),
  };
}

export default async function UsedBikePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bike = getUsedBike(slug);
  if (!bike) notFound();

  const sold = bike.status === "sold";
  const specs: [string, string][] = [
    ["Brand", bike.brand],
    ["Model", bike.model],
    ["Year", String(bike.year)],
    ["Mileage", formatMiles(bike.mileage)],
    ...(bike.batteryHealth != null
      ? ([["Battery health", `${bike.batteryHealth}%`]] as [string, string][])
      : []),
    ...(bike.motor ? ([["Motor", bike.motor]] as [string, string][]) : []),
    ...(bike.battery ? ([["Battery", bike.battery]] as [string, string][]) : []),
    ["Condition", bike.condition],
    ["Location", bike.location],
  ];
  const enquireName = `Used ${bike.title} (${bike.year})`;

  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-[100px] pb-20 sm:px-7">
      <Link
        href="/used/"
        className="mb-6 inline-block text-[10.5px] tracking-[0.14em] text-ink-2 uppercase hover:text-amber"
      >
        ← All used bikes
      </Link>

      {bike.draft && (
        <div className="mb-6 rounded-xl border border-amber px-4 py-3 text-xs text-amber">
          Draft / example listing — hidden on the live site.
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        <div className={sold ? "opacity-60 grayscale" : ""}>
          <UsedGallery photos={bike.photos} alt={bike.title} />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-amber uppercase">
              {bike.brand} · {bike.year}
            </span>
            <UsedStatusBadge status={bike.status} />
          </div>
          <h1 className="font-display mb-4 text-[clamp(30px,4.4vw,52px)] leading-[1.02] font-extrabold tracking-[-0.03em] break-words">
            {bike.title}
          </h1>
          <div
            className={`font-display mb-6 text-[28px] font-bold tracking-[-0.02em] ${
              sold ? "text-muted line-through" : ""
            }`}
          >
            {formatGBP(bike.price)}
          </div>

          <dl className="mb-7 border-t border-hair">
            {specs.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-4 border-b border-hair py-3"
              >
                <dt className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                  {k}
                </dt>
                <dd className="text-[13px] break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {sold ? (
            <p className="mb-6 text-sm leading-relaxed text-ink-2">
              This bike has been sold. Call or WhatsApp — we may have something
              similar coming in.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Btn href={enquireMailto(enquireName)} solid className="text-center">
              Enquire
            </Btn>
            <Btn href={SITE.phoneHref} className="text-center">
              Call
            </Btn>
            <Btn href={SITE.whatsapp} external className="text-center">
              WhatsApp
            </Btn>
          </div>
          <p className="mt-3 text-xs text-muted">{SITE.phoneDisplay} · {SITE.addressShort}</p>
        </div>
      </div>

      {bike.bodyHtml && (
        <section className="mt-12 max-w-[68ch] border-t border-hair pt-8">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            Description
          </div>
          <div
            className="used-body text-sm leading-relaxed text-ink-2"
            dangerouslySetInnerHTML={{ __html: bike.bodyHtml }}
          />
        </section>
      )}
    </main>
  );
}
