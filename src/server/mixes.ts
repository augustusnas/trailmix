// Making and changing mixes: Claude suggests one flowing list → every track checked on Deezer
// (real, right artist, 1½–7 minutes) and against the vibe (genre, tempo for Driven and Feral, no song
// twice) → at most 2 per artist → fitted to length and the minimum track count, topping up with
// more tracks when over 5 minutes short (F10, Q4, up to 3 rounds) → shown, unless it's still under
// three-quarters of the length ("Try again" instead). Apple Music links come afterwards (links route).

import { randomBytes } from "node:crypto";
import { trackKey, type Mix, type MixTrack } from "@/lib/mixTypes";
import { MixError, reviewGenres, suggestMix, suggestMore, type Ask, type SuggestedTrack } from "./claude";
import { AIM_MS, ENDING, FLOOR, TOLERANCE_MS, fitToLength, minTracks, separateArtists, type Fit } from "./fit";
import { genreVerdict, needsTempo, tooSlow } from "./genres";
import { artistNames, confirmTrack, inBatches, songKey, type TrackInfo } from "./lookup";
import type { TrackRef } from "./validate";

/** Stop asking Claude for more after this, so the mix is on screen within about 30 seconds (N2). */
const BUDGET_MS = 28_000;
/** Time limits. The phone gives up a little later (45 and 15 seconds), in case the server never answers. */
export const MIX_LIMIT_MS = 40_000;
export const SWAP_LIMIT_MS = 13_000;
/** The "slow" test switch: how long each loading stage is held. */
const SLOW_HOLD_MS = 3_000;
/** F10: rounds of extra tracks when a mix is still short (in time or track count) after checking. */
export const LENGTH_ROUNDS = 3;
/** Under three-quarters of the length, keep looking past the 28-second budget (up to 5 rounds) while this much time is left. */
const FLOOR_LEFT_MS = 12_000;
export const FLOOR_ROUNDS = 5;
/** At most this many tracks by one artist in a mix. */
export const MAX_PER_ARTIST = 2;
const AVERAGE_MS = 3.6 * 60_000;
/** When Deezer is busy: pause this long, then try those tracks once more, if this much time is left. */
const BUSY_PAUSE_MS = 1500;
const BUSY_RETRY_LEFT_MS = 8000;

type Found = TrackInfo;
const refKey = (t: TrackRef) => trackKey(t.title, t.artist);
const artistKey = (artist: string) => artistNames(artist)[0];

/**
 * For the server log and the quality report: how many suggestions were checked, and each one that
 * failed, by reason. `noGenre` and `noTempo` count tracks kept because Deezer had nothing to check.
 */
export type LookupNotes = {
  suggested: number;
  /** Not on Deezer at all. */
  notFound: string[];
  /** Q1: the title exists, but by someone else. */
  wrongArtist: string[];
  /** Q4: only in versions under 1½ or over 7 minutes. */
  length: string[];
  /** Q3: Deezer files it (and its artist) outside the chosen genres. */
  offGenre: string[];
  /** Q3: Deezer's genre fits, but Claude's genre review says it's another scene (US rap in UK rap, dubstep in drum & bass). */
  offGenreReview: string[];
  /** Q5: Driven or Feral, and Deezer measures it as slow. */
  slow: string[];
  /** Q2: the same song as one already in the mix. */
  duplicates: string[];
  noGenre: number;
  noTempo: number;
  /** Deezer too busy to answer, even after retrying: not Claude's mistake, so not a failed check. */
  busy: number;
  /** How far making the mix got (the last stage reached), and how many rounds of extra tracks it took. */
  step: Stage | "done";
  rounds: number;
  /** The mix's length in minutes once fitted (also when it's then refused as too short). */
  minutes?: number;
};
export const newNotes = (): LookupNotes => ({ suggested: 0, notFound: [], wrongArtist: [], length: [], offGenre: [], offGenreReview: [], slow: [], duplicates: [], noGenre: 0, noTempo: 0, busy: 0, step: "picking", rounds: 0 });
/** Suggestions that failed a check (Deezer being busy isn't Claude's mistake, so isn't counted). */
export const failedChecks = (n: LookupNotes) =>
  n.notFound.length + n.wrongArtist.length + n.length.length + n.offGenre.length + n.offGenreReview.length + n.slow.length + n.duplicates.length;

/** The stages the phone shows while a mix is made, in order. */
export type Stage = "picking" | "energy" | "fitting";

