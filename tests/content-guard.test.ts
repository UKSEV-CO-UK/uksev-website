import { test } from "node:test";
import assert from "node:assert/strict";
import {
  friendlySchemaMessage,
  isAllowedPath,
  pathViolationMessage,
  photoOversizeMessage,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_MB,
} from "../scripts/content-guard-lib";

test("allowed paths", () => {
  assert.equal(isAllowedPath("content/pre-owned/foo.md"), true);
  assert.equal(isAllowedPath("public/uploads/pre-owned/x.webp"), true);
  assert.equal(isAllowedPath("content/pre-owned"), true);
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
