import { getListed } from "@/lib/newbikes";
import { coverPhoto, modelTitle, priceText, splitSpecValue } from "@/lib/newbikes-types";
import { SITE, enquireMailto } from "@/config/site";
import { Btn } from "./Btn";
import { ThrowableDeck, type DeckItem } from "./ThrowableDeck";

/** The first four listings by `order` (the old `featured <= 4` deck). */
async function featuredDeck(): Promise<DeckItem[]> {
  return (await getListed())
    .filter((b) => b.order != null)
    .slice(0, 4)
    .map((b) => ({
      img: coverPhoto(b)?.src ?? "",
      eyebrow: b.brand,
      title: modelTitle(b.brand, b.model),
      meta: [priceText(b), ...(b.specs[0]?.value ? splitSpecValue(b.specs[0].value) : [])].filter(
        (v): v is string => Boolean(v),
      ),
    }));
}

export async function ReleasesDeck() {
  const items = await featuredDeck();
  return (
    <section id="rides" className="bg-ground-2 px-7 py-[100px] md:py-20">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-9 md:grid-cols-2 md:gap-12">
        <div className="reveal">
          <h2 className="font-display mb-[18px] max-w-[12ch] text-[clamp(28px,3.2vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">
            The range
          </h2>
          <p className="mb-7 max-w-[36ch] text-[15px] leading-relaxed text-ink-2">
            A physical deck of the range. Flick through, then enquire — no online bag for now.
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
          <ThrowableDeck items={items} />
        </div>
      </div>
    </section>
  );
}
