import { Btn } from "./Btn";

const shots = [
  {
    img: "https://images.unsplash.com/photo-1485965120185-cf2e4c4b4c8c?auto=format&fit=crop&w=1000&q=80",
    caption: "Sample · floor",
    tall: true,
  },
  {
    img: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=800&q=80",
    caption: "Sample · ride",
  },
  {
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
    caption: "Sample · detail",
  },
  {
    img: "https://images.unsplash.com/photo-1571333252816-854421cead5b?auto=format&fit=crop&w=800&q=80",
    caption: "Sample · workshop",
  },
];

export function AboutUs() {
  return (
    <section id="about" className="border-t border-hair bg-ground px-7 py-[100px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-7 md:grid-cols-[1fr_1.15fr] md:gap-12">
        <div className="reveal">
          <div className="mb-4 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
            About us
          </div>
          <h2 className="font-display mb-[18px] text-[clamp(28px,3.4vw,48px)] leading-[1.1] font-bold tracking-[-0.03em]">
            UK warehouse.
            <br />
            Built to answer.
          </h2>
          <p className="mb-[22px] max-w-[40ch] text-balance text-[15px] leading-[1.65] text-ink-2">
            UKSEV LTD holds electric bikes in UK stock.
            This site is how you find what&apos;s ready — then call or WhatsApp for a
            firm quote. Photos below are placeholders until we swap in our own.
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
              <span>+44 7521 63699 · enquire to confirm</span>
            </li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn href="/#contact" solid>
              Contact
            </Btn>
            <Btn href="/shop">Browse rides</Btn>
          </div>
        </div>
        <div className="reveal grid grid-cols-2 grid-rows-[160px_160px] gap-3 max-[860px]:grid-rows-[140px_140px] md:grid-cols-[1.2fr_1fr]">
          {shots.map((s) => (
            <figure
              key={s.caption}
              className={`relative m-0 min-h-[140px] overflow-hidden rounded-[14px] border border-hair bg-cover bg-center ${
                s.tall ? "row-span-2 min-h-full max-[860px]:row-span-1" : ""
              }`}
              style={{ backgroundImage: `url(${s.img})` }}
            >
              <figcaption className="absolute bottom-2.5 left-3 rounded bg-[rgba(10,12,14,0.55)] px-2 py-1 text-[10px] tracking-[0.12em] whitespace-nowrap text-ink uppercase">
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
