// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import { getRoutine } from "@/data/routines";
import { cameOutShort, runningMs, trackKey } from "@/lib/mixTypes";
import { FALLBACK_MODEL, classify, currentModel, resetModelFallbackForTests, reviewGenres, setClaudeClientForTests, suggestMix, thinkingFor } from "./claude";
import { CATALOG } from "./fakes";
import { AIM_MS, TOLERANCE_MS, fitToLength, minTracks, separateArtists } from "./fit";
import { DEEZER, genreVerdict, tooSlow } from "./genres";
import { getKV, resetMemoryKV } from "./kv";
import { readShare } from "./shares";
import { MAX_TRACK_MS, MIN_TRACK_MS, appleSongUrl, bestMatch, findAppleLink, matchResult, sameArtist, simplify, songKey } from "./lookup";
import { morePrompt } from "./prompt";
import { MixError } from "./claude";
import { LENGTH_ROUNDS, MAX_PER_ARTIST, capArtists, failedChecks, makeMix, newNotes, swapTrack, type Stage } from "./mixes";
import { recordTrackChecks, saveProblem } from "./stats";
import { SYSTEM_PROMPT, mixPrompt, reviewPrompt, trackCount } from "./prompt";
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
  genres: ["hiphop", "dance"],
  energy: "driven",
  length: 45,
  avoid: [],
  avoidArtists: [],
  ...over,
});
const ask = (over: Partial<MixRequest> = {}, forced: string | null = null) => ({
  req: request(over),
  usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
  forced,
});

describe("F10 and Q4: fit to length", () => {
  const t = (min: number, artist = "a") => ({ durationMs: min * 60_000, artist });
  const many = (n: number, min: number) => Array.from({ length: n }, () => t(min));

  it("fills in order until within 2½ minutes, keeping the ending at the end", () => {
    const ending = [t(3.5, "end1"), t(3.5, "end2")];
    const fit = fitToLength(many(14, 3.5), ending, 45);
    expect(fit.status).toBe("ok");
    expect(fit.tracks.slice(-2)).toEqual(ending);
    expect(Math.abs(fit.totalMs - 45 * 60_000)).toBeLessThanOrEqual(AIM_MS);
  });

  it("skips one long track that would overshoot, using a shorter spare", () => {
    const fit = fitToLength([...many(4, 4), t(12), ...many(4, 3.5)], [], 30);
    expect(fit.tracks.some((x) => x.durationMs === 12 * 60_000)).toBe(false);
    expect(fit.status).toBe("ok");
  });

  it("reports short when there aren't enough tracks", () => {
    expect(fitToLength([t(4)], [t(4)], 60).status).toBe("short");
  });

  it("Q4: minimum track counts are 8, 12, 16 and 24", () => {
    expect([30, 45, 60, 90].map(minTracks)).toEqual([8, 12, 16, 24]);
  });

  it("Q4: long tracks are skipped so the minimum count still fits in the length", () => {
    // 6½-minute tracks first: taking them would reach 30 minutes in five tracks.
    const fit = fitToLength([...many(3, 6.5), ...many(10, 3.5)], [], 30);
    expect(fit.tracks.length).toBeGreaterThanOrEqual(8);
    expect(fit.status).toBe("ok");
  });

  it("Q4: too few tracks counts as short, even when the length is right", () => {
    expect(fitToLength(many(6, 5), [], 30).status).toBe("short");
  });

  it("never puts the same artist twice in a row when it can avoid it", () => {
    const tracks = [t(1, "A"), t(1, "A"), t(1, "B")];
    expect(separateArtists(tracks, 0).map((x) => x.artist)).toEqual(["A", "B", "A"]);
  });

  it("a clash in the ending swaps with an earlier track that fits there", () => {
    const tracks = [t(1, "A"), t(1, "B"), t(1, "C"), t(1, "D"), t(1, "E"), t(1, "E")];
    const out = separateArtists(tracks).map((x) => x.artist);
    expect(out).toEqual(["A", "B", "E", "D", "E", "C"]);
  });
});

