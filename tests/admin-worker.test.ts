/* eslint-disable @typescript-eslint/no-explicit-any -- fetch test doubles */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyAccessJwt, resetCertCache } from "../worker/src/access";
import { handle, type Env } from "../worker/src/index";
import { isWritable } from "../worker/src/github";

// ---------- Access JWT fixture (real RS256 keys) ----------
const TEAM = "uksev.cloudflareaccess.com";
const AUD = "aud-123";
const NOW = Date.parse("2026-10-16T22:00:00Z");
const b64url = (b: Uint8Array | string) => Buffer.from(b).toString("base64url");
const RSA = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
let pair: CryptoKeyPair, other: CryptoKeyPair, jwk: JsonWebKey & { kid: string };
before(async () => {
  pair = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  other = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
});
async function jwt(claims: Record<string, unknown>, key?: CryptoKey, kid = "k1") {
  key ??= pair.privateKey;
  const h = b64url(JSON.stringify({ alg: "RS256", kid }));
  const p = b64url(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}
const good = { aud: [AUD], iss: `https://${TEAM}`, exp: NOW / 1000 + 3600, email: "panda@uksev.co.uk" };

// ---------- fake GitHub + certs ----------
type Call = { method: string; path: string; body?: any };
let calls: Call[];
let gh: (c: Call) => { status: number; json?: unknown; headers?: Record<string, string> };
const fetcher = (async (url: string, init: any = {}) => {
  if (String(url).endsWith("/cdn-cgi/access/certs")) return Response.json({ keys: [jwk] });
  const c: Call = { method: init.method ?? "GET", path: String(url).replace("https://api.github.com/repos/UKSEV-CO-UK/uksev-website", "").replace("https://api.github.com", ""), body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(c);
  const r = gh(c);
  return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status, headers: r.headers });
}) as typeof fetch;

const S = (n: string) => n.repeat(40).slice(0, 40);
function repo(o: { heads: string[]; changed?: string[]; refFailures?: number }) {
  let h = 0, fails = o.refFailures ?? 0, blob = 0;
  return (c: Call) => {
    if (c.path === "/git/ref/heads/main") return { status: 200, json: { object: { sha: o.heads[Math.min(h++, o.heads.length - 1)] } } };
    if (c.path.startsWith("/compare/")) return { status: 200, json: { files: (o.changed ?? []).map((filename) => ({ filename })) } };
    if (c.path.startsWith("/commits?")) return { status: 200, json: [{ author: { login: "colleague" }, commit: { author: { date: "2026-10-16T21:00:00Z" } } }] };
    if (c.method === "POST" && c.path === "/git/blobs") return { status: 201, json: { sha: S(String(++blob)) } };
    if (c.method === "GET" && c.path.startsWith("/git/commits/")) return { status: 200, json: { tree: { sha: "tree0" } } };
    if (c.method === "POST" && c.path === "/git/trees") return { status: 201, json: { sha: "tree1" } };
    if (c.method === "POST" && c.path === "/git/commits") return { status: 201, json: { sha: S("c") } };
    if (c.method === "PATCH") return fails-- > 0 ? { status: 422, json: { message: "not a fast forward" } } : { status: 200, json: {} };
    return { status: 500, json: { message: `unrouted ${c.method} ${c.path}` } };
  };
}

const env: Env = { GITHUB_TOKEN: "github_pat_x", GITHUB_REPO: "UKSEV-CO-UK/uksev-website", ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const BASE = S("a");
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, token?: string) {
  const t = token ?? (await jwt(good));
  const raw = body instanceof Uint8Array;
  const req = new Request(`https://uksev.co.uk${path}`, {
    method,
    headers: { "cf-access-jwt-assertion": t, ...(body ? { "content-type": raw ? "image/webp" : "application/json", origin: "https://uksev.co.uk" } : {}), ...headers },
    body: raw ? (body as unknown as BodyInit) : body ? JSON.stringify(body) : undefined,
  });
  const res = await handle(req, env, { fetcher, now: NOW });
  return { status: res.status, body: (await res.json()) as any };
}

