// @vitest-environment node
import { trackKey, type Mix } from "@/lib/mixTypes";
import { playlistTitle } from "@/lib/format";
import { CATALOG } from "./fakes";
import { FAKE_GUEST } from "./google";
import { getKV, resetMemoryKV } from "./kv";
import { checkedTitle, forgetPermission, playlistDescription, quotaDay, savePlaylist, storePermission, UNITS } from "./youtube";

const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env, FAKE_SERVICES: "1", AUTH_SECRET: "test-secret-0123456789" };
  delete process.env.YOUTUBE_SEARCH_DAILY_CAP;
  delete process.env.YOUTUBE_DAILY_UNITS;
  resetMemoryKV();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  process.env = env;
});

const mix = (n = 8, id = "mix00001"): Mix => ({
  id,
  name: "Iron Hour",
  routineId: "push-day",
  genres: ["hiphop"],
  energy: "driven",
  length: 30,
  createdAt: "2026-10-22T09:00:00Z",
  tracks: CATALOG.slice(0, n).map((t) => ({ title: t.title, artist: t.artist, durationMs: t.durationMs, key: trackKey(t.title, t.artist) })),
});

const save = (m = mix(), extra: Partial<Parameters<typeof savePlaylist>[0]> = {}) =>
  savePlaylist({ who: "who-guest", email: FAKE_GUEST, mix: m, title: playlistTitle(m, new Date()), forced: null, ...extra });

const logged = () =>
  (console.log as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => JSON.parse(c[0])).filter((l) => l.event === "youtube-save");

describe("F13, F14: Keep it makes a real playlist", () => {
  it("saves every track, in a new playlist each time", async () => {
    const a = await save();
    const b = await save();
    expect(a).toMatchObject({ ok: true, saved: 8, total: 8, missing: [] });
    expect(a.ok && b.ok && a.playlistId !== b.playlistId).toBe(true);
  });

  it("the description has the routine, energy, length and genres, and no phase wording", () => {
    const d = playlistDescription(mix());
    expect(d).toMatch(/Push day · Driven · 30 min · Hip-hop & UK rap/);
    expect(d).toMatch(/Made with Trailmix$/);
    expect(d).not.toMatch(/warm|main block|cool/i);
  });

  it("uses the phone's title only if it's this mix's title for yesterday, today or tomorrow", () => {
    const m = mix();
    expect(checkedTitle(m, playlistTitle(m, new Date()))).toBe(playlistTitle(m, new Date()));
    expect(checkedTitle(m, "Free prizes")).toMatch(/^Trailmix · Push day · Iron Hour · \d{1,2} \w{3}$/);
  });
});

describe("N14: units, and video ids cached for everyone", () => {
  it("a fresh save searches every track; the same tracks again need no searches", async () => {
    await save();
    await save(mix(8, "mix00002"));
    const [fresh, cached] = logged();
    expect(fresh).toMatchObject({ searches: 8, cachedIds: 0, units: UNITS.playlist + 8 * (UNITS.search + UNITS.insert) });
    expect(cached).toMatchObject({ searches: 0, cachedIds: 8, units: UNITS.playlist + 8 * UNITS.insert });
    expect(await getKV().get(`yt:units:${quotaDay()}`)).toBe(fresh.units + cached.units);
  });

  it("logs no names or emails", async () => {
    await save();
    expect(JSON.stringify(logged())).not.toMatch(/Fake|trailmix\.test|Iron Hour/);
  });
});

describe("E5: YouTube's daily limit", () => {
  it("the test switch blocks the save", async () => {
    expect(await save(mix(), { forced: "e5" })).toEqual({ ok: false, reason: "quota" });
  });

  it("the daily search cap blocks a save that needs more searches than are left, before anything is made", async () => {
    process.env.YOUTUBE_SEARCH_DAILY_CAP = "10";
    expect((await save()).ok).toBe(true); // 8 searches
    expect(await save(mix(12, "mix00002"))).toEqual({ ok: false, reason: "quota" }); // 4 more needed, 2 left
    expect((await save(mix(8, "mix00003"))).ok).toBe(true); // all cached: no searches
  });

  it("so do the project's daily units", async () => {
    process.env.YOUTUBE_DAILY_UNITS = "1000";
    expect(await save()).toEqual({ ok: false, reason: "quota" }); // needs 1,250
  });
});

describe("E6: a save that stops partway", () => {
  it("keeps the playlist, says which tracks are missing, and Retry adds only those", async () => {
    const m = mix(11);
    const first = await save(m, { forced: "e6" });
    expect(first).toMatchObject({ ok: true, saved: 9, total: 11, missing: [3, 7] });
    const again = await save(m, { forced: "e6", retryOf: first.ok ? first.playlistId : "" });
    expect(again).toMatchObject({ ok: true, saved: 11, missing: [] });
    expect(first.ok && again.ok && again.playlistId === first.playlistId).toBe(true);
    expect(logged()[1]).toMatchObject({ retry: true, units: 2 * UNITS.insert, searches: 0 });
  });

  it("Retry for another mix, or a playlist that isn't this account's, does nothing", async () => {
    const first = await save(mix(11), { forced: "e6" });
    const id = first.ok ? first.playlistId : "";
    expect(await save(mix(11, "other001"), { retryOf: id })).toEqual({ ok: false, reason: "failed" });
    expect(await save(mix(11), { retryOf: id, who: "someone-else" })).toEqual({ ok: false, reason: "failed" });
  });
});

describe("The YouTube permission (Part C, E7, E8, N7)", () => {
  const friend = (m = mix()) => save(m, { who: "who-friend", email: "friend@trailmix.test" });

  it("asks for permission the first time, then saves", async () => {
    expect(await friend()).toEqual({ ok: false, reason: "permission" });
    await storePermission("who-friend", { access: "fake-access-f", refresh: "fake-refresh-f", accessExp: Date.now() + 3600_000, youtube: true });
    expect((await friend()).ok).toBe(true);
  });

  it("an unticked YouTube box isn't a permission", async () => {
    await storePermission("who-friend", { access: "a", accessExp: Date.now() + 3600_000, youtube: false });
    expect(await friend()).toEqual({ ok: false, reason: "permission" });
  });

  it("renews an old access token; when Google won't (7 days in Testing mode), it's a quick sign-in and the permission is forgotten", async () => {
    await storePermission("who-friend", { access: "old", refresh: "fake-refresh-f", accessExp: Date.now() - 1000, youtube: true });
    expect((await friend()).ok).toBe(true);
    await storePermission("who-friend", { access: "old", refresh: "revoked", accessExp: Date.now() - 1000, youtube: true });
    expect(await friend()).toEqual({ ok: false, reason: "expired" });
    expect(await friend()).toEqual({ ok: false, reason: "permission" });
  });

  it("the tokens are sealed in storage, never kept as they are", async () => {
    await storePermission("who-friend", { access: "ya29.SECRET-ACCESS", refresh: "1//SECRET-REFRESH", accessExp: Date.now() + 3600_000, youtube: true });
    const stored = JSON.stringify(await getKV().get("ytauth:who-friend"));
    expect(stored).not.toMatch(/SECRET/);
    await forgetPermission("who-friend");
    expect(await getKV().get("ytauth:who-friend")).toBeNull();
  });

  it("a new consent without a refresh token keeps the old one", async () => {
    await storePermission("who-friend", { access: "old", refresh: "fake-refresh-f", accessExp: Date.now() - 1000, youtube: true });
    await storePermission("who-friend", { access: "new", accessExp: Date.now() - 1000, youtube: true });
    expect((await friend()).ok).toBe(true); // renewed with the kept refresh token
  });
});
