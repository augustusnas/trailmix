// Q3: is a track clearly outside the chosen genres? Deezer labels each album with one broad genre
// (and sometimes none), so a song's album alone isn't enough: Lethal Bizzle's "Pow (Forward)" is
// filed under Pop, the same as Taylor Swift. The artist's whole catalogue settles it: Taylor Swift
// is Pop and Country, Bob Marley is Reggae, Skepta is Rap. A track is rejected only when Deezer has
// genres for it and none of them fit. With no genres at all it's kept (and logged).

/** Deezer's genre ids (https://api.deezer.com/genre). */
export const DEEZER = {
  pop: 132,
  rap: 116,
  rock: 152,
  dance: 113,
  rnb: 165,
  alternative: 85,
  electro: 106,
  folk: 466,
  reggae: 144,
  jazz: 129,
  country: 84,
  classical: 98,
  films: 173,
  metal: 464,
  soulFunk: 169,
  african: 2,
  blues: 153,
} as const;

const D = DEEZER;

/** For each of our 12 genres, the Deezer genres it can be filed under. */
export const DEEZER_GENRES: Record<string, number[]> = {
  hiphop: [D.rap, D.rnb],
  "uk-rap": [D.rap, D.dance, D.electro], // grime albums are often filed under Dance
  house: [D.dance, D.electro],
  dnb: [D.dance, D.electro],
  techno: [D.dance, D.electro],
  electronic: [D.dance, D.electro, D.alternative],
  pop: [D.pop, D.dance, D.rnb, D.electro, D.alternative],
  "rnb-soul": [D.rnb, D.soulFunk, D.jazz, D.blues],
  // Afro-pop is usually filed under Pop (Tyla's "Water", Victony's "Soweto"), so Pop counts here.
  afro: [D.african, D.dance, D.rnb, D.rap, D.reggae, D.pop],
  "rock-indie": [D.rock, D.alternative, D.metal, D.folk, D.blues],
  metal: [D.metal, D.rock, D.alternative],
  "funk-disco": [D.soulFunk, D.dance, D.pop, D.jazz, D.rnb],
};

/** An artist genre counts when at least this share of their albums (with a genre) carry it. */
export const ARTIST_SHARE = 0.2;

/** What Deezer says about a track's genre: its album's, and how many of the artist's albums are in each. */
export type GenreInfo = { albumGenre?: number; artistGenres?: Record<string, number> };

/** The Deezer genres that describe this track: its album's, plus the artist's main ones. */
export function trackGenres(info: GenreInfo): number[] {
  const out = new Set<number>();
  if (info.albumGenre && info.albumGenre > 0) out.add(info.albumGenre);
  const counts = Object.entries(info.artistGenres ?? {}).filter(([id]) => Number(id) > 0);
  const total = counts.reduce((n, [, c]) => n + c, 0);
  for (const [id, c] of counts) if (c / total >= ARTIST_SHARE) out.add(Number(id));
  return [...out];
}

/** "fits": at least one of the track's genres fits; "off": Deezer has genres and none fit; "unknown": Deezer has none. */
export function genreVerdict(info: GenreInfo, chosen: string[]): "fits" | "off" | "unknown" {
  const genres = trackGenres(info);
  if (!genres.length) return "unknown";
  const allowed = new Set(chosen.flatMap((g) => DEEZER_GENRES[g] ?? []));
  return genres.some((g) => allowed.has(g)) ? "fits" : "off";
}

/**
 * Q5: tempo for Driven and Feral. Deezer often reads fast tracks at half speed (grime's 140 as 70,
 * Pendulum's 174 bpm "Watercolour" as 87), so a reading is only "slow" when it's clearly slow for
 * the genre: below `slowBelow`, and doubling it doesn't give a normal tempo for the genre either.
 * `halfSpeedUnder80`: genres where any reading under 80 is taken as half speed, never slow.
 */
type Tempo = { normal: [number, number]; slowBelow: number; halfSpeedUnder80?: boolean };
export const GENRE_TEMPO: Record<string, Tempo> = {
  hiphop: { normal: [80, 115], slowBelow: 80, halfSpeedUnder80: true },
  "uk-rap": { normal: [85, 150], slowBelow: 80, halfSpeedUnder80: true },
  dnb: { normal: [160, 180], slowBelow: 80, halfSpeedUnder80: true },
  afro: { normal: [95, 125], slowBelow: 88, halfSpeedUnder80: true },
  house: { normal: [118, 132], slowBelow: 110 },
  techno: { normal: [120, 150], slowBelow: 115 },
  electronic: { normal: [100, 180], slowBelow: 90 },
  pop: { normal: [90, 135], slowBelow: 85 },
  "rnb-soul": { normal: [60, 110], slowBelow: 70 },
  "rock-indie": { normal: [90, 180], slowBelow: 80 },
  metal: { normal: [90, 200], slowBelow: 80 },
  "funk-disco": { normal: [100, 130], slowBelow: 95 },
};
const FAST_ENERGIES = new Set(["driven", "feral"]);

/** Clearly slow for this one genre. */
function slowFor(bpm: number, genre: string): boolean {
  const t = GENRE_TEMPO[genre];
  if (!t) return false;
  if (t.halfSpeedUnder80 && bpm < 80) return false;
  const doubled = bpm * 2;
  if (doubled >= t.normal[0] && doubled <= t.normal[1]) return false;
  return bpm < t.slowBelow;
}

/**
 * For Driven and Feral, a track Deezer measures as clearly slow for every chosen genre (it could be
 * any of them). No measurement (0) is never slow.
 */
export const tooSlow = (bpm: number | undefined, energy: string, genres: string[]) =>
  FAST_ENERGIES.has(energy) && !!bpm && bpm > 0 && genres.length > 0 && genres.every((g) => slowFor(bpm, g));
export const needsTempo = (energy: string) => FAST_ENERGIES.has(energy);
