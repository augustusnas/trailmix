import { expect, test } from "@playwright/test";
import { BOXING_VIBE, ONBOARDED, makeSharedMix, seed, signIn, waitForMix } from "./helpers";

test("F1: a fresh install taps through every screen in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pick the terrain. We’ll bring the noise." })).toBeVisible();

  await signIn(page);
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

  await waitForMix(page);
  await expect(page.getByTestId("mix-action")).toHaveText("Keep it in YouTube Music");
  await page.getByTestId("mix-action").click();
  await expect(page).toHaveURL(/\/saved\?routine=push-day$/);
  await expect(page.getByRole("heading", { name: "Press Play is ready to play." })).toBeVisible();

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

  test("Saved: Open in YouTube Music opens the mix page; Share with friends opens the share sheet", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: unknown[] }).__shared = [];
      navigator.share = async (data) => {
        (window as unknown as { __shared: unknown[] }).__shared.push(data);
      };
    });
    await page.goto("/mix?routine=boxing-bag-rounds");
    await waitForMix(page);
    await page.getByTestId("mix-action").click();
    await expect(page).toHaveURL(/\/saved\?routine=boxing-bag-rounds$/);

    await page.getByRole("button", { name: "Share with friends" }).click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string }[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toMatch(/^https:\/\/trailmix\.augustusnas\.com\/m\/[\w-]{22}$/);

    await page.getByTestId("saved-action").click();
    await expect(page).toHaveURL(/\/m\/[\w-]{22}$/);
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

test("a shared mix opens without setting up Trailmix", async ({ page, request }) => {
  const { id, mix } = await makeSharedMix(request);
  await page.goto(`/m/${id}`);
  await expect(page.getByRole("heading", { name: mix.name })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/m/${id}$`));
});
