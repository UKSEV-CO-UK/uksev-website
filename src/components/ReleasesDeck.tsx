import { featuredDeck } from "@/data/products";
import { SITE, enquireMailto } from "@/lib/site";
import { Btn } from "./Btn";
import { ThrowableDeck } from "./ThrowableDeck";

export function ReleasesDeck() {
  return (
    <section id="rides" className="bg-ground-2 px-7 py-[100px] md:py-20">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-9 md:grid-cols-2 md:gap-12">
        <div className="reveal">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            Catalogue
          </div>
          <h2 className="font-display mb-[18px] max-w-[12ch] text-[clamp(28px,3.2vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">
            Rides in the warehouse
          </h2>
          <p className="mb-7 max-w-[36ch] text-[15px] leading-relaxed text-ink-2">
            A physical deck of what we hold in UK stock. Flick through, then enquire
            — no online bag for now.
          </p>
          <div className="flex flex-wrap gap-3">
            <Btn href={enquireMailto()} solid>
              Enquire
            </Btn>
            <Btn href={SITE.whatsapp} external>
              WhatsApp
            </Btn>
            <Btn href="/shop">Full catalogue</Btn>
          </div>
        </div>
        <div className="reveal">
          <ThrowableDeck items={featuredDeck} />
        </div>
      </div>
    </section>
  );
}
