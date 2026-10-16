// Only the routine travels in the web address (?routine=…), so a refresh keeps it.
// Vibe settings and the music app stay on the phone (lib/store.ts) and never reach the server.

import { getRoutine, type Routine } from "@/data/routines";

export function routineFromParams(params: { get(name: string): string | null }): Routine | undefined {
  return getRoutine(params.get("routine"));
}

export function routineHref(path: "/vibe" | "/mix" | "/saved", routineId: string): string {
  return `${path}?routine=${encodeURIComponent(routineId)}`;
}
