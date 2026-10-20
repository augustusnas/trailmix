// THE MIX PROMPT. Everything Claude is told lives here, so it can be improved in one place.
// Only checked values reach it (see validate.ts): routine and genre names come from our own lists.

import { CATEGORIES } from "@/data/categories";
import { ENERGIES, GENRES } from "@/data/vibe";
import { minTracks } from "./fit";
import type { MixRequest, TrackRef } from "./validate";

/** Ask for about 30% more than the minimum track count (Q4), so there's spare for fitting and failed checks. */
const SPARE = 1.3;

/** How many tracks to ask for: 11 for 30 minutes, 16 for 45, 21 for 60, 32 for 90. */
export const trackCount = (lengthMin: number) => Math.ceil(minTracks(lengthMin) * SPARE);

const ENERGY_FEEL: Record<string, string> = {
  easy: "relaxed and unhurried; comfortable, conversational intensity",
  steady: "a consistent, confident groove that keeps you moving",
  driven: "determined and pushing; strong drums and momentum",
  feral: "all-out, high-intensity, as hard as the genres allow",
};

export const SYSTEM_PROMPT = `You are Trailmix's music curator. You build workout playlists from real, released recordings.

Every track is checked against a music catalogue: the title, the artist credit, the length and the genre. Any track that fails is thrown out. So accuracy comes first:
- Only pick tracks you are confident exist, credited to the main artist who actually released them (never a featured artist, producer or the artist of a sample). If you're unsure of a title, or of who it's by, leave it out and choose a track you're sure of.
- Only use artists you know well. Deeper cuts come from those artists' own catalogues (album tracks and lesser-known singles), never from obscure artists you know little about.
- Use each track's usual title and main artist name, with no extra words, version notes or emoji.

Rules for every playlist:
- Every track clearly belongs to at least one of the requested genres, by an artist known for that genre. Never fill a gap with a famous track from another genre.
- Only officially released tracks that can be found on Apple Music, Spotify and YouTube Music.
- Use the usual released version (radio length, not extended mixes or live recordings): mostly 3 to 4 minutes, never over 7.
- Each song appears once only: never the same song again as a remix, edit, VIP or other version.
- One flowing list, no sections. Shape the energy gently: a little lighter for the first track or two, the peak through the middle, easing off on the last one or two. For Driven and Feral every track is still fast and intense, with no slow songs anywhere.
- Never put the same artist twice in a row, and use at most 2 tracks by any one artist.
- Freshness: at least 70% of tracks must not be on the "recently played" list, and include a couple of deeper cuts (from well-known artists) alongside the hits.
- The playlist name is fun and short (2 to 5 words), fits the workout and mood, and isn't a song title.`;

const listOrNone = (tracks: TrackRef[]) =>
  tracks.length ? tracks.map((t) => `- ${t.title} — ${t.artist}`).join("\n") : "(none)";

/** Recent artists for this routine: steer away from them, but never at the cost of accuracy. */
const recentArtists = (req: MixRequest) =>
  req.avoidArtists.length
    ? `

Artists in my last few mixes for this routine. Where you can, use other artists so this mix feels different, but only artists you know well; reusing one of these is better than guessing:
${req.avoidArtists.join(", ")}`
    : "";

function describe(req: MixRequest) {
  const genres = req.genres.map((g) => GENRES.find((x) => x.id === g)!.label).join(", ");
  const energy = ENERGIES.find((e) => e.id === req.energy)!.label;
  return [
    `Workout: ${req.routine.name} (${CATEGORIES[req.routine.category].label})`,
    `Genres: ${genres}`,
    `Energy: ${energy}: ${ENERGY_FEEL[req.energy]}`,
    `Length: about ${req.length} minutes`,
  ].join("\n");
}

export function mixPrompt(req: MixRequest, exclude: TrackRef[] = [], avoidName?: string): string {
  return `${describe(req)}

Make a playlist of ${trackCount(req.length)} tracks, in playing order.

Recently played (keep at least 70% of the new playlist off this list):
${listOrNone(req.avoid)}

Don't use any of these at all:
${listOrNone(exclude)}${recentArtists(req)}${avoidName ? `

This is a remix: give it a new name, not "${avoidName}".` : ""}`;
}

/** More tracks for a mix already being made (replacements, top-ups and swaps), for the middle of the list unless `note` says otherwise. */
export function morePrompt(req: MixRequest, count: number, exclude: TrackRef[], note = "", full: string[] = []): string {
  return `${describe(req)}

Suggest ${count} more track${count === 1 ? "" : "s"} for this playlist${note ? ` (${note})` : ""}. Each must fit the requested genres and energy.

Already in the playlist or ruled out (don't repeat any):
${listOrNone(exclude)}

Recently played (prefer tracks not on this list):
${listOrNone(req.avoid)}${full.length ? `

Already twice in the playlist, so don't use these artists: ${full.join(", ")}` : ""}${recentArtists(req)}`;
}

const TRACK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    artist: { type: "string" },
  },
  required: ["title", "artist"],
  additionalProperties: false,
};

export const MIX_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    tracks: { type: "array", items: TRACK_SCHEMA },
  },
  required: ["name", "tracks"],
  additionalProperties: false,
};

export const MORE_SCHEMA = {
  type: "object",
  properties: { tracks: { type: "array", items: TRACK_SCHEMA } },
  required: ["tracks"],
  additionalProperties: false,
};
