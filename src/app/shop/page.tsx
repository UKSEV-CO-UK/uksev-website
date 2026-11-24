import { SITE } from "@/lib/site";
import type { Metadata } from "next";
import { NewBikeCard } from "@/components/NewBikeCard";
import { ShopToolbar } from "@/components/ShopToolbar";
import { getListed } from "@/lib/newbikes";

export const metadata: Metadata = {
  title: "Rides",
  description:
    "Browse UKSEV LTD electric bike catalogue — guide prices. Enquire to confirm.",
};

export default async function ShopPage() {
  const newBikes = await getListed();
  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-[100px] pb-20 sm:px-7">
      <div className="mb-7">
        <div className="mb-3.5 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
          Catalogue
        </div>
        <h1 className="font-display mb-3 text-[clamp(36px,5vw,64px)] leading-none font-extrabold tracking-[-0.03em]">
          All rides<span className="text-amber">.</span>
        </h1>
        <p className="max-w-[42ch] text-sm leading-relaxed text-ink-2">
          Search, filter and sort the catalogue. Guide prices — enquire to
          confirm.
        </p>
      </div>
      {newBikes.length > 0 && (
        <section className="mb-14">
          <div className="mb-5 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            New bikes
          </div>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {newBikes.map((bike) => (
              <NewBikeCard key={bike.slug} bike={bike} />
            ))}
          </div>
        </section>
      )}
      <ShopToolbar />
      <p className="mt-10 max-w-[62ch] border-t border-hair pt-5 text-xs leading-[1.55] text-muted">
        Prices are guides. WhatsApp or call {SITE.phoneDisplay} to enquire.
        Lead-gen catalogue — no web checkout.
      </p>
    </main>
  );
}
