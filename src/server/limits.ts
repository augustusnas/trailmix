// Limits that protect Claude credit and YouTube units: off switch (E15), daily ceiling (E14),
// per-person hourly limit (E9), plus share, page-view, code-try and YouTube search caps.

import type { ErrorCode } from "@/lib/messages";
import { LIMITS, config } from "./config";
import { getKV } from "./kv";

/** Today's date in the UK, so the daily ceiling resets at UK midnight. */
export function ukDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const HOUR = 3600;
const DAY = 86400;

/** Counts one use and says whether it was within the limit. */
async function within(key: string, limit: number, seconds: number): Promise<boolean> {
  const n = await getKV().incr(key, seconds);
  return config.relaxedLimits() || n <= limit;
}

/**
 * Before any mix, swap or remix: off switch, daily ceiling, hourly limit (in that order).
 * Returns the reason it's refused, or null to go ahead. Each allowed call counts once.
 */
export async function mixAllowed(who: string, forced?: string | null): Promise<ErrorCode | null> {
  if (config.mixesPaused() || forced === "e15") return "paused";
  if (forced === "e9") return "hourly";
  const ceiling = config.dailyMixCeiling();
  const today = await getKV().get<number>(`ceiling:${ukDay()}`);
  if (forced === "e14" || (!config.relaxedLimits() && (today ?? 0) >= ceiling)) return "ceiling";
  if (!(await within(`hourly:${who}`, LIMITS.mixesPerHour, HOUR))) return "hourly";
  if (!(await within(`ceiling:${ukDay()}`, ceiling, 2 * DAY))) return "ceiling";
  return null;
}

export const shareAllowed = (codeKey: string) => within(`shares:${codeKey}:${ukDay()}`, LIMITS.sharesPerDay, 2 * DAY);
export const pageViewAllowed = (ip: string) =>
  within(`views:${ip}:${Math.floor(Date.now() / 60000)}`, LIMITS.pageViewsPerMinute, 120);
const codeTriesKey = (ip: string) => `codetries:${ip}:${Math.floor(Date.now() / 3600000)}`;
/** Wrong access-code guesses: 10 an hour per IP. Right answers don't count. */
export async function codeTryAllowed(ip: string): Promise<boolean> {
  return ((await getKV().get<number>(codeTriesKey(ip))) ?? 0) < LIMITS.codeTriesPerHour;
}
export async function recordWrongCode(ip: string): Promise<void> {
  await getKV().incr(codeTriesKey(ip), 2 * HOUR);
}

/** YouTube fallback searches: 3 per mix, 30 per day overall (each costs 100 of 10,000 units). */
export async function youtubeSearchAllowed(mixId: string): Promise<boolean> {
  const kv = getKV();
  const day = `yt:${ukDay()}`;
  if (!config.relaxedLimits() && ((await kv.get<number>(day)) ?? 0) >= LIMITS.youtubeSearchesPerDay) return false;
  if (!(await within(`yt:mix:${mixId}`, LIMITS.youtubeSearchesPerMix, DAY))) return false;
  return within(day, LIMITS.youtubeSearchesPerDay, 2 * DAY);
}

/**
 * E5: is there YouTube quota left today for saving a playlist? MILESTONE 4: check the real quota
 * used by saves. Until then only the E5 test switch says no.
 */
export async function youtubeSaveQuotaLeft(forced?: string | null): Promise<boolean> {
  return forced !== "e5";
}
