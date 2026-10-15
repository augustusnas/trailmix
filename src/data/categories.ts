// The five routine categories. Each has exactly one colour, used everywhere.

export const COLORS = {
  ink: "#16130F",
  sand: "#EADFC8",
  lime: "#C8E03A",
  orange: "#E8571E",
  lilac: "#A99BF5",
  forest: "#1F3D2B",
} as const;

export type CategoryId = "cardio" | "combat" | "conditioning" | "strength" | "recovery";

export type Category = {
  id: CategoryId;
  label: string;
  /** Tile / band colour */
  bg: string;
  /** Text colour that reads well on bg */
  fg: string;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  cardio: { id: "cardio", label: "Cardio", bg: COLORS.lime, fg: COLORS.ink },
  combat: { id: "combat", label: "Combat", bg: COLORS.orange, fg: COLORS.ink },
  conditioning: { id: "conditioning", label: "Conditioning", bg: COLORS.lilac, fg: COLORS.ink },
  strength: { id: "strength", label: "Strength", bg: COLORS.sand, fg: COLORS.ink },
  recovery: { id: "recovery", label: "Recovery", bg: COLORS.forest, fg: COLORS.sand },
};

/** Display order in the Library and its filters. */
export const CATEGORY_ORDER: CategoryId[] = ["cardio", "combat", "conditioning", "strength", "recovery"];
