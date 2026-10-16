/**
 * UKSEV admin API Worker, routed at uksev.co.uk/admin-api/* behind Cloudflare Access.
 * Holds the GitHub token (secret GITHUB_TOKEN) so the static site never does.
 * HTTP contract: src/lib/admin/types.ts. Every request must carry a valid Access JWT.
 */
import { verifyAccessJwt } from "./access";
import { ApiError, github, isSha, isWritable, type TreeChange } from "./github";

export type Env = {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
};

/** One image per /blobs request keeps each request small (Worker CPU limit). */
export const MAX_BLOB_BYTES = 4 * 1024 * 1024;
/** /publish carries only Markdown and blob shas. */
export const MAX_PUBLISH_BODY = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const MAX_FILES = 64;

type Deps = { fetcher?: typeof fetch; now?: number };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
const fail = (e: ApiError) => json(e.status, { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) });

async function readJson<T>(req: Request, max: number): Promise<T> {
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) throw new ApiError("forbidden", 403, "JSON only");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > max) throw new ApiError("too_large", 413, "Request too large");
  const text = await req.text();
  if (text.length > max) throw new ApiError("too_large", 413, "Request too large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("forbidden", 403, "Bad JSON");
  }
}

/** Blocks cross-site POSTs even if a browser sent the Access cookie along. */
function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

type WireFile = { path: string; content?: string | null; blobSha?: string };

export async function handle(req: Request, env: Env, { fetcher = fetch, now }: Deps = {}): Promise<Response> {
  try {
    const claims = await verifyAccessJwt(
      req.headers.get("cf-access-jwt-assertion"),
      { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD },
      { fetcher, now },
    );
    if (!claims) throw new ApiError("access_expired", 403, "Cloudflare Access check failed");

    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    const gh = github(env.GITHUB_TOKEN, env.GITHUB_REPO || "UKSEV-CO-UK/uksev-website", fetcher);

    if (req.method === "GET" && path === "/admin-api/status") return json(200, await gh.status());
    if (req.method === "GET" && path === "/admin-api/bikes") return json(200, await gh.loadAll());
    if (req.method !== "POST") throw new ApiError("not_found", 404, "Not found");
    if (!sameOrigin(req)) throw new ApiError("forbidden", 403, "Cross-site request");

    if (path === "/admin-api/blobs") {
      const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!IMAGE_TYPES.includes(type)) throw new ApiError("forbidden", 403, "Images only (webp, jpeg, png)");
      const target = req.headers.get("x-upload-path") ?? "";
      if (!target.startsWith("public/uploads/pre-owned/") || !isWritable(target)) throw new ApiError("forbidden", 403, `Path not allowed: ${target}`);
      if (Number(req.headers.get("content-length") ?? 0) > MAX_BLOB_BYTES) throw new ApiError("too_large", 413, "Image too large");
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (!bytes.length) throw new ApiError("forbidden", 403, "Empty image");
      if (bytes.length > MAX_BLOB_BYTES) throw new ApiError("too_large", 413, "Image too large");
      return json(200, { sha: await gh.blob(bytesToBase64(bytes), "base64") });
    }

    if (path === "/admin-api/publish") {
      const b = await readJson<{ message?: unknown; baseSha?: unknown; files?: unknown }>(req, MAX_PUBLISH_BODY);
      if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 500) throw new ApiError("forbidden", 403, "Bad message");
      if (!isSha(b.baseSha)) throw new ApiError("forbidden", 403, "Bad baseSha");
      if (!Array.isArray(b.files) || !b.files.length || b.files.length > MAX_FILES) throw new ApiError("forbidden", 403, "Bad files");
      const files = b.files as WireFile[];
      const seen = new Set<string>();
      for (const f of files) {
        if (typeof f?.path !== "string" || !isWritable(f.path) || seen.has(f.path))
          throw new ApiError("forbidden", 403, `Path not allowed: ${String(f?.path)}`);
        seen.add(f.path);
        if (f.blobSha !== undefined && !isSha(f.blobSha)) throw new ApiError("forbidden", 403, `Bad blobSha for ${f.path}`);
      }
      const changes: TreeChange[] = [];
      for (const f of files) {
        if (f.blobSha) changes.push({ path: f.path, sha: f.blobSha });
        else if (f.content === null) changes.push({ path: f.path, sha: null });
        else if (typeof f.content === "string") changes.push({ path: f.path, sha: await gh.blob(f.content, "utf-8") });
        else throw new ApiError("forbidden", 403, `No content for ${f.path}`);
      }
      const who = claims.email ? `\n\nPublished-by: ${claims.email}` : "";
      const { commitSha } = await gh.commit(changes, b.message.trim() + who, b.baseSha);
      return json(200, { commitSha });
    }
    throw new ApiError("not_found", 404, "Not found");
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code === "github_moved" ? new ApiError("github_error", 502, e.message) : e);
    return json(500, { code: "internal", message: e instanceof Error ? e.message : "error" });
  }
}

const worker = { fetch: (req: Request, env: Env) => handle(req, env) };
export default worker;
