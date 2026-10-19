"use client";

import { useEffect, useState } from "react";
import { TEST_SWITCH_KEY } from "@/lib/access";

// Beta test switches: force a failure on this phone, for this visit only (closing the app clears it).
// The server only honours them while SHOW_RESET_PAGE is true.
const SWITCHES = [
  { id: "", label: "Everything normal" },
  { id: "e1", label: "E1 · Tracks can't be found (mix comes out shorter)" },
  { id: "e2", label: "E2 · Track catalogue (Deezer) is down" },
  { id: "mostfail", label: "F10 · Two in three tracks fail the check (should still fill the length)" },
  { id: "short", label: "F10 · Replacements all fail (mix comes out short)" },
  { id: "slowswap", label: "Swap takes too long (15-second limit)" },
  { id: "e3", label: "E3 · The mix doesn't come together" },
  { id: "e4", label: "E4 · Mix-making is resting (Claude down)" },
  { id: "e5", label: "E5 · YouTube's daily limit used up (Keep it)" },
  { id: "e9", label: "E9 · Hourly limit reached" },
  { id: "e10", label: "E10 · Pretend to be offline" },
  { id: "e14", label: "E14 · Daily ceiling reached" },
  { id: "e15", label: "E15 · Mix-making paused" },
];

export function TestSwitches() {
  const [current, setCurrent] = useState("");
  useEffect(() => {
    try {
      setCurrent(sessionStorage.getItem(TEST_SWITCH_KEY) ?? "");
    } catch {
      // no session storage
    }
  }, []);

  const choose = (id: string) => {
    try {
      if (id) sessionStorage.setItem(TEST_SWITCH_KEY, id);
      else sessionStorage.removeItem(TEST_SWITCH_KEY);
      setCurrent(id);
    } catch {
      // no session storage
    }
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <legend className="mono" style={{ color: "var(--lime)", marginBottom: 8 }}>
        Test switches (this visit only)
      </legend>
      {SWITCHES.map((s) => (
        <button
          key={s.id || "off"}
          type="button"
          className="chip"
          aria-pressed={current === s.id}
          onClick={() => choose(s.id)}
          style={{
            textAlign: "left",
            borderRadius: 16,
            ...(current === s.id ? { background: "var(--lime)", borderColor: "var(--lime)", color: "var(--ink)" } : {}),
          }}
        >
          {s.label}
        </button>
      ))}
    </fieldset>
  );
}
