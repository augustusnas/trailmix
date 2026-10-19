import { checkAccess } from "@/server/access";
import { MixError } from "@/server/claude";
import { clientIp, fail, ok, readJson } from "@/server/http";
import { mixAllowed } from "@/server/limits";
import { makeMix, newNotes } from "@/server/mixes";
import { trackCheckLog } from "@/server/stats";
import { testSwitch } from "@/server/testSwitch";
import { cleanTracks, validateMixRequest } from "@/server/validate";
import { cleanText } from "@/server/validate";

export const maxDuration = 60;

// F9 / F12: make a new mix, or a Remix of the current one (same settings, new list and name).
export async function POST(req: Request) {
  const access = checkAccess(req, clientIp(req));
  if (!access.ok) return fail("access", 401);
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const mixReq = validateMixRequest(body); // E11: before anything reaches Claude
  if (!mixReq) return fail("invalid", 400);
  const remix = body?.remix as { tracks?: unknown; name?: unknown } | undefined;
  const exclude = remix ? cleanTracks(remix.tracks, 40) : [];
  const avoidName = remix ? (cleanText(remix.name) ?? undefined) : undefined;

  const forced = testSwitch(req);
  const refused = await mixAllowed(access.who, forced);
  if (refused) return fail(refused, refused === "paused" ? 503 : 429);

  const notes = newNotes();
  try {
    const usage = { inputTokens: 0, outputTokens: 0, calls: 0 };
    const { mix, timings } = await makeMix({ req: mixReq, usage, forced }, exclude, avoidName, notes);
    // trackCheck (last): this mix's suggestions that failed the catalogue check, and the running total.
    console.log(JSON.stringify({ event: remix ? "remix" : "mix", routine: mix.routineId, length: mix.length, tracks: mix.tracks.length, usage, timings, notes, trackCheck: await trackCheckLog(notes) }));
    return ok({ mix });
  } catch (err) {
    const kind = err instanceof MixError ? err.kind : "failed";
    console.error(JSON.stringify({ event: "mix-error", kind, detail: String(err).slice(0, 200), trackCheck: await trackCheckLog(notes) }));
    return fail(kind, kind === "resting" ? 503 : 502);
  }
}
