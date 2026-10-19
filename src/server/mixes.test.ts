// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { getRoutine } from "@/data/routines";
import { runningMs, trackKey } from "@/lib/mixTypes";
import { classify, setClaudeClientForTests, suggestMix } from "./claude";
import { CATALOG } from "./fakes";
import { TOLERANCE_MS, fitToLength, separateArtists } from "./fit";
import { resetMemoryKV } from "./kv";
import { MAX_TRACK_MS, MIN_TRACK_MS, appleSongUrl, bestMatch, findAppleLink, simplify } from "./lookup";
import { makeMix, swapTrack } from "./mixes";
import { mixPrompt, trackPlan } from "./prompt";
import type { MixRequest } from "./validate";

const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env, FAKE_SERVICES: "1", BETA_ACCESS_CODE: "x" };
  resetMemoryKV();
});
afterAll(() => {
  process.env = env;
});

const request = (over: Partial<MixRequest> = {}): MixRequest => ({
  routine: getRoutine("boxing-bag-rounds")!,
  genres: ["grime", "dnb"],
  energy: "driven",
  length: 45,
  avoid: [],
  ...over,
});
const ask = (over: Partial<MixRequest> = {}, forced: string | null = null) => ({
  req: request(over),
  usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
  forced,
});

describe("F10: fit to length", () => {
  const t = (phase: "warm-up" | "main" | "cool-down", min: number) => ({ phase, durationMs: min * 60_000, artist: "a" });

  it("keeps warm-up and cool-down whole and fills the main block in order", () => {
    const tracks = [t("warm-up", 4), t("warm-up", 4), ...Array.from({ length: 12 }, () => t("main", 4)), t("cool-down", 4)];
    const fit = fitToLength(tracks, 45);
    expect(fit.status).toBe("ok");
    expect(fit.tracks.filter((x) => x.phase === "warm-up")).toHaveLength(2);
    expect(fit.tracks.filter((x) => x.phase === "cool-down")).toHaveLength(1);
    expect(Math.abs(fit.totalMs - 45 * 60_000)).toBeLessThanOrEqual(TOLERANCE_MS);
  });

  it("skips one long track that would overshoot, using a shorter spare", () => {
    const tracks = [t("warm-up", 5), ...Array.from({ length: 4 }, () => t("main", 4)), t("main", 12), t("main", 3), t("cool-down", 4)];
    const fit = fitToLength(tracks, 30);
    expect(fit.tracks.some((x) => x.durationMs === 12 * 60_000)).toBe(false);
    expect(fit.status).toBe("ok");
  });

  it("reports short when there aren't enough tracks", () => {
    expect(fitToLength([t("warm-up", 4), t("main", 4)], 60).status).toBe("short");
  });

  it("never puts the same artist twice in a row when it can avoid it", () => {
    const tracks = [
      { phase: "main" as const, durationMs: 1, artist: "A" },
      { phase: "main" as const, durationMs: 1, artist: "A" },
      { phase: "main" as const, durationMs: 1, artist: "B" },
    ];
    expect(separateArtists(tracks).map((x) => x.artist)).toEqual(["A", "B", "A"]);
  });
});

