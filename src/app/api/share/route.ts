import { getRoutine } from "@/data/routines";
import { sanitizeMix } from "@/lib/mixTypes";
import { checkAccess, codeKey } from "@/server/access";
import { clientIp, fail, ok, readJson } from "@/server/http";
import { shareAllowed, youtubeSaveQuotaLeft } from "@/server/limits";
import { storeShare } from "@/server/shares";
import { testSwitch } from "@/server/testSwitch";

// F15: stores a mix as a shared mix page (Keep it / Open in…). 20 a day per access code (E17).
export async function POST(req: Request) {
  const access = checkAccess(req, clientIp(req));
  if (!access.ok) return fail("access", 401);
  const body = (await readJson(req)) as { mix?: unknown; saveToYouTube?: unknown } | undefined;
  const mix = sanitizeMix(body?.mix);
  if (!mix || !getRoutine(mix.routineId)) return fail("invalid", 400);
  if (!(await shareAllowed(codeKey(req)))) return fail("sharesDaily", 429);
  const id = await storeShare(mix);
  // Keep it for YouTube Music users. MILESTONE 4: save the real playlist here.
  // E5: no YouTube quota left → the mix page still works; the app offers it and Share instead.
  const youtube = body?.saveToYouTube === true ? ((await youtubeSaveQuotaLeft(testSwitch(req))) ? "ok" : "quota") : undefined;
  return ok({ id, youtube });
}
