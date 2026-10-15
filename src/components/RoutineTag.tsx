import { CATEGORIES } from "@/data/categories";
import type { Routine } from "@/data/routines";

/** The chosen routine's name in its category colour. Recovery (Forest) gets an outline so it shows on dark screens. */
export function RoutineTag({ routine, extra }: { routine: Routine; extra?: string }) {
  const cat = CATEGORIES[routine.category];
  return (
    <span
      className="routine-tag mono"
      data-testid="routine-tag"
      data-category={cat.id}
      style={{
        background: cat.bg,
        color: cat.fg,
        boxShadow: cat.id === "recovery" ? "inset 0 0 0 2px var(--sand)" : undefined,
      }}
    >
      {routine.name}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}
