// Running totals kept in Upstash for the friend trial (and, later, the stats page): how many tracks
// Claude has suggested and how many failed the catalogue check (didn't exist, wrong artist, or a
// version that's too short or too long). Deezer being busy isn't counted as a failure.

import { getKV } from "./kv";
import type { LookupNotes } from "./mixes";

export type TrackCheckTotals = { suggested: number; failed: number; failedPercent: number };

export const STATS_KEYS = { suggested: "stats:suggested", failed: "stats:failed" } as const;

const percent = (failed: number, suggested: number) => (suggested ? Math.round((failed / suggested) * 1000) / 10 : 0);

/** Adds this request's suggestions to the running totals and returns the new totals (null if storage is down). */
export async function recordTrackChecks(notes: LookupNotes): Promise<TrackCheckTotals | null> {
  try {
    const kv = getKV();
    const [suggested, failed] = await Promise.all([
      kv.incrBy(STATS_KEYS.suggested, notes.suggested),
      kv.incrBy(STATS_KEYS.failed, notes.notFound.length),
    ]);
    return { suggested, failed, failedPercent: percent(failed, suggested) };
  } catch {
    return null; // the counts are nice to have, never worth failing a mix over
  }
}

/** What goes at the end of each mix, remix and swap log line. */
export async function trackCheckLog(notes: LookupNotes) {
  return {
    thisRequest: { suggested: notes.suggested, failed: notes.notFound.length, failedPercent: percent(notes.notFound.length, notes.suggested) },
    runningTotal: await recordTrackChecks(notes),
  };
}
