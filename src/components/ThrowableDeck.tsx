"use client";

import { useCallback, useEffect, useRef, useState } from "react";
/** One card in the deck; built server-side from a new-bike listing. */
export type DeckItem = {
  img: string;
  eyebrow: string;
  title: string;
  meta: string;
};

type Props = {
  items: DeckItem[];
};

function stackStyle(i: number) {
  const x = i * 10;
  const y = i * -8;
  const s = 1 - i * 0.04;
  const r = i * -2.5;
  return `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
}

export function ThrowableDeck({ items }: Props) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const deckRef = useRef<HTMLDivElement>(null);
  const topCardRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    el: HTMLElement;
    x0: number;
    y0: number;
    dx: number;
    dy: number;
  } | null>(null);

  const advance = useCallback(() => {
    setOrder((prev) => prev.slice(1).concat(prev[0]!));
  }, []);

  const throwDir = useCallback(
    (dir: number) => {
      const deck = deckRef.current;
      const top = topCardRef.current;
      if (!deck || !top) return;
      top.style.transition = "";
      top.style.transform = `translate(${dir * deck.clientWidth * 1.15}px, -40px) rotate(${dir * 18}deg)`;
      top.style.opacity = "0";
      window.setTimeout(advance, 280);
    },
    [advance],
  );

  useEffect(() => {
    const el = topCardRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      if (e.button != null && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      el.style.transition = "none";
      dragRef.current = { el, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.el !== el) return;
      drag.dx = e.clientX - drag.x0;
      drag.dy = e.clientY - drag.y0;
      const rot = drag.dx * 0.08;
      el.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${rot}deg) scale(1.03)`;
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag || drag.el !== el) return;
      const deck = deckRef.current;
      const w = deck?.clientWidth ?? 400;
      const pass = Math.abs(drag.dx) > w * 0.1;
      el.style.transition = "";
      if (pass) {
        const dir = drag.dx >= 0 ? 1 : -1;
        el.style.transform = `translate(${dir * w * 1.15}px, ${drag.dy - 40}px) rotate(${dir * 18}deg)`;
        el.style.opacity = "0";
        window.setTimeout(advance, 280);
      } else {
        el.style.transform = stackStyle(0);
      }
      dragRef.current = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [order, advance]);

  const front = order[0] ?? 0;
  const visible = order.slice(0, Math.min(4, order.length));

  return (
    <div className="flex flex-col items-center gap-[18px]">
      <div
        ref={deckRef}
        className="relative aspect-square w-[min(420px,86vw)] touch-pan-y outline-none focus-visible:shadow-[0_0_0_1px_var(--amber)]"
        tabIndex={0}
        aria-label="Bike catalogue deck. Drag or use arrow keys."
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            throwDir(-1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            throwDir(1);
          }
        }}
      >
        {[...visible].reverse().map((rideIdx, rev) => {
          const depth = visible.length - 1 - rev;
          const r = items[rideIdx]!;
          return (
            <article
              key={`${rideIdx}-${order.join("-")}-${depth}`}
              ref={depth === 0 ? (node) => { topCardRef.current = node; } : undefined}
              className="absolute inset-0 cursor-grab overflow-hidden rounded-[18px] border border-hair bg-ground shadow-[0_24px_50px_rgba(0,0,0,.45)] select-none will-change-transform active:cursor-grabbing"
              style={{
                zIndex: 20 - depth,
                transform: stackStyle(depth),
                transition:
                  "transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s",
              }}
            >
              <div
                className="h-[68%] bg-cover bg-center"
                style={{ backgroundImage: `url(${r.img})` }}
              />
              <div className="px-[18px] pt-[18px] pb-5">
                <div className="mb-2 text-[10.5px] font-semibold tracking-[0.14em] text-amber uppercase">
                  {r.eyebrow}
                </div>
                <h3 className="font-display mb-1.5 text-[22px] tracking-[-0.02em]">
                  {r.title}
                </h3>
                <div className="text-xs text-ink-2">{r.meta}</div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="text-[10.5px] tracking-[0.14em] text-muted uppercase">
        Drag / ← → to throw a sleeve
      </div>
      <div className="flex gap-2" aria-hidden>
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i === front ? "bg-amber opacity-100" : "bg-muted opacity-50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
