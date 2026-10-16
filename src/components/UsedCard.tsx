import Link from "next/link";
import {
  STATUS_LABEL,
  formatGBP,
  formatMiles,
  type UsedBikeSummary,
} from "@/lib/used-types";

const statusCls: Record<UsedBikeSummary["status"], string> = {
  available: "border-teal text-teal",
  reserved: "border-amber text-amber",
  sold: "border-muted text-muted",
};

export function UsedStatusBadge({ status }: { status: UsedBikeSummary["status"] }) {
  return (
    <span
      className={`border-b pb-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${statusCls[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function UsedCard({ bike }: { bike: UsedBikeSummary }) {
  const b = bike;
  const sold = b.status === "sold";
  const cover = b.photos[0];
  return (
    <Link
      href={`/used/${b.slug}/`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-hair bg-ground-2 transition-colors hover:border-[rgba(232,145,60,0.45)] ${
        sold ? "opacity-55 grayscale" : ""
      }`}
    >
      <div
        className="relative aspect-[4/3] bg-[#15181c] bg-cover bg-center"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        <span className="absolute top-3 left-3 rounded-sm bg-[rgba(10,12,14,0.6)] px-1.5 pt-1">
          <UsedStatusBadge status={b.status} />
        </span>
        {b.draft && (
          <span className="absolute top-3 right-3 rounded-sm bg-amber px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#0A0C0E] uppercase">
            Draft
          </span>
        )}
        {!cover && (
          <span className="absolute inset-0 grid place-items-center text-[10.5px] tracking-[0.14em] text-muted uppercase">
            Photo soon
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-[18px]">
        <div className="text-[10px] font-semibold tracking-[0.14em] break-words text-amber uppercase">
          {b.brand} · {b.year}
        </div>
        <h3 className="font-display text-xl font-bold tracking-[-0.02em] break-words">
          {b.title}
        </h3>
        <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-xs leading-[1.45] text-ink-2">
          <span>{formatMiles(b.mileage)}</span>
          <span aria-hidden>·</span>
          <span>{b.condition}</span>
          {b.batteryHealth != null && (
            <>
              <span aria-hidden>·</span>
              <span>Battery {b.batteryHealth}%</span>
            </>
          )}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span
            className={`font-display text-lg font-bold tracking-[-0.02em] ${sold ? "line-through" : ""}`}
          >
            {formatGBP(b.price)}
          </span>
          <span className="text-[10.5px] tracking-[0.14em] text-ink-2 uppercase transition-colors group-hover:text-amber">
            {sold ? "Sold" : "View →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