/**
 * What the loading screen shows (Milestone 5, L1), sent as the work really gets there: each stage
 * as it starts; during "energy", `found` each time Deezer confirms a track that passes the checks;
 * during "fitting", the mix so far (`tracks`, `ms`) after each fitting round.
 */
export type Progress = { stage: Stage; found?: number; tracks?: number; ms?: number };

/**
 * Checks suggestions in order. `seen`: songs already in the mix (Q2), added to as tracks pass.
 * `extra`: top-ups and swaps, which the "short" test switch makes fail (on top of two in three of the rest).
 */
async function confirmAll(
  list: SuggestedTrack[],
  notes: LookupNotes,
  a: Ask,
  seen: Set<string>,
  extra = false,
  onConfirmed: () => void = () => {},
): Promise<{ found: Found[]; missing: SuggestedTrack[] }> {
  const tempo = needsTempo(a.req.energy);
  // The genre review (Q3) runs alongside the catalogue check: Deezer's genres can't tell UK from US
  // rap, or drum & bass from dubstep.
  const review = reviewGenres(a, list);
  // Each track Deezer confirms that's in genre and not too slow counts towards "N tracks found so far".
  const check = async (t: SuggestedTrack) => {
    const r = await confirmTrack(t.title, t.artist, a.forced, a.deadline, tempo);
    if (r !== "unavailable" && !("rejected" in r) && genreVerdict(r, a.req.genres) !== "off" && !tooSlow(r.bpm, a.req.energy, a.req.genres)) onConfirmed();
    return r;
  };
  const results: Awaited<ReturnType<typeof check>>[] =
    extra && (a.forced === "short" || a.forced === "tooshort")
      ? list.map(() => ({ rejected: "notFound" as const }))
      : await inBatches(list, 6, check);
  // Deezer busy even after its own retries: one more try for those tracks after a short pause, if there's time.
  const busy = results.flatMap((r, i) => (r === "unavailable" ? [i] : []));
  if (busy.length && a.forced !== "e2" && (a.deadline ?? Infinity) - Date.now() > BUSY_RETRY_LEFT_MS) {
    await new Promise((r) => setTimeout(r, BUSY_PAUSE_MS));
    const again = await inBatches(busy, 3, (i) => check(list[i]));
    busy.forEach((i, k) => (results[i] = again[k]));
  }
  const off = new Set(await review);
  notes.suggested += list.length;
  const found: Found[] = [];
  const missing: SuggestedTrack[] = [];
  results.forEach((r, i) => {
    const label = `${list[i].title} — ${list[i].artist}`;
    const reviewed = off.has(i);
    const fail = (why: keyof LookupNotes) => {
      missing.push(list[i]);
      (notes[why] as string[]).push(label);
    };
    if (r === "unavailable") {
      missing.push(list[i]);
      notes.busy++;
      return;
    }
    if ("rejected" in r) return fail(r.rejected);
    const genre = genreVerdict(r, a.req.genres);
    if (genre === "off") return fail("offGenre");
    if (tooSlow(r.bpm, a.req.energy, a.req.genres)) return fail("slow");
    const song = songKey(r.title) || r.title.toLowerCase();
    if (seen.has(song)) return fail("duplicates");
    if (reviewed) return fail("offGenreReview");
    seen.add(song);
    if (genre === "unknown") notes.noGenre++;
    if (tempo && !r.bpm) notes.noTempo++;
    found.push(r);
  });
  return { found, missing };
}

/** Keeps the first 2 tracks by each artist (in playing order), drops the rest. */
export function capArtists<T extends { artist: string }>(tracks: T[], max = MAX_PER_ARTIST): T[] {
  const count = new Map<string, number>();
  return tracks.filter((t) => {
    const k = artistKey(t.artist);
    const n = (count.get(k) ?? 0) + 1;
    count.set(k, n);
    return n <= max;
  });
}

/** Artists already used the most allowed times, so Claude doesn't suggest them again. */
function fullArtists(tracks: { artist: string }[]): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const t of tracks) {
    const k = artistKey(t.artist);
    count.set(k, { name: t.artist, n: (count.get(k)?.n ?? 0) + 1 });
  }
  return [...count.values()].filter((c) => c.n >= MAX_PER_ARTIST).map((c) => c.name);
}

function toMixTrack(t: Found): MixTrack {
  return {
    title: t.title,
    artist: t.artist,
    durationMs: t.durationMs,
    key: trackKey(t.title, t.artist),
    appleUrl: t.appleUrl,
    linksPending: t.appleDone ? undefined : true,
  };
}

