import { codeMatches } from "@/server/access";
import { clientIp, fail, ok, readJson } from "@/server/http";
import { codeTryAllowed, recordWrongCode } from "@/server/limits";

// Checks a beta access code once, on Welcome. Wrong guesses are limited per IP address.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await codeTryAllowed(ip))) return fail("accessAttempts", 429);
  const body = (await readJson(req)) as { code?: unknown } | undefined;
  const code = typeof body?.code === "string" ? body.code.slice(0, 100) : "";
  if (codeMatches(code)) return ok({ ok: true });
  await recordWrongCode(ip);
  return fail("access", 401);
}