describe("track matching (Deezer, then iTunes for Apple links)", () => {
  it("simplifies titles", () => {
    expect(simplify("Gypsy Woman (She's Homeless) [2019 Remaster]")).toBe("gypsy woman she s homeless");
    expect(simplify("Jungle (feat. Someone)")).toBe("jungle");
    expect(simplify("Beyoncé")).toBe("beyonce");
  });

  it("matches the right song by title and artist, not a cover", () => {
    const results = [
      { title: "Show Me Love", artist: "Karaoke Kings", url: "https://a/1", durationMs: 200_000 },
      { title: "Show Me Love (Radio Edit)", artist: "Robin S", url: "https://a/2", durationMs: 210_000 },
    ];
    expect(bestMatch(results, "Show Me Love", "Robin S")?.url).toBe("https://a/2");
    expect(bestMatch(results, "Imaginary Song", "Nobody")).toBeUndefined();
  });

  it("ignores a leading 'The' and featured artists", () => {
    const results = [{ title: "Titanium (feat. Sia)", artist: "David Guetta", durationMs: 245_000 }];
    expect(bestMatch(results, "Titanium", "David Guetta")).toBeDefined();
    expect(bestMatch([{ title: "Next Episode", artist: "Dr. Dre", durationMs: 160_000 }], "The Next Episode", "Dr. Dre")).toBeDefined();
  });

  it("skips snippets under 1½ minutes", () => {
    const snippet = { title: "Bitches Brew", artist: "Miles Davis", durationMs: 54_000 };
    expect(bestMatch([snippet], "Bitches Brew", "Miles Davis")).toBeUndefined();
    expect(bestMatch([{ ...snippet, durationMs: MIN_TRACK_MS }], "Bitches Brew", "Miles Davis")).toBeDefined();
  });

  it("skips album-length versions over 9 minutes", () => {
    const long = { title: "Chameleon", artist: "Herbie Hancock", durationMs: 15.7 * 60_000 };
    expect(bestMatch([long], "Chameleon", "Herbie Hancock")).toBeUndefined();
    expect(bestMatch([{ ...long, durationMs: MAX_TRACK_MS }], "Chameleon", "Herbie Hancock")).toBeDefined();
  });

  it("keeps the song in Apple links, not just the album", () => {
    expect(appleSongUrl("https://music.apple.com/gb/album/hate-me-now/1223059940?i=1223060123&uo=4")).toBe(
      "https://music.apple.com/gb/album/hate-me-now/1223059940?i=1223060123",
    );
  });
});

describe("F9: making a mix", () => {
  it("plans about 20% more tracks than the length needs", () => {
    const p = trackPlan(45);
    expect(p["warm-up"] + p.main + p["cool-down"]).toBe(Math.round((45 / 3.7) * 1.2));
  });

  for (const length of [30, 45, 60, 90]) {
    it(`a ${length}-minute mix is within 5 minutes of ${length} (F10)`, async () => {
      const { mix } = await makeMix(ask({ length }));
      expect(Math.abs(runningMs(mix) - length * 60_000)).toBeLessThanOrEqual(TOLERANCE_MS);
      expect(mix.tracks.every((t) => t.durationMs > 0)).toBe(true);
    });
  }

  it("has a fun name, phases in order, and no artist twice in a row", async () => {
    const { mix } = await makeMix(ask());
    expect(mix.name).toBe("Gloves On, Volume Up");
    const order = mix.tracks.map((t) => t.phase);
    expect(order).toEqual([...order].sort((a, b) => ["warm-up", "main", "cool-down"].indexOf(a) - ["warm-up", "main", "cool-down"].indexOf(b)));
    for (let i = 1; i < mix.tracks.length; i++) expect(mix.tracks[i].artist).not.toBe(mix.tracks[i - 1].artist);
  });

  it("E1: a track that doesn't exist is replaced in the same phase", async () => {
    const { mix } = await makeMix(ask());
    expect(mix.tracks.some((t) => t.title.startsWith("Imaginary"))).toBe(false);
    expect(mix.shortened).toBeUndefined();
  });

  it("E1: when 3 or more can't be found or replaced, the mix says it's a little shorter", async () => {
    const { mix } = await makeMix(ask({}, "e1"));
    expect(mix.shortened).toBe(true);
    expect(mix.tracks.some((t) => t.title.startsWith("Imaginary"))).toBe(false);
  });

  it("F18: at least 70% of tracks are new compared with recent mixes", async () => {
    const recent = CATALOG.slice(0, 120).map((t) => ({ title: t.title, artist: t.artist }));
    const { mix } = await makeMix(ask({ avoid: recent }));
    const avoid = new Set(recent.map((t) => trackKey(t.title, t.artist)));
    const fresh = mix.tracks.filter((t) => !avoid.has(t.key)).length / mix.tracks.length;
    expect(fresh).toBeGreaterThanOrEqual(0.7);
    expect(mix.freshness).toBe(Math.round(fresh * 100));
  });

  it("F12: Remix gives a new name and a new list for the same settings", async () => {
    const { mix: first } = await makeMix(ask());
    const { mix: again } = await makeMix(ask(), first.tracks, first.name);
    expect(again.name).not.toBe(first.name);
    const before = new Set(first.tracks.map((t) => t.key));
    expect(again.tracks.filter((t) => before.has(t.key))).toHaveLength(0);
    expect(again.genres).toEqual(first.genres);
  });

  it("F11: Swap replaces only that track, in the same phase, with a new one, and keeps the length", async () => {
    const { mix } = await makeMix(ask());
    const i = mix.tracks.findIndex((t) => t.phase === "main");
    const swapped = await swapTrack(ask(), mix, i);
    expect(swapped.tracks).toHaveLength(mix.tracks.length);
    expect(swapped.tracks[i].phase).toBe("main");
    expect(mix.tracks.map((t) => t.key)).not.toContain(swapped.tracks[i].key);
    swapped.tracks.forEach((t, k) => k !== i && expect(t).toEqual(mix.tracks[k]));
    expect(Math.abs(runningMs(swapped) - 45 * 60_000)).toBeLessThanOrEqual(TOLERANCE_MS);
  });
});

