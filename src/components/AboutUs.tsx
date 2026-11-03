import { SITE } from "@/lib/site";
import { Btn } from "./Btn";

export function AboutUs() {
  return (
    <section id="about" className="border-t border-hair bg-ground px-7 py-[100px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-7 md:grid-cols-[1fr_1.15fr] md:gap-12">
        <div className="reveal">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            About us
          </div>
          <h2 className="font-display mb-[18px] text-[clamp(28px,3.4vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">
            UK warehouse.
            <br />
            Built to answer.
          </h2>
        </div>
        <div className="reveal">
          <p className="mb-[22px] max-w-[40ch] text-balance text-[15px] leading-[1.65] text-ink-2">
            UKSEV LTD holds electric bikes in UK stock.
            This site is how you find what&apos;s ready — then call or WhatsApp for a
            firm quote.
          </p>
          <ul className="grid list-none gap-3.5">
            <li className="flex items-center gap-3.5 text-[13px]">
              <span className="h-px w-[18px] shrink-0 bg-amber" />
              <span>UKSEV LTD · viewing by appointment</span>
            </li>
            <li className="flex items-center gap-3.5 text-[13px]">
              <span className="h-px w-[18px] shrink-0 bg-amber" />
              <span>Warehouse stock · guide prices on site</span>
            </li>
            <li className="flex items-center gap-3.5 text-[13px]">
              <span className="h-px w-[18px] shrink-0 bg-amber" />
              <span>{SITE.phoneDisplay} · enquire to confirm</span>
            </li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
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
