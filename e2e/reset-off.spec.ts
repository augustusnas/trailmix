import { expect, test } from "@playwright/test";
import { ONBOARDED, seed } from "./helpers";

// The app as beta users get it: BETA_RESET_PAGE is not set, so the reset page is off.

test("the reset page doesn't exist when BETA_RESET_PAGE is off", async ({ page, request }) => {
  expect((await request.get("/reset")).status()).toBe(404);
  await page.goto("/reset");
  await expect(page.getByRole("button", { name: /Reset to a fresh install|Damage/ })).toHaveCount(0);
});

test("tapping the Library heading 5 times does nothing when it's off", async ({ page }) => {
  await seed(page, ONBOARDED);
  await page.goto("/library");
  for (let i = 0; i < 6; i++) await page.getByRole("heading", { name: "The library." }).click();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/library$/);
});
