import { expect, test } from "@playwright/test";
import { ONBOARDED, seed } from "./helpers";
import { fontsReady, layoutProblems } from "./layout";

// Pinned routines can be any of the 17, so Home must fit the longest names whole at every phone width.
const LONGEST = ["kettlebell-flow", "incline-treadmill", "rowing-intervals", "stretch-mobility", "free-weights-legs", "shadow-boxing"];

for (const width of [320, 340, 360, 375, 390, 414, 430]) {
  test(`Home fits the longest routine names at ${width}px`, async ({ page }) => {
    await seed(page, { ...ONBOARDED, pins: LONGEST });
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/home");
    await page.locator("button[data-routine]").first().waitFor();
    await fontsReady(page);
    expect(await layoutProblems(page)).toEqual([]);
  });
}
