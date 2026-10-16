/**
 * Contract between the admin pages and the publish layer.
 *
 * The site never holds a GitHub token. The admin talks to a Cloudflare Worker routed at
 * same-origin `/admin-api/*` behind Cloudflare Access; the Worker holds the GitHub token as a
 * secret and does the commits. The Worker itself is owned by backend; this file is the HTTP
 * contract it must match (also in README → 后台 `/admin/`).
 *
 * Both the real client (worker.ts) and the stand-in (fake.ts) implement `AdminApi`.
 * Pure types + one error class: no imports from either.
 *
 * ── HTTP contract (all JSON, same origin, cookies included) ──────────────────────────────
 *  GET  /admin-api/status   → 200 WorkerStatus
 *  GET  /admin-api/bikes    → 200 LoadAllResult            ({ cars: RepoBike[], headSha })
 *  POST /admin-api/blob     ← BlobRequest     → 200 BlobResponse ({ sha })   one photo per request
 *  POST /admin-api/publish  ← PublishRequest  → 200 PublishResponse ({ commitSha })   files reference blob shas
 *  Any failure              → 4xx/5xx WorkerErrorBody      ({ code, message, details? })
 *    409 conflict          details: ConflictDetails (a path in `files` changed on main after baseSha)
 *    409 retry_exhausted   main kept moving; the Worker gave up after its automatic 422 retries
 *    403 forbidden         path outside content/pre-owned/ or public/uploads/pre-owned/, or bad request
 *    403 access_expired    Cf-Access-Jwt-Assertion missing / invalid (team key + aud)
 *    502 credential_invalid the Worker's GitHub token is bad, expired or lacks Contents write
 *    413 too_large         request body over the Worker limit
 *  Client-side only: offline (network failure), too_large (a photo over MAX_PHOTO_BYTES),
 *  access_expired is also inferred from a redirect / opaque / HTML response or a bare 401/403.
 */

/** One bike file as it is on main: frontmatter parsed to an object, markdown body as text. */
export type RepoBike = {
  slug: string;
  /** content/pre-owned/<slug>.md */
  path: string;
  /** Parsed YAML frontmatter (dates may be Date objects or YYYY-MM-DD strings). */
  data: Record<string, unknown>;
  /** Markdown body after the frontmatter. */
  body: string;
  /** ISO time of the last commit touching the file, if known. */
  updatedAt?: string;
};

export type LoadAllResult = { cars: RepoBike[]; headSha: string };

/** GET /admin-api/status */
export type WorkerStatus = {
  /** false = the Worker's GitHub token can't write (bad/expired/read-only). */
  canWrite: boolean;
  /** ISO date-time the Worker's GitHub token expires (github-authentication-token-expiration), if known. */
  expiresAt?: string | null;
  /** GitHub login the token belongs to, for display only. */
  login?: string;
};

/** What the pages hand the client. content null = delete that path. Blob = binary (photo), string = UTF-8 text. */
export type PublishFile = { path: string; content: string | Blob | null };

/** One photo on the wire: POST /admin-api/blob body and response. */
export type BlobRequest = { content: string; encoding: "base64" };
export type BlobResponse = { sha: string };
/**
 * One file in a publish. Photos reference a sha from /blob; .md goes inline as utf-8; content null = delete.
 * (Inline base64 content is still accepted by the Worker but not used by the client.)
 */
export type WireFile = { path: string; sha?: string; content?: string | null; encoding?: "utf-8" | "base64" };
/** POST /admin-api/publish body */
export type PublishRequest = { message: string; baseSha: string; files: WireFile[] };
/** POST /admin-api/publish 200 */
export type PublishResponse = { commitSha: string };

export type PublishStage = "blobs" | "commit" | "retry" | "done";
/**
 * Client-side progress. blobs = photos uploaded via /blob (done/total = photos);
 * commit = request sent, waiting for the Worker; retry = reserved (the Worker retries 422s itself);
 * done = committed.
 */
export type PublishProgress = { stage: PublishStage; done: number; total: number };

export type PublishOptions = {
  /** headSha from loadAll() the edit is based on. */
  baseSha: string;
  onProgress?: (p: PublishProgress) => void;
};

export type AdminErrorCode =
  | "conflict"
  | "retry_exhausted"
  | "forbidden"
  | "offline"
  | "access_expired"
  | "credential_invalid"
  | "too_large";
const CODES: readonly string[] = ["conflict", "retry_exhausted", "forbidden", "offline", "access_expired", "credential_invalid", "too_large"];

export type ConflictDetails = { paths: string[]; by?: string; at?: string };

/** Error body the Worker returns with any non-2xx status. */
export type WorkerErrorBody = { code: AdminErrorCode | string; message?: string; details?: ConflictDetails };

export class AdminApiError extends Error {
  constructor(
    public code: AdminErrorCode,
    message?: string,
    public details?: ConflictDetails,
  ) {
    super(message ?? code);
    this.name = "AdminApiError";
  }
}

export const isAdminErrorCode = (c: unknown): c is AdminErrorCode => typeof c === "string" && CODES.includes(c);

export function errorCode(e: unknown): AdminErrorCode | "unknown" {
  const c = (e as { code?: unknown } | null)?.code;
  if (isAdminErrorCode(c)) return c;
  if (e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false)) return "offline";
  return "unknown";
}

export type AdminApi = {
  status(): Promise<WorkerStatus>;
  loadAll(): Promise<LoadAllResult>;
  publish(files: PublishFile[], message: string, opts: PublishOptions): Promise<PublishResponse>;
  /** URL the admin can show for a repo photo path like /uploads/pre-owned/x.webp (works before the site redeploys). */
  assetUrl(src: string): string;
};
