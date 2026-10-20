// The shape of a real mix, shared by the server and the phone.

import { currentGenres } from "@/data/vibe";

/** One track. A mix is one flowing list in playing order (Milestone 4 dropped warm-up, main block and cool-down). */
export type MixTrack = {
  title: string;
  artist: string;
  /** Real length, from Deezer. */
  durationMs: number;
  /** Cache key for this track's lookup. */
  key: string;
  /** The exact Apple Music song. Without it, Apple Music opens a search (as Spotify and YouTube Music always do). */
  appleUrl?: string;
  /** iTunes hasn't been asked for the Apple Music link yet; it's found in the background. */
  linksPending?: boolean;
};

export type Mix = {
  /** Random id for this mix. */
  id: string;
  name: string;
  routineId: string;
  genres: string[];
  energy: string;
  length: number;
  tracks: MixTrack[];
  createdAt: string;
  /** Share of tracks not in the previous 10 mixes, 0–100. */
  freshness?: number;
  /** Set once stored as a shared mix page. */
  shareId?: string;
};

/** F10: a mix may be at most 5 minutes out; the aim is within 2½ (see server/fit.ts). */
export const LENGTH_TOLERANCE_MS = 5 * 60_000;
/** More than 5 minutes short of the chosen length: the only time The mix says how long it came out (Q8). */
export const cameOutShort = (m: Pick<Mix, "tracks" | "length">) => runningMs(m) < m.length * 60_000 - LENGTH_TOLERANCE_MS;

export const runningMs = (m: Pick<Mix, "tracks">) => m.tracks.reduce((n, t) => n + t.durationMs, 0);
export const runningMinutes = (m: Pick<Mix, "tracks">) => Math.round(runningMs(m) / 60000);
export const trackKey = (title: string, artist: string) =>
  `${artist}|${title}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}|]+/gu, " ")
    .trim();

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 300) => (typeof v === "string" && v.length <= max ? v : undefined);
const url = (v: unknown) => {
  const s = str(v, 600);
  return s && /^https:\/\//.test(s) ? s : undefined;
};

/**
 * Cleans a mix read from the phone or from storage; returns null if it isn't a mix.
 * Mixes from before Milestone 4 have a phase on each track; it's ignored, and the tracks (already
 * stored in playing order) show as one list.
 */
export function sanitizeMix(v: unknown): Mix | null {
  if (!isObj(v) || !Array.isArray(v.tracks)) return null;
  const tracks: MixTrack[] = [];
  for (const t of v.tracks.slice(0, 40)) {
    if (!isObj(t)) continue;
    const title = str(t.title, 120);
    const artist = str(t.artist, 120);
    const durationMs = typeof t.durationMs === "number" && t.durationMs > 0 && t.durationMs < 3_600_000 ? t.durationMs : undefined;
    if (!title || !artist || !durationMs) continue;
    tracks.push({
      title,
      artist,
      durationMs,
      key: str(t.key) ?? trackKey(title, artist),
      appleUrl: url(t.appleUrl)?.startsWith("https://music.apple.com/") ? url(t.appleUrl) : undefined,
      linksPending: t.linksPending === true ? true : undefined,
    });
  }
  const id = str(v.id, 64);
  const name = str(v.name, 80);
  const routineId = str(v.routineId, 64);
  if (!id || !name || !routineId || tracks.length === 0) return null;
  return {
    id,
    name,
    routineId,
    genres: Array.isArray(v.genres) ? currentGenres(v.genres) : [],
    energy: str(v.energy, 20) ?? "steady",
    length: typeof v.length === "number" ? v.length : 45,
    tracks,
    createdAt: str(v.createdAt, 40) ?? new Date(0).toISOString(),
    freshness: typeof v.freshness === "number" && v.freshness >= 0 && v.freshness <= 100 ? v.freshness : undefined,
    shareId: str(v.shareId, 64),
  };
}
