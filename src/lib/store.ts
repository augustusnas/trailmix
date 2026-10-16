// Everything Trailmix remembers, kept on this phone only (localStorage). Never sent to the server.
// Screens use the functions and the useSaved() hook below; nothing else touches localStorage.

import { useSyncExternalStore } from "react";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import { DEFAULT_PINS, MAX_PINS, ROUTINES } from "@/data/routines";
import { DEFAULT_ENERGY, ENERGIES, GENRES, LENGTHS, MAX_GENRES, defaultLength } from "@/data/vibe";

export const STORAGE_KEY = "trailmix";
export const STORAGE_VERSION = 1;
export const MAX_RECENT_MIXES = 10;

export type MusicAppId = MusicApp["id"];
export type VibeSettings = { genres: string[]; energy: string; length: number };
/** Filled from Milestone 3. */
export type RecentMix = Record<string, unknown>;

export type Saved = {
  version: typeof STORAGE_VERSION;
  /** Finished Welcome → Where do you listen. See lib/gate.ts. */
  onboarded: boolean;
  musicApp: MusicAppId | null;
  /** Routine ids, in Home order. */
  pins: string[];
  /** Per routine id: the last settings used on Set the vibe. */
  vibes: Record<string, VibeSettings>;
  recentMixes: RecentMix[];
};

export function defaults(onboarded = false): Saved {
  return { version: STORAGE_VERSION, onboarded, musicApp: null, pins: [...DEFAULT_PINS], vibes: {}, recentMixes: [] };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const routineIds = new Set(ROUTINES.map((r) => r.id));
const genreIds = new Set(GENRES.map((g) => g.id));
const energyIds = new Set(ENERGIES.map((e) => e.id));

function cleanVibe(routineId: string, v: unknown): VibeSettings | undefined {
  if (!isObject(v)) return undefined;
  const routine = ROUTINES.find((r) => r.id === routineId)!;
  const genres = Array.isArray(v.genres)
    ? [...new Set(v.genres.filter((g): g is string => typeof g === "string" && genreIds.has(g)))].slice(0, MAX_GENRES)
    : [];
  const energy = typeof v.energy === "string" && energyIds.has(v.energy) ? v.energy : DEFAULT_ENERGY;
  const length = (LENGTHS as readonly unknown[]).includes(v.length) ? (v.length as number) : defaultLength(routine.minutes);
  return { genres, energy, length };
}

/**
 * E12: turn whatever was stored into a valid record. Missing, unreadable, wrong-version or
 * wrong-shape data resets to the defaults (keeping onboarded if it was true). Unknown ids are dropped.
 */
export function sanitize(raw: unknown): Saved {
  if (!isObject(raw)) return defaults();
  const onboarded = raw.onboarded === true;
  if (raw.version !== STORAGE_VERSION) return defaults(onboarded);

  const out = defaults(onboarded);
  if (typeof raw.musicApp === "string" && MUSIC_APPS.some((a) => a.id === raw.musicApp)) {
    out.musicApp = raw.musicApp as MusicAppId;
  }
  if (Array.isArray(raw.pins)) {
    out.pins = [...new Set(raw.pins.filter((id): id is string => typeof id === "string" && routineIds.has(id)))].slice(
      0,
      MAX_PINS,
    );
  }
  if (isObject(raw.vibes)) {
    for (const [id, v] of Object.entries(raw.vibes)) {
      if (!routineIds.has(id)) continue;
      const clean = cleanVibe(id, v);
      if (clean) out.vibes[id] = clean;
    }
  }
  if (Array.isArray(raw.recentMixes)) {
    out.recentMixes = raw.recentMixes.filter(isObject).slice(0, MAX_RECENT_MIXES);
  }
  return out;
}

// ---------- reading and writing, never throwing ----------

// The phone's storage is the truth. `current` is just the parsed copy of `lastText`, the exact
// text last read from or written to storage; whenever storage holds something else, it's re-read.
// So a change made outside the app (or damage) is always noticed, and every change is built on
// what's actually stored, never on an old in-memory copy written back over it.
let current: Saved | null = null;
let lastText: string | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // e.g. storage blocked
  }
}

/** Unreadable data can still say it finished first run; E12 keeps that so Welcome isn't shown again. */
export const ONBOARDED_MARK = /"onboarded"\s*:\s*true/;

export function parseStored(text: string | null | undefined): Saved {
  if (!text) return defaults();
  try {
    return sanitize(JSON.parse(text));
  } catch {
    return defaults(ONBOARDED_MARK.test(text));
  }
}

/** The stored text, or undefined if the phone won't let us read storage at all. */
function readText(): string | null | undefined {
  try {
    const s = storage();
    return s ? s.getItem(STORAGE_KEY) : undefined;
  } catch {
    return undefined;
  }
}

export function load(): Saved {
  const text = readText();
  // Storage unusable (e.g. private browsing): this visit's in-memory copy is all there is.
  if (text === undefined) return (current ??= defaults());
  if (!current || text !== lastText) {
    current = parseStored(text);
    lastText = text;
  }
  return current;
}

/** Saves a new record. If the phone refuses (private browsing, full storage), it still works for this visit. */
export function save(next: Saved): void {
  current = sanitize(next);
  const text = JSON.stringify(current);
  try {
    const s = storage();
    if (s) {
      s.setItem(STORAGE_KEY, text);
      lastText = text;
    }
  } catch {
    // keep the in-memory copy for this visit
  }
  listeners.forEach((l) => l());
}

/** Every change starts from a fresh read of storage (cleaned up if damaged), never a stale copy. */
export function update(change: (s: Saved) => Saved): void {
  save(change(load()));
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener(); // load() re-reads the changed text
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** For tests and the beta reset page. */
export function reset(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // nothing to remove
  }
  current = defaults();
  lastText = null;
  listeners.forEach((l) => l());
}

/** The saved record, or null while the page is still being drawn on the server. */
export function useSaved(): Saved | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

// ---------- actions ----------

export function pin(id: string): void {
  update((s) => (s.pins.includes(id) || s.pins.length >= MAX_PINS ? s : { ...s, pins: [...s.pins, id] }));
}

/** Unpinning keeps the routine's saved vibe. */
export function unpin(id: string): void {
  update((s) => ({ ...s, pins: s.pins.filter((p) => p !== id) }));
}

export function setMusicApp(app: MusicAppId): void {
  update((s) => ({ ...s, musicApp: app }));
}

export function saveVibe(routineId: string, vibe: VibeSettings): void {
  update((s) => ({ ...s, vibes: { ...s.vibes, [routineId]: vibe } }));
}

export function completeOnboarding(app: MusicAppId): void {
  update((s) => ({ ...s, onboarded: true, musicApp: app }));
}

/** The settings Set the vibe starts with for a routine: last used, or the first-time defaults. */
export function vibeFor(s: Saved, routineId: string): VibeSettings {
  const saved = s.vibes[routineId];
  if (saved) return saved;
  const routine = ROUTINES.find((r) => r.id === routineId)!;
  return { genres: [], energy: DEFAULT_ENERGY, length: defaultLength(routine.minutes) };
}