beforeEach(() => {
  calls = [];
  gh = repo({ heads: [BASE] });
  resetCertCache();
});

// ---------- Access ----------
test("Access JWT: valid passes; wrong aud / expired / wrong key / wrong iss / missing config fail", async () => {
  const cfg = { teamDomain: TEAM, aud: AUD };
  assert.ok(await verifyAccessJwt(await jwt(good), cfg, { now: NOW, fetcher }));
  assert.equal(await verifyAccessJwt(await jwt({ ...good, aud: ["x"] }), cfg, { now: NOW, fetcher }), null);
  assert.equal(await verifyAccessJwt(await jwt({ ...good, exp: NOW / 1000 - 1 }), cfg, { now: NOW, fetcher }), null);
  assert.equal(await verifyAccessJwt(await jwt(good, other.privateKey), cfg, { now: NOW, fetcher }), null);
  assert.equal(await verifyAccessJwt(await jwt({ ...good, iss: "https://evil.cloudflareaccess.com" }), cfg, { now: NOW, fetcher }), null);
  assert.equal(await verifyAccessJwt(await jwt(good), { teamDomain: "", aud: "" }, { now: NOW, fetcher }), null);
  assert.equal(await verifyAccessJwt(null, cfg, { now: NOW, fetcher }), null);
});

test("no or bad Access token → 403 access_expired and GitHub is never called", async () => {
  const r = await call("GET", "/admin-api/status", undefined, {}, "nope");
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "access_expired");
  assert.equal(calls.length, 0);
});

// ---------- routes ----------
test("status reports write access and token expiry", async () => {
  gh = (c) =>
    c.path === "/user"
      ? { status: 200, json: { login: "panda" }, headers: { "github-authentication-token-expiration": "2027-01-14 00:00:00 UTC" } }
      : { status: 200, json: { permissions: { push: true } } };
  const r = await call("GET", "/admin-api/status");
  assert.deepEqual(r.body, { canWrite: true, expiresAt: "2027-01-14T00:00:00.000Z", login: "panda" });
});

test("status with a dead GitHub token → canWrite false, not an error", async () => {
  gh = () => ({ status: 401, json: { message: "Bad credentials" } });
  const r = await call("GET", "/admin-api/status");
  assert.deepEqual([r.status, r.body.canWrite], [200, false]);
});

test("bikes come from one GraphQL call at one commit", async () => {
  gh = () => ({ status: 200, json: { data: { repository: { ref: { target: { oid: BASE, file: { object: { entries: [
    { name: "ado.md", type: "blob", object: { text: "---\nbrand: ADO\nprice: 1095\n---\nCafé £\n", isBinary: false } },
    { name: "notes.txt", type: "blob", object: { text: "x", isBinary: false } },
  ] } } } } } } } });
  const r = await call("GET", "/admin-api/bikes");
  assert.equal(calls.length, 1);
  assert.deepEqual(r.body, { headSha: BASE, cars: [{ slug: "ado", path: "content/pre-owned/ado.md", data: { brand: "ADO", price: 1095 }, body: "Café £" }] });
});

