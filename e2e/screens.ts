import type { Page } from "@playwright/test";
import { BOXING_VIBE, ONBOARDED, makeSharedMix, record, seed, waitForMix, backFromYouTubeMusic } from "./helpers";

export type Screen = {
  name: string;
  path: string;
  /** Saved data on the phone before the page opens. */
  state?: string;
  /** Extra taps to reach the state worth checking. */
  setup?: (page: Page) => Promise<void>;
  /** Beta test switch to force a failure (E3, E10, E15…). */
  testSwitch?: string;
};

const keep = async (page: Page) => {
  await waitForMix(page);
  await page.getByTestId("mix-action").click();
};
const openShared = async (page: Page) => {
  const { id } = await makeSharedMix(page.request);
  await page.goto(`/m/${id}`);
  await page.getByTestId("play-in").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="play-in"]')!.children.length > 0);
};

const SIX_PINS = ["push-day", "incline-treadmill", "hiit-circuit", "tabata", "yoga-flow", "boxing-bag-rounds"];
/** A mix kept two hours ago, so Home asks how it did (F17). */
const CHECKIN_DUE = {
  id: "mix00001",
  name: "Gloves On, Volume Up",
  routineId: "boxing-bag-rounds",
  date: "2026-10-27T09:00:00Z",
  keptAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  freshness: 90,
  tracks: [{ title: "One", artist: "A" }],
};
const onboarded = (extra: object = {}) => record({ ...ONBOARDED, vibes: BOXING_VIBE, ...extra });

// Every screen and every Milestone 2 state, for screenshots, labels, accessibility and security checks.
export const SCREENS: Screen[] = [
  { name: "welcome", path: "/" },
  // E13: signed in with an account that isn't on the guest list.
  { name: "welcome-not-invited", path: "/?signin=notInvited", setup: async (page) => void (await page.getByTestId("signin-note").waitFor()) },
  {
    // E7: the sign-in ran out; the mix is kept and a quick sign-in is offered.
    name: "mix-signin",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "e7",
    setup: async (page) => void (await page.getByTestId("mix-problem").waitFor()),
  },
  { name: "listen", path: "/listen" },
  { name: "home", path: "/home", state: onboarded() },
  { name: "home-full", path: "/home", state: onboarded({ pins: SIX_PINS }) },
  { name: "home-empty", path: "/home", state: onboarded({ pins: [] }) },
  {
    name: "home-checkin",
    path: "/home",
    state: onboarded({ recentMixes: [CHECKIN_DUE] }),
    setup: async (page) => void (await page.getByTestId("checkin").waitFor()),
  },
  {
    name: "home-checkin-noted",
    path: "/home",
    state: onboarded({ recentMixes: [CHECKIN_DUE] }),
    setup: async (page) => {
      await page.getByRole("button", { name: "Carried me" }).click();
      await page.getByText("Noted. The next mix gets the memo.").waitFor();
    },
  },
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
    name: "vibe-energy",
    path: "/vibe?routine=boxing-bag-rounds",
    state: onboarded(),
    setup: async (page) => {
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("heading", { name: "How hard are you going?" }).waitFor();
    },
  },
  {
    name: "vibe-length",
    path: "/vibe?routine=boxing-bag-rounds",
    state: onboarded(),
    setup: async (page) => {
      await page.getByTestId("same-as-last").click();
      await page.getByRole("heading", { name: "How long have you got?" }).waitFor();
    },
  },
  {
    name: "vibe-no-genre",
    path: "/vibe?routine=yoga-flow",
    state: onboarded(),
    setup: async (page) => {
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByText("Pick at least one genre.").waitFor();
    },
  },
  {
    name: "vibe-genre-limit",
    path: "/vibe?routine=yoga-flow",
    state: onboarded(),
    setup: async (page) => {
      for (const g of ["R&B & soul", "Funk & disco", "Metal"]) await page.getByRole("button", { name: g }).click();
      await page.getByText("That’s 3. Untick one to swap.").waitFor();
    },
  },
  { name: "mix", path: "/mix?routine=boxing-bag-rounds", state: onboarded(), setup: waitForMix },
  {
    name: "mix-making",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "slow",
    setup: async (page) => void (await page.getByRole("heading", { name: "Picking tracks for your vibe" }).waitFor()),
  },
  {
    name: "mix-energy",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "slow",
    setup: async (page) => void (await page.getByRole("heading", { name: "Lining up the energy" }).waitFor({ timeout: 15_000 })),
  },
  {
    name: "mix-fitting",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "slow",
    setup: async (page) => void (await page.getByRole("heading", { name: "Fitting it to 45 minutes" }).waitFor({ timeout: 15_000 })),
  },
  {
    name: "mix-short",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "short",
    setup: async (page) => void (await page.getByTestId("length-note").waitFor()),
  },
  {
    name: "mix-failed",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "e3",
    setup: async (page) => void (await page.getByTestId("mix-problem").waitFor()),
  },
  {
    name: "mix-paused",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "e15",
    setup: async (page) => void (await page.getByTestId("mix-problem").waitFor()),
  },
  {
    name: "mix-offline",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded(),
    testSwitch: "e10",
    setup: async (page) => void (await page.getByTestId("offline-banner").waitFor()),
  },
  { name: "saved", path: "/mix?routine=boxing-bag-rounds", state: onboarded(), setup: async (page) => {
      await keep(page);
      await backFromYouTubeMusic(page);
    } },
  {
    name: "saved-spotify",
    path: "/mix?routine=boxing-bag-rounds",
    state: onboarded({ musicApp: "spotify" }),
    setup: async (page) => {
      await keep(page);
      await page.waitForURL(/\/m\//);
      await page.goto("/saved?routine=boxing-bag-rounds");
      await page.getByTestId("saved-action").waitFor();
    },
  },
  { name: "shared", path: "/home", state: onboarded(), setup: openShared },
  { name: "shared-ask", path: "/", setup: openShared },
  { name: "shared-moved-on", path: "/m/AAAAAAAAAAAAAAAAAAAAAA" },
  { name: "privacy", path: "/privacy" },
  { name: "privacy-returning", path: "/privacy", state: onboarded() },
  { name: "terms", path: "/terms" },
  { name: "stats", path: "/stats", state: onboarded(), setup: async (page) => void (await page.getByTestId("measures").waitFor()) },
];

export async function open(page: Page, s: Screen) {
  if (s.state) await seed(page, s.state);
  if (s.testSwitch) {
    await page.addInitScript((v) => sessionStorage.setItem("trailmix-test-switch", v), s.testSwitch);
  }
  await page.goto(s.path);
  await page.locator("main").waitFor();
  if (s.setup) await s.setup(page);
  // Let the screen finish drawing before anything measures it.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
