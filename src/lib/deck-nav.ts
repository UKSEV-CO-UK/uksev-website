/** Navigation math for the homepage bike deck. Pure functions so unit tests can cover ends. */

/** Visual peek of the next card on small screens, in px. */
export const PEEK_MOBILE = 24;
/** How far a card may be pulled past either end, in px. */
export const RUBBER_MAX = 24;
/** Pointer travel above this (px) is a swipe, not a tap. */
export const CLICK_MOVE = 8;
/** Commit a swipe when travel exceeds this fraction of the stage width. */
export const FLING_DISTANCE = 0.1;
/** Commit a fling when |velocity| reaches this many px/ms. */
export const FLING_VELOCITY = 0.5;

export function clampIndex(i: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(n - 1, i));
}

/** Offset applied while dragging. Past either end it is clamped to ±max, never a page change. */
export function rubberBandOffset(
  dx: number,
  index: number,
  n: number,
  max = RUBBER_MAX,
): number {
  if (n <= 1) return Math.max(-max, Math.min(max, dx));
  if (index <= 0 && dx > 0) return Math.min(max, dx);
  if (index >= n - 1 && dx < 0) return Math.max(-max, dx);
  return dx;
}

export function cardWidth(stageW: number, peek: number): number {
  return Math.max(0, stageW - peek);
}

/** Settled track translation, in px. Last card is right-aligned when a peek is in use. */
export function settledTranslate(
  index: number,
  n: number,
  stageW: number,
  peek: number,
): number {
  if (n <= 1 || stageW <= 0) return 0;
  const i = clampIndex(index, n);
  const w = cardWidth(stageW, peek);
  if (i === 0) return 0;
  if (peek > 0 && i === n - 1) return -i * w + peek;
  return -i * w;
}

export type PointerIntent = "swipe" | "tap-prev" | "tap-next";

/** xRatio is 0..1 across the stage. dx is pointer delta, right is positive. */
export function pointerIntent(
  dx: number,
  xRatio: number,
  clickMove = CLICK_MOVE,
): PointerIntent {
  if (Math.abs(dx) > clickMove) return "swipe";
  return xRatio < 1 / 3 ? "tap-prev" : "tap-next";
}

export function indexAfterSwipe(
  index: number,
  n: number,
  dx: number,
  stageW: number,
  velocityX = 0,
): number {
  const i = clampIndex(index, n);
  if (n <= 1) return 0;
  const far = Math.abs(dx) > stageW * FLING_DISTANCE;
  const flung = Math.abs(velocityX) >= FLING_VELOCITY;
  if (!far && !flung) return i;
  const towardNext = far ? dx < 0 : velocityX < 0;
  return clampIndex(i + (towardNext ? 1 : -1), n);
}

/** Resolve a pointer release into the next index. Never wraps. */
export function indexAfterRelease(
  index: number,
  n: number,
  dx: number,
  xRatio: number,
  stageW: number,
  velocityX = 0,
): number {
  const intent = pointerIntent(dx, xRatio);
  if (intent === "tap-prev") return clampIndex(index - 1, n);
  if (intent === "tap-next") return clampIndex(index + 1, n);
  return indexAfterSwipe(index, n, dx, stageW, velocityX);
}
