"use client";

import { useEffect, useRef } from "react";
import { SITE } from "@/lib/site";

const HERO_IMG =
  "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=2000&q=80";

export function PortalHero() {
  const portalRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const duoRef = useRef<HTMLDivElement>(null);
  const plRef = useRef<HTMLDivElement>(null);
  const prRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);
  const hrRef = useRef<HTMLSpanElement>(null);
  const daRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const portal = portalRef.current;
    if (!portal) return;

    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    const tick = () => {
      const rect = portal.getBoundingClientRect();
      const total = portal.offsetHeight - window.innerHeight;
      const scrolled = clamp(-rect.top, 0, total);
      const p = total ? scrolled / total : 0;

      if (plRef.current) plRef.current.style.transform = `translateX(${-p * 110}%)`;
      if (prRef.current) prRef.current.style.transform = `translateX(${p * 110}%)`;
      if (imgRef.current) imgRef.current.style.transform = `scale(${1.12 - p * 0.12})`;
      if (duoRef.current) duoRef.current.style.opacity = String(p * 0.22);

      const scale = 1 + p * 0.35;
      const tracking = -0.02 - p * 0.025;
      if (titleRef.current) {
        titleRef.current.style.transform = `scale(${scale})`;
        titleRef.current.style.letterSpacing = `${tracking}em`;
      }
      if (wordRef.current) wordRef.current.style.letterSpacing = `${tracking}em`;

      const shift = p * 42;
      if (hlRef.current) hlRef.current.style.transform = `translateX(${-shift}%)`;
      if (hrRef.current) hrRef.current.style.transform = `translateX(${shift}%)`;
      if (daRef.current)
        daRef.current.style.transform = `translate(calc(-50% - ${p * 42}vw), calc(-50% - ${p * 28}vh))`;
      if (dbRef.current)
        dbRef.current.style.transform = `translate(calc(-50% + ${p * 42}vw), calc(-50% + ${p * 28}vh))`;
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      ref={portalRef}
      id="top"
      aria-label="Hero"
      className="relative h-[250vh] motion-reduce:h-screen"
    >
      <div className="sticky top-0 h-screen isolate overflow-hidden">
        <div
          ref={imgRef}
          className="absolute -inset-[8%] bg-cover bg-center will-change-transform motion-reduce:!scale-100"
          style={{
            backgroundImage: `url(${HERO_IMG})`,
            transform: "scale(1.12)",
          }}
        />
        <div
          ref={duoRef}
          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-overlay motion-reduce:!opacity-[0.18]"
          style={{
            background:
              "linear-gradient(120deg, rgba(232,145,60,.55), rgba(46,107,114,.55))",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, rgba(10,12,14,.75) 80%)",
          }}
        />
        <div
          ref={plRef}
          className="absolute top-0 bottom-0 left-0 z-[2] w-[52%] bg-ground will-change-transform motion-reduce:!-translate-x-[110%]"
        />
        <div
          ref={prRef}
          className="absolute top-0 right-0 bottom-0 z-[2] w-[52%] bg-ground will-change-transform motion-reduce:!translate-x-[110%]"
        />
        <div
          ref={daRef}
          className="absolute top-1/2 left-1/2 z-[3] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber text-amber will-change-transform shadow-[0_0_12px_currentColor]"
        />
        <div
          ref={dbRef}
          className="absolute top-1/2 left-1/2 z-[3] h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal text-teal will-change-transform shadow-[0_0_12px_currentColor]"
        />
        <div
          ref={titleRef}
          className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center will-change-transform"
        >
          <div
            ref={wordRef}
            className="font-display flex text-[clamp(42px,9vw,120px)] leading-none font-extrabold tracking-[-0.02em]"
          >
            <span ref={hlRef} className="inline-block will-change-transform">
              UK
            </span>
            <span ref={hrRef} className="inline-block will-change-transform">
              SEV
            </span>
          </div>
        </div>
        <div className="absolute top-[78px] left-7 z-[5] text-[10.5px] font-medium tracking-[0.14em] text-ink-2 uppercase">
          UKSEV LTD <span className="text-amber">/</span> UK
        </div>
        <div className="absolute top-[78px] right-7 z-[5] hidden text-right text-[10.5px] font-medium tracking-[0.14em] text-ink-2 uppercase sm:block">
          Electric bikes <span className="text-amber">·</span> UK warehouse
        </div>
        <div className="absolute bottom-7 left-7 z-[5] text-[10.5px] font-medium tracking-[0.14em] text-ink-2 uppercase">
          Scroll to open
        </div>
        <div className="absolute right-7 bottom-7 z-[5] hidden text-right text-[10.5px] font-medium tracking-[0.14em] text-ink-2 uppercase sm:block">
          {SITE.phoneDisplay}
        </div>
      </div>
    </section>
  );
}
