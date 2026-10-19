// Fixed choices on the Set the vibe screen.

export type Option = { id: string; label: string };

export const GENRES: Option[] = [
  { id: "hiphop", label: "Hip-hop" },
  { id: "uk-rap", label: "UK rap & grime" },
  { id: "house", label: "House" },
  { id: "dnb", label: "Drum & bass" },
  { id: "techno", label: "Techno" },
  { id: "electronic", label: "Electronic" },
  { id: "pop", label: "Pop" },
  { id: "rnb-soul", label: "R&B & soul" },
  { id: "afro", label: "Afrobeats & amapiano" },
  { id: "rock-indie", label: "Rock & indie" },
  { id: "metal", label: "Metal" },
  { id: "funk-disco", label: "Funk & disco" },
];

/** Milestone 2–3 genres, so saved vibes and mixes from before the October 2026 list still work (E12). */
const OLD_GENRES: Record<string, string> = {
  grime: "uk-rap",
  afrobeats: "afro",
  amapiano: "afro",
  rnb: "rnb-soul",
  soul: "rnb-soul",
  rock: "rock-indie",
  disco: "funk-disco",
  "jazz-funk": "funk-disco",
};

/** A genre id from today's list (old ids become their closest new one), or undefined if it isn't a genre. */
export function currentGenre(id: unknown): string | undefined {
  if (typeof id !== "string") return undefined;
  const now = OLD_GENRES[id] ?? id;
  return GENRES.some((g) => g.id === now) ? now : undefined;
}

/** Cleans a list of genres: old ids mapped, unknown ones dropped, no repeats, at most 3. */
export function currentGenres(ids: unknown[]): string[] {
  return [...new Set(ids.map(currentGenre).filter((g): g is string => Boolean(g)))].slice(0, MAX_GENRES);
}

export const ENERGIES: Option[] = [
  { id: "easy", label: "Easy" },
  { id: "steady", label: "Steady" },
  { id: "driven", label: "Driven" },
  { id: "feral", label: "Feral" },
];

export const LENGTHS = [30, 45, 60, 90] as const;

/** Most genres one mix can have. */
export const MAX_GENRES = 3;

export const DEFAULT_ENERGY = "steady";

/**
 * First-time length for a routine: the listed length closest to the middle of its typical minutes.
 * On a tie, the shorter one (Tabata 4–20 → 30, Push day 45–60 → 45).
 */
export function defaultLength(range: { min: number; max: number }): number {
  const mid = (range.min + range.max) / 2;
  return LENGTHS.reduce((best, l) => (Math.abs(l - mid) < Math.abs(best - mid) ? l : best), LENGTHS[0]);
}
