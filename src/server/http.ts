import { NextResponse } from "next/server";
import { MESSAGES, type ErrorCode } from "@/lib/messages";

export function fail(error: ErrorCode, status: number) {
  return NextResponse.json({ error, message: MESSAGES[error] }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(body: unknown) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** A redirect (303) to one of our pages or Google, setting any cookies given. */
export function redirectTo(req: Request, to: string, cookies: string[] = []) {
  const headers = new Headers({ Location: new URL(to, req.url).toString(), "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}

/** The visitor's IP address, as Vercel reports it. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Reads a JSON body, refusing anything over 32 KB or not JSON. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 32_000) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
