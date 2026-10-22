// Limits that protect Claude credit and YouTube units: off switch (E15), daily ceiling (E14),
// per-account hourly limit (E9), plus share, save and page-view caps.

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

/** E9, per Google account (`who` from server/session.ts). */
export const shareAllowed = (who: string) => within(`shares:${who}:${ukDay()}`, LIMITS.sharesPerDay, 2 * DAY);
export const saveAllowed = (who: string) => within(`saves:${who}:${Math.floor(Date.now() / 3600_000)}`, LIMITS.savesPerHour, 2 * HOUR);
export const pageViewAllowed = (ip: string) =>
  within(`views:${ip}:${Math.floor(Date.now() / 60000)}`, LIMITS.pageViewsPerMinute, 120);
