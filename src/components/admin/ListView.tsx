"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { assetUrl, errorCode, loadAll, type RepoBike } from "@/lib/admin/api";
import { listDrafts, type LocalDraft } from "@/lib/admin/drafts";
import { mdPath, withStatus } from "@/lib/admin/form";
import { toMarkdown } from "@/lib/admin/serialize";
import { normaliseBike, validateBike } from "@/lib/preowned-schema";
import { STATUS_LABEL, STATUSES, money, shortDate, type Status } from "@/lib/preowned-types";
import { AIcon } from "./AIcon";
import { AccessExpired, DeployBanner, StatusNotice, TopBar, shortSha, useToast } from "./Chrome";
import { PublishSheet } from "./PublishSheet";
import { usePublish } from "./usePublish";
import { draftSummary } from "./draftSummary";

type Tab = "all" | Status | "draft";
type RowState = { kind: "pubing" } | { kind: "saved"; sha: string; sold: boolean } | null;

const plus30 = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return shortDate(d.toISOString().slice(0, 10));
};
const updated = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return `Today ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function ListView() {
  const [cars, setCars] = useState<RepoBike[] | null>(null);
  const [headSha, setHeadSha] = useState("");
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accessGone, setAccessGone] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [toast, say] = useToast();
  const pub = usePublish();
  const [pending, setPending] = useState<{ slug: string; status: Status } | null>(null);

  const reload = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await loadAll();
      setCars(r.cars);
      setHeadSha(r.headSha);
    } catch (e) {
      const c = errorCode(e);
      if (c === "access_expired") setAccessGone(true);
      else
        setLoadErr(
          c === "offline"
            ? "You’re offline. Connect and reload."
            : c === "credential_invalid"
              ? "后台写入凭证失效，请联系管理员"
              : (e as Error)?.message || "Couldn’t load listings.",
        );
    }
    listDrafts()
      .then((d) => setDrafts(d.sort((a, b) => b.savedAt.localeCompare(a.savedAt))))
      .catch(() => setDrafts([]));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    reload();
  }, [reload]);

  const items = useMemo(
    () =>
      (cars ?? [])
        .map((c) => ({ car: c, b: normaliseBike(c.data).bike }))
        .sort((x, y) => {
          const s = (x.b.status === "sold" ? 1 : 0) - (y.b.status === "sold" ? 1 : 0);
          return s || (y.car.updatedAt ?? y.b.date ?? "").localeCompare(x.car.updatedAt ?? x.b.date ?? "");
        }),
    [cars],
  );
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: items.length + drafts.length, available: 0, reserved: 0, sold: 0, draft: drafts.length };
    for (const i of items) c[i.b.status]++;
    return c;
  }, [items, drafts]);
  const onSite = items.filter((i) => i.b.status !== "sold" && !i.b.draft).length;
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());

  const setStatus = async (car: RepoBike, status: Status) => {
    const data = withStatus(car.data, status);
    const v = validateBike(data);
    if (!v.ok) {
      say(`Fix this listing first: ${v.errors[0].message}`);
      return;
    }
    setRows((r) => ({ ...r, [car.slug]: { kind: "pubing" } }));
    setPending({ slug: car.slug, status });
    const name = `${data.brand} ${data.model}`;
    const sha = await pub.run(
      [{ path: mdPath(car.slug), content: toMarkdown(data, car.body) }],
      `pre-owned: ${name} → ${STATUS_LABEL[status].toLowerCase()}`,
      headSha,
    );
    if (sha) {
      pub.setState(null); // list uses the row state, not the sheet, for success
      setCars((cs) => cs!.map((c) => (c.slug === car.slug ? { ...c, data, updatedAt: new Date().toISOString() } : c)));
      setHeadSha(sha);
      setRows((r) => ({ ...r, [car.slug]: { kind: "saved", sha, sold: status === "sold" } }));
      say(`${name} → ${STATUS_LABEL[status]}`);
    } else {
      setRows((r) => ({ ...r, [car.slug]: null }));
    }
  };

  const visible = (s: Tab) => tab === "all" || tab === s;

  return (
    <div className="adm pg-list">
      <TopBar
        right={
          <>
            <a className="iconbtn" href="/pre-owned/" target="_blank" rel="noopener noreferrer" aria-label="View site">
              <AIcon name="ext" />
            </a>
          </>
        }
      />
      <DeployBanner />
      <StatusNotice />
      <main className="wrap">
        <div className="hd">
          <div>
            <h1>Pre-owned</h1>
            <p>
              {onSite} on the site · {drafts.length} draft{drafts.length === 1 ? "" : "s"} on this device · e-bikes and
              e-scooters
            </p>
          </div>
          <a className="btn live" href="/pre-owned/" target="_blank" rel="noopener noreferrer">
            <AIcon name="ext" />
            View live page
          </a>
        </div>
        <div className="tools">
          <label className="search">
            <AIcon name="search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand or model" aria-label="Search brand or model" />
          </label>
          <div className="tabs" role="tablist">
            {(["all", ...STATUSES, "draft"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === "all" ? "All" : t === "draft" ? "Draft" : STATUS_LABEL[t]}
                <span>{counts[t]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="note">Changing a status publishes straight away. The site updates in about 1–2 minutes.</p>
        <div className="thead">
          <span />
          <span>Listing</span>
          <span>Guide</span>
          <span>Status</span>
          <span>Updated</span>
          <span />
        </div>
        {accessGone && <AccessExpired style={{ marginTop: 14 }} />}
        {loadErr && (
          <div className="callout red" style={{ marginTop: 14 }}>
            <AIcon name="alert" />
            <div>
              <b>{loadErr}</b>
              <button className="linkbtn" onClick={reload}>
                Try again
              </button>
            </div>
          </div>
        )}
        {!cars && !loadErr && !accessGone && (
          <p className="note">
            <span className="spin" style={{ verticalAlign: -3, marginRight: 8 }} />
            Loading listings…
          </p>
        )}
        <div className="list">
          {visible("draft") &&
            drafts
              .filter((d) => match(`${d.form.brand} ${d.form.model}`))
              .map((d) => {
                const s = draftSummary(d);
                return (
                  <div className="row draft" key={d.id}>
                    <div className="thumb">
                      {s.cover ? (
                        <div className="ph">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.cover} alt="" />
                          <em>
                            <AIcon name="cam" />
                            {d.photos.length}
                          </em>
                        </div>
                      ) : (
                        <div className="nophoto">
                          <AIcon name="cam" />
                        </div>
                      )}
                    </div>
                    <div className="info">
                      <h3>{s.name || "Untitled listing"}</h3>
                      <div className="m">
                        Draft · {d.slug ? "unpublished changes" : "not on the site"}
                        {d.origin === "conflict" ? " · saved from a conflict" : ""}
                      </div>
                      <div className="p" style={s.price ? undefined : { color: "var(--muted)", fontSize: 14, fontFamily: "var(--font-sora)" }}>
                        {s.price ?? "No price yet"}
                      </div>
                    </div>
                    <div className="pp" style={{ display: "none" }}>
                      {s.price ?? "—"}
                    </div>
                    <div className={s.missing ? "miss" : "miss ok"}>
                      <span>
                        <AIcon name={s.missing ? "alert" : "check"} />
                        {s.missing ?? "Ready to publish"}
                      </span>
                      <Link href={`/admin/edit/?draft=${encodeURIComponent(d.id)}`}>Finish</Link>
                    </div>
                    <div className="upd">{updated(d.savedAt)}</div>
                    <Link className="edit" href={`/admin/edit/?draft=${encodeURIComponent(d.id)}`} aria-label="Edit draft">
                      <AIcon name="edit" />
                    </Link>
                  </div>
                );
              })}
          {items
            .filter(({ b }) => visible(b.status) && match(`${b.brand} ${b.model}`))
            .map(({ car, b }) => {
              const rs = rows[car.slug];
              const locked = rs?.kind === "pubing";
              const cover = b.photos[0]?.src;
              const batt =
                b.batteryHealth != null ? `${b.batteryHealth}%` : b.chargeCycles != null ? `${b.chargeCycles} cycles` : "no battery reading";
              return (
                <div className={`row ${b.status}`} key={car.slug}>
                  <div className="thumb">
                    <div className="ph">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover && <img src={assetUrl(cover)} alt="" loading="lazy" />}
                    </div>
                    <em>
                      <AIcon name="cam" />
                      {b.photos.length}
                    </em>
                  </div>
                  <div className="info">
                    <h3>
                      {b.brand} {b.model}
                    </h3>
                    <div className="m">
                      {b.type === "e-scooter" ? "E-scooter · " : ""}
                      {b.year} · {b.mileage?.toLocaleString("en-GB")} mi · {batt}
                    </div>
                    <div className="p">{b.price != null ? money(b.price) : "—"}</div>
                  </div>
                  <div className="pp" style={{ display: "none" }}>
                    {b.price != null ? money(b.price) : "—"}
                  </div>
                  <div className="stc">
                    <div className="seg" role="group" aria-label="Status" style={locked ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
                      {STATUSES.map((v) => (
                        <button
                          key={v}
                          data-v={v}
                          aria-pressed={b.status === v}
                          disabled={locked}
                          onClick={() => b.status !== v && setStatus(car, v)}
                        >
                          <i />
                          {STATUS_LABEL[v]}
                        </button>
                      ))}
                    </div>
                    {rs?.kind === "pubing" ? (
                      <div className="rowstate pubing">
                        <span className="spin" />
                        Publishing…
                      </div>
                    ) : rs?.kind === "saved" ? (
                      <div className="rowstate live">
                        <AIcon name="check" />
                        Saved <code>{shortSha(rs.sha)}</code> · live in ~1–2 min{rs.sold ? " · price hidden" : ""}
                      </div>
                    ) : b.draft ? (
                      <div className="rowstate">Example draft · hidden on the site</div>
                    ) : b.status === "sold" && (b.soldDate ?? b.date) ? (
                      <div className="rowstate">Price hidden · leaves the site {plus30((b.soldDate ?? b.date)!)}</div>
                    ) : b.batteryHealth == null && b.chargeCycles == null ? (
                      <div className="rowstate" style={{ color: "#d9a36b" }}>
                        <AIcon name="alert" />
                        Battery reading recommended
                      </div>
                    ) : (
                      <div className="rowstate" />
                    )}
                  </div>
                  <div className="upd">{updated(car.updatedAt ?? b.date)}</div>
                  <Link className="edit" href={`/admin/edit/?slug=${encodeURIComponent(car.slug)}`} aria-label={`Edit ${b.brand} ${b.model}`}>
                    <AIcon name="edit" />
                  </Link>
                </div>
              );
            })}
          {cars && items.length + drafts.length === 0 && <p className="note">No listings yet. Tap “Add listing” to create the first one.</p>}
        </div>
      </main>
      <Link className="fab" href="/admin/edit/">
        <b>+</b>Add listing
      </Link>
      {toast}
      <PublishSheet
        state={pub.state?.phase === "error" ? pub.state : null}
        onClose={() => pub.setState(null)}
        onRetry={() => {
          const p = pending;
          pub.setState(null);
          const car = p && cars?.find((c) => c.slug === p.slug);
          if (car && p) setStatus(car, p.status);
        }}
        onLoadTheirs={() => {
          pub.setState(null);
          reload();
        }}
      />
    </div>
  );
}
