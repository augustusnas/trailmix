// E11: everything that might reach Claude is checked against the fixed lists first.
// Free text never gets into the prompt; recent tracks are cleaned and length-capped.

import { getRoutine, type Routine } from "@/data/routines";
import { ENERGIES, LENGTHS, MAX_GENRES, currentGenre } from "@/data/vibe";

export type TrackRef = { title: string; artist: string };
export type MixRequest = {
  routine: Routine;
  genres: string[];
  energy: string;
  length: number;
  avoid: TrackRef[];
  /** Artists from the last 5 mixes for this routine, to steer away from where possible. */
  avoidArtists: string[];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Song titles and artists only: letters, numbers, common punctuation, at most 80 characters. */
export function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\p{M} .,'’&()!?\-\/+:#$*]/gu, "")
    .replace(/ +/g, " ")
    .trim()
    .slice(0, 80);
  return s.length ? s : null;
}

export function cleanTracks(v: unknown, max: number): TrackRef[] {
  if (!Array.isArray(v)) return [];
  const out: TrackRef[] = [];
  for (const t of v.slice(0, max)) {
    if (!isObj(t)) continue;
    const title = cleanText(t.title);
    const artist = cleanText(t.artist);
    if (title && artist) out.push({ title, artist });
  }
  return out;
}

export function cleanArtists(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of v.slice(0, max * 2)) {
    const name = cleanText(a);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.slice(0, max);
}

/** Returns the checked request, or null if anything isn't from the fixed lists. */
export function validateMixRequest(body: unknown): MixRequest | null {
  if (!isObj(body)) return null;
  const routine = typeof body.routine === "string" ? getRoutine(body.routine) : undefined;
  if (!routine) return null;
  const { genres, energy, length } = body;
  if (!Array.isArray(genres) || genres.length < 1 || genres.length > MAX_GENRES) return null;
  // A phone still running the old app may send an old genre id; it becomes its closest new one.
  const ids = genres.map(currentGenre);
  if (!ids.every(Boolean)) return null;
  if (new Set(ids).size !== ids.length) return null;
  if (typeof energy !== "string" || !ENERGIES.some((e) => e.id === energy)) return null;
  if (typeof length !== "number" || !(LENGTHS as readonly number[]).includes(length)) return null;
  // Up to 10 recent mixes' worth of tracks.
  return { routine, genres: ids as string[], energy, length, avoid: cleanTracks(body.avoid, 250), avoidArtists: cleanArtists(body.avoidArtists, 100) };
}
