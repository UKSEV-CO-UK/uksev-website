"use client";

import { useMemo, useState } from "react";
import { featuredFirst, type NewBikeSummary } from "@/lib/newbikes-types";
import { NewBikeCard } from "./NewBikeCard";

type PriceFilter = "all" | "sale";
type SortKey = "featured" | "name" | "brand" | "price-asc" | "price-desc";

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Guide sale" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "name", label: "Name A–Z" },
  { value: "brand", label: "Brand A–Z" },
  { value: "price-asc", label: "Price low–high" },
  { value: "price-desc", label: "Price high–low" },
];

function optionLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Native select under a visible label + grey value, so the control has no "·" join. */
function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="relative flex min-w-[160px] items-baseline gap-x-3 rounded-full border border-hair bg-ground-2 bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-16px)_55%,calc(100%-11px)_55%] bg-no-repeat py-3 pr-9 pl-4 text-[10.5px] tracking-[0.1em] uppercase outline-none focus-within:border-amber"
      style={{
        backgroundImage:
          "linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%)",
      }}
    >
      <span>{label}</span>
      <span className="text-ink-2">{optionLabel(options, value)}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Brand chips in the order brands first appear in the Featured list. */
function brandsOf(bikes: NewBikeSummary[]): string[] {
  return ["All", ...Array.from(new Set([...bikes].sort(featuredFirst).map((b) => b.brand)))];
}

export function ShopToolbar({ bikes }: { bikes: NewBikeSummary[] }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("All");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const brands = useMemo(() => brandsOf(bikes), [bikes]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    let filtered = bikes.filter((i) => {
      if (brand !== "All" && i.brand !== brand) return false;
      if (priceFilter === "sale" && !(i.wasPrice != null && i.wasPrice > i.price)) return false;
      if (query) {
        const spec = i.specs.map((s) => s.value).join(" ");
        const hay = `${i.brand} ${i.model} ${i.code ?? ""} ${spec}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sort === "name") return a.model.localeCompare(b.model);
      if (sort === "brand")
        return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return featuredFirst(a, b);
    });

    return filtered;
  }, [bikes, q, brand, priceFilter, sort]);

  const clear = () => {
    setBrand("All");
    setQ("");
    setSort("featured");
    setPriceFilter("all");
  };

  return (
    <>
      <div className="mb-[18px] grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_auto_auto]">
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted"
            aria-hidden
          >
            ⌕
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search model, brand, code…"
            autoComplete="off"
            className="w-full rounded-full border border-hair bg-ground-2 py-3 pr-4 pl-10 text-[13px] outline-none focus:border-amber"
          />
        </div>
        <LabeledSelect
          label="Price"
          value={priceFilter}
          options={PRICE_OPTIONS}
          onChange={setPriceFilter}
          ariaLabel="Price filter"
        />
        <LabeledSelect
          label="Sort"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
          ariaLabel="Sort"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-hair pb-5">
        {brands.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrand(b)}
            className={`cursor-pointer rounded-full border px-3.5 py-2 text-[10.5px] tracking-[0.12em] uppercase transition-colors ${
              b === brand
                ? "border-amber text-amber"
                : "border-hair text-ink-2 hover:border-amber hover:text-amber"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mb-[18px] flex items-baseline justify-between text-[10.5px] tracking-[0.12em] text-muted uppercase">
        <span>
          {list.length} ride{list.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={clear}
          className="cursor-pointer border-0 bg-transparent text-[10.5px] tracking-[0.12em] text-amber uppercase"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-hair py-12 text-center text-sm text-ink-2">
            No rides match. Clear filters or try another search.
          </div>
        ) : (
          list.map((b) => <NewBikeCard key={b.slug} bike={b} />)
        )}
      </div>
    </>
  );
}
