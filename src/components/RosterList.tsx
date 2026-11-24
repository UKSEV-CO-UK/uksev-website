/** Brand lines shown on the home page (copy, not catalogue data). */
const brandRoster = [
  { name: "ADO", blurb: "Carbon fold" },
  { name: "ENGWE", blurb: "Fat / utility" },
  { name: "LANKELEISI", blurb: "Dual motor" },
  { name: "COSWHEEL", blurb: "High power" },
  { name: "DUOTTS · DYU · Eleglide", blurb: "More lines" },
] as const;

export function RosterList() {
  return (
    <section id="brands" className="mx-auto max-w-[980px] px-7 py-20">
      {brandRoster.map((b) => (
        <div
          key={b.name}
          className="reveal grid grid-cols-1 items-baseline gap-2 border-t border-hair py-[22px] last:border-b max-[860px]:gap-2 md:grid-cols-[120px_1fr_auto] md:gap-5"
        >
          <span className="text-[10.5px] font-semibold text-amber">
            Brand
          </span>
          <span className="font-display text-[clamp(22px,3vw,34px)] font-bold tracking-[-0.03em]">
            {b.name}
          </span>
          <span className="text-[13px] text-ink-2">{b.blurb}</span>
        </div>
      ))}
    </section>
  );
}
