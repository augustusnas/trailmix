import { checkAccess } from "@/server/access";
import { clientIp, fail, ok, readJson } from "@/server/http";
import { findLinks, type LinkResult } from "@/server/lookup";
import { testSwitch } from "@/server/testSwitch";
import { cleanText } from "@/server/validate";

export const maxDuration = 60;

// Links for Spotify and YouTube, found in the background after the mix is on screen.
// Odesli's free limit is shared by everyone, so this answers with what it could do now and when to
// ask again; the app keeps asking until every track has its links.
export async function POST(req: Request) {
  const access = checkAccess(req, clientIp(req));
  if (!access.ok) return fail("access", 401);
  const body = (await readJson(req)) as { mixId?: unknown; tracks?: unknown } | undefined;
  const mixId = typeof body?.mixId === "string" && /^[\w-]{8,64}$/.test(body.mixId) ? body.mixId : null;
  if (!mixId || !Array.isArray(body?.tracks)) return fail("invalid", 400);

  const tracks = body.tracks.slice(0, 40).flatMap((t) => {
    const title = cleanText(t?.title);
    const artist = cleanText(t?.artist);
    const appleUrl = typeof t?.appleUrl === "string" && /^https:\/\/music\.apple\.com\//.test(t.appleUrl) ? t.appleUrl : null;
    return title && artist && appleUrl ? [{ title, artist, appleUrl }] : [];
  });

  // E5 test switch: links unavailable, so tracks keep only their Apple links.
  if (testSwitch(req) === "e5") {
    return ok({ results: tracks.map((t) => ({ key: "", links: {}, done: true, title: t.title, artist: t.artist })), retryAfterMs: 0 });
  }

  const results: (LinkResult & { title: string; artist: string })[] = [];
  const started = Date.now();
  for (const t of tracks) {
    if (Date.now() - started > 20_000) break;
    const r = await findLinks(t, mixId);
    if (!r.done) break; // no Odesli slot left this minute
    results.push({ ...r, title: t.title, artist: t.artist });
  }
  const waiting = results.length < tracks.length;
  const retryAfterMs = waiting ? 60_000 - (Date.now() % 60_000) + 250 : 0;
  return ok({ results, retryAfterMs });
}
