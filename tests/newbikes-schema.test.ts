import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseNewBike, validateNewBike } from "../src/lib/newbikes-schema";

const good = {
  brand: "FIIDO",
  model: "C21",
  price: 999,
  wasPrice: 1635,
  colours: [
    { name: "Grey", swatch: "#5c5f63", photos: [{ src: "/uploads/new/fiido-c21-grey.webp" }] },
  ],
};

test("complete listing passes", () => {
  const r = validateNewBike(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("each required field blocks publishing", () => {
  for (const k of ["brand", "model", "price"] as const) {
    const d: Record<string, unknown> = { ...good };
    delete d[k];
    const r = validateNewBike(d);
    assert.equal(r.ok, false, k);
    assert.equal(r.errors[0].field, k);
  }
  const r = validateNewBike({ ...good, colours: [] });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].field, "colours");
});

test("wasPrice is optional, but must be higher than price when set", () => {
  assert.equal(validateNewBike({ ...good, wasPrice: undefined }).ok, true);
  const { wasPrice: _w, ...noWas } = good;
  void _w;
  assert.equal(validateNewBike(noWas).ok, true);
  assert.equal(validateNewBike({ ...good, wasPrice: 999 }).ok, false);
  assert.equal(validateNewBike({ ...good, wasPrice: 500 }).ok, false);
  const r = normaliseNewBike({ ...good, wasPrice: 1635 });
  assert.equal(r.bike.wasPrice, 1635);
});

test("availability defaults to check; arriving needs arrival text", () => {
  assert.equal(normaliseNewBike(good).bike.availability, "check");
  assert.equal(validateNewBike({ ...good, availability: "in-stock" }).ok, true);
  assert.equal(validateNewBike({ ...good, availability: "arriving" }).ok, false);
  assert.equal(
    validateNewBike({ ...good, availability: "arriving", arrival: "Dec 2026" }).ok,
    true,
  );
  assert.equal(validateNewBike({ ...good, availability: "maybe" }).ok, false);
});

test("photo paths: prefix, leading slash, no .., existence hook", () => {
  assert.equal(
    validateNewBike({
      ...good,
      colours: [{ name: "Grey", photos: ["uploads/new/x.webp"] }],
    }).ok,
    false,
  );
  assert.equal(
    validateNewBike({
      ...good,
      colours: [{ name: "Grey", photos: ["/uploads/new/../x.webp"] }],
    }).ok,
    false,
  );
  assert.equal(
    validateNewBike({
      ...good,
      colours: [{ name: "Grey", photos: ["/uploads/pre-owned/a.webp"] }],
    }).ok,
    false,
  );
  const exists = (s: string) => s === "/uploads/new/fiido-c21-grey.webp";
  assert.equal(validateNewBike(good, { photoExists: exists }).ok, true);
  assert.equal(
    validateNewBike(
      { ...good, colours: [{ name: "Grey", photos: ["/uploads/new/missing.webp"] }] },
      { photoExists: exists },
    ).ok,
    false,
  );
});

test("type defaults to e-bike", () => {
  assert.equal(normaliseNewBike(good).bike.type, "e-bike");
  assert.equal(normaliseNewBike({ ...good, type: "e-scooter" }).bike.type, "e-scooter");
  assert.equal(validateNewBike({ ...good, type: "car" }).ok, false);
});

test("a single src on a colour is accepted as its only photo", () => {
  const r = normaliseNewBike({
    ...good,
    colours: [{ name: "Grey", src: "/uploads/new/fiido-c21-grey.webp" }],
  });
  assert.equal(r.errors.length, 0);
  assert.equal(r.bike.colours[0].photos[0].src, "/uploads/new/fiido-c21-grey.webp");
});
