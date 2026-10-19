import type { PhaseId } from "@/lib/mixTypes";

/** Colour of each phase label. */
export const PHASE_STYLE: Record<PhaseId, { bg: string; fg: string }> = {
  "warm-up": { bg: "var(--lilac)", fg: "var(--ink)" },
  main: { bg: "var(--ink)", fg: "var(--lime)" },
  "cool-down": { bg: "var(--forest)", fg: "var(--sand)" },
};
