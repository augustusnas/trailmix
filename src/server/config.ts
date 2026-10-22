// Server settings, all from environment variables. Never imported by browser code.

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const config = {
  /** Claude model for mixes. Change in Vercel without a code change. */
  claudeModel: () => process.env.CLAUDE_MODEL?.trim() || "claude-haiku-5-5",
  anthropicKey: () => process.env.ANTHROPIC_API_KEY,
  youtubeKey: () => process.env.YOUTUBE_API_KEY,
  /** Seals the sign-in cookie (server/session.ts). Long and random; changing it signs everyone out. */
  authSecret: () => process.env.AUTH_SECRET?.trim() || undefined,
  /** The "Trailmix Web Client" OAuth client in Google Cloud. */
  googleClientId: () => process.env.AUTH_GOOGLE_ID?.trim() || undefined,
  googleClientSecret: () => process.env.AUTH_GOOGLE_SECRET?.trim() || undefined,
  /** Who may use Trailmix: comma-separated Google account emails. Unset means nobody gets in. */
  guestEmails: () => process.env.GUEST_EMAILS,
  dailyMixCeiling: () => num(process.env.DAILY_MIX_CEILING, 60),
  mixesPaused: () => /^(true|on|yes|1)$/i.test((process.env.MIXES_PAUSED ?? "").trim()),
  /**
   * Recorded answers instead of Claude, Deezer, iTunes and Upstash, for automated tests.
   * Can never be switched on in the live (production) deployment.
   */
  fakeServices: () => process.env.FAKE_SERVICES === "1" && process.env.VERCEL_ENV !== "production",
  /**
   * Automated tests only (needs fakeServices): every test shares one code and one computer, so the
   * per-person and per-day limits are lifted. The limit tests run on a second copy with them on.
   */
  relaxedLimits: () => config.fakeServices() && process.env.TEST_RELAXED_LIMITS === "1",
};

/** Per-person and per-day limits. */
export const LIMITS = {
  mixesPerHour: 20,
  sharesPerDay: 20,
  savesPerHour: 10,
  pageViewsPerMinute: 60,
  /** Shared mixes live this long. */
  shareDays: 90,
};
