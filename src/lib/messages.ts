// Every friendly message the server can send back, in one place. Wording follows TEST-PLAN.md. Codes travel with them so the
// app can react (e.g. ask for the access code again).

export const MESSAGES = {
  access: "That code didn't work. Check it with whoever invited you.",
  accessAttempts: "Too many tries. Wait an hour, then try the code again.",
  paused: "Mix-making is paused. Back soon.",
  ceiling: "Trailmix has made enough mixes for today. Back tomorrow.",
  hourly: "That's a lot of mixes. Back in a few minutes.",
  invalid: "Something's off with those settings. Pick again.",
  failed: "The mix didn't come together. Try again.",
  resting: "Mix-making is resting right now. Try again later.",
  offline: "You're offline.",
  shortened: "A few tracks couldn't be found, so this mix is a little shorter.",
  /** Generate or Remix ran past its time limit (45 seconds on the phone). */
  timeout: "That took too long. Try again.",
  /** Swap ran past its 15-second limit, or found nothing; the original track stays. */
  swapFailed: "Couldn't find a swap for this one. Try again.",
  sharesDaily: "That's today's sharing done. More tomorrow.",
  viewsBusy: "Easy there. Try again in a minute.",
  youtubeQuota: "YouTube's daily limit is used up. Try tomorrow or share the list.",
} as const;

export type ErrorCode = keyof typeof MESSAGES;

export type ApiError = { error: ErrorCode; message: string };
