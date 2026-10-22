import { expect, test } from "@playwright/test";
import { LIMITS_GUEST, signedIn } from "./auth";

// Runs against the copy of the app with the real limits on (see playwright.config.ts), one test at a time.
test.describe.configure({ mode: "serial" });

// Mix, save and share limits count per Google account (E9), so these tests sign in as their own
// account; page views count per IP address, so they use their own pretend address.
const IP = { "x-forwarded-for": "10.99.99.99" };
const headers = { ...signedIn(LIMITS_GUEST), ...IP };
const sampleMix = {
  id: "limitsMix001",
  name: "Limit Test",
  routineId: "tabata",
  genres: ["hiphop"],
  energy: "feral",
  length: 30,
  createdAt: "2026-10-19T10:00:00Z",
  tracks: [{ title: "Song", artist: "Band", durationMs: 200000, key: "band|song", appleUrl: "https://music.apple.com/gb/song/fake/1" }],
};
let shareId = "";

test("E9 / E17: 20 shares a day per Google account, then a friendly message", async ({ request }) => {
  for (let i = 0; i < 20; i++) {
    const res = await request.post("/api/share", { headers, data: { mix: sampleMix } });
    expect(res.status(), `share ${i + 1}`).toBe(200);
    shareId = (await res.json()).id;
  }
  const res = await request.post("/api/share", { headers, data: { mix: sampleMix } });
  expect(res.status()).toBe(429);
  expect((await res.json()).message).toBe("That's today's sharing done. More tomorrow.");
});

test("E17 / N16: 60 shared-page views a minute per visitor, then a friendly page", async ({ request, page }) => {
  expect(shareId).not.toBe("");
  let ok = 0;
  for (let i = 0; i < 60; i++) if ((await request.get(`/m/${shareId}`, { headers: IP })).status() === 200) ok++;
  expect(ok).toBe(60);
  await page.setExtraHTTPHeaders(IP);
  await page.goto(`/m/${shareId}`);
  await expect(page.getByTestId("views-busy")).toHaveText("Easy there. Try again in a minute.");
});

test("E9: 20 mixes an hour per Google account, then a friendly message", async ({ request }) => {
  const data = { routine: "tabata", genres: ["hiphop"], energy: "feral", length: 30, avoid: [] };
  for (let i = 0; i < 20; i++) expect((await request.post("/api/mix", { headers, data })).status(), `mix ${i + 1}`).toBe(200);
  const res = await request.post("/api/mix", { headers, data });
  expect(res.status()).toBe(429);
  expect((await res.json()).message).toBe("That's a lot of mixes. Back in a few minutes.");
});