test("blob → sha; publish → one commit, deletions as null, no force, Access email in message", async () => {
  const b = await call("POST", "/admin-api/blobs", new Uint8Array([1, 2, 3]), { "x-upload-path": "public/uploads/pre-owned/ado-1.webp" });
  assert.equal(b.body.sha, S("1"));
  assert.deepEqual(calls[0].body, { content: "AQID", encoding: "base64" });
  const r = await call("POST", "/admin-api/publish", {
    message: "pre-owned: add ADO",
    baseSha: BASE,
    files: [
      { path: "content/pre-owned/ado.md", content: "---\nbrand: ADO\n---\n" },
      { path: "public/uploads/pre-owned/ado-1.webp", blobSha: b.body.sha },
      { path: "public/uploads/pre-owned/old.webp", content: null },
    ],
  });
  assert.deepEqual(r, { status: 200, body: { commitSha: S("c") } });
  const tree = calls.find((c) => c.path === "/git/trees")!.body;
  assert.deepEqual(tree.tree.map((e: any) => [e.path, e.sha]), [
    ["content/pre-owned/ado.md", S("2")],
    ["public/uploads/pre-owned/ado-1.webp", S("1")],
    ["public/uploads/pre-owned/old.webp", null],
  ]);
  assert.deepEqual(calls.find((c) => c.method === "PATCH")!.body, { sha: S("c"), force: false });
  assert.match(calls.find((c) => c.path === "/git/commits" && c.method === "POST")!.body.message, /Published-by: panda@uksev\.co\.uk$/);
});

const md = [{ path: "content/pre-owned/ado.md", content: "x" }];

test("main moved elsewhere → rebuilt on new head; ref race → retried", async () => {
  gh = repo({ heads: [S("d"), S("e")], changed: ["content/pre-owned/other.md"], refFailures: 1 });
  const r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: md });
  assert.equal(r.status, 200);
  assert.deepEqual(calls.filter((c) => c.path === "/git/commits" && c.method === "POST").map((c) => c.body.parents[0]), [S("d"), S("e")]);
});

test("same bike changed → 409 conflict with who/when, nothing pushed", async () => {
  gh = repo({ heads: [S("d")], changed: ["content/pre-owned/ado.md"] });
  const r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: md });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body.details, { paths: ["content/pre-owned/ado.md"], by: "colleague", at: "2026-10-16T21:00:00Z" });
  assert.equal(calls.some((c) => c.method === "PATCH"), false);
});

test("retries run out → 409 retry_exhausted", async () => {
  gh = repo({ heads: [BASE], refFailures: 99 });
  const r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: md });
  assert.deepEqual([r.status, r.body.code], [409, "retry_exhausted"]);
});

test("only the two pre-owned folders are writable", async () => {
  for (const p of [".github/workflows/pages.yml", "src/app/page.tsx", "content/pre-owned/../x.md", "public/uploads/pre-owned/../../x", "content/pre-owned/sub/a.md"]) {
    assert.equal(isWritable(p), false, p);
    const r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: [{ path: p, content: "x" }] });
    assert.deepEqual([r.status, r.body.code], [403, "forbidden"], p);
  }
  assert.equal(calls.length, 0);
});

test("blobs: wrong X-Upload-Path, non-image, cross-site, bad GitHub token", async () => {
  const img = new Uint8Array([1, 2, 3]);
  const up = { "x-upload-path": "public/uploads/pre-owned/a.webp" };
  let r = await call("POST", "/admin-api/blobs", img, { "x-upload-path": "src/app/page.tsx" });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
  r = await call("POST", "/admin-api/blobs", img, { "x-upload-path": "content/pre-owned/a.md" });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
  r = await call("POST", "/admin-api/blobs", img, { ...up, "content-type": "text/html" });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
  r = await call("POST", "/admin-api/blobs", img, { ...up, origin: "https://evil.example" });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
  assert.equal(calls.length, 0);
  gh = () => ({ status: 401, json: { message: "Bad credentials" } });
  r = await call("POST", "/admin-api/blobs", img, up);
  assert.deepEqual([r.status, r.body.code], [502, "credential_invalid"]);
});

test("publish rejects non-JSON and bad blobSha", async () => {
  let r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: md }, { "content-type": "text/plain" });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
  r = await call("POST", "/admin-api/publish", { message: "m", baseSha: BASE, files: [{ path: "public/uploads/pre-owned/a.webp", blobSha: "nope" }] });
  assert.deepEqual([r.status, r.body.code], [403, "forbidden"]);
});
