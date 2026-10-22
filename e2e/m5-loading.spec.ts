import { expect, test, type Page } from "@playwright/test";
import { ONBOARDED, seed, waitForMix } from "./helpers";

// Milestone 5, Part B: the loading screen (L1, L2). Stages, counts and the length line all come
// from the server as it gets there (the stand-in services answer quickly; "slow" holds each stage).

const switchOn = (page: Page, v: string) => page.addInitScript((x) => sessionStorage.setItem("trailmix-test-switch", x), v);
const vibe = (energy: string) => ({ "boxing-bag-rounds": { genres: ["hiphop", "afro"], energy, length: 30 } });
const rgb = { lime: "rgb(200, 224, 58)", lilac: "rgb(169, 155, 245)", orange: "rgb(232, 87, 30)" };

/** Every different stage line the screen shows, in order. */
async function recordLines(page: Page) {
  const seen: string[] = [];
  await page.exposeFunction("recordLine", (v: string) => seen.push(v));
  await page.addInitScript(() => {
    let last = "";
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="loading"]');
      const v = el ? `${el.getAttribute("data-stage")}|${document.querySelector('[data-testid="stage-line"]')?.textContent}` : "";
      if (v && v !== last) {
        last = v;
        void (window as unknown as { recordLine: (v: string) => void }).recordLine(v);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  return seen;
}

test("L1: the stages come in order with their colours; the count rises live; the length line is the mix that comes out", async ({ page }) => {
  await seed(page, { ...ONBOARDED, vibes: vibe("driven") });
  await switchOn(page, "slow");
  const seen = await recordLines(page);
  await page.goto("/mix?routine=boxing-bag-rounds");
  const screen = page.getByTestId("loading");
  await expect(screen).toHaveCSS("background-color", rgb.lime);
  await expect(page.getByTestId("routine-name")).toHaveText("Boxing bag rounds · 30 min · Driven");
  await expect(page.getByTestId("stage-line")).toHaveText("Hip-hop & UK rap · Afrobeats & amapiano");
  await expect(screen).toHaveAttribute("data-stage", "energy", { timeout: 10_000 });
  await expect(screen).toHaveCSS("background-color", rgb.lilac);
  await expect(page.getByTestId("stage-line")).toHaveText(/^\d+ tracks? found so far$/);
  await expect(screen).toHaveAttribute("data-stage", "fitting", { timeout: 10_000 });
  await expect(screen).toHaveCSS("background-color", rgb.orange);
  await expect(page.getByRole("heading", { name: "Fitting it to 30 minutes" })).toBeVisible();
  await waitForMix(page);

  const stages = seen.map((s) => s.split("|")[0]);
  expect([...new Set(stages)]).toEqual(["picking", "energy", "fitting"]);
  const counts = seen.filter((s) => s.startsWith("energy|")).map((s) => Number(s.match(/\|(\d+)/)?.[1] ?? 0));
  expect(counts.at(-1)).toBeGreaterThanOrEqual(5);
  expect(counts).toEqual([...counts].sort((a, b) => a - b)); // only ever counts up
  const lastFit = seen.filter((s) => /^fitting\|\d/.test(s)).at(-1)!;
  const tracks = await page.getByTestId("mix-track").count();
  const minutes = (await page.getByTestId("running-time").textContent())!.match(/\d+/)![0];
  expect(lastFit).toBe(`fitting|${tracks} tracks · ${minutes} min`);
});

test("L1: with no hold, generation that's finished goes straight to The mix", async ({ page }) => {
  await seed(page, { ...ONBOARDED, vibes: vibe("steady") });
  const started = Date.now();
  await page.goto("/mix?routine=boxing-bag-rounds");
  await waitForMix(page);
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(page.getByTestId("loading")).toHaveCount(0);
});

for (const [energy, beat] of [["easy", "1.4s"], ["steady", "0.9s"], ["driven", "0.6s"], ["feral", "0.38s"]] as const) {
  test(`L2: the bars beat at ${beat} for ${energy}, staggered`, async ({ page }) => {
    await seed(page, { ...ONBOARDED, vibes: vibe(energy) });
    await switchOn(page, "slow");
    await page.goto("/mix?routine=boxing-bag-rounds");
    const bars = page.getByTestId("loading-bars").locator("span");
    await expect(bars).toHaveCount(7);
    const styles = await bars.evaluateAll((els) => els.map((e) => [getComputedStyle(e).animationName, getComputedStyle(e).animationDuration, getComputedStyle(e).animationDelay]));
    for (const [name, duration] of styles) {
      expect(name).toMatch(/eq$/); // the style sheet adds a prefix to the name
      expect(duration).toBe(beat);
    }
    expect(new Set(styles.map((s) => s[2])).size).toBe(7);
  });
}

test.describe("Reduce Motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("L2: the bars stay still", async ({ page }) => {
    await seed(page, { ...ONBOARDED, vibes: vibe("feral") });
    await switchOn(page, "slow");
    await page.goto("/mix?routine=boxing-bag-rounds");
    const bars = page.getByTestId("loading-bars").locator("span");
    await expect(bars).toHaveCount(7);
    for (const s of await bars.evaluateAll((els) => els.map((e) => `${getComputedStyle(e).animationName}|${getComputedStyle(e).transform}`))) {
      expect(s).toBe("none|matrix(1, 0, 0, 0.6, 0, 0)");
    }
  });
});
