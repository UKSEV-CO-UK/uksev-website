import type { Metadata } from "next";
import { Icon } from "@/components/preowned/icons";
import { PreownedList } from "@/components/preowned/PreownedList";
import { getListed } from "@/lib/preowned";
import { PREOWNED_COPY } from "@/lib/preowned-copy";
import { whatsappHref } from "@/lib/preowned-links";
import type { PreownedSummary } from "@/lib/preowned-types";

export const metadata: Metadata = {
  title: "Pre-owned e-bikes",
  description:
    "Pre-owned electric bikes inspected and battery-tested by UKSEV. Guide prices, honest grades.",
};

export default async function PreownedPage() {
  const bikes: PreownedSummary[] = (await getListed()).map(
    ({ descriptionHtml: _d, inspection: _i, included: _n, ...rest }) => {
      void _d;
      void _i;
      void _n;
      return rest;
    },
  );
  const forSale = bikes.filter((b) => b.status !== "sold").length;

  return (
    <main className="wrap">
      <section className="intro">
        <div>
          <div className="eyebrow">
            Pre-owned · {forSale} bike{forSale === 1 ? "" : "s"} in stock
          </div>
          <h1 className="d">
            Pre-owned, inspected in <em>Oxfordshire.</em>
          </h1>
          <p>{PREOWNED_COPY.intro}</p>
        </div>
        <ul className="proof">
          {PREOWNED_COPY.proof.map((p) => (
            <li key={p.label}>
              <small>{p.label}</small>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {bikes.length ? (
        <PreownedList bikes={bikes} />
      ) : (
        <p className="empty" style={{ borderTop: "1px solid var(--hair)", marginBottom: 40 }}>
          No pre-owned bikes listed right now. New arrivals land most weeks —{" "}
          <a
            href={whatsappHref("Hi, please let me know when new pre-owned bikes come in.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            get notified on WhatsApp
          </a>
          .
        </p>
      )}

      <section className="sell">
        <div>
          <h2>{PREOWNED_COPY.sell.title}</h2>
          <p>{PREOWNED_COPY.sell.text}</p>
        </div>
        <a
          className="btn"
          href={whatsappHref("Hi, I'd like a guide figure for my e-bike. Photos and mileage attached.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="chat" />
          WhatsApp photos
        </a>
      </section>
    </main>
  );
}
