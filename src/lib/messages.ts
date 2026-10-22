// Every friendly message the server can send back, in one place. Wording follows TEST-PLAN.md. Codes travel with them so the
// app can react (e.g. ask for the access code again).

export const MESSAGES = {
  /** E7: not signed in, or the 7-day sign-in ran out. The mix on the phone is kept. */
  signin: "Quick sign-in needed, your mix is safe.",
  /** E13: signed in with a Google account that isn't on the guest list. */
  notInvited: "Trailmix is invite-only for now, and that Google account isn't on the guest list.",
  paused: "Mix-making is paused. Back soon.",
  ceiling: "Trailmix has made enough mixes for today. Back tomorrow.",
  hourly: "That's a lot of mixes. Back in a few minutes.",
  /** E9: 10 saves to YouTube Music an hour. */
  savesHourly: "That's a lot of saves. Back in a few minutes.",
  invalid: "Something's off with those settings. Pick again.",
  failed: "The mix didn't come together. Try again.",
  resting: "Mix-making is resting right now. Try again later.",
  offline: "You're offline.",
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
