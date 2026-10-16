import { expect, test, type Page } from "@playwright/test";
import { CATEGORIES } from "../src/data/categories";
import { ROUTINES, type Routine } from "../src/data/routines";
import { ONBOARDED, seed } from "./helpers";

// F21: whichever routine is picked shows its name and category colour on Set the vibe, The mix and Saved.

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function expectTag(page: Page, r: Routine) {
  const tag = page.getByTestId("routine-tag");
  await expect(tag).toContainText(r.name, { ignoreCase: true });
  await expect(tag).toHaveAttribute("data-category", r.category);
  await expect(tag).toHaveCSS("background-color", hexToRgb(CATEGORIES[r.category].bg));
}

async function checkFlow(page: Page, r: Routine) {
  await expect(page).toHaveURL(new RegExp(`/vibe\\?routine=${r.id}$`));
  await expectTag(page, r);
  await page.reload(); // survives a refresh
  await expectTag(page, r);

  await page.getByRole("button", { name: "House" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await expect(page).toHaveURL(new RegExp(`/mix\\?routine=${r.id}$`));
  const band = page.getByTestId("mix-band");
  await expect(band).toHaveAttribute("data-category", r.category);
  await expect(band).toHaveCSS("background-color", hexToRgb(CATEGORIES[r.category].bg));
  await expect(page.getByTestId("routine-name")).toContainText(r.name, { ignoreCase: true });
  await expect(page.getByTestId("playlist-title")).toContainText(`Trailmix · ${r.short} · `);
  await page.reload();
  await expect(page.getByTestId("routine-name")).toContainText(r.name, { ignoreCase: true });

  await page.getByTestId("mix-action").click();
  await expect(page).toHaveURL(new RegExp(`/saved\\?routine=${r.id}$`));
  await expectTag(page, r);
}

test.beforeEach(async ({ page }) => seed(page, ONBOARDED));

test("from Home: each pinned tile carries through", async ({ page }) => {
  for (const name of ["Push day", "Incline treadmill", "HIIT circuit"]) {
    await page.goto("/home");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("link", { name: "Set the vibe" }).click();
    await checkFlow(page, ROUTINES.find((r) => r.name === name)!);
  }
});

for (const r of ROUTINES) {
  test(`from the Library: ${r.name} carries through`, async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: `Use ${r.name}`, exact: true }).click();
    await checkFlow(page, r);
  });
}

test("vibe choices carry through to the mix", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  await page.getByRole("button", { name: "Grime" }).click();
  await page.getByRole("button", { name: "Feral" }).click();
  await page.getByRole("button", { name: "30 minutes" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await expect(page.getByTestId("routine-name")).toContainText("Boxing bag rounds · 30 min · Feral", { ignoreCase: true });
  await expect(page.getByRole("heading", { name: "Gloves On, Volume Up" })).toBeVisible();
  await expect(page.getByTestId("playlist-title")).toContainText("Trailmix · Boxing · Gloves On, Volume Up · ");
  await expect(page.getByTestId("running-time")).toHaveText(/29 min/i);
});
