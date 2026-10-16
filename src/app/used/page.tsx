import type { Metadata } from "next";
import { Btn } from "@/components/Btn";
import { UsedBrowser } from "@/components/UsedBrowser";
import { SITE } from "@/lib/site";
import { getUsedBikes } from "@/lib/used";
import type { UsedBikeSummary } from "@/lib/used-types";

export const metadata: Metadata = {
  title: "Used E-Bikes",
  description:
    "Pre-owned electric bikes from UKSEV LTD, Abingdon. Checked, priced and ready — enquire to view.",
};

export default function UsedPage() {
  // Strip rendered bodies: the listing only needs card fields.
  const bikes: UsedBikeSummary[] = getUsedBikes().map(({ bodyHtml: _body, ...rest }) => {
    void _body;
    return rest;
  });

  return (
    <main className="mx-auto max-w-[1180px] px-4 pt-[100px] pb-20 sm:px-7">
      <div className="mb-7">
        <div className="mb-3.5 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
          Pre-owned
        </div>
        <h1 className="font-display mb-3 text-[clamp(36px,5vw,64px)] leading-none font-extrabold tracking-[-0.03em]">
          Used <span className="whitespace-nowrap">e-bikes<span className="text-amber">.</span></span>
        </h1>
        <p className="max-w-[46ch] text-sm leading-relaxed text-ink-2">
          Checked and priced at our Abingdon warehouse. One of each — enquire to
          view or reserve.
        </p>
      </div>

      {bikes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair px-6 py-14 text-center">
          <p className="mx-auto mb-5 max-w-[40ch] text-sm leading-relaxed text-ink-2">
            No used bikes listed right now. New trade-ins arrive often — call or
            WhatsApp and we&apos;ll tell you what&apos;s coming in.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Btn href={SITE.phoneHref} solid>
              Call
            </Btn>
            <Btn href={SITE.whatsapp} external>
              WhatsApp
            </Btn>
          </div>
        </div>
      ) : (
        <UsedBrowser bikes={bikes} />
      )}

      <p className="mt-10 max-w-[62ch] border-t border-hair pt-5 text-xs leading-[1.55] text-muted">
        Used bikes are sold as seen. WhatsApp or call {SITE.phoneDisplay} to
        book a viewing in Abingdon. Lead-gen listing — no web checkout.
      </p>
    </main>
  );
}
