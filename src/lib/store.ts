// Everything Trailmix remembers, kept on this phone only (localStorage). Never sent to the server.
// Screens use the functions and the useSaved() hook below; nothing else touches localStorage.

import { useSyncExternalStore } from "react";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import { DEFAULT_PINS, MAX_PINS, ROUTINES } from "@/data/routines";
import { DEFAULT_ENERGY, ENERGIES, LENGTHS, currentGenres, defaultLength } from "@/data/vibe";
import { sanitizeMix, type Mix } from "./mixTypes";

export const STORAGE_KEY = "trailmix";
/** 2: Milestone 3 added the access code, the current mix and recent mixes. Version 1 is carried over. */
export const STORAGE_VERSION = 2;
export const MAX_RECENT_MIXES = 10;
/** Artists are remembered from this many mixes per routine, so a Remix can steer away from them. */
export const ARTIST_MEMORY_MIXES = 5;

export type MusicAppId = MusicApp["id"];
export type VibeSettings = { genres: string[]; energy: string; length: number };
/** F17's three answers. */
export const CHECKIN_ANSWERS = [
  { id: "carried", label: "Carried me" },
  { id: "dipped", label: "Dipped midway" },
  { id: "didntLand", label: "Didn't land" },
] as const;
export type CheckinAnswer = (typeof CHECKIN_ANSWERS)[number]["id"];
/** F17: how a kept mix did, or that the card was dismissed. Kept for F19 (after launch). */
export type Checkin = { answer?: CheckinAnswer; favourite?: boolean; dismissed?: boolean; at: string };

/** A mix you kept or opened: enough to avoid repeats, and to ask how it did (F17). */
export type RecentMix = {
  name: string;
  routineId: string;
  date: string;
  tracks: { title: string; artist: string }[];
  /** Share of tracks not in the previous 10 mixes, 0–100. */
  freshness: number;
  /** The mix's id, and when it was kept (Milestone 5; older entries have neither and are never asked about). */
  id?: string;
  keptAt?: string;
  checkin?: Checkin;
};

/** The check-in card shows this long after a mix is kept. */
export const CHECKIN_AFTER_MS = 60 * 60_000;

export type Saved = {
  version: typeof STORAGE_VERSION;
  /** Finished Welcome → Where do you listen. See lib/gate.ts. */
  onboarded: boolean;
  musicApp: MusicAppId | null;
  /** Routine ids, in Home order. */
  pins: string[];
  /** Per routine id: the last settings used on Set the vibe. */
  vibes: Record<string, VibeSettings>;
  /** Newest first, at most 10. */
  recentMixes: RecentMix[];
  /** The mix on The mix and Saved right now, so a refresh never pays for a new one. */
  currentMix: Mix | null;
  /** Per routine id: the artists in each of the last 5 mixes made (kept or not), newest first. */
  recentArtists: Record<string, string[][]>;
};

export function defaults(onboarded = false): Saved {
  return {
    version: STORAGE_VERSION,
    onboarded,
    musicApp: null,
    pins: [...DEFAULT_PINS],
    vibes: {},
    recentMixes: [],
    currentMix: null,
    recentArtists: {},
  };
}

