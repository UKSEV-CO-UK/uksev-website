import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AdminApiError, errorCode } from "../src/lib/admin/types";
import { assetUrl, loadAll, parseResponse, pool, publish, status } from "../src/lib/admin/worker";

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

describe("pool", () => {
  it("keeps order and caps concurrency", async () => {
    let live = 0;
    let peak = 0;
    const r = await pool([1, 2, 3, 4, 5], 2, async (x) => {
      peak = Math.max(peak, ++live);
      await new Promise((ok) => setTimeout(ok, 5));
      live--;
      return x * 10;
    });
    assert.deepEqual(r, [10, 20, 30, 40, 50]);
    assert.equal(peak, 2);
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

  it("publish uploads each image to /blobs, then commits with blobSha refs", async () => {
    let n = 0;
    mock((url, init) => {
      if (url.endsWith("/blobs")) {
        assert.equal(init?.method, "POST");
        assert.ok(init?.body instanceof Blob);
        return ok({ sha: `blob${++n}` });
      }
      return ok({ commitSha: "def456" });
    });
    const img1 = new Blob([new Uint8Array([255, 0])], { type: "image/webp" });
    const img2 = new Blob([new Uint8Array([1])], { type: "image/webp" });
    const files = [
      { path: "content/pre-owned/a.md", content: "---\nbrand: A\n---\n" },
      { path: "public/uploads/pre-owned/a-1.webp", content: img1 },
      { path: "public/uploads/pre-owned/a-2.webp", content: img2 },
      { path: "public/uploads/pre-owned/old.webp", content: null },
    ];
    const stages: string[] = [];
    const r = await publish(files, "pre-owned: add A", { baseSha: "abc123", onProgress: (p) => stages.push(`${p.stage}:${p.done}/${p.total}`) });
    assert.equal(r.commitSha, "def456");
    const blobCalls = calls.filter((c) => c.url === "/admin-api/blobs");
    assert.equal(blobCalls.length, 2);
    assert.equal((blobCalls[0].init?.headers as Record<string, string>)["content-type"], "image/webp");
    const pub = calls.find((c) => c.url === "/admin-api/publish")!;
    const body = JSON.parse(String(pub.init?.body));
    assert.equal(body.baseSha, "abc123");
    assert.deepEqual(body.files, [
      { path: "content/pre-owned/a.md", content: "---\nbrand: A\n---\n" },
      { path: "public/uploads/pre-owned/a-1.webp", blobSha: "blob1" },
      { path: "public/uploads/pre-owned/a-2.webp", blobSha: "blob2" },
      { path: "public/uploads/pre-owned/old.webp", content: null },
    ]);
    assert.deepEqual(stages, ["blobs:0/2", "blobs:1/2", "blobs:2/2", "commit:0/1", "done:1/1"]);

    // Conflict, then retry: the images are not uploaded again.
    mock((url) =>
      url.endsWith("/blobs")
        ? ok({ sha: "never" })
        : new Response(JSON.stringify({ code: "conflict", message: "changed", details: { paths: ["content/pre-owned/a.md"] } }), {
            status: 409,
            headers: { "content-type": "application/json" },
          }),
    );
    await assert.rejects(publish(files, "again", { baseSha: "abc123" }), (e) => errorCode(e) === "conflict");
    assert.equal(calls.filter((c) => c.url === "/admin-api/blobs").length, 0);
  });

  it("a failed blob upload stops before /publish", async () => {
    mock((url) =>
      url.endsWith("/blobs")
        ? new Response(JSON.stringify({ code: "credential_invalid", message: "Bad credentials" }), { status: 502, headers: { "content-type": "application/json" } })
        : ok({ commitSha: "x" }),
    );
    await assert.rejects(
      publish([{ path: "public/uploads/pre-owned/z.webp", content: new Blob([new Uint8Array([9])]) }], "m", { baseSha: "a" }),
      (e) => errorCode(e) === "credential_invalid",
    );
    assert.equal(calls.filter((c) => c.url === "/admin-api/publish").length, 0);
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
