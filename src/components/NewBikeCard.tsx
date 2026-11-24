"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn } from "./Btn";
import { SalePrice } from "./SalePrice";
import { enquireMailto, SITE } from "@/lib/site";
import {
  bikeName,
  coverPhoto,
  TYPE_LABEL,
  type NewBikeSummary,
} from "@/lib/newbikes-types";

function whatsappBike(name: string): string {
  const text = `Hi, I'm enquiring about the ${name}.`;
  const base = SITE.whatsapp.split("?")[0];
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** True when a spec value just repeats the card title or the type label. */
function isDuplicateSpec(value: string, bike: NewBikeSummary): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return v === bike.model.trim().toLowerCase() || v === TYPE_LABEL[bike.type].trim().toLowerCase();
}

/** One-line spec summary for listings without card highlights (e.g. migrated catalogue rows). */
function specLine(bike: NewBikeSummary): string {
  return bike.specs
    .map((row) => row.value)
    .filter((value) => !isDuplicateSpec(value, bike))
    .join(" · ");
}

function hasHighlights(bike: NewBikeSummary): boolean {
  return (
    bike.rangeKm != null ||
    bike.rangeMiles != null ||
    bike.weightKg != null ||
    bike.topSpeedKmh != null ||
    bike.batteryWh != null
  );
}

function highlight(bike: NewBikeSummary) {
  return [
    {
      label: "Range",
      value:
        bike.rangeKm != null
          ? `${bike.rangeKm} km`
          : bike.rangeMiles != null
            ? `${bike.rangeMiles} mi`
            : "—",
    },
    {
      label: "Weight",
      value: bike.weightKg != null ? `${bike.weightKg} kg` : "—",
    },
    {
      label: "Top speed",
      value: bike.topSpeedKmh != null ? `${bike.topSpeedKmh} km/h` : "—",
    },
    {
      label: "Battery",
      value: bike.batteryWh != null ? `${bike.batteryWh} Wh` : "—",
    },
  ];
}

export function NewBikeCard({ bike }: { bike: NewBikeSummary }) {
  const [colourName, setColourName] = useState(bike.colours[0]?.name);
  const colour = bike.colours.find((c) => c.name === colourName) ?? bike.colours[0];
  const cover = coverPhoto(bike, colour?.name);
  const name = bikeName(bike);
  const href = `/shop/${bike.slug}/`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-hair bg-ground-2 transition-colors hover:border-[rgba(232,145,60,0.45)]">
      <Link href={href} className="relative block aspect-[4/3] bg-[#f4f4f2]" aria-label={name}>
        {cover && (
          // plain img: static export, unoptimized images
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.src}
            alt=""
            className="absolute inset-0 box-border h-full w-full object-contain p-[6%]"
          />
        )}
        {bike.colours.length > 1 && (
          <div
            className="absolute bottom-3 left-3 flex gap-1.5"
            onClick={(e) => e.preventDefault()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {bike.colours.map((c) => {
              const selected = c.name === colour?.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  title={c.name}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setColourName(c.name);
                  }}
                  className={`h-4 w-4 rounded-full border ${
                    selected ? "border-ink ring-1 ring-ink ring-offset-1 ring-offset-ground-2" : "border-hair"
                  }`}
                  style={{ background: c.swatch || "#6c7378" }}
                />
              );
            })}
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-[18px]">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-amber uppercase">
          {bike.brand}
        </div>
        <h3 className="font-display text-xl font-bold tracking-[-0.02em]">
          <Link href={href}>{bike.model}</Link>
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <SalePrice price={bike.price} wasPrice={bike.wasPrice} priceFrom={bike.priceFrom} />
        </div>
        {hasHighlights(bike) ? (
          <div className="mt-1 grid grid-cols-4 gap-1 border-t border-hair pt-3">
            {highlight(bike).map((row) => (
              <div key={row.label} className="min-w-0">
                <div className="truncate font-display text-sm font-semibold tracking-[-0.02em]">{row.value}</div>
                <div className="text-[9.5px] tracking-[0.1em] text-muted uppercase">{row.label}</div>
              </div>
            ))}
          </div>
        ) : (
          specLine(bike) && (
            <div className="mt-1 flex-1 border-t border-hair pt-3 text-xs leading-[1.45] text-ink-2">
              {specLine(bike)}
            </div>
          )
        )}
        <div className="mt-2.5 grid grid-cols-[1.2fr_1fr] gap-2">
          <Btn href={enquireMailto(name)} solid className="!px-2 !py-[11px] text-center">
            Enquire
          </Btn>
          <Btn href={whatsappBike(name)} external className="!px-2 !py-[11px] text-center">
            WhatsApp
          </Btn>
        </div>
      </div>
    </article>
  );
}
