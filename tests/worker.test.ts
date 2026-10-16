import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AdminApiError, errorCode } from "../src/lib/admin/types";
import { MAX_BODY_BYTES, assetUrl, bytesToBase64, loadAll, parseResponse, publish, status, toWire } from "../src/lib/admin/worker";

const json = (status: number, body: unknown, extra: Record<string, unknown> = {}) => ({
  status,
  contentType: "application/json; charset=utf-8",
  text: JSON.stringify(body),
  ...extra,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return errorCode(e);
  }
  return "none";
};

describe("parseResponse", () => {
  it("returns JSON on 2xx", () => {
    assert.deepEqual(parseResponse(json(200, { canWrite: true })), { canWrite: true });
  });
  it("maps Worker error codes", () => {
    for (const c of ["conflict", "retry_exhausted", "forbidden", "access_expired", "credential_invalid"])
      assert.equal(code(() => parseResponse(json(c === "conflict" ? 409 : 403, { code: c, message: "x" }))), c);
  });
  it("keeps conflict details", () => {
    try {
      parseResponse(json(409, { code: "conflict", message: "changed", details: { paths: ["content/pre-owned/a.md"], by: "bob" } }));
      assert.fail();
    } catch (e) {
      assert.ok(e instanceof AdminApiError);
      assert.deepEqual(e.details, { paths: ["content/pre-owned/a.md"], by: "bob" });
    }
  });
  it("treats Access redirects / HTML / bare 401-403 as access_expired", () => {
    assert.equal(code(() => parseResponse({ status: 0, type: "opaqueredirect", text: "" })), "access_expired");
    assert.equal(code(() => parseResponse({ status: 200, redirected: true, contentType: "text/html", text: "<html>" })), "access_expired");
    assert.equal(code(() => parseResponse({ status: 200, contentType: "text/html", text: "<html>login</html>" })), "access_expired");
    assert.equal(code(() => parseResponse({ status: 403, contentType: "text/html", text: "Forbidden" })), "access_expired");
    assert.equal(code(() => parseResponse({ status: 401, contentType: null, text: "" })), "access_expired");
  });
  it("unknown codes and 404 are plain errors with a message", () => {
    assert.equal(code(() => parseResponse(json(500, { code: "boom", message: "kaput" }))), "unknown");
    assert.throws(() => parseResponse({ status: 404, contentType: "text/html", text: "<html>" }), /Worker deployed/);
  });
});

describe("encoding", () => {
  it("base64 matches Buffer for large inputs", () => {
    const b = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    assert.equal(bytesToBase64(b), Buffer.from(b).toString("base64"));
  });
  it("wire files", async () => {
    assert.deepEqual(await toWire({ path: "a.md", content: "£1" }), { path: "a.md", content: "£1", encoding: "utf-8" });
    assert.deepEqual(await toWire({ path: "x", content: null }), { path: "x", content: null });
    assert.deepEqual(await toWire({ path: "p.webp", content: new Blob([new Uint8Array([1, 2, 3])]) }), {
      path: "p.webp",
      content: "AQID",
      encoding: "base64",
    });
  });
});

describe("client against a mocked Worker", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const calls: { url: string; init?: RequestInit }[] = [];
  const mock = (handler: (url: string, init?: RequestInit) => Response) => {
    calls.length = 0;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return handler(url, init);
    }) as typeof fetch;
  };
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("status + bikes hit /admin-api with credentials and no redirects", async () => {
    mock((url) => (url.endsWith("/status") ? ok({ canWrite: true, expiresAt: "2026-12-01T00:00:00Z" }) : ok({ cars: [], headSha: "abc123" })));
    assert.deepEqual(await status(), { canWrite: true, expiresAt: "2026-12-01T00:00:00Z" });
    assert.deepEqual(await loadAll(), { cars: [], headSha: "abc123" });
    assert.equal(calls[0].url, "/admin-api/status");
    assert.equal(calls[1].url, "/admin-api/bikes");
    assert.equal(calls[0].init?.credentials, "include");
    assert.equal(calls[0].init?.redirect, "manual");
    assert.equal(assetUrl("/uploads/pre-owned/a.webp"), "https://raw.githubusercontent.com/UKSEV-CO-UK/uksev-website/abc123/public/uploads/pre-owned/a.webp");
  });

  it("publish posts the contract body and reports stages", async () => {
    mock(() => ok({ commitSha: "def456" }));
    const stages: string[] = [];
    const r = await publish(
      [
        { path: "content/pre-owned/a.md", content: "---\nbrand: A\n---\n" },
        { path: "public/uploads/pre-owned/a-1.webp", content: new Blob([new Uint8Array([255, 0])]) },
        { path: "public/uploads/pre-owned/old.webp", content: null },
      ],
      "pre-owned: add A",
      { baseSha: "abc123", onProgress: (p) => stages.push(p.stage) },
    );
    assert.equal(r.commitSha, "def456");
    assert.equal(calls[0].url, "/admin-api/publish");
    assert.equal(calls[0].init?.method, "POST");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.baseSha, "abc123");
    assert.equal(body.message, "pre-owned: add A");
    assert.deepEqual(body.files[1], { path: "public/uploads/pre-owned/a-1.webp", content: "/wA=", encoding: "base64" });
    assert.deepEqual(body.files[2], { path: "public/uploads/pre-owned/old.webp", content: null });
    assert.deepEqual([stages[0], stages.at(-2), stages.at(-1)], ["blobs", "commit", "done"]);
  });

  it("publish refuses bodies over the limit before sending", async () => {
    mock(() => ok({ commitSha: "x" }));
    const big = new Blob([new Uint8Array(Math.ceil(MAX_BODY_BYTES * 0.8))]);
    await assert.rejects(publish([{ path: "public/uploads/pre-owned/big.webp", content: big }], "m", { baseSha: "a" }), (e) => errorCode(e) === "too_large");
    assert.equal(calls.length, 0);
  });

  it("network failure is offline unless the probe shows an Access redirect", async () => {
    mock(() => {
      throw new TypeError("Failed to fetch");
    });
    await assert.rejects(status(), (e) => errorCode(e) === "offline");
    let n = 0;
    mock(() => {
      if (n++ === 0) throw new TypeError("Failed to fetch");
      return new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } });
    });
    await assert.rejects(loadAll(), (e) => errorCode(e) === "access_expired");
  });
});
