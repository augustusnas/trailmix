// @vitest-environment node
import type { Mix } from "@/lib/mixTypes";
import { getKV, resetMemoryKV } from "./kv";
import { attachPlaylist, readShare, storeShare } from "./shares";

beforeEach(() => {
  process.env.FAKE_SERVICES = "1";
  resetMemoryKV();
});

const mix: Mix = {
  id: "mix00001", name: "Iron Hour", routineId: "push-day", genres: ["hiphop"], energy: "driven", length: 30, createdAt: "2026-10-22T09:00:00Z",
  tracks: [{ title: "One", artist: "A", durationMs: 200_000, key: "a|one" }],
};
const SAM = { who: "who-sam", firstName: "Sam" };
const PLAYLIST = "PLabcdefghij123";

describe("shared mix pages (Part E)", () => {
  it("say who shared them (first name only), and never store their email", async () => {
    const id = await storeShare(mix, SAM);
    expect((await readShare(id))?.sharedBy).toBe("Sam");
    expect(JSON.stringify(await getKV().get(`share:${id}`))).not.toMatch(/@/);
  });

  it("a link shared before Keep it gets the playlist once kept", async () => {
    const id = await storeShare(mix, SAM);
    expect((await readShare(id))?.mix.playlistId).toBeUndefined();
    expect(await attachPlaylist(id, PLAYLIST, SAM.who)).toBe(true);
    expect((await readShare(id))?.mix.playlistId).toBe(PLAYLIST);
  });

  it("only the person who shared it can attach a playlist", async () => {
    const id = await storeShare(mix, SAM);
    expect(await attachPlaylist(id, PLAYLIST, "who-someone-else")).toBe(false);
    expect((await readShare(id))?.mix.playlistId).toBeUndefined();
  });

  it("links from before sign-in (no owner, no name) still open, and can still be given a playlist", async () => {
    const id = "B".repeat(22);
    await getKV().set(`share:${id}`, { ...mix });
    expect((await readShare(id))?.sharedBy).toBeUndefined();
    expect(await attachPlaylist(id, PLAYLIST, SAM.who)).toBe(true);
    expect((await readShare(id))?.mix.playlistId).toBe(PLAYLIST);
  });
});
