import { test } from "node:test";
import assert from "node:assert/strict";
import { listSummary } from "../src/lib/preowned-types";

test("listSummary: 1 bike, all available", () => {
  assert.equal(listSummary(1, 0), "1 bike, all available");
});

test("listSummary: 2 bikes, all available", () => {
  assert.equal(listSummary(2, 0), "2 bikes, all available");
});

test("listSummary: 1 bike, 1 recently sold", () => {
  assert.equal(listSummary(1, 1), "1 bike, 1 recently sold");
});

test("listSummary: 3 bikes, 2 recently sold", () => {
  assert.equal(listSummary(3, 2), "3 bikes, 2 recently sold");
});
