/**
 * Contract between the admin pages and the GitHub publish module.
 * The real module (src/lib/admin/publish.ts, backend) and the fake (fake.ts)
 * both implement `AdminApi`. Pure types + one error class: no imports from either.
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

/** content null = delete that path. Blob = binary (photo), string = UTF-8 text. */
export type PublishFile = { path: string; content: string | Blob | null };

export type PublishStage = "blobs" | "commit" | "retry" | "done";
/** blobs: done/total = blobs created so far / non-null files. commit/retry/done: done=total=1 is fine. */
export type PublishProgress = { stage: PublishStage; done: number; total: number };

export type PublishOptions = {
  /** headSha from loadAll() the edit is based on. */
  baseSha: string;
  onProgress?: (p: PublishProgress) => void;
};

export type VerifyResult = {
  login: string;
  canWrite: boolean;
  /** ISO date-time if GitHub exposes it (github-authentication-token-expiration header); else undefined/null. */
  expiresAt?: string | null;
};

/**
 * Errors the pages react to. Any thrown value with one of these `code`s works
 * (instanceof is not required), so publish.ts may use its own Error subclass.
 *  - conflict:        a path in `files` was changed on main after baseSha (details.paths, details.by?, details.at?)
 *  - retry_exhausted: main kept moving, gave up after N automatic retries
 *  - unauthorized:    401 (token expired / revoked)
 *  - forbidden:       403/404 on the repo (no Contents write or no repo access)
 *  - offline:         network failure (fetch TypeError / navigator.onLine false)
 */
export type AdminErrorCode = "conflict" | "retry_exhausted" | "unauthorized" | "forbidden" | "offline";

export type ConflictDetails = { paths: string[]; by?: string; at?: string };

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

export function errorCode(e: unknown): AdminErrorCode | "unknown" {
  const c = (e as { code?: unknown } | null)?.code;
  if (c === "conflict" || c === "retry_exhausted" || c === "unauthorized" || c === "forbidden" || c === "offline") return c;
  if (e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false)) return "offline";
  return "unknown";
}

export type AdminApi = {
  /** Token the other calls use (null = signed out). Pages call this on load / sign-in / sign-out. */
  setToken(token: string | null): void;
  verifyToken(token: string): Promise<VerifyResult>;
  loadAll(): Promise<LoadAllResult>;
  publish(files: PublishFile[], message: string, opts: PublishOptions): Promise<{ commitSha: string }>;
  /** URL the admin can show for a repo photo path like /uploads/pre-owned/x.webp (works before the site redeploys). */
  assetUrl(src: string): string;
};
