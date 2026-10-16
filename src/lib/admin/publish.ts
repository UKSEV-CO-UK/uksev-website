/**
 * Real AdminApi: talks to the GitHub REST API from the browser with a fine-grained token.
 * One publish = one commit on main (Git Data API: blobs → tree → commit → fast-forward ref).
 * Never force-pushes. If main moved, re-checks our paths since baseSha and rebuilds on the new head.
 */
import { fromMarkdown } from "./serialize";
import {
  AdminApiError,
  type LoadAllResult,
  type PublishFile,
  type PublishOptions,
  type RepoBike,
  type VerifyResult,
} from "./types";

export const OWNER = "UKSEV-CO-UK";
export const REPO = "uksev-website";
export const BRANCH = "main";
export const MAX_RETRIES = 3;
const API = "https://api.github.com";
const R = `/repos/${OWNER}/${REPO}`;

/** Only these paths may be written, so a bug in the page can never touch workflows or code. */
const WRITABLE = [/^content\/pre-owned\/[A-Za-z0-9][A-Za-z0-9_-]*\.md$/, /^public\/uploads\/pre-owned\/[A-Za-z0-9][A-Za-z0-9._-]*$/];
export const isWritable = (p: string) => WRITABLE.some((re) => re.test(p));

let token: string | null = null;
/** Commit the last loadAll/publish saw; assetUrl pins raw URLs to it (works before Pages redeploys). */
let pinnedSha: string | null = null;
const localBlobs = new Map<string, string>();

export function setToken(t: string | null) {
  token = t?.trim() || null;
}

// ---------- HTTP ----------

type Init = { method?: string; body?: unknown; auth?: string };

async function gh<T>(path: string, { method = "GET", body, auth }: Init = {}): Promise<{ data: T; res: Response }> {
  const t = auth ?? token;
  if (!t) throw new AdminApiError("unauthorized", "Not signed in");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new AdminApiError("offline");
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${t}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new AdminApiError("offline", (e as Error)?.message);
  }
  if (res.ok) return { data: (res.status === 204 ? null : await res.json()) as T, res };
  const msg = await res.text().catch(() => "");
  if (res.status === 401) throw new AdminApiError("unauthorized", msg);
  if (res.status === 403 || res.status === 404) throw new AdminApiError("forbidden", msg);
  throw Object.assign(new Error(`GitHub ${res.status}: ${msg}`), { status: res.status });
}

const isMoved = (e: unknown) => [409, 422].includes((e as { status?: number })?.status ?? 0);

/** Runs fn over items with at most `n` in flight; keeps order. */
async function pool<I, O>(items: I[], n: number, fn: (x: I, i: number) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// ---------- encoding ----------

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const base64ToUtf8 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function toBase64(content: string | Blob): Promise<string> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(await content.arrayBuffer());
  return bytesToBase64(bytes);
}

// ---------- reads ----------

type Ref = { object: { sha: string } };
type Commit = { tree: { sha: string } };
type TreeEntry = { path: string; type: string; sha: string };

async function headSha(): Promise<string> {
  const { data } = await gh<Ref>(`${R}/git/ref/heads/${BRANCH}`);
  return data.object.sha;
}

export async function verifyToken(t: string): Promise<VerifyResult> {
  const auth = t.trim();
  const [user, repo] = await Promise.all([
    gh<{ login: string }>(`/user`, { auth }),
    gh<{ permissions?: { push?: boolean } }>(R, { auth }),
  ]);
  // GitHub does not list github-authentication-token-expiration in Access-Control-Expose-Headers,
  // so browsers usually get null here; the page then falls back to a user-picked expiry date.
  const raw = user.res.headers.get("github-authentication-token-expiration");
  const d = raw ? new Date(raw.replace(" UTC", "Z").replace(" ", "T")) : null;
  return {
    login: user.data.login,
    canWrite: repo.data.permissions?.push === true,
    expiresAt: d && !Number.isNaN(+d) ? d.toISOString() : null,
  };
}

async function lastTouched(path: string, sha: string): Promise<{ by?: string; at?: string }> {
  try {
    const { data } = await gh<{ author?: { login?: string }; commit: { author?: { name?: string; date?: string } } }[]>(
      `${R}/commits?sha=${sha}&path=${encodeURIComponent(path)}&per_page=1`,
    );
    const c = data[0];
    return c ? { by: c.author?.login ?? c.commit.author?.name, at: c.commit.author?.date } : {};
  } catch (e) {
    if (e instanceof AdminApiError && e.code !== "forbidden") throw e;
    return {};
  }
}

