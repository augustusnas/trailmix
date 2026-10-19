// RECORDED STAND-INS for Claude, iTunes, Odesli and YouTube, used only by automated tests
// (FAKE_SERVICES=1, never in the live app). Deterministic, free, and they never touch real accounts.

import { getRoutine } from "@/data/routines";
import type { PhaseId } from "@/lib/mixTypes";
import { MixError, type Ask } from "./claude";
import { trackPlan } from "./prompt";
import type { TrackRef } from "./validate";

const WORDS = ["Neon", "Gravel", "Summit", "Velvet", "Thunder", "Golden", "Midnight", "Static", "Ember", "Coastal", "Rapid", "Hollow"];
const NOUNS = ["Stride", "Pulse", "Ridge", "Signal", "Current", "Echo", "Horizon", "Engine", "Lantern", "Orbit", "Tide", "Rush"];

/** 240 fake tracks with fixed lengths of 2.5 to 5 minutes; consecutive tracks never share an artist. */
export const CATALOG = Array.from({ length: 240 }, (_, i) => ({
  n: i,
  title: `${WORDS[i % 12]} ${NOUNS[Math.floor(i / 12) % 12]} ${Math.floor(i / 144) + 1}`,
  artist: `The Fake ${NOUNS[(i * 5) % 12]}s ${i % 7}`,
  durationMs: (150 + ((i * 37) % 151)) * 1000,
}));
const byKey = new Map(CATALOG.map((t) => [`${t.artist}|${t.title}`.toLowerCase(), t]));
export const findFake = (title: string, artist: string) => byKey.get(`${artist}|${title}`.toLowerCase());

const MIX_NAMES: Record<string, string> = {
  "indoor-walk": "Groove Miles",
  "incline-treadmill": "Uphill Both Ways",
  "spin-bike": "Wheels on Fire",
  "rowing-intervals": "Stroke of Genius",
  "boxing-bag-rounds": "Gloves On, Volume Up",
  "shadow-boxing": "Ghost in the Ring",
  emom: "Every Minute Counts",
  amrap: "As Many Bangers",
  tabata: "Twenty On, Ten Off",
  "hiit-circuit": "Red Zone Radio",
  "free-weights-legs": "Leg Day Lore",
  "push-day": "Press Play",
  "pull-day": "Pull Up to the Bumper",
  "full-body": "Head to Toe",
  "kettlebell-flow": "Swing Theory",
  "stretch-mobility": "Loose Ends",
  "yoga-flow": "Slow Burn Sunday",
};

const keyOf = (t: TrackRef) => `${t.artist}|${t.title}`.toLowerCase();
let imaginary = 0;

function pick(a: Ask, phase: PhaseId, count: number, taken: Set<string>, seed: number) {
  const out: (TrackRef & { phase: PhaseId })[] = [];
  for (let i = 0; out.length < count && i < CATALOG.length; i++) {
    const t = CATALOG[(seed + i * 7) % CATALOG.length];
    const k = keyOf(t);
    if (taken.has(k)) continue;
    if (out.length && out[out.length - 1].artist === t.artist) continue;
    taken.add(k);
    out.push({ title: t.title, artist: t.artist, phase });
  }
  return out;
}

const seedOf = (a: Ask) =>
  [...`${a.req.routine.id}${a.req.genres.join()}${a.req.energy}`].reduce((n, c) => n + c.charCodeAt(0), 0);

export const fakeClaude = {
  async mix(a: Ask, exclude: TrackRef[], avoidName?: string) {
    a.usage.calls += 1;
    if (a.forced === "slow") await new Promise((r) => setTimeout(r, 3500)); // lets tests see the progress line
    if (a.forced === "e3") throw new MixError("failed");
    if (a.forced === "e4") throw new MixError("resting");
    const plan = trackPlan(a.req.length);
    const taken = new Set([...a.req.avoid, ...exclude].map(keyOf));
    const seed = seedOf(a) + (avoidName ? 101 : 0);
    const tracks = (["warm-up", "main", "cool-down"] as PhaseId[]).flatMap((p, i) => pick(a, p, plan[p], taken, seed + i * 61));
    // One made-up track in every mix, so the "doesn't exist → replace" path (E1) always runs.
    // The E1 switch adds four, and their replacements are made up too, so the mix comes out shorter.
    const fakes = a.forced === "e1" ? 4 : 1;
    for (let i = 0; i < fakes; i++) tracks.splice(3 + i, 0, { title: `Imaginary Song ${++imaginary}`, artist: "Nobody", phase: "main" });
    const name = MIX_NAMES[a.req.routine.id] ?? getRoutine(a.req.routine.id)?.name ?? "Fresh Mix";
    return { name: avoidName ? `${name} II` : name, tracks };
  },

  more(a: Ask, phase: PhaseId, count: number, exclude: TrackRef[]) {
    a.usage.calls += 1;
    if (a.forced === "e1") return { tracks: Array.from({ length: count }, () => ({ title: `Imaginary Song ${++imaginary}`, artist: "Nobody", phase })) };
    const taken = new Set([...a.req.avoid, ...exclude].map(keyOf));
    return { tracks: pick(a, phase, count, taken, seedOf(a) + 17 * exclude.length) };
  },
};

export const fakeItunes = (title: string, artist: string) => {
  const t = findFake(title, artist);
  return t ? { appleUrl: `https://music.apple.com/gb/song/fake/${t.n}`, durationMs: t.durationMs } : null;
};

/** Every fifth track has no YouTube match on Odesli, so the YouTube search fallback (E2) runs. */
export const fakeOdesli = (appleUrl: string) => {
  const n = Number(appleUrl.split("/").pop());
  const withYouTube = n % 5 !== 0;
  return {
    spotifyUrl: `https://open.spotify.com/track/fake${n}`,
    youtubeMusicUrl: withYouTube ? `https://music.youtube.com/watch?v=fakeyt${String(n).padStart(4, "0")}` : undefined,
    youtubeUrl: withYouTube ? `https://www.youtube.com/watch?v=fakeyt${String(n).padStart(4, "0")}` : undefined,
    youtubeId: withYouTube ? `fakeyt${String(n).padStart(4, "0")}` : undefined,
  };
};

export const fakeYouTube = (title: string, artist: string) => {
  const t = findFake(title, artist);
  return t ? `fallbk${String(t.n).padStart(4, "0")}` : null;
};