describe("track matching (Deezer, then iTunes for Apple links)", () => {
  it("simplifies titles", () => {
    expect(simplify("Gypsy Woman (She's Homeless) [2019 Remaster]")).toBe("gypsy woman shes homeless");
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

  it("Q4: skips versions over 7 minutes", () => {
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
  it("asks for over twice the minimum count up front", () => {
    expect([30, 45, 60, 90].map(trackCount)).toEqual([18, 27, 36, 53]);
    expect(mixPrompt(request())).toContain("Make a playlist of 27 tracks, in playing order.");
  });

  it("Dance & electronic leans on the energy: house when easy or steady, drum & bass and techno when driven or feral", () => {
    for (const energy of ["easy", "steady"]) expect(mixPrompt(request({ genres: ["dance"], energy }))).toMatch(/for this energy, lean towards house/);
    for (const energy of ["driven", "feral"]) expect(mixPrompt(request({ genres: ["dance"], energy }))).toMatch(/for this energy, lean towards drum & bass/);
    expect(mixPrompt(request({ genres: ["hiphop"] }))).toContain("mix in a fair share of UK rap from artists you're confident about (not only US rap), but don't force grime in");
  });

  for (const length of [30, 45, 60, 90]) {
    it(`a ${length}-minute mix is within 2½ minutes of ${length}, with at least ${minTracks(length)} tracks (F10, Q4)`, async () => {
      const { mix } = await makeMix(ask({ length }));
      expect(Math.abs(runningMs(mix) - length * 60_000)).toBeLessThanOrEqual(AIM_MS);
      expect(mix.tracks.length).toBeGreaterThanOrEqual(minTracks(length));
      expect(mix.tracks.every((t) => t.durationMs >= MIN_TRACK_MS && t.durationMs <= MAX_TRACK_MS)).toBe(true);
    });
  }

  it("has a fun name, one list with no phases, and no artist twice in a row", async () => {
    const { mix } = await makeMix(ask());
    expect(mix.name).toBe("Gloves On, Volume Up");
    expect(mix.tracks.every((t) => !("phase" in t))).toBe(true);
    for (let i = 1; i < mix.tracks.length; i++) expect(mix.tracks[i].artist).not.toBe(mix.tracks[i - 1].artist);
  });

  it("E1: a track that doesn't exist is left out and the length is topped up", async () => {
    const { mix } = await makeMix(ask());
    expect(mix.tracks.some((t) => t.title.startsWith("Imaginary"))).toBe(false);
    expect(cameOutShort(mix)).toBe(false);
  });

  it("Q8: a mix never carries the old \"a few tracks couldn't be found\" note", async () => {
    const { mix } = await makeMix(ask({}, "e1"));
    expect("shortened" in mix).toBe(false);
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

  it("F11: Swap replaces only that track with a new one, and keeps the length", async () => {
    const { mix } = await makeMix(ask());
    const i = 4;
    const swapped = await swapTrack(ask(), mix, i);
    expect(swapped.tracks).toHaveLength(mix.tracks.length);
    expect(mix.tracks.map((t) => t.key)).not.toContain(swapped.tracks[i].key);
    swapped.tracks.forEach((t, k) => k !== i && expect(t).toEqual(mix.tracks[k]));
    expect(Math.abs(runningMs(swapped) - 45 * 60_000)).toBeLessThanOrEqual(TOLERANCE_MS);
  });
});

describe("matching names", () => {
  it("treats dotted initials and 2Pac/Tupac as the same", () => {
    expect(bestMatch([{ title: "Still D.R.E.", artist: "Dr. Dre", durationMs: 270_000 }], "Still Dre", "Dr. Dre")).toBeDefined();
    expect(bestMatch([{ title: "Ghetto Gospel", artist: "2Pac", durationMs: 240_000 }], "Ghetto Gospel", "Tupac")).toBeDefined();
    expect(simplify("Fred again..")).toBe("fred again");
  });
});

describe("F10 when most suggestions fail the check", () => {
  for (const length of [30, 45, 60, 90]) {
    it(`two in three failing: still within 5 minutes of ${length}, in at most ${LENGTH_ROUNDS} rounds of extras`, async () => {
      const notes = newNotes();
      const { mix, timings } = await makeMix(ask({ length }, "mostfail"), [], undefined, notes);
      expect(failedChecks(notes) / notes.suggested).toBeGreaterThan(0.5);
      expect(Math.abs(runningMs(mix) - length * 60_000)).toBeLessThanOrEqual(TOLERANCE_MS);
      expect(timings.lengthRounds).toBeLessThanOrEqual(LENGTH_ROUNDS);
      expect(cameOutShort(mix)).toBe(false);
    });
  }

  it("when every replacement fails too, it tries 3 rounds, then the mix says how long it came out", async () => {
    const { mix, timings } = await makeMix(ask({ length: 90 }, "short"));
    expect(timings.lengthRounds).toBe(LENGTH_ROUNDS);
    expect(cameOutShort(mix)).toBe(true);
    expect(runningMs(mix)).toBeGreaterThanOrEqual(0.75 * 90 * 60_000);
  });

  it("under three-quarters of the length, it keeps looking, then fails with Try again instead of a short list", async () => {
    await expect(makeMix(ask({ length: 45 }, "tooshort"))).rejects.toMatchObject({ kind: "failed" });
  });

  it("stops topping up once within 5 minutes and a track of the minimum count", () => {
    const t = (min: number) => ({ durationMs: min * 60_000, artist: "a" });
    // 41 minutes in 11 tracks: a guide, not a target, so no more rounds.
    expect(fitToLength(Array.from({ length: 11 }, () => t(41 / 11)), [], 45).status).toBe("ok");
  });

  it("reports the three stages in order", async () => {
    const stages: Stage[] = [];
    await makeMix(ask(), [], undefined, newNotes(), (s) => stages.push(s));
    expect(stages).toEqual(["picking", "energy", "fitting"]);
  });
});

describe("Q1: the artist must match", () => {
  it("a title match by a different artist is rejected as the wrong artist", () => {
    const results = [{ title: "Shake It Off", artist: "Taylor Swift", durationMs: 219_000 }];
    expect(matchResult(results, "Shake It Off", "Skepta")).toBe("wrongArtist");
    expect(matchResult([], "Shake It Off", "Skepta")).toBe("notFound");
  });

  it("a name inside another name isn't the same artist", () => {
    expect(sameArtist("Sting", "Stingray")).toBe(false);
    expect(sameArtist("Dave", "Dave Matthews Band")).toBe(false);
    expect(sameArtist("Kano", "Kanon")).toBe(false);
    expect(sameArtist("Bob Marley", "Ziggy Marley")).toBe(false);
  });

  it("allows case, a leading The, &/and, dots, $ and featured artists", () => {
    expect(sameArtist("the prodigy", "The Prodigy")).toBe(true);
    expect(sameArtist("Prodigy", "The Prodigy")).toBe(true);
    expect(sameArtist("Chase and Status", "Chase & Status")).toBe(true);
    expect(sameArtist("Bob Marley", "Bob Marley & The Wailers")).toBe(true);
    expect(sameArtist("Ghetts feat. Jaykae", "Ghetts")).toBe(true);
    expect(sameArtist("Ms. Banks", "Ms Banks")).toBe(true);
    expect(sameArtist("A$AP Rocky", "ASAP Rocky")).toBe(true);
    expect(sameArtist("Beyoncé", "Beyonce")).toBe(true);
  });

  it("a longer title that only starts the same way is a different track", () => {
    expect(matchResult([{ title: "Kano Freestyle", artist: "Kano", durationMs: 200_000 }], "Kano", "Kano")).toBe("notFound");
    expect(matchResult([{ title: "Skepta Interlude", artist: "Skepta", durationMs: 200_000 }], "Skepta", "Skepta")).toBe("notFound");
    expect(bestMatch([{ title: "Pow! (Forward)", artist: "Lethal Bizzle", durationMs: 181_000 }], "Pow", "Lethal Bizzle")).toBeDefined();
    expect(bestMatch([{ title: "Shape of You - Stormzy Remix", artist: "Ed Sheeran", durationMs: 230_000 }], "Shape of You", "Ed Sheeran")).toBeDefined();
  });

  it("ignores apostrophes and a leading DJ or MC", () => {
    expect(bestMatch([{ title: "Man's Not Hot", artist: "Big Shaq", durationMs: 186_000 }], "Mans Not Hot", "MC Big Shaq")).toBeDefined();
    expect(bestMatch([{ title: "Don't Panic", artist: "Kano", durationMs: 200_000 }], "Dont Panic", "Kano")).toBeDefined();
    expect(sameArtist("Zinc", "DJ Zinc")).toBe(true);
    expect(sameArtist("DJ Hype", "Hype")).toBe(true);
  });

  it("uses the radio edit when the original runs over 5 minutes", () => {
    const results = [
      { title: "Watercolour", fullTitle: "Watercolour", artist: "Pendulum", durationMs: 305_000 },
      { title: "Watercolour", fullTitle: "Watercolour (Radio Edit)", artist: "Pendulum", durationMs: 214_000 },
    ];
    expect(bestMatch(results, "Watercolour", "Pendulum")?.durationMs).toBe(214_000);
    const short = [{ ...results[0], durationMs: 240_000 }, results[1]];
    expect(bestMatch(short, "Watercolour", "Pendulum")?.durationMs).toBe(240_000);
  });

  it("knows a few other names for the same artist", () => {
    expect(sameArtist("Tupac", "2Pac")).toBe(true);
    expect(sameArtist("Wiz Kid", "Wizkid")).toBe(true);
    expect(sameArtist("Puff Daddy", "Diddy")).toBe(true);
  });

  it("prefers the original recording over a remix with the same title", () => {
    const results = [
      { title: "Endorphins", fullTitle: "Endorphins (Fred V & Grafix Remix)", artist: "Sub Focus", durationMs: 300_000 },
      { title: "Endorphins", fullTitle: "Endorphins", artist: "Sub Focus", durationMs: 250_000 },
    ];
    expect(bestMatch(results, "Endorphins", "Sub Focus")?.durationMs).toBe(250_000);
  });

  it("in a mix: the stand-in's wrong-artist credit is rejected and logged", async () => {
    const notes = newNotes();
    const { mix } = await makeMix(ask(), [], undefined, notes);
    expect(notes.wrongArtist).toHaveLength(1);
    expect(notes.wrongArtist[0]).toContain("Someone Else Entirely");
    expect(mix.tracks.some((t) => t.artist === "Someone Else Entirely")).toBe(false);
  });
});

describe("Q2: no song twice", () => {
  it("titles are the same song without brackets, feat., remix, edit or version", () => {
    const key = songKey("Pow");
    for (const t of ["Pow (Forward)", "Pow! (Forward)", "POW (Radio Edit)", "Pow - Extended Mix", "Pow (feat. Someone)", "Pow [VIP]", "Pow (Remix)", "Pow (2011 Version)"]) {
      expect(songKey(t)).toBe(key);
    }
    expect(songKey("Pow 2011")).toBe(key); // a year after the title is the same song
    expect(songKey("Shutdown")).not.toBe(songKey("Shut Up"));
    expect(songKey("Neon Pulse 1")).not.toBe(songKey("Neon Pulse 2"));
  });

  it("in a mix: the stand-in's second version of a song is removed", async () => {
    const notes = newNotes();
    const { mix } = await makeMix(ask(), [], undefined, notes);
    expect(notes.duplicates).toHaveLength(1);
    expect(notes.duplicates[0]).toContain("(Radio Edit)");
    const songs = mix.tracks.map((t) => songKey(t.title));
    expect(new Set(songs).size).toBe(songs.length);
  });
});

describe("Q3: genre check", () => {
  const D = DEEZER;
  it("rejects a track whose album and artist are filed outside the chosen genres", () => {
    const taylor = { albumGenre: D.pop, artistGenres: { [D.pop]: 67, [D.country]: 16, [D.alternative]: 12 } };
    expect(genreVerdict(taylor, ["hiphop", "dance"])).toBe("off");
    const marley = { albumGenre: D.reggae, artistGenres: { [D.reggae]: 66, [D.dance]: 4, [D.pop]: 3 } };
    expect(genreVerdict(marley, ["hiphop"])).toBe("off");
  });

  it("keeps a UK rap track on a Pop-filed album when the artist is filed under Rap", () => {
    const pow = { albumGenre: D.pop, artistGenres: { [D.rap]: 5, [D.pop]: 1 } };
    expect(genreVerdict(pow, ["hiphop"])).toBe("fits");
  });

  it("an artist's occasional genre (under 20% of their albums) doesn't count", () => {
    expect(genreVerdict({ artistGenres: { [D.reggae]: 66, [D.dance]: 4 } }, ["dance"])).toBe("off");
  });

  it("keeps tracks Deezer has no genre for, so they can be logged", () => {
    expect(genreVerdict({}, ["afro"])).toBe("unknown");
    expect(genreVerdict({ albumGenre: -1, artistGenres: {} }, ["afro"])).toBe("unknown");
  });

  it("several chosen genres allow any of their Deezer genres", () => {
    expect(genreVerdict({ albumGenre: D.african }, ["hiphop", "afro"])).toBe("fits");
    expect(genreVerdict({ albumGenre: D.african }, ["hiphop", "dance"])).toBe("off");
  });

  it("afro-pop filed under Pop or Soul & Funk fits Afrobeats & amapiano", () => {
    expect(genreVerdict({ albumGenre: D.pop, artistGenres: { [D.pop]: 25, [D.electro]: 3 } }, ["afro"])).toBe("fits");
    // Victony's "Soweto": album and most of his catalogue under Soul & Funk
    expect(genreVerdict({ albumGenre: D.soulFunk, artistGenres: { [D.soulFunk]: 25, [D.african]: 6, [D.rap]: 3 } }, ["afro"])).toBe("fits");
  });

  it("the genre review: tracks in the right Deezer genre but the wrong scene are removed and logged", async () => {
    const notes = newNotes();
    const { mix } = await makeMix(ask({ length: 90 }), [], undefined, notes);
    const wrongScene = new Set(CATALOG.filter((t) => t.wrongScene).map((t) => t.title));
    expect(notes.offGenreReview.length).toBeGreaterThan(0);
    expect(mix.tracks.some((t) => wrongScene.has(t.title))).toBe(false);
    expect(failedChecks(notes)).toBeGreaterThanOrEqual(notes.offGenreReview.length);
  });

  it("the genre review never fails a mix: an error keeps every track", async () => {
    setClaudeClientForTests({ messages: { create: async () => { throw new Error("down"); } } });
    delete process.env.FAKE_SERVICES;
    process.env.ANTHROPIC_API_KEY = "test";
    const tracks = [{ title: "Song", artist: "Band" }];
    expect(await reviewGenres({ ...ask(), deadline: Date.now() + 20_000 }, tracks)).toEqual([]);
    setClaudeClientForTests(null);
  });

  it("the review prompt gives each genre's meaning and asks only for clear misfits", () => {
    const p = reviewPrompt(request(), [{ title: "Sicko Mode", artist: "Travis Scott" }]);
    expect(p).toContain("Hip-hop & UK rap: hip-hop and rap from the US, the UK and elsewhere");
    expect(p).toContain("Dance & electronic: dance and electronic music: house, UK garage, techno, drum & bass");
    expect(p).not.toContain("lean towards"); // the review uses the whole genre, not the energy's lean
    expect(p).toContain("1. Sicko Mode — Travis Scott");
    expect(p).toMatch(/"no" only if you're sure it's from a different scene/);
    expect(p).toMatch(/Most playlists have no misfits at all/);
  });

  it("in a mix: Classical-filed stand-in tracks are rejected and logged, no-genre ones counted", async () => {
    const notes = newNotes();
    const { mix } = await makeMix(ask({ length: 90 }), [], undefined, notes);
    expect(notes.offGenre.length).toBeGreaterThan(0);
    const classical = new Set(CATALOG.filter((t) => t.albumGenre === DEEZER.classical).map((t) => t.title));
    expect(mix.tracks.some((t) => classical.has(t.title))).toBe(false);
    expect(notes.noGenre).toBeGreaterThan(0);
  });
});

describe("Q5: no slow tracks for Driven and Feral", () => {
  it("half-speed readings never count as slow for grime, drum & bass, hip-hop or afrobeats", () => {
    expect(tooSlow(70, "driven", ["hiphop"])).toBe(false); // grime's 140 read as 70
    expect(tooSlow(87, "driven", ["dance"])).toBe(false); // a 174 bpm drum & bass track read as 87
    expect(tooSlow(75, "feral", ["hiphop"])).toBe(false);
    expect(tooSlow(55, "driven", ["afro"])).toBe(false);
  });

  it("only clearly slow for the genre counts, and doubling to a normal tempo isn't slow", () => {
    expect(tooSlow(84, "driven", ["afro"])).toBe(true); // afrobeats sits at 95–125
    expect(tooSlow(100, "driven", ["afro"])).toBe(false);
    expect(tooSlow(62, "driven", ["dance"])).toBe(false); // 124 at half speed
    expect(tooSlow(95, "driven", ["dance"])).toBe(true);
    expect(tooSlow(75, "driven", ["pop"])).toBe(true);
    expect(tooSlow(75, "driven", ["pop", "hiphop"])).toBe(false); // slow for pop, but fine if it's the grime
  });

  it("only Driven and Feral are checked, and no measurement is never slow", () => {
    expect(tooSlow(75, "steady", ["pop"])).toBe(false);
    expect(tooSlow(0, "driven", ["pop"])).toBe(false);
    expect(tooSlow(undefined, "feral", ["pop"])).toBe(false);
  });

  it("in a mix: slow stand-in tracks (70 bpm) are left out of a Driven pop mix, kept for Easy", async () => {
    const slow = new Set(CATALOG.filter((t) => t.bpm === 70).map((t) => t.title));
    const driven = newNotes();
    const { mix } = await makeMix(ask({ length: 90, genres: ["pop"] }), [], undefined, driven);
    expect(driven.slow.length).toBeGreaterThan(0);
    expect(mix.tracks.some((t) => slow.has(t.title))).toBe(false);
    resetMemoryKV();
    const easy = newNotes();
    await makeMix(ask({ length: 90, energy: "easy", genres: ["pop"] }), [], undefined, easy);
    expect(easy.slow).toHaveLength(0);
  });

  it("the prompt asks for one flowing list with no slow songs for Driven and Feral", () => {
    expect(SYSTEM_PROMPT).toMatch(/One flowing list, no sections/);
    expect(SYSTEM_PROMPT).toMatch(/For Driven and Feral every track is still fast and intense/);
    expect(SYSTEM_PROMPT).toMatch(/never over 7/);
    expect(SYSTEM_PROMPT).not.toMatch(/warm-up|main block|cool-down/i);
  });
});

describe("Q7: shared pages from before Milestone 4", () => {
  it("a stored mix with warm-up, main block and cool-down opens as one list, in the same order", async () => {
    const id = "A".repeat(22);
    const track = (title: string, phase: string) => ({ title, artist: `By ${title}`, phase, durationMs: 200_000, key: title });
    await getKV().set(`share:${id}`, {
      id: "x", name: "Old Share", routineId: "push-day", genres: ["hiphop"], energy: "driven", length: 30, createdAt: "2026-10-12",
      tracks: [track("One", "warm-up"), track("Two", "main"), track("Three", "cool-down")],
    });
    const mix = (await readShare(id))!;
    expect(mix.tracks.map((t) => t.title)).toEqual(["One", "Two", "Three"]);
    expect(mix.tracks.every((t) => !("phase" in t))).toBe(true);
  });
});

describe("time limits", () => {
  it("Generate and Remix stop with a timeout once the limit has passed", async () => {
    await expect(makeMix({ ...ask(), deadline: Date.now() - 1 })).rejects.toEqual(new MixError("timeout"));
  });

  it("Swap stops at its limit, without changing the mix", async () => {
    const { mix } = await makeMix(ask());
    const before = JSON.stringify(mix);
    const started = Date.now();
    await expect(swapTrack({ ...ask({}, "slowswap"), deadline: Date.now() + 200 }, mix, 3)).rejects.toEqual(new MixError("timeout"));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(JSON.stringify(mix)).toBe(before);
  });
});

describe("artists: at most 2 per mix, and steering away from recent ones", () => {
  it("keeps only the first 2 tracks by any one artist (ignoring case and features)", () => {
    const t = (artist: string, title: string) => ({ artist, title });
    const out = capArtists([t("Skepta", "1"), t("JME", "2"), t("skepta", "3"), t("Skepta feat. JME", "4"), t("JME", "5")]);
    expect(out.map((x) => x.title)).toEqual(["1", "2", "3", "5"]);
    expect(MAX_PER_ARTIST).toBe(2);
  });

  it("no mix has more than 2 tracks by one artist", async () => {
    for (const length of [30, 90]) {
      const { mix } = await makeMix(ask({ length }));
      const count = new Map<string, number>();
      for (const t of mix.tracks) count.set(t.artist, (count.get(t.artist) ?? 0) + 1);
      expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
    }
  });

  it("the prompt lists the artists from recent mixes for this routine, keeps the accuracy rules, and caps artists", () => {
    const p = mixPrompt(request({ avoidArtists: ["Skepta", "Stormzy"] }));
    expect(p).toContain("Skepta, Stormzy");
    expect(p).toMatch(/use other artists/);
    expect(p).toMatch(/reusing one of these is better than guessing/);
    expect(SYSTEM_PROMPT).toMatch(/Only pick tracks you are confident exist/);
    expect(SYSTEM_PROMPT).toMatch(/at most 2 tracks by any one artist/);
    expect(mixPrompt(request())).not.toContain("last few mixes");
    const more = morePrompt(request({ avoidArtists: ["Skepta"] }), 3, [], "", ["Dave"]);
    expect(more).toContain("Already twice in the playlist, so don't use these artists: Dave");
    expect(more).toContain("Skepta");
  });
});

describe("E2 and the bad-track count", () => {
  it("E2: when the catalogue can't check the tracks, the mix fails nicely instead of coming out empty", async () => {
    await expect(makeMix(ask({}, "e2"))).rejects.toMatchObject({ kind: "failed", detail: "Deezer busy for most tracks" });
  });

  it("counts every suggestion checked and every one that failed, for this mix and in a running total", async () => {
    const notes = newNotes();
    const { mix } = await makeMix(ask(), [], undefined, notes);
    expect(notes.notFound.length).toBeGreaterThanOrEqual(1); // the stand-in always makes one up
    const failed = failedChecks(notes);
    expect(notes.suggested).toBeGreaterThanOrEqual(mix.tracks.length + failed);
    const first = (await recordTrackChecks(notes))!;
    expect(first).toEqual({ suggested: notes.suggested, failed, failedPercent: Math.round((failed / notes.suggested) * 1000) / 10 });
    const second = (await recordTrackChecks({ ...newNotes(), suggested: 10, notFound: ["a"], offGenre: ["b"], busy: 3 }))!;
    expect(second.suggested).toBe(first.suggested + 10);
    expect(second.failed).toBe(first.failed + 2); // busy isn't a failure
  });

  it("swaps count their suggestions too", async () => {
    const { mix } = await makeMix(ask());
    const notes = newNotes();
    await swapTrack(ask(), mix, 3, notes);
    expect(notes.suggested).toBeGreaterThanOrEqual(3);
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
    content: [{ type: "text", text: JSON.stringify({ name: "Test Mix", tracks: [1, 2, 3].map((n) => ({ title: `Song ${n}`, artist: `Band ${n}` })) }) }],
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

  it("Sonnet 5.5 gets the thinking setting it accepts; Haiku keeps thinking off", () => {
    expect(thinkingFor("claude-sonnet-5-5")).toEqual({ thinking: { type: "between_tools" } });
    expect(thinkingFor("claude-haiku-5-5")).toEqual({ thinking: { type: "disabled" } });
    expect(thinkingFor("claude-opus-5-5")).toEqual({});
  });

  it("a CLAUDE_MODEL that doesn't work falls back to Haiku with a warning, instead of failing", async () => {
    realMode();
    resetModelFallbackForTests();
    process.env.CLAUDE_MODEL = "claude-sonnet-5.5"; // a typo: the real name uses a dash
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = pretend(Anthropic.APIError.generate(404, { error: { type: "not_found_error" } }, "model not found", new Headers()), goodAnswer, goodAnswer);
    expect((await suggestMix(ask())).name).toBe("Test Mix");
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(["claude-sonnet-5.5", FALLBACK_MODEL]);
    expect(warn.mock.calls[0][0]).toMatch(/"event":"model-fallback".*"wanted":"claude-sonnet-5.5"/);
    // The broken model isn't tried again on every mix.
    expect(currentModel()).toBe(FALLBACK_MODEL);
    await suggestMix(ask());
    expect(create.mock.calls[2][0].model).toBe(FALLBACK_MODEL);
    resetModelFallbackForTests();
    warn.mockRestore();
  });

  it("a working CLAUDE_MODEL is used as is", async () => {
    realMode();
    resetModelFallbackForTests();
    process.env.CLAUDE_MODEL = "claude-sonnet-5-5";
    const create = pretend(goodAnswer);
    await suggestMix(ask());
    expect(create.mock.calls[0][0]).toMatchObject({ model: "claude-sonnet-5-5", thinking: { type: "between_tools" } });
  });

  it("the prompt holds only checked values, recent tracks and the rules", () => {
    const p = mixPrompt(request({ avoid: [{ title: "Show Me Love", artist: "Robin S" }] }));
    expect(p).toContain("Workout: Boxing bag rounds (Combat)");
    expect(p).toContain("Genres (at least one per track):\n- Hip-hop & UK rap: hip-hop and rap from the US, the UK and elsewhere");
    expect(p).toContain("\n- Dance & electronic: dance and electronic music");
    expect(p).toContain("- Show Me Love — Robin S");
  });
});

describe("Traceable failures: problem summaries in Upstash", () => {
  it("saves counts, the step reached and busy apart from not found, for 7 days", async () => {
    const kv = getKV();
    const set = vi.spyOn(kv, "set");
    const notes = { ...newNotes(), suggested: 27, notFound: ["A — B", "C — D"], busy: 4, step: "fitting" as const, rounds: 3, minutes: 31.2 };
    const s = await saveProblem({ event: "remix", outcome: "failed", settings: { routine: "hiit-circuit", genres: ["hiphop"], energy: "driven", length: 45 }, notes, seconds: 24.1 });
    expect(s).toMatchObject({ event: "remix", outcome: "failed", step: "fitting", rounds: 3, notFound: 2, deezerBusy: 4, minutes: 31.2 });
    const [key, value, seconds] = set.mock.calls.at(-1)!;
    expect(key).toMatch(/^problem:\d{4}-\d\d-\d\dT/);
    expect(value).toEqual(s);
    expect(seconds).toBe(7 * 86400);
    set.mockRestore();
  });

  it("makeMix records the step and rounds it reached", async () => {
    const notes = newNotes();
    await expect(makeMix(ask({ length: 45 }, "tooshort"), [], undefined, notes)).rejects.toMatchObject({ kind: "failed" });
    expect(notes.step).toBe("fitting");
    expect(notes.rounds).toBeGreaterThan(0);
    expect(notes.minutes).toBeLessThan(0.75 * 45);
  });
});
