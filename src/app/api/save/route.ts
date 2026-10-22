import { getRoutine } from "@/data/routines";
import { sanitizeMix } from "@/lib/mixTypes";
import { fail, ok, readJson } from "@/server/http";
import { saveAllowed } from "@/server/limits";
import { requireGuest } from "@/server/session";
import { attachPlaylist } from "@/server/shares";
import { testSwitch } from "@/server/testSwitch";
import { checkedTitle, savePlaylist } from "@/server/youtube";

export const maxDuration = 30;

const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

// F13, F14: Keep it in YouTube Music saves the mix as a new unlisted playlist. `retryOf` (E6) adds
// only the tracks a partial save missed. Per Google account: 10 saves an hour (E9).
export async function POST(req: Request) {
  const forced = testSwitch(req);
  const guest = requireGuest(req, forced);
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as { mix?: unknown; title?: unknown; retryOf?: unknown } | undefined;
  const mix = sanitizeMix(body?.mix);
  if (!mix || !getRoutine(mix.routineId)) return fail("invalid", 400);
  const retryOf = typeof body?.retryOf === "string" && PLAYLIST_ID.test(body.retryOf) ? body.retryOf : undefined;
  if (body?.retryOf !== undefined && !retryOf) return fail("invalid", 400);
  if (!(await saveAllowed(guest.who))) return fail("savesHourly", 429);

  const r = await savePlaylist({ who: guest.who, email: guest.session.email, mix, title: checkedTitle(mix, body?.title), retryOf, forced });
  if (!r.ok) {
    if (r.reason === "permission") return fail("youtubePermission", 403);
    if (r.reason === "expired") return fail("signin", 401); // E7: Testing mode's 7 days ran out
    if (r.reason === "quota") return fail("youtubeQuota", 429); // E5
    return fail("saveFailed", 502);
  }
  // The shared mix page can then offer "Open the whole playlist".
  if (mix.shareId) await attachPlaylist(mix.shareId, r.playlistId);
  return ok({ playlistId: r.playlistId, saved: r.saved, total: r.total, missing: r.missing });
}
