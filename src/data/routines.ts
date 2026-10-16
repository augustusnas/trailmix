// The routine library. Add or rename routines here; screens read from this list.

import { CATEGORIES, type Category, type CategoryId } from "./categories";

export type Routine = {
  /** Used in web addresses, e.g. /vibe?routine=boxing-bag-rounds */
  id: string;
  /** Full name shown on screens */
  name: string;
  /** Shorter name used in playlist titles */
  short: string;
  category: CategoryId;
  /** Typical session length in minutes */
  minutes: { min: number; max: number };
};

export const ROUTINES: Routine[] = [
  { id: "indoor-walk", name: "Indoor walk", short: "Indoor walk", category: "cardio", minutes: { min: 30, max: 60 } },
  { id: "incline-treadmill", name: "Incline treadmill", short: "Incline", category: "cardio", minutes: { min: 20, max: 40 } },
  { id: "spin-bike", name: "Spin / bike", short: "Spin", category: "cardio", minutes: { min: 30, max: 45 } },
  { id: "rowing-intervals", name: "Rowing intervals", short: "Rowing", category: "cardio", minutes: { min: 20, max: 30 } },
  { id: "boxing-bag-rounds", name: "Boxing bag rounds", short: "Boxing", category: "combat", minutes: { min: 30, max: 45 } },
  { id: "shadow-boxing", name: "Shadow boxing", short: "Shadow boxing", category: "combat", minutes: { min: 15, max: 30 } },
  { id: "emom", name: "EMOM", short: "EMOM", category: "conditioning", minutes: { min: 10, max: 30 } },
  { id: "amrap", name: "AMRAP", short: "AMRAP", category: "conditioning", minutes: { min: 12, max: 30 } },
  { id: "tabata", name: "Tabata", short: "Tabata", category: "conditioning", minutes: { min: 4, max: 20 } },
  { id: "hiit-circuit", name: "HIIT circuit", short: "HIIT", category: "conditioning", minutes: { min: 20, max: 30 } },
  { id: "free-weights-legs", name: "Free weights legs", short: "Legs", category: "strength", minutes: { min: 45, max: 60 } },
  { id: "push-day", name: "Push day", short: "Push day", category: "strength", minutes: { min: 45, max: 60 } },
  { id: "pull-day", name: "Pull day", short: "Pull day", category: "strength", minutes: { min: 45, max: 60 } },
  { id: "full-body", name: "Full body", short: "Full body", category: "strength", minutes: { min: 45, max: 60 } },
  { id: "kettlebell-flow", name: "Kettlebell flow", short: "Kettlebell", category: "strength", minutes: { min: 20, max: 40 } },
  { id: "stretch-mobility", name: "Stretch & mobility", short: "Mobility", category: "recovery", minutes: { min: 15, max: 30 } },
  { id: "yoga-flow", name: "Yoga flow", short: "Yoga", category: "recovery", minutes: { min: 20, max: 45 } },
];

/** The three routines pinned to Home on a fresh install: one from each of three categories. */
export const DEFAULT_PINS = ["push-day", "incline-treadmill", "hiit-circuit"];

/** How many routines Home can hold. */
export const MAX_PINS = 6;

export function getRoutine(id: string | undefined | null): Routine | undefined {
  return ROUTINES.find((r) => r.id === id);
}

export function categoryOf(routine: Routine): Category {
  return CATEGORIES[routine.category];
}

export function minutesLabel(routine: Routine): string {
  return `${routine.minutes.min}–${routine.minutes.max}`;
}
