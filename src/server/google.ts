// Google sign-in (OAuth 2.0 with PKCE). Sign-in asks only for basic profile (name and email); the
// YouTube permission is asked for separately, the first time someone taps Keep it (Part C).
// The redirect address is /api/auth/callback/google, as registered on the "Trailmix Web Client".

import { createHash, randomBytes } from "node:crypto";
import { config } from "./config";

export const CALLBACK_PATH = "/api/auth/callback/google";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const BASIC_SCOPES = "openid email profile";
/** Asked for only when someone first taps Keep it in YouTube Music (incremental consent). */
export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

/** In automated tests (stand-in services) the "Google" account is this one unless a test picks another. */
export const FAKE_GUEST = "guest@trailmix.test";

/** What's kept between leaving for Google and coming back (sealed in a short-lived cookie). */
export type OAuthState = { state: string; verifier: string; returnTo: string; exp: number; youtube?: boolean };

/** Only our own pages, so a sign-in link can't send someone elsewhere afterwards. */
export function safeReturn(path: unknown, fallback = "/listen"): string {
  if (typeof path !== "string" || path.length > 300) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

const b64url = (b: Buffer) => b.toString("base64url");

export function newOAuthState(returnTo: string, now = Date.now(), youtube = false): OAuthState {
  return { state: b64url(randomBytes(16)), verifier: b64url(randomBytes(32)), returnTo, exp: now + 10 * 60_000, ...(youtube ? { youtube } : {}) };
}

export function callbackUrl(req: Request): string {
  return `${new URL(req.url).origin}${CALLBACK_PATH}`;
}

/**
 * Where to send the phone to sign in. With `s.youtube`, it also asks for the YouTube permission and
 * a refresh token, so playlists can be saved for the next 7 days without asking again.
 */
export function authorizeUrl(req: Request, s: OAuthState, fakeEmail?: string, fakeDeny = false): string {
  if (config.fakeServices()) {
    // Stand-in Google: straight back with a pretend code naming the account (or "Cancel", E8).
    const q = new URLSearchParams(fakeDeny ? { error: "access_denied", state: s.state } : { code: `fake:${fakeEmail || FAKE_GUEST}${s.youtube ? ":youtube" : ""}`, state: s.state });
    return `${CALLBACK_PATH}?${q}`;
  }
  const q = new URLSearchParams({
    client_id: config.googleClientId() ?? "",
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: s.youtube ? `${BASIC_SCOPES} ${YOUTUBE_SCOPE}` : BASIC_SCOPES,
    state: s.state,
    code_challenge: b64url(createHash("sha256").update(s.verifier).digest()),
    code_challenge_method: "S256",
    include_granted_scopes: "true",
    // The YouTube step needs Google's consent screen every time, or no refresh token comes back.
    ...(s.youtube ? { access_type: "offline", prompt: "consent" } : { prompt: "select_account" }),
  });
  return `${AUTH_URL}?${q}`;
}

export type GoogleProfile = { sub: string; email: string; firstName: string };

/** Google's tokens for the YouTube permission. Only ever kept on the server, sealed (server/youtube.ts). */
export type GoogleTokens = { access: string; refresh?: string; accessExp: number; youtube: boolean };

/**
 * Swaps the code for the account's details. The id token comes straight from Google over https in
 * answer to our own request (with the client secret), so its contents can be trusted as they are
 * (OpenID Connect Core 3.1.3.7); we still check it's for our app and in date.
 */
export async function exchangeCode(req: Request, code: string, verifier: string): Promise<{ profile: GoogleProfile; tokens: GoogleTokens } | null> {
  if (config.fakeServices()) {
    const [, email, youtube] = code.match(/^fake:([^:]+)(:youtube)?$/) ?? [];
    if (!email) return null;
    return {
      profile: { sub: `fake-${email}`, email, firstName: email === FAKE_GUEST ? "Sam" : "Alex" },
      tokens: { access: `fake-access-${email}`, refresh: `fake-refresh-${email}`, accessExp: Date.now() + 3600_000, youtube: !!youtube },
    };
  }
  const clientId = config.googleClientId();
  const clientSecret = config.googleClientSecret();
  if (!clientId || !clientSecret) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl(req), grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { id_token?: unknown; access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown } | null;
  const profile = profileFromIdToken(data?.id_token, clientId);
  if (!profile || typeof data?.access_token !== "string") return null;
  return {
    profile,
    tokens: {
      access: data.access_token,
      refresh: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      accessExp: Date.now() + (typeof data.expires_in === "number" ? data.expires_in : 3600) * 1000,
      // On Google's consent screen the YouTube box can be unticked, so check it was really given.
      youtube: typeof data.scope === "string" && data.scope.split(" ").includes(YOUTUBE_SCOPE),
    },
  };
}

/**
 * A fresh access token from the refresh token. Null when Google says no: in Testing mode refresh
 * tokens run out after 7 days, or the permission was taken back in the Google account.
 */
export async function refreshAccess(refresh: string): Promise<GoogleTokens | null> {
  if (config.fakeServices()) return refresh.startsWith("fake-refresh-") ? { access: refresh.replace("refresh", "access"), refresh, accessExp: Date.now() + 3600_000, youtube: true } : null;
  const clientId = config.googleClientId();
  const clientSecret = config.googleClientSecret();
  if (!clientId || !clientSecret) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof data?.access_token !== "string") return null;
  return { access: data.access_token, refresh, accessExp: Date.now() + (typeof data.expires_in === "number" ? data.expires_in : 3600) * 1000, youtube: true };
}

/** The account in a Google id token, if it's for us, in date and the email is verified. */
export function profileFromIdToken(token: unknown, clientId: string, now = Date.now()): GoogleProfile | null {
  if (typeof token !== "string") return null;
  const part = token.split(".")[1];
  if (!part) return null;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const issuerOk = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
  const inDate = typeof c.exp === "number" && c.exp * 1000 > now;
  if (!issuerOk || c.aud !== clientId || !inDate || typeof c.sub !== "string" || typeof c.email !== "string" || c.email_verified !== true) return null;
  const first = typeof c.given_name === "string" && c.given_name.trim() ? c.given_name.trim() : typeof c.name === "string" ? c.name.trim().split(/\s+/)[0] : "";
  return { sub: c.sub, email: c.email, firstName: first.slice(0, 40) };
}
