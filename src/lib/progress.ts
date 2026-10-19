// The three stages shown while a mix is made. The server reports each one as the real work reaches it.

export const PROGRESS_HEADER = "x-trailmix-progress";

export type StageId = "picking" | "energy" | "fitting";

export const STAGES: { id: StageId; text: (minutes: number) => string }[] = [
  { id: "picking", text: () => "Picking tracks for your vibe" },
  { id: "energy", text: () => "Lining up the energy" },
  { id: "fitting", text: (m) => `Fitting it to ${m} minutes` },
];

export const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);
