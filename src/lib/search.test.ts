import { ROUTINES } from "@/data/routines";
import { normalize, searchRoutines } from "./search";

const names = (q: string, f: Parameters<typeof searchRoutines>[2] = "all") => searchRoutines(ROUTINES, q, f).map((r) => r.name);

describe("Library search (F6)", () => {
  it("ignores case, extra spaces and punctuation", () => {
    expect(normalize("  Stretch &  MOBILITY! ")).toBe("stretch mobility");
    expect(names("  TAB  ")).toEqual(["Tabata"]);
    expect(names("stretch mobility")).toEqual(["Stretch & mobility"]);
    expect(names("spin/bike")).toEqual(["Spin / bike"]);
  });

  it('"tab" finds Tabata, "push" finds Push day', () => {
    expect(names("tab")).toEqual(["Tabata"]);
    expect(names("push")).toEqual(["Push day"]);
  });

  it('"cardio" finds all four Cardio routines by category name', () => {
    expect(names("cardio")).toEqual(["Indoor walk", "Incline treadmill", "Spin / bike", "Rowing intervals"]);
  });

  it("returns nothing for no match", () => {
    expect(names("underwater basket weaving")).toEqual([]);
  });

  it("filters by one category and combines with the search text", () => {
    expect(names("", "recovery")).toEqual(["Stretch & mobility", "Yoga flow"]);
    expect(names("day", "strength")).toEqual(["Push day", "Pull day"]);
    expect(names("tab", "cardio")).toEqual([]);
    expect(names("", "all")).toHaveLength(17);
  });
});
