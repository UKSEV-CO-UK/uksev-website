import { test } from "node:test";
import assert from "node:assert/strict";
import { planFile, priceFromFor } from "../scripts/migrate-price-from";

test("priceFromFor: exact money(price) or From + money(price); anything else is a mismatch", () => {
  assert.equal(priceFromFor("£1,099", 1099), false);
  assert.equal(priceFromFor("From £1,099", 1099), true);
  assert.equal(priceFromFor("From £1,199", 1099), null);
  assert.equal(priceFromFor("£1099", 1099), null);
  assert.equal(priceFromFor("from £1,099", 1099), null);
  assert.equal(priceFromFor("From £1,099", "1099"), null);
});

const file = (label: string) =>
  `---\n# header\ntype: e-bike\nbrand: ADO\nmodel: X\nprice: 1099\npriceLabel: ${label}\nwasPrice: 1299\nphotos:\n  - src: /uploads/new/x/cover.jpg\n---\nBody\n`;

test("planFile replaces the priceLabel line in place and keeps every other byte", () => {
  const from = planFile("x.md", file("From £1,099"));
  assert.ok("text" in from && from.action === "from");
  assert.equal(from.text, file("From £1,099").replace("priceLabel: From £1,099", "priceFrom: true"));

  const plain = planFile("x.md", file("'£1,099'"));
  assert.ok("text" in plain && plain.action === "drop");
  assert.equal(plain.text, file("'£1,099'").replace("priceLabel: '£1,099'\n", ""));

  assert.deepEqual(planFile("x.md", plain.text), { file: "x.md", action: "none" });
});

test("planFile reports a mismatch instead of guessing", () => {
  const m = planFile("x.md", file("From £999"));
  assert.ok("expected" in m);
  assert.deepEqual(m.expected, ["£1,099", "From £1,099"]);
});
