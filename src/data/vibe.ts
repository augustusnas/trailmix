// Fixed choices on the Set the vibe screen.

export type Option = { id: string; label: string };

export const GENRES: Option[] = [
  { id: "hiphop", label: "Hip-hop" },
  { id: "afrobeats", label: "Afrobeats" },
  { id: "house", label: "House" },
  { id: "dnb", label: "Drum & bass" },
  { id: "rnb", label: "90s R&B" },
  { id: "rock", label: "Rock" },
  { id: "grime", label: "Grime" },
  { id: "amapiano", label: "Amapiano" },
  { id: "soul", label: "Soul" },
  { id: "disco", label: "Disco" },
  { id: "pop", label: "Pop" },
  { id: "jazz-funk", label: "Jazz-funk" },
];

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
