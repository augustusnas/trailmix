import { redirectTo } from "@/server/http";
import { config } from "@/server/config";
import { authorizeUrl, newOAuthState, safeReturn } from "@/server/google";
import { OAUTH_COOKIE, cookie, seal } from "@/server/session";

// F1: "Sign in with Google" goes here, then on to Google. `returnTo` is where to land afterwards
// (Where do you listen the first time; the same mix after a quick sign-in, E7).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ready = config.fakeServices() || (config.googleClientId() && config.googleClientSecret() && config.authSecret());
  if (!ready) return redirectTo(req, "/?signin=unavailable");
  const s = newOAuthState(safeReturn(url.searchParams.get("returnTo")));
  // Stand-in Google only (automated tests): which pretend account signs in.
  const as = config.fakeServices() ? (url.searchParams.get("as") ?? undefined) : undefined;
  return redirectTo(req, authorizeUrl(req, s, as), [cookie(req, OAUTH_COOKIE, seal(s), 600)]);
}
