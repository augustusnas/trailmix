// Google sign-in (OAuth 2.0 with PKCE). Sign-in asks only for basic profile (name and email); the
// YouTube permission is asked for separately, the first time someone taps Keep it (Part C).
// The redirect address is /api/auth/callback/google, as registered on the "Trailmix Web Client".

import { createHash, randomBytes } from "node:crypto";
import { config } from "./config";

export const CALLBACK_PATH = "/api/auth/callback/google";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const BASIC_SCOPES = "openid email profile";

/** In automated tests (stand-in services) the "Google" account is this one unless a test picks another. */
export const FAKE_GUEST = "guest@trailmix.test";

/** What's kept between leaving for Google and coming back (sealed in a short-lived cookie). */
export type OAuthState = { state: string; verifier: string; returnTo: string; exp: number };

/** Only our own pages, so a sign-in link can't send someone elsewhere afterwards. */
export function safeReturn(path: unknown, fallback = "/listen"): string {
  if (typeof path !== "string" || path.length > 300) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}

const b64url = (b: Buffer) => b.toString("base64url");

export function newOAuthState(returnTo: string, now = Date.now()): OAuthState {
  return { state: b64url(randomBytes(16)), verifier: b64url(randomBytes(32)), returnTo, exp: now + 10 * 60_000 };
}

export function callbackUrl(req: Request): string {
  return `${new URL(req.url).origin}${CALLBACK_PATH}`;
}

/** Where to send the phone to sign in. */
export function authorizeUrl(req: Request, s: OAuthState, fakeEmail?: string): string {
  if (config.fakeServices()) {
    // Stand-in Google: straight back with a pretend code naming the account.
    const q = new URLSearchParams({ code: `fake:${fakeEmail || FAKE_GUEST}`, state: s.state });
    return `${CALLBACK_PATH}?${q}`;
  }
  const q = new URLSearchParams({
    client_id: config.googleClientId() ?? "",
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: BASIC_SCOPES,
    state: s.state,
    code_challenge: b64url(createHash("sha256").update(s.verifier).digest()),
    code_challenge_method: "S256",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q}`;
}

export type GoogleProfile = { sub: string; email: string; firstName: string };

/**
 * Swaps the code for the account's details. The id token comes straight from Google over https in
 * answer to our own request (with the client secret), so its contents can be trusted as they are
 * (OpenID Connect Core 3.1.3.7); we still check it's for our app and in date.
 */
export async function exchangeCode(req: Request, code: string, verifier: string): Promise<GoogleProfile | null> {
  if (config.fakeServices()) {
    const email = code.startsWith("fake:") ? code.slice(5) : "";
    if (!email) return null;
    return { sub: `fake-${createHash("sha256").update(email).digest("hex").slice(0, 12)}`, email, firstName: email === FAKE_GUEST ? "Sam" : "Alex" };
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
  const data = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  return profileFromIdToken(data?.id_token, clientId);
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
