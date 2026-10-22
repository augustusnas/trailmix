"use client";
// The app's side of making, changing, linking and sharing mixes.

import type { Routine } from "@/data/routines";
import { callApi, callApiWithProgress, type ApiResult } from "./api";
import type { Mix, MixTrack } from "./mixTypes";
import { isStage, type StageId } from "./progress";
import { artistsToAvoid, type Saved, type VibeSettings } from "./store";

/** Time limits: the phone gives up after these and says so (the server stops a little sooner). */
export const MIX_TIMEOUT_MS = 45_000;
export const SWAP_TIMEOUT_MS = 15_000;

/** Titles and artists from the last 10 kept mixes, so Claude can keep things fresh (F18). */
export function recentTracks(saved: Saved) {
  return saved.recentMixes.flatMap((m) => m.tracks).slice(0, 250);
}

const settings = (routine: Routine, vibe: VibeSettings, saved: Saved) => ({
  routine: routine.id,
  genres: vibe.genres,
  energy: vibe.energy,
  length: vibe.length,
  avoid: recentTracks(saved),
  avoidArtists: artistsToAvoid(saved, routine.id),
});

/** Makes a mix (or a Remix), reporting each stage the server reaches. */
export function requestMix(
  routine: Routine,
  vibe: VibeSettings,
  saved: Saved,
  remixOf?: Mix,
  onStage: (s: StageId) => void = () => {},
): Promise<ApiResult<{ mix: Mix }>> {
  return callApiWithProgress<{ mix: Mix }>(
    "/api/mix",
    {
      ...settings(routine, vibe, saved),
      remix: remixOf ? { name: remixOf.name, tracks: remixOf.tracks.map(({ title, artist }) => ({ title, artist })) } : undefined,
    },
    (line) => isStage(line.stage) && onStage(line.stage),
    { timeoutMs: MIX_TIMEOUT_MS, onTimeout: "timeout" },
  );
}

export function requestSwap(routine: Routine, vibe: VibeSettings, saved: Saved, mix: Mix, index: number) {
  return callApi<{ mix: Mix }>("/api/swap", { ...settings(routine, vibe, saved), mix, index }, { timeoutMs: SWAP_TIMEOUT_MS, onTimeout: "swapFailed" });
}

type LinkAnswer = {
  results: Pick<MixTrack, "title" | "artist" | "appleUrl">[];
  retryAfterMs: number;
};

/** One round of finding exact Apple Music links: the mix with whatever arrived, and when to ask again. */
export async function fetchLinks(mix: Mix): Promise<{ mix: Mix; retryAfterMs: number } | null> {
  const pending = mix.tracks.filter((t) => t.linksPending);
  if (!pending.length) return { mix, retryAfterMs: 0 };
  const res = await callApi<LinkAnswer>("/api/links", { tracks: pending.map(({ title, artist }) => ({ title, artist })) });
  if (!res.ok) return null;
  const tracks = mix.tracks.map((t) => {
    const r = res.data.results.find((x) => x.title === t.title && x.artist === t.artist);
    return r ? { ...t, appleUrl: r.appleUrl, linksPending: undefined } : t;
  });
  return { mix: { ...mix, tracks }, retryAfterMs: res.data.retryAfterMs };
}

export const linksReady = (mix: Mix) => mix.tracks.every((t) => !t.linksPending);

/** Stores the mix as a shared mix page. */
export function shareMix(mix: Mix) {
  return callApi<{ id: string }>("/api/share", { mix });
}

export const SAVE_TIMEOUT_MS = 30_000;

export type SaveAnswer = { playlistId: string; saved: number; total: number; missing: number[] };

/** Keep it in YouTube Music: a new playlist, or with `retryOf` just the tracks a partial save missed (E6). */
export function savePlaylist(mix: Mix, title: string, retryOf?: string) {
  return callApi<SaveAnswer>("/api/save", { mix, title, retryOf }, { timeoutMs: SAVE_TIMEOUT_MS, onTimeout: "saveFailed" });
}

/** Opens a saved playlist. music.youtube.com links open the YouTube Music app when it's installed. */
export const playlistUrl = (id: string) => `https://music.youtube.com/playlist?list=${encodeURIComponent(id)}`;
