import { expect, test } from "@playwright/test";
import { ONBOARDED, seed } from "./helpers";

test("the Welcome footer links to Privacy, next to the credit", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByTestId("credit").locator("..");
  await expect(footer.getByTestId("credit")).toContainText("Built by");
  await footer.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy." })).toBeVisible();
});

test("Privacy says what's stored where, and links to Google and YouTube", async ({ page }) => {
  await page.goto("/privacy");
  const text = await page.locator("main").innerText();
  for (const phrase of [
    /pinned routines/i, /vibe settings/i, /recent mixes/i, // on the phone
    /shared mixes/i, /90 days/i, /daily counters/i, /track lookup cache/i, // on the server
    /google sign-in and youtube access only to create the playlists you ask for/i,
    /never sell your data or use it for ads/i,
  ]) expect(text).toMatch(phrase);
  const revoke = page.locator('a[href="https://myaccount.google.com/permissions"]');
  await expect(revoke).toHaveText("myaccount.google.com/permissions");
  await expect(page.getByRole("link", { name: "YouTube Terms of Service" })).toHaveAttribute("href", "https://www.youtube.com/t/terms");
  await expect(page.getByRole("link", { name: "Google Privacy Policy" })).toHaveAttribute("href", "https://policies.google.com/privacy");
  const email = page.getByTestId("contact-email");
  await expect(email).toHaveAttribute("href", /^mailto:.+@.+/);
  await page.getByRole("link", { name: "Back to Trailmix" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Privacy opens for returning phones too (no redirect to Home)", async ({ page }) => {
  await seed(page, ONBOARDED);
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy." })).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
});