describe("Apple Music links (iTunes, in the background)", () => {
  it("finds the exact song, or settles for an Apple Music search when iTunes doesn't have it", async () => {
    const [onApple, notOnApple] = [CATALOG.find((t) => t.n % 5 !== 0)!, CATALOG.find((t) => t.n % 5 === 0)!];
    await makeMix(ask()); // so the tracks are known
    const a = await findAppleLink(onApple);
    expect(a.done).toBe(true);
    expect(a.appleUrl).toMatch(/^https:\/\/music\.apple\.com\/.+\?i=\d+$/);
    const b = await findAppleLink(notOnApple);
    expect(b).toMatchObject({ done: true, appleUrl: undefined });
  });
});

describe("Claude errors (E3, E4)", () => {
  const goodAnswer = {
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: "text", text: JSON.stringify({ name: "Test Mix", tracks: [1, 2, 3].map((n) => ({ title: `Song ${n}`, artist: `Band ${n}`, phase: "main" })) }) }],
  };
  const realMode = () => {
    process.env.FAKE_SERVICES = "0";
    process.env.ANTHROPIC_API_KEY = "sk-test";
  };
  const pretend = (...answers: (object | Error)[]) => {
    const create = vi.fn();
    for (const a of answers) a instanceof Error ? create.mockRejectedValueOnce(a) : create.mockResolvedValueOnce(a);
    setClaudeClientForTests({ messages: { create } });
    return create;
  };

  it("E3: a timeout is retried once", async () => {
    realMode();
    const create = pretend(new Anthropic.APIConnectionTimeoutError(), goodAnswer);
    const out = await suggestMix(ask());
    expect(out.name).toBe("Test Mix");
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].output_config.format.type).toBe("json_schema");
  });

  it("E3: two unusable answers → failed", async () => {
    realMode();
    const broken = { ...goodAnswer, content: [{ type: "text", text: "{not json" }] };
    const create = pretend(broken, broken);
    await expect(suggestMix(ask())).rejects.toMatchObject({ kind: "failed" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("E4: out of credit, overloaded or a bad key → resting, without retrying", () => {
    const err = (status: number) => Anthropic.APIError.generate(status, { error: { type: "x" } }, "x", new Headers());
    for (const s of [401, 402, 403, 429, 500, 529]) expect(classify(err(s)).kind).toBe("resting");
    expect(classify(err(400)).kind).toBe("failed");
  });

  it("E4: resting isn't retried", async () => {
    realMode();
    const create = pretend(Anthropic.APIError.generate(529, { error: { type: "overloaded_error" } }, "x", new Headers()));
    await expect(suggestMix(ask())).rejects.toMatchObject({ kind: "resting" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("the prompt holds only checked values, recent tracks and the rules", () => {
    const p = mixPrompt(request({ avoid: [{ title: "Show Me Love", artist: "Robin S" }] }));
    expect(p).toContain("Workout: Boxing bag rounds (Combat)");
    expect(p).toContain("Genres: Grime, Drum & bass");
    expect(p).toContain("- Show Me Love — Robin S");
  });
});
