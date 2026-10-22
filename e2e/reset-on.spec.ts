import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_PINS } from "../src/data/routines";
import { ONBOARDED, sawWelcome, seed, stored, watchForWelcome } from "./helpers";

// Runs against the app with SHOW_RESET_PAGE=true (see playwright.config.ts).

const SIX = ["tabata", "yoga-flow", "emom", "amrap", "pull-day", "spin-bike"];
const pinIds = (page: Page) =>
  page.locator("button[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")));

async function openReset(page: Page) {
  await page.goto("/library");
  for (let i = 0; i < 5; i++) await page.getByRole("heading", { name: "The library." }).click();
  await expect(page).toHaveURL(/\/reset$/);
}

test("tapping the Library heading 5 times opens the reset page", async ({ page }) => {
  await seed(page, ONBOARDED);
  await openReset(page);
  await expect(page.getByRole("heading", { name: "Reset this phone." })).toBeVisible();
});

test("E12 phone check: Damage reloads into Home with the defaults and no Welcome", async ({ page }) => {
  await seed(page, { ...ONBOARDED, pins: SIX });
  await watchForWelcome(page);
  await openReset(page);
  await page.getByRole("button", { name: /Damage the saved data/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect.poll(() => pinIds(page)).toEqual(DEFAULT_PINS);
  expect(await sawWelcome(page)).toBe(false);
});

test("F1 phone check: Reset to a fresh install goes back to Welcome with nothing remembered", async ({ page }) => {
  await seed(page, { ...ONBOARDED, pins: SIX, musicApp: "spotify" });
  await openReset(page);
  await page.getByRole("button", { name: "Reset to a fresh install" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Pick the terrain. We’ll bring the noise." })).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test("phone test switches: E3 forced from the reset page, then back to normal", async ({ page }) => {
  await seed(page, { ...ONBOARDED, vibes: { "boxing-bag-rounds": { genres: ["hiphop"], energy: "driven", length: 30 } } });
  await openReset(page);
  await page.getByRole("button", { name: /E3 · The mix doesn't come together/ }).click();
  await page.goto("/mix?routine=boxing-bag-rounds");
  await expect(page.getByTestId("mix-problem")).toContainText("The mix didn't come together. Try again.");
  await openReset(page);
  await page.getByRole("button", { name: "Everything normal" }).click();
  await page.goto("/mix?routine=boxing-bag-rounds");
  await expect(page.getByTestId("mix-action")).toBeVisible();
});
