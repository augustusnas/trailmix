import { sanitizeMix } from "@/lib/mixTypes";
import { MixError } from "@/server/claude";
import { fail, ok, readJson } from "@/server/http";
import { requireGuest } from "@/server/session";
import { count } from "@/server/usage";
import { mixAllowed } from "@/server/limits";
import { newNotes, swapTrack } from "@/server/mixes";
import { trackCheckLog } from "@/server/stats";
import { testSwitch } from "@/server/testSwitch";
import { validateMixRequest } from "@/server/validate";

export const maxDuration = 60;

// F11: swap one track for another of similar energy in the same genres.
export async function POST(req: Request) {
  const forced = testSwitch(req);
  const guest = requireGuest(req, forced);
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const mixReq = validateMixRequest(body);
  const mix = sanitizeMix(body?.mix);
  const index = body?.index;
  if (!mixReq || !mix || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= mix.tracks.length) {
    return fail("invalid", 400);
  }
  if (mix.routineId !== mixReq.routine.id) return fail("invalid", 400);

  const refused = await mixAllowed(guest.who, forced);
  if (refused) return fail(refused, refused === "paused" ? 503 : 429);

  const notes = newNotes();
  try {
    const usage = { inputTokens: 0, outputTokens: 0, calls: 0 };
    const swapped = await swapTrack({ req: mixReq, usage, forced }, mix, index, notes);
    console.log(JSON.stringify({ event: "swap", usage, notes, trackCheck: await trackCheckLog(notes) }));
    await count("swaps");
    return ok({ mix: swapped });
  } catch (err) {
    // Nothing found in time (15 seconds on the phone): the original track stays.
    const kind = err instanceof MixError ? err.kind : "failed";
    console.error(JSON.stringify({ event: "swap-error", kind, detail: String(err).slice(0, 200), trackCheck: await trackCheckLog(notes) }));
    return kind === "resting" ? fail("resting", 503) : fail("swapFailed", kind === "timeout" ? 504 : 502);
  }
}
