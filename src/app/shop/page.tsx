import type { Metadata } from "next";
import { ShopToolbar } from "@/components/ShopToolbar";

export const metadata: Metadata = {
  title: "Rides",
  description:
    "Browse UKSEV LTD electric bike catalogue — guide prices, UK warehouse stock. Enquire to confirm.",
};

export default function ShopPage() {
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
          Search, filter and sort the warehouse list. Guide prices — enquire to
          confirm.
        </p>
      </div>
      <ShopToolbar />
      <p className="mt-10 max-w-[62ch] border-t border-hair pt-5 text-xs leading-[1.55] text-muted">
        Prices are guides. WhatsApp or call +44 7521 63699 for
        availability. Lead-gen catalogue — no web checkout.
      </p>
    </main>
  );
}
