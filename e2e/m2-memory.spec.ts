import { expect, test } from "@playwright/test";
import { DEFAULT_PINS } from "../src/data/routines";
import { DAMAGED } from "../src/app/reset/ResetScreen";
import { BOXING_VIBE, ONBOARDED, STORAGE_KEY, laceUp, makeSharedMix, record, sawWelcome, seed, stored, waitForMix, watchForWelcome } from "./helpers";

const pinIds = async (page: import("@playwright/test").Page) =>
  page.locator("button[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")));

// ---------- F2: returning goes straight to Home, with no flash of Welcome ----------

test.describe("F2: coming back", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, ONBOARDED);
    await watchForWelcome(page);
  });

  for (const path of ["/", "/listen", "/home"]) {
    test(`opening ${path} goes straight to Home`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
      expect(await sawWelcome(page)).toBe(false);
    });
  }
});

test("a new phone opening an app screen is sent to Welcome", async ({ page }) => {
  for (const path of ["/home", "/library", "/vibe?routine=tabata"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
});

// ---------- F3, F4, F5: pins ----------

test.describe("pins", () => {
  test.beforeEach(async ({ page }) => seed(page, ONBOARDED));

  test("F3: pinning adds to the end of Home in its colour, and the count goes up", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Pin to home: Yoga flow" }).click();
    await expect(page.getByTestId("pin-count")).toHaveText(/4 of 6 on home/i);
    await expect(page.getByRole("button", { name: "Unpin Yoga flow" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect.poll(() => pinIds(page)).toEqual([...DEFAULT_PINS, "yoga-flow"]);
    await expect(page.locator('button[data-routine="yoga-flow"]')).toHaveCSS("background-color", "rgb(31, 61, 43)");
    await expect(page.getByTestId("pin-another")).toContainText("4 of 6");
    await page.reload();
    await expect.poll(() => pinIds(page)).toEqual([...DEFAULT_PINS, "yoga-flow"]);
  });

  test("F4: at 6 pins the rest are disabled, the notice shows, and Home is full", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByTestId("home-full")).toHaveCount(0);
    for (const name of ["Tabata", "Yoga flow", "EMOM"]) await page.getByRole("button", { name: `Pin to home: ${name}` }).click();
    await expect(page.getByTestId("home-full")).toHaveText("Home is full. Unpin one to add another.");
    const blocked = page.getByRole("button", { name: "Pin to home: AMRAP (Home is full)" });
    await expect(blocked).toBeDisabled();
    // every unpinned routine is disabled; pinned ones can still be unpinned
    await expect(page.locator('li[data-routine] button[aria-pressed="false"]:disabled')).toHaveCount(11);
    await expect(page.getByRole("button", { name: "Unpin Tabata" })).toBeEnabled();

    await page.getByRole("link", { name: "Back to home" }).click();
    const tile = page.getByTestId("pin-another");
    await expect(tile).toContainText("Home is full");
    await expect(tile).toContainText("6 of 6");
    await tile.click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("F5: unpinning removes it from Home straight away and frees a slot", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Unpin Incline treadmill" }).click();
    await expect(page.getByTestId("pin-count")).toHaveText(/2 of 6/i);
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect.poll(() => pinIds(page)).toEqual(["push-day", "hiit-circuit"]);
  });

  test("unpinning to zero shows the empty state, never the defaults, and keeps vibes", async ({ page }) => {
    await page.goto("/vibe?routine=push-day");
    await page.getByRole("button", { name: "Rock" }).click();
    await page.getByRole("button", { name: "Make the mix" }).click();
    await expect(page).toHaveURL(/\/mix/);
    await page.goto("/library");
    for (const name of ["Push day", "Incline treadmill", "HIIT circuit"]) await page.getByRole("button", { name: `Unpin ${name}` }).click();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page.getByTestId("home-empty")).toContainText("Pin a routine to get started");
    await expect.poll(() => pinIds(page)).toEqual([]);
    await page.reload();
    await expect(page.getByTestId("home-empty")).toBeVisible();
    await page.getByRole("link", { name: "Open the library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    expect((await stored(page)).vibes["push-day"].genres).toEqual(["rock-indie"]); // saved as the old "rock", kept as its new genre
  });
});

// ---------- F6: search and filters ----------

test.describe("F6: Library search and filters", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, ONBOARDED);
    await page.goto("/library");
    // Wait until the Library is ready (it shows the pin count), so typing isn't lost.
    await expect(page.getByTestId("pin-count")).toHaveText(/of 6 on home/i);
  });
  const shown = (page: import("@playwright/test").Page) =>
    page.locator("li[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")));
  const search = (page: import("@playwright/test").Page) => page.getByLabel("Find a routine");

  test('"tab" finds Tabata, as you type', async ({ page }) => {
    await search(page).pressSequentially("tab");
    await expect.poll(() => shown(page)).toEqual(["tabata"]);
  });

  test('"push" finds Push day; case and spaces don\'t matter', async ({ page }) => {
    await search(page).fill("  PUSH ");
    await expect.poll(() => shown(page)).toEqual(["push-day"]);
  });

  test('"cardio" finds all four Cardio routines', async ({ page }) => {
    await search(page).fill("cardio");
    await expect.poll(() => shown(page)).toEqual(["indoor-walk", "incline-treadmill", "spin-bike", "rowing-intervals"]);
  });

  test("no match shows the message and Clear search brings everything back", async ({ page }) => {
    await search(page).fill("zumba");
    await expect(page.getByTestId("no-match")).toContainText("Nothing on that trail. Try another word.");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search(page)).toHaveValue("");
    await expect.poll(() => shown(page)).toHaveLength(17);
  });

  test("one filter chip at a time, combined with the search", async ({ page }) => {
    const chip = (n: string) => page.getByRole("group", { name: "Filter by category" }).getByRole("button", { name: n });
    await chip("Recovery").click();
    await expect.poll(() => shown(page)).toEqual(["stretch-mobility", "yoga-flow"]);
    await chip("Strength").click();
    await expect(chip("Recovery")).toHaveAttribute("aria-pressed", "false");
    await expect(chip("Strength")).toHaveAttribute("aria-pressed", "true");
    await search(page).fill("day");
    await expect.poll(() => shown(page)).toEqual(["push-day", "pull-day"]);
    await chip("All").click();
    await expect.poll(() => shown(page)).toEqual(["push-day", "pull-day"]);
  });

  test("search and filter reset after leaving the Library", async ({ page }) => {
    await search(page).fill("tab");
    await page.getByRole("button", { name: "Combat" }).click();
    await page.getByRole("link", { name: "Back to home" }).click();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await expect(search(page)).toHaveValue("");
    await expect(page.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => shown(page)).toHaveLength(17);
  });
});

