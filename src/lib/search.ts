import { CATEGORIES, type CategoryId } from "@/data/categories";
import type { Routine } from "@/data/routines";

/** Lower case, punctuation removed, spaces squashed: "  Stretch & MOBILITY " → "stretch mobility". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Library search: matches routine names and category names, combined with one category filter. */
export function searchRoutines(routines: Routine[], query: string, filter: CategoryId | "all"): Routine[] {
  const q = normalize(query);
  return routines.filter((r) => {
    if (filter !== "all" && r.category !== filter) return false;
    if (!q) return true;
    return normalize(r.name).includes(q) || normalize(CATEGORIES[r.category].label).includes(q);
  });
}
