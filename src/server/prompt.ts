// THE MIX PROMPT. Everything Claude is told lives here, so it can be improved in one place.
// Only checked values reach it (see validate.ts): routine and genre names come from our own lists.

import { CATEGORIES } from "@/data/categories";
import { ENERGIES, GENRES } from "@/data/vibe";
import { minTracks } from "./fit";
import type { MixRequest, TrackRef } from "./validate";

/** Ask for about 60% more than the minimum track count (Q4): with grime and drum & bass about half of suggestions fail a check. */
const SPARE = 1.6;

/** How many tracks to ask for: 13 for 30 minutes, 20 for 45, 26 for 60, 39 for 90. */
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
- Use each track's usual title and main artist name, with no extra words, version notes or emoji. The one exception: write "(Radio Edit)" after the title when the usual release runs over 5 minutes and a radio edit exists.

Rules for every playlist:
- Every track clearly belongs to at least one of the requested genres, by an artist known for that genre. Never fill a gap with a famous track from another genre.
- Only officially released tracks that can be found on Apple Music, Spotify and YouTube Music.
- Use the usual released version (radio length, not extended mixes or live recordings): mostly 3 to 4 minutes, never over 7.
- Each song appears once only: never the same song again as a remix, edit, VIP or other version.
- One flowing list, no sections. Shape the energy gently: a little lighter for the first track or two, the peak through the middle, easing off on the last one or two. For Driven and Feral every track is still fast and intense, with no slow songs anywhere.
- Never put the same artist twice in a row, and use at most 2 tracks by any one artist.
- Freshness: at least 70% of tracks must not be on the "recently played" list, and include a couple of deeper cuts (from well-known artists) alongside the hits.
- The playlist name is fun and short (2 to 5 words), fits the workout and mood, and isn't a song title.`;

/** What each genre means, so suggestions and the genre review agree on its edges. */
export const GENRE_MEANING: Record<string, string> = {
  hiphop: "hip-hop and rap from any country",
  "uk-rap": "British rap, grime and UK drill by UK artists (not US rap)",
  house: "house music (about 118–130 bpm), including deep, tech and UK garage-leaning house",
  dnb: "drum & bass and jungle (about 160–180 bpm); not dubstep, EDM, trap, house or pop",
  techno: "techno (about 120–150 bpm), not EDM or pop dance",
  electronic: "electronic dance music broadly: EDM, dubstep, electro, breakbeat, trance and similar",
  pop: "mainstream pop and dance-pop",
  "rnb-soul": "R&B, neo-soul and classic soul",
  afro: "Afrobeats, afro-fusion, afropop and amapiano by African or African-diaspora artists",
  "rock-indie": "rock, alternative and indie",
  metal: "metal and hard rock",
  "funk-disco": "funk, disco and nu-disco",
};

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
  const genres = req.genres.map((g) => `- ${GENRES.find((x) => x.id === g)!.label}: ${GENRE_MEANING[g]}`).join("\n");
  const energy = ENERGIES.find((e) => e.id === req.energy)!.label;
  return [
    `Workout: ${req.routine.name} (${CATEGORIES[req.routine.category].label})`,
    `Genres (at least one per track):\n${genres}`,
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

/**
 * The genre review: after the catalogue check, which tracks aren't really in the chosen genres?
 * The catalogue's genres are too broad to tell US rap from UK rap, or dubstep from drum & bass.
 */
export function reviewPrompt(req: MixRequest, tracks: TrackRef[]): string {
  const genres = req.genres.map((g) => `- ${GENRES.find((x) => x.id === g)!.label}: ${GENRE_MEANING[g]}`).join("\n");
  return `A workout playlist must only contain tracks in these genres:
${genres}

Here are its tracks, numbered:
${tracks.map((t, i) => `${i + 1}. ${t.title} — ${t.artist}`).join("\n")}

Which tracks clearly don't belong to any of those genres? Judge each track by its artist's scene and the track's own sound, by the definitions above. Artists at the heart of a genre's scene count, including their crossover hits and tracks you don't recognise. Only list a track when you're sure it's from a different scene (for example US rap in a UK rap playlist, or dubstep or EDM in a drum & bass one). For each one give its number and its title exactly as written above, or an empty list.`;
}

export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    off: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer" }, title: { type: "string" } },
        required: ["n", "title"],
        additionalProperties: false,
      },
    },
  },
  required: ["off"],
  additionalProperties: false,
};
