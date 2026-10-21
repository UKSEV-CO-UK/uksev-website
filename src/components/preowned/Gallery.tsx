"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/lib/preowned-types";
import { Icon } from "./icons";

/** Swipe gallery: scroll-snap slides, progress ticks on mobile, thumbnails on desktop. */
export function Gallery({
  photos,
  alt,
  sold,
  children,
}: {
  photos: Photo[];
  alt: string;
  sold?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const n = photos.length;
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setI(Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const go = (k: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.clientWidth * k, behavior: "smooth" });
  };
  const thumbs = photos.slice(0, 6);
  const caption = photos[i]?.caption;

  return (
    <section className={`gal${n === 1 ? " single" : ""}${sold ? " sold" : ""}`} aria-label="Photos">
      <div className="slides" ref={ref} onScroll={onScroll}>
        {photos.map((p, k) => (
          <div className="ph slide" key={p.src + k}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt={p.caption ? `${alt} — ${p.caption}` : `${alt} — photo ${k + 1} of ${n}`}
              loading={k === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      {children}
      {caption && <span className="cap">{caption}</span>}
      <span className="ctr">
        <Icon name="cam" />
        <span>
          {i + 1} / {n}
        </span>
      </span>
      {n > 1 && (
        <div className="prog" aria-hidden="true">
          {photos.map((p, k) => (
            <i key={p.src + k} className={k === i ? "on" : ""} />
          ))}
        </div>
      )}
      {n > 1 && (
        <div className="thumbs">
          {thumbs.map((p, k) => (
            <button
              type="button"
              key={p.src + k}
              className={k === i ? "on" : ""}
              onClick={() => go(k === 5 && n > 6 ? 5 : k)}
              aria-label={`Show photo ${k + 1}`}
            >
              <span className="ph">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" loading="lazy" />
              </span>
              {k === 5 && n > 6 && <span className="more">+{n - 6}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
