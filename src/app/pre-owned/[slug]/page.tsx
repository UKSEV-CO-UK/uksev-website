import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/preowned/Gallery";
import { Icon } from "@/components/preowned/icons";
import { SoldStamp } from "@/components/preowned/PreownedCard";
import { getAll, getBySlug, getListed } from "@/lib/preowned";
import { PREOWNED_COPY } from "@/lib/preowned-copy";
import { enquireHref, similarHref, whatsappBike, whatsappHref } from "@/lib/preowned-links";
import {
  GRADE_NOTE,
  GRADE_WORD,
  TYPE_LABEL,
  bikeName,
  money,
  shortDate,
  type InspectionResult,
} from "@/lib/preowned-types";
import { SITE } from "@/lib/site";

/** Static export needs ≥ 1 param; with no published bikes we emit one 404 placeholder. */
const PLACEHOLDER = "none";
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = (await getAll()).map((b) => ({ slug: b.slug }));
  return slugs.length ? slugs : [{ slug: PLACEHOLDER }];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bike = await getBySlug((await params).slug);
  if (!bike) return { title: "Not found", robots: { index: false } };
  const sold = bike.status === "sold";
  return {
    title: `${bikeName(bike)} (pre-owned${sold ? ", sold" : ""})`,
    description: `Pre-owned ${bikeName(bike)}, ${bike.year}, ${bike.mileage.toLocaleString("en-GB")} miles${
      bike.batteryHealth != null ? `, ${bike.batteryHealth}% battery health` : ""
    }${sold ? " — sold." : ` — guide ${money(bike.price)} at UKSEV.`}`,
    ...(bike.draft ? { robots: { index: false } } : {}),
  };
}

const TAG: Record<InspectionResult, string> = { pass: "Pass", replaced: "Replaced", note: "Note" };

