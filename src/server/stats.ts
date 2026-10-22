// Running totals kept in Upstash for the friend trial (and, later, the stats page): how many tracks
// Claude has suggested and how many failed a check (didn't exist, wrong artist, only a version that's
// too short or too long, off-genre, too slow for Driven or Feral, or the same song twice). Deezer
// being busy isn't counted as a failure.

import { getKV } from "./kv";
import { failedChecks, type LookupNotes } from "./mixes";

export type TrackCheckTotals = { suggested: number; failed: number; failedPercent: number };

export const STATS_KEYS = { suggested: "stats:suggested", failed: "stats:failed" } as const;

const percent = (failed: number, suggested: number) => (suggested ? Math.round((failed / suggested) * 1000) / 10 : 0);

/** Adds this request's suggestions to the running totals and returns the new totals (null if storage is down). */
export async function recordTrackChecks(notes: LookupNotes): Promise<TrackCheckTotals | null> {
  try {
    const kv = getKV();
    const [suggested, failed] = await Promise.all([
      kv.incrBy(STATS_KEYS.suggested, notes.suggested),
      kv.incrBy(STATS_KEYS.failed, failedChecks(notes)),
    ]);
    return { suggested, failed, failedPercent: percent(failed, suggested) };
  } catch {
    return null; // the counts are nice to have, never worth failing a mix over
  }
}

/** What goes at the end of each mix, remix and swap log line. */
export async function trackCheckLog(notes: LookupNotes) {
  return {
    thisRequest: { suggested: notes.suggested, failed: failedChecks(notes), failedPercent: percent(failedChecks(notes), notes.suggested) },
    runningTotal: await recordTrackChecks(notes),
  };
}

/** How long problem summaries are kept: Vercel's logs only last about an hour. */
export const PROBLEM_DAYS = 7;

/**
 * A mix or remix that came out short or failed: a short summary in Upstash under
 * `problem:<time>`, kept 7 days, so it can be looked at later (Upstash → Data Browser → `problem:*`).
 * Counts only, plus a few of the titles that weren't found; never anything about who made it.
 */
export async function saveProblem(p: {
  event: "mix" | "remix";
  outcome: "short" | "failed" | "timeout" | "resting";
  settings: { routine: string; genres: string[]; energy: string; length: number };
  notes: LookupNotes;
  tracks?: number;
  seconds: number;
}) {
  const n = p.notes;
  const when = new Date().toISOString();
  const summary = {
    when,
    event: p.event,
    outcome: p.outcome,
    ...p.settings,
    minutes: n.minutes,
    tracks: p.tracks,
    seconds: p.seconds,
    /** The last stage reached: picking (Claude), energy (the Deezer check), fitting (topping up), done. */
    step: n.step,
    rounds: n.rounds,
    suggested: n.suggested,
    notFound: n.notFound.length,
    deezerBusy: n.busy,
    wrongArtist: n.wrongArtist.length,
    tooLongOrShort: n.length.length,
    offGenre: n.offGenre.length + n.offGenreReview.length,
    slow: n.slow.length,
    duplicates: n.duplicates.length,
    notFoundExamples: n.notFound.slice(0, 5),
  };
  try {
    await getKV().set(`problem:${when}:${Math.random().toString(36).slice(2, 6)}`, summary, PROBLEM_DAYS * 86400);
  } catch {
    // nice to have, never worth failing over
  }
  return summary;
}
