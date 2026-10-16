/**
 * GitHub side of the admin Worker. Runtime-agnostic (fetch + WebCrypto-free), unit-tested with a mocked fetch.
 * One publish = one commit via the Git Data API, fast-forward only, never forced.
 */
import { fromMarkdown } from "../../src/lib/admin/serialize";
import type { ConflictDetails, LoadAllResult, RepoBike, WorkerStatus } from "../../src/lib/admin/types";

export const BRANCH = "main";
export const MAX_RETRIES = 3;
const API = "https://api.github.com";

/** Only these paths may be written, so nothing can ever touch site code or CI. */
const WRITABLE = [/^content\/pre-owned\/[A-Za-z0-9][A-Za-z0-9_-]*\.md$/, /^public\/uploads\/pre-owned\/[A-Za-z0-9][A-Za-z0-9._-]*$/];
export const isWritable = (p: string) => !p.includes("..") && WRITABLE.some((re) => re.test(p));
export const isSha = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{40}$/.test(s);

/** Error carrying the contract code + HTTP status the Worker should answer with. */
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string,
    public details?: ConflictDetails,
  ) {
    super(message ?? code);
  }
}

export type TreeChange = { path: string; sha: string | null };
export type Gh = ReturnType<typeof github>;

export function github(token: string, repo: string, fetcher: typeof fetch = fetch) {
  const R = `/repos/${repo}`;

  async function call<T>(path: string, method = "GET", body?: unknown): Promise<{ data: T; res: Response }> {
    if (!token) throw new ApiError("credential_invalid", 502, "GITHUB_TOKEN secret is not set");
    const res = await fetcher(API + path, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "uksev-admin-worker",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { data: (await res.json()) as T, res };
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403 || res.status === 404)
      throw new ApiError("credential_invalid", 502, `GitHub ${res.status}: ${text.slice(0, 200)}`);
    if (res.status === 409 || res.status === 422) throw new ApiError("github_moved", res.status, text.slice(0, 200));
    throw new ApiError("github_error", 502, `GitHub ${res.status}: ${text.slice(0, 200)}`);
  }

  const headSha = async () => (await call<{ object: { sha: string } }>(`${R}/git/ref/heads/${BRANCH}`)).data.object.sha;

  async function lastTouched(path: string, sha: string): Promise<{ by?: string; at?: string }> {
    try {
      const { data } = await call<{ author?: { login?: string }; commit: { author?: { name?: string; date?: string } } }[]>(
        `${R}/commits?sha=${sha}&path=${encodeURIComponent(path)}&per_page=1`,
      );
      const c = data[0];
      return c ? { by: c.author?.login ?? c.commit.author?.name, at: c.commit.author?.date } : {};
    } catch {
      return {};
    }
  }

  return {
    /** Token health for the admin banner. Never throws for a bad token: canWrite=false instead. */
    async status(): Promise<WorkerStatus> {
      try {
        const [user, r] = await Promise.all([call<{ login: string }>(`/user`), call<{ permissions?: { push?: boolean } }>(R)]);
        const raw = user.res.headers.get("github-authentication-token-expiration");
        const d = raw ? new Date(raw.replace(" UTC", "Z").replace(/^(\S+) /, "$1T")) : null;
        return {
          canWrite: r.data.permissions?.push === true,
          expiresAt: d && !Number.isNaN(+d) ? d.toISOString() : null,
          login: user.data.login,
        };
      } catch (e) {
        if (e instanceof ApiError && e.code === "credential_invalid") return { canWrite: false, expiresAt: null };
        throw e;
      }
    },

    /** All bikes at one commit, in a single GraphQL call (Workers cap subrequests per request). */
    async loadAll(): Promise<LoadAllResult> {
      const [owner, name] = repo.split("/");
      const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){ref(qualifiedName:"refs/heads/${BRANCH}"){target{... on Commit{oid file(path:"content/pre-owned"){object{... on Tree{entries{name type object{... on Blob{text isBinary}}}}}}}}}}}`;
      type Entry = { name: string; type: string; object?: { text?: string | null; isBinary?: boolean } };
      type Res = { data?: { repository?: { ref?: { target?: { oid: string; file?: { object?: { entries?: Entry[] } } | null } } } }; errors?: { message: string }[] };
      const { data } = await call<Res>(`/graphql`, "POST", { query, variables: { owner, name } });
      if (data.errors?.length) throw new ApiError("github_error", 502, data.errors.map((e) => e.message).join("; "));
      const target = data.data?.repository?.ref?.target;
      if (!target) throw new ApiError("github_error", 502, "main not found");
      const cars: RepoBike[] = (target.file?.object?.entries ?? [])
        .filter((e) => e.type === "blob" && e.name.endsWith(".md") && typeof e.object?.text === "string" && !e.object.isBinary)
        .map((e) => {
          const { data: fm, body } = fromMarkdown(e.object!.text!);
          return { slug: e.name.slice(0, -3), path: `content/pre-owned/${e.name}`, data: fm, body };
        });
      return { cars, headSha: target.oid };
    },

    /** Uploads one blob (base64) and returns its sha. Blobs are content-addressed and survive retries. */
    async blob(content: string, encoding: "base64" | "utf-8"): Promise<string> {
      return (await call<{ sha: string }>(`${R}/git/blobs`, "POST", { content, encoding })).data.sha;
    },

    /**
     * Commits `changes` on top of main. If main moved since baseSha: conflict when any of our paths changed,
     * otherwise rebuild on the new head. Ref races (422) retry up to MAX_RETRIES.
     */
    async commit(changes: TreeChange[], message: string, baseSha: string): Promise<{ commitSha: string; retries: number }> {
      const ours = new Set(changes.map((c) => c.path));
      const tree = changes.map((c) => ({ path: c.path, mode: "100644", type: "blob", sha: c.sha }));
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const head = await headSha();
        if (head !== baseSha) {
          const { data } = await call<{ files?: { filename: string; previous_filename?: string }[] }>(`${R}/compare/${baseSha}...${head}`);
          const clash = [...new Set((data.files ?? []).flatMap((f) => [f.filename, f.previous_filename ?? ""]).filter((p) => ours.has(p)))];
          if (clash.length) {
            const md = clash.find((p) => p.endsWith(".md")) ?? clash[0];
            throw new ApiError("conflict", 409, "Changed on main since you opened it", { paths: clash, ...(await lastTouched(md, head)) });
          }
        }
        const { data: parent } = await call<{ tree: { sha: string } }>(`${R}/git/commits/${head}`);
        const { data: t } = await call<{ sha: string }>(`${R}/git/trees`, "POST", { base_tree: parent.tree.sha, tree });
        const { data: c } = await call<{ sha: string }>(`${R}/git/commits`, "POST", { message, tree: t.sha, parents: [head] });
        try {
          await call(`${R}/git/refs/heads/${BRANCH}`, "PATCH", { sha: c.sha, force: false });
          return { commitSha: c.sha, retries: attempt };
        } catch (e) {
          if (e instanceof ApiError && e.code === "github_moved") continue;
          throw e;
        }
      }
      throw new ApiError("retry_exhausted", 409, `main kept moving after ${MAX_RETRIES} retries`);
    },
  };
}
