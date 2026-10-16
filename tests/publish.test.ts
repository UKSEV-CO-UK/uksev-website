/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for fetch */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { publish, loadAll, setToken, isWritable } from "../src/lib/admin/publish";

type Call = { method: string; path: string; body?: any };
let calls: Call[] = [];
let route: (c: Call) => { status: number; json?: unknown; headers?: Record<string, string> };

const json = (status: number, json?: unknown, headers?: Record<string, string>) => ({ status, json, headers });
globalThis.fetch = (async (url: string, init: any = {}) => {
  const c: Call = { method: init.method ?? "GET", path: String(url).replace("https://api.github.com/repos/UKSEV-CO-UK/uksev-website", "").replace("https://api.github.com", ""), body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(c);
  const r = route(c);
  return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status, headers: r.headers });
}) as typeof fetch;

/** A tiny fake GitHub: main advances when `pushes` lists other people's commits. */
function repo(opts: { heads: string[]; changed?: string[]; refFailures?: number }) {
  let h = 0;
  let refFailures = opts.refFailures ?? 0;
  let blob = 0;
  return (c: Call) => {
    if (c.path === "/git/ref/heads/main") return json(200, { object: { sha: opts.heads[Math.min(h++, opts.heads.length - 1)] } });
    if (c.path.startsWith("/compare/")) return json(200, { files: (opts.changed ?? []).map((filename) => ({ filename })) });
    if (c.path.startsWith("/commits?")) return json(200, [{ author: { login: "colleague" }, commit: { author: { date: "2026-10-16T22:00:00Z" } } }]);
    if (c.method === "POST" && c.path === "/git/blobs") return json(201, { sha: `blob${++blob}` });
    if (c.method === "GET" && c.path.startsWith("/git/commits/")) return json(200, { tree: { sha: "tree0" } });
    if (c.method === "POST" && c.path === "/git/trees") return json(201, { sha: "tree1" });
    if (c.method === "POST" && c.path === "/git/commits") return json(201, { sha: "newcommit" });
    if (c.method === "PATCH") return refFailures-- > 0 ? json(422, { message: "Update is not a fast forward" }) : json(200, {});
    return json(500, { message: `unrouted ${c.method} ${c.path}` });
  };
}

const files = [
  { path: "content/pre-owned/ado.md", content: "---\nbrand: ADO\n---\n" },
  { path: "public/uploads/pre-owned/ado-1.webp", content: new Blob([new Uint8Array([1, 2, 3])]) },
  { path: "public/uploads/pre-owned/old.webp", content: null },
];

beforeEach(() => {
  calls = [];
  setToken("github_pat_test");
});

test("one commit with blobs, deletions as sha null, no force", async () => {
  route = repo({ heads: ["base"] });
  const stages: string[] = [];
  const r = await publish(files, "Add ADO", { baseSha: "base", onProgress: (p) => stages.push(`${p.stage}:${p.done}/${p.total}`) });
  assert.equal(r.commitSha, "newcommit");
  const tree = calls.find((c) => c.path === "/git/trees")!.body;
  assert.equal(tree.base_tree, "tree0");
  assert.deepEqual(tree.tree.map((e: any) => e.sha === null), [false, false, true]);
  assert.deepEqual(calls.find((c) => c.method === "PATCH")!.body, { sha: "newcommit", force: false });
  assert.equal(calls.filter((c) => c.path === "/git/blobs").length, 2);
  assert.deepEqual(stages, ["blobs:0/2", "blobs:1/2", "blobs:2/2", "commit:0/1", "done:1/1"]);
});

test("main moved on other files → rebuilds on new head", async () => {
  route = repo({ heads: ["other"], changed: ["content/pre-owned/someone-else.md"] });
  await publish(files, "m", { baseSha: "base" });
  assert.deepEqual(calls.find((c) => c.path === "/git/commits" && c.method === "POST")!.body.parents, ["other"]);
});

test("ref race → retry, blobs not re-uploaded", async () => {
  route = repo({ heads: ["base", "x1", "x2"], refFailures: 2 });
  const stages: string[] = [];
  await publish(files, "m", { baseSha: "base", onProgress: (p) => stages.push(p.stage) });
  assert.equal(calls.filter((c) => c.path === "/git/blobs").length, 2);
  assert.equal(stages.filter((s) => s === "retry").length, 2);
});

test("retries run out → retry_exhausted", async () => {
  route = repo({ heads: ["base"], refFailures: 99 });
  await assert.rejects(publish(files, "m", { baseSha: "base" }), { code: "retry_exhausted" });
});

test("same bike changed on main → conflict with who and when, nothing committed", async () => {
  route = repo({ heads: ["other"], changed: ["content/pre-owned/ado.md"] });
  await assert.rejects(publish(files, "m", { baseSha: "base" }), (e: any) => {
    assert.equal(e.code, "conflict");
    assert.deepEqual(e.details, { paths: ["content/pre-owned/ado.md"], by: "colleague", at: "2026-10-16T22:00:00Z" });
    return true;
  });
  assert.equal(calls.some((c) => c.method === "PATCH"), false);
});

test("refuses paths outside the pre-owned folders", async () => {
  route = repo({ heads: ["base"] });
  assert.equal(isWritable(".github/workflows/pages.yml"), false);
  assert.equal(isWritable("content/pre-owned/../x.md"), false);
  await assert.rejects(publish([{ path: "src/app/page.tsx", content: "x" }], "m", { baseSha: "base" }));
  assert.equal(calls.length, 0);
});

test("HTTP errors map to codes", async () => {
  for (const [status, code] of [[401, "unauthorized"], [403, "forbidden"], [404, "forbidden"]] as const) {
    route = () => json(status, { message: "x" });
    await assert.rejects(loadAll(), { code });
  }
  globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  await assert.rejects(loadAll(), { code: "offline" });
});
