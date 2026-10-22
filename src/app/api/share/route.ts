import { getRoutine } from "@/data/routines";
import { sanitizeMix } from "@/lib/mixTypes";
import { fail, ok, readJson } from "@/server/http";
import { saveAllowed, shareAllowed, youtubeSaveQuotaLeft } from "@/server/limits";
import { requireGuest } from "@/server/session";
import { storeShare } from "@/server/shares";
import { testSwitch } from "@/server/testSwitch";

// F15: stores a mix as a shared mix page (Keep it / Open in…). Per Google account: 20 shares a day,
// and 10 saves to YouTube Music an hour (E9).
export async function POST(req: Request) {
  const forced = testSwitch(req);
  const guest = requireGuest(req, forced);
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as { mix?: unknown; saveToYouTube?: unknown } | undefined;
  const mix = sanitizeMix(body?.mix);
  if (!mix || !getRoutine(mix.routineId)) return fail("invalid", 400);
  const saving = body?.saveToYouTube === true;
  if (saving && !(await saveAllowed(guest.who))) return fail("savesHourly", 429);
  if (!(await shareAllowed(guest.who))) return fail("sharesDaily", 429);
  const id = await storeShare(mix);
  // Keep it for YouTube Music users. MILESTONE 4: save the real playlist here.
  // E5: no YouTube quota left → the mix page still works; the app offers it and Share instead.
  const youtube = saving ? ((await youtubeSaveQuotaLeft(forced)) ? "ok" : "quota") : undefined;
  return ok({ id, youtube });
}