function cleanRecent(v: unknown): RecentMix | undefined {
  if (!isObject(v) || !Array.isArray(v.tracks)) return undefined;
  if (typeof v.name !== "string" || typeof v.routineId !== "string" || typeof v.date !== "string") return undefined;
  const tracks = v.tracks
    .filter((t): t is { title: string; artist: string } => isObject(t) && typeof t.title === "string" && typeof t.artist === "string")
    .slice(0, 40)
    .map((t) => ({ title: t.title.slice(0, 120), artist: t.artist.slice(0, 120) }));
  const freshness = typeof v.freshness === "number" && v.freshness >= 0 && v.freshness <= 100 ? v.freshness : 100;
  const out: RecentMix = { name: v.name.slice(0, 80), routineId: v.routineId, date: v.date.slice(0, 40), tracks, freshness };
  if (typeof v.id === "string") out.id = v.id.slice(0, 64);
  if (typeof v.keptAt === "string" && !Number.isNaN(Date.parse(v.keptAt))) out.keptAt = v.keptAt.slice(0, 40);
  const c = v.checkin;
  if (isObject(c) && typeof c.at === "string") {
    const answer = CHECKIN_ANSWERS.find((a) => a.id === c.answer)?.id;
    if (answer || c.dismissed === true) out.checkin = { ...(answer ? { answer } : {}), ...(c.favourite === true ? { favourite: true } : {}), ...(c.dismissed === true ? { dismissed: true } : {}), at: c.at.slice(0, 40) };
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const routineIds = new Set(ROUTINES.map((r) => r.id));
const energyIds = new Set(ENERGIES.map((e) => e.id));

function cleanVibe(routineId: string, v: unknown): VibeSettings | undefined {
  if (!isObject(v)) return undefined;
  const routine = ROUTINES.find((r) => r.id === routineId)!;
  // Genres saved before the new list map to their closest new one (Grime and UK rap → Hip-hop & UK rap, House → Dance & electronic).
  const genres = Array.isArray(v.genres) ? currentGenres(v.genres) : [];
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
  // Version 1 (Milestone 2) is carried over: same fields, the new ones start empty.
  if (raw.version !== STORAGE_VERSION && raw.version !== 1) return defaults(onboarded);

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
    out.recentMixes = raw.recentMixes
      .map(cleanRecent)
      .filter((m): m is RecentMix => Boolean(m))
      .slice(0, MAX_RECENT_MIXES);
  }
  // Milestone 3's beta access code (raw.accessCode) is dropped: Google sign-in replaced it.
  out.currentMix = sanitizeMix(raw.currentMix);
  if (isObject(raw.recentArtists)) {
    for (const [id, mixes] of Object.entries(raw.recentArtists)) {
      if (!routineIds.has(id) || !Array.isArray(mixes)) continue;
      const clean = mixes
        .filter(Array.isArray)
        .slice(0, ARTIST_MEMORY_MIXES)
        .map((names: unknown[]) => names.filter((n): n is string => typeof n === "string").slice(0, 40).map((n) => n.slice(0, 120)));
      if (clean.length) out.recentArtists[id] = clean;
    }
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

/** E13: back to Welcome (keeping pins, vibes and mixes) when the account isn't on the guest list. */
export function setOnboarded(onboarded: boolean): void {
  update((s) => ({ ...s, onboarded }));
}

export function setCurrentMix(mix: Mix | null): void {
  update((s) => ({ ...s, currentMix: mix }));
}

/** Remembers a newly made mix's artists for its routine (the last 5 mixes). */
export function rememberArtists(mix: Mix): void {
  update((s) => {
    const artists = [...new Set(mix.tracks.map((t) => t.artist))];
    const before = s.recentArtists[mix.routineId] ?? [];
    return { ...s, recentArtists: { ...s.recentArtists, [mix.routineId]: [artists, ...before].slice(0, ARTIST_MEMORY_MIXES) } };
  });
}

/** Artists from the last 5 mixes for a routine, each once. */
export function artistsToAvoid(s: Saved, routineId: string): string[] {
  const seen = new Set<string>();
  return (s.recentArtists[routineId] ?? []).flat().filter((a) => {
    const k = a.toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

/** Adds a kept or opened mix to the last 10 (newest first; the same mix isn't added twice). */
export function addRecentMix(mix: Mix): void {
  update((s) => {
    const same = (m: RecentMix) => (m.id ? m.id === mix.id : m.name === mix.name && m.date === mix.createdAt);
    const before = s.recentMixes.find(same);
    const entry: RecentMix = {
      name: mix.name,
      routineId: mix.routineId,
      date: mix.createdAt,
      tracks: mix.tracks.map((t) => ({ title: t.title, artist: t.artist })),
      freshness: mix.freshness ?? 100,
      id: mix.id,
      keptAt: before?.keptAt ?? new Date().toISOString(),
      ...(before?.checkin ? { checkin: before.checkin } : {}),
    };
    return { ...s, recentMixes: [entry, ...s.recentMixes.filter((m) => !same(m))].slice(0, MAX_RECENT_MIXES) };
  });
}

/**
 * F17: the mix to ask about, if any. Only the most recent kept mix, at least an hour after it was
 * kept (`now` can skip the wait: the "check-in due now" test switch), and never once answered or dismissed.
 */
export function dueCheckin(s: Saved, now = Date.now()): RecentMix | null {
  const m = s.recentMixes[0];
  if (!m?.id || !m.keptAt || m.checkin) return null;
  return now - Date.parse(m.keptAt) >= CHECKIN_AFTER_MS ? m : null;
}

/** Stores the answer (or a dismissal) with that mix. */
export function recordCheckin(mixId: string, checkin: Omit<Checkin, "at">): void {
  update((s) => ({
    ...s,
    recentMixes: s.recentMixes.map((m) => (m.id === mixId ? { ...m, checkin: { ...checkin, at: new Date().toISOString() } } : m)),
  }));
}
