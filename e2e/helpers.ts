import type { Page } from "@playwright/test";
import { DEFAULT_PINS } from "../src/data/routines";

export const STORAGE_KEY = "trailmix";

type State = {
  onboarded?: boolean;
  musicApp?: "ytm" | "spotify" | "apple" | null;
  pins?: string[];
  vibes?: Record<string, { genres: string[]; energy: string; length: number }>;
  accessCode?: string | null;
  currentMix?: unknown;
  recentMixes?: unknown[];
};

/** The beta access code the test servers are started with. */
export const TEST_ACCESS_CODE = "test-trail-code";

/** A phone that has finished first run, with the default pins and YouTube Music. */
export const ONBOARDED: State = { onboarded: true, musicApp: "ytm", pins: DEFAULT_PINS, vibes: {}, accessCode: TEST_ACCESS_CODE };

export const BOXING_VIBE = { "boxing-bag-rounds": { genres: ["uk-rap", "dnb"], energy: "driven", length: 45 } };

export function record(state: State) {
  return JSON.stringify({
    version: 2,
    onboarded: false,
    musicApp: null,
    pins: DEFAULT_PINS,
    vibes: {},
    recentMixes: [],
    accessCode: null,
    currentMix: null,
    ...state,
  });
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

/** Notes (in sessionStorage) if Welcome or Where do you listen is ever drawn visibly. */
export async function watchForWelcome(page: Page) {
  await page.addInitScript(() => {
    const check = () => {
      const visible = document.documentElement.style.visibility !== "hidden";
      const text = document.body?.innerText ?? "";
      if (visible && (text.includes("Pick the terrain") || text.includes("Where do you listen?"))) {
        sessionStorage.setItem("__sawWelcome", "1");
      }
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true });
    const tick = () => {
      check();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function sawWelcome(page: Page) {
  return (await page.evaluate(() => sessionStorage.getItem("__sawWelcome"))) !== null;
}

/** Welcome → Lace up → enter the beta access code → Where do you listen. */
export async function laceUp(page: Page) {
  await page.getByRole("button", { name: "Lace up" }).click();
  const form = page.getByTestId("access-form");
  if (await form.isVisible().catch(() => false)) {
    await page.getByLabel("Beta access code").fill(TEST_ACCESS_CODE);
    await page.getByRole("button", { name: "Let me in" }).click();
  }
  await page.waitForURL(/\/listen$/);
}

const ACCESS = { "x-trailmix-access": TEST_ACCESS_CODE };

/** Makes a real mix (with the recorded stand-in services), finds its Apple Music links, and stores it as a shared mix page. */
export async function makeSharedMix(
  request: import("@playwright/test").APIRequestContext,
  settings = { routine: "boxing-bag-rounds", genres: ["uk-rap", "dnb"], energy: "driven", length: 45 },
): Promise<{ id: string; mix: { name: string; tracks: { title: string; artist: string; appleUrl?: string }[] } }> {
  const made = await (await request.post("/api/mix", { headers: ACCESS, data: { ...settings, avoid: [] } })).json();
  let mix = made.mix;
  for (let round = 0; mix.tracks.some((t: { linksPending?: boolean }) => t.linksPending) && round < 5; round++) {
    const pending = mix.tracks.filter((t: { linksPending?: boolean }) => t.linksPending);
    const links = await (await request.post("/api/links", { headers: ACCESS, data: { tracks: pending } })).json();
    mix = {
      ...mix,
      tracks: mix.tracks.map((t: { title: string; artist: string }) => {
        const r = links.results.find((x: { title: string; artist: string }) => x.title === t.title && x.artist === t.artist);
        return r ? { ...t, appleUrl: r.appleUrl, linksPending: undefined } : t;
      }),
    };
  }
  const { id } = await (await request.post("/api/share", { headers: ACCESS, data: { mix } })).json();
  return { id, mix };
}

/** Waits until The mix is on screen and the main button can be tapped. */
export async function waitForMix(page: Page) {
  const action = page.getByTestId("mix-action");
  await action.waitFor();
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="mix-action"]') as HTMLButtonElement | null;
    return b && !b.disabled;
  }, undefined, { timeout: 20_000 });
}
