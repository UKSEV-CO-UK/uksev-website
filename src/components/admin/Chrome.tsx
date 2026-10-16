"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ago, fetchSiteSha, markLive, POLL_MS, readLastPublish, stateFor, type DeployState } from "@/lib/admin/deploy";
import { daysLeft, type StoredToken } from "@/lib/admin/token";
import { AIcon } from "./AIcon";

export function TopBar({ right, back }: { right?: React.ReactNode; back?: boolean }) {
  return (
    <header className="top">
      <div className="brand">
        {back && (
          <Link className="back" href="/admin/">
            <AIcon name="left" />
            Listings
          </Link>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-b-light.svg" alt="UKSEV" />
        <span>Pre-owned admin</span>
      </div>
      <div className="r">{right}</div>
    </header>
  );
}

export function AccountButton() {
  return (
    <Link className="iconbtn" href="/admin/?view=account" aria-label="Account and token">
      <AIcon name="key" />
    </Link>
  );
}

export const shortSha = (s: string) => s.slice(0, 7);

/** Deploying… / Live / may have failed, from /build.json vs the last publish on this device. */
export function DeployBanner() {
  const [st, setSt] = useState<DeployState | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const last = readLastPublish();
      const site = await fetchSiteSha();
      if (stop) return;
      const s = stateFor(last, site);
      if (s.kind === "live" && last && !last.live) markLive(last);
      setSt(s);
      if (s.kind === "deploying") timer = setTimeout(run, POLL_MS);
    };
    run();
    const onPub = () => {
      clearTimeout(timer);
      run();
    };
    window.addEventListener("uksev-admin-publish", onPub);
    const clock = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(clock);
      window.removeEventListener("uksev-admin-publish", onPub);
    };
  }, []);
  if (!st) return null;
  if (st.kind === "idle")
    return st.siteSha ? (
      <div className="pubbar live">
        <span className="dot" />
        <span className="txt">
          <b>Live</b> · site build <span className="sha">{shortSha(st.siteSha)}</span>
        </span>
      </div>
    ) : null;
  const sha = <span className="sha">{shortSha(st.last.sha)}</span>;
  if (st.kind === "deploying")
    return (
      <div className="pubbar deploying" role="status">
        <span className="dot" />
        <span className="txt">
          <b>Deploying…</b> Last publish {ago(st.last.at)} · {sha} · ~1–2 min
        </span>
      </div>
    );
  if (st.kind === "live")
    return (
      <div className="pubbar live" role="status">
        <span className="dot" />
        <span className="txt">
          <b>Live</b> · Last publish {ago(st.last.at)} · {sha}
        </span>
      </div>
    );
  return (
    <div className="pubbar failed" role="status">
      <span className="dot" />
      <span className="txt">
        <b>Deployment may have failed.</b> Not live after 5 min. The listing is saved in the repo; the previous version of
        the site is still up. · {sha}
      </span>
      <a className="more" href="https://github.com/UKSEV-CO-UK/uksev-website/actions" target="_blank" rel="noopener noreferrer">
        Open log
      </a>
    </div>
  );
}

/** Amber strip when the token expires within 7 days (or already has). */
export function ExpiryNotice({ auth }: { auth: StoredToken | null | undefined }) {
  const d = daysLeft(auth?.expiresAt);
  if (d == null || d > 7) return null;
  return (
    <div className="expiry">
      <AIcon name="alert" />
      <span>
        {d < 0 ? (
          <b>Your GitHub token has expired.</b>
        ) : (
          <>
            <b>Your GitHub token expires {d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}</b> ({auth!.expiresAt!.slice(0, 10)}).
          </>
        )}{" "}
        Create a new one and replace it.
      </span>
      <Link href="/admin/?view=account">Replace</Link>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const el = (
    <div className={`toast${msg ? " show" : ""}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
  return [el, setMsg] as const;
}
