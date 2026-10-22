// The stats page's numbers (Milestone 5, C1): each measure for today, 7 and 30 days, with its target.

import { config } from "./config";
import { getKV } from "./kv";
import { ukDay } from "./limits";
import { lastDays, totals, type Totals } from "./usage";

export type Measure = {
  label: string;
  target: string;
  /** Whether a value meets the target (null: no data yet). */
  meets: (v: number) => boolean;
  /** The value for some days' totals, or null when there's nothing to divide by. */
  value: (t: Totals) => number | null;
  format: (v: number) => string;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const percent = (v: number) => `${Math.round(v * 100)}%`;
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toString();

export const MEASURES: Measure[] = [
  { label: "Keep rate", target: "over 50%", meets: (v) => v > 0.5, value: (t) => ratio(t.kept, t.made), format: percent },
  { label: "Swaps per kept mix", target: "under 3", meets: (v) => v < 3, value: (t) => ratio(t.swaps, t.kept), format: oneDecimal },
  { label: "Carried me", target: "over 60%", meets: (v) => v > 0.6, value: (t) => ratio(t.carried, t.checkins), format: percent },
  { label: "Dipped midway", target: "under 25%", meets: (v) => v < 0.25, value: (t) => ratio(t.dipped, t.checkins), format: percent },
  { label: "Freshness", target: "over 70%", meets: (v) => v > 70, value: (t) => ratio(t.freshness, t.kept), format: (v) => `${Math.round(v)}%` },
  { label: "New favourite", target: "1 in 3", meets: (v) => v >= 1 / 3, value: (t) => ratio(t.favourite, t.checkins), format: percent },
  { label: "Not found per mix", target: "under 1", meets: (v) => v < 1, value: (t) => ratio(t.notFound, t.made + t.remixes), format: oneDecimal },
  { label: "Shared", target: "1 in 5", meets: (v) => v >= 0.2, value: (t) => ratio(t.shared, t.kept), format: percent },
];

export type StatsData = {
  periods: { label: string; totals: Totals }[];
  claudeToday: number;
  ceiling: number;
};

export async function statsData(now = Date.now()): Promise<StatsData> {
  const days = lastDays(30, now);
  const [today, week, month] = await Promise.all([totals(days.slice(0, 1)), totals(days.slice(0, 7)), totals(days)]);
  return {
    periods: [
      { label: "Today", totals: today },
      { label: "7 days", totals: week },
      { label: "30 days", totals: month },
    ],
    claudeToday: (await getKV().get<number>(`ceiling:${ukDay(new Date(now))}`)) ?? 0,
    ceiling: config.dailyMixCeiling(),
  };
}
