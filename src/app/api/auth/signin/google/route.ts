import { redirectTo } from "@/server/http";
import { config } from "@/server/config";
import { authorizeUrl, newOAuthState, safeReturn } from "@/server/google";
import { OAUTH_COOKIE, checkGuest, cookie, seal } from "@/server/session";

// F1: "Sign in with Google" goes here, then on to Google. `returnTo` is where to land afterwards
// (Where do you listen the first time; the same mix after a quick sign-in, E7).
// `youtube=1`: the first Keep it in YouTube Music, asking for the YouTube permission as well (Part C).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ready = config.fakeServices() || (config.googleClientId() && config.googleClientSecret() && config.authSecret());
  if (!ready) return redirectTo(req, "/?signin=unavailable");
  const youtube = url.searchParams.get("youtube") === "1";
  const s = newOAuthState(safeReturn(url.searchParams.get("returnTo")), Date.now(), youtube);
  // Stand-in Google only (automated tests): which pretend account signs in, and whether it says no (E8).
  const fake = config.fakeServices();
  const current = checkGuest(req);
  const as = fake ? (url.searchParams.get("as") ?? (current.ok ? current.session.email : undefined)) : undefined;
  const deny = fake && url.searchParams.get("deny") === "1";
  return redirectTo(req, authorizeUrl(req, s, as, deny), [cookie(req, OAUTH_COOKIE, seal(s), 600)]);
}
