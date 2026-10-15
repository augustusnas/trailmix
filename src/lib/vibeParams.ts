// The chosen routine and vibe travel in the web address, so a refresh keeps them.

import { getRoutine, type Routine } from "@/data/routines";
import { DEFAULT_ENERGY, DEFAULT_GENRES, ENERGIES, GENRES, LENGTHS, defaultLength } from "@/data/vibe";

export type SearchParams = Record<string, string | string[] | undefined>;

export type Vibe = { routine: Routine; energy: string; genres: string[]; length: number };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Reads ?routine=…&energy=…&genres=…&length=…; returns undefined if the routine is missing or unknown. */
export function parseVibe(params: SearchParams): Vibe | undefined {
  const routine = getRoutine(first(params.routine));
  if (!routine) return undefined;

  const energyParam = first(params.energy);
  const energy = ENERGIES.some((e) => e.id === energyParam) ? energyParam! : DEFAULT_ENERGY;

  const genreParam = first(params.genres);
  const genres =
    genreParam === undefined
      ? DEFAULT_GENRES
      : genreParam.split(",").filter((g) => GENRES.some((x) => x.id === g));

  const lengthParam = Number(first(params.length));
  const length = (LENGTHS as readonly number[]).includes(lengthParam) ? lengthParam : defaultLength(routine.minutes);

  return { routine, energy, genres, length };
}

export function vibeQuery(v: Vibe): string {
  const q = new URLSearchParams({
    routine: v.routine.id,
    energy: v.energy,
    genres: v.genres.join(","),
    length: String(v.length),
  });
  return q.toString();
}
