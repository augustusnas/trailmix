import type { Phase } from "@/data/fakeMix";

/** Colour of each phase label. */
export const PHASE_STYLE: Record<Phase["id"], { bg: string; fg: string }> = {
  "warm-up": { bg: "var(--lilac)", fg: "var(--ink)" },
  main: { bg: "var(--ink)", fg: "var(--lime)" },
  "cool-down": { bg: "var(--forest)", fg: "var(--sand)" },
};
