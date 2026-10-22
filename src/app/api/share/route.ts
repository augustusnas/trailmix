import { getRoutine } from "@/data/routines";
import { sanitizeMix } from "@/lib/mixTypes";
import { fail, ok, readJson } from "@/server/http";
import { shareAllowed } from "@/server/limits";
import { requireGuest } from "@/server/session";
import { storeShare } from "@/server/shares";
import { testSwitch } from "@/server/testSwitch";

// F15: stores a mix as a shared mix page (Keep it / Open in…). Per Google account: 20 shares a day
// (E9). Saving to YouTube Music is /api/save.
export async function POST(req: Request) {
  const forced = testSwitch(req);
  const guest = requireGuest(req, forced);
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as { mix?: unknown } | undefined;
  const mix = sanitizeMix(body?.mix);
  if (!mix || !getRoutine(mix.routineId)) return fail("invalid", 400);
  if (!(await shareAllowed(guest.who))) return fail("sharesDaily", 429);
  return ok({ id: await storeShare(mix, { who: guest.who, firstName: guest.session.firstName }) });
}
