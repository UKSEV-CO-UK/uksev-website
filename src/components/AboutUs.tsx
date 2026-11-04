import { SITE } from "@/lib/site";
import { Btn } from "./Btn";

const facts = [
  { title: "UK stock", body: "E-bikes held in our UK warehouse, ready to go." },
  { title: "Viewing by appointment", body: "Call or WhatsApp to arrange a look." },
  { title: "Guide prices on site", body: <>Firm quote on <span className="whitespace-nowrap">{SITE.phoneDisplay}</span>.</> },
];

export function AboutUs() {
  return (
    <section id="about" className="border-t border-hair bg-ground px-7 py-[100px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-8 md:grid-cols-[1fr_1.15fr] md:gap-12">
        <div className="reveal">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            About us
          </div>
          <h2 className="font-display text-[clamp(28px,3.4vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">
            UK warehouse.
            <br />
            Built to answer.
          </h2>
        </div>
        <div className="reveal">
          <p className="mb-4 max-w-[52ch] text-[15px] leading-[1.65] text-ink-2">
            UKSEV LTD holds electric bikes in UK stock, so what you see here is ready to ride — not
            weeks away on a container.
          </p>
          <p className="max-w-[52ch] text-[15px] leading-[1.65] text-ink-2">
            Browse what&apos;s in, then call or WhatsApp us for a firm quote or to book a viewing.
          </p>
          <ul className="mt-8 grid list-none grid-cols-1 gap-6 border-t border-hair pt-8 sm:grid-cols-3 sm:gap-5">
            {facts.map((f) => (
              <li key={f.title}>
                <span className="mb-3 block h-[2px] w-[18px] bg-amber" />
                <div className="mb-1.5 text-[13px] font-semibold text-ink">{f.title}</div>
                <div className="text-[13px] leading-[1.55] text-ink-2">{f.body}</div>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <Btn href="/#contact" solid>
              Contact
            </Btn>
            <Btn href="/shop">Browse rides</Btn>
          </div>
        </div>
      </div>
    </section>
  );
}
