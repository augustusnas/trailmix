"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { appOrDefault } from "@/data/apps";
import { fakeMix } from "@/data/fakeMix";
import { useSaved } from "./store";
import { routineFromParams, routineHref } from "./vibeParams";

/**
 * The mix for The mix and Saved: routine from ?routine=…, vibe from this phone.
 * No routine → Home. No saved vibe for it yet → Set the vibe first.
 */
export function useCurrentMix() {
  const router = useRouter();
  const routine = routineFromParams(useSearchParams());
  const saved = useSaved();
  const vibe = routine && saved ? saved.vibes[routine.id] : undefined;

  useEffect(() => {
    if (!routine) router.replace("/home");
    else if (saved && !vibe) router.replace(routineHref("/vibe", routine.id));
  }, [routine, saved, vibe, router]);

  if (!routine || !saved || !vibe) return null;
  return { routine, mix: fakeMix(routine, vibe), app: appOrDefault(saved.musicApp) };
}