/** Asking for more: what every top-up, replacement and swap reminds Claude of. */
const MORE_NOTE =
  "pick tracks you're certain of, credited to their main artist, clearly in the requested genres, mostly 3 to 4 minutes long (radio edits where the usual release is longer)";

/** F9: a new mix (or a Remix, when `exclude` and `avoidName` are given). */
/** `notes` collects what the checks found, for the log, even if making the mix fails. */
export async function makeMix(
  a: Ask,
  exclude: TrackRef[] = [],
  avoidName?: string,
  notes: LookupNotes = newNotes(),
  onProgress: (p: Progress) => void = () => {},
): Promise<{ mix: Mix; timings: Record<string, number>; notes: LookupNotes }> {
  const started = Date.now();
  a.deadline ??= started + MIX_LIMIT_MS;
  const timings: Record<string, number> = {};
  const lap = (name: string) => (timings[name] = Date.now() - started);
  const late = () => Date.now() - started > BUDGET_MS;
  const target = a.req.length * 60_000;
  const min = minTracks(a.req.length);
  // Test switch "slow": each stage is held about 3 seconds at its end, with its final line showing,
  // so all three can be seen (and screenshotted) on the phone.
  const hold = () => (a.forced === "slow" ? new Promise((r) => setTimeout(r, SLOW_HOLD_MS)) : undefined);
  const stage = async (s: Stage) => {
    await hold();
    notes.step = s;
    onProgress({ stage: s });
  };

  onProgress({ stage: "picking" });
  const suggestion = await suggestMix(a, exclude, avoidName);
  lap("claude");
  await stage("energy");
  const seen = new Set<string>();
  let confirmed = 0;
  const first = await confirmAll(suggestion.tracks, notes, a, seen, false, () => onProgress({ stage: "energy", found: ++confirmed }));
  lap("check");
  // E2: the catalogue is down or too busy to check most tracks, even after retrying.
  if (notes.busy > first.found.length) throw new MixError("failed", "Deezer busy for most tracks");
  // Test switches: only enough tracks for about 85% ("short") or half ("tooshort") of the length are found.
  if (a.forced === "short" || a.forced === "tooshort") {
    let sum = 0;
    const share = a.forced === "short" ? 0.88 : 0.5;
    const keep = first.found.filter((t) => (sum += t.durationMs) <= share * target);
    first.missing.push(...first.found.slice(keep.length));
    first.found = keep;
  }

  // Claude's last couple of tracks ease off: they stay the ending, and extras go before them.
  const endCount = first.found.length >= 6 ? ENDING : 0;
  const ending = first.found.slice(first.found.length - endCount);
  let extras: Found[] = [];
  let missing = first.missing;
  const ordered = () => [...first.found.slice(0, first.found.length - endCount), ...extras, ...ending];
  const fit = (room = true): Fit<Found> => {
    const capped = capArtists(ordered());
    return fitToLength(capped.filter((t) => !ending.includes(t)), capped.filter((t) => ending.includes(t)), a.req.length, room);
  };

  // Everything suggested so far, found or not, so failed tracks aren't suggested again.
  const used = () => [...exclude, ...suggestion.tracks, ...ordered(), ...missing];
  // Claude sometimes suggests a track again; check each once.
  const checked = new Set(used().map(refKey));
  const unseen = (list: SuggestedTrack[]) =>
    list.filter((t) => {
      const k = refKey(t);
      return checked.has(k) ? false : (checked.add(k), true);
    });
  const full = () => fullArtists(capArtists(ordered()));

  // How many more tracks would fill the length and the minimum count, allowing for this mix's
  // failure rate (with grime about half of Claude's suggestions can fail a check).
  const tracksNeeded = (now: Fit<Found>) => {
    const byTime = Math.ceil(Math.max(0, target - AIM_MS - now.totalMs) / AVERAGE_MS);
    const byCount = Math.max(0, min - now.tracks.length);
    const need = Math.max(byTime, byCount, 2); // at least 8 suggestions a round: small top-ups often all fail
    const success = Math.max(0.35, 1 - failedChecks(notes) / Math.max(1, notes.suggested));
    return Math.min(30, Math.ceil(need / success) + 2);
  };

  // F10 / E1: top up while short (failed tracks are simply not used), up to 3 rounds. Under
  // three-quarters of the length, keep going while there's time: a badly short mix is never shown.
  await stage("fitting");
  let now = fit();
  const fitted = () => onProgress({ stage: "fitting", tracks: now.tracks.length, ms: now.totalMs });
  fitted();
  let rounds = 0;
  const belowFloor = (f: Fit<Found>) => f.totalMs < FLOOR * target;
  const keepGoing = () =>
    now.status === "short" &&
    (belowFloor(now) ? rounds < FLOOR_ROUNDS && a.deadline! - Date.now() > FLOOR_LEFT_MS : rounds < LENGTH_ROUNDS && !late());
  for (; keepGoing(); rounds++) {
    notes.rounds = rounds + 1;
    const count = tracksNeeded(now);
    const more = await suggestMore(a, count, used(), `the playlist needs more tracks for the middle; ${MORE_NOTE}`, full());
    const r = await confirmAll(unseen(more), notes, a, seen, true);
    extras = [...extras, ...r.found];
    missing = [...missing, ...r.missing];
    now = fit();
    fitted();
  }
  timings.lengthRounds = rounds;
  notes.rounds = rounds;
  // Still more than 5 minutes short because the tracks run long: length matters more than the count.
  if (now.totalMs < target - TOLERANCE_MS) {
    const loose = fit(false);
    if (loose.totalMs > now.totalMs) {
      now = loose;
      fitted();
    }
  }
  await hold();
  lap("fit");
  notes.minutes = Math.round(now.totalMs / 6000) / 10;
  if (belowFloor(now)) throw new MixError("failed", "under three-quarters of the length");

  const tracks = separateArtists(now.tracks).map(toMixTrack);
  const avoid = new Set(a.req.avoid.map(refKey));
  const fresh = tracks.filter((t) => !avoid.has(t.key)).length;
  const mix: Mix = {
    id: randomBytes(12).toString("base64url"),
    name: suggestion.name,
    routineId: a.req.routine.id,
    genres: a.req.genres,
    energy: a.req.energy,
    length: a.req.length,
    tracks,
    createdAt: new Date().toISOString(),
    freshness: tracks.length ? Math.round((fresh / tracks.length) * 100) : 100,
  };
  timings.total = Date.now() - started;
  notes.step = "done";
  return { mix, timings, notes };
}

