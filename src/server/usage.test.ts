// @vitest-environment node
import { POST as event } from "@/app/api/event/route";
import { MemoryKV, getKV, resetMemoryKV } from "./kv";
import { ukDay } from "./limits";
import { SESSION_COOKIE, newSession, seal } from "./session";
import { MEASURES, statsData } from "./statsPage";
import { checkpoint, count, personKey, totals } from "./usage";

const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env, FAKE_SERVICES: "1", AUTH_SECRET: "test-secret-0123456789", GUEST_EMAILS: "sam@example.com" };
  resetMemoryKV();
  vi.useRealTimers();
});
afterAll(() => {
  process.env = env;
});

const SUB = "google-sub-1234567890";
const today = () => totals([ukDay()]);
const post = (body: unknown) =>
  event(
    new Request("https://trailmix.test/api/event", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(seal(newSession(SUB, "sam@example.com", "Sam")))}` },
      body: JSON.stringify(body),
    }),
  );

describe("C1: anonymous daily counters", () => {
  it("add up by day, kept 90 days", async () => {
    await count("made");
    await count("made");
    await count("notFound", 3);
    expect(await today()).toMatchObject({ made: 2, notFound: 3, kept: 0 });
  });

  it("keeps, shares and check-ins from the phone are counted, with freshness and Remixes before the keep", async () => {
    expect((await post({ event: "kept", freshness: 80, remixes: 2 })).status).toBe(200);
    expect((await post({ event: "shared" })).status).toBe(200);
    expect((await post({ event: "checkin", answer: "carried", favourite: true })).status).toBe(200);
    expect((await post({ event: "checkin", answer: "dipped", favourite: false })).status).toBe(200);
    expect(await today()).toMatchObject({ kept: 1, freshness: 80, keptRemixes: 2, shared: 1, checkins: 2, carried: 1, dipped: 1, favourite: 1 });
  });

  it("refuses anything else, and anyone not signed in", async () => {
    expect((await post({ event: "checkin", answer: "loved it" })).status).toBe(400);
    expect((await post({ event: "kept", freshness: 900, remixes: 0 })).status).toBe(400);
    expect((await post({ event: "nonsense" })).status).toBe(400);
    const anon = await event(new Request("https://trailmix.test/api/event", { method: "POST", body: JSON.stringify({ event: "shared" }) }));
    expect(anon.status).toBe(401);
  });

  it("the stats page's measures divide the right counts, with no answer when there's nothing to divide by", async () => {
    await count("made", 4);
    await count("kept", 3);
    await count("swaps", 6);
    await count("shared", 1);
    const t = await today();
    const by = Object.fromEntries(MEASURES.map((m) => [m.label, m.value(t)]));
    expect(by).toMatchObject({ "Keep rate": 0.75, "Swaps per kept mix": 2, Shared: 1 / 3, "Carried me": null });
    const data = await statsData();
    expect(data.periods.map((p) => p.label)).toEqual(["Today", "7 days", "30 days"]);
    expect(data.periods[2].totals.made).toBe(4);
  });
});

describe("C2: checkpoints, counted once per person, with no personal data stored", () => {
  it("each checkpoint counts once per person", async () => {
    await checkpoint(SUB, "mix");
    await checkpoint(SUB, "mix");
    await checkpoint(SUB, "kept");
    await checkpoint(SUB, "carried");
    await checkpoint(SUB, "carried");
    await checkpoint("someone-else", "mix");
    expect(await today()).toMatchObject({ firstMix: 2, firstKept: 1, firstCarried: 1, returned: 0 });
  });

  it("coming back on a later day within 7 days counts once; after 7 days it doesn't", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    await checkpoint(SUB, "mix");
    await checkpoint("late", "mix");
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    await checkpoint(SUB, "kept");
    await checkpoint(SUB, "mix");
    expect((await today()).returned).toBe(1);
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    await checkpoint("late", "mix");
    expect((await today()).returned).toBe(0);
  });

  it("the scrambled id is fixed for a person, can't be the raw id, and changes with the secret", () => {
    const a = personKey(SUB);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(personKey(SUB)).toBe(a);
    expect(a).not.toContain(SUB);
    process.env.AUTH_SECRET = "another-secret-987654";
    expect(personKey(SUB)).not.toBe(a);
  });

  it("nothing stored holds an email, a name or the Google id", async () => {
    await post({ event: "kept", freshness: 90, remixes: 0 });
    await post({ event: "checkin", answer: "carried", favourite: true });
    await checkpoint(SUB, "mix");
    const kv = getKV();
    expect(kv).toBeInstanceOf(MemoryKV);
    const everything = JSON.stringify((kv as MemoryKV).dump());
    expect(everything).toContain("journey:");
    for (const personal of [SUB, "sam@example.com", "Sam"]) expect(everything).not.toContain(personal);
  });
});
