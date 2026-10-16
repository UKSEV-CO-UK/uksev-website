import Link from "next/link";
import { enquireHref, similarHref, whatsappBike, whatsappHref } from "@/lib/preowned-links";
import {
  GRADE_WORD,
  STATUS_LABEL,
  bikeName,
  money,
  monthYear,
  type PreownedSummary,
} from "@/lib/preowned-types";
import { PREOWNED_COPY } from "@/lib/preowned-copy";
import { Icon } from "./icons";

export function SoldStamp({ date }: { date?: string }) {
  return (
    <div className="stamp" aria-hidden="true">
      <b>SOLD</b>
      {date && <span>{monthYear(date)}</span>}
    </div>
  );
}

export function PreownedCard({ bike: b }: { bike: PreownedSummary }) {
  const sold = b.status === "sold";
  const href = `/pre-owned/${b.slug}/`;
  const cover = b.photos[0];
  return (
    <article className={`card ${b.status}`}>
      <Link href={href} className="ph" aria-label={bikeName(b)}>
        {/* plain img: static export, unoptimized images */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.src} alt="" loading="lazy" />
        <span className={`status ${b.status}`}>
          <i />
          {STATUS_LABEL[b.status]}
        </span>
        {b.draft && <span className="draftflag">DRAFT</span>}
        <span className="count">
          <Icon name="cam" />
          {b.photos.length}
        </span>
        {sold && <SoldStamp date={b.soldDate} />}
      </Link>
      <div className="body">
        <div className="eyebrow meta">
          {b.brand} · {b.year}
        </div>
        <h3>
          <Link href={href}>{b.model}</Link>
        </h3>
        <div className="specs">
          <div>
            <b>{b.mileage.toLocaleString("en-GB")} mi</b>
            <span>Mileage</span>
          </div>
          <div>
            <b>{b.batteryHealth != null ? `${b.batteryHealth}%` : "—"}</b>
            <span>Battery health</span>
            {b.batteryHealth != null && (
              <span className="batt">
                <i style={{ width: `${b.batteryHealth}%` }} />
              </span>
            )}
          </div>
          <div className="g">
            <b>{b.grade ?? "—"}</b>
            <span>{b.grade ? `Grade · ${GRADE_WORD[b.grade].toLowerCase()}` : "Grade"}</span>
          </div>
        </div>
        {sold ? (
          <>
            <p className="soldnote">{PREOWNED_COPY.soldNote}</p>
            <div className="actions">
              {/* full load so the list picks up ?brand= even from the list page */}
              <a className="btn" href={similarHref(b.brand)}>
                Find similar
              </a>
              <a
                className="btn"
                href={whatsappHref(`Hi, please let me know when a pre-owned ${b.brand} comes in.`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Notify me
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="price">
              <div>
                <small>Guide price</small>
                <strong>{money(b.price)}</strong>
              </div>
              <div className="new">
                {b.newPrice != null && b.newPrice > b.price && (
                  <>
                    New <s>{money(b.newPrice)}</s>
                    <br />
                  </>
                )}
                {PREOWNED_COPY.cardDelivery}
              </div>
            </div>
            <div className="actions">
              <a className="btn solid" href={enquireHref(b)}>
                Enquire
              </a>
              <a className="btn" href={whatsappBike(b)} target="_blank" rel="noopener noreferrer">
                <Icon name="chat" />
                WhatsApp
              </a>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
