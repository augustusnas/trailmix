// F10 and Q4: fitting to length. Claude doesn't decide length; real durations do.
// A mix is one flowing list. Claude's last couple of tracks ease off, so they stay as the ending;
// the rest is filled in Claude's order until the total is within 2½ minutes of the chosen length and
// there are at least the minimum number of tracks. Tracks that would overshoot, or leave too little
// time for the minimum, are skipped (a later one takes the place).
// Length is a guide, not a hard target: music apps keep playing similar tracks when a playlist ends.
// So a mix only counts as short (worth asking Claude for more) when it's over 5 minutes short or two
// or more tracks under the minimum, and it's never shown under three-quarters of the length.

import { LENGTH_TOLERANCE_MS } from "@/lib/mixTypes";

export const TOLERANCE_MS = LENGTH_TOLERANCE_MS;
/** Fill until within 2½ minutes of the target, not just 5, so the mix isn't left at the edge. */
export const AIM_MS = TOLERANCE_MS / 2;
/** How many of Claude's last tracks are the ending (easing off), kept at the end. */
export const ENDING = 2;
/** When picking a track, room left for each track still needed that isn't in the list yet (a top-up will bring it). */
const ROOM_PER_TRACK_MS = 3 * 60_000;

/** Never show a mix under this share of the chosen length: "Try again" instead. */
export const FLOOR = 0.75;
/** Q4: a track or two under the minimum count is fine. */
export const COUNT_SLACK = 1;

/** Q4: about 8 tracks for 30 minutes, 12 for 45, 16 for 60, 24 for 90. */
export const minTracks = (lengthMin: number) => Math.ceil(lengthMin / 3.75);

export type Timed = { durationMs: number };
/** "short": over 5 minutes short, or two or more tracks under the minimum. */
export type Fit<T> = { tracks: T[]; status: "ok" | "short" | "long"; totalMs: number };

/**
 * `body` in playing order, then `ending`. `room: false` drops the minimum-count rule, for a last
 * try when there aren't enough short tracks: then the length matters more than the count.
 */
export function fitToLength<T extends Timed>(body: T[], ending: T[], lengthMin: number, room = true): Fit<T> {
  const target = lengthMin * 60_000;
  const min = minTracks(lengthMin);
  let total = ending.reduce((n, t) => n + t.durationMs, 0);
  const chosen: T[] = [];
  // The time the next n tracks need at the least: the shortest ones still to come.
  const shortestAfter = (i: number, n: number) => {
    const later = body.slice(i + 1).map((t) => t.durationMs).sort((x, y) => x - y);
    return later.slice(0, n).reduce((sum, d) => sum + d, 0) + Math.max(0, n - later.length) * ROOM_PER_TRACK_MS;
  };
  for (const [i, t] of body.entries()) {
    const count = chosen.length + ending.length;
    if (total >= target - AIM_MS && count >= min) break;
    if (total + t.durationMs > target + AIM_MS) continue; // too long here: a later, shorter one takes the place
    const stillNeeded = Math.max(0, min - count - 1);
    // Skip a track that would leave too little time for the minimum count (Q4).
    if (room && stillNeeded && shortestAfter(i, stillNeeded) > target + AIM_MS - total - t.durationMs) continue;
    chosen.push(t);
    total += t.durationMs;
  }
  const count = chosen.length + ending.length;
  const status = total < target - TOLERANCE_MS || count < min - COUNT_SLACK ? "short" : total > target + AIM_MS ? "long" : "ok";
  return { tracks: [...chosen, ...ending], status, totalMs: total };
}

/**
 * Never the same artist twice in a row: swap a clash with the next different track, leaving the
 * ending where it is. A clash at the very end (no later track to swap with) swaps with an earlier one
 * that fits there (the latest one, to keep the energy shape).
 */
export function separateArtists<T extends { artist: string }>(tracks: T[], ending = ENDING): T[] {
  const out = [...tracks];
  const bodyEnd = Math.max(0, out.length - ending);
  const same = (x: T | undefined, y: T | undefined) => !!x && !!y && x.artist.toLowerCase() === y.artist.toLowerCase();
  // Putting t at position k doesn't clash with its neighbours (other than position `skip`).
  const fitsAt = (t: T, k: number, skip: number) => (k - 1 === skip || !same(t, out[k - 1])) && (k + 1 === skip || !same(t, out[k + 1]));
  for (let i = 1; i < out.length; i++) {
    if (!same(out[i], out[i - 1])) continue;
    const limit = i < bodyEnd ? bodyEnd : out.length;
    let j = out.findIndex((t, k) => k > i && k < limit && !same(t, out[i - 1]));
    if (j < 0) j = out.findLastIndex((t, k) => k < i - 1 && fitsAt(t, i, k) && fitsAt(out[i], k, i));
    if (j >= 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
