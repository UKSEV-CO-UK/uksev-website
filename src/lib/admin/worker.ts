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
  type BlobResponse,
  type WireFile,
  type WorkerErrorBody,
  type WorkerStatus,
} from "./types";

export const API_BASE = "/admin-api";
export const REPO = "UKSEV-CO-UK/uksev-website";

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
      headers: { accept: "application/json", ...((init.headers as Record<string, string>) ?? {}) },
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

/* ---------------- blobs ---------------- */

/** Images already uploaded in this tab → their git blob sha, so a retry after conflict doesn't re-upload. */
const blobShas = new WeakMap<Blob, string>();
export const BLOB_CONCURRENCY = 2;

const imageType = (path: string, b: Blob) =>
  b.type || (/\.jpe?g$/i.test(path) ? "image/jpeg" : /\.png$/i.test(path) ? "image/png" : "image/webp");

/** POST /admin-api/blobs with the raw image bytes → { sha }. */
export async function uploadBlob(path: string, b: Blob): Promise<string> {
  const known = blobShas.get(b);
  if (known) return known;
  const r = await request<BlobResponse>("/blobs", {
    method: "POST",
    body: b,
    headers: { "content-type": imageType(path, b), "x-upload-path": path },
  });
  if (!r || typeof r.sha !== "string") throw new Error("Unexpected /admin-api/blobs response");
  blobShas.set(b, r.sha);
  return r.sha;
}

/** Run fn over items with at most `n` in flight; rejects on the first failure (nothing is committed then). */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

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

export async function publish(files: PublishFile[], message: string, { baseSha, onProgress }: PublishOptions): Promise<PublishResponse> {
  const images = files.filter((f): f is PublishFile & { content: Blob } => f.content instanceof Blob);
  let done = 0;
  onProgress?.({ stage: "blobs", done, total: images.length });
  const shas = await pool(images, BLOB_CONCURRENCY, async (f) => {
    const sha = await uploadBlob(f.path, f.content);
    onProgress?.({ stage: "blobs", done: ++done, total: images.length });
    return sha;
  });
  const shaOf = new Map(images.map((f, i) => [f.path, shas[i]]));
  const wire: WireFile[] = files.map((f) =>
    f.content instanceof Blob ? { path: f.path, blobSha: shaOf.get(f.path)! } : { path: f.path, content: f.content },
  );

  onProgress?.({ stage: "commit", done: 0, total: 1 });
  const r = await request<PublishResponse>("/publish", {
    method: "POST",
    body: JSON.stringify({ message, baseSha, files: wire } satisfies PublishRequest),
    headers: { "content-type": "application/json" },
  });
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
