"use client";

import { useState } from "react";

export function UsedGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-hair bg-[#15181c] text-[10.5px] tracking-[0.14em] text-muted uppercase">
        Photos on request
      </div>
    );
  }
  const current = photos[Math.min(i, photos.length - 1)];
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-hair bg-[#15181c]">
        {/* plain img: static export with unoptimized images, unknown aspect ratios */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={`${alt} — photo ${i + 1} of ${photos.length}`}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {photos.map((p, n) => (
            <button
              key={p + n}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Show photo ${n + 1}`}
              aria-current={n === i}
              className={`cursor-pointer overflow-hidden rounded-lg border bg-[#15181c] p-0 transition-colors ${
                n === i ? "border-amber" : "border-hair hover:border-amber"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
