import { fakeMix, playlistTitle, shortDate, trackCount } from "./fakeMix";
import { getRoutine } from "./routines";

describe("fake mix", () => {
  const date = new Date(2026, 9, 15); // 15 Oct 2026

  it("formats the date as Day Mon", () => {
    expect(shortDate(date)).toBe("15 Oct");
  });

  it("builds the playlist title from the chosen routine", () => {
    const mix = fakeMix(getRoutine("boxing-bag-rounds")!, { energy: "driven", genres: ["grime"], length: 45 });
    expect(playlistTitle(mix, date)).toBe("Trailmix · Boxing · Gloves On, Volume Up · 15 Oct");
  });

  it("has warm-up, main block and cool-down, and runs a minute short of the length", () => {
    const mix = fakeMix(getRoutine("indoor-walk")!, { energy: "steady", genres: ["house"], length: 45 });
    expect(mix.phases.map((p) => p.label)).toEqual(["Warm-up", "Main block", "Cool-down"]);
    expect(trackCount(mix)).toBe(11);
    expect(mix.runningMinutes).toBe(44);
    expect(mix.name).toBe("Groove Miles");
  });
});
