import { genreLabel, playlistTitle, shortDate } from "./format";

describe("formatting", () => {
  const date = new Date(2026, 9, 15);
  it("formats the date as Day Mon", () => expect(shortDate(date)).toBe("15 Oct"));
  it("builds the playlist title from the routine's short name (F21)", () => {
    expect(playlistTitle({ name: "Gloves On, Volume Up", routineId: "boxing-bag-rounds" }, date)).toBe(
      "Trailmix · Boxing · Gloves On, Volume Up · 15 Oct",
    );
  });
  it("labels genres", () => expect(genreLabel("dnb")).toBe("Drum & bass"));
});
