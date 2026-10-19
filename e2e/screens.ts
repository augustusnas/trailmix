import type { Page } from "@playwright/test";
import { BOXING_VIBE, ONBOARDED, record, seed } from "./helpers";

export type Screen = {
  name: string;
  path: string;
  /** Saved data on the phone before the page opens. */
  state?: string;
  /** Extra taps to reach the state worth checking. */
  setup?: (page: Page) => Promise<void>;
};

const SIX_PINS = ["push-day", "incline-treadmill", "hiit-circuit", "tabata", "yoga-flow", "boxing-bag-rounds"];
const onboarded = (extra: object = {}) => record({ ...ONBOARDED, vibes: BOXING_VIBE, ...extra });

// Every screen and every Milestone 2 state, for screenshots, labels, accessibility and security checks.
export const SCREENS: Screen[] = [
  { name: "welcome", path: "/" },
  {
    name: "welcome-code",
    path: "/",
    setup: async (page) => {
      // Just the form: wrong guesses are limited per computer, so screenshots don't make any.
      await page.getByRole("button", { name: "Lace up" }).click();
      await page.getByLabel("Beta access code").waitFor();
    },
  },
  { name: "listen", path: "/listen" },
  { name: "home", path: "/home", state: onboarded() },
  { name: "home-full", path: "/home", state: onboarded({ pins: SIX_PINS }) },
  { name: "home-empty", path: "/home", state: onboarded({ pins: [] }) },
  { name: "library", path: "/library", state: onboarded() },
  { name: "library-full", path: "/library", state: onboarded({ pins: SIX_PINS }) },
  {
    name: "library-no-match",
    path: "/library",
    state: onboarded(),
    setup: async (page) => {
      await page.getByLabel("Find a routine").fill("underwater basket weaving");
      await page.getByTestId("no-match").waitFor();
    },
  },
  {
    name: "library-listening-on",
    path: "/library",
    state: onboarded({ musicApp: "spotify" }),
    setup: async (page) => {
      await page.getByRole("button", { name: "Change" }).click();
      await page.getByRole("group", { name: "Where do you listen?" }).waitFor();
    },
  },
  { name: "vibe", path: "/vibe?routine=boxing-bag-rounds", state: onboarded() },
  {
    name: "vibe-no-genre",
    path: "/vibe?routine=yoga-flow",
    state: onboarded(),
    setup: async (page) => {
      await page.getByRole("button", { name: "Make the mix" }).click();
      await page.getByText("Pick at least one genre.").waitFor();
    },
  },
  {
    name: "vibe-genre-limit",
    path: "/vibe?routine=yoga-flow",
    state: onboarded(),
    setup: async (page) => {
      for (const g of ["Soul", "Disco", "Jazz-funk"]) await page.getByRole("button", { name: g }).click();
      await page.getByText("That’s 3. Untick one to swap.").waitFor();
    },
  },
  { name: "mix", path: "/mix?routine=boxing-bag-rounds", state: onboarded() },
  { name: "saved", path: "/saved?routine=boxing-bag-rounds", state: onboarded() },
  { name: "saved-spotify", path: "/saved?routine=boxing-bag-rounds", state: onboarded({ musicApp: "spotify" }) },
  { name: "shared", path: "/m/demo-123", state: onboarded() },
  { name: "shared-ask", path: "/m/demo-123" },
];

export async function open(page: Page, s: Screen) {
  if (s.state) await seed(page, s.state);
  await page.goto(s.path);
  await page.locator("main").waitFor();
  if (s.setup) await s.setup(page);
  // Let the screen finish drawing before anything measures it.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