// ---------- F7, F8: Set the vibe ----------

test.describe("Set the vibe", () => {
  test.beforeEach(async ({ page }) => seed(page, ONBOARDED));
  const pressed = (page: import("@playwright/test").Page) =>
    page.locator('main button[aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.textContent));

  test("first time: no genre, Steady, length from the routine (Tabata 30, Push day 45)", async ({ page }) => {
    await page.goto("/vibe?routine=tabata");
    await expect.poll(() => pressed(page)).toEqual(["Steady", "30"]);
    await page.goto("/vibe?routine=push-day");
    await expect.poll(() => pressed(page)).toEqual(["Steady", "45"]);
  });

  test("F7: Make the mix saves each routine's settings, separately", async ({ page }) => {
    await page.goto("/vibe?routine=boxing-bag-rounds");
    for (const b of ["UK rap & grime", "Drum & bass", "Feral", "60 minutes"]) await page.getByRole("button", { name: b }).click();
    await page.getByRole("button", { name: "Make the mix" }).click();
    await expect(page).toHaveURL(/\/mix/);

    // From the Library, and after a full reload, Boxing remembers…
    await page.goto("/library");
    await page.getByRole("link", { name: "Use Boxing bag rounds" }).click();
    await expect.poll(() => pressed(page)).toEqual(["UK rap & grime", "Drum & bass", "Feral", "60"]);
    await page.reload();
    await expect.poll(() => pressed(page)).toEqual(["UK rap & grime", "Drum & bass", "Feral", "60"]);

    // …and Push day is untouched.
    await page.goto("/home");
    await page.getByRole("link", { name: "Set the vibe" }).click();
    await expect(page).toHaveURL(/routine=push-day/);
    await expect.poll(() => pressed(page)).toEqual(["Steady", "45"]);
  });

  test("changes that aren't made into a mix aren't saved", async ({ page }) => {
    await page.goto("/vibe?routine=tabata");
    await page.getByRole("button", { name: "R&B & soul" }).click();
    await page.reload();
    await expect.poll(() => pressed(page)).toEqual(["Steady", "30"]);
  });

  test("F8: no genre shows an inline message, doesn't save and doesn't move on", async ({ page }) => {
    await page.goto("/vibe?routine=tabata");
    let dialogs = 0;
    page.on("dialog", () => dialogs++);
    await page.getByRole("button", { name: "Make the mix" }).click();
    const msg = page.getByTestId("genre-message");
    await expect(msg).toHaveText("Pick at least one genre.");
    await expect(msg).toHaveAttribute("aria-live", "polite");
    await expect(page).toHaveURL(/\/vibe\?routine=tabata$/);
    expect(dialogs).toBe(0);
    expect((await stored(page)).vibes.tabata).toBeUndefined();
    await page.getByRole("button", { name: "R&B & soul" }).click();
    await expect(msg).toHaveText("");
  });

  test("up to 3 genres: the rest are disabled until one is unticked", async ({ page }) => {
    await page.goto("/vibe?routine=tabata");
    for (const g of ["R&B & soul", "Funk & disco", "Pop"]) await page.getByRole("button", { name: g }).click();
    await expect(page.getByTestId("genre-message")).toHaveText("That’s 3. Untick one to swap.");
    await expect(page.getByRole("button", { name: "Rock & indie" })).toBeDisabled();
    await page.getByRole("button", { name: "Pop" }).click();
    await expect(page.getByRole("button", { name: "Rock & indie" })).toBeEnabled();
  });
});

// ---------- F20: the music app ----------

test("F20: chosen once, never asked again, used on The mix and Saved, changeable in the Library", async ({ page }) => {
  await page.goto("/");
  await laceUp(page);
  await page.getByRole("button", { name: /Spotify/ }).click();
  await page.getByRole("button", { name: "That’s me" }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect((await stored(page)).musicApp).toBe("spotify");

  await page.goto("/listen"); // never asked again
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/vibe?routine=push-day");
  await page.getByRole("button", { name: "Rock" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await waitForMix(page);
  await expect(page.getByTestId("mix-action")).toHaveText("Open in Spotify");
  // Spotify users: the mix is stored and its page opens with Spotify first.
  await page.getByTestId("mix-action").click();
  await expect(page).toHaveURL(/\/m\/[\w-]{22}$/);
  await expect(page.getByTestId("lead-app")).toContainText("Open in Spotify");
  await page.goto("/saved?routine=push-day");
  await expect(page.getByTestId("saved-action")).toHaveText("Open in Spotify");
  await expect(page.getByRole("heading", { name: "Your mix is ready to play in Spotify, track by track." })).toBeVisible();

  // Change it in the Library: the label updates at once, no reload.
  await page.goto("/library");
  const row = page.getByTestId("listening-on");
  await expect(row).toContainText("Listening on Spotify");
  await row.getByRole("button", { name: "Change" }).click();
  await row.getByRole("button", { name: "Apple Music" }).click();
  await expect(row).toContainText("Listening on Apple Music");

  await page.getByRole("link", { name: "Use Push day" }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await waitForMix(page);
  await expect(page.getByTestId("mix-action")).toHaveText("Open in Apple Music");
  await page.getByTestId("mix-action").click();
  await expect(page.getByTestId("lead-app")).toContainText("Open in Apple Music");
});

test("YouTube Music labels", async ({ page }) => {
  await seed(page, { ...ONBOARDED, vibes: BOXING_VIBE });
  await page.goto("/mix?routine=boxing-bag-rounds");
  await waitForMix(page);
  await expect(page.getByTestId("mix-action")).toHaveText("Keep it in YouTube Music");
  await page.getByTestId("mix-action").click();
  await expect(page.getByTestId("saved-action")).toHaveText("Open in YouTube Music");
});

// ---------- Shared page leads with the visitor's app ----------

test.describe("shared mix page", () => {
  test("no app remembered: asks first, with three equal buttons, then remembers the pick", async ({ page, request }) => {
    const { id } = await makeSharedMix(request);
    const { id: another } = await makeSharedMix(request);
    await page.goto(`/m/${id}`);
    await expect(page.getByRole("heading", { name: "Where do you listen?" })).toBeVisible();
    const buttons = page.getByRole("group", { name: "Where do you listen?" }).getByRole("button");
    await expect(buttons).toHaveText(["YouTube Music", "Spotify", "Apple Music"]);
    const widths = await buttons.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBe(1);

    await buttons.nth(1).click();
    await expect(page.getByTestId("lead-app")).toContainText("Open in Spotify");
    await expect(page.locator("a.track").first()).toHaveAttribute("href", /open\.spotify\.com/);
    expect((await stored(page)).musicApp).toBe("spotify");

    await page.goto(`/m/${another}`); // their next shared mix leads with it
    await expect(page.getByTestId("lead-app")).toContainText("Open in Spotify");
    // not counted as having set up Trailmix
    expect((await stored(page)).onboarded).toBe(false);
  });

  test("app remembered: it comes first and largest; picking another updates the memory", async ({ page, request }) => {
    const { id } = await makeSharedMix(request);
    await seed(page, ONBOARDED); // a Trailmix user on YouTube Music
    await page.goto(`/m/${id}`);
    const lead = page.getByTestId("lead-app");
    await expect(lead).toContainText("Open in YouTube Music");
    const others = page.getByRole("group", { name: "Other music apps" }).getByRole("button");
    await expect(others).toHaveText(["Spotify", "Apple Music"]);
    const leadBox = (await lead.boundingBox())!;
    const otherBox = (await others.first().boundingBox())!;
    expect(leadBox.width * leadBox.height).toBeGreaterThan(otherBox.width * otherBox.height);
    expect(leadBox.y).toBeLessThan(otherBox.y);

    await others.getByText("Apple Music").click();
    await expect(lead).toContainText("Open in Apple Music");
    expect((await stored(page)).musicApp).toBe("apple");
  });
});

// ---------- E12: damaged data ----------

test.describe("E12: damaged or wrong-version data", () => {
  const cases = {
    unreadable: '{"version":1,"onboarded":true,"pins":"oops", "vibes":[1,2',
    "wrong version": JSON.stringify({ version: 42, onboarded: true, pins: ["tabata"] }),
    "wrong shape": JSON.stringify({ version: 1, onboarded: true, pins: "tabata", vibes: [1], musicApp: 7 }),
    "retired ids": record({ ...ONBOARDED, pins: ["tabata", "sumo-wrestling"], vibes: { "sumo-wrestling": { genres: ["house"], energy: "easy", length: 30 } } }),
  };

  for (const [label, text] of Object.entries(cases)) {
    test(`${label}: quietly recovers, still skips Welcome, shows no error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await seed(page, text);
      await page.goto("/");
      await expect(page).toHaveURL(/\/home$/);
      const expected = label === "retired ids" ? ["tabata"] : DEFAULT_PINS;
      await expect.poll(() => page.locator("button[data-routine]").evaluateAll((els) => els.map((e) => e.getAttribute("data-routine")))).toEqual(expected);
      await expect(page.getByText(/error|went wrong/i)).toHaveCount(0);
      expect(errors).toEqual([]);
      // the app keeps working
      await page.goto("/library");
      await expect(page.locator("li[data-routine]")).toHaveCount(17);
    });
  }

  const SIX = ["tabata", "yoga-flow", "emom", "amrap", "pull-day", "spin-bike"];
  const damage = (page: import("@playwright/test").Page) =>
    page.evaluate(([key, text]) => localStorage.setItem(key, text), [STORAGE_KEY, DAMAGED] as const);

  test("damage, then reload: Home shows Push day, Incline treadmill and HIIT circuit, with no Welcome", async ({ page }) => {
    await seed(page, { ...ONBOARDED, pins: SIX });
    await watchForWelcome(page);
    await page.goto("/home");
    await expect.poll(() => pinIds(page)).toEqual(SIX);

    await damage(page);
    await page.reload();
    await expect(page).toHaveURL(/\/home$/);
    await expect.poll(() => pinIds(page)).toEqual(["push-day", "incline-treadmill", "hiit-circuit"]);
    await expect(page.getByText(/error|went wrong/i)).toHaveCount(0);
    expect(await sawWelcome(page)).toBe(false);
  });

  test("damage is noticed even without a reload, and the old pins are never written back over it", async ({ page }) => {
    await seed(page, { ...ONBOARDED, pins: SIX });
    await page.goto("/library");
    await expect(page.getByTestId("pin-count")).toHaveText(/6 of 6/i);
    await damage(page);

    // Moving inside the app (no reload) reads the damaged data fresh.
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect.poll(() => pinIds(page)).toEqual(["push-day", "incline-treadmill", "hiit-circuit"]);

    // The next change builds on the recovered defaults, not the old in-memory six.
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Pin to home: Tabata" }).click();
    expect((await stored(page)).pins).toEqual(["push-day", "incline-treadmill", "hiit-circuit", "tabata"]);
  });

  test("a phone that refuses storage (private browsing) still works without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Storage.prototype.getItem = fail;
      Storage.prototype.setItem = fail;
      Storage.prototype.removeItem = fail;
    });
    await page.goto("/");
    await laceUp(page);
    await page.getByRole("button", { name: "That’s me" }).click();
    await expect(page.getByRole("heading", { name: "What’s the terrain today?" })).toBeVisible();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: "Pin to home: Tabata" }).click();
    await expect(page.getByTestId("pin-count")).toHaveText(/4 of 6/i);
    expect(errors).toEqual([]);
  });
});

// ---------- Privacy ----------

test("privacy: no cookies; pins and the music app never reach our server; vibes only when making a mix", async ({ page, context, baseURL }) => {
  const sent: { url: string; method: string; body: string; headers: string }[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith(baseURL!)) sent.push({ url: r.url(), method: r.method(), body: r.postData() ?? "", headers: JSON.stringify(r.headers()) });
  });

  await page.goto("/");
  await laceUp(page);
  await page.getByRole("button", { name: /Spotify/ }).click();
  await page.getByRole("button", { name: "That’s me" }).click();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Pin to home: Stretch & mobility" }).click();
  await page.getByRole("link", { name: "Use Kettlebell flow" }).click();
  for (const b of ["Afrobeats & amapiano", "Funk & disco", "Feral", "90 minutes"]) await page.getByRole("button", { name: b }).click();
  await page.getByRole("button", { name: "Make the mix" }).click();
  await waitForMix(page);
  await page.getByTestId("mix-action").click();
  await expect(page).toHaveURL(/\/m\//);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");

  expect(await context.cookies()).toEqual([]);
  expect(sent.length).toBeGreaterThan(0);
  for (const r of sent) {
    const url = new URL(r.url);
    // Addresses only ever carry which routine is open.
    for (const key of url.searchParams.keys()) expect(["routine", "_rsc"], r.url).toContain(key);
    const everything = `${r.url} ${r.body} ${r.headers}`.toLowerCase();
    // Never: pins, the music app, or the saved record itself.
    for (const secret of ["stretch-mobility", "spotify", "pins", "musicapp", "onboarded", STORAGE_KEY + "\""]) {
      if (secret === "spotify" && /\/api\/(links|share)$/.test(url.pathname)) continue; // track links for every app
      if (secret === "stretch-mobility" && url.pathname === "/vibe") continue; // the Library's "use" link prefetch
      expect(everything, `${secret} in ${r.method} ${r.url}`).not.toContain(secret);
    }
    // The vibe goes only to the routes that make mixes, never in an address.
    // (and to /api/share, which stores the mix with its genres for the shared page).
    if (!["/api/mix", "/api/swap", "/api/share"].includes(url.pathname)) {
      for (const vibe of ["afro", "funk-disco", "feral"]) expect(everything, `${vibe} in ${r.url}`).not.toContain(vibe);
    }
    expect(r.headers).not.toContain('"cookie"');
  }
});
