// Who's signed in (F1, F2, N6, N7, E7, E13). Google sign-in gives a session cookie that only the
// server can read: HTTP-only, Secure (on https), SameSite=Lax, and sealed (AES-256-GCM, keyed from
// AUTH_SECRET) so nobody can read or change what's inside. The guest list (GUEST_EMAILS) is checked
// on every request, so taking someone off it signs them out at once.
// Google's own tokens never go in the cookie or the page.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config";

export const SESSION_COOKIE = "trailmix-session";
/** The few minutes between leaving for Google and coming back: the state and PKCE check. */
export const OAUTH_COOKIE = "trailmix-oauth";

/**
 * A session lasts 7 days, the same as a Google refresh token while the app is in Testing mode, so
 * the quick sign-in (E7) comes at the same time for both.
 */
export const SESSION_DAYS = 7;

export type Session = {
  /** Google's id for the account (never shown). */
  sub: string;
  email: string;
  firstName: string;
  /** When it ends (milliseconds). */
  exp: number;
};

function key(): Buffer {
  const secret = config.authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`trailmix-session:${secret}`).digest();
}

/** Encrypts and signs a value for a cookie. */
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The value inside, or null if it was changed, sealed with another secret or isn't ours. */
export function unseal<T>(text: string | undefined | null): T | null {
  if (!text || text.length > 4000) return null;
  try {
    const raw = Buffer.from(text, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** GUEST_EMAILS, lower-cased. Empty means nobody gets in. */
export function guestEmails(): Set<string> {
  return new Set(
    (config.guestEmails() ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isGuest = (email: string) => guestEmails().has(email.trim().toLowerCase());

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** Secure cookies need https; the Mac and the automated tests run on plain http://localhost. */
export function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

/** A Set-Cookie header value. `maxAge` 0 deletes it. */
export function cookie(req: Request, name: string, value: string, maxAge: number): string {
  return [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax", ...(isHttps(req) ? ["Secure"] : [])].join("; ");
}

export function newSession(sub: string, email: string, firstName: string, now = Date.now()): Session {
  return { sub, email: email.toLowerCase(), firstName, exp: now + SESSION_DAYS * 86400_000 };
}

export const sessionCookie = (req: Request, s: Session) => cookie(req, SESSION_COOKIE, seal(s), SESSION_DAYS * 86400);
export const clearSession = (req: Request) => cookie(req, SESSION_COOKIE, "", 0);

/**
 * "signin": no session, or it ran out (E7: "Quick sign-in needed, your mix is safe").
 * "notInvited": signed in, but not (or no longer) on the guest list (E13).
 */
export type Guest = { ok: true; session: Session; who: string } | { ok: false; reason: "signin" | "notInvited" };

/** A short fingerprint of the account, for limits (E9) and the YouTube permission. Never the email. */
export const whoOf = (sub: string) => createHash("sha256").update(sub).digest("hex").slice(0, 16);

/** Every server route starts here (N6). `who` is a short fingerprint of the account, for limits (E9). */
export function checkGuest(req: Request, now = Date.now()): Guest {
  let s: Session | null = null;
  try {
    s = unseal<Session>(readCookie(req, SESSION_COOKIE));
  } catch {
    s = null; // no AUTH_SECRET: nobody is signed in
  }
  if (!s || typeof s.email !== "string" || typeof s.exp !== "number" || s.exp < now) return { ok: false, reason: "signin" };
  if (!isGuest(s.email)) return { ok: false, reason: "notInvited" };
  return { ok: true, session: s, who: whoOf(s.sub) };
}

/** checkGuest, plus the E7 test switch (a pretend expired sign-in, only while SHOW_RESET_PAGE is on). */
export function requireGuest(req: Request, forced: string | null): Guest {
  if (forced === "e7") return { ok: false, reason: "signin" };
  return checkGuest(req);
}
