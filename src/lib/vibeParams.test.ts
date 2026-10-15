import { parseVibe, vibeQuery } from "./vibeParams";

describe("routine in the web address", () => {
  it("reads the routine and vibe", () => {
    const v = parseVibe({ routine: "boxing-bag-rounds", energy: "feral", genres: "grime,dnb", length: "30" });
    expect(v?.routine.name).toBe("Boxing bag rounds");
    expect(v?.energy).toBe("feral");
    expect(v?.genres).toEqual(["grime", "dnb"]);
    expect(v?.length).toBe(30);
  });

  it("fills in defaults when only the routine is given", () => {
    const v = parseVibe({ routine: "indoor-walk" });
    expect(v).toMatchObject({ energy: "steady", genres: ["house"], length: 45 });
  });

  it("rejects a missing or unknown routine instead of guessing one", () => {
    expect(parseVibe({})).toBeUndefined();
    expect(parseVibe({ routine: "underwater-basket-weaving" })).toBeUndefined();
  });

  it("survives a round trip", () => {
    const v = parseVibe({ routine: "yoga-flow", energy: "easy", genres: "soul", length: "60" })!;
    expect(parseVibe(Object.fromEntries(new URLSearchParams(vibeQuery(v))))).toEqual(v);
  });
});
