import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAll, verifyToken, setToken, assetUrl } from "../src/lib/admin/publish";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
globalThis.fetch = (async (url: string) => {
  const p = String(url).replace("https://api.github.com/repos/UKSEV-CO-UK/uksev-website", "").replace("https://api.github.com", "");
  const ok = (j: unknown, h?: Record<string, string>) => new Response(JSON.stringify(j), { status: 200, headers: h });
  if (p === "/user") return ok({ login: "panda" }, { "github-authentication-token-expiration": "2027-01-14 00:00:00 UTC" });
  if (p === "") return ok({ permissions: { push: true } });
  if (p === "/git/ref/heads/main") return ok({ object: { sha: "h1" } });
  if (p.startsWith("/git/trees/h1")) return ok({ tree: [
    { path: "content/pre-owned/ado.md", type: "blob", sha: "b1" },
    { path: "content/pre-owned/img", type: "tree", sha: "t" },
    { path: "src/x.md", type: "blob", sha: "b2" },
  ] });
  if (p === "/git/blobs/b1") return ok({ content: b64("---\nbrand: ADO\nprice: 1095\n---\nCafé ridden £\n") });
  if (p.startsWith("/commits?")) return ok([{ commit: { author: { date: "2026-10-15T10:00:00Z" } } }]);
  return new Response("{}", { status: 500 });
}) as typeof fetch;

test("verifyToken: login, write access, expiry when the header is readable", async () => {
  assert.deepEqual(await verifyToken(" github_pat_x "), { login: "panda", canWrite: true, expiresAt: "2027-01-14T00:00:00.000Z" });
});

test("loadAll reads bikes at one head sha, UTF-8 safe, and pins asset URLs", async () => {
  setToken("github_pat_x");
  const r = await loadAll();
  assert.equal(r.headSha, "h1");
  assert.equal(r.cars.length, 1);
  assert.deepEqual(r.cars[0], { slug: "ado", path: "content/pre-owned/ado.md", data: { brand: "ADO", price: 1095 }, body: "Café ridden £", updatedAt: "2026-10-15T10:00:00Z" });
  assert.equal(assetUrl("/uploads/pre-owned/a.webp"), "https://raw.githubusercontent.com/UKSEV-CO-UK/uksev-website/h1/public/uploads/pre-owned/a.webp");
});
