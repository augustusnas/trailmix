// THE MIX PROMPT. Everything Claude is told lives here, so it can be improved in one place.
// Only checked values reach it (see validate.ts): routine and genre names come from our own lists.

import { CATEGORIES } from "@/data/categories";
import { ENERGIES, GENRES } from "@/data/vibe";
import type { PhaseId } from "@/lib/mixTypes";
import type { MixRequest, TrackRef } from "./validate";

/** Average track length used only to decide how many tracks to ask for (real lengths come from iTunes). */
const AVERAGE_TRACK_MIN = 3.7;
/** Ask for about 20% more than the length needs, so there's spare for fitting and missing tracks. */
const SPARE = 1.2;

export function trackPlan(lengthMin: number): Record<PhaseId, number> {
  const total = Math.round((lengthMin / AVERAGE_TRACK_MIN) * SPARE);
  const warm = Math.max(2, Math.round(total * 0.15));
  const cool = Math.max(2, Math.round(total * 0.12));
  return { "warm-up": warm, main: Math.max(4, total - warm - cool), "cool-down": cool };
}

const ENERGY_FEEL: Record<string, string> = {
  easy: "relaxed and unhurried; comfortable, conversational intensity",
  steady: "a consistent, confident groove that keeps you moving",
  driven: "determined and pushing; strong drums and momentum",
  feral: "all-out, high-intensity, as hard as the genres allow",
};

export const SYSTEM_PROMPT = `You are Trailmix's music curator. You build workout playlists from real, released recordings.

Rules for every playlist:
- Only real, officially released tracks that can be found on Apple Music, Spotify and YouTube Music. Use each track's usual title and main artist name, with no extra words, version notes or emoji.
- Match the requested genres and energy.
- Shape an energy arc: the warm-up eases in, the main block keeps building so it never sags midway, and the cool-down brings it home.
- Never put the same artist twice in a row.
- Freshness: at least 70% of tracks must not be on the "recently played" list, and include a couple of deeper cuts alongside the well-known ones.
- The playlist name is fun and short (2 to 5 words), fits the workout and mood, and isn't a song title.`;

const listOrNone = (tracks: TrackRef[]) =>
  tracks.length ? tracks.map((t) => `- ${t.title} — ${t.artist}`).join("\n") : "(none)";

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
  const plan = trackPlan(req.length);
  return `${describe(req)}

Make a playlist with ${plan["warm-up"]} warm-up tracks, ${plan.main} main-block tracks and ${plan["cool-down"]} cool-down tracks, in playing order.

Recently played (keep at least 70% of the new playlist off this list):
${listOrNone(req.avoid)}

Don't use any of these at all:
${listOrNone(exclude)}${avoidName ? `

This is a remix: give it a new name, not "${avoidName}".` : ""}`;
}

export function morePrompt(req: MixRequest, phase: PhaseId, count: number, exclude: TrackRef[], note = ""): string {
  const phaseText = { "warm-up": "warm-up", main: "main block", "cool-down": "cool-down" }[phase];
  return `${describe(req)}

Suggest ${count} more ${phaseText} track${count === 1 ? "" : "s"} for this playlist${note ? ` (${note})` : ""}. Set each track's phase to "${phase}".

Already in the playlist or ruled out (don't repeat any):
${listOrNone(exclude)}

Recently played (prefer tracks not on this list):
${listOrNone(req.avoid)}`;
}

const TRACK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    artist: { type: "string" },
    phase: { type: "string", enum: ["warm-up", "main", "cool-down"] },
  },
  required: ["title", "artist", "phase"],
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
