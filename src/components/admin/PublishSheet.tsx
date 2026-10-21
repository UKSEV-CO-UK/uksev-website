"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { AdminErrorCode, ConflictDetails, PublishProgress } from "@/lib/admin/api";
import { AIcon } from "./AIcon";
import { ACCESS_EXPIRED, CREDENTIAL_INVALID, shortSha } from "./Chrome";

export const REPO = "UKSEV-CO-UK/uksev-website";

export type RunState =
  | { phase: "running"; p: PublishProgress; retried: boolean; photos: number; blobTotal: number }
  | { phase: "done"; commitSha: string; viewHref?: string; blobTotal: number }
  | { phase: "error"; code: AdminErrorCode | "unknown" | "invalid"; details?: ConflictDetails; message?: string };

function Steps({ s }: { s: Extract<RunState, { phase: "running" | "done" }> }) {
  const active = s.phase === "done" ? 2 : s.p.stage === "blobs" ? 0 : s.p.stage === "done" ? 2 : 1;
  const blobs = s.phase === "running" && s.p.stage === "blobs" ? s.p : null;
  // Only photos go through /admin-api/blob; the .md travels inline with /publish, so it is never counted here.
  const photos = s.phase === "running" ? s.photos : s.blobTotal;
  const label0 = photos === 0 ? "Preparing changes" : "Uploading photos";
  const count0 =
    photos === 0
      ? active >= 1
        ? "No new photos"
        : ""
      : `${active >= 1 ? photos : Math.min(blobs?.done ?? 0, photos)}/${photos}`;
  const rows: [string, string][] = [
    [label0, count0],
    ["Committing", active >= 1 ? "1 commit" : ""],
    [active >= 2 ? "Published · live in ~1–2 min" : "Published", ""],
  ];
  return (
    <ul className="psteps">
      {rows.map(([n, r], i) => {
        const done = i < active || (active >= 2 && i === 2);
        const cls = done ? (i === 2 ? "done final" : "done") : i === active ? "act" : "";
        return (
          <li key={i} className={cls}>
            <span className="mk">{done ? <AIcon name="check" /> : i === active ? <span className="spin" /> : null}</span>
            <span>{n}</span>
            <span className="r">{r}</span>
            {i === 0 && blobs && photos > 0 && (
              <span className="pb">
                <i style={{ width: `${photos ? Math.round((Math.min(blobs.done, photos) / photos) * 100) : 0}%` }} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const when = (iso?: string) => {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 1 ? " just now" : m < 60 ? ` ${m} min ago` : "";
};

export function PublishSheet({
  state,
  onClose,
  onRetry,
  onLoadTheirs,
  onSaveMine,
  onSaveDraft,
  backHref = "/admin/",
}: {
  state: RunState | null;
  onClose: () => void;
  onRetry?: () => void;
  onLoadTheirs?: () => void;
  onSaveMine?: () => void;
  /** Keep the current edits as a draft on this device (edit page only). */
  onSaveDraft?: () => void;
  backHref?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state && state.phase !== "running") ref.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [state]);
  if (!state) return null;
  const closable = state.phase !== "running";
  let title = "";
  let sub = "";
  let inner: React.ReactNode = null;

  if (state.phase === "running") {
    const retrying = state.p.stage === "retry";
    title = "Publishing…";
    sub = state.p.stage === "commit" ? "Almost done." : "Keep this page open. It takes a few seconds.";
    inner = (
      <>
        <Steps s={state} />
        {(retrying || state.retried) && (
          <div className="callout amber">
            <span className="spin am" style={{ marginTop: 2 }} />
            <div>
              <b>Someone published just now</b>Rebuilding on the latest version… This happens automatically and your
              changes are kept.
            </div>
          </div>
        )}
      </>
    );
  } else if (state.phase === "done") {
    title = "Published";
    sub = "The site rebuilds now. Live in about 1–2 minutes.";
    inner = (
      <>
        <Steps s={state} />
        <div className="shabox">
          <span>
            Commit <code>{shortSha(state.commitSha)}</code>
          </span>
          <a href={`https://github.com/${REPO}/commit/${state.commitSha}`} target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </div>
        <div className="sbtns">
          {state.viewHref ? (
            <a className="btn solid" href={state.viewHref} target="_blank" rel="noopener noreferrer">
              View on site
            </a>
          ) : (
            <button className="btn solid" onClick={onClose}>
              Keep editing
            </button>
          )}
          <Link className="btn" href={backHref}>
            Back to list
          </Link>
        </div>
      </>
    );
  } else {
    // On the list page (no onSaveDraft) there is nothing to keep editing: only a status change failed.
    const onList = !onSaveDraft;
    const unchanged = "The status wasn’t changed.";
    const keep = (
      <button className="btn" onClick={onClose}>
        {onList ? "Close" : "Keep editing"}
      </button>
    );
    const c = state.code;
    if (c === "conflict") {
      title = "Not published";
      sub = "Nothing was overwritten.";
      inner = (
        <>
          <div className="callout amber">
            <AIcon name="alert" />
            <div>
              <b>
                This bike was changed{state.details?.by ? ` by @${state.details.by}` : " by someone else"}
                {when(state.details?.at)}
              </b>
              {onSaveMine
                ? "Their version is in the repo. Reload it, or keep your edits as a separate draft on this device."
                : "Their version is in the repo. Reload it, then change the status again if you still need to."}
            </div>
          </div>
          <div className="sbtns">
            <button className="btn pub one" onClick={onLoadTheirs}>
              Reload their version
            </button>
            {onSaveMine ? (
              <button className="btn one" onClick={onSaveMine}>
                Keep my edits as draft
              </button>
            ) : (
              <button className="btn one" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>
        </>
      );
    } else if (c === "retry_exhausted") {
      title = "Not published";
      sub = onList ? unchanged : "Your changes are kept on this page.";
      inner = (
        <>
          <div className="callout red">
            <AIcon name="alert" />
            <div>
              <b>Couldn’t publish</b>Others are publishing at the same time. Wait a moment, then try again.
            </div>
          </div>
          <div className="sbtns">
            <button className="btn pub" onClick={onRetry}>
              Retry
            </button>
            {keep}
          </div>
        </>
      );
    } else if (c === "offline") {
      title = "You’re offline";
      sub = "Nothing was published.";
      inner = (
        <>
          <div className="callout grey">
            <AIcon name="alert" />
            <div>
              <b>No internet connection</b>
              {onList
                ? `${unchanged} Try again when you’re back online.`
                : "Your changes and photos are kept on this page. Publish again when you’re back online, or save a draft on this device."}
            </div>
          </div>
          <div className="sbtns">
            <button className="btn pub" onClick={onRetry}>
              Retry
            </button>
            {keep}
          </div>
        </>
      );
    } else if (c === "access_expired") {
      title = "Not published";
      sub = "Nothing was published.";
      inner = (
        <>
          <div className="callout red">
            <AIcon name="lock" />
            <div>
              <b>{ACCESS_EXPIRED}</b>
              {onSaveDraft ? "Save a draft first if you want to keep your changes, then refresh." : unchanged}
            </div>
          </div>
          <div className="sbtns">
            <button className="btn pub" onClick={() => location.reload()}>
              Refresh
            </button>
            {onSaveDraft ? (
              <button className="btn" onClick={onSaveDraft}>
                Save draft
              </button>
            ) : (
              keep
            )}
          </div>
        </>
      );
    } else if (c === "credential_invalid") {
      title = "Can’t publish";
      sub = "Nothing was published.";
      inner = (
        <>
          <div className="callout red">
            <AIcon name="alert" />
            <div>
              <b>{CREDENTIAL_INVALID}</b>The Worker’s GitHub token is invalid or has expired.
              {onSaveDraft ? " You can still save a draft and publish once it’s replaced." : ` ${unchanged}`}
            </div>
          </div>
          <div className="sbtns">
            {onSaveDraft && (
              <button className="btn pub" onClick={onSaveDraft}>
                Save draft
              </button>
            )}
            {keep}
          </div>
        </>
      );
    } else if (c === "forbidden") {
      title = "Can’t publish";
      sub = "Nothing was published.";
      inner = (
        <>
          <div className="callout red">
            <AIcon name="alert" />
            <div>
              <b>The admin isn’t allowed to make this change</b>It can only write listings and their photos.
              {state.message && state.message !== "forbidden" ? ` (${state.message})` : ""}
            </div>
          </div>
          <div className="sbtns">{keep}</div>
        </>
      );
    } else {
      title = "Not published";
      sub = "Nothing was published.";
      inner = (
        <>
          <div className="callout red">
            <AIcon name="alert" />
            <div>
              <b>Something went wrong</b>
              {state.message || "Try again in a moment."}
            </div>
          </div>
          <div className="sbtns">
            {onRetry && (
              <button className="btn pub" onClick={onRetry}>
                Retry
              </button>
            )}
            {keep}
          </div>
        </>
      );
    }
  }

  return (
    <div className="scrim open" onClick={(e) => closable && e.target === e.currentTarget && onClose()}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <h3>{title}</h3>
        <p className="sub">{sub}</p>
        {inner}
      </div>
    </div>
  );
}
