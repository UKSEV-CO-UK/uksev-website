/**
 * Real publish layer: talks to the Cloudflare Worker at same-origin /admin-api/* (behind
 * Cloudflare Access). The Worker holds the GitHub token; nothing secret is ever in the browser.
 * HTTP contract: see the header of types.ts.
 */
import {
  AdminApiError,
  isAdminErrorCode,
  type LoadAllResult,
  type PublishFile,
  type PublishOptions,
  type PublishRequest,
  type PublishResponse,
  type BlobRequest,
  type BlobResponse,
  type WireFile,
  type WorkerErrorBody,
  type WorkerStatus,
} from "./types";

export const API_BASE = "/admin-api";
export const REPO = "UKSEV-CO-UK/uksev-website";
/** Per photo (already WebP-compressed to ~1 MB by images.ts); the Worker caps a /blob request at 4 MB. */
export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 3;

let headSha = "";
const blobUrls = new Map<string, string>();

/* ---------------- response classification (pure, unit-tested) ---------------- */

export type RawResponse = {
  status: number;
  /** fetch Response.type: "basic" | "cors" | "opaque" | "opaqueredirect" | … */
  type?: string;
  contentType?: string | null;
  /** true when the request was redirected (fetch `redirected`, or XHR responseURL ≠ request URL). */
  redirected?: boolean;
  text: string;
};

/** Turn a Worker response into its JSON value, or throw the AdminApiError / Error the pages expect. */
export function parseResponse<T>(r: RawResponse): T {
  // Access answers an expired session with a redirect to its login page (opaque with redirect:"manual",
  // or a followed redirect that ends on HTML). Either way: the Access session has expired.
  if (r.type === "opaqueredirect" || (r.status === 0 && r.type === "opaque") || r.redirected) {
    throw new AdminApiError("access_expired", "Cloudflare Access redirected the request (session expired)");
  }
  const json = /json/i.test(r.contentType ?? "");
  let body: unknown;
  if (json) {
    try {
      body = JSON.parse(r.text);
    } catch {
      body = undefined;
    }
  }
  if (r.status >= 200 && r.status < 300) {
    if (body === undefined) {
      // 200 with HTML = the Access login page (or the static site) answered instead of the Worker.
      throw new AdminApiError("access_expired", "Expected JSON from /admin-api, got a page instead");
    }
    return body as T;
  }
  const e = body as Partial<WorkerErrorBody> | undefined;
  if (e && typeof e.code === "string") {
    if (isAdminErrorCode(e.code)) throw new AdminApiError(e.code, e.message || e.code, e.details);
    throw new Error(e.message || `Admin API error: ${e.code}`);
  }
  if (r.status === 401 || r.status === 403) throw new AdminApiError("access_expired", `HTTP ${r.status} from Cloudflare Access`);
  if (r.status === 404) throw new Error("Admin API not found (/admin-api/ returned 404). Is the Worker deployed and routed?");
  throw new Error(`Admin API error (HTTP ${r.status})`);
}

async function fromFetch(res: Response): Promise<RawResponse> {
  return {
    status: res.status,
    type: res.type,
    contentType: res.headers.get("content-type"),
    redirected: res.redirected,
    text: res.type === "opaqueredirect" ? "" : await res.text(),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
      headers: { accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw await networkError(e);
  }
  return parseResponse<T>(await fromFetch(res));
}

/**
 * A network-level failure is either really offline, or a redirect to the Access login on another
 * origin that the browser blocked (CORS). Probe /status with redirect:"manual" to tell them apart.
 */
async function networkError(e: unknown): Promise<AdminApiError> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return new AdminApiError("offline", "No internet connection");
  try {
    const res = await fetch(`${API_BASE}/status`, { credentials: "include", redirect: "manual", cache: "no-store" });
    parseResponse(await fromFetch(res));
  } catch (p) {
    if (p instanceof AdminApiError && p.code === "access_expired") return p;
  }
  return new AdminApiError("offline", e instanceof Error ? e.message : "Network error");
}

/* ---------------- encoding ---------------- */

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export async function toWire(f: PublishFile): Promise<WireFile> {
  if (f.content === null) return { path: f.path, content: null };
  if (typeof f.content === "string") return { path: f.path, content: f.content, encoding: "utf-8" };
  return { path: f.path, content: bytesToBase64(new Uint8Array(await f.content.arrayBuffer())), encoding: "base64" };
}

const mbs = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
export function tooLarge(bytes: number) {
  return new AdminApiError("too_large", `A photo is ${mbs(bytes)}, over the ${mbs(MAX_PHOTO_BYTES)} limit. Re-add it so it gets compressed.`);
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

/* ---------------- AdminApi ---------------- */

export async function status(): Promise<WorkerStatus> {
  return request<WorkerStatus>("/status");
}

export async function loadAll(): Promise<LoadAllResult> {
  const r = await request<LoadAllResult>("/bikes");
  if (!r || !Array.isArray(r.cars) || typeof r.headSha !== "string") throw new Error("Unexpected /admin-api/bikes response");
  headSha = r.headSha;
  return r;
}

/**
 * Photos go up one per request (POST /blob → sha), then one small POST /publish makes the single commit.
 * Keeps every Worker request tiny (CPU limit) and gives real per-photo progress.
 */
export async function publish(files: PublishFile[], message: string, { baseSha, onProgress }: PublishOptions): Promise<PublishResponse> {
  const photos = files.filter((f): f is PublishFile & { content: Blob } => f.content instanceof Blob);
  const big = photos.find((f) => f.content.size > MAX_PHOTO_BYTES);
  if (big) throw tooLarge(big.content.size);

  let done = 0;
  onProgress?.({ stage: "blobs", done, total: photos.length });
  const shas = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < photos.length) {
      const f = photos[next++];
      const wire = await toWire(f);
      const r = await postJson<BlobResponse>("/blob", { content: wire.content as string, encoding: "base64" } satisfies BlobRequest);
      if (!r || typeof r.sha !== "string") throw new Error("Unexpected /admin-api/blob response");
      shas.set(f.path, r.sha);
      onProgress?.({ stage: "blobs", done: ++done, total: photos.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, photos.length) }, worker));

  onProgress?.({ stage: "commit", done: 0, total: 1 });
  const wire: WireFile[] = [];
  for (const f of files) {
    const sha = shas.get(f.path);
    wire.push(sha ? { path: f.path, sha } : await toWire(f));
  }
  const r = await postJson<PublishResponse>("/publish", { message, baseSha, files: wire } satisfies PublishRequest);
  if (!r || typeof r.commitSha !== "string") throw new Error("Unexpected /admin-api/publish response");

  // Show just-published photos from memory until raw.githubusercontent / the site has them.
  for (const f of files) {
    if (!f.path.startsWith("public/")) continue;
    const src = f.path.slice("public".length);
    if (f.content instanceof Blob && typeof URL.createObjectURL === "function") blobUrls.set(src, URL.createObjectURL(f.content));
    else if (f.content === null) blobUrls.delete(src);
  }
  headSha = r.commitSha;
  onProgress?.({ stage: "done", done: 1, total: 1 });
  return r;
}

/** The repo is public, so photos at the head commit are readable before the site redeploys. */
export function assetUrl(src: string): string {
  const local = blobUrls.get(src);
  if (local) return local;
  if (!headSha || !src.startsWith("/")) return src;
  return `https://raw.githubusercontent.com/${REPO}/${headSha}/public${src}`;
}
