import { expect, test } from "@playwright/test";
import { ONBOARDED, TEST_ACCESS_CODE, seed, stored } from "./helpers";

test("Lace up asks for the beta code once; a wrong code is refused kindly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Lace up" }).click();
  const input = page.getByLabel("Beta access code");
  await input.fill("wrong-code");
  await page.getByRole("button", { name: "Let me in" }).click();
  await expect(page.getByTestId("access-form")).toContainText("That code didn't work. Check it with whoever invited you.");
  await expect(page).toHaveURL(/\/$/);

  await input.fill(TEST_ACCESS_CODE);
  await page.getByRole("button", { name: "Let me in" }).click();
  await expect(page).toHaveURL(/\/listen$/);
  expect((await stored(page)).accessCode).toBe(TEST_ACCESS_CODE);
  expect(await page.context().cookies()).toEqual([]); // kept on the phone, never a cookie

  // Not asked again.
  await page.goto("/");
  await page.getByRole("button", { name: "Lace up" }).click();
  await expect(page).toHaveURL(/\/listen$/);
});

test("the code check route refuses wrong codes and accepts the right one", async ({ request }) => {
  expect((await request.post("/api/access", { data: { code: "nope" } })).status()).toBe(401);
  expect((await request.post("/api/access", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/access", { data: { code: TEST_ACCESS_CODE } })).status()).toBe(200);
});

test("phones set up in Milestone 2 (no code yet) keep working on Home", async ({ page }) => {
  await seed(page, { ...ONBOARDED, accessCode: null });
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
});
