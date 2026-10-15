import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

// N1 (automated part): once visited, Home and Library open with no connection.
test("Home and Library work offline after the first visit", async ({ page, context }) => {
  await page.goto("/home");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait until the shell is cached.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length > 0 && !!(await caches.match("/library"))), {
      timeout: 15_000,
    })
    .toBe(true);

  await context.setOffline(true);
  const started = Date.now();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2000);

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "The library." })).toBeVisible();
  await context.setOffline(false);
});
