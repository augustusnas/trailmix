"use client";
// How the app proves it may make mixes. MILESTONE 4: swap the access code for the signed-in session
// (the server side is server/access.ts). Until then every request carries the beta access code.

import type { ApiError } from "./messages";
import { MESSAGES } from "./messages";
import { PROGRESS_HEADER } from "./progress";
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

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const code = load().accessCode;
  if (code) h[ACCESS_HEADER] = code;
  const sw = testSwitch();
  if (sw) h[TEST_SWITCH_HEADER] = sw;
  return h;
}

/** Turns a server answer into a result: the data, or one of our friendly errors. */
function toResult<T>(okStatus: boolean, data: unknown): ApiResult<T> {
  const d = data as { error?: unknown; message?: string } | null;
  if (okStatus && d && d.error === undefined) return { ok: true, data: d as T };
  if (d && typeof d.error === "string" && d.error in MESSAGES) {
    if (d.error === "access") setAccessCode(null); // ask for the code again
    return { ok: false, error: d.error as ApiError["error"], message: d.message ?? MESSAGES[d.error as ApiError["error"]] };
  }
  return { ok: false, error: "failed", message: MESSAGES.failed };
}

function caught<T>(timedOut: boolean, onTimeout: ApiError["error"]): ApiResult<T> {
  if (timedOut) return { ok: false, error: onTimeout, message: MESSAGES[onTimeout] };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, error: "offline", message: MESSAGES.offline };
  return { ok: false, error: "failed", message: MESSAGES.failed };
}

export type CallOptions = {
  /** Give up after this long, so the screen never waits forever. */
  timeoutMs?: number;
  /** The error to show when it gives up. */
  onTimeout?: ApiError["error"];
};

/** A time limit the phone enforces itself (a plain timer, so tests can move the clock forward). */
function limit(timeoutMs?: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;
  return { signal: controller.signal, timedOut: () => timedOut, done: () => clearTimeout(timer) };
}

/** POSTs JSON to one of our own API routes, with the access code. Never throws. */
export async function callApi<T>(path: string, body: unknown, opts: CallOptions = {}): Promise<ApiResult<T>> {
  const l = limit(opts.timeoutMs);
  try {
    const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: l.signal, credentials: "omit" });
    return toResult<T>(res.ok, await res.json().catch(() => null));
  } catch {
    return caught<T>(l.timedOut(), opts.onTimeout ?? "timeout");
  } finally {
    l.done();
  }
}

/**
 * Like callApi, for answers that report progress: the server sends one JSON line per stage it
 * reaches, then a last line with the result. `onLine` sees every line before the last.
 */
export async function callApiWithProgress<T>(
  path: string,
  body: unknown,
  onLine: (line: Record<string, unknown>) => void,
  opts: CallOptions = {},
): Promise<ApiResult<T>> {
  const l = limit(opts.timeoutMs);
  try {
    const res = await fetch(path, { method: "POST", headers: { ...headers(), [PROGRESS_HEADER]: "1" }, body: JSON.stringify(body), signal: l.signal, credentials: "omit" });
    if (!res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) return toResult<T>(res.ok, await res.json().catch(() => null));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let last: unknown = null;
    for (;;) {
      const { value, done } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const text of lines) {
        if (!text.trim()) continue;
        let line: Record<string, unknown>;
        try {
          line = JSON.parse(text);
        } catch {
          continue;
        }
        if ("stage" in line) onLine(line);
        else last = line;
      }
      if (done) break;
    }
    return toResult<T>(res.ok, last);
  } catch {
    return caught<T>(l.timedOut(), opts.onTimeout ?? "timeout");
  } finally {
    l.done();
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
