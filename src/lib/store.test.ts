import { DEFAULT_PINS } from "@/data/routines";
import * as store from "./store";
import { STORAGE_KEY, defaults, sanitize } from "./store";

function fresh() {
  localStorage.clear();
  store.reset();
}

describe("on-device storage", () => {
  beforeEach(fresh);
  afterEach(() => vi.restoreAllMocks());

  it("starts with the defaults: three default pins, no vibes, no music app, not onboarded", () => {
    expect(store.load()).toEqual({
      version: 1,
      onboarded: false,
      musicApp: null,
      pins: DEFAULT_PINS,
      vibes: {},
      recentMixes: [],
    });
  });

  it("saves to and loads from one versioned record", () => {
    store.completeOnboarding("spotify");
    store.pin("tabata");
    store.saveVibe("tabata", { genres: ["grime"], energy: "feral", length: 30 });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw).toMatchObject({ version: 1, onboarded: true, musicApp: "spotify" });
    expect(raw.pins).toEqual([...DEFAULT_PINS, "tabata"]);
    expect(sanitize(raw)).toEqual(raw);
  });

  it("stores ids, not display names", () => {
    store.pin("stretch-mobility");
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"stretch-mobility"');
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain("Stretch & mobility");
  });

  it("pins go on the end, never twice, and stop at 6", () => {
    for (const id of ["tabata", "tabata", "emom", "amrap", "yoga-flow"]) store.pin(id);
    expect(store.load().pins).toEqual([...DEFAULT_PINS, "tabata", "emom", "amrap"]);
  });

  it("can unpin to zero without falling back to the defaults, and keeps vibes", () => {
    store.saveVibe("push-day", { genres: ["rock"], energy: "driven", length: 60 });
    for (const id of DEFAULT_PINS) store.unpin(id);
    expect(store.load().pins).toEqual([]);
    expect(sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).pins).toEqual([]);
    expect(store.load().vibes["push-day"]).toEqual({ genres: ["rock"], energy: "driven", length: 60 });
  });

  it("drops ids that no longer exist", () => {
    const s = sanitize({
      version: 1,
      onboarded: true,
      musicApp: "napster",
      pins: ["tabata", "retired-routine", 42, "tabata"],
      vibes: {
        tabata: { genres: ["grime", "polka", "dnb"], energy: "sleepy", length: 33 },
        "retired-routine": { genres: ["house"], energy: "easy", length: 30 },
        emom: "not an object",
      },
      recentMixes: "nope",
    });
    expect(s.pins).toEqual(["tabata"]);
    expect(s.musicApp).toBeNull();
    expect(s.vibes).toEqual({ tabata: { genres: ["grime", "dnb"], energy: "steady", length: 30 } });
    expect(s.recentMixes).toEqual([]);
  });

  it("keeps at most 3 genres and 10 recent mixes", () => {
    const s = sanitize({
      version: 1,
      vibes: { tabata: { genres: ["grime", "dnb", "house", "rock"], energy: "easy", length: 30 } },
      recentMixes: Array.from({ length: 12 }, (_, i) => ({ i })),
    });
    expect(s.vibes.tabata.genres).toEqual(["grime", "dnb", "house"]);
    expect(s.recentMixes).toHaveLength(10);
  });

  describe("E12: bad data quietly resets to the defaults", () => {
    const cases: [string, string | null][] = [
      ["missing", null],
      ["unreadable", '{"version":1,"onboarded":tr'],
      ["not an object", "[1,2,3]"],
      ["a plain string", '"hello"'],
      ["wrong version", JSON.stringify({ version: 99, pins: ["tabata"], musicApp: "spotify" })],
    ];
    for (const [label, text] of cases) {
      it(`${label}`, () => {
        if (text !== null) localStorage.setItem(STORAGE_KEY, text);
        store.reset(); // forget the in-memory copy...
        if (text !== null) localStorage.setItem(STORAGE_KEY, text); // ...and read the bad data again
        expect(sanitize(text === null ? null : safeParse(text))).toEqual(defaults());
      });
    }

    it("reads unreadable data as the defaults, keeping an onboarded mark", () => {
      expect(store.parseStored('{"version":1,"onboarded":tr')).toEqual(defaults());
      expect(store.parseStored('{"version":1,"onboarded":true,"pins":"oo')).toEqual(defaults(true));
      expect(store.parseStored(null)).toEqual(defaults());
    });

    it("keeps onboarded when it was true, so Welcome isn't shown again", () => {
      expect(sanitize({ version: 99, onboarded: true })).toEqual(defaults(true));
      expect(sanitize({ version: 1, onboarded: true, pins: "oops", vibes: [1, 2] })).toEqual(defaults(true));
    });

    it("resets a field with the wrong shape", () => {
      const s = sanitize({ version: 1, onboarded: true, pins: "oops", vibes: [1, 2], musicApp: "ytm" });
      expect(s.pins).toEqual(DEFAULT_PINS);
      expect(s.vibes).toEqual({});
      expect(s.musicApp).toBe("ytm");
    });
  });

  it("notices damage made after it has loaded, and never writes the old copy back over it", () => {
    for (const id of ["tabata", "emom", "amrap"]) store.pin(id);
    expect(store.load().pins).toHaveLength(6);
    localStorage.setItem(STORAGE_KEY, '{"version":1,"onboarded":true,"pins":"oops", "vibes":[1,2');
    expect(store.load()).toEqual(defaults(true));
    store.pin("yoga-flow");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).pins).toEqual([...DEFAULT_PINS, "yoga-flow"]);
  });

  it("picks up a change made outside the app", () => {
    const a = store.load();
    expect(store.load()).toBe(a); // unchanged storage → the same copy
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults(true), musicApp: "apple" }));
    expect(store.load().musicApp).toBe("apple");
  });

  it("never crashes when the phone refuses storage (e.g. private browsing)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => store.reset()).not.toThrow();
    expect(() => store.load()).not.toThrow();
    expect(() => store.pin("tabata")).not.toThrow();
    // still works for this visit
    expect(store.load().pins).toContain("tabata");
  });

  it("gives first-time vibe settings: no genre, Steady, the default length", () => {
    expect(store.vibeFor(store.load(), "tabata")).toEqual({ genres: [], energy: "steady", length: 30 });
    expect(store.vibeFor(store.load(), "push-day")).toEqual({ genres: [], energy: "steady", length: 45 });
  });

  it("remembers vibes per routine", () => {
    store.saveVibe("boxing-bag-rounds", { genres: ["grime"], energy: "feral", length: 30 });
    expect(store.vibeFor(store.load(), "boxing-bag-rounds").genres).toEqual(["grime"]);
    expect(store.vibeFor(store.load(), "push-day").genres).toEqual([]);
  });

  it("tells screens when something changes", () => {
    const seen = vi.fn();
    const stop = store.subscribe(seen);
    store.setMusicApp("apple");
    expect(seen).toHaveBeenCalled();
    stop();
  });
});

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
