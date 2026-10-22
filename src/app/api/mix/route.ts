import { PROGRESS_HEADER } from "@/lib/progress";
import { MESSAGES } from "@/lib/messages";
import { MixError } from "@/server/claude";
import { fail, ok, readJson } from "@/server/http";
import { requireGuest } from "@/server/session";
import { mixAllowed } from "@/server/limits";
import { makeMix, newNotes, type Stage } from "@/server/mixes";
import { saveProblem, trackCheckLog } from "@/server/stats";
import { cameOutShort } from "@/lib/mixTypes";
import { COUNT_SLACK, minTracks } from "@/server/fit";
import { testSwitch } from "@/server/testSwitch";
import { cleanTracks, validateMixRequest } from "@/server/validate";
import { cleanText } from "@/server/validate";

export const maxDuration = 60;

// F9 / F12: make a new mix, or a Remix of the current one (same settings, new list and name).
// The app asks for progress (PROGRESS_HEADER): then the answer is one JSON line per stage as the
// real work reaches it, and a last line with the mix or the error. Without it, one plain answer.
export async function POST(req: Request) {
  const forced = testSwitch(req);
  const guest = requireGuest(req, forced);
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const mixReq = validateMixRequest(body); // E11: before anything reaches Claude
  if (!mixReq) return fail("invalid", 400);
  const remix = body?.remix as { tracks?: unknown; name?: unknown } | undefined;
  const exclude = remix ? cleanTracks(remix.tracks, 40) : [];
  const avoidName = remix ? (cleanText(remix.name) ?? undefined) : undefined;

  const refused = await mixAllowed(guest.who, forced);
  if (refused) return fail(refused, refused === "paused" ? 503 : 429);

  const notes = newNotes();
  const started = Date.now();
  const settings = { routine: mixReq.routine.id, genres: mixReq.genres, energy: mixReq.energy, length: mixReq.length };
  const problem = (outcome: Parameters<typeof saveProblem>[0]["outcome"], tracks?: number, detail?: string) =>
    saveProblem({ event: remix ? "remix" : "mix", outcome, settings, notes, tracks, detail, seconds: Math.round((Date.now() - started) / 100) / 10 });
  const run = async (onStage?: (s: Stage) => void) => {
    try {
      const usage = { inputTokens: 0, outputTokens: 0, calls: 0 };
      const { mix, timings } = await makeMix({ req: mixReq, usage, forced }, exclude, avoidName, notes, onStage);
      // trackCheck (last): this mix's suggestions that failed the catalogue check, and the running total.
      console.log(JSON.stringify({ event: remix ? "remix" : "mix", routine: mix.routineId, length: mix.length, minutes: Math.round(mix.tracks.reduce((n, t) => n + t.durationMs, 0) / 6000) / 10, tracks: mix.tracks.length, usage, timings, notes, trackCheck: await trackCheckLog(notes) }));
      const fewTracks = mix.tracks.length < minTracks(mix.length) - COUNT_SLACK;
      if ((cameOutShort(mix) || fewTracks) && !forced) await problem("short", mix.tracks.length);
      return { mix } as const;
    } catch (err) {
      const kind = err instanceof MixError ? err.kind : "failed";
      const detail = err instanceof MixError ? (err.detail ?? kind) : String(err).slice(0, 200);
      if (!forced) await problem(kind, undefined, detail);
      console.error(JSON.stringify({ event: "mix-error", kind, detail, notes, trackCheck: await trackCheckLog(notes) }));
      return { kind } as const;
    }
  };
  const status = (kind: string) => (kind === "resting" ? 503 : kind === "timeout" ? 504 : 502);

  if (req.headers.get(PROGRESS_HEADER) !== "1") {
    const r = await run();
    return "mix" in r ? ok({ mix: r.mix }) : fail(r.kind, status(r.kind));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const line = (v: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(v)}\n`));
        } catch {
          open = false; // the phone stopped listening (left the screen); the mix still finishes and is logged
        }
      };
      const r = await run((stage) => line({ stage }));
      line("mix" in r ? { mix: r.mix } : { error: r.kind, message: MESSAGES[r.kind] });
      if (open) controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
