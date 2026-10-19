// Making and changing mixes: Claude suggests → every track confirmed real (Deezer) → missing ones
// replaced (E1) → at most 2 per artist → fitted to length (F10, up to 3 rounds of extras) → shown. Apple Music links come afterwards (links route).

import { randomBytes } from "node:crypto";
import { trackKey, type Mix, type MixTrack, type PhaseId } from "@/lib/mixTypes";
import { MixError, suggestMix, suggestMore, type Ask, type SuggestedTrack } from "./claude";
import { AIM_MS, TOLERANCE_MS, fitToLength, separateArtists } from "./fit";
import { confirmTrack, inBatches, simplify, type TrackInfo } from "./lookup";
import type { TrackRef } from "./validate";

/** Stop asking Claude for more after this, so the mix is on screen within about 30 seconds (N2). */
const BUDGET_MS = 28_000;
/** Time limits. The phone gives up a little later (45 and 15 seconds), in case the server never answers. */
export const MIX_LIMIT_MS = 40_000;
export const SWAP_LIMIT_MS = 13_000;
/** F10: rounds of extra main-block tracks when a mix is still short after checking. */
export const LENGTH_ROUNDS = 3;
/** At most this many tracks by one artist in a mix. */
export const MAX_PER_ARTIST = 2;
const AVERAGE_MS = 3.7 * 60_000;

type Found = TrackInfo & { phase: PhaseId };
const refKey = (t: TrackRef) => trackKey(t.title, t.artist);
const artistKey = (artist: string) => simplify(artist);

/** For the server log: how many suggestions were checked, which Deezer didn't find, and how many it was too busy to check. */
export type LookupNotes = { suggested: number; notFound: string[]; busy: number };
export const newNotes = (): LookupNotes => ({ suggested: 0, notFound: [], busy: 0 });

/** The stages the phone shows while a mix is made, in order. */
export type Stage = "picking" | "energy" | "fitting";

