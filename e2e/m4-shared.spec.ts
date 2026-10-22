import { expect, test } from "@playwright/test";
import { SIGNED_OUT, signedIn } from "./auth";
import { BOXING_VIBE, ONBOARDED, makeSharedMix, seed, stored, waitForMix } from "./helpers";

// Parts D and E: the shared mix page opens the whole playlist once a mix is kept (for anyone,
// signed out too: the playlist is unlisted), says who shared it, and a link sent before Keep it
// starts working once it's kept. One tap: Keep it opens the playlist in YouTube Music.

const playlist = (id: string) => `https://music.youtube.com/playlist?list=${id}`;

test.describe("Part D: one tap to play", () => {
  test.beforeEach(async ({ page }) => seed(page, { ...ONBOARDED, vibes: BOXING_VIBE }));

  test("Keep it saves, then opens the new playlist in YouTube Music; coming back shows Saved", async ({ page }) => {
    await page.goto("/mix?routine=boxing-bag-rounds");
    await waitForMix(page);
    await page.getByTestId("mix-action").click();
    await page.waitForURL(/^https:\/\/music\.youtube\.com\/playlist\?list=PLfake/);
    // (the stand-in YouTube Music goes straight back, like returning to Trailmix)
    await expect(page).toHaveURL(/\/saved\?routine=boxing-bag-rounds$/);
    await expect(page.getByTestId("saved-action")).toHaveText("Open in YouTube Music");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/saved\?routine=boxing-bag-rounds$/); // not sent off again
    const mix = (await stored(page)).currentMix;
    await expect(page.getByRole("link", { name: "Open in YouTube Music" })).toHaveAttribute("href", playlist(mix.playlistId));
  });
});

test.describe("the shared page, signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("a kept mix: Open the whole playlist, and Shared by the sharer's first name", async ({ page, request }) => {
    const { id, mix } = await makeSharedMix(request);
    const saved = await (await request.post("/api/save", { headers: signedIn(), data: { mix: { ...mix, shareId: id } } })).json();
    expect(saved.playlistId).toMatch(/^PLfake/);
    await page.goto(`/m/${id}`);
    await expect(page.getByText("Shared by Sam")).toBeVisible();
    const open = page.getByTestId("open-playlist");
    await expect(open).toHaveText(/Open the whole playlist/);
    await expect(open).toHaveAttribute("href", playlist(saved.playlistId));
    await expect(page.getByText("Then tap any track below")).toHaveCount(0);
  });

  test("a mix shared before it was kept: the same link gets the playlist once it's kept", async ({ page, request }) => {
    const { id, mix } = await makeSharedMix(request);
    await page.goto(`/m/${id}`);
    await expect(page.getByTestId("open-playlist")).toHaveCount(0);
    await expect(page.getByText("Then tap any track below")).toHaveCount(0);
    const saved = await (await request.post("/api/save", { headers: signedIn(), data: { mix: { ...mix, shareId: id } } })).json();
    await page.reload();
    await expect(page.getByTestId("open-playlist")).toHaveAttribute("href", playlist(saved.playlistId));
  });

  test("the footer links to Privacy and Terms", async ({ page, request }) => {
    const { id } = await makeSharedMix(request);
    await page.goto(`/m/${id}`);
    const links = page.getByTestId("legal-links");
    await expect(links.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await links.getByRole("link", { name: "Terms" }).click();
    await expect(page.getByRole("heading", { name: "Terms." })).toBeVisible();
  });
});

test.describe("Part E: Privacy and Terms", () => {
  test.use({ storageState: SIGNED_OUT });

  test("Terms: beta, no warranty, YouTube's terms, deleting your data, the contact email", async ({ page }) => {
    await page.goto("/terms");
    const text = await page.locator("main").innerText();
    for (const phrase of [/beta/i, /no warranty/i, /YouTube’s Terms of Service/, /deleting your data/i, /trailmix@augustusnas\.com/]) expect(text).toMatch(phrase);
    await expect(page.getByRole("link", { name: "YouTube Terms of Service" })).toHaveAttribute("href", "https://www.youtube.com/t/terms");
    await expect(page.getByTestId("contact-email")).toHaveAttribute("href", "mailto:trailmix@augustusnas.com");
  });

  test("Welcome links to Terms next to Privacy", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("legal-links").getByRole("link", { name: "Terms" }).click();
    await expect(page).toHaveURL(/\/terms$/);
  });

  test("Privacy is in the present tense, with the Google data and no access codes", async ({ page }) => {
    await page.goto("/privacy");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/access code|coming soon|will soon|no cookies/i);
    for (const phrase of [/Trailmix uses Google sign-in and YouTube API Services/, /one cookie: your sign-in/i, /first name, email address/i, /encrypted/i, /7 days/]) expect(text).toMatch(phrase);
  });
});
