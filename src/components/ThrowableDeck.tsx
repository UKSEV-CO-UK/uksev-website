"use client";

import { useCallback, useRef, useState } from "react";
import {
  CLICK_MOVE,
  RUBBER_MAX,
  clampIndex,
  indexAfterRelease,
  rubberBandOffset,
} from "@/lib/deck-nav";
import styles from "./ThrowableDeck.module.css";

/** One card in the deck; built server-side from a new-bike listing. */
export type DeckItem = {
  img: string;
  eyebrow: string;
  title: string;
  /** Guide price (priceText) then first spec, each rendered in its own span. */
  meta: string[];
};

type Props = {
  items: DeckItem[];
};

type Ptr = {
  id: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  vx: number;
  locked: boolean | null;
};

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir === "prev" ? (
        <path d="M12.5 4.5 L7.5 10 l5 5.5" />
      ) : (
        <path d="M7.5 4.5 L12.5 10 l-5 5.5" />
      )}
    </svg>
  );
}

export function ThrowableDeck({ items }: Props) {
  const n = items.length;
  const multi = n > 1;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const ptrRef = useRef<Ptr | null>(null);

  const go = useCallback(
    (k: number) => {
      setIndex(clampIndex(k, n));
      setDragX(0);
      setDragging(false);
    },
    [n],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!multi) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    ptrRef.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      vx: 0,
      locked: null,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = ptrRef.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    const dt = Math.max(1, e.timeStamp - p.t);
    p.vx = (e.clientX - p.x) / dt;
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = e.timeStamp;
    if (p.locked == null) {
      if (Math.hypot(dx, dy) <= CLICK_MOVE) return;
      p.locked = Math.abs(dx) >= Math.abs(dy);
      if (!p.locked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    if (!p.locked) return;
    e.preventDefault();
    setDragX(rubberBandOffset(dx, index, n, RUBBER_MAX));
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = ptrRef.current;
    if (!p || p.id !== e.pointerId) return;
    ptrRef.current = null;
    const stage = stageRef.current;
    const dx = e.clientX - p.x0;
    const width = stage?.clientWidth ?? 1;
    const xRatio = stage ? (p.x0 - stage.getBoundingClientRect().left) / width : 0.5;
    if (p.locked === false) {
      setDragging(false);
      return;
    }
    const next = indexAfterRelease(index, n, dx, xRatio, width, p.vx);
    go(next);
  };

  const atStart = index <= 0;
  const atEnd = index >= n - 1;

  return (
    <div className="flex flex-col items-center gap-[18px]">
      <div
        data-testid="bike-deck"
        data-index={index}
        className={`relative aspect-square w-[min(420px,86vw)] outline-none focus-visible:shadow-[0_0_0_1px_var(--amber)] ${
          dragging ? "cursor-grabbing" : multi ? "cursor-pointer" : ""
        }`}
        tabIndex={0}
        role="region"
        aria-label={
          multi
            ? `Bike catalogue, bike ${index + 1} of ${n}. Use arrow keys or the buttons to change bike.`
            : "Bike catalogue"
        }
        onKeyDown={(e) => {
          if (!multi) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          }
        }}
      >
        <div
          ref={stageRef}
          data-testid="bike-deck-stage"
          className={`${styles.stage} ${multi ? styles.peek : ""} h-full overflow-hidden touch-pan-y`}
          style={
            {
              "--deck-i": index,
              "--deck-drag": `${dragX}px`,
              "--deck-end": atEnd && multi ? 1 : 0,
            } as React.CSSProperties
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        >
          <div
            className={`${styles.track} ${dragging ? "" : styles.settle}`}
          >
            {items.map((r, i) => (
              <article
                key={`${i}-${r.title}`}
                className={`${styles.slide} overflow-hidden rounded-[18px] border border-hair bg-ground shadow-[0_24px_50px_var(--shade-45)] select-none`}
                aria-hidden={i !== index}
              >
                <div
                  className="h-[68%] bg-cover bg-center"
                  style={{ backgroundImage: `url(${r.img})` }}
                />
                <div className="px-[18px] pt-[18px] pb-5">
                  <div className="mb-2 text-[10.5px] font-semibold text-amber">
                    {r.eyebrow}
                  </div>
                  <h3 className="font-display mb-1.5 text-[22px] tracking-[-0.02em]">
                    {r.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-3 text-xs text-ink-2">
                    {r.meta.map((part) => (
                      <span key={part}>{part}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        {multi && (
          <>
            <button
              type="button"
              data-testid="bike-deck-prev"
              aria-label="Previous bike"
              disabled={atStart}
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-2 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-hair bg-[var(--ground-80)] text-ink md:flex disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              data-testid="bike-deck-next"
              aria-label="Next bike"
              disabled={atEnd}
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-2 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-hair bg-[var(--ground-80)] text-ink md:flex disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <Chevron dir="next" />
            </button>
          </>
        )}
      </div>
      {multi && (
        <div className="flex items-center justify-center">
          {items.map((_, i) => {
            const current = i === index;
            return (
              <button
                key={i}
                type="button"
                data-testid="bike-deck-dot"
                data-dot={i}
                aria-label={`Bike ${i + 1} of ${n}`}
                aria-current={current ? "true" : undefined}
                onClick={() => go(i)}
                className="-mx-0.5 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
              >
                <span
                  className={`block h-1.5 rounded-full ${
                    current ? "w-4 bg-amber" : "w-1.5 bg-muted opacity-50"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
