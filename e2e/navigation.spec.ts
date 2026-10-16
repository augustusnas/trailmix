import { expect, test } from "@playwright/test";
import { BOXING_VIBE, ONBOARDED, seed } from "./helpers";

test("F1: a fresh install taps through every screen in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pick the terrain. We’ll bring the noise." })).toBeVisible();

  await page.getByRole("link", { name: "Lace up" }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(page.getByRole("heading", { name: "Where do you listen?" })).toBeVisible();

  await page.getByRole("button", { name: "That’s me" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
  // The three default pins, in order, in their category colours.
  await expect(page.locator("button[data-routine]")).toHaveCount(3);
  await expect.poll(() => page.locator("button[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")))).toEqual([
    "push-day",
    "incline-treadmill",
    "hiit-circuit",
  ]);
  await expect(page.getByText("3 of 6")).toBeVisible();

  await page.getByRole("link", { name: "Set the vibe" }).click();
  await expect(page).toHaveURL(/\/vibe\?routine=push-day$/);
  await page.getByRole("button", { name: "Rock" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await expect(page).toHaveURL(/\/mix\?routine=push-day$/);
  await expect(page.getByRole("heading", { name: "Press Play" })).toBeVisible();

  await page.getByRole("link", { name: "Keep it in YouTube Music" }).click();
  await expect(page).toHaveURL(/\/saved\?routine=push-day$/);
  await expect(page.getByRole("heading", { name: "Press Play is in YouTube Music." })).toBeVisible();

  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test.describe("once set up", () => {
  test.beforeEach(async ({ page }) => seed(page, { ...ONBOARDED, vibes: BOXING_VIBE }));

  test("Home to Library and back", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.locator("li[data-routine]")).toHaveCount(17);
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("Pin another goes to the Library", async ({ page }) => {
    await page.goto("/home");
    await page.getByTestId("pin-another").click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("Library 'use this routine' goes to Set the vibe", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: "Use Tabata" }).click();
    await expect(page).toHaveURL(/\/vibe\?routine=tabata$/);
  });

  test("Saved 'Share with friends' opens the shared mix page", async ({ page }) => {
    await page.goto("/saved?routine=boxing-bag-rounds");
    await page.getByRole("link", { name: "Share with friends" }).click();
    await expect(page).toHaveURL(/\/m\/boxing-bag-rounds$/);
    await expect(page.getByRole("heading", { name: "Gloves On, Volume Up" })).toBeVisible();
    await expect(page.getByText("Shared by Charles")).toBeVisible();
  });

  test("a missing or unknown routine goes back to Home, never a default", async ({ page }) => {
    for (const path of ["/vibe", "/mix?routine=nope", "/saved"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/home$/);
    }
  });

  test("The mix for a routine with no saved vibe asks for the vibe first", async ({ page }) => {
    await page.goto("/mix?routine=tabata");
    await expect(page).toHaveURL(/\/vibe\?routine=tabata$/);
  });
});

test("the shared page works for any id, without setting up Trailmix", async ({ page }) => {
  await page.goto("/m/anything-at-all");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/m\/anything-at-all$/);
});
