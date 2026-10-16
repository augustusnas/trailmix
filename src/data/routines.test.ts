import { CATEGORIES, CATEGORY_ORDER, COLORS } from "./categories";
import { DEFAULT_PINS, MAX_PINS, ROUTINES, getRoutine } from "./routines";
import { ENERGIES, GENRES, LENGTHS, MAX_GENRES, defaultLength } from "./vibe";

describe("routine library", () => {
  it("has all 17 routines", () => {
    expect(ROUTINES).toHaveLength(17);
  });

  it("gives every routine a unique, web-address-safe id", () => {
    const ids = ROUTINES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("puts every routine in a real category with a design-token colour", () => {
    const palette = Object.values(COLORS);
    for (const r of ROUTINES) {
      const cat = CATEGORIES[r.category];
      expect(cat, r.name).toBeDefined();
      expect(palette).toContain(cat.bg);
      expect(palette).toContain(cat.fg);
    }
  });

  it("gives each category exactly one colour, all different", () => {
    const colours = CATEGORY_ORDER.map((c) => CATEGORIES[c].bg);
    expect(new Set(colours).size).toBe(5);
    expect(CATEGORIES.cardio.bg).toBe(COLORS.lime);
    expect(CATEGORIES.combat.bg).toBe(COLORS.orange);
    expect(CATEGORIES.conditioning.bg).toBe(COLORS.lilac);
    expect(CATEGORIES.strength.bg).toBe(COLORS.sand);
    expect(CATEGORIES.recovery.bg).toBe(COLORS.forest);
  });

  it("never puts white text on a colour, and uses dark text on orange, lime, lilac and sand", () => {
    for (const c of CATEGORY_ORDER) {
      expect(CATEGORIES[c].fg).not.toMatch(/^#fff/i);
      if (c !== "recovery") expect(CATEGORIES[c].fg).toBe(COLORS.ink);
    }
  });

  it("has the right count per category", () => {
    const count = (c: string) => ROUTINES.filter((r) => r.category === c).length;
    expect([count("cardio"), count("combat"), count("conditioning"), count("strength"), count("recovery")]).toEqual([
      4, 2, 4, 5, 2,
    ]);
  });

  it("has sensible typical minutes and a short name", () => {
    for (const r of ROUTINES) {
      expect(r.minutes.min).toBeGreaterThan(0);
      expect(r.minutes.max).toBeGreaterThanOrEqual(r.minutes.min);
      expect(r.short.length).toBeGreaterThan(0);
    }
  });

  it("pins Push day, Incline treadmill and HIIT circuit by default, from three categories", () => {
    expect(DEFAULT_PINS.map((id) => getRoutine(id)?.name)).toEqual(["Push day", "Incline treadmill", "HIIT circuit"]);
    expect(new Set(DEFAULT_PINS.map((id) => getRoutine(id)?.category)).size).toBe(3);
    expect(DEFAULT_PINS.length).toBeLessThanOrEqual(MAX_PINS);
  });
});

describe("vibe lists", () => {
  it("has the four energy levels and four lengths", () => {
    expect(ENERGIES.map((e) => e.label)).toEqual(["Easy", "Steady", "Driven", "Feral"]);
    expect([...LENGTHS]).toEqual([30, 45, 60, 90]);
    expect(GENRES.length).toBeGreaterThan(0);
  });

  it("picks the first-time length closest to the middle of a routine's minutes, shorter on a tie", () => {
    const len = (id: string) => defaultLength(getRoutine(id)!.minutes);
    expect(len("tabata")).toBe(30); // 4–20, middle 12
    expect(len("push-day")).toBe(45); // 45–60, middle 52.5: tie between 45 and 60 → shorter
    expect(len("indoor-walk")).toBe(45); // 30–60, middle 45
    expect(len("boxing-bag-rounds")).toBe(30); // 30–45, middle 37.5: tie → shorter
    expect(len("yoga-flow")).toBe(30); // 20–45, middle 32.5
    expect(defaultLength({ min: 80, max: 100 })).toBe(90);
    expect(defaultLength({ min: 60, max: 90 })).toBe(60); // middle 75: tie → shorter
    for (const r of ROUTINES) expect(LENGTHS).toContain(defaultLength(r.minutes));
  });

  it("allows up to 3 genres", () => {
    expect(MAX_GENRES).toBe(3);
  });
});
