import { test } from "node:test";
import assert from "node:assert/strict";
import {
  friendlySchemaMessage,
  isAllowedPath,
  pathViolationMessage,
  photoOversizeMessage,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_MB,
  checkListingFile,
} from "../scripts/content-guard-lib";

test("allowed paths", () => {
  assert.equal(isAllowedPath("content/pre-owned/foo.md"), true);
  assert.equal(isAllowedPath("public/uploads/pre-owned/x.webp"), true);
  assert.equal(isAllowedPath("content/pre-owned"), true);
  assert.equal(isAllowedPath("content/new/fiido-c21.md"), true);
  assert.equal(isAllowedPath("public/uploads/new/fiido-c21-grey.webp"), true);
  assert.equal(isAllowedPath("content/newer/x.md"), false);
  assert.equal(isAllowedPath("README.md"), false);
  assert.equal(isAllowedPath("src/lib/preowned.ts"), false);
  assert.equal(isAllowedPath("content/other/x.md"), false);
  assert.equal(isAllowedPath("public/uploads/other/x.webp"), false);
  assert.equal(isAllowedPath(".github/workflows/ci.yml"), false);
});

test("friendly missing fields", () => {
  assert.equal(
    friendlySchemaMessage({ field: "price", message: 'missing required "price"' }),
    "Price is missing",
  );
  assert.equal(
    friendlySchemaMessage({ field: "photos", message: 'missing required "photos (at least one)"' }),
    "At least one photo is required",
  );
  assert.equal(
    friendlySchemaMessage({ field: "brand", message: 'missing required "brand"' }),
    "Brand is missing",
  );
});

test("photo oversize message", () => {
  const size = MAX_PHOTO_BYTES + 100_000;
  assert.match(photoOversizeMessage(3, size), new RegExp(`Photo 3 is over ${MAX_PHOTO_MB} MB`));
  assert.match(photoOversizeMessage(null, size), new RegExp(`This photo is over ${MAX_PHOTO_MB} MB`));
});

test("path violation names the file", () => {
  const msg = pathViolationMessage("src/evil.ts");
  assert.match(msg, /src\/evil\.ts/);
  assert.match(msg, /content\/pre-owned/);
});

test("new-bike listing is checked with the new-bike schema", () => {
  assert.deepEqual(checkListingFile("content/new/fiido-c21.md"), []);
});

test("new-bike listing with was price below price fails", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-"));
  fs.mkdirSync(path.join(dir, "content/new"), { recursive: true });
  fs.mkdirSync(path.join(dir, "public/uploads/new"), { recursive: true });
  fs.writeFileSync(path.join(dir, "public/uploads/new/a.webp"), "x");
  fs.writeFileSync(
    path.join(dir, "content/new/a.md"),
    "---\nbrand: FIIDO\nmodel: X\nprice: 1000\nwasPrice: 900\ncolours:\n  - name: Grey\n    photos:\n      - src: /uploads/new/a.webp\n---\n",
  );
  const anns = checkListingFile("content/new/a.md", { cwd: dir });
  assert.ok(anns.some((a) => /Was price must be higher than Price/.test(a.message)));
});

test("new-bike hidden flag and legacy stock keys", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cg-"));
  fs.mkdirSync(path.join(dir, "content/new"), { recursive: true });
  fs.mkdirSync(path.join(dir, "public/uploads/new"), { recursive: true });
  fs.writeFileSync(path.join(dir, "public/uploads/new/a.webp"), "x");
  const base =
    "brand: FIIDO\nmodel: X\nprice: 1000\ncolours:\n  - name: Grey\n    photos:\n      - src: /uploads/new/a.webp\n";
  const write = (name: string, extra: string) =>
    fs.writeFileSync(path.join(dir, `content/new/${name}.md`), `---\n${base}${extra}---\n`);

  write("hidden", "hidden: true\n");
  assert.deepEqual(checkListingFile("content/new/hidden.md", { cwd: dir }), []);

  // The old stock keys are rejected so they cannot linger in content.
  write("legacy", "availability: arriving\narrival: December\n");
  const legacy = checkListingFile("content/new/legacy.md", { cwd: dir });
  assert.equal(legacy.length, 2);
  assert.match(legacy[0].message, /availability/);
  assert.match(legacy[1].message, /arrival/);

  write("bad", "hidden: maybe\n");
  const anns = checkListingFile("content/new/bad.md", { cwd: dir });
  assert.equal(anns.length, 1);
  assert.match(anns[0].message, /Hidden|hidden/);
});
