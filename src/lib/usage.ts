"use client";
// Tells the server about things only the phone sees, for the anonymous stats (Milestone 5, C1).
// Fire and forget: nothing waits for it, and a failure is ignored.

import type { CheckinAnswer } from "./store";

type UsageEvent =
  | { event: "kept"; freshness: number; remixes: number }
  | { event: "shared" }
  | { event: "checkin"; answer: CheckinAnswer; favourite: boolean };

export function report(e: UsageEvent): void {
  try {
    void fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e), credentials: "same-origin", keepalive: true }).catch(() => undefined);
  } catch {
    // never let counting break the app
  }
}
