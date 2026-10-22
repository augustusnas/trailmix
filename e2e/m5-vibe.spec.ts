import { expect, test, type Page } from "@playwright/test";
import { ONBOARDED, seed, setVibe } from "./helpers";

// Milestone 5, Part A: Set the vibe is three steps, one question each (V1–V6).

const BOXING = { "boxing-bag-rounds": { genres: ["hiphop"], energy: "driven", length: 45 } };
const step = (page: Page) => page.getByTestId("vibe-step");
const rgb = { lime: "rgb(200, 224, 58)", lilac: "rgb(169, 155, 245)", orange: "rgb(232, 87, 30)" };

test.beforeEach(async ({ page }) => seed(page, { ...ONBOARDED, vibes: BOXING }));

test("V1: three steps on Lime, Lilac and Orange, each with Back, 'Step N of 3' and the progress segments", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  const expected = [
    ["What are you into today?", rgb.lime],
    ["How hard are you going?", rgb.lilac],
    ["How long have you got?", rgb.orange],
  ];
  for (const [i, [question, colour]] of expected.entries()) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(question);
    await expect(step(page)).toHaveCSS("background-color", colour);
    await expect(page.getByTestId("vibe-routine")).toHaveText(`Boxing bag rounds · Step ${i + 1} of 3`);
    await expect(page.locator('[aria-hidden="true"] > span[class*="done"]')).toHaveCount(i + 1);
    const back = page.getByRole("button", { name: i === 0 ? "Back to routines" : "Back", exact: true });
    expect((await back.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    if (i < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  // Back goes one step at a time, then to Home.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(step(page)).toHaveAttribute("data-step", "2");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back to routines" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("V1: opened from the Library, Back on step 1 returns to the Library", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: "Use Tabata" }).click();
  await page.getByRole("button", { name: "Back to the Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("V3: Same as last time shows the routine's last vibe, and one tap fills it in and jumps to Length", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  const card = page.getByTestId("same-as-last");
  await expect(card).toHaveText(/Same as last time\s*Hip-hop & UK rap · Driven · 45 min/);
  await expect(card).toHaveCSS("border-top-style", "dashed");
  await card.click();
  await expect(step(page)).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("genre-chip")).toHaveText(/Hip-hop & UK rap/);
  await expect(page.getByTestId("energy-chip")).toHaveText(/Driven/);
  await expect(page.getByRole("button", { name: "45 min", exact: true })).toHaveAttribute("aria-pressed", "true");
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/mix"));
  await page.getByRole("button", { name: "Make the mix" }).click();
  expect((await sent).postDataJSON()).toMatchObject({ genres: ["hiphop"], energy: "driven", length: 45 });
});

test("V3: hidden for a routine with no saved vibe", async ({ page }) => {
  await page.goto("/vibe?routine=tabata");
  await expect(page.getByRole("heading", { name: "What are you into today?" })).toBeVisible();
  await expect(page.getByTestId("same-as-last")).toHaveCount(0);
});

test("V4: tapping an energy level highlights it at once and moves to Length after about 0.55 s", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  await page.getByRole("button", { name: "Next" }).click();
  const started = Date.now();
  await page.getByRole("button", { name: "Feral", exact: true }).click();
  await expect(page.getByRole("button", { name: "Feral", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(step(page)).toHaveAttribute("data-step", "2"); // highlighted, not moved yet
  await expect(step(page)).toHaveAttribute("data-step", "3");
  const waited = Date.now() - started;
  expect(waited).toBeGreaterThanOrEqual(450);
  expect(waited).toBeLessThan(2_000);
  await expect(page.getByTestId("energy-chip")).toHaveText(/Feral/);
});

test("V4: a second tap during the pause switches level and still moves on only once", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Easy", exact: true }).click();
  await page.getByRole("button", { name: "Steady", exact: true }).click();
  await expect(step(page)).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("energy-chip")).toHaveText(/Steady/);
  // Back to Energy: it stays there (no second, late move from the first tap).
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForTimeout(900);
  await expect(step(page)).toHaveAttribute("data-step", "2");
  await expect(page.getByRole("button", { name: "Steady", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Energy: 7 still bars whose height follows the level (40, 60, 80 and 100%)", async ({ page }) => {
  await page.goto("/vibe?routine=boxing-bag-rounds");
  await page.getByRole("button", { name: "Next" }).click();
  const heights = () => page.getByTestId("energy-bars").locator("span").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.height));
  await expect.poll(heights).toEqual(["72px", "96px", "120px", "136px", "120px", "96px", "72px"]); // Driven: 80%
  const animations = await page.getByTestId("energy-bars").locator("span").first().evaluate((e) => getComputedStyle(e).animationName);
  expect(animations).toBe("none");
});

test("V5: Length's genre and energy chips go back to their step; the finish time is right", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 27, 19, 7) });
  await page.goto("/vibe?routine=boxing-bag-rounds");
  await page.getByTestId("same-as-last").click();
  await expect(page.getByTestId("finish-time")).toHaveText("Finishes at 7:52pm");
  await page.getByRole("button", { name: "90 min", exact: true }).click();
  await expect(page.getByTestId("finish-time")).toHaveText("Finishes at 8:37pm");
  await expect(step(page)).toHaveAttribute("data-step", "3"); // picking a length doesn't move on
  await page.getByRole("button", { name: "Change energy: Driven" }).click();
  await expect(step(page)).toHaveAttribute("data-step", "2");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Change genres: Hip-hop & UK rap" }).click();
  await expect(step(page)).toHaveAttribute("data-step", "1");
});

test("V6: each step's question gets focus (for VoiceOver), and all three steps work from the keyboard alone", async ({ page }) => {
  await page.goto("/vibe?routine=tabata");
  await page.getByRole("button", { name: "Pop" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Pop" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "How hard are you going?" })).toBeFocused();
  // VoiceOver can always use Next instead of the pause.
  await page.getByRole("button", { name: "Next" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "How long have you got?" })).toBeFocused();
  await page.getByRole("button", { name: "Make the mix" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/mix\?routine=tabata$/);
});

test.describe("Reduce Motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("V6: no transitions at all on Set the vibe", async ({ page }) => {
    await page.goto("/vibe?routine=boxing-bag-rounds");
    const tile = page.getByRole("button", { name: "Pop" });
    expect(Number.parseFloat(await tile.evaluate((e) => getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(0.01);
    await setVibe(page, {}, false);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const bar = page.getByTestId("energy-bars").locator("span").first();
    expect(Number.parseFloat(await bar.evaluate((e) => getComputedStyle(e).transitionDuration))).toBeLessThanOrEqual(0.01);
  });
});
