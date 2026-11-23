import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEW_BIKE_ERROR_CODES,
  normaliseNewBike,
  validateNewBike,
  type NewBikeErrorCode,
} from "../src/lib/newbikes-schema";
import { formatArrivalMonth, stockLabel } from "../src/lib/newbikes-types";

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

test("availability defaults to check; arriving needs a YYYY-MM arrival", () => {
  assert.equal(normaliseNewBike(good).bike.availability, "check");
  assert.equal(validateNewBike({ ...good, availability: "in-stock" }).ok, true);
  assert.equal(validateNewBike({ ...good, availability: "arriving" }).ok, false);
  assert.equal(
    validateNewBike({ ...good, availability: "arriving", arrival: "2026-12" }).ok,
    true,
  );
  assert.equal(validateNewBike({ ...good, availability: "maybe" }).ok, false);
});

test("arrival must be YYYY-MM when present", () => {
  assert.equal(validateNewBike({ ...good, arrival: "2026-12" }).ok, true);
  assert.equal(validateNewBike({ ...good, arrival: "2026-01" }).ok, true);
  assert.equal(normaliseNewBike({ ...good, arrival: "2026-12" }).bike.arrival, "2026-12");

  for (const arrival of ["December", "soon", "2026-13", "2026-00", "2026-12-01", "Dec 2026"]) {
    const r = validateNewBike({ ...good, arrival });
    assert.equal(r.ok, false, arrival);
    assert.equal(r.errors[0].field, "arrival", arrival);
  }

  const arrivingBad = validateNewBike({ ...good, availability: "arriving", arrival: "December" });
  assert.equal(arrivingBad.ok, false);
  assert.equal(arrivingBad.errors.length, 1);
  assert.equal(arrivingBad.errors[0].field, "arrival");
  assert.match(arrivingBad.errors[0].message, /2026-12/);
});

