"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ago, fetchSiteSha, markLive, POLL_MS, readLastPublish, stateFor, type DeployState } from "@/lib/admin/deploy";
import { daysLeft, useWorkerStatus } from "./useWorkerStatus";
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

export const ACCESS_EXPIRED = "Session expired · Refresh to sign in again";
export const CREDENTIAL_INVALID = "Publishing credential invalid · Contact your admin.";

/** Cloudflare Access session gone: the only fix is a reload, which goes through Access again. */
export function AccessExpired({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="callout red access" role="alert" style={style}>
      <AIcon name="lock" />
      <div>
        <b>{ACCESS_EXPIRED}</b>
        Drafts on this device are kept.
        <button className="btn pub refresh" onClick={() => location.reload()}>
          Refresh
        </button>
      </div>
    </div>
  );
}

/**
 * Strip under the top bar from GET /admin-api/status:
 *  - red when the Worker's GitHub token can't write
 *  - amber when it expires within 7 days
 */
export function StatusNotice() {
  const st = useWorkerStatus();
  if (st.k === "error" && st.code === "credential_invalid") return <CredStrip />;
  if (st.k !== "ok") return null;
  if (!st.s.canWrite) return <CredStrip />;
  const d = daysLeft(st.s.expiresAt);
  if (d == null || d > 7) return null;
  if (d < 0) return <CredStrip />;
  return (
    <div className="expiry" role="status">
      <AIcon name="alert" />
      <span>
        <b>Publishing credential expires {d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`} ({shortDate(st.s.expiresAt!)})</b>. Ask your admin to replace it before then.
      </span>
    </div>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

function CredStrip() {
  return (
    <div className="expiry bad" role="alert">
      <AIcon name="alert" />
      <span>
        <b>{CREDENTIAL_INVALID}</b> You can still save a draft.
      </span>
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
