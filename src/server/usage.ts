// Anonymous usage counts for the stats page (Milestone 5, C1, C2). Daily counters in Upstash, kept
// 90 days: no cookies, no third-party analytics, no emails, no Google ids. The four journey
// checkpoints are counted once per person, recognised by a one-way scramble of their Google account
// id (HMAC-SHA-256 with a key derived from AUTH_SECRET), so the id itself is never stored.

import { createHash, createHmac } from "node:crypto";
import { config } from "./config";
import { getKV } from "./kv";
import { ukDay } from "./limits";

export const COUNTERS = [
  "made", // new mixes (Make the mix)
  "remixes", // Remixes made
  "kept", // Keep it / Open in…
  "keptRemixes", // Remixes before each keep, added up
  "freshness", // F18 freshness of each kept mix, added up (per cent)
  "swaps",
  "checkins",
  "carried",
  "dipped",
  "didntLand",
  "favourite", // check-ins with "New favourite" on
  "notFound", // suggested tracks Deezer didn't have, over all mixes and Remixes
  "shared", // Share with friends (the share sheet or a copied link)
  "youtubeUnits",
  "firstMix", // checkpoints: people reaching each one for the first time
  "firstKept",
  "firstCarried",
  "returned", // came back on a later day within 7 days of their first mix
] as const;
export type Counter = (typeof COUNTERS)[number];

const KEEP_DAYS = 90;
const counterKey = (day: string, c: Counter) => `stats:${day}:${c}`;

/** Adds to today's count. Counting never gets in the way: a failure here is ignored. */
export async function count(c: Counter, n = 1): Promise<void> {
  if (!n) return;
  await getKV()
    .incrBy(counterKey(ukDay(), c), n, KEEP_DAYS * 86400)
    .catch(() => undefined);
}

/** The last `n` UK days, today first. */
export function lastDays(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => ukDay(new Date(now - i * 86400_000)));
}

export type Totals = Record<Counter, number>;

/** Every counter added up over these days. */
export async function totals(days: string[]): Promise<Totals> {
  const keys = days.flatMap((d) => COUNTERS.map((c) => counterKey(d, c)));
  const values = await getKV().getMany<number>(keys);
  const out = Object.fromEntries(COUNTERS.map((c) => [c, 0])) as Totals;
  values.forEach((v, i) => (out[COUNTERS[i % COUNTERS.length]] += Number(v) || 0));
  return out;
}

// ——— Journey checkpoints ———

/** The scrambled id a person's checkpoints are kept under. Never reversible to the Google id. */
export function personKey(sub: string): string {
  const key = createHash("sha256").update(`trailmix-checkpoints:${config.authSecret() ?? ""}`).digest();
  return createHmac("sha256", key).update(sub).digest("hex").slice(0, 32);
}

/** Only the UK days each checkpoint was first reached. */
type Journey = { firstMix?: string; firstKept?: string; firstCarried?: string; returned?: string };
/** A person's checkpoints are kept this long after their last change. */
const JOURNEY_DAYS = 180;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

/** Records a person's mix made, mix kept or "Carried me", counting any checkpoint reached for the first time. */
export async function checkpoint(sub: string, event: "mix" | "kept" | "carried"): Promise<void> {
  try {
    const kv = getKV();
    const key = `journey:${personKey(sub)}`;
    const j = (await kv.get<Journey>(key)) ?? {};
    const today = ukDay();
    const reached: Counter[] = [];
    if (event === "mix" && !j.firstMix) {
      j.firstMix = today;
      reached.push("firstMix");
    }
    if (event === "kept" && !j.firstKept) {
      j.firstKept = today;
      reached.push("firstKept");
    }
    if (event === "carried" && !j.firstCarried) {
      j.firstCarried = today;
      reached.push("firstCarried");
    }
    // Back on a later day, within a week of the first mix.
    if (j.firstMix && !j.returned && today > j.firstMix && daysBetween(j.firstMix, today) <= 7) {
      j.returned = today;
      reached.push("returned");
    }
    if (!reached.length) return;
    await kv.set(key, j, JOURNEY_DAYS * 86400);
    await Promise.all(reached.map((c) => count(c)));
  } catch {
    // never let counting break the app
  }
}
