import { expect, test } from "@playwright/test";
import { FRIEND, SIGNED_OUT, STRANGER, signedIn } from "./auth";
import { BOXING_VIBE, ONBOARDED, seed, stored, waitForMix } from "./helpers";

// Part B: Google sign-in and the guest list (F1, F2, E7, E13, N6, N7). The test servers use a
// stand-in Google that signs straight in as the account a test asks for.

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("F1: Welcome → Sign in with Google → Where do you listen → Home with the three default pins", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Lace up" })).toHaveCount(0);
    await expect(page.getByText("Invite only: use the Google account you were invited with")).toBeVisible();
    await page.getByRole("link", { name: "Sign in with Google" }).click();
    await expect(page).toHaveURL(/\/listen$/);
    await page.getByRole("button", { name: /YouTube Music/ }).click();
    await page.getByRole("button", { name: "That’s me" }).click();
    await expect(page).toHaveURL(/\/home$/);
    for (const name of ["Push day", "Incline treadmill", "HIIT circuit"]) await expect(page.getByText(name).first()).toBeVisible();
  });

  test("E13: an account not on the guest list stays out, and Welcome explains invite-only", async ({ page, context }) => {
    await page.goto(`/api/auth/signin/google?${new URLSearchParams({ returnTo: "/listen", as: STRANGER })}`);
    await expect(page).toHaveURL(/\/\?signin=notInvited$/);
    await expect(page.getByTestId("signin-note")).toHaveText(/Trailmix is invite-only for now, and that Google account isn't on the guest list/);
    expect((await context.cookies()).some((c) => c.name === "trailmix-session")).toBe(false);
  });

  test("cancelling on Google's screen comes back to Welcome with a kind note", async ({ page }) => {
    await page.goto("/api/auth/callback/google?error=access_denied&state=x");
    await expect(page.getByTestId("signin-note")).toHaveText("Sign-in didn't finish. Try again when you're ready.");
  });

  test("a sign-in that didn't start here (wrong state) doesn't sign anyone in", async ({ page, context }) => {
    await page.goto("/api/auth/callback/google?code=fake:guest@trailmix.test&state=made-up");
    await expect(page).toHaveURL(/signin=cancelled/);
    expect((await context.cookies()).some((c) => c.name === "trailmix-session")).toBe(false);
  });

  test("E7: signed out on a phone with a mix → 'Quick sign-in needed, your mix is safe', then back to the same mix", async ({ page }) => {
    const mix = {
      id: "keepme01", name: "Still Here", routineId: "boxing-bag-rounds", genres: ["hiphop"], energy: "driven", length: 45, createdAt: "2026-10-22T09:00:00Z", freshness: 100,
      tracks: Array.from({ length: 12 }, (_, i) => ({ title: `Song ${i}`, artist: `Artist ${i}`, durationMs: 225_000, key: `artist ${i}|song ${i}` })),
    };
    await seed(page, { ...ONBOARDED, vibes: BOXING_VIBE, currentMix: mix });
    await page.goto("/mix?routine=boxing-bag-rounds");
    await expect(page.getByRole("heading", { name: "Still Here" })).toBeVisible();
    await page.getByRole("button", { name: "Remix" }).click();
    await expect(page.getByTestId("mix-problem")).toContainText("Quick sign-in needed, your mix is safe.");
    await expect(page.getByRole("heading", { name: "Still Here" })).toBeVisible(); // the mix is still there
    await page.getByTestId("mix-problem").getByRole("link", { name: "Sign in with Google" }).click();
    await expect(page).toHaveURL(/\/mix\?routine=boxing-bag-rounds$/);
    await expect(page.getByRole("heading", { name: "Still Here" })).toBeVisible();
    expect((await stored(page)).currentMix.id).toBe("keepme01");
    await page.getByRole("button", { name: "Remix" }).click(); // signed in now: it works
    await waitForMix(page);
    await expect(page.getByRole("heading", { name: "Still Here" })).toHaveCount(0);
  });
});

test("F2: a returning signed-in guest goes straight to Home", async ({ page }) => {
  await seed(page, ONBOARDED);
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
});

test("E13: someone taken off the guest list is signed out at their next request, and Welcome explains", async ({ page, context }) => {
  // Signed in as an account the server then refuses (here: a session for someone not on the list).
  await context.clearCookies();
  const stranger = signedIn(STRANGER).cookie.split("=");
  await context.addCookies([{ name: stranger[0], value: stranger.slice(1).join("="), domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await seed(page, { ...ONBOARDED, vibes: BOXING_VIBE });
  await page.goto("/mix?routine=boxing-bag-rounds");
  await expect(page).toHaveURL(/\/\?signin=notInvited$/);
  await expect(page.getByTestId("signin-note")).toBeVisible();
  expect((await stored(page)).onboarded).toBe(false);
  expect((await stored(page)).vibes["boxing-bag-rounds"]).toBeTruthy(); // their settings are kept
  expect((await context.cookies()).some((c) => c.name === "trailmix-session")).toBe(false);
});

test.describe("N6: every server route refuses requests without a signed-in guest", () => {
  test.use({ storageState: SIGNED_OUT });
  const routes = ["/api/mix", "/api/swap", "/api/links", "/api/share"];
  const data = { routine: "tabata", genres: ["hiphop"], energy: "easy", length: 30 };
  for (const route of routes) {
    test(`${route}`, async ({ request }) => {
      for (const headers of [{}, { cookie: "trailmix-session=made-up" }, { "x-trailmix-access": "old-beta-code" }] as Record<string, string>[]) {
        const res = await request.post(route, { headers, data });
        expect(res.status()).toBe(401);
        expect((await res.json()).message).toBe("Quick sign-in needed, your mix is safe.");
      }
      const off = await request.post(route, { headers: signedIn(STRANGER), data });
      expect(off.status()).toBe(401);
      expect((await off.json()).error).toBe("notInvited");
    });
  }

  test("an expired session (over 7 days) is refused", async ({ request }) => {
    const res = await request.post("/api/mix", { headers: signedIn(FRIEND, Date.now() - 8 * 86400_000), data });
    expect((await res.json()).error).toBe("signin");
  });

  test("the old access-code route is gone", async ({ request }) => {
    expect((await request.post("/api/access", { data: { code: "x" } })).status()).toBe(404);
  });
});

test("N7: the session cookie is HTTP-only, SameSite=Lax and unreadable by the page; Secure on https", async ({ page, context, request }) => {
  await context.clearCookies();
  await page.goto("/api/auth/signin/google?returnTo=/privacy");
  await expect(page).toHaveURL(/\/privacy$/);
  const c = (await context.cookies()).find((x) => x.name === "trailmix-session")!;
  expect(c.httpOnly).toBe(true);
  expect(c.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain("trailmix-session");
  expect(c.value).not.toMatch(/guest|trailmix\.test/i); // sealed: no email inside in plain text
  // The live app is https: there the cookie is Secure too.
  const start = await request.get("/api/auth/signin/google?returnTo=/home", { headers: { "x-forwarded-proto": "https" }, maxRedirects: 0 });
  const oauth = start.headers()["set-cookie"];
  expect(oauth).toMatch(/HttpOnly/);
  expect(oauth).toMatch(/Secure/);
  const callback = new URL(start.headers()["location"]);
  const back = await request.get(callback.pathname + callback.search, { headers: { "x-forwarded-proto": "https", cookie: oauth.split(";")[0] }, maxRedirects: 0 });
  const session = back.headers()["set-cookie"];
  expect(session).toMatch(/trailmix-session=[^;]+; Path=\/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure/);
});
