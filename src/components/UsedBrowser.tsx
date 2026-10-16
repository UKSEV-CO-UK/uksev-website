"use client";

import { useMemo, useState } from "react";
import {
  STATUS_LABEL,
  USED_STATUSES,
  defaultUsedOrder,
  type UsedBikeSummary,
  type UsedStatus,
} from "@/lib/used-types";
import { UsedCard } from "./UsedCard";

type SortKey = "default" | "newest" | "price-asc" | "price-desc";
type StatusFilter = "all" | UsedStatus;

const selectCls =
  "min-w-[160px] appearance-none rounded-full border border-hair bg-ground-2 bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-16px)_55%,calc(100%-11px)_55%] bg-no-repeat py-3 pr-9 pl-4 text-[10.5px] tracking-[0.1em] uppercase outline-none focus:border-amber";
const selectStyle = {
  backgroundImage:
    "linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%)",
};

export function UsedBrowser({ bikes }: { bikes: UsedBikeSummary[] }) {
  const [brand, setBrand] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("default");

  const brands = useMemo(
    () => ["All", ...Array.from(new Set(bikes.map((b) => b.brand))).sort()],
    [bikes],
  );

  const list = useMemo(() => {
    const filtered = bikes.filter(
      (b) => (brand === "All" || b.brand === brand) && (status === "all" || b.status === status),
    );
    const soldLast = (a: UsedBikeSummary, b: UsedBikeSummary) =>
      (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0);
    return [...filtered].sort((a, b) => {
      if (sort === "default") return defaultUsedOrder(a, b);
      const s = soldLast(a, b);
      if (s) return s;
      if (sort === "newest") return b.date.localeCompare(a.date);
      if (sort === "price-asc") return a.price - b.price;
      return b.price - a.price;
    });
  }, [bikes, brand, status, sort]);

  const clear = () => {
    setBrand("All");
    setStatus("all");
    setSort("default");
  };

  return (
    <>
      <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:justify-end">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Status filter"
          className={selectCls}
          style={selectStyle}
        >
          <option value="all">Status · All</option>
          {USED_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort"
          className={selectCls}
          style={selectStyle}
        >
          <option value="default">Sort · Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price · low–high</option>
          <option value="price-desc">Price · high–low</option>
        </select>
      </div>

      {brands.length > 2 && (
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
      )}

      <div className="mb-[18px] flex items-baseline justify-between text-[10.5px] tracking-[0.12em] text-muted uppercase">
        <span>
          {list.length} bike{list.length === 1 ? "" : "s"}
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
            No bikes match. Clear filters.
          </div>
        ) : (
          list.map((b) => <UsedCard key={b.slug} bike={b} />)
        )}
      </div>
    </>
  );
}