test("stockLabel formats YYYY-MM as an en-GB short month", () => {
  assert.equal(formatArrivalMonth("2026-12"), "Dec 2026");
  assert.equal(formatArrivalMonth("2026-01"), "Jan 2026");
  assert.equal(
    stockLabel({ availability: "arriving", arrival: "2026-12" }),
    "Arriving Dec 2026",
  );
  assert.equal(
    stockLabel({ availability: "arriving", arrival: "2026-01" }),
    "Arriving Jan 2026",
  );
  assert.equal(stockLabel({ availability: "arriving" }), "Arriving");
  assert.equal(stockLabel({ availability: "check", arrival: "2026-12" }), "Dec 2026");
  assert.equal(stockLabel({ availability: "in-stock" }), "UK stock");
  assert.equal(stockLabel({ availability: "check" }), "Check stock");
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


const CODE_SET = new Set<string>(NEW_BIKE_ERROR_CODES);

function assertCoded(errors: { field: string; message: string; code?: string }[]) {
  assert.ok(errors.length > 0, "expected at least one error");
  for (const e of errors) {
    assert.equal(typeof e.field, "string", JSON.stringify(e));
    assert.equal(typeof e.message, "string", JSON.stringify(e));
    assert.ok(e.code, `missing code on ${e.field}: ${e.message}`);
    assert.ok(CODE_SET.has(e.code!), `unknown code ${e.code} on ${e.field}`);
  }
}

test("NEW_BIKE_ERROR_CODES has unique entries and matches the exported union length", () => {
  assert.equal(new Set(NEW_BIKE_ERROR_CODES).size, NEW_BIKE_ERROR_CODES.length);
  assert.equal(NEW_BIKE_ERROR_CODES.length, 36);
});

test("every emitted error has a stable code; field and message stay the same", () => {
  const missingBrand = validateNewBike({ ...good, brand: undefined });
  assert.equal(missingBrand.ok, false);
  assert.equal(missingBrand.errors[0].field, "brand");
  assert.equal(missingBrand.errors[0].message, 'missing required "brand"');
  assert.equal(missingBrand.errors[0].code, "brand_missing");

  const badWas = validateNewBike({ ...good, wasPrice: 500 });
  assert.equal(badWas.errors[0].field, "wasPrice");
  assert.equal(badWas.errors[0].message, "Was price must be higher than Price");
  assert.equal(badWas.errors[0].code, "was_price_not_higher");

  const arriving = validateNewBike({ ...good, availability: "arriving" });
  assert.equal(arriving.errors[0].field, "arrival");
  assert.equal(arriving.errors[0].message, '"arrival" is required when availability is "arriving"');
  assert.equal(arriving.errors[0].code, "arrival_required");

  const badMonth = validateNewBike({ ...good, arrival: "December" });
  assert.equal(badMonth.errors[0].field, "arrival");
  assert.equal(badMonth.errors[0].message, '"arrival" must be a month like 2026-12');
  assert.equal(badMonth.errors[0].code, "arrival_format");
});

test("edition wasPrice errors are distinct from a missing edition price", () => {
  const missingPrice = validateNewBike({
    ...good,
    editions: [
      { name: "Standard", price: 999 },
      { name: "Extender" },
    ],
  });
  assert.equal(missingPrice.ok, false);
  assert.equal(missingPrice.errors[0].field, "editions[1]");
  assert.equal(missingPrice.errors[0].message, "editions[1] needs a name and a price in range");
  assert.equal(missingPrice.errors[0].code, "edition_price_missing");

  const emptyPrice = validateNewBike({
    ...good,
    editions: [{ name: "Standard", price: "" }],
  });
  assert.equal(emptyPrice.errors[0].field, "editions[0]");
  assert.equal(emptyPrice.errors[0].code, "edition_price_missing");

  const unreadable = validateNewBike({
    ...good,
    editions: [
      { name: "Standard", price: 999 },
      { name: "Extender", price: "abc" },
    ],
  });
  assert.equal(unreadable.errors[0].field, "editions[1]");
  assert.equal(unreadable.errors[0].message, "editions[1] needs a name and a price in range");
  assert.equal(unreadable.errors[0].code, "edition_invalid");

  const zeroPrice = validateNewBike({
    ...good,
    editions: [{ name: "Standard", price: 0 }],
  });
  assert.equal(zeroPrice.ok, false);
  assert.equal(zeroPrice.errors[0].field, "editions[0]");
  assert.equal(zeroPrice.errors[0].message, "editions[0] price must be more than 0");
  assert.equal(zeroPrice.errors[0].code, "edition_price_zero");

  const notHigher = validateNewBike({
    ...good,
    editions: [
      { name: "Standard", price: 999 },
      { name: "Extender", price: 1290, wasPrice: 1290 },
    ],
  });
  assert.equal(notHigher.ok, false);
  assert.equal(notHigher.errors[0].field, "editions[1]");
  assert.equal(notHigher.errors[0].message, "editions[1].wasPrice must be higher than price");
  assert.equal(notHigher.errors[0].code, "edition_was_price_not_higher");

  const badWas = validateNewBike({
    ...good,
    editions: [{ name: "Standard", price: 999, wasPrice: "nope" }],
  });
  assert.equal(badWas.errors[0].field, "editions[0]");
  assert.equal(badWas.errors[0].message, "editions[0].wasPrice must be a number 0–100000");
  assert.equal(badWas.errors[0].code, "edition_was_price_invalid");
});

test("price of 0 cannot be published, including 0 written as text", () => {
  for (const price of [0, "0", "£0"]) {
    const r = validateNewBike({ ...good, price });
    assert.equal(r.ok, false, String(price));
    assert.equal(r.errors[0].field, "price", String(price));
    assert.equal(r.errors[0].message, "Price must be more than 0", String(price));
    assert.equal(r.errors[0].code, "price_zero", String(price));
  }
  for (const price of [0, "0", "£0"]) {
    const r = validateNewBike({
      ...good,
      editions: [
        { name: "Standard", price: 999 },
        { name: "Extender", price },
      ],
    });
    assert.equal(r.ok, false, String(price));
    assert.equal(r.errors[0].field, "editions[1]", String(price));
    assert.equal(r.errors[0].message, "editions[1] price must be more than 0", String(price));
    assert.equal(r.errors[0].code, "edition_price_zero", String(price));
  }
  assert.equal(validateNewBike({ ...good, price: 1 }).ok, true);
  assert.equal(
    validateNewBike({ ...good, editions: [{ name: "Standard", price: 1 }] }).ok,
    true,
  );
});

test("colour photo missing is distinct from colour name missing", () => {
  const noName = validateNewBike({
    ...good,
    colours: [{ name: "", photos: [{ src: "/uploads/new/fiido-c21-grey.webp" }] }],
  });
  assert.equal(noName.errors[0].field, "colours[0]");
  assert.equal(noName.errors[0].message, "colours[0].name is missing");
  assert.equal(noName.errors[0].code, "colour_name_missing");

  const noPhoto = validateNewBike({
    ...good,
    colours: [{ name: "Grey", photos: [] }],
  });
  assert.equal(noPhoto.errors[0].field, "colours[0]");
  assert.equal(noPhoto.errors[0].message, "colours[0] needs at least one photo");
  assert.equal(noPhoto.errors[0].code, "colour_photo_missing");
});

test("each new-bike error code is emitted with the expected field", () => {
  const exists = (s: string) => s === "/uploads/new/fiido-c21-grey.webp";
  const cases: { code: NewBikeErrorCode; field: string; data: Record<string, unknown>; opts?: { photoExists?: (s: string) => boolean } }[] = [
    { code: "brand_missing", field: "brand", data: { ...good, brand: "" } },
    { code: "model_missing", field: "model", data: { ...good, model: undefined } },
    { code: "price_missing", field: "price", data: { ...good, price: undefined } },
    { code: "price_invalid", field: "price", data: { ...good, price: -1 } },
    { code: "price_zero", field: "price", data: { ...good, price: 0 } },
    { code: "was_price_invalid", field: "wasPrice", data: { ...good, wasPrice: "nope" } },
    { code: "was_price_not_higher", field: "wasPrice", data: { ...good, wasPrice: 999 } },
    { code: "colours_missing", field: "colours", data: { ...good, colours: [] } },
    { code: "colour_invalid", field: "colours[0]", data: { ...good, colours: ["Grey"] } },
    { code: "colour_name_missing", field: "colours[0]", data: { ...good, colours: [{ photos: ["/uploads/new/x.webp"] }] } },
    { code: "colour_swatch_invalid", field: "colours[0]", data: { ...good, colours: [{ name: "Grey", swatch: "grey", photos: ["/uploads/new/fiido-c21-grey.webp"] }] } },
    { code: "colour_photo_missing", field: "colours[0]", data: { ...good, colours: [{ name: "Grey" }] } },
    { code: "photo_src_invalid", field: "colours[0].photos[0]", data: { ...good, colours: [{ name: "Grey", photos: ["uploads/new/x.webp"] }] } },
    {
      code: "photo_not_found",
      field: "colours[0].photos[0]",
      data: { ...good, colours: [{ name: "Grey", photos: ["/uploads/new/missing.webp"] }] },
      opts: { photoExists: exists },
    },
    { code: "arrival_format", field: "arrival", data: { ...good, arrival: "2026-13" } },
    { code: "arrival_required", field: "arrival", data: { ...good, availability: "arriving" } },
    { code: "availability_invalid", field: "availability", data: { ...good, availability: "maybe" } },
    { code: "range_km_invalid", field: "rangeKm", data: { ...good, rangeKm: 0 } },
    { code: "range_miles_invalid", field: "rangeMiles", data: { ...good, rangeMiles: 0 } },
    { code: "weight_kg_invalid", field: "weightKg", data: { ...good, weightKg: 0 } },
    { code: "top_speed_invalid", field: "topSpeedKmh", data: { ...good, topSpeedKmh: 0 } },
    { code: "battery_wh_invalid", field: "batteryWh", data: { ...good, batteryWh: 1 } },
    { code: "battery_invalid", field: "battery", data: { ...good, battery: { label: "36V" } } },
    { code: "motor_w_invalid", field: "motorW", data: { ...good, motorW: 1 } },
    { code: "spec_row_invalid", field: "specs[0]", data: { ...good, specs: [{ label: "Motor" }] } },
    { code: "size_invalid", field: "sizes[0]", data: { ...good, sizes: [{ name: "" }] } },
    { code: "edition_invalid", field: "editions[0]", data: { ...good, editions: [{ name: "Standard", price: "abc" }] } },
    { code: "edition_price_missing", field: "editions[1]", data: { ...good, editions: [{ name: "Standard", price: 999 }, { name: "Extender" }] } },
    { code: "edition_price_zero", field: "editions[1]", data: { ...good, editions: [{ name: "Standard", price: 999 }, { name: "Extender", price: 0 }] } },
    { code: "edition_was_price_invalid", field: "editions[0]", data: { ...good, editions: [{ name: "Standard", price: 999, wasPrice: -1 }] } },
    { code: "edition_was_price_not_higher", field: "editions[1]", data: { ...good, editions: [{ name: "S", price: 999 }, { name: "E", price: 1290, wasPrice: 1000 }] } },
    { code: "edition_range_invalid", field: "editions[0]", data: { ...good, editions: [{ name: "Standard", price: 999, rangeKm: 0 }] } },
    { code: "type_invalid", field: "type", data: { ...good, type: "car" } },
    { code: "date_invalid", field: "date", data: { ...good, date: "09/10/2026" } },
    { code: "text_invalid", field: "brand", data: { ...good, brand: { n: "FIIDO" } } },
    { code: "list_invalid", field: "sizes", data: { ...good, sizes: "M" } },
  ];

  const seen = new Set<string>();
  for (const c of cases) {
    const r = validateNewBike(c.data, c.opts);
    assert.equal(r.ok, false, c.code);
    assertCoded(r.errors);
    const hit = r.errors.find((e) => e.code === c.code);
    assert.ok(hit, `expected code ${c.code}, got ${r.errors.map((e) => e.code).join(",")}`);
    assert.equal(hit!.field, c.field, c.code);
    seen.add(c.code);
  }
  assert.deepEqual([...NEW_BIKE_ERROR_CODES].sort(), [...seen].sort());
});

test("list_invalid also applies to editions and specs; photo path variants share photo_src_invalid", () => {
  const editions = validateNewBike({ ...good, editions: { name: "Standard", price: 999 } });
  assert.equal(editions.errors[0].code, "list_invalid");
  assert.equal(editions.errors[0].field, "editions");
  assert.equal(editions.errors[0].message, '"editions" must be a list');

  const specs = validateNewBike({ ...good, specs: { label: "Motor", value: "250W" } });
  assert.equal(specs.errors[0].code, "list_invalid");
  assert.equal(specs.errors[0].field, "specs");

  for (const photos of [["/uploads/new/../x.webp"], ["/uploads/pre-owned/a.webp"], ["/uploads/new/x.txt"], [""]]) {
    const r = validateNewBike({ ...good, colours: [{ name: "Grey", photos }] });
    assertCoded(r.errors);
    assert.ok(
      r.errors.some((e) => e.code === "photo_src_invalid"),
      JSON.stringify(photos),
    );
  }
});

test("content/new/fiido-c21.md still passes validateNewBike", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: matter } = await import("gray-matter");
  const raw = await readFile(new URL("../content/new/fiido-c21.md", import.meta.url), "utf8");
  const { data } = matter(raw);
  const r = validateNewBike(data);
  assert.equal(r.ok, true, r.errors.map((e) => `${e.code}:${e.field}:${e.message}`).join("; "));
  assert.deepEqual(r.errors, []);
});
