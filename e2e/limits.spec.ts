import { expect, test } from "@playwright/test";
import { TEST_ACCESS_CODE } from "./helpers";

// Runs against the copy of the app with the real limits on (see playwright.config.ts), one test at a time.
test.describe.configure({ mode: "serial" });

// Limits count per IP address, so these tests use their own pretend address and don't
// use up the allowance of other tests running on the same copy of the app.
const IP = { "x-forwarded-for": "10.99.99.99" };
const headers = { "x-trailmix-access": TEST_ACCESS_CODE, ...IP };
const sampleMix = {
  id: "limitsMix001",
  name: "Limit Test",
  routineId: "tabata",
  genres: ["uk-rap"],
  energy: "feral",
  length: 30,
  createdAt: "2026-10-19T10:00:00Z",
  tracks: [{ title: "Song", artist: "Band", durationMs: 200000, key: "band|song", appleUrl: "https://music.apple.com/gb/song/fake/1" }],
};
let shareId = "";

test("E17: 20 shares a day per access code, then a friendly message", async ({ request }) => {
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

test("E9: 20 mixes an hour per person, then a friendly message", async ({ request }) => {
  const data = { routine: "tabata", genres: ["uk-rap"], energy: "feral", length: 30, avoid: [] };
  for (let i = 0; i < 20; i++) expect((await request.post("/api/mix", { headers, data })).status(), `mix ${i + 1}`).toBe(200);
  const res = await request.post("/api/mix", { headers, data });
  expect(res.status()).toBe(429);
  expect((await res.json()).message).toBe("That's a lot of mixes. Back in a few minutes.");
});
