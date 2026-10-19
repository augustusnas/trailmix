// F10: fitting to length. Claude doesn't decide length; real durations do.
// Warm-up and cool-down stay whole; the main block is filled in Claude's order until the total is
// within 5 minutes of the chosen length. Tracks that would overshoot are skipped (a shorter one
// from the spare takes the place).

export const TOLERANCE_MS = 5 * 60_000;

export type Timed = { phase: "warm-up" | "main" | "cool-down"; durationMs: number };

export function fitToLength<T extends Timed>(tracks: T[], lengthMin: number): { tracks: T[]; status: "ok" | "short" | "long"; totalMs: number } {
  const target = lengthMin * 60_000;
  const warm = tracks.filter((t) => t.phase === "warm-up");
  const cool = tracks.filter((t) => t.phase === "cool-down");
  const main = tracks.filter((t) => t.phase === "main");
  let total = [...warm, ...cool].reduce((n, t) => n + t.durationMs, 0);
  const chosen: T[] = [];
  for (const t of main) {
    if (total >= target - TOLERANCE_MS) break;
    if (total + t.durationMs > target + TOLERANCE_MS) continue; // too long here: skip to a shorter spare
    chosen.push(t);
    total += t.durationMs;
  }
  const status = total < target - TOLERANCE_MS ? "short" : total > target + TOLERANCE_MS ? "long" : "ok";
  return { tracks: [...warm, ...chosen, ...cool], status, totalMs: total };
}

/** Never the same artist twice in a row: swap a clash with the next different track in the same phase. */
export function separateArtists<T extends Timed & { artist: string }>(tracks: T[]): T[] {
  const out = [...tracks];
  for (let i = 1; i < out.length; i++) {
    if (out[i].artist.toLowerCase() !== out[i - 1].artist.toLowerCase()) continue;
    const j = out.findIndex(
      (t, k) => k > i && t.phase === out[i].phase && t.artist.toLowerCase() !== out[i - 1].artist.toLowerCase(),
    );
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
