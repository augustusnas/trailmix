// Making and changing mixes: Claude suggests → every track confirmed real (iTunes) → missing ones
// replaced (E1) → fitted to length (F10) → shown. Links for other apps come afterwards (links route).

import { randomBytes } from "node:crypto";
import { trackKey, type Mix, type MixTrack, type PhaseId } from "@/lib/mixTypes";
import { MixError, suggestMix, suggestMore, type Ask, type SuggestedTrack } from "./claude";
import { TOLERANCE_MS, fitToLength, separateArtists } from "./fit";
import { confirmTrack, inBatches, type TrackInfo } from "./lookup";
import type { TrackRef } from "./validate";

const BUDGET_MS = 24_000; // stop adding extras in time to show the mix within ~30 seconds (N2)
const AVERAGE_MS = 3.7 * 60_000;

type Found = TrackInfo & { phase: PhaseId };
const refKey = (t: TrackRef) => trackKey(t.title, t.artist);

async function confirmAll(list: SuggestedTrack[]): Promise<{ found: Found[]; missing: SuggestedTrack[] }> {
  const results = await inBatches(list, 4, (t) => confirmTrack(t.title, t.artist));
  const found: Found[] = [];
  const missing: SuggestedTrack[] = [];
  results.forEach((r, i) => (r && r !== "unavailable" ? found.push({ ...r, phase: list[i].phase }) : missing.push(list[i])));
  return { found, missing };
}

function toMixTrack(t: Found): MixTrack {
  return {
    title: t.title,
    artist: t.artist,
    phase: t.phase,
    durationMs: t.durationMs,
    key: trackKey(t.title, t.artist),
    appleUrl: t.appleUrl,
    spotifyUrl: t.spotifyUrl,
    youtubeMusicUrl: t.youtubeMusicUrl,
    youtubeUrl: t.youtubeUrl,
    youtubeId: t.youtubeId,
    linksPending: t.linksDone ? undefined : true,
  };
}

const byPhase = (tracks: Found[]) =>
  (["warm-up", "main", "cool-down"] as PhaseId[]).flatMap((p) => tracks.filter((t) => t.phase === p));

/** F9: a new mix (or a Remix, when `exclude` and `avoidName` are given). */
export async function makeMix(a: Ask, exclude: TrackRef[] = [], avoidName?: string): Promise<{ mix: Mix; timings: Record<string, number> }> {
  const started = Date.now();
  const timings: Record<string, number> = {};
  const lap = (name: string) => (timings[name] = Date.now() - started);
  const late = () => Date.now() - started > BUDGET_MS;

  const suggestion = await suggestMix(a, exclude, avoidName);
  lap("claude");
  let { found, missing } = await confirmAll(suggestion.tracks);
  lap("itunes");
  const used = () => [...exclude, ...suggestion.tracks, ...found];

  // E1: replace tracks iTunes can't find, in the same phase, up to 2 tries; then drop them.
  let dropped = 0;
  for (const phase of ["warm-up", "main", "cool-down"] as PhaseId[]) {
    let need = missing.filter((m) => m.phase === phase).length;
    for (let tries = 0; need > 0 && tries < 2 && !late(); tries++) {
      const more = await suggestMore(a, phase, need, used(), "replacing tracks that couldn't be found");
      const r = await confirmAll(more.slice(0, need));
      found = [...found, ...r.found];
      need -= r.found.length;
      missing = [...missing, ...r.missing];
    }
    dropped += need;
  }
  lap("replacements");

  // F10: fit to length; if still short, ask for more main-block tracks (up to 2 rounds).
  let fit = fitToLength(byPhase(found), a.req.length);
  for (let round = 0; fit.status === "short" && round < 2 && !late(); round++) {
    const deficit = a.req.length * 60_000 - TOLERANCE_MS / 2 - fit.totalMs;
    const more = await suggestMore(a, "main", Math.ceil(deficit / AVERAGE_MS) + 2, used(), "the playlist is too short");
    const r = await confirmAll(more);
    found = [...found, ...r.found];
    fit = fitToLength(byPhase(found), a.req.length);
  }
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
  return { mix, timings };
}

/** F11: replace one track with another real one in the same phase, keeping the length within 5 minutes. */
export async function swapTrack(a: Ask, mix: Mix, index: number): Promise<Mix> {
  const old = mix.tracks[index];
  const others = mix.tracks.reduce((n, t, i) => (i === index ? n : n + t.durationMs), 0);
  const target = mix.length * 60_000;
  const fits = (d: number) => Math.abs(others + d - target) <= TOLERANCE_MS;
  const exclude: TrackRef[] = [...mix.tracks, ...a.req.avoid];

  let best: Found | undefined;
  for (let tries = 0; tries < 2 && !best?.durationMs; tries++) {
    const candidates = await suggestMore(a, old.phase, 3, exclude, `swapping out "${old.title}" by ${old.artist}`);
    const { found } = await confirmAll(candidates);
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
