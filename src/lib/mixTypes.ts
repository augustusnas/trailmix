// The shape of a real mix, shared by the server and the phone.

export type PhaseId = "warm-up" | "main" | "cool-down";
export const PHASES: { id: PhaseId; label: string; note: string }[] = [
  { id: "warm-up", label: "Warm-up", note: "easing in" },
  { id: "main", label: "Main block", note: "building all the way" },
  { id: "cool-down", label: "Cool-down", note: "bring it home" },
];

export type MixTrack = {
  title: string;
  artist: string;
  phase: PhaseId;
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
  /** 3+ tracks couldn't be found, so it's shorter than asked. */
  shortened?: boolean;
  /** Share of tracks not in the previous 10 mixes, 0–100. */
  freshness?: number;
  /** Set once stored as a shared mix page. */
  shareId?: string;
};

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

/** Cleans a mix read from the phone or from storage; returns null if it isn't a mix. */
export function sanitizeMix(v: unknown): Mix | null {
  if (!isObj(v) || !Array.isArray(v.tracks)) return null;
  const tracks: MixTrack[] = [];
  for (const t of v.tracks.slice(0, 40)) {
    if (!isObj(t)) continue;
    const title = str(t.title, 120);
    const artist = str(t.artist, 120);
    const phase = PHASES.some((p) => p.id === t.phase) ? (t.phase as PhaseId) : undefined;
    const durationMs = typeof t.durationMs === "number" && t.durationMs > 0 && t.durationMs < 3_600_000 ? t.durationMs : undefined;
    if (!title || !artist || !phase || !durationMs) continue;
    tracks.push({
      title,
      artist,
      phase,
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
    genres: Array.isArray(v.genres) ? v.genres.filter((g): g is string => typeof g === "string").slice(0, 3) : [],
    energy: str(v.energy, 20) ?? "steady",
    length: typeof v.length === "number" ? v.length : 45,
    tracks,
    createdAt: str(v.createdAt, 40) ?? new Date(0).toISOString(),
    shortened: v.shortened === true || undefined,
    freshness: typeof v.freshness === "number" && v.freshness >= 0 && v.freshness <= 100 ? v.freshness : undefined,
    shareId: str(v.shareId, 64),
  };
}
