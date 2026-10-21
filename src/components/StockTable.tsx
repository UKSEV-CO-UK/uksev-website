const rows = [
  {
    place: "Viewing",
    detail: "By appointment",
    action: "Stock check",
    note: "Mon–Fri & Sat am",
  },
  {
    place: "Phone",
    detail: "+44 7521 63699",
    action: "Call / WhatsApp",
    note: "Same-day reply aim",
  },
  {
    place: "Guide price",
    detail: "On each ride",
    action: "Enquire for firm",
    note: "No web checkout",
  },
];

export function StockTable() {
  return (
    <section id="stock" className="mx-auto max-w-[980px] px-7 pt-10 pb-[100px]">
      <div className="reveal mb-7 text-[10.5px] font-semibold tracking-[0.15em] text-teal uppercase">
        Where & how
      </div>
      <div className="reveal hidden grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b border-hair py-4 text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase max-[860px]:hidden md:grid">
        <span>Place</span>
        <span>Detail</span>
        <span>Action</span>
        <span>Note</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.place}
          className="reveal grid grid-cols-2 items-baseline gap-x-4 gap-y-2 border-t border-hair py-4 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:gap-4"
        >
          <span className="font-display col-span-2 text-[22px] font-bold tracking-[-0.02em] md:col-span-1">
            {r.place}
          </span>
          <span className="text-[13px] text-ink-2">{r.detail}</span>
          <span className="text-[13px] text-ink-2">{r.action}</span>
          <span className="text-[13px] text-ink-2">{r.note}</span>
        </div>
      ))}
    </section>
  );
}