export default async function PreownedBikePage({ params }: Props) {
  const bike = await getBySlug((await params).slug);
  if (!bike) notFound();
  const b = bike;
  const sold = b.status === "sold";
  const name = bikeName(b);

  const statusLine =
    b.status === "available"
      ? `Available now${b.date ? ` · listed ${shortDate(b.date)}` : ""}`
      : b.status === "reserved"
        ? "Reserved · ask to join the waiting list"
        : `Sold${b.soldDate ? ` · ${shortDate(b.soldDate)}` : ""}`;

  const specs: [string, string | undefined][] = [
    ["Motor", b.motorW != null ? `${b.motorW}W` : undefined],
    ["Battery", b.batteryWh != null ? `${b.batteryWh}Wh` : undefined],
    ["Charge cycles", b.chargeCycles != null ? b.chargeCycles.toLocaleString("en-GB") : undefined],
    ["Battery reading", b.batterySource],
    ["Claimed range", b.range != null ? `Up to ${b.range} mi` : undefined],
    ["Wheels", b.wheelSize],
    ["Frame size", b.frameSize],
    ["Colour", b.colour],
    ["Service history", b.serviceHistory],
  ];
  const tally = (["pass", "replaced", "note"] as const)
    .map((r) => [r, b.inspection.filter((x) => x.result === r).length] as const)
    .filter(([, n]) => n > 0);

  const similar = (await getListed())
    .filter((x) => x.slug !== b.slug && x.status !== "sold")
    .sort((x, y) => (x.brand === b.brand ? 0 : 1) - (y.brand === b.brand ? 0 : 1))
    .slice(0, 4);

  return (
    <>
      <div className="crumb">
        <Link href="/pre-owned/">Pre-owned</Link>
        <span>/</span>
        {name}
      </div>
      <main className="pd">
        <Gallery photos={b.photos} alt={name} sold={sold}>
          {sold && <SoldStamp date={b.soldDate} />}
        </Gallery>

        <aside className="buy">
          {b.draft && (
            <p className="eyebrow" style={{ color: "var(--ground)", background: "var(--amber)", display: "inline-block", padding: "3px 8px", borderRadius: 4, marginBottom: 10 }}>
              Draft — hidden on the live site
            </p>
          )}
          <div className="eyebrow">
            {TYPE_LABEL[b.type]} · {b.brand} · {b.year}
          </div>
          <h1>{b.model}</h1>
          <div className={`st ${b.status}`}>
            <i />
            {statusLine}
          </div>

          {sold ? (
            <div className="pricebox soldbox">
              <p>
                This bike has been sold. {PREOWNED_COPY.soldNote} Tell us what you&apos;re after and
                we&apos;ll message you when one lands.
              </p>
            </div>
          ) : (
            <div className="pricebox">
              <div>
                <small>Guide price</small>
                <strong>{money(b.price)}</strong>
              </div>
              {b.newPrice != null && b.newPrice > b.price && (
                <div className="new">
                  New <s>{money(b.newPrice)}</s>
                  <b>{money(b.newPrice - b.price)} under new</b>
                </div>
              )}
            </div>
          )}

          <div className="view">
            <Icon name="pin" />
            <div>
              <b>{PREOWNED_COPY.viewing.title}</b>
              {PREOWNED_COPY.viewing.text}
            </div>
          </div>

          <div className="dcta">
            {sold ? (
              <a className="btn solid" href={similarHref(b.brand)}>
                <Icon name="search" />
                Find similar {b.brand} bikes
              </a>
            ) : (
              <a className="btn solid" href={enquireHref(b)}>
                <Icon name="mail" />
                Enquire about this bike
              </a>
            )}
            <a className="btn" href={sold ? whatsappHref(`Hi, I'm looking for a pre-owned ${b.brand}.`) : whatsappBike(b)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" />
              WhatsApp
            </a>
            <a className="btn" href={SITE.phoneHref}>
              <Icon name="phone" />
              Call
            </a>
          </div>

          <div className="strip">
            <div>
              <b>{b.year}</b>
              <span>Year</span>
            </div>
            <div>
              <b>{b.mileage.toLocaleString("en-GB")}</b>
              <span>Miles</span>
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
            <div>
              <b>{b.grade ?? "—"}</b>
              <span>Grade</span>
            </div>
          </div>
          {b.grade && (
            <p className="gradenote">
              <b>
                Grade {b.grade}, {GRADE_WORD[b.grade].toLowerCase()}:
              </b>{" "}
              {GRADE_NOTE[b.grade]}
            </p>
          )}
        </aside>

        <div className="c">
          {b.inspection.length > 0 && (
            <section className="sec">
              <h2>
                Inspection notes <small>{PREOWNED_COPY.inspectionLabel}</small>
              </h2>
              <div className="tally">
                {tally.map(([r, n]) => (
                  <span key={r} className={`tag ${r}`}>
                    {n} {TAG[r]}
                  </span>
                ))}
              </div>
              <ul className="notes">
                {b.inspection.map((x, k) => (
                  <li key={x.item + k}>
                    <span className={`tag ${x.result}`}>{TAG[x.result]}</span>
                    <div>
                      <b>{x.item}</b>
                      {x.text && <p>{x.text}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {b.included.length > 0 && (
            <section className="sec">
              <h2>What&apos;s included</h2>
              <ul className="inc">
                {b.included.map((x, k) => (
                  <li key={x.item + k} className={x.included ? "" : "no"}>
                    <Icon name={x.included ? "check" : "x"} />
                    <div>
                      {x.item}
                      {(x.text || !x.included) && <small>{x.text ?? "Not included"}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sec">
            <h2>About this bike</h2>
            {b.descriptionHtml && (
              <div className="desc" dangerouslySetInnerHTML={{ __html: b.descriptionHtml }} />
            )}
            <dl className="tbl">
              {specs
                .filter((s): s is [string, string] => !!s[1])
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="sec">
            <h2>How buying works</h2>
            <ol className="steps">
              {PREOWNED_COPY.howBuying.map((s) => (
                <li key={s.title}>
                  <div>
                    <b>{s.title}</b>
                    {s.text}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {similar.length > 0 && (
          <section className="sim">
            <div className="hd">
              <h2>Similar bikes</h2>
              <Link href="/pre-owned/">See all pre-owned</Link>
            </div>
            <div className="row">
              {similar.map((x) => (
                <Link className="mini" key={x.slug} href={`/pre-owned/${x.slug}/`}>
                  <div className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.photos[0].src} alt="" loading="lazy" />
                  </div>
                  <div className="b">
                    <div className="eyebrow">
                      {x.brand} · {x.year}
                    </div>
                    <h3>{x.model}</h3>
                    <p>
                      {x.mileage.toLocaleString("en-GB")} mi
                      {x.batteryHealth != null && ` · ${x.batteryHealth}% battery`}
                      {x.grade && ` · Grade ${x.grade}`}
                    </p>
                    <strong>{money(x.price)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="ctabar">
        <a className="btn call" href={SITE.phoneHref} aria-label={`Call ${SITE.phoneDisplay}`}>
          <Icon name="phone" />
        </a>
        <a className="btn" href={sold ? whatsappHref(`Hi, I'm looking for a pre-owned ${b.brand}.`) : whatsappBike(b)} target="_blank" rel="noopener noreferrer">
          <Icon name="chat" />
          WhatsApp
        </a>
        {sold ? (
          <a className="btn solid" href={similarHref(b.brand)}>
            Find similar
          </a>
        ) : (
          <a className="btn solid" href={enquireHref(b)}>
            Enquire · {money(b.price)}
          </a>
        )}
      </div>
    </>
  );
}