export async function loadAll(): Promise<LoadAllResult> {
  const sha = await headSha();
  const { data } = await gh<{ tree: TreeEntry[] }>(`${R}/git/trees/${sha}?recursive=1`);
  const files = data.tree.filter((e) => e.type === "blob" && /^content\/pre-owned\/[^/]+\.md$/.test(e.path));
  const cars = await pool(files, 6, async (f): Promise<RepoBike> => {
    const [{ data: blob }, touched] = await Promise.all([
      gh<{ content: string }>(`${R}/git/blobs/${f.sha}`),
      lastTouched(f.path, sha),
    ]);
    const { data: fm, body } = fromMarkdown(base64ToUtf8(blob.content));
    return { slug: f.path.slice(f.path.lastIndexOf("/") + 1, -3), path: f.path, data: fm, body, updatedAt: touched.at };
  });
  pinnedSha = sha;
  return { cars, headSha: sha };
}

// ---------- publish ----------

/** Paths in `ours` that changed on main between base and head. */
async function changedSince(base: string, head: string, ours: Set<string>): Promise<string[]> {
  const { data } = await gh<{ files?: { filename: string; previous_filename?: string }[] }>(
    `${R}/compare/${base}...${head}`,
  );
  const hit = new Set<string>();
  for (const f of data.files ?? []) {
    if (ours.has(f.filename)) hit.add(f.filename);
    if (f.previous_filename && ours.has(f.previous_filename)) hit.add(f.previous_filename);
  }
  return [...hit];
}

export async function publish(
  files: PublishFile[],
  message: string,
  { baseSha, onProgress }: PublishOptions,
): Promise<{ commitSha: string }> {
  const bad = files.find((f) => !isWritable(f.path));
  if (bad) throw new Error(`Refusing to write outside the pre-owned folders: ${bad.path}`);
  if (!files.length) throw new Error("Nothing to publish");

  // 1. Blobs are content-addressed, so they survive retries.
  const writes = files.filter((f): f is PublishFile & { content: string | Blob } => f.content !== null);
  let done = 0;
  onProgress?.({ stage: "blobs", done, total: writes.length });
  const shas = await pool(writes, 4, async (f) => {
    const { data } = await gh<{ sha: string }>(`${R}/git/blobs`, {
      method: "POST",
      body: { content: await toBase64(f.content), encoding: "base64" },
    });
    onProgress?.({ stage: "blobs", done: ++done, total: writes.length });
    return data.sha;
  });
  const blobOf = new Map(writes.map((f, i) => [f.path, shas[i]]));
  const tree = files.map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: blobOf.get(f.path) ?? null }));
  const ours = new Set(files.map((f) => f.path));

  // 2. Commit on the current head; fast-forward only.
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) onProgress?.({ stage: "retry", done: attempt, total: MAX_RETRIES });
    else onProgress?.({ stage: "commit", done: 0, total: 1 });

    const head = await headSha();
    if (head !== baseSha) {
      const clash = await changedSince(baseSha, head, ours);
      if (clash.length) {
        const md = clash.find((p) => p.endsWith(".md")) ?? clash[0];
        throw new AdminApiError("conflict", "Changed on main since you opened it", { paths: clash, ...(await lastTouched(md, head)) });
      }
    }
    const { data: parent } = await gh<Commit>(`${R}/git/commits/${head}`);
    const { data: newTree } = await gh<{ sha: string }>(`${R}/git/trees`, {
      method: "POST",
      body: { base_tree: parent.tree.sha, tree },
    });
    const { data: commit } = await gh<{ sha: string }>(`${R}/git/commits`, {
      method: "POST",
      body: { message, tree: newTree.sha, parents: [head] },
    });
    try {
      await gh(`${R}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
    } catch (e) {
      if (isMoved(e)) continue; // someone pushed between our read and our update
      throw e;
    }
    for (const f of files) {
      const src = f.path.startsWith("public/") ? f.path.slice("public".length) : null;
      if (!src) continue;
      const old = localBlobs.get(src);
      if (old && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(old);
      if (f.content instanceof Blob && typeof URL.createObjectURL === "function") localBlobs.set(src, URL.createObjectURL(f.content));
      else localBlobs.delete(src);
    }
    pinnedSha = commit.sha;
    onProgress?.({ stage: "done", done: 1, total: 1 });
    return { commitSha: commit.sha };
  }
  throw new AdminApiError("retry_exhausted", `main kept moving after ${MAX_RETRIES} retries`);
}

/** Photos just uploaded from this tab show from memory; others from the commit we last saw (public repo). */
export function assetUrl(src: string): string {
  const local = localBlobs.get(src);
  if (local) return local;
  if (!pinnedSha || !src.startsWith("/uploads/")) return src;
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${pinnedSha}/public${src}`;
}
