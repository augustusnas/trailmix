import { redirectTo } from "@/server/http";
import { exchangeCode, type OAuthState } from "@/server/google";
import { OAUTH_COOKIE, clearSession, cookie, isGuest, newSession, readCookie, sessionCookie, unseal } from "@/server/session";

// Google sends the phone back here. Checks it's the sign-in we started (state and PKCE), then the
// guest list (E13), then starts the session (N7) and goes on to where the sign-in began.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clearOAuth = cookie(req, OAUTH_COOKIE, "", 0);
  let s: OAuthState | null = null;
  try {
    s = unseal<OAuthState>(readCookie(req, OAUTH_COOKIE));
  } catch {
    s = null;
  }
  const code = url.searchParams.get("code");
  if (!s || s.exp < Date.now() || s.state !== url.searchParams.get("state") || !code) {
    // Cancelled on Google's screen, took too long, or not a sign-in we started.
    return redirectTo(req, "/?signin=cancelled", [clearOAuth]);
  }
  const profile = await exchangeCode(req, code, s.verifier);
  if (!profile) return redirectTo(req, "/?signin=cancelled", [clearOAuth]);
  if (!isGuest(profile.email)) {
    console.log(JSON.stringify({ event: "signin-refused", reason: "not on the guest list" }));
    return redirectTo(req, "/?signin=notInvited", [clearOAuth, clearSession(req)]);
  }
  return redirectTo(req, s.returnTo, [clearOAuth, sessionCookie(req, newSession(profile.sub, profile.email, profile.firstName))]);
}
