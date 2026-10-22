import { redirectTo } from "@/server/http";
import { exchangeCode, type OAuthState } from "@/server/google";
import { OAUTH_COOKIE, clearSession, cookie, isGuest, newSession, readCookie, sessionCookie, unseal, whoOf } from "@/server/session";
import { storePermission } from "@/server/youtube";

/** Back to the page the YouTube step started on, saying how it went (`youtube=granted|denied`). */
const withYouTube = (returnTo: string, outcome: "granted" | "denied") => {
  const u = new URL(returnTo, "http://x");
  u.searchParams.set("youtube", outcome);
  return `${u.pathname}${u.search}`;
};

// Google sends the phone back here. Checks it's the sign-in we started (state and PKCE), then the
// guest list (E13), then starts the session (N7) and goes on to where the sign-in began.
// After the YouTube step it also keeps the permission, sealed, on the server only.
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
  const ours = !!s && s.exp >= Date.now() && s.state === url.searchParams.get("state");
  // E8: "Cancel" on Google's YouTube screen comes back with no code. The sign-in itself still stands.
  if (ours && s!.youtube && !code) return redirectTo(req, withYouTube(s!.returnTo, "denied"), [clearOAuth]);
  if (!s || !ours || !code) {
    // Cancelled on Google's screen, took too long, or not a sign-in we started.
    return redirectTo(req, "/?signin=cancelled", [clearOAuth]);
  }
  const got = await exchangeCode(req, code, s.verifier);
  if (!got) return redirectTo(req, "/?signin=cancelled", [clearOAuth]);
  const { profile, tokens } = got;
  if (!isGuest(profile.email)) {
    console.log(JSON.stringify({ event: "signin-refused", reason: "not on the guest list" }));
    return redirectTo(req, "/?signin=notInvited", [clearOAuth, clearSession(req)]);
  }
  const session = sessionCookie(req, newSession(profile.sub, profile.email, profile.firstName));
  if (!s.youtube) return redirectTo(req, s.returnTo, [clearOAuth, session]);
  // The YouTube box on Google's screen can be unticked: that's a no too (E8).
  if (!tokens.youtube) return redirectTo(req, withYouTube(s.returnTo, "denied"), [clearOAuth, session]);
  await storePermission(whoOf(profile.sub), tokens);
  return redirectTo(req, withYouTube(s.returnTo, "granted"), [clearOAuth, session]);
}
