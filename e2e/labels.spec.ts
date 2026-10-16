import { expect, test } from "@playwright/test";
import { ONBOARDED, seed } from "./helpers";
import { SCREENS, open } from "./screens";

// Beta label: Home, Where do you listen, shared page (pill/footer) and Welcome (tag). Never on vibe, mix, saved.
// Credit: only Welcome, Library and the shared page.
const BETA = ["welcome", "listen", "home", "shared"];
const CREDIT = ["welcome", "library", "shared"];

for (const s of SCREENS) {
  const base = s.name.split("-")[0]; // "home-full" is still Home
  test(`${s.name}: beta label ${BETA.includes(base) ? "shown" : "hidden"}, credit ${CREDIT.includes(base) ? "shown" : "hidden"}`, async ({ page }) => {
    await open(page, s);
    const beta = page.getByTestId("beta-label");
    const credit = page.getByTestId("credit");
    if (BETA.includes(base)) await expect(beta.first()).toBeVisible();
    else await expect(beta).toHaveCount(0);
    if (CREDIT.includes(base)) {
      await expect(credit).toHaveCount(1);
      const link = credit.getByRole("link", { name: "Augustus Nas" });
      await expect(link).toHaveAttribute("href", "https://www.augustusnas.com");
      await expect(link).toHaveAttribute("target", "_blank");
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    } else {
      await expect(credit).toHaveCount(0);
    }
  });
}

test("Welcome tag reads INVITE-ONLY BETA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("beta-label")).toHaveText(/invite-only beta/i);
});

test("shared page footer says it's in invite-only beta", async ({ page }) => {
  await page.goto("/m/demo");
  await expect(page.getByText("Trailmix is in invite-only beta")).toBeVisible();
});

test("feedback button is hidden when FEEDBACK_EMAIL isn't set", async ({ page }) => {
  await seed(page, ONBOARDED);
  await page.goto("/library");
  await expect(page.getByTestId("credit")).toBeVisible();
  await expect(page.getByText(/send beta feedback/i)).toHaveCount(0);
});
