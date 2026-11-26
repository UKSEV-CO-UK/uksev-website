import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLICK_MOVE,
  FLING_DISTANCE,
  FLING_VELOCITY,
  RUBBER_MAX,
  clampIndex,
  indexAfterRelease,
  indexAfterSwipe,
  pointerIntent,
  rubberBandOffset,
  settledTranslate,
} from "../src/lib/deck-nav";

test("clampIndex: stays inside 0..n-1 and never wraps", () => {
  assert.equal(clampIndex(-1, 4), 0);
  assert.equal(clampIndex(0, 4), 0);
  assert.equal(clampIndex(3, 4), 3);
  assert.equal(clampIndex(4, 4), 3);
  assert.equal(clampIndex(99, 4), 3);
  assert.equal(clampIndex(0, 0), 0);
  assert.equal(clampIndex(1, 1), 0);
});

test("rubberBandOffset: at the last card, dragging out is capped at 24px and does not invert", () => {
  assert.equal(rubberBandOffset(-8, 3, 4), -8);
  assert.equal(rubberBandOffset(-24, 3, 4), -24);
  assert.equal(rubberBandOffset(-80, 3, 4), -RUBBER_MAX);
  // dragging back from the last card is not rubber-banded
  assert.equal(rubberBandOffset(120, 3, 4), 120);
});

test("rubberBandOffset: at the first card, dragging out is capped at 24px", () => {
  assert.equal(rubberBandOffset(80, 0, 4), RUBBER_MAX);
  assert.equal(rubberBandOffset(-120, 0, 4), -120);
});

test("pointerIntent: 8px is still a tap; over 8px is a swipe", () => {
  assert.equal(pointerIntent(CLICK_MOVE, 0.8), "tap-next");
  assert.equal(pointerIntent(CLICK_MOVE + 1, 0.8), "swipe");
  assert.equal(pointerIntent(-CLICK_MOVE, 0.1), "tap-prev");
  assert.equal(pointerIntent(0, 0.2), "tap-prev");
  assert.equal(pointerIntent(0, 1 / 3), "tap-next");
  assert.equal(pointerIntent(0, 0.9), "tap-next");
});

test("indexAfterRelease: from the last card, drag back, tap left third, and a left-side tap all go back", () => {
  const last = 3;
  const n = 4;
  const width = 400;
  const far = width * FLING_DISTANCE + 1;
  assert.equal(indexAfterSwipe(last, n, far, width), last - 1);
  assert.equal(indexAfterRelease(last, n, 0, 0.1, width), last - 1);
  assert.equal(indexAfterRelease(last, n, 4, 0.2, width), last - 1);
});

test("indexAfterRelease: from the last card, a drag outward or a right-side tap stays put", () => {
  const last = 3;
  const n = 4;
  const width = 400;
  const far = width * FLING_DISTANCE + 1;
  assert.equal(indexAfterSwipe(last, n, -far, width), last);
  assert.equal(indexAfterRelease(last, n, 0, 0.8, width), last);
  assert.equal(indexAfterSwipe(last, n, -10, width, -FLING_VELOCITY), last);
});

test("indexAfterRelease: from the first card, a right swipe or left-third tap stays put", () => {
  const width = 400;
  const far = width * FLING_DISTANCE + 1;
  assert.equal(indexAfterSwipe(0, 4, far, width), 0);
  assert.equal(indexAfterRelease(0, 4, 0, 0.1, width), 0);
});

test("indexAfterSwipe: dragging back from last, then again, reaches the first", () => {
  const width = 400;
  const far = width * FLING_DISTANCE + 1;
  let i = 3;
  i = indexAfterSwipe(i, 4, far, width);
  assert.equal(i, 2);
  i = indexAfterSwipe(i, 4, far, width);
  assert.equal(i, 1);
  i = indexAfterSwipe(i, 4, far, width);
  assert.equal(i, 0);
  i = indexAfterSwipe(i, 4, far, width);
  assert.equal(i, 0);
});

test("indexAfterRelease: a short drag under the distance threshold springs back unless it was a fling", () => {
  const width = 400;
  assert.equal(indexAfterSwipe(1, 4, 20, width, 0), 1);
  assert.equal(indexAfterSwipe(1, 4, 20, width, FLING_VELOCITY), 0);
  assert.equal(indexAfterSwipe(1, 4, -20, width, -FLING_VELOCITY), 2);
});

test("indexAfterRelease: jumping via a tap never wraps; a mid-card left-third tap goes back", () => {
  assert.equal(indexAfterRelease(2, 4, 0, 0.2, 400), 1);
  assert.equal(indexAfterRelease(2, 4, 0, 0.7, 400), 3);
});

test("settledTranslate: last card is right-aligned when a peek is used", () => {
  const stage = 390;
  const peek = 24;
  const card = stage - peek;
  assert.equal(settledTranslate(0, 4, stage, peek), 0);
  assert.equal(settledTranslate(1, 4, stage, peek), -card);
  assert.equal(settledTranslate(3, 4, stage, peek), -3 * card + peek);
  assert.equal(settledTranslate(1, 4, 420, 0), -420);
});
