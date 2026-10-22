import { fail, ok, readJson } from "@/server/http";
import { requireGuest } from "@/server/session";
import { testSwitch } from "@/server/testSwitch";
import { findAppleLink, type AppleLink } from "@/server/lookup";
import { cleanText } from "@/server/validate";

export const maxDuration = 60;

// Exact Apple Music links, found in the background after the mix is on screen. iTunes's limit is
// shared by everyone, so this answers with what it could do now and when to ask again; the app
// keeps asking until every track is done. Until then a track opens an Apple Music search.
export async function POST(req: Request) {
  const guest = requireGuest(req, testSwitch(req));
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as { tracks?: unknown } | undefined;
  if (!Array.isArray(body?.tracks)) return fail("invalid", 400);

  const tracks = body.tracks.slice(0, 40).flatMap((t) => {
    const title = cleanText(t?.title);
    const artist = cleanText(t?.artist);
    return title && artist ? [{ title, artist }] : [];
  });

  const results: (AppleLink & { title: string; artist: string })[] = [];
  const started = Date.now();
  for (const t of tracks) {
    if (Date.now() - started > 20_000) break;
    const r = await findAppleLink(t);
    if (!r.done) break; // iTunes is busy or its limit is used for this minute
    results.push({ ...r, title: t.title, artist: t.artist });
  }
  const waiting = results.length < tracks.length;
  const retryAfterMs = waiting ? 60_000 - (Date.now() % 60_000) + 250 : 0;
  return ok({ results, retryAfterMs });
}
