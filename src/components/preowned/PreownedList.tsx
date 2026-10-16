"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  GRADES,
  GRADE_WORD,
  newestFirst,
  priceBand,
  type Grade,
  type PreownedSummary,
  type PriceBand,
} from "@/lib/preowned-types";
import { whatsappHref } from "@/lib/preowned-links";
import { Icon } from "./icons";
import { PreownedCard } from "./PreownedCard";

type Panel = "brand" | "band" | "grade";
type Sort = "newest" | "price-asc" | "price-desc";

const BAND_OPTS: [PriceBand | "all", string, string][] = [
  ["all", "Any", "Any"],
  ["lo", "Under £600", "< £600"],
  ["mid", "£600–£900", "£600–900"],
  ["hi", "£900+", "£900+"],
];

// ?brand=X (from "Find similar") — read without useSearchParams so the grid
// still prerenders in the static export.
const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const getUrlBrand = () => new URLSearchParams(window.location.search).get("brand");
const getServerBrand = () => null;

export function PreownedList({ bikes }: { bikes: PreownedSummary[] }) {
  const urlBrand = useSyncExternalStore(subscribe, getUrlBrand, getServerBrand);
  const [brandPick, setBrandPick] = useState<string | null>(null);
  const [band, setBand] = useState<PriceBand | "all">("all");
  const [grade, setGrade] = useState<Grade | "all">("all");
  const [availOnly, setAvailOnly] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sort, setSort] = useState<Sort>("newest");

  const brands = useMemo(
    () => Array.from(new Set(bikes.map((b) => b.brand))).sort((a, b) => a.localeCompare(b)),
    [bikes],
  );
  const brandFromUrl =
    urlBrand && brands.find((b) => b.toLowerCase() === urlBrand.toLowerCase());
  const brand = brandPick ?? brandFromUrl ?? "all";

  const list = useMemo(() => {
    const f = bikes.filter(
      (b) =>
        (brand === "all" || b.brand === brand) &&
        (band === "all" || priceBand(b.price) === band) &&
        (grade === "all" || b.grade === grade) &&
        (!availOnly || b.status !== "sold"),
    );
    return [...f].sort((a, b) => {
      if (sort === "newest") return newestFirst(a, b);
      const s = (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0);
      if (s) return s;
      return sort === "price-asc" ? a.price - b.price : b.price - a.price;
    });
  }, [bikes, brand, band, grade, availOnly, sort]);
  const soldCount = list.filter((b) => b.status === "sold").length;

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const bandLabel = BAND_OPTS.find((o) => o[0] === band)![2];

  return (
    <>
      <div className="filters">
        <div className="frow">
          <button
            type="button"
            className="chip toggle"
            aria-pressed={availOnly}
            onClick={() => setAvailOnly((v) => !v)}
          >
            <span className="sw" />
            Available only
          </button>
          <span className="sep" />
          <button type="button" className="chip dd" aria-expanded={panel === "brand"} onClick={() => toggle("brand")}>
            Brand <b>{brand === "all" ? "All" : brand}</b>
            <Icon name="chev" />
          </button>
          <button type="button" className="chip dd" aria-expanded={panel === "band"} onClick={() => toggle("band")}>
            Price <b>{bandLabel}</b>
            <Icon name="chev" />
          </button>
          <button type="button" className="chip dd" aria-expanded={panel === "grade"} onClick={() => toggle("grade")}>
            Condition <b>{grade === "all" ? "Any" : grade}</b>
            <Icon name="chev" />
          </button>
        </div>
        {panel === "brand" && (
          <div className="frow panel">
            <span className="lab">Brand</span>
            {["all", ...brands].map((v) => (
              <button key={v} type="button" className="chip opt" aria-pressed={brand === v} onClick={() => setBrandPick(v)}>
                {v === "all" ? "All" : v}
              </button>
            ))}
          </div>
        )}
        {panel === "band" && (
          <div className="frow panel">
            <span className="lab">Guide</span>
            {BAND_OPTS.map(([v, label]) => (
              <button key={v} type="button" className="chip opt" aria-pressed={band === v} onClick={() => setBand(v)}>
                {label}
              </button>
            ))}
          </div>
        )}
        {panel === "grade" && (
          <div className="frow panel">
            <span className="lab">Grade</span>
            {(["all", ...GRADES] as const).map((v) => (
              <button key={v} type="button" className="chip opt" aria-pressed={grade === v} onClick={() => setGrade(v)}>
                {v === "all" ? "Any" : `${v} · ${GRADE_WORD[v]}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bar">
        <span>
          <b>{list.length}</b> bike{list.length === 1 ? "" : "s"} ·{" "}
          {soldCount ? `${soldCount} recently sold` : "all available"}
        </span>
        <label className="sort">
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest first</option>
            <option value="price-asc">Price · low to high</option>
            <option value="price-desc">Price · high to low</option>
          </select>
          <Icon name="chev" />
        </label>
      </div>

      {list.length ? (
        <section className="grid">
          {list.map((b) => (
            <PreownedCard key={b.slug} bike={b} />
          ))}
        </section>
      ) : (
        <p className="empty">
          No bikes match these filters. New arrivals land most weeks —{" "}
          <a href={whatsappHref("Hi, please let me know when new pre-owned bikes come in.")} target="_blank" rel="noopener noreferrer">
            get notified
          </a>
          .
        </p>
      )}
    </>
  );
}