/** `extra`: replacements and top-ups, which the "short" test switch makes fail (on top of two in three of the rest). */
async function confirmAll(list: SuggestedTrack[], notes: LookupNotes, a: Ask, extra = false): Promise<{ found: Found[]; missing: SuggestedTrack[] }> {
  const results = extra && a.forced === "short" ? list.map(() => null) : await inBatches(list, 4, (t) => confirmTrack(t.title, t.artist, a.forced, a.deadline));
  notes.suggested += list.length;
  const found: Found[] = [];
  const missing: SuggestedTrack[] = [];
  results.forEach((r, i) => {
    if (r && r !== "unavailable") return found.push({ ...r, phase: list[i].phase });
    missing.push(list[i]);
    if (r === "unavailable") notes.busy++;
    else notes.notFound.push(`${list[i].title} — ${list[i].artist}`);
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
    phase: t.phase,
    durationMs: t.durationMs,
    key: trackKey(t.title, t.artist),
    appleUrl: t.appleUrl,
    linksPending: t.appleDone ? undefined : true,
  };
}

const byPhase = (tracks: Found[]) =>
  (["warm-up", "main", "cool-down"] as PhaseId[]).flatMap((p) => tracks.filter((t) => t.phase === p));

/** F9: a new mix (or a Remix, when `exclude` and `avoidName` are given). */
/** `notes` collects what the catalogue check found, for the log, even if making the mix fails. */
export async function makeMix(
  a: Ask,
  exclude: TrackRef[] = [],
  avoidName?: string,
  notes: LookupNotes = newNotes(),
  onStage: (s: Stage) => void = () => {},
): Promise<{ mix: Mix; timings: Record<string, number>; notes: LookupNotes }> {
  const started = Date.now();
  a.deadline ??= started + MIX_LIMIT_MS;
  const timings: Record<string, number> = {};
  const lap = (name: string) => (timings[name] = Date.now() - started);
  const late = () => Date.now() - started > BUDGET_MS;
  const target = a.req.length * 60_000;
  // Test switch "slow": each stage lasts long enough to see (and screenshot) on the phone.
  const stage = async (s: Stage) => {
    onStage(s);
    if (a.forced === "slow" && s !== "picking") await new Promise((r) => setTimeout(r, 2000));
  };

  onStage("picking");
  const suggestion = await suggestMix(a, exclude, avoidName);
  lap("claude");
  await stage("energy");
  let { found, missing } = await confirmAll(suggestion.tracks, notes, a);
  lap("check");
  // E2: the catalogue is down or too busy to check most tracks, even after retrying.
  if (notes.busy > found.length) throw new MixError("failed");
  // Everything suggested so far, found or not, so failed tracks aren't suggested again.
  const used = () => [...exclude, ...suggestion.tracks, ...found, ...missing];
  // Claude sometimes suggests a track again (phases are asked for at the same time); check each once.
  const checked = new Set(used().map(refKey));
  const unseen = (list: SuggestedTrack[]) =>
    list.filter((t) => {
      const k = refKey(t);
      return checked.has(k) ? false : (checked.add(k), true);
    });
  const fitNow = () => fitToLength(byPhase(capArtists(found)), a.req.length);
  const full = () => fullArtists(capArtists(found));

  // How many more main-block tracks would fill the length, allowing for this mix's failure rate
  // (with grime about half of Claude's suggestions can fail the check).
  const tracksForLength = () => {
    const deficit = target - AIM_MS - fitNow().totalMs;
    if (deficit <= 0) return 0;
    const success = Math.max(0.35, 1 - notes.notFound.length / Math.max(1, notes.suggested));
    return Math.min(15, Math.ceil(deficit / AVERAGE_MS / success) + 1);
  };

  // E1: replace tracks that can't be found, in the same phase, up to 2 tries; then drop them.
  // The phases are asked for at the same time. Main-block requests also cover any shortfall in length.
  const replace = async (phase: PhaseId): Promise<number> => {
    let need = missing.filter((m) => m.phase === phase).length;
    for (let tries = 0; need > 0 && tries < 2 && !late(); tries++) {
      // One spare for warm-up and cool-down, in case a replacement fails too.
      const count = phase === "main" ? Math.max(need, tracksForLength()) : need + 1;
      const more = await suggestMore(a, phase, count, used(), "replacing tracks that couldn't be found in the catalogue, so pick well-known recordings you're certain of", full());
      const r = await confirmAll(unseen(more.slice(0, count)), notes, a, true);
      found = [...found, ...(phase === "main" ? r.found : r.found.slice(0, need))];
      need = Math.max(0, need - r.found.length);
      missing = [...missing, ...r.missing];
    }
    return need;
  };
  const dropped = (await Promise.all((["warm-up", "main", "cool-down"] as PhaseId[]).map(replace))).reduce((n, d) => n + d, 0);
  lap("replacements");

  // F10: fit to length; if still short, ask for more main-block tracks (up to 3 rounds).
  await stage("fitting");
  let fit = fitNow();
  let rounds = 0;
  for (; fit.status === "short" && rounds < LENGTH_ROUNDS && !late(); rounds++) {
    const more = await suggestMore(a, "main", Math.max(3, tracksForLength()), used(), "the playlist is too short", full());
    const r = await confirmAll(unseen(more), notes, a, true);
    found = [...found, ...r.found];
    missing = [...missing, ...r.missing];
    fit = fitNow();
  }
  timings.lengthRounds = rounds;
  lap("fit");

  const tracks = separateArtists(fit.tracks).map(toMixTrack);
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
    shortened: dropped >= 3 || undefined,
    freshness: tracks.length ? Math.round((fresh / tracks.length) * 100) : 100,
  };
  timings.total = Date.now() - started;
  return { mix, timings, notes };
}

/** F11: replace one track with another real one in the same phase, keeping the length within 5 minutes. */
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

  let best: Found | undefined;
  for (let tries = 0; tries < 2 && !best?.durationMs; tries++) {
    const candidates = await suggestMore(a, old.phase, 3, exclude, `swapping out "${old.title}" by ${old.artist}`, fullArtists(rest));
    const { found: all } = await confirmAll(candidates, notes, a);
    const found = all.filter((f) => !full.has(artistKey(f.artist)));
    exclude.push(...candidates);
    const ok = found.find((f) => fits(f.durationMs));
    // If none keeps the length within 5 minutes, take the closest.
    best = ok ?? [...found].sort((x, y) => Math.abs(others + x.durationMs - target) - Math.abs(others + y.durationMs - target))[0];
    if (ok) break;
  }
  if (!best) throw new MixError("failed");
  const tracks = [...mix.tracks];
  tracks[index] = toMixTrack({ ...best, phase: old.phase });
  return { ...mix, tracks, freshness: mix.freshness };
}
