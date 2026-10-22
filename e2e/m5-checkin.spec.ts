import { expect, test, type Page } from "@playwright/test";
import { FRIEND, SIGNED_OUT, signedInState } from "./auth";
import { BOXING_VIBE, ONBOARDED, keepInYouTubeMusic, seed, stored, waitForMix } from "./helpers";

// Milestone 5, Part C: the check-in card (F17) and the stats page (C1).

const HOUR = 3600_000;
const kept = (id: string, name: string, agoMs: number, extra: object = {}) => ({
  id,
  name,
  routineId: "boxing-bag-rounds",
  date: "2026-10-27T09:00:00Z",
  keptAt: new Date(Date.now() - agoMs).toISOString(),
  freshness: 90,
  tracks: [{ title: "One", artist: "A" }],
  ...extra,
});
const card = (page: Page) => page.getByTestId("checkin");

test.describe("F17: the check-in card", () => {
  test("an hour after a mix is kept: one tap records the answer, says Noted, and never asks again", async ({ page }) => {
    await seed(page, { ...ONBOARDED, recentMixes: [kept("mix00001", "Gloves On, Volume Up", 2 * HOUR)] });
    await page.goto("/home");
    await expect(card(page).getByRole("heading")).toHaveText("How did Gloves On, Volume Up do?");
    // The card comes first on Home.
    expect((await card(page).boundingBox())!.y).toBeLessThan((await page.getByRole("heading", { name: "What’s the terrain today?" }).boundingBox())!.y);
    const counted = page.waitForRequest((r) => r.url().endsWith("/api/event"));
    await card(page).getByRole("button", { name: "New favourite" }).click();
    await expect(card(page).getByRole("button", { name: "New favourite" })).toHaveAttribute("aria-pressed", "true");
    await card(page).getByRole("button", { name: "Carried me" }).click();
    await expect(card(page)).toHaveText("Noted. The next mix gets the memo.");
    expect((await counted).postDataJSON()).toEqual({ event: "checkin", answer: "carried", favourite: true });
    expect((await stored(page)).recentMixes[0].checkin).toMatchObject({ answer: "carried", favourite: true });
    await page.reload();
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("not before the hour is up", async ({ page }) => {
    await seed(page, { ...ONBOARDED, recentMixes: [kept("mix00001", "Too Soon", 50 * 60_000)] });
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("× dismisses it for good, and nothing is counted", async ({ page }) => {
    await seed(page, { ...ONBOARDED, recentMixes: [kept("mix00001", "Gloves On, Volume Up", 2 * HOUR)] });
    let counted = 0;
    page.on("request", (r) => void (r.url().endsWith("/api/event") && counted++));
    await page.goto("/home");
    await card(page).getByRole("button", { name: "Dismiss the check-in" }).click();
    await expect(card(page)).toHaveCount(0);
    expect((await stored(page)).recentMixes[0].checkin).toMatchObject({ dismissed: true });
    await page.reload();
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    expect(counted).toBe(0);
  });

  test("only the most recent kept mix is asked about; older or already-answered ones never are", async ({ page }) => {
    await seed(page, {
      ...ONBOARDED,
      recentMixes: [kept("mix00002", "Newest", 2 * HOUR, { checkin: { answer: "dipped", at: "2026-10-27T11:00:00Z" } }), kept("mix00001", "Older", 5 * HOUR)],
    });
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("mixes kept before Milestone 5 (no keep time) are never asked about", async ({ page }) => {
    await seed(page, { ...ONBOARDED, recentMixes: [{ name: "Old One", routineId: "boxing-bag-rounds", date: "2026-10-12", freshness: 100, tracks: [] }] });
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("keeping a mix remembers when, so the card can ask later; the keep is counted with its freshness and Remixes", async ({ page }) => {
    await seed(page, { ...ONBOARDED, vibes: BOXING_VIBE });
    await page.goto("/mix?routine=boxing-bag-rounds");
    await waitForMix(page);
    await page.getByRole("button", { name: "Remix" }).click();
    await waitForMix(page);
    const counted = page.waitForRequest((r) => r.url().endsWith("/api/event"));
    await keepInYouTubeMusic(page);
    const body = (await counted).postDataJSON();
    expect(body).toMatchObject({ event: "kept", remixes: 1 });
    expect(body.freshness).toBeGreaterThanOrEqual(0);
    const recent = (await stored(page)).recentMixes[0];
    expect(Date.now() - Date.parse(recent.keptAt)).toBeLessThan(60_000);
    expect(recent.id).toBe((await stored(page)).currentMix.id);
  });
});

test.describe("C1: /stats", () => {
  test("STATS_EMAIL's account sees today's counts, the measures with targets, checkpoints and the daily ceiling", async ({ page }) => {
    await seed(page, { ...ONBOARDED, vibes: BOXING_VIBE, recentMixes: [kept("mix00001", "Gloves On, Volume Up", 2 * HOUR)] });
    await page.goto("/home");
    await card(page).getByRole("button", { name: "Carried me" }).click();
    await expect(card(page)).toHaveText(/Noted/);
    await page.goto("/mix?routine=boxing-bag-rounds");
    await waitForMix(page);
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "How it’s going." })).toBeVisible();
    const measures = page.getByTestId("measures");
    for (const [label, target] of [["Keep rate", "over 50%"], ["Swaps per kept mix", "under 3"], ["Carried me", "over 60%"], ["Dipped midway", "under 25%"], ["Freshness", "over 70%"], ["New favourite", "1 in 3"], ["Not found per mix", "under 1"], ["Shared", "1 in 5"]]) {
      await expect(measures.getByRole("row", { name: new RegExp(`^${label}`) })).toContainText(target);
    }
    const today = async (table: string, label: string) => Number((await page.getByTestId(table).getByRole("row", { name: new RegExp(`^${label}`) }).locator("td").first().textContent())!.replace(/,/g, ""));
    expect(await today("counts", "Mixes made")).toBeGreaterThanOrEqual(1);
    expect(await today("counts", "Check-ins")).toBeGreaterThanOrEqual(1);
    expect(await today("checkpoints", "First mix made")).toBeGreaterThanOrEqual(0);
    await expect(page.getByTestId("ceiling")).toHaveText(/Claude mixes today: \d+ of \d+/);
  });

  test.describe("anyone else", () => {
    test.use({ storageState: signedInState(FRIEND) });
    test("another guest gets 'page not found'", async ({ page }) => {
      const res = await page.goto("/stats");
      expect(res!.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "How it’s going." })).toHaveCount(0);
    });
  });

  test.describe("signed out", () => {
    test.use({ storageState: SIGNED_OUT });
    test("gets 'page not found' too", async ({ page }) => {
      expect((await page.goto("/stats"))!.status()).toBe(404);
    });
  });
});
