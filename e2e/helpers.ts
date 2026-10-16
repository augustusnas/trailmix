import type { Page } from "@playwright/test";
import { DEFAULT_PINS } from "../src/data/routines";

export const STORAGE_KEY = "trailmix";

type State = {
  onboarded?: boolean;
  musicApp?: "ytm" | "spotify" | "apple" | null;
  pins?: string[];
  vibes?: Record<string, { genres: string[]; energy: string; length: number }>;
};

/** A phone that has finished first run, with the default pins and YouTube Music. */
export const ONBOARDED: State = { onboarded: true, musicApp: "ytm", pins: DEFAULT_PINS, vibes: {} };

export const BOXING_VIBE = { "boxing-bag-rounds": { genres: ["grime", "dnb"], energy: "driven", length: 45 } };

export function record(state: State) {
  return JSON.stringify({ version: 1, onboarded: false, musicApp: null, pins: DEFAULT_PINS, vibes: {}, recentMixes: [], ...state });
}

/**
 * Puts saved data on the "phone" before the first page loads (once per test, so the
 * app's own changes then persist across navigations and reloads like on a real phone).
 */
export async function seed(page: Page, state: State | string) {
  const text = typeof state === "string" ? state : record(state);
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (location.protocol.startsWith("http") && !sessionStorage.getItem("__seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("__seeded", "1");
        }
      } catch {
        // storage unavailable in this frame
      }
    },
    [STORAGE_KEY, text] as const,
  );
}

export async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORAGE_KEY);
}
