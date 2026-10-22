import { clearSession } from "@/server/session";

/** Signs out on this phone (E13 uses it too, after "not on the guest list"). */
export async function POST(req: Request) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": clearSession(req) },
  });
}
