/**
 * "Is my publish live yet?" GitHub Pages serves /build.json = { sha } written at build
 * (scripts/write-build-json.mjs). Pages caches for 10 min, so poll with a cache-buster
 * and no-store. Tokens never need Actions access.
 */
export type LastPublish = { sha: string; at: number; live?: boolean };
export type DeployState =
  | { kind: "idle"; siteSha?: string }
  | { kind: "deploying"; last: LastPublish }
  | { kind: "live"; last: LastPublish }
  | { kind: "failed"; last: LastPublish };

const KEY = "uksev-admin-lastpub";
export const POLL_MS = 15_000;
export const GIVE_UP_MS = 5 * 60_000;
/** After this long a live banner is no longer interesting. */
const FORGET_MS = 6 * 60 * 60_000;

export function readLastPublish(): LastPublish | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as LastPublish | null;
    if (v && Date.now() - v.at > FORGET_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function recordPublish(sha: string) {
  localStorage.setItem(KEY, JSON.stringify({ sha, at: Date.now() } satisfies LastPublish));
  window.dispatchEvent(new Event("uksev-admin-publish"));
}

export function markLive(last: LastPublish) {
  localStorage.setItem(KEY, JSON.stringify({ ...last, live: true }));
}

export async function fetchSiteSha(): Promise<string | null> {
  try {
    const r = await fetch(`/build.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { sha?: unknown };
    return typeof j.sha === "string" ? j.sha : null;
  } catch {
    return null;
  }
}

export function stateFor(last: LastPublish | null, siteSha: string | null, now = Date.now()): DeployState {
  if (!last) return { kind: "idle", siteSha: siteSha ?? undefined };
  if (last.live || (siteSha && siteSha === last.sha)) return { kind: "live", last };
  if (now - last.at > GIVE_UP_MS) return { kind: "failed", last };
  return { kind: "deploying", last };
}

export function ago(at: number, now = Date.now()) {
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}
