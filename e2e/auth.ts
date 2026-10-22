// Signing in for the automated tests: the test servers use the stand-in Google (FAKE_SERVICES) and
// this secret, so a test can hold a real sealed session cookie without going through Google.
import { SESSION_COOKIE, newSession, seal } from "../src/server/session";

export const TEST_AUTH_SECRET = "test-auth-secret-NOT-REAL-5c9a";
export const GUEST = "guest@trailmix.test";
/** On the guest list too (for "someone else" tests). */
export const FRIEND = "friend@trailmix.test";
/** On the guest list, used only by the limit tests so their counts start from zero. */
export const LIMITS_GUEST = "limits@trailmix.test";
/** Not on the guest list (E13). */
export const STRANGER = "stranger@trailmix.test";
export const TEST_GUEST_EMAILS = `${GUEST},${FRIEND},${LIMITS_GUEST}`;

/** A signed-in session cookie's value for this account (7 days, like a real one). */
export function sessionValue(email = GUEST, now = Date.now()): string {
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  return seal(newSession(`fake-${email}`, email, email === GUEST ? "Sam" : "Alex", now));
}

/** Headers for API tests: signed in as this account. */
export const signedIn = (email = GUEST, now?: number) => ({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionValue(email, now))}` });

/** Browser storage for a signed-in phone (Playwright's storageState). */
export function signedInState(email = GUEST) {
  return {
    cookies: [{ name: SESSION_COOKIE, value: encodeURIComponent(sessionValue(email)), domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 7 * 86400, httpOnly: true, secure: false, sameSite: "Lax" as const }],
    origins: [],
  };
}

export const SIGNED_OUT = { cookies: [], origins: [] };
