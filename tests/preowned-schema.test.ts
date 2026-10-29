import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseBike, validateBike } from "../src/lib/preowned-schema";

const now = new Date("2026-10-16T12:00:00Z");
const good = {
  brand: "DYU",
  model: "C6 City",
  year: 2023,
  mileage: 1240,
  price: 695,
  batteryHealth: 92,
  photos: [{ src: "/uploads/pre-owned/a.webp" }],
};

test("complete listing passes", () => {
  const r = validateBike(good, { now });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("each required field blocks publishing", () => {
  for (const k of ["brand", "model", "year", "mileage", "price"] as const) {
    const d: Record<string, unknown> = { ...good };
    delete d[k];
    const r = validateBike(d, { now });
    assert.equal(r.ok, false, k);
    assert.equal(r.errors[0].field, k);
  }
  const r = validateBike({ ...good, photos: [] }, { now });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, "photos");
});

test("missing battery reading is only a warning", () => {
  const { batteryHealth: _b, ...d } = good;
  void _b;
  const r = validateBike(d, { now });
  assert.equal(r.ok, true);
  assert.equal(r.warnings[0].field, "batteryHealth");
  assert.equal(validateBike({ ...d, chargeCycles: 40 }, { now }).warnings.length, 0);
});

test("ranges and enums", () => {
  assert.equal(validateBike({ ...good, year: 2028 }, { now }).ok, false);
  assert.equal(validateBike({ ...good, year: 2027 }, { now }).ok, true);
  assert.equal(validateBike({ ...good, batteryHealth: 101 }, { now }).ok, false);
  assert.equal(validateBike({ ...good, price: "£1,095" }, { now }).ok, true);
  assert.equal(validateBike({ ...good, grade: "D" }, { now }).ok, false);
  assert.equal(validateBike({ ...good, status: "gone" }, { now }).ok, false);
  assert.equal(validateBike({ ...good, soldDate: "8 Oct" }, { now }).ok, false);
  assert.equal(validateBike({ ...good, soldDate: new Date("2026-10-08") }, { now }).ok, true);
});

test("type defaults to e-bike; admin can require it", () => {
  assert.equal(normaliseBike(good, { now }).bike.type, "e-bike");
  assert.equal(normaliseBike({ ...good, type: "e-scooter" }, { now }).bike.type, "e-scooter");
  assert.equal(validateBike({ ...good, type: "car" }, { now }).ok, false);
  const r = validateBike(good, { now, requireType: true });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, "type");
});

test("photo paths: leading slash, no .., existence hook", () => {
  assert.equal(validateBike({ ...good, photos: ["uploads/x.webp"] }, { now }).ok, false);
  assert.equal(validateBike({ ...good, photos: ["/uploads/../x.webp"] }, { now }).ok, false);
  const exists = (s: string) => s === "/uploads/pre-owned/a.webp";
  assert.equal(validateBike(good, { now, photoExists: exists }).ok, true);
  assert.equal(validateBike({ ...good, photos: ["/uploads/pre-owned/b.webp"] }, { now, photoExists: exists }).ok, false);
});

test("bad inspection rows are dropped, included defaults to true", () => {
  const r = normaliseBike(
    {
      ...good,
      inspection: [{ item: "Brakes", result: "pass" }, { item: "Frame", result: "maybe" }],
      included: ["Charger", { item: "Box", included: false }, { text: "no item" }],
    },
    { now },
  );
  assert.equal(r.bike.inspection.length, 1);
  assert.equal(r.warnings.length, 2);
  assert.deepEqual(r.bike.included, [
    { item: "Charger", text: undefined, included: true },
    { item: "Box", text: undefined, included: false },
  ]);
});

test("frontmatter round-trips through gray-matter (the build parser)", async () => {
  const matter = (await import("gray-matter")).default;
  const data = {
    ...good,
    type: "e-scooter",
    model: 'C6 "City" 26″: #1',
    wheelSize: "26″",
    soldDate: "2026-10-08",
    status: "sold",
    included: [{ item: "Charger", text: "42V", included: true }],
    inspection: [{ item: "Brakes", result: "pass" }],
  };
  // Empty optional fields are omitted by writers; colour absent here matches that.
  const md = matter.stringify("Line one\n\n**bold**\n", data);
  const parsed = matter(md);
  const r = validateBike(parsed.data, { now });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const n = normaliseBike(parsed.data, { now }).bike;
  assert.equal(n.model, data.model);
  assert.equal(n.soldDate, "2026-10-08");
  assert.equal(n.type, "e-scooter");
  assert.equal(parsed.content.trim(), "Line one\n\n**bold**");
});
