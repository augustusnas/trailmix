"use client";
// How the app proves it may make mixes. MILESTONE 4: swap the access code for the signed-in session
// (the server side is server/access.ts). Until then every request carries the beta access code.

import type { ApiError } from "./messages";
import { MESSAGES } from "./messages";
import { load, setAccessCode } from "./store";

export const ACCESS_HEADER = "x-trailmix-access";
/** Beta test switches (only honoured by the server when SHOW_RESET_PAGE is true). */
export const TEST_SWITCH_HEADER = "x-trailmix-test";
export const TEST_SWITCH_KEY = "trailmix-test-switch";

export type ApiResult<T> = { ok: true; data: T } | ({ ok: false } & ApiError);

function testSwitch(): string | null {
  try {
    return sessionStorage.getItem(TEST_SWITCH_KEY);
  } catch {
    return null;
  }
}

/** POSTs JSON to one of our own API routes, with the access code. Never throws. */
export async function callApi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const code = load().accessCode;
  if (code) headers[ACCESS_HEADER] = code;
  const sw = testSwitch();
  if (sw) headers[TEST_SWITCH_HEADER] = sw;
  try {
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), signal, credentials: "omit" });
    const data = await res.json().catch(() => null);
    if (res.ok && data) return { ok: true, data: data as T };
    if (data && typeof data.error === "string" && data.error in MESSAGES) {
      if (data.error === "access") setAccessCode(null); // ask for the code again
      return { ok: false, error: data.error, message: data.message };
    }
    return { ok: false, error: "failed", message: MESSAGES.failed };
  } catch {
    if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, error: "offline", message: MESSAGES.offline };
    return { ok: false, error: "failed", message: MESSAGES.failed };
  }
}

/** Checks a code with the server and remembers it on this phone if it's right. */
export async function tryAccessCode(code: string): Promise<ApiResult<{ ok: true }>> {
  const res = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim() }),
    credentials: "omit",
  }).catch(() => null);
  if (!res) return { ok: false, error: "offline", message: MESSAGES.offline };
  const data = await res.json().catch(() => null);
  if (res.ok) {
    setAccessCode(code.trim());
    return { ok: true, data: { ok: true } };
  }
  return { ok: false, error: data?.error ?? "access", message: data?.message ?? MESSAGES.access };
}
