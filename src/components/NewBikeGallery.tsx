"use client";

import { useState } from "react";
import type { Colour, Photo } from "@/lib/newbikes-types";

/** Colour picker only when colours exist; otherwise the first loose photo. */
export function NewBikeGallery({
  colours,
  photos = [],
  alt,
}: {
  colours: Colour[];
  photos?: Photo[];
  alt: string;
}) {
  const [colourName, setColourName] = useState(colours[0]?.name);
  const colour = colours.find((c) => c.name === colourName) ?? colours[0];
  const photo = colour?.photos[0] ?? photos[0];

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-hair bg-photo-ground">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={alt}
            className="mx-auto box-border aspect-square w-full max-w-[640px] object-contain p-[6%] mix-blend-multiply"
          />
        )}
      </div>
      {colours.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {colours.map((c) => {
            const selected = c.name === colour?.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setColourName(c.name)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase ${
                  selected ? "border-ink text-ink" : "border-hair text-ink-2 hover:border-amber hover:text-amber"
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-hair"
                  style={{ background: c.swatch || "var(--muted)" }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
