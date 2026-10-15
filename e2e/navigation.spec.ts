import { expect, test } from "@playwright/test";

test("taps through every screen in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pick the terrain. We’ll bring the noise." })).toBeVisible();

  await page.getByRole("link", { name: "Lace up" }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(page.getByRole("heading", { name: "Where do you listen?" })).toBeVisible();
  for (const app of ["YouTube Music", "Spotify", "Apple Music"]) {
    await expect(page.getByRole("button", { name: new RegExp(app) })).toBeVisible();
  }

  await page.getByRole("link", { name: "That’s me" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
  await expect(page.getByText("3 of 6")).toBeVisible();

  await page.getByRole("link", { name: "Set the vibe" }).click();
  await expect(page).toHaveURL(/\/vibe\?routine=indoor-walk/);
  await expect(page.getByRole("heading", { name: "Set the vibe." })).toBeVisible();

  await page.getByRole("link", { name: "Make the mix" }).click();
  await expect(page).toHaveURL(/\/mix\?/);
  await expect(page.getByRole("heading", { name: "Groove Miles" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remix" })).toBeVisible();

  await page.getByRole("link", { name: "Keep it in YouTube Music" }).click();
  await expect(page).toHaveURL(/\/saved\?/);
  await expect(page.getByRole("heading", { name: "Groove Miles is in YouTube Music." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in YouTube Music" })).toBeVisible();

  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("Home to Library and back", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "The library." })).toBeVisible();
  await expect(page.locator("li[data-routine]")).toHaveCount(17);
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("Pin another goes to the Library", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: /Pin another/ }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("Library 'use this routine' goes to Set the vibe", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: "Use Tabata" }).click();
  await expect(page).toHaveURL(/\/vibe\?routine=tabata$/);
});

test("Saved 'Share with friends' opens the shared mix page", async ({ page }) => {
  await page.goto("/saved?routine=yoga-flow");
  await page.getByRole("link", { name: "Share with friends" }).click();
  await expect(page).toHaveURL(/\/m\/yoga-flow$/);
  await expect(page.getByRole("heading", { name: "Slow Burn Sunday" })).toBeVisible();
  await expect(page.getByText("Shared by Charles")).toBeVisible();
  await expect(page.getByText("Track links by Songlink/Odesli")).toBeVisible();
});

test("the shared page works for any id", async ({ page }) => {
  await page.goto("/m/anything-at-all");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Spotify" }).click();
  await expect(page.getByText("Tap any track to open it in Spotify.")).toBeVisible();
});

test("a missing or unknown routine goes back to Home, never a default", async ({ page }) => {
  for (const path of ["/vibe", "/mix?routine=nope", "/saved"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/home$/);
  }
});
