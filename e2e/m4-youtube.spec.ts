import { expect, test, type Page } from "@playwright/test";
import { FRIEND, SAYS_NO, signedInState } from "./auth";
import { BOXING_VIBE, ONBOARDED, seed, stored, waitForMix } from "./helpers";

// Part C: Keep it in YouTube Music saves a real playlist (F13, F14, E5, E6, E8). The test servers
// use stand-ins for Google and YouTube. The usual test account has already given the YouTube
// permission; the friend account hasn't, so it sees the permission step.

const switchOn = (page: Page, v: string) =>
  page.addInitScript(
    (x) => sessionStorage.setItem("trailmix-test-switch", x),
    v,
  );

async function openMix(page: Page) {
  await page.goto("/mix?routine=boxing-bag-rounds");
  await waitForMix(page);
}

test.beforeEach(async ({ page }) =>
  seed(page, { ...ONBOARDED, vibes: BOXING_VIBE }),
);

test("F13: Keep it saves the playlist, and Saved opens it in YouTube Music", async ({
  page,
}) => {
  await openMix(page);
  const title = await page.getByTestId("playlist-title").textContent();
  const sent = page.waitForRequest("**/api/save");
  await page.getByTestId("mix-action").click();
  expect((await sent).postDataJSON().title).toBe(title!.replace(/ /g, " "));
  await page.getByTestId("saved-action").waitFor();
  const mix = (await stored(page)).currentMix;
  expect(mix.playlistId).toMatch(/^PLfake/);
  await expect(
    page.getByRole("link", { name: "Open in YouTube Music" }),
  ).toHaveAttribute(
    "href",
    `https://music.youtube.com/playlist?list=${mix.playlistId}`,
  );
});

test("F14: keeping two mixes of the same routine on one day gives two playlists", async ({
  page,
}) => {
  await openMix(page);
  await page.getByTestId("mix-action").click();
  await page.getByTestId("saved-action").waitFor();
  const first = (await stored(page)).currentMix.playlistId;
  await page.goto("/mix?routine=boxing-bag-rounds");
  await waitForMix(page);
  await page.getByRole("button", { name: "Remix" }).click();
  await waitForMix(page);
  await page.getByTestId("mix-action").click();
  await page.getByTestId("saved-action").waitFor();
  const second = (await stored(page)).currentMix.playlistId;
  expect(second).toMatch(/^PLfake/);
  expect(second).not.toBe(first);
});

test("E6: a partial save says how many went in, and Retry adds the rest", async ({
  page,
}) => {
  await switchOn(page, "e6");
  await openMix(page);
  const total = await page.getByTestId("mix-track").count();
  await page.getByTestId("mix-action").click();
  const box = page.getByTestId("youtube-partial");
  await expect(box).toContainText(
    new RegExp(`Saved ${total - Math.floor(total / 4)} of ${total} tracks`),
  );
  const playlistId = (await stored(page)).currentMix.playlistId;
  const retry = page.waitForRequest("**/api/save");
  await box.getByRole("button", { name: "Retry" }).click();
  expect((await retry).postDataJSON().retryOf).toBe(playlistId);
  await page.getByTestId("saved-action").waitFor();
  expect((await stored(page)).currentMix.playlistId).toBe(playlistId);
});

test.describe("the first Keep it asks for the YouTube permission", () => {
  test.use({ storageState: signedInState(FRIEND) });

  test("one line, then Google's screen, then the save carries on by itself", async ({
    page,
  }) => {
    await openMix(page);
    await page.getByTestId("mix-action").click();
    const box = page.getByTestId("youtube-permission");
    await expect(box).toHaveText(
      /Trailmix needs permission to add this playlist to your YouTube account\./,
    );
    await box.getByRole("link", { name: "Continue to Google" }).click();
    await page.getByTestId("saved-action").waitFor();
    expect((await stored(page)).currentMix.playlistId).toMatch(/^PLfake/);
    // Next time: no permission step.
    await page.goto("/mix?routine=boxing-bag-rounds");
    await waitForMix(page);
    await page.getByRole("button", { name: "Remix" }).click();
    await waitForMix(page);
    await page.getByTestId("mix-action").click();
    await page.getByTestId("saved-action").waitFor();
  });

  test.describe("E8: saying no", () => {
    test.use({ storageState: signedInState(SAYS_NO[0]) });
    test("E8: saying no keeps the mix, and offers another music app or the track list", async ({
      page,
    }) => {
      await page.route("**/api/auth/signin/google?*", (route) =>
        route.continue({ url: `${route.request().url()}&deny=1` }),
      );
      await openMix(page);
      const name = await page.getByRole("heading").first().textContent();
      await page.getByTestId("mix-action").click();
      await page
        .getByTestId("youtube-permission")
        .getByRole("link", { name: "Continue to Google" })
        .click();
      const box = page.getByTestId("youtube-denied");
      await expect(box).toContainText(
        "Without YouTube access I can't save playlists, but you can share the list.",
      );
      await expect(page).toHaveURL(/\/mix\?routine=boxing-bag-rounds$/);
      await expect(page.getByRole("heading").first()).toHaveText(name!);
      await box.getByRole("button", { name: "Open the track list" }).click();
      await expect(page).toHaveURL(/\/m\/[A-Za-z0-9_-]{22}$/);
    });
  });

  test.describe("E8: switching app", () => {
    test.use({ storageState: signedInState(SAYS_NO[1]) });
    test("E8: Switch music app changes Keep it to that app", async ({
      page,
    }) => {
      await page.route("**/api/auth/signin/google?*", (route) =>
        route.continue({ url: `${route.request().url()}&deny=1` }),
      );
      await openMix(page);
      await page.getByTestId("mix-action").click();
      await page
        .getByTestId("youtube-permission")
        .getByRole("link", { name: "Continue to Google" })
        .click();
      await page
        .getByTestId("youtube-denied")
        .getByRole("button", { name: "Switch to Spotify" })
        .click();
      await expect(page.getByTestId("mix-action")).toHaveText(
        "Open in Spotify",
      );
      expect((await stored(page)).musicApp).toBe("spotify");
    });
  });
});
