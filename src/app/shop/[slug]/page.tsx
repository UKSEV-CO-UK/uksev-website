import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Btn } from "@/components/Btn";
import { NewBikeGallery } from "@/components/NewBikeGallery";
import { SalePrice } from "@/components/SalePrice";
import { getAll, getBySlug } from "@/lib/newbikes";
import { bikeName, money, stockLabel } from "@/lib/newbikes-types";
import { enquireMailto, SITE } from "@/lib/site";

const PLACEHOLDER = "none";
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = (await getAll()).map((b) => ({ slug: b.slug }));
  return slugs.length ? slugs : [{ slug: PLACEHOLDER }];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bike = await getBySlug((await params).slug);
  if (!bike) return { title: "Not found", robots: { index: false } };
  return {
    title: bikeName(bike),
    description: `${bikeName(bike)} — ${money(bike.price)} at UKSEV. Enquire to confirm.`,
  };
}

function whatsappBike(name: string): string {
  const text = `Hi, I'm enquiring about the ${name}.`;
  const base = SITE.whatsapp.split("?")[0];
  return `${base}?text=${encodeURIComponent(text)}`;
}

export default async function NewBikePage({ params }: Props) {
  const bike = await getBySlug((await params).slug);
  if (!bike) notFound();
  const name = bikeName(bike);

  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-[100px] pb-20 sm:px-7">
      <div className="mb-6 text-[11px] tracking-[0.08em] text-ink-2 uppercase">
        <Link href="/shop/" className="hover:text-amber">
          Rides
        </Link>
        <span className="mx-2 text-muted">/</span>
        <span className="text-ink">{name}</span>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <NewBikeGallery colours={bike.colours} alt={name} />

        <aside>
          <div className="mb-2 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            {bike.brand}
          </div>
          <h1 className="font-display mb-4 text-[clamp(32px,4vw,52px)] leading-none font-extrabold tracking-[-0.03em]">
            {bike.model}
          </h1>
          <div className="mb-6 flex flex-wrap items-end gap-2">
            <SalePrice price={bike.price} wasPrice={bike.wasPrice} className="text-[28px]" />
            <span className="mb-1 text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">
              {stockLabel(bike)}
            </span>
          </div>

          {bike.sizes.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Sizes
              </div>
              <ul className="space-y-1 text-sm text-ink-2">
                {bike.sizes.map((s) => (
                  <li key={s.name}>
                    <span className="font-medium text-ink">{s.name}</span>
                    {s.riderHeight ? ` · ${s.riderHeight}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bike.editions.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Editions
              </div>
              <ul className="space-y-2">
                {bike.editions.map((ed) => (
                  <li key={ed.name} className="flex flex-wrap items-end justify-between gap-2 border-b border-hair pb-2 last:border-0">
                    <div>
                      <div className="text-sm text-ink">{ed.name}</div>
                      {ed.note && <div className="text-xs text-ink-2">{ed.note}</div>}
                      {ed.rangeKm != null && (
                        <div className="text-xs text-ink-2">Up to {ed.rangeKm} km</div>
                      )}
                    </div>
                    <SalePrice price={ed.price} wasPrice={ed.wasPrice} className="text-base" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-[1.2fr_1fr] gap-2">
            <Btn href={enquireMailto(name)} solid className="!px-2 !py-[11px] text-center">
              Enquire
            </Btn>
            <Btn href={whatsappBike(name)} external className="!px-2 !py-[11px] text-center">
              WhatsApp
            </Btn>
          </div>
        </aside>
      </div>

      {bike.descriptionHtml && (
        <section className="mt-14 max-w-[62ch]">
          <h2 className="font-display mb-3 text-2xl font-bold tracking-[-0.02em]">About this bike</h2>
          <div
            className="space-y-3 text-sm leading-relaxed text-ink-2 [&_a]:text-amber [&_p]:text-ink-2"
            dangerouslySetInnerHTML={{ __html: bike.descriptionHtml }}
          />
        </section>
      )}

      {bike.specs.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-2xl font-bold tracking-[-0.02em]">Specifications</h2>
          <dl className="divide-y divide-hair border-y border-hair">
            {bike.specs.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-4 py-3 text-sm"
              >
                <dt className="text-muted">{row.label}</dt>
                <dd className="text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
