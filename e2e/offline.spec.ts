import { expect, test } from "@playwright/test";
import { ONBOARDED, seed } from "./helpers";

test.use({ serviceWorkers: "allow" });

// N1 and Milestone 2: once visited, the app works with no connection.
test("Home, Library, pinning, search and Set the vibe work offline", async ({ page, context }) => {
  await seed(page, ONBOARDED);
  await page.goto("/home");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(async () => !!(await caches.match("/library")) && !!(await caches.match("/vibe"))), { timeout: 15_000 })
    .toBe(true);

  await context.setOffline(true);
  const started = Date.now();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2000);

  await page.goto("/library");
  await page.getByRole("button", { name: "Pin to home: Tabata" }).click();
  await page.getByRole("button", { name: "Unpin Push day" }).click();
  await page.getByLabel("Find a routine").fill("tab");
  await expect(page.locator("li[data-routine]")).toHaveCount(1);

  await page.goto("/vibe?routine=tabata");
  await page.getByRole("button", { name: "Grime" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await expect(page.getByTestId("mix-action")).toBeVisible();

  await page.goto("/home");
  await expect.poll(() => page.locator("button[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")))).toEqual([
    "incline-treadmill",
    "hiit-circuit",
    "tabata",
  ]);
  await context.setOffline(false);
});
