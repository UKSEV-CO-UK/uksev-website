import { expect, test, type Locator, type Page } from "@playwright/test";

async function drag(
  page: Page,
  locator: Locator,
  dx: number,
  mode: "mouse" | "touch",
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("stage has no box");
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.4;
  if (mode === "touch") {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 0 }],
    });
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / steps, y, id: 0 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 16 });
    await page.mouse.up();
  }
}

test.describe("homepage bike deck", () => {
  test("from the last card, dragging back reaches the first", async ({ page }, info) => {
    const mode = info.project.name === "mobile" ? "touch" : "mouse";
    await page.goto("/#rides");
    const deck = page.getByTestId("bike-deck");
    const stage = page.getByTestId("bike-deck-stage");
    await expect(deck).toBeVisible();

    const dots = page.getByTestId("bike-deck-dot");
    const n = await dots.count();
    expect(n).toBeGreaterThan(1);

    if (info.project.name === "desktop") {
      const prev = page.getByTestId("bike-deck-prev");
      const next = page.getByTestId("bike-deck-next");
      await expect(prev).toBeVisible();
      await expect(next).toBeVisible();
      await expect(prev).toBeDisabled();
      const stageBox = await stage.boundingBox();
      const prevBox = await prev.boundingBox();
      const nextBox = await next.boundingBox();
      const firstDot = await dots.first().boundingBox();
      const lastDot = await dots.last().boundingBox();
      expect(stageBox && prevBox && nextBox && firstDot && lastDot).toBeTruthy();
      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps(prevBox!, stageBox!)).toBeFalsy();
      expect(overlaps(nextBox!, stageBox!)).toBeFalsy();
      expect(Math.abs(firstDot!.x - (prevBox!.x + prevBox!.width) - 24)).toBeLessThan(2);
      expect(Math.abs(nextBox!.x - (lastDot!.x + lastDot!.width) - 24)).toBeLessThan(2);
      const idleDot = dots.nth(1).locator("span");
      const idleBox = await idleDot.boundingBox();
      expect(idleBox).toBeTruthy();
      expect(Math.abs((idleBox?.width ?? 0) - 6)).toBeLessThan(1);
      expect(Math.abs((idleBox?.height ?? 0) - 6)).toBeLessThan(1);
    } else {
      await expect(page.getByTestId("bike-deck-prev")).toBeHidden();
      await expect(page.getByTestId("bike-deck-next")).toBeHidden();
      const first = stage.locator("article").nth(0);
      const second = stage.locator("article").nth(1);
      const stageBox = await stage.boundingBox();
      const firstBox = await first.boundingBox();
      const secondBox = await second.boundingBox();
      expect(stageBox && firstBox && secondBox).toBeTruthy();
      expect(Math.abs((firstBox?.width ?? 0) - ((stageBox?.width ?? 0) - 24))).toBeLessThan(2);
      const peekLeft = (secondBox?.x ?? 0) - ((stageBox?.x ?? 0) + (stageBox?.width ?? 0) - 24);
      expect(Math.abs(peekLeft)).toBeLessThan(3);
    }

    await page.getByRole("button", { name: `Bike 2 of ${n}` }).click();
    await expect(deck).toHaveAttribute("data-index", "1");

    await page.getByRole("button", { name: `Bike ${n} of ${n}` }).click();
    await expect(deck).toHaveAttribute("data-index", String(n - 1));
    if (info.project.name === "desktop") {
      await expect(page.getByTestId("bike-deck-next")).toBeDisabled();
      await expect(page.getByTestId("bike-deck-prev")).toBeEnabled();
    }

    // Dragging further out from the last card must not advance or get stuck.
    await drag(page, stage, -80, mode);
    await expect(deck).toHaveAttribute("data-index", String(n - 1));

    for (let i = n - 1; i > 0; i--) {
      await drag(page, stage, 200, mode);
      await expect(deck).toHaveAttribute("data-index", String(i - 1));
    }
    await expect(deck).toHaveAttribute("data-index", "0");
  });
});
