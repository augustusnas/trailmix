// The three stages shown while a mix is made. The server reports each one as the real work reaches it.

export const PROGRESS_HEADER = "x-trailmix-progress";

export type StageId = "picking" | "energy" | "fitting";

export const STAGES: { id: StageId; text: (minutes: number) => string }[] = [
  { id: "picking", text: () => "Picking tracks for your vibe" },
  { id: "energy", text: () => "Lining up the energy" },
  { id: "fitting", text: (m) => `Fitting it to ${m} minutes` },
];

export const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);

/** What the loading screen knows so far (from the server's progress lines). */
export type Progress = { stage: StageId; found?: number; tracks?: number; ms?: number };

/** One progress line from the server, checked; null if it isn't one. */
export function readProgress(line: Record<string, unknown>): Progress | null {
  if (!isStage(line.stage)) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  return { stage: line.stage, found: n(line.found), tracks: n(line.tracks), ms: n(line.ms) };
}
