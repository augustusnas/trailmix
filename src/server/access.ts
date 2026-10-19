// Who may make mixes. MILESTONE 4: replace checkAccess() with "signed in and on the guest list".
// Until then: a temporary beta access code (BETA_ACCESS_CODE), sent by the app with every request.

import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "./config";

export const ACCESS_HEADER = "x-trailmix-access";

const digest = (s: string) => createHash("sha256").update(s).digest();

export function codeMatches(given: string | null | undefined): boolean {
  const expected = config.accessCode();
  if (!expected || !given) return false; // no code set → nobody gets in
  return timingSafeEqual(digest(given.trim()), digest(expected));
}

export type Access = { ok: true; who: string } | { ok: false };

/** "who" identifies the person for limits: a short fingerprint of the code plus their IP address. */
export function checkAccess(req: Request, ip: string): Access {
  const code = req.headers.get(ACCESS_HEADER);
  if (!codeMatches(code)) return { ok: false };
  return { ok: true, who: `${digest(code!.trim()).toString("hex").slice(0, 12)}:${ip}` };
}

/** Per-code key for daily share limits (never the code itself). */
export function codeKey(req: Request): string {
  return digest((req.headers.get(ACCESS_HEADER) ?? "").trim()).toString("hex").slice(0, 12);
}
