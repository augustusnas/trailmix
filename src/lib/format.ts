import { getRoutine } from "@/data/routines";
import { ENERGIES, GENRES, currentGenre } from "@/data/vibe";

/** "15 Oct", in the phone's own time zone. */
export function shortDate(date: Date): string {
  return `${date.getDate()} ${date.toLocaleString("en-GB", { month: "short" })}`;
}

/** e.g. "Trailmix · Boxing · Gloves On, Volume Up · 15 Oct" (F21). */
export function playlistTitle(mix: { name: string; routineId: string }, date: Date): string {
  return `Trailmix · ${getRoutine(mix.routineId)?.short ?? "Mix"} · ${mix.name} · ${shortDate(date)}`;
}

export function energyLabel(id: string): string {
  return ENERGIES.find((e) => e.id === id)?.label ?? id;
}

export function genreLabel(id: string): string {
  const now = currentGenre(id) ?? id;
  return GENRES.find((g) => g.id === now)?.label ?? id;
}
