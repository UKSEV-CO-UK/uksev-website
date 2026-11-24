"use client";

import { useMemo, useState } from "react";
import { featuredFirst, type NewBikeSummary } from "@/lib/newbikes-types";
import { NewBikeCard } from "./NewBikeCard";

type PriceFilter = "all" | "sale";
type SortKey = "featured" | "name" | "brand" | "price-asc" | "price-desc";

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
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
          aria-label="Price filter"
          className="min-w-[160px] appearance-none rounded-full border border-hair bg-ground-2 bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-16px)_55%,calc(100%-11px)_55%] bg-no-repeat py-3 pr-9 pl-4 text-[10.5px] tracking-[0.1em] uppercase outline-none focus:border-amber"
          style={{
            backgroundImage:
              "linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%)",
          }}
        >
          <option value="all">Price · All</option>
          <option value="sale">Guide sale</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort"
          className="min-w-[160px] appearance-none rounded-full border border-hair bg-ground-2 bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-16px)_55%,calc(100%-11px)_55%] bg-no-repeat py-3 pr-9 pl-4 text-[10.5px] tracking-[0.1em] uppercase outline-none focus:border-amber"
          style={{
            backgroundImage:
              "linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%)",
          }}
        >
          <option value="featured">Sort · Featured</option>
          <option value="name">Name A–Z</option>
          <option value="brand">Brand A–Z</option>
          <option value="price-asc">Price · low–high</option>
          <option value="price-desc">Price · high–low</option>
        </select>
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