/** Where a track sits, so a swap keeps the energy shape. */
function position(index: number, count: number) {
  if (index < 2) return "near the start, so a little lighter";
  if (index >= count - ENDING) return "at the end, easing off";
  return "in the middle, at the peak";
}

/** F11: replace one track with another real one of similar energy in the same genres, keeping the length within 5 minutes. */
export async function swapTrack(a: Ask, mix: Mix, index: number, notes: LookupNotes = newNotes()): Promise<Mix> {
  a.deadline ??= Date.now() + SWAP_LIMIT_MS;
  if (a.forced === "slowswap") {
    // Test switch: the swap takes longer than its time limit.
    await new Promise((r) => setTimeout(r, Math.max(0, a.deadline! - Date.now())));
    throw new MixError("timeout");
  }
  const old = mix.tracks[index];
  const rest = mix.tracks.filter((_, i) => i !== index);
  const others = rest.reduce((n, t) => n + t.durationMs, 0);
  const target = mix.length * 60_000;
  const fits = (d: number) => Math.abs(others + d - target) <= TOLERANCE_MS;
  const full = new Set(fullArtists(rest).map(artistKey));
  const exclude: TrackRef[] = [...mix.tracks, ...a.req.avoid];
  const note = `swapping out "${old.title}" by ${old.artist}, track ${index + 1} of ${mix.tracks.length}, ${position(index, mix.tracks.length)}: similar energy; ${MORE_NOTE}`;

  let best: Found | undefined;
  for (let tries = 0; tries < 2 && !best?.durationMs; tries++) {
    const candidates = await suggestMore(a, 3, exclude, note, fullArtists(rest));
    const seen = new Set(rest.map((t) => songKey(t.title) || t.title.toLowerCase()));
    const { found: all } = await confirmAll(candidates, notes, a, seen, true);
    const found = all.filter((f) => !full.has(artistKey(f.artist)));
    exclude.push(...candidates);
    const ok = found.find((f) => fits(f.durationMs));
    // If none keeps the length within 5 minutes, take the closest.
    best = ok ?? [...found].sort((x, y) => Math.abs(others + x.durationMs - target) - Math.abs(others + y.durationMs - target))[0];
    if (ok) break;
  }
  if (!best) throw new MixError("failed");
  const tracks = [...mix.tracks];
  tracks[index] = toMixTrack(best);
  return { ...mix, tracks, freshness: mix.freshness };
}
