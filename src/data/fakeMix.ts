// FAKE mix data for Milestone 1. Real generation arrives in Milestone 3.

import { ENERGIES, GENRES } from "./vibe";
import type { Routine } from "./routines";

export type Track = { title: string; artist: string };

export type Phase = {
  id: "warm-up" | "main" | "cool-down";
  label: string;
  note: string;
  tracks: Track[];
};

export type Mix = {
  name: string;
  routine: Routine;
  energy: string;
  genres: string[];
  length: number;
  runningMinutes: number;
  phases: Phase[];
};

/** A fun name per routine, so each fake mix looks different. */
const MIX_NAMES: Record<string, string> = {
  "indoor-walk": "Groove Miles",
  "incline-treadmill": "Uphill Both Ways",
  "spin-bike": "Wheels on Fire",
  "rowing-intervals": "Stroke of Genius",
  "boxing-bag-rounds": "Gloves On, Volume Up",
  "shadow-boxing": "Ghost in the Ring",
  emom: "Every Minute Counts",
  amrap: "As Many Bangers",
  tabata: "Twenty On, Ten Off",
  "hiit-circuit": "Red Zone Radio",
  "free-weights-legs": "Leg Day Lore",
  "push-day": "Press Play",
  "pull-day": "Pull Up to the Bumper",
  "full-body": "Head to Toe",
  "kettlebell-flow": "Swing Theory",
  "stretch-mobility": "Loose Ends",
  "yoga-flow": "Slow Burn Sunday",
};

const TRACKS: Track[] = [
  { title: "Can You Feel It", artist: "Mr. Fingers" },
  { title: "Rain", artist: "Kerri Chandler" },
  { title: "When a Fire Starts to Burn", artist: "Disclosure" },
  { title: "Gypsy Woman (She’s Homeless)", artist: "Crystal Waters" },
  { title: "Show Me Love", artist: "Robin S" },
  { title: "Music Sounds Better with You", artist: "Stardust" },
  { title: "Hypnotized", artist: "Purple Disco Machine" },
  { title: "(It Goes Like) Nanana", artist: "Peggy Gou" },
  { title: "Jungle", artist: "Fred again.." },
  { title: "Shades of Jae", artist: "Moodymann" },
  { title: "Glue", artist: "Bicep" },
];

export function fakeMix(routine: Routine, opts: { energy: string; genres: string[]; length: number }): Mix {
  return {
    name: MIX_NAMES[routine.id] ?? "Fresh Mix",
    routine,
    energy: opts.energy,
    genres: opts.genres,
    length: opts.length,
    runningMinutes: opts.length - 1,
    phases: [
      { id: "warm-up", label: "Warm-up", note: "easing in", tracks: TRACKS.slice(0, 2) },
      { id: "main", label: "Main block", note: "settle into the stride", tracks: TRACKS.slice(2, 9) },
      { id: "cool-down", label: "Cool-down", note: "bring it home", tracks: TRACKS.slice(9) },
    ],
  };
}

export function trackCount(mix: Mix): number {
  return mix.phases.reduce((n, p) => n + p.tracks.length, 0);
}

/** "15 Oct", in the phone's own time zone. */
export function shortDate(date: Date): string {
  return `${date.getDate()} ${date.toLocaleString("en-GB", { month: "short" })}`;
}

/** e.g. "Trailmix · Boxing · Gloves On, Volume Up · 15 Oct" */
export function playlistTitle(mix: Mix, date: Date): string {
  return `Trailmix · ${mix.routine.short} · ${mix.name} · ${shortDate(date)}`;
}

export function energyLabel(id: string): string {
  return ENERGIES.find((e) => e.id === id)?.label ?? id;
}

export function genreLabel(id: string): string {
  return GENRES.find((g) => g.id === id)?.label ?? id;
}
