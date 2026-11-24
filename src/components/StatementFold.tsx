"use client";

import { useEffect, useRef } from "react";

const FLOAT_IMG =
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80";

export function StatementFold() {
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = floatRef.current;
        if (!el) return;
        const sy = window.scrollY;
        el.style.transform = `translateY(${(sy * 0.04) % 40}px) rotate(${sy * 0.02}deg)`;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="relative grid min-h-screen place-items-center bg-ground px-7 py-[120px]">
      <div className="reveal relative w-full max-w-[920px]">
        <div
          className="font-display absolute top-0 right-0 text-[clamp(80px,14vw,180px)] leading-none font-extrabold tracking-[-0.04em] text-transparent"
          style={{ WebkitTextStroke: "1px var(--hair)" }}
          aria-hidden
        >
          01
        </div>
        <h2 className="font-display max-w-[22ch] text-[clamp(24px,3.6vw,52px)] leading-[1.12] font-bold tracking-[-0.03em]">
          Real machines, UK warehouse.{" "}
          <em className="not-italic text-amber">Talk to us</em> — this site brings
          you in, not checkout.
        </h2>
        <div
          ref={floatRef}
          className="pointer-events-none absolute right-[-4%] bottom-[-8%] aspect-square w-[min(280px,36vw)] overflow-hidden rounded-full bg-cover bg-center opacity-[0.42] max-[860px]:w-[180px] max-[860px]:opacity-[0.28]"
          style={{ backgroundImage: `url(${FLOAT_IMG})` }}
          aria-hidden
        />
      </div>
    </section>
  );
}
